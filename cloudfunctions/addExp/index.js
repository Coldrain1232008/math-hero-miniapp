// cloudfunctions/addExp/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { studentIds, batchList, exp, type, desc, classId } = event

  // 统一处理两种输入：
  //   studentIds + exp（相同经验）
  //   batchList: [{studentId, exp}, ...] （各自不同经验）
  let tasks = []
  if (batchList && batchList.length > 0) {
    tasks = batchList
  } else if (studentIds && studentIds.length > 0) {
    tasks = studentIds.map(id => ({ studentId: id, exp: exp || 1 }))
  }

  if (tasks.length === 0) return { success: false, message: 'no targets' }

  try {
    const promises = tasks.map(async ({ studentId, exp: expVal }) => {
      // 1. 更新学生经验值
      await db.collection('students').doc(studentId).update({
        data: {
          totalExp: _.inc(expVal),
          updatedAt: db.serverDate(),
        },
      })

      // 2. 写入经验日志
      await db.collection('expLogs').add({
        data: {
          studentId,
          classId,
          exp: expVal,
          type: type || 'class',
          desc: desc || '',
          createdAt: db.serverDate(),
        },
      })
    })

    await Promise.all(promises)
    return { success: true, count: tasks.length }
  } catch (e) {
    console.error(e)
    return { success: false, message: e.message }
  }
}
