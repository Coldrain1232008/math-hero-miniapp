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

    // 计算今日剩余总次数：基础 3 + bonusToday
    // bonusToday 单独记录今日任务奖励（confirmTask 时写入）
    // 兼容老数据：bonusToday 不存在时，从 dailyDrawLeft 推断（假设存的是总量）
    const bonusToday = (typeof student.bonusToday === 'number' && !isNaN(student.bonusToday))
      ? student.bonusToday
      : Math.max(0, (student.dailyDrawLeft || 3) - 3)  // 老数据：总量-3=bonus
    const baseDraw = 3  // 每日基础次数，永远是3
    const dailyLeft = baseDraw + bonusToday

    // 调试模式：返回数据库原始值，方便排查
    if (debug) {
      return {
        success: true,
        debug: true,
        today,
        lastDrawDate,
        dailyDrawLeft_raw: student.dailyDrawLeft,
        bonusToday_raw: student.bonusToday,
        bonusToday_calculated: bonusToday,
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
      baseDraw,
      lastDrawDate,
      challengeVouchers: student.challengeVouchers || 0,
      growthAccelerants: student.growthAccelerants || 0,
      totalExp: student.totalExp || 0
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
