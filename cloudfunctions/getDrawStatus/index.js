// cloudfunctions/getDrawStatus/index.js
// 获取抽卡状态，不依赖前端缓存
// 注意：不再用 openid 查询，统一用 studentId（_id 主键）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  try {
    // 优先用 studentId（_id 主键），fallback 到 openid（兼容老调用方式）
    const studentId = event.studentId
    const openid = event.openid || cloud.getWXContext().OPENID

    let student = null

    // 方式1：用 _id 主键精确查（推荐）
    if (studentId) {
      const res = await db.collection('students').doc(studentId).get()
      student = res.data
    }

    // 方式2：用 openid 兜底（兼容老数据/老调用）
    if (!student && openid) {
      const res = await db.collection('students').where({ openid }).get()
      if (res.data && res.data.length > 0) student = res.data[0]
    }

    if (!student) {
      return { success: false, error: '学生信息不存在' }
    }

    const today = getTodayStr()
    const lastDrawDate = student.lastDrawDate || ''

    // 计算今日剩余总次数
    // 优先用 remainingDraws（单一字段）；兼容老数据用 dailyDrawLeft
    let dailyLeft
    let bonusToday = 0

    if (lastDrawDate !== today) {
      // 今天还没有任何抽卡/任务行为，返回基础3次（confirmTask 会在任务完成时写 remainingDraws+lastDrawDate）
      // 不主动写数据库，仅返回基础次数，等 drawGacha 第一次被调用时才真正重置
      dailyLeft = 3
      bonusToday = 0
    } else if (typeof student.remainingDraws === 'number' && !isNaN(student.remainingDraws)) {
      dailyLeft = student.remainingDraws
      bonusToday = Math.max(0, student.remainingDraws - 3)
    } else {
      // 老数据：dailyDrawLeft 已含基础+奖励，直接用
      dailyLeft = (typeof student.dailyDrawLeft === 'number' && !isNaN(student.dailyDrawLeft))
        ? student.dailyDrawLeft : 3
      bonusToday = Math.max(0, dailyLeft - 3)
    }

    // 调试模式：返回数据库原始值，方便排查
    if (event.debug) {
      return {
        success: true,
        debug: true,
        today,
        lastDrawDate,
        remainingDraws_raw: student.remainingDraws,
        dailyDrawLeft_raw: student.dailyDrawLeft,
        bonusToday_raw: student.bonusToday,
        dailyLeft,
        challengeVouchers: student.challengeVouchers,
        growthAccelerants: student.growthAccelerants,
        totalExp: student.totalExp,
        lastTaskCompleteTime: student.lastTaskCompleteTime,
      }
    }

    return {
      success: true,
      dailyLeft,
      bonusToday,
      baseDraw: 3,
      lastDrawDate,
      challengeVouchers: student.challengeVouchers || 0,
      growthAccelerants: student.growthAccelerants || 0,
      totalExp: student.totalExp || 0
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
