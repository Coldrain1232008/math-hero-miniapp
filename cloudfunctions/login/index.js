// 云函数：login
// 处理教师和学生登录

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, teacherKey, classKey, studentKey, openid } = event
  
  try {
    // 教师登录
    if (action === 'teacherLogin') {
      if (!teacherKey) {
        return { success: false, error: '请输入教师密钥' }
      }
      
      const res = await db.collection('classes').where({ teacherKey }).get()
      if (res.data.length === 0) {
        return { success: false, error: '教师密钥不正确' }
      }
      
      return {
        success: true,
        classInfo: res.data[0],
        role: 'teacher'
      }
    }
    
    // 学生登录
    if (action === 'studentLogin') {
      if (!classKey) {
        return { success: false, error: '请输入班级密钥' }
      }
      if (!studentKey) {
        return { success: false, error: '请输入个人密钥' }
      }
      
      // 1. 先用班级密钥找到班级
      const classRes = await db.collection('classes').where({ studentKey: classKey }).get()
      if (classRes.data.length === 0) {
        return { success: false, error: '班级密钥不正确' }
      }
      
      const classInfo = classRes.data[0]
      
      // 2. 用个人密钥查找学生
      const studentRes = await db.collection('students').where({
        classId: classInfo._id,
        studentKey,
      }).get()
      
      if (studentRes.data.length === 0) {
        return { success: false, error: '个人密钥不正确' }
      }
      
      let student = studentRes.data[0]
      
      // 3. 绑定openid（首次登录）
      if (!student.openid && openid) {
        await db.collection('students').doc(student._id).update({
          data: { openid }
        })
        student.openid = openid
      }
      
      return {
        success: true,
        classInfo,
        student,
        role: 'student'
      }
    }
    
    // 获取openid
    if (action === 'getOpenId') {
      const wxContext = cloud.getWXContext()
      return {
        success: true,
        openid: wxContext.OPENID
      }
    }
    
    return { success: false, error: '未知的操作类型' }
    
  } catch (err) {
    console.error('login error:', err)
    return { success: false, error: err.message }
  }
}
