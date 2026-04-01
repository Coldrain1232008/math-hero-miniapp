// 云函数：confirmTask
// 教师确认任务完成，发放奖励

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { taskId, teacherId, action = 'confirm' } = event
  
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
    
    if (task.status !== 'submitted') {
      return { success: false, error: '任务状态不正确，无法确认' }
    }
    
    // 如果拒绝
    if (action === 'reject') {
      await db.collection('dailyTasks').doc(taskId).update({
        data: {
          status: 'rejected',
          confirmTime: new Date(),
          teacherId: teacherId || null
        }
      })
      
      return {
        success: true,
        message: '任务已驳回',
        taskId
      }
    }
    
    // 确认任务
    const now = new Date()
    
    // 更新任务状态
    await db.collection('dailyTasks').doc(taskId).update({
      data: {
        status: 'confirmed',
        confirmTime: now,
        teacherId: teacherId || null
      }
    })
    
    // 给学生增加经验值
    const studentRes = await db.collection('students').doc(task.studentId).get()
    const student = studentRes.data
    
    if (student) {
      const newTotalExp = (student.totalExp || 0) + task.expReward
      
      await db.collection('students').doc(task.studentId).update({
        data: {
          totalExp: newTotalExp,
          lastTaskCompleteTime: now
        }
      })
      
      // 记录经验日志
      await db.collection('expLogs').add({
        data: {
          studentId: task.studentId,
          classId: student.classId,
          type: 'task',
          amount: task.expReward,
          description: `完成任务：${task.title}`,
          taskId: taskId,
          createdAt: now,
          undone: false
        }
      })
      
      // 更新任务完成记录（用于徽章计算）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      await db.collection('taskCompletions').add({
        data: {
          studentId: task.studentId,
          taskId: taskId,
          date: today,
          expReward: task.expReward,
          isPreference: task.isPreference,
          category: task.category,
          createTime: now
        }
      })
      
      // 触发徽章检查
      await cloud.callFunction({
        name: 'checkBadges',
        data: { studentId: task.studentId }
      })
    }
    
    return {
      success: true,
      message: '任务已确认',
      taskId,
      expReward: task.expReward
    }
    
  } catch (err) {
    console.error('confirmTask error:', err)
    return { success: false, error: err.message }
  }
}
