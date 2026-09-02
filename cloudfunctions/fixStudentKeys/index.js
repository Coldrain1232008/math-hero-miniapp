// cloudfunctions/fixStudentKeys/index.js
// 为没有个人密钥的旧学生补发 studentKey
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 鉴权：verifyTeacher 用 teacherKey 反查 classId（不信任前端传的 classId）
// auth.js 由 tools/sync-auth.js 从 tools/auth-template.js 同步，勿直接修改
const { verifyTeacher } = require('./auth')

function genKey(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let key = ''
  for (let i = 0; i < len; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

exports.main = async (event) => {
  // ===== 鉴权第一道：教师密钥 =====
  // 本函数会重写学生登录密钥，必须确认调用者是该班教师
  const auth = await verifyTeacher(event.teacherKey)
  if (!auth.ok) return { success: false, message: auth.error }
  const classId = auth.classId

  try {
    // 先查出该班级所有学生，再在代码中筛选没有密钥的
    // 避免云数据库 $or + exists 复合查询的兼容性问题
    const res = await db.collection('students')
      .where({ classId: classId })
      .get()

    const allStudents = res.data
    const noKeyStudents = allStudents.filter(
      s => !s.studentKey || s.studentKey === '' || s.studentKey === undefined || s.studentKey === null
    )

    if (noKeyStudents.length === 0) {
      return { success: true, count: 0, total: allStudents.length, message: '所有学生都有密钥' }
    }

    let successCount = 0
    for (const student of noKeyStudents) {
      try {
        const newKey = genKey(6)
        await db.collection('students').doc(student._id).update({
          data: {
            studentKey: newKey,
            updatedAt: db.serverDate()
          }
        })
        successCount++
        console.log(`[fixStudentKeys] 为 ${student.heroName || student._id} 补发密钥: ${newKey}`)
      } catch (e) {
        console.error(`[fixStudentKeys] 更新失败 ${student._id}:`, e)
      }
    }

    return {
      success: true,
      count: successCount,
      total: noKeyStudents.length,
      message: `成功为 ${successCount}/${noKeyStudents.length} 名学生补发密钥`
    }
  } catch (e) {
    console.error('[fixStudentKeys] 查询失败:', e)
    return { success: false, message: e.message }
  }
}
