// cloudfunctions/fixStudentKeys/index.js
// 为没有个人密钥的旧学生补发 studentKey
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function genKey(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let key = ''
  for (let i = 0; i < len; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

exports.main = async (event) => {
  const { classId } = event
  if (!classId) return { success: false, message: '缺少 classId' }

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
