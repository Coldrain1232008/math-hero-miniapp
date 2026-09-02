// pages/class-analytics/class-analytics.js
const { calcLevel, calcAttributes, ATTR_NAMES } = require('../../utils/gameData')

Page({
  data: {
    loading: true,
    studentCount: 0,
    avgExp: 0,
    taskCompletionRate: 0,
    activeStudents: 0,
    activeRate: 0,
    topStudents: [],
  },

  onLoad() {
    this.loadAnalytics()
  },

  async loadAnalytics() {
    this.setData({ loading: true })
    try {
      const app = getApp()
      const classId = app.globalData.classId
      if (!classId) {
        wx.showToast({ title: '未找到班级信息', icon: 'none' })
        return
      }

      const res = await wx.cloud.callFunction({
        name: 'getClassAnalytics',
        data: { classId }
      })

      if (res.result && res.result.success) {
        const data = res.result.data
        // 为 topStudents 添加等级信息
        const topStudents = (data.topStudents || []).map(s => {
          const levelInfo = calcLevel(s.totalExp)
          return { ...s, level: levelInfo.level }
        })

        this.setData({
          studentCount: data.studentCount,
          avgExp: data.avgExp,
          taskCompletionRate: data.taskCompletionRate,
          activeStudents: data.activeStudents,
          activeRate: data.activeRate,
          topStudents
        })
      }
    } catch (e) {
      console.error('加载班级数据失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
