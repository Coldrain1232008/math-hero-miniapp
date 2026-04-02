// 云函数：获取全班学生的任务状态
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 获取今天的时间范围
function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  return {
    startTime: start.getTime(),
    endTime: end.getTime()
  }
}

// 获取状态显示文本
function getStatusText(status, task) {
  switch (status) {
    case 'completed':
      return { text: '已完成', class: 'completed' }
    case 'submitted':
      return { text: '待确认', class: 'pending' }
    case 'pending':
      return { text: '进行中', class: 'active' }
    default:
      return { text: '未开始', class: 'none' }
  }
}

exports.main = async (event, context) => {
  try {
    const { classId } = event
    const { startTime, endTime } = getTodayRange()

    // 获取班级学生
    const studentsRes = await db.collection('students')
      .where({ classId })
      .field({ _id: true, name: true, studentId: true })
      .orderBy('name', 'asc')
      .get()

    const students = studentsRes.data || []

    // 获取今日任务记录
    const tasksRes = await db.collection('studentTasks')
      .where({
        date: db.command.gte(startTime).and(db.command.lte(endTime))
      })
      .get()

    const tasksMap = {}
    ;(tasksRes.data || []).forEach(task => {
      tasksMap[task.studentId || task._openid] = task
    })

    // 获取特殊任务
    const specialRes = await db.collection('specialTasks')
      .where({ isActive: true })
      .limit(1)
      .get()
    const specialTask = specialRes.data?.[0] || null

    // 组合学生数据
    const result = students.map(student => {
      const task = tasksMap[student._id] || tasksMap[student.studentId] || {}
      const status = getStatusText(task.status, task)

      // 判断任务类型
      let taskType = 'none'
      if (task.status === 'completed' || task.status === 'submitted' || task.status === 'pending') {
        if (task.isSpecial) {
          taskType = 'special'
        } else {
          taskType = task.taskId ? 'custom' : 'builtin'
        }
      }

      return {
        studentId: student._id,
        studentName: student.name,
        studentCode: student.studentId,
        taskTitle: task.title || null,
        taskDesc: task.desc || null,
        expReward: task.expReward || 0,
        status: task.status || 'none',
        statusText: status.text,
        statusClass: status.class,
        taskType: taskType,
        isSpecial: task.isSpecial || false,
        isPreference: task.isPreference || false,
        submitTime: task.submitTime || null,
        completedTime: task.completedTime || null
      }
    })

    return {
      success: true,
      students: result,
      specialTask: specialTask ? {
        title: specialTask.title,
        desc: specialTask.desc
      } : null
    }

  } catch (e) {
    console.error('获取学生任务状态失败:', e)
    return {
      success: false,
      error: e.message || '获取失败'
    }
  }
}
