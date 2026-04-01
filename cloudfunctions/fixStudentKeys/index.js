// cloudfunctions/fixStudentKeys/index.js
// 为没有个人密钥的旧学生补发 studentKey
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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
    // 查找所有没有 studentKey 或 studentKey 为空的学生
    const res = await db.collection('students')
      .where({
        classId: classId,
        $or: [
          { studentKey: '' },
          { studentKey: _.exists(false) }
        ]
      })
      .get()

    const noKeyStudents = res.data
    if (noKeyStudents.length === 0) {
      return { success: true, count: 0, message: '所有学生都有密钥' }
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
        console.log(`[fixStudentKeys] 为 ${student._id} 补发密钥: ${newKey}`)
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
