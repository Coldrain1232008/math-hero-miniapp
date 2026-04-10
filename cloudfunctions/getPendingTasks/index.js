// 云函数：getPendingTasks
// 获取班级中所有待确认的任务

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { classId } = event
  
  if (!classId) {
    return { success: false, error: '缺少classId' }
  }
  
  try {
    // 获取班级所有学生
    const studentRes = await db.collection('students')
      .where({ classId })
      .get()
    
    const studentIds = studentRes.data.map(s => s._id)
    const studentMap = {}
    studentRes.data.forEach(s => {
      studentMap[s._id] = s
    })
    
    if (studentIds.length === 0) {
      return { success: true, pendingTasks: [], count: 0 }
    }
    
    // 查询待确认任务
    const taskRes = await db.collection('dailyTasks')
      .where({
        studentId: db.command.in(studentIds),
        status: 'submitted'
      })
      .orderBy('submitTime', 'asc')
      .get()
    
    const pendingTasks = taskRes.data.map(task => {
      const student = studentMap[task.studentId] || {}
      return {
        ...task,
        studentName: student.realName || student.heroName || '未知',
        studentNo: student.studentId || '',  // 修复：改用 studentNo 存学号，避免覆盖任务里的 studentId（数据库_id）
        submitTimeStr: formatTime(task.submitTime)
      }
    })
    
    return {
      success: true,
      pendingTasks,
      count: pendingTasks.length
    }
    
  } catch (err) {
    console.error('getPendingTasks error:', err)
    return { success: false, error: err.message }
  }
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
