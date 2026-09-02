// cloudfunctions/getCoinLogs/index.js
// 金币查询：流水明细 / 个人余额与赠送额度 / 全班金币概览
//
// 一个函数三种用途，避免为查询类需求堆砌一堆小函数：
//   action='list'      → 某个学生的金币流水（学生看自己，教师看某个学生）
//   action='summary'   → 余额 + 今日剩余赠送额度（赠送弹窗用）
//   action='classList' → 全班学生金币概览（教师端发金币页用）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 与 transferCoins 保持一致，改这里请同步改那边
const DAILY_MAX_TIMES = 3
const DAILY_MAX_TOTAL = 20
const SINGLE_MAX = 20

function getToday() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

// 流水类型 → 展示文案
const TYPE_LABEL = {
  teacher_grant: '教师发放',
  teacher_deduct: '教师扣除',
  transfer_out: '赠出',
  transfer_in: '收到赠送',
  shop_purchase: '商城消费',
}

function formatTime(ts) {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : new Date(ts)
  if (isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * 取某个学生今日的赠送统计
 */
async function getTodayTransferStats(studentId, today) {
  let times = 0
  let total = 0
  try {
    const res = await db.collection('coinLogs')
      .where({ studentId, type: 'transfer_out', date: today })
      .get()
    const list = res.data || []
    times = list.length
    total = list.reduce((s, i) => s + Math.abs(i.amount || 0), 0)
  } catch (e) {
    console.error('[getCoinLogs] 今日赠送统计失败:', e)
  }
  return { times, total }
}

exports.main = async (event, context) => {
  const {
    action = 'list',
    studentId,
    targetStudentId,
    classId,
    type = 'all',      // 'all' | 'income' | 'expense'
    limit = 30,
    skip = 0,
  } = event

  if (!studentId) return { success: false, error: '缺少 studentId' }

  try {
    // ========== 个人余额 + 今日赠送额度 ==========
    if (action === 'summary') {
      const res = await db.collection('students').doc(studentId).get()
      const stu = res.data
      if (!stu) return { success: false, error: '学生不存在' }

      const today = getToday()
      const stats = await getTodayTransferStats(studentId, today)

      return {
        success: true,
        coins: stu.coins || 0,
        totalCoinsEarned: stu.totalCoinsEarned || 0,
        todayTransfer: {
          times: stats.times,
          total: stats.total,
          maxTimes: DAILY_MAX_TIMES,
          maxTotal: DAILY_MAX_TOTAL,
          remainTimes: Math.max(0, DAILY_MAX_TIMES - stats.times),
          remainAmount: Math.max(0, DAILY_MAX_TOTAL - stats.total),
        },
        limit: { singleMax: SINGLE_MAX },
      }
    }

    // ========== 全班金币概览（教师端） ==========
    if (action === 'classList') {
      const cid = classId
      if (!cid) return { success: false, error: '缺少 classId' }

      const res = await db.collection('students')
        .where({ classId: cid })
        .field({ _id: true, heroName: true, realName: true, coins: true, totalCoinsEarned: true, level: true })
        .orderBy('coins', 'desc')
        .limit(100)
        .get()

      const list = (res.data || []).map((s) => ({
        _id: s._id,
        name: s.heroName || s.realName || '未知',
        coins: s.coins || 0,
        totalCoinsEarned: s.totalCoinsEarned || 0,
        level: s.level || 1,
      }))

      const totalCoins = list.reduce((s, i) => s + i.coins, 0)

      return {
        success: true,
        list,
        stats: {
          studentCount: list.length,
          totalCoins,
          avgCoins: list.length > 0 ? Math.round(totalCoins / list.length) : 0,
        },
      }
    }

    // ========== 流水明细 ==========
    // 教师查学生时传 targetStudentId；学生查自己传 studentId
    const ownerId = targetStudentId || studentId

    const where = { studentId: ownerId }
    if (type === 'income') where.amount = _.gt(0)
    else if (type === 'expense') where.amount = _.lt(0)

    const res = await db.collection('coinLogs')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(Math.min(limit, 100))
      .get()

    const logs = (res.data || []).map((item) => {
      const amt = item.amount || 0
      return {
        _id: item._id,
        amount: amt,
        absAmount: Math.abs(amt),
        isIncome: amt > 0,
        balance: item.balance || 0,
        type: item.type || '',
        typeLabel: TYPE_LABEL[item.type] || item.type || '其他',
        description: item.description || '',
        operatorName: item.operatorName || '',
        timeText: formatTime(item.createdAt),
      }
    })

    // 汇总（仅当前页统计，避免全量扫描）
    const income = logs.filter((l) => l.isIncome).reduce((s, l) => s + l.absAmount, 0)
    const expense = logs.filter((l) => !l.isIncome).reduce((s, l) => s + l.absAmount, 0)

    return {
      success: true,
      logs,
      stats: { income, expense, count: logs.length },
      hasMore: logs.length === Math.min(limit, 100),
    }
  } catch (e) {
    console.error('getCoinLogs error:', e)
    return { success: false, error: e.message || '查询失败' }
  }
}
