// cloudfunctions/getStudentInfo/index.js
// 返回学生的最新数据，用于前端刷新 globalData
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const openid = event.openid || cloud.getWXContext().OPENID
    if (!openid) return { success: false, error: '缺少 openid' }

    const res = await db.collection('students').where({ openid }).get()
    if (!res.data || res.data.length === 0) {
      return { success: false, error: '学生不存在' }
    }
    const s = res.data[0]
    // 计算今日剩余总次数：优先用 remainingDraws，兼容老数据用 dailyDrawLeft
    let dailyDrawLeft
    let bonusToday = 0
    if (typeof s.remainingDraws === 'number' && !isNaN(s.remainingDraws)) {
      dailyDrawLeft = s.remainingDraws
      bonusToday = Math.max(0, s.remainingDraws - 3)
    } else {
      dailyDrawLeft = (typeof s.dailyDrawLeft === 'number' && !isNaN(s.dailyDrawLeft))
        ? s.dailyDrawLeft : 3
      bonusToday = Math.max(0, dailyDrawLeft - 3)
    }
    return {
      success: true,
      dailyDrawLeft,
      bonusToday,
      challengeVouchers: s.challengeVouchers ?? 0,
      growthAccelerants: s.growthAccelerants ?? 0,
      totalExp: s.totalExp ?? 0,
      lastDrawDate: s.lastDrawDate ?? '',
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
