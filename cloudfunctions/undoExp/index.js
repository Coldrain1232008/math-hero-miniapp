// 云函数：undoExp
// 撤回经验值操作

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { logId } = event
  
  if (!logId) {
    return { success: false, error: '缺少logId' }
  }
  
  try {
    // 获取日志记录
    const logRes = await db.collection('expLogs').doc(logId).get()
    const log = logRes.data
    
    if (!log) {
      return { success: false, error: '记录不存在' }
    }
    
    if (log.undone) {
      return { success: false, error: '该记录已被撤回' }
    }
    
    const now = new Date()
    
    // 标记日志为已撤回
    await db.collection('expLogs').doc(logId).update({
      data: {
        undone: true,
        undoneAt: now
      }
    })
    
    // 扣除学生经验值
    const amount = log.amount || 0
    if (amount > 0 && log.studentId) {
      await db.collection('students').doc(log.studentId).update({
        data: {
          totalExp: _.gte(amount) ? _.inc(-amount) : 0
        }
      })
    }
    
    // 如果是任务类型，还需要更新任务状态
    if (log.type === 'task' && log.taskId) {
      await db.collection('dailyTasks').doc(log.taskId).update({
        data: {
          status: 'pending',
          confirmTime: null,
          undoneAt: now
        }
      })
    }
    
    return {
      success: true,
      message: '已撤回',
      logId,
      amount: amount
    }
    
  } catch (err) {
    console.error('undoExp error:', err)
    return { success: false, error: err.message }
  }
}
