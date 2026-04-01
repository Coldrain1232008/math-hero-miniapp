// pages/teacher/teacher.js
const { calcLevel } = require('../../utils/gameData')
const db = wx.cloud.database()

Page({
  data: {
    className: '',
    stats: { total: 0, avgLevel: 0, maxLevel: 0 },
    recentLogs: [],
  },

  onShow() {
    const app = getApp()
    if (!app.globalData.isTeacher) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.setData({ className: app.globalData.className || '我的班级' })
    this.loadStats()
    this.loadLogs()
  },

  async loadStats() {
    const app = getApp()
    try {
      const res = await db.collection('students')
        .where({ classId: app.globalData.classId })
        .get()
      const students = res.data
      if (students.length === 0) {
        this.setData({ stats: { total: 0, avgLevel: 0, maxLevel: 0 } })
        return
      }
      const levels = students.map(s => calcLevel(s.totalExp).level)
      const avgLevel = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
      const maxLevel = Math.max(...levels)
      this.setData({ stats: { total: students.length, avgLevel, maxLevel } })
    } catch (e) { console.error(e) }
  },

  async loadLogs() {
    const app = getApp()
    try {
      const res = await db.collection('expLogs')
        .where({ classId: app.globalData.classId })
        .orderBy('createdAt', 'desc')
        .limit(8)
        .get()
      const logs = res.data.map(l => ({
        ...l,
        typeLabel: l.type === 'score' ? '📝成绩' : '⚡课堂',
        timeStr: this._fmt(l.createdAt),
      }))
      this.setData({ recentLogs: logs })
    } catch (e) { console.error(e) }
  },

  goScore() { wx.navigateTo({ url: '/pages/teacher-score/teacher-score' }) },
  goUpload() { wx.navigateTo({ url: '/pages/teacher-upload/teacher-upload' }) },
  goClass() { wx.navigateTo({ url: '/pages/teacher-class/teacher-class' }) },

  _fmt(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },
})
