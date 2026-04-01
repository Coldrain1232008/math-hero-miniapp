// 云函数：getStudentData
// 获取学生最新数据（绕过前端权限限制）

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
    
    return {
      success: true,
      student
    }
    
  } catch (err) {
    console.error('getStudentData error:', err)
    return { success: false, error: err.message }
  }
}
