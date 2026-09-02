// 云函数：getWeeklyReport
// 获取学习周报

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 获取本周一的日期
function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// 格式化日期为 YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

exports.main = async (event, context) => {
  const { studentId, weekStart: inputWeekStart } = event

  if (!studentId) {
    return { success: false, error: '缺少studentId' }
  }

  try {
    // 获取学生信息
    const studentRes = await db.collection('students').doc(studentId).get()
    const student = studentRes.data
    if (!student) {
      return { success: false, error: '学生不存在' }
    }

    // 计算本周起止日期
    const weekStart = inputWeekStart ? new Date(inputWeekStart) : getWeekStart()
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = formatDate(weekStart)
    const weekEndStr = formatDate(weekEnd)

    // 1. 统计本周 EXP
    let expGained = 0
    let dailyExp = [0, 0, 0, 0, 0, 0, 0] // 周一到周日
    try {
      const expRes = await db.collection('expLogs')
        .where({
          studentId,
          createdAt: _.gte(weekStart).and(_.lte(weekEnd))
        })
        .get()

      expRes.data.forEach(log => {
        const amount = log.amount || log.exp || 0
        expGained += amount
        // 计算是周几
        const logDate = new Date(log.createdAt)
        const dayIndex = (logDate.getDay() + 6) % 7 // 周一=0, 周日=6
        dailyExp[dayIndex] += amount
      })
    } catch (e) {
      console.warn('expLogs query error:', e.message)
    }

    // 2. 统计本周完成任务数
    let tasksCompleted = 0
    try {
      const taskRes = await db.collection('taskCompletions')
        .where({
          studentId,
          date: _.gte(weekStart).and(_.lte(weekEnd))
        })
        .count()
      tasksCompleted = taskRes.total
    } catch (e) {
      console.warn('taskCompletions query error:', e.message)
    }

    // 3. 统计活跃天数
    const activeDays = dailyExp.filter(exp => exp > 0).length

    // 4. 计算排名变化
    let rankChange = 0
    try {
      // 获取本周初的排名（通过 weeklyStats 集合）
      const lastWeekStart = new Date(weekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      const lastWeekStats = await db.collection('weeklyStats')
        .where({
          studentId,
          weekStart: formatDate(lastWeekStart)
        })
        .limit(1)
        .get()

      if (lastWeekStats.data.length > 0) {
        const lastRank = lastWeekStats.data[0].rank || 0
        const currentRank = student.rank || 0
        if (lastRank > 0 && currentRank > 0) {
          rankChange = lastRank - currentRank // 正数表示上升
        }
      }
    } catch (e) {
      console.warn('weeklyStats query error:', e.message)
    }

    // 5. 简单计算等级（不依赖前端模块）
    const totalExp = student.totalExp || 0
    let currentLevel = 1
    let expForLevel = 100
    while (totalExp >= expForLevel && currentLevel < 100) {
      currentLevel++
      expForLevel += Math.floor(100 * (1 + (currentLevel - 1) * 0.2))
    }

    return {
      success: true,
      report: {
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        expGained,
        tasksCompleted,
        activeDays,
        rankChange,
        dailyExp,
        currentLevel,
        totalExp
      }
    }

  } catch (err) {
    console.error('getWeeklyReport error:', err)
    return { success: false, error: err.message }
  }
}
