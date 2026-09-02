// 云函数：checkIn
// 每日签到，获得 +5 EXP

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId } = event

  if (!studentId) {
    return { success: false, error: '缺少studentId' }
  }

  try {
    // 获取学生信息
    const studentRes = await db.collection('students').doc(studentId).get()
    const student = studentRes.data

    if (!student) {
      return { success: false, error: '学生不存在' }
    }

    // 获取今天的日期字符串（格式：YYYYMMDD）
    const now = new Date()
    const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

    // 检查是否已签到
    if (student.lastCheckInDate === today) {
      return {
        success: true,
        checked: true,
        message: '今日已签到',
        totalCheckInDays: student.totalCheckInDays || 0
      }
    }

    // 计算累计签到天数
    const totalCheckInDays = (student.totalCheckInDays || 0) + 1

    // 更新学生签到记录
    await db.collection('students').doc(studentId).update({
      data: {
        lastCheckInDate: today,
        totalCheckInDays: totalCheckInDays
      }
    })

    // 增加 5 EXP（调用 addExp 云函数）
    try {
      await cloud.callFunction({
        name: 'addExp',
        data: {
          studentId: studentId,
          classId: student.classId,
          expVal: 5,
          type: 'checkin',
          desc: '每日签到'
        }
      })
    } catch (expErr) {
      console.warn('addExp error:', expErr.message)
      // 签到记录已保存，EXP增加失败不影响签到结果
    }

    // 触发徽章检查（fire-and-forget）
    try {
      cloud.callFunction({
        name: 'checkBadges',
        data: { studentId }
      }).catch(err => console.warn('checkBadges async error:', err.message))
    } catch (e) {
      // 忽略同步错误
    }

    return {
      success: true,
      checked: true,
      message: '签到成功，获得 +5 EXP',
      totalCheckInDays: totalCheckInDays
    }

  } catch (err) {
    console.error('checkIn error:', err)
    return { success: false, error: err.message }
  }
}
