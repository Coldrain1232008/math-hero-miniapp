// cloudfunctions/getDrawStatus/index.js
// 获取抽卡状态，不依赖前端缓存
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  try {
    const { openid, debug } = event
    if (!openid) return { success: false, error: '缺少 openid' }

    const studentRes = await db.collection('students').where({ openid }).get()
    if (!studentRes.data || studentRes.data.length === 0) {
      return { success: false, error: '学生信息不存在' }
    }
    const student = studentRes.data[0]

    const today = getTodayStr()
    const lastDrawDate = student.lastDrawDate || ''

    // 计算今日剩余总次数
    // 优先用 remainingDraws（单一字段）；兼容老数据用 dailyDrawLeft
    let dailyLeft
    let bonusToday = 0
    if (typeof student.remainingDraws === 'number' && !isNaN(student.remainingDraws)) {
      dailyLeft = student.remainingDraws
      bonusToday = Math.max(0, student.remainingDraws - 3)
    } else {
      // 老数据：dailyDrawLeft 已含基础+奖励，直接用
      dailyLeft = (typeof student.dailyDrawLeft === 'number' && !isNaN(student.dailyDrawLeft))
        ? student.dailyDrawLeft : 3
      bonusToday = Math.max(0, dailyLeft - 3)
    }

    // 调试模式：返回数据库原始值，方便排查
    if (debug) {
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
