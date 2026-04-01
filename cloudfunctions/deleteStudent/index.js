// cloudfunctions/deleteStudent/index.js
// 永久删除学生数据（包括经验日志）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { studentId } = event
  
  if (!studentId) {
    return { success: false, message: '缺少学生ID' }
  }

  try {
    // 删除该学生的经验日志（最多删除500条）
    const logsRes = await db.collection('expLogs')
      .where({ studentId })
      .limit(500)
      .get()
    
    let deletedLogs = 0
    for (const log of logsRes.data) {
      await db.collection('expLogs').doc(log._id).remove()
      deletedLogs++
    }

    // 删除学生记录
    await db.collection('students').doc(studentId).remove()

    return { 
      success: true, 
      message: '删除成功',
      deletedLogs
    }
  } catch (e) {
    console.error(e)
    return { success: false, message: e.message }
  }
}
