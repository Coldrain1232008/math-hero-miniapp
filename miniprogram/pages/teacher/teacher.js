// pages/teacher/teacher.js
const { calcLevel } = require('../../utils/gameData')

Page({
  data: {
    className: '',
    stats: { total: 0, avgLevel: 0, maxLevel: 0 },
    recentLogs: [],
    showLogDetail: false,
    selectedLog: null,
  },

  onShow() {
    const app = getApp()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateRole()
    }
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
      const res = await wx.cloud.callFunction({
        name: 'getClassData',
        data: { classId: app.globalData.classId, action: 'stats' }
      })
      
      if (res.result && res.result.success) {
        const students = res.result.students
        if (students.length === 0) {
          this.setData({ stats: { total: 0, avgLevel: 0, maxLevel: 0 } })
          return
        }
        const levels = students.map(s => calcLevel(s.totalExp).level)
        const avgLevel = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
        const maxLevel = Math.max(...levels)
        this.setData({ stats: { total: students.length, avgLevel, maxLevel } })
      }
    } catch (e) { console.error(e) }
  },

  async loadLogs() {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'getClassData',
        data: { classId: app.globalData.classId, action: 'logs' }
      })
      
      if (res.result && res.result.success) {
        const logs = res.result.logs.map(l => {
          const typeMap = {
            'score': '📝成绩',
            'class': '⚡课堂',
            'task': '✅任务',
            'import': '📥导入'
          }
          return {
            ...l,
            typeLabel: typeMap[l.type] || '⚡其他',
            timeStr: this._fmt(l.createdAt || l.createTime),
            canUndo: ['score', 'class', 'task'].includes(l.type) && !l.undone
          }
        })
        this.setData({ recentLogs: logs })
      }
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

  // 显示操作详情
  showLogDetail(e) {
    const { index } = e.currentTarget.dataset
    const log = this.data.recentLogs[index]
    this.setData({
      showLogDetail: true,
      selectedLog: log
    })
  },

  // 隐藏操作详情
  hideLogDetail() {
    this.setData({
      showLogDetail: false,
      selectedLog: null
    })
  },

  // 阻止冒泡
  preventBubble() {
    // 什么都不做，只是阻止事件冒泡
  },

  // 撤回选中的操作
  async undoSelectedLog() {
    const log = this.data.selectedLog
    if (!log || !log.canUndo) return

    const typeText = log.type === 'task' ? '任务确认' : '经验发放'

    wx.showModal({
      title: '撤回确认',
      content: `确定撤回这条${typeText}记录吗？学生的经验值将被扣除。`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '撤回中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'undoExp',
            data: { logId: log._id }
          })
          wx.hideLoading()

          if (result.result && result.result.success) {
            wx.showToast({ title: '已撤回', icon: 'success' })
            this.hideLogDetail()
            this.loadLogs()
          } else {
            wx.showToast({ title: result.result?.error || '撤回失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          console.error('撤回失败:', e)
          wx.showToast({ title: '撤回失败', icon: 'none' })
        }
      }
    })
  },
})
