// cloudfunctions/drawGacha/index.js
// 抽卡系统：每天免费3次，完成普通任务+3次，完成特殊任务+5次
// 概率：70% 获得1EXP，15% 成长加速剂，15% 挑战凭证
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 属性名称（中英文对应）
const ATTR_NAMES_ZH = ['智识', '专注', '毅力', '灵感', '表达', '心志']
const ATTR_NAMES_EN = ['wisdom', 'focus', 'perseverance', 'inspiration', 'expression', 'willpower']

// 获取今天的日期字符串（YYYYMMDD），用于每日重置判断
function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  try {
    const { openid } = event
    if (!openid) return { success: false, error: '缺少 openid' }

    // 获取学生信息
    const studentRes = await db.collection('students').where({ openid }).get()
    if (!studentRes.data || studentRes.data.length === 0) {
      return { success: false, error: '学生信息不存在' }
    }
    const student = studentRes.data[0]

    // 检查每日重置
    const today = getTodayStr()
    const lastDrawDate = student.lastDrawDate || ''
    const isFirstDrawToday = !lastDrawDate || lastDrawDate !== today

    // 计算当前剩余次数（单一字段 remainingDraws）
    // 兼容老数据：优先用 remainingDraws，没有则用 dailyDrawLeft（旧格式已含奖励）
    let currentRemaining
    if (typeof student.remainingDraws === 'number' && !isNaN(student.remainingDraws)) {
      currentRemaining = student.remainingDraws
    } else {
      // 老账号：直接用 dailyDrawLeft（已含基础+奖励）
      currentRemaining = (typeof student.dailyDrawLeft === 'number' && !isNaN(student.dailyDrawLeft))
        ? student.dailyDrawLeft : 3
    }

    if (isFirstDrawToday) {
      // 新的一天：从基础3重置
      // 注意：不再读废弃的 bonusToday 字段
      // 如果 confirmTask 已在今天之前写入了 remainingDraws > 3（含任务奖励），
      // 但 lastDrawDate 可能因为任务是昨天晚确认而变成"今天"，所以 isFirstDrawToday = false 不会走到这里
      // 如果 lastDrawDate 是更早的日期，说明昨天或更早没有任何操作，直接重置为基础3次
      currentRemaining = 3
      await db.collection('students').doc(student._id).update({
        data: {
          remainingDraws: currentRemaining,
          lastDrawDate: today
        }
      })
    }

    if (currentRemaining <= 0) {
      return { success: false, error: '今日抽卡次数已用完', dailyLeft: 0 }
    }

    // 随机抽卡（每次扣 remainingDraws - 1）
    const rand = Math.random()
    let result = {}

    // 先扣次数（remainingDraws - 1）
    await db.collection('students').doc(student._id).update({
      data: { remainingDraws: _.inc(-1), lastDrawDate: today }
    })

    if (rand < 0.15) {
      result = { type: 'growthAccelerant', desc: '成长加速剂', subDesc: '可永久提升任一属性成长速度 +0.1' }
      await db.collection('students').doc(student._id).update({
        data: { growthAccelerants: _.inc(1) }
      })
    } else if (rand < 0.30) {
      result = { type: 'challengeVoucher', desc: '挑战凭证', subDesc: '可挑战同班同学，胜者获得 5 EXP' }
      await db.collection('students').doc(student._id).update({
        data: { challengeVouchers: _.inc(1) }
      })
    } else {
      result = { type: 'exp', desc: '+1 EXP', subDesc: '继续加油！' }
      await db.collection('students').doc(student._id).update({
        data: { totalExp: _.inc(1) }
      })
      await db.collection('expLogs').add({
        data: {
          studentId: student._id,
          classId: student.classId,
          type: 'gacha',
          amount: 1,
          baseExp: 1,
          bonusExp: 0,
          desc: '抽卡奖励',
          createdAt: Date.now()
        }
      })
    }

    // 返回最新状态
    const updated = await db.collection('students').doc(student._id).get()
    const latest = updated.data || {}
    const latestRemaining = (typeof latest.remainingDraws === 'number')
      ? latest.remainingDraws
      : (typeof latest.dailyDrawLeft === 'number' ? latest.dailyDrawLeft : 3)
    return {
      success: true,
      result,
      dailyLeft: latestRemaining,
      newTotalExp: latest.totalExp
    }

  } catch (e) {
    console.error('drawGacha error:', e)
    return { success: false, error: e.message || '抽卡失败' }
  }
}
