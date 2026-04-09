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

    // 调试模式：返回数据库原始值，方便排查
    if (debug) {
      return {
        success: true,
        debug: true,
        today,
        lastDrawDate,
        dailyDrawLeft_raw: student.dailyDrawLeft,
        typeof_dailyDrawLeft: typeof student.dailyDrawLeft,
        dailyDrawLeft_isNumber: typeof student.dailyDrawLeft === 'number',
        challengeVouchers: student.challengeVouchers,
        growthAccelerants: student.growthAccelerants,
        totalExp: student.totalExp,
        lastTaskCompleteTime: student.lastTaskCompleteTime,
      }
    }

    let dailyLeft
    if (!lastDrawDate || lastDrawDate !== today) {
      // 新账号或新的一天 → 重置为 3
      dailyLeft = 3
    } else {
      // 今天已有抽卡记录 → 使用存储值
      dailyLeft = typeof student.dailyDrawLeft === 'number' ? student.dailyDrawLeft : 3
    }

    return {
      success: true,
      dailyLeft,
      lastDrawDate,
      challengeVouchers: student.challengeVouchers || 0,
      growthAccelerants: student.growthAccelerants || 0,
      totalExp: student.totalExp || 0
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
