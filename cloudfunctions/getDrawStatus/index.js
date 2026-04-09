// cloudfunctions/getDrawStatus/index.js
// 获取学生真实抽卡状态（每日次数、道具数量）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 获取今天的日期字符串（YYYYMMDD）
function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  const { openid } = event
  if (!openid) {
    return { success: false, error: '缺少 openid' }
  }

  try {
    const res = await db.collection('students').where({ openid }).get()
    if (!res.data || res.data.length === 0) {
      return { success: false, error: '学生不存在' }
    }
    const student = res.data[0]

    const today = getTodayStr()
    const lastDrawDate = student.lastDrawDate || ''

    // 新的一天或新账号，重置为3次
    let dailyLeft
    if (!lastDrawDate || lastDrawDate !== today) {
      dailyLeft = 3
    } else {
      dailyLeft = typeof student.dailyDrawLeft === 'number' ? student.dailyDrawLeft : 3
    }

    return {
      success: true,
      dailyLeft,
      challengeVouchers: student.challengeVouchers || 0,
      growthAccelerants: student.growthAccelerants || 0,
      totalExp: student.totalExp || 0,
      lastDrawDate: student.lastDrawDate || ''
    }
  } catch (err) {
    console.error('getDrawStatus error:', err)
    return { success: false, error: err.message }
  }
}
