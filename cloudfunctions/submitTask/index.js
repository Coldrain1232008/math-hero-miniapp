// 云函数：submitTask
// 学生提交任务完成，等待老师确认

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { taskId, studentId } = event
  
  if (!taskId) {
    return { success: false, error: '缺少taskId' }
  }
  
  try {
    // 获取任务信息
    const taskRes = await db.collection('dailyTasks').doc(taskId).get()
    const task = taskRes.data
    
    if (!task) {
      return { success: false, error: '任务不存在' }
    }
    
    // 验证任务是否属于该学生
    if (studentId && task.studentId !== studentId) {
      return { success: false, error: '无权操作此任务' }
    }
    
    if (task.status !== 'pending') {
      return { success: false, error: '任务状态不正确，无法提交' }
    }
    
    // 更新任务状态为已提交
    await db.collection('dailyTasks').doc(taskId).update({
      data: {
        status: 'submitted',
        submitTime: new Date()
      }
    })
    
    return {
      success: true,
      message: '任务已提交，等待老师确认',
      taskId
    }
    
  } catch (err) {
    console.error('submitTask error:', err)
    return { success: false, error: err.message }
  }
}
