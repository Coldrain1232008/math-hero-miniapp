// 云函数：resetTaskProgress
// 重置学生任务进度，让已完成的学生可以重新做任务

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { classId, studentId } = event

  try {
    // 获取今天的日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let result = { success: true }

    if (studentId) {
      // 重置单个学生
      result = await resetStudentTask(studentId, today, tomorrow)
    } else if (classId) {
      // 重置全班学生
      result = await resetClassTasks(classId, today, tomorrow)
    } else {
      return { success: false, error: '缺少 classId 或 studentId' }
    }

    return result

  } catch (err) {
    console.error('resetTaskProgress error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 重置单个学生的任务进度
 */
async function resetStudentTask(studentId, today, tomorrow) {
  // 查询该学生今天的任务
  const taskRes = await db.collection('dailyTasks')
    .where({
      studentId,
      date: _.gte(today).and(_.lt(tomorrow))
    })
    .get()

  if (taskRes.data.length === 0) {
    return { 
      success: true, 
      message: '该学生今天暂无任务，无需重置',
      resetCount: 0 
    }
  }

  // 删除今天的所有任务（让学生可以重新获取任务）
  const taskIds = taskRes.data.map(t => t._id)
  for (const taskId of taskIds) {
    await db.collection('dailyTasks').doc(taskId).remove()
  }

  return {
    success: true,
    message: `已重置学生任务，学生可重新获取任务`,
    resetCount: taskIds.length
  }
}

/**
 * 重置全班学生的任务进度
 */
async function resetClassTasks(classId, today, tomorrow) {
  // 获取班级所有学生
  const studentsRes = await db.collection('students')
    .where({ classId })
    .field({ _id: true, name: true })
    .get()

  if (studentsRes.data.length === 0) {
    return { success: true, message: '班级暂无学生', resetCount: 0 }
  }

  let totalReset = 0
  const resetStudents = []

  for (const student of studentsRes.data) {
    // 查询该学生今天的任务
    const taskRes = await db.collection('dailyTasks')
      .where({
        studentId: student._id,
        date: _.gte(today).and(_.lt(tomorrow))
      })
      .get()

    if (taskRes.data.length > 0) {
      // 删除任务
      for (const task of taskRes.data) {
        await db.collection('dailyTasks').doc(task._id).remove()
      }
      totalReset++
      resetStudents.push(student.name || student._id)
    }
  }

  return {
    success: true,
    message: `已重置 ${totalReset} 名学生的任务`,
    resetCount: totalReset,
    students: resetStudents
  }
}
