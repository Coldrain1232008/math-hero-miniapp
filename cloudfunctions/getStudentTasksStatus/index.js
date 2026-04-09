// 云函数：获取全班学生的任务状态
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 获取今天的时间戳范围
function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = start + 24 * 60 * 60 * 1000 - 1
  return { start, end }
}

// 获取状态显示文本
function getStatusText(status) {
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
    const { start, end } = getTodayRange()

    console.log('查询条件 - classId:', classId, 'date范围:', start, '-', end)

    // 获取班级学生
    const studentsRes = await db.collection('students')
      .where({ classId })
      .field({ _id: true, name: true, heroName: true, studentId: true })
      .orderBy('name', 'asc')
      .get()

    const students = studentsRes.data || []
    console.log('学生数量:', students.length)

    // 获取今日任务记录 (使用正确的集合名 dailyTasks)
    const tasksRes = await db.collection('dailyTasks')
      .where({
        classId,
        date: db.command.gte(start).and(db.command.lte(end))
      })
      .get()

    console.log('任务记录:', tasksRes.data)
    const tasksMap = {}
    ;(tasksRes.data || []).forEach(task => {
      tasksMap[task.studentId] = task
    })

    // 组合学生数据
    const result = students.map(student => {
      const task = tasksMap[student._id] || {}
      const statusInfo = getStatusText(task.status)

      return {
        studentId: student._id,
        studentName: student.name || student.heroName || '未知',
        studentCode: student.studentId || '',
        taskTitle: task.title || null,
        taskDesc: task.desc || null,
        expReward: task.expReward || 0,
        status: task.status || 'none',
        statusText: statusInfo.text,
        statusClass: statusInfo.class,
        isSpecial: task.isSpecial || false,
        isPreference: task.isPreference || false
      }
    })

    console.log('返回结果数量:', result.length)
    return {
      success: true,
      students: result
    }

  } catch (e) {
    console.error('获取学生任务状态失败:', e)
    return {
      success: false,
      error: e.message || '获取失败'
    }
  }
}
