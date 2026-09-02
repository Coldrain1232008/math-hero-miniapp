// 云函数：login
// 处理教师和学生登录

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 统一归一化：去空格 + 转大写
// ⚠️ 必须与 updateClassKeys 写入时的规则保持一致！
// updateClassKeys 保存时会 .trim().toUpperCase()，如果登录时不归一化，
// 老师输入小写就会查不到数据库里的大写值，表现为"密钥改完就登不进去了"
function normalizeKey(raw) {
  return (raw || '').trim().toUpperCase()
}

// 兼容查询：先按原值查，查不到再按归一化后的值查
// 这样既支持老师自定义密钥的大小写混输，也不影响历史数据里的小写密钥
async function findByKey(field, rawKey) {
  const raw = (rawKey || '').trim()
  const upper = normalizeKey(rawKey)

  if (raw) {
    const res = await db.collection('classes').where({ [field]: raw }).limit(1).get()
    if (res.data.length > 0) return res.data[0]
  }

  if (upper && upper !== raw) {
    const res = await db.collection('classes').where({ [field]: upper }).limit(1).get()
    if (res.data.length > 0) return res.data[0]
  }

  return null
}

exports.main = async (event, context) => {
  const { action, teacherKey, classKey, studentKey, openid } = event

  try {
    // 教师登录
    if (action === 'teacherLogin') {
      if (!teacherKey || !teacherKey.trim()) {
        return { success: false, error: '请输入教师密钥' }
      }

      const cls = await findByKey('teacherKey', teacherKey)
      if (!cls) {
        return { success: false, error: '教师密钥不正确' }
      }

      return {
        success: true,
        classInfo: cls,
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
      
      // 1. 先用班级密钥找到班级（同样做大小写归一化）
      const classInfo = await findByKey('studentKey', classKey)
      if (!classInfo) {
        return { success: false, error: '班级密钥不正确' }
      }

      // 2. 用个人密钥查找学生（个人密钥一律大写存储，查询时同步归一化）
      const stuKeyUpper = normalizeKey(studentKey)
      let studentRes = await db.collection('students').where({
        classId: classInfo._id,
        studentKey: stuKeyUpper,
      }).get()

      // 兼容：万一历史数据里存在未归一化的小写个人密钥，再按原值查一次
      if (studentRes.data.length === 0 && studentKey && studentKey.trim() !== stuKeyUpper) {
        studentRes = await db.collection('students').where({
          classId: classInfo._id,
          studentKey: studentKey.trim(),
        }).get()
      }

      if (studentRes.data.length === 0) {
        return { success: false, error: '个人密钥不正确' }
      }
      
      if (studentRes.data.length > 1) {
        return { success: false, error: '该口令存在重复，请联系老师处理' }
      }

      let student = studentRes.data[0]
      
      // 3. 绑定openid（首次登录）- 从云函数上下文自动获取
      const wxContext = cloud.getWXContext()
      const userOpenid = wxContext.OPENID
      
      if (!student.openid && userOpenid) {
        await db.collection('students').doc(student._id).update({
          data: { openid: userOpenid }
        })
        student.openid = userOpenid
      }
      
      // 异步触发徽章检查（fire-and-forget）
      try {
        cloud.callFunction({
          name: 'checkBadges',
          data: { studentId: student._id }
        }).catch(err => console.warn('checkBadges async error:', err.message))
      } catch (e) {
        // 忽略同步错误
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
