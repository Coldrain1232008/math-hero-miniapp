// 云函数：getClassData
// 获取班级相关数据（学生列表、统计信息、日志等）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { classId, action } = event
  
  if (!classId) {
    return { success: false, error: '缺少classId' }
  }
  
  try {
    // 获取班级信息
    if (action === 'classInfo') {
      const classRes = await db.collection('classes').doc(classId).get()
      return {
        success: true,
        classInfo: classRes.data
      }
    }
    
    // 获取学生列表
    if (action === 'students') {
      const studentRes = await db.collection('students')
        .where({ classId })
        .orderBy('totalExp', 'desc')
        .get()
      return {
        success: true,
        students: studentRes.data
      }
    }
    
    // 获取学生列表（按角色名排序，用于打分页面）
    if (action === 'studentsByName') {
      const studentRes = await db.collection('students')
        .where({ classId })
        .orderBy('heroName', 'asc')
        .get()
      return {
        success: true,
        students: studentRes.data
      }
    }
    
    // 获取统计信息
    if (action === 'stats') {
      const studentRes = await db.collection('students')
        .where({ classId })
        .get()
      return {
        success: true,
        students: studentRes.data
      }
    }
    
    // 获取经验日志
    if (action === 'logs') {
      const logRes = await db.collection('expLogs')
        .where({ classId })
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()
      
      // 获取班级所有学生信息用于匹配姓名
      const studentRes = await db.collection('students')
        .where({ classId })
        .get()
      
      const studentMap = {}
      studentRes.data.forEach(s => {
        studentMap[s._id] = s.realName || s.heroName || '未知'
      })
      
      // 补充学生姓名
      const logs = logRes.data.map(l => ({
        ...l,
        studentName: studentMap[l.studentId] || '未知'
      }))
      
      return {
        success: true,
        logs: logs
      }
    }
    
    // 获取排行榜数据
    if (action === 'ranking') {
      const studentRes = await db.collection('students')
        .where({ classId })
        .orderBy('totalExp', 'desc')
        .limit(50)
        .get()
      return {
        success: true,
        students: studentRes.data
      }
    }
    
    return { success: false, error: '未知的操作类型' }
    
  } catch (err) {
    console.error('getClassData error:', err)
    return { success: false, error: err.message }
  }
}
