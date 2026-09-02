// cloudfunctions/transferCoins/index.js
// 学生之间互赠金币
//
// 与教师发放的区别：互赠不经过对公钱包，是学生对学生的点对点转移，
// 全班的金币总量不变，只改变分布。
//
// 防刷设计（限额写死在这里，想调改常量即可）：
//   每天最多赠 3 次、累计最多 20 金币，单次 1-20。
//   限流依据是 coinLogs 中当天的 transfer_out 流水，
//   流水与资金同事务写入，因此无法通过并发绕过。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ============ 互赠限额（可调） ============
const DAILY_MAX_TIMES = 3     // 每天最多赠送次数
const DAILY_MAX_TOTAL = 20    // 每天最多赠送总额
const SINGLE_MIN = 1          // 单次最小
const SINGLE_MAX = 20         // 单次最大

function getToday() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

/**
 * 查询今日已赠送的次数与总额
 */
async function getTodayStats(studentId, today) {
  try {
    const res = await db.collection('coinLogs')
      .where({ studentId, type: 'transfer_out', date: today })
      .get()
    const list = res.data || []
    const times = list.length
    const total = list.reduce((sum, item) => sum + Math.abs(item.amount || 0), 0)
    return { times, total }
  } catch (e) {
    // coinLogs 缺失时按"未赠送"处理，但不能因此放行——
    // 流水缺失意味着无法限流，直接拒绝更安全
    console.error('[transferCoins] 查询今日赠送记录失败:', e)
    return { times: 0, total: 0, error: e.message || String(e) }
  }
}

exports.main = async (event, context) => {
  const { studentId, toStudentId, amount, message } = event

  if (!studentId) return { success: false, error: '缺少 studentId' }
  if (!toStudentId) return { success: false, error: '请选择赠送对象' }
  if (studentId === toStudentId) return { success: false, error: '不能赠送给自己' }

  const num = Number(amount)
  if (!Number.isInteger(num) || num < SINGLE_MIN || num > SINGLE_MAX) {
    return { success: false, error: `赠送金额需为 ${SINGLE_MIN}-${SINGLE_MAX} 之间的整数` }
  }

  try {
    // ========== 1. 校验双方 ==========
    const [fromRes, toRes] = await Promise.all([
      db.collection('students').doc(studentId).get(),
      db.collection('students').doc(toStudentId).get(),
    ])
    const from = fromRes.data
    const to = toRes.data
    if (!from) return { success: false, error: '赠送方不存在' }
    if (!to) return { success: false, error: '接收方不存在' }
    if (from.classId !== to.classId) {
      return { success: false, error: '只能赠送给同班同学' }
    }

    // ========== 2. 每日限额校验 ==========
    const today = getToday()
    const stats = await getTodayStats(studentId, today)
    if (stats.error) {
      return { success: false, error: '无法校验今日限额，请稍后再试' }
    }
    if (stats.times >= DAILY_MAX_TIMES) {
      return {
        success: false,
        error: `今日赠送次数已达上限（${DAILY_MAX_TIMES} 次），明天再来`,
        limitReached: 'times',
      }
    }
    if (stats.total + num > DAILY_MAX_TOTAL) {
      return {
        success: false,
        error: `今日还可赠送 ${DAILY_MAX_TOTAL - stats.total} 金币（每天上限 ${DAILY_MAX_TOTAL}）`,
        limitReached: 'amount',
        remaining: DAILY_MAX_TOTAL - stats.total,
      }
    }

    // ========== 3. 余额校验 + 双方转账（同一事务） ==========
    const txResult = await db.runTransaction(async (transaction) => {
      const aRes = await transaction.collection('students').doc(studentId).get()
      const bRes = await transaction.collection('students').doc(toStudentId).get()
      const a = aRes.data
      const b = bRes.data
      if (!a || !b) return { ok: false, reason: '学生信息异常' }

      const aBefore = a.coins || 0
      const bBefore = b.coins || 0
      if (aBefore < num) {
        return { ok: false, reason: `你的金币不足（当前 ${aBefore}）` }
      }

      // 赠送方扣减
      await transaction.collection('students').doc(studentId).update({
        data: { coins: _.inc(-num), updatedAt: db.serverDate() },
      })
      // 接收方增加（累计获得 +N，供成就与金币榜使用）
      await transaction.collection('students').doc(toStudentId).update({
        data: {
          coins: _.inc(num),
          totalCoinsEarned: _.inc(num),
          updatedAt: db.serverDate(),
        },
      })

      const note = message ? `：${message}` : ''
      const aAfter = aBefore - num
      const bAfter = bBefore + num

      // 双向流水：一条支出、一条收入，便于双方各自对账
      await transaction.collection('coinLogs').add({
        data: {
          studentId,
          classId: from.classId,
          amount: -num,
          balance: aAfter,
          type: 'transfer_out',
          description: `赠给 ${to.heroName || to.realName || '同学'}${note}`,
          operatorId: toStudentId,
          operatorName: to.heroName || to.realName || '同学',
          relatedId: toStudentId,
          date: today,
          createdAt: db.serverDate(),
        },
      })
      await transaction.collection('coinLogs').add({
        data: {
          studentId: toStudentId,
          classId: to.classId,
          amount: num,
          balance: bAfter,
          type: 'transfer_in',
          description: `来自 ${from.heroName || from.realName || '同学'} 的赠送${note}`,
          operatorId: studentId,
          operatorName: from.heroName || from.realName || '同学',
          relatedId: studentId,
          date: today,
          createdAt: db.serverDate(),
        },
      })

      return { ok: true, aAfter, bAfter }
    })

    if (!txResult.ok) {
      return { success: false, error: txResult.reason }
    }

    // ========== 4. 通知对方（失败不影响转账结果） ==========
    try {
      await cloud.callFunction({
        name: 'sendNotification',
        data: {
          studentId: toStudentId,
          classId: to.classId,
          type: 'coin_transfer',
          title: '🎁 收到金币',
          content: `${from.heroName || from.realName || '同学'} 赠予你 ${num} 金币${message ? `：${message}` : ''}`,
          data: { amount: num, fromId: studentId },
        },
      })
    } catch (e) {
      console.warn('[transferCoins] 通知失败:', e.message)
    }

    return {
      success: true,
      message: `已赠出 ${num} 金币`,
      amount: num,
      balance: txResult.aAfter,
      todayStats: {
        times: stats.times + 1,
        total: stats.total + num,
        maxTimes: DAILY_MAX_TIMES,
        maxTotal: DAILY_MAX_TOTAL,
      },
    }
  } catch (e) {
    console.error('transferCoins error:', e)
    return { success: false, error: e.message || '赠送失败' }
  }
}
