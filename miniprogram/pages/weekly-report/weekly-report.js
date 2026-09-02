// pages/weekly-report/weekly-report.js
Page({
  data: {
    loading: true,
    weekStart: '',
    weekEnd: '',
    expGained: 0,
    tasksCompleted: 0,
    activeDays: 0,
    rankChange: 0,
    dailyExp: [],
    currentLevel: 0,
    totalExp: 0,
    dayLabels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    maxDailyExp: 1,
  },

  onLoad() {
    this.loadReport()
  },

  async loadReport() {
    this.setData({ loading: true })
    try {
      const app = getApp()
      const studentId = app.globalData.studentInfo?._id
      if (!studentId) return

      const res = await wx.cloud.callFunction({
        name: 'getWeeklyReport',
        data: { studentId }
      })

      if (res.result && res.result.success) {
        const report = res.result.report
        const maxDailyExp = Math.max(...report.dailyExp, 1)

        this.setData({
          weekStart: report.weekStart,
          weekEnd: report.weekEnd,
          expGained: report.expGained,
          tasksCompleted: report.tasksCompleted,
          activeDays: report.activeDays,
          rankChange: report.rankChange,
          dailyExp: report.dailyExp,
          currentLevel: report.currentLevel,
          totalExp: report.totalExp,
          maxDailyExp
        })
      }
    } catch (e) {
      console.error('加载周报失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
