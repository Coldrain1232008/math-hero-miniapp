// cloudfunctions/getStudentInfo/index.js
// 返回学生的最新数据，用于前端刷新 globalData
// 注意：不再用 openid 查询，统一用 studentId（_id 主键）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
      return { success: false, error: '学生不存在' }
    }

    // 计算今日剩余总次数：优先用 remainingDraws，兼容老数据用 dailyDrawLeft
    let dailyDrawLeft
    let bonusToday = 0
    if (typeof student.remainingDraws === 'number' && !isNaN(student.remainingDraws)) {
      dailyDrawLeft = student.remainingDraws
      bonusToday = Math.max(0, student.remainingDraws - 3)
    } else {
      dailyDrawLeft = (typeof student.dailyDrawLeft === 'number' && !isNaN(student.dailyDrawLeft))
        ? student.dailyDrawLeft : 3
      bonusToday = Math.max(0, dailyDrawLeft - 3)
    }
    return {
      success: true,
      dailyDrawLeft,
      bonusToday,
      challengeVouchers: student.challengeVouchers ?? 0,
      growthAccelerants: student.growthAccelerants ?? 0,
      totalExp: student.totalExp ?? 0,
      lastDrawDate: student.lastDrawDate ?? '',
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
