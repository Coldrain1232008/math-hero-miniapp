// 云函数：getClassAnalytics
// 获取班级数据分析

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { classId } = event

  if (!classId) {
    return { success: false, error: '缺少classId' }
  }

  try {
    // 获取班级所有学生
    const studentsRes = await db.collection('students')
      .where({ classId })
      .field({ _id: true, heroName: true, totalExp: true, talentId: true, lastLoginDate: true })
      .get()

    const students = studentsRes.data
    const studentCount = students.length

    if (studentCount === 0) {
      return {
        success: true,
        data: {
          studentCount: 0,
          avgExp: 0,
          taskCompletionRate: 0,
          activeStudents: 0,
          topStudents: []
        }
      }
    }

    // 计算平均 EXP
    const totalExp = students.reduce((sum, s) => sum + (s.totalExp || 0), 0)
    const avgExp = Math.round(totalExp / studentCount)

    // 统计今日活跃学生数
    const today = new Date().toISOString().slice(0, 10)
    const activeStudents = students.filter(s => s.lastLoginDate === today).length

    // 统计今日任务完成率
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    let taskCompletionRate = 0
    try {
      const taskRes = await db.collection('taskCompletions')
        .where({
          classId,
          date: _.gte(todayStart).and(_.lte(todayEnd))
        })
        .count()

      // 每个学生每天最多1个任务，完成率 = 完成数 / 学生数
      taskCompletionRate = studentCount > 0
        ? Math.min(Math.round((taskRes.total / studentCount) * 100), 100)
        : 0
    } catch (e) {
      console.warn('taskCompletions query error:', e.message)
    }

    // 获取排行榜 Top 10
    const topStudents = students
      .sort((a, b) => (b.totalExp || 0) - (a.totalExp || 0))
      .slice(0, 10)
      .map((s, i) => ({
        rank: i + 1,
        studentId: s._id,
        heroName: s.heroName,
        totalExp: s.totalExp || 0,
        talentId: s.talentId
      }))

    return {
      success: true,
      data: {
        studentCount,
        avgExp,
        taskCompletionRate,
        activeStudents,
        activeRate: studentCount > 0 ? Math.round((activeStudents / studentCount) * 100) : 0,
        topStudents
      }
    }

  } catch (err) {
    console.error('getClassAnalytics error:', err)
    return { success: false, error: err.message }
  }
}
