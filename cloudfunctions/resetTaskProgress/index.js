// 云函数：resetTaskProgress
// 重置学生任务进度，让已完成的学生可以重新做任务
//
// ⚠️ 鉴权（2026-09-02 补）：此前只收 event.classId / studentId 且无身份校验，
//    任何人都能清空任意班级学生的任务记录（学生刷的分可以无限重刷）。
//    现在改为凭 teacherKey 由服务端反查 classId，不信任前端传参。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 鉴权：verifyTeacher 用 teacherKey 反查 classId（不信任前端传的 classId）
// auth.js 由 tools/sync-auth.js 从 tools/auth-template.js 同步，勿直接修改
const { verifyTeacher } = require('./auth')

exports.main = async (event, context) => {
  const { studentId } = event

  // ===== 鉴权第一道：教师密钥 =====
  const auth = await verifyTeacher(event.teacherKey)
  if (!auth.ok) return { success: false, error: auth.error }
  const classId = auth.classId

  try {
    // 获取今天的日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let result = { success: true }

    if (studentId) {
      // 重置单个学生：先确认该生确实属于本班，否则能重置别班的人
      const stuRes = await db.collection('students').doc(studentId).get()
      if (!stuRes.data) {
        return { success: false, error: '学生不存在' }
      }
      if (stuRes.data.classId !== classId) {
        return { success: false, error: '只能操作本班学生' }
      }
      result = await resetStudentTask(studentId, today, tomorrow)
    } else {
      // 重置全班学生
      result = await resetClassTasks(classId, today, tomorrow)
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
