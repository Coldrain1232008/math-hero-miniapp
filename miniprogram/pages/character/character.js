// pages/character/character.js
const { calcLevel, calcAttributes, getTalentById, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

const ATTR_COLORS = ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444']

Page({
  data: {
    student: null,
    levelInfo: {},
    attrs: [],
    maxAttrVal: 100,
    attrDetail: [],
    growthDetail: [],
    expLogs: [],
    avatarInfo: {},
    attrNames: ATTR_NAMES,
    // 每日任务
    dailyTask: null,
    taskLoading: false,
    // 徽章
    badges: [],
    badgesLoading: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateRole()
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    let student = app.globalData.studentInfo
    if (!student) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }

    // 从数据库刷新最新数据
    try {
      const res = await db.collection('students').doc(student._id).get()
      student = res.data
      app.globalData.studentInfo = student
    } catch (e) { console.error(e) }

    const levelInfo = calcLevel(student.totalExp)
    const attrs = calcAttributes(student.talentId, levelInfo.level)
    const maxAttrVal = Math.max(...attrs, 50)

    const attrDetail = ATTR_NAMES.map((name, i) => ({
      name,
      val: attrs[i],
      color: ATTR_COLORS[i],
      percent: Math.min(Math.round(attrs[i] / maxAttrVal * 100), 100),
    }))

    const talent = getTalentById(student.talentId)
    const growthDetail = talent ? ATTR_NAMES.map((name, i) => ({
      name,
      val: talent.growth[i],
      color: ATTR_COLORS[i],
    })) : []

    // 获取头像信息
    const avatarInfo = AvatarManager.getAvatarById(student.avatar) || AvatarManager.getRandomAvatar()

    // 加载最近10条经验记录
    let expLogs = []
    try {
      const logRes = await db.collection('expLogs')
        .where({ studentId: student._id })
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
      expLogs = logRes.data.map(log => ({
        ...log,
        typeLabel: log.type === 'score' ? '📝考试' : '⚡课堂',
        timeStr: this._formatTime(log.createdAt),
      }))
    } catch (e) { console.error(e) }

    this.setData({ student, levelInfo, attrs, maxAttrVal, attrDetail, growthDetail, expLogs, avatarInfo })
    
    // 加载每日任务
    this.loadDailyTask(student._id)
    // 加载徽章
    this.loadBadges(student._id)
  },

  // 加载每日任务
  async loadDailyTask(studentId) {
    this.setData({ taskLoading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'assignDailyTask',
        data: { studentId }
      })
      if (res.result && res.result.success) {
        this.setData({ dailyTask: res.result.task })
      }
    } catch (e) {
      console.error('加载任务失败:', e)
    } finally {
      this.setData({ taskLoading: false })
    }
  },

  // 刷新任务
  async refreshTask() {
    const { dailyTask, student } = this.data
    if (!dailyTask || !student) return
    
    const refreshCount = (dailyTask.refreshCount || 0) + 1
    if (refreshCount > 3) {
      wx.showToast({ title: '今日刷新次数已用完', icon: 'none' })
      return
    }
    
    this.setData({ taskLoading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'assignDailyTask',
        data: { studentId: student._id, refreshCount }
      })
      if (res.result && res.result.success) {
        this.setData({ dailyTask: res.result.task })
        wx.showToast({ title: '已刷新任务', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.error || '刷新失败', icon: 'none' })
      }
    } catch (e) {
      console.error('刷新任务失败:', e)
      wx.showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      this.setData({ taskLoading: false })
    }
  },

  // 提交任务完成
  async submitTask() {
    const { dailyTask, student } = this.data
    if (!dailyTask || !student) return
    if (dailyTask.status !== 'pending') {
      wx.showToast({ title: '任务已提交或已完成', icon: 'none' })
      return
    }
    
    wx.showModal({
      title: '提交任务',
      content: '提交后老师会收到确认通知，确定已完成任务吗？',
      success: async (res) => {
        if (!res.confirm) return
        
        try {
          await db.collection('dailyTasks').doc(dailyTask.id).update({
            data: {
              status: 'submitted',
              submitTime: new Date()
            }
          })
          
          // 更新本地状态
          this.setData({
            'dailyTask.status': 'submitted'
          })
          
          wx.showToast({ title: '已提交，等待老师确认', icon: 'success' })
        } catch (e) {
          console.error('提交任务失败:', e)
          wx.showToast({ title: '提交失败', icon: 'none' })
        }
      }
    })
  },

  // 加载徽章
  async loadBadges(studentId) {
    this.setData({ badgesLoading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'checkBadges',
        data: { studentId }
      })
      if (res.result && res.result.success) {
        this.setData({ badges: res.result.badges || [] })
      }
    } catch (e) {
      console.error('加载徽章失败:', e)
    } finally {
      this.setData({ badgesLoading: false })
    }
  },

  async onReroll() {
    const { student } = this.data
    if (!student.rerollChances || student.rerollChances <= 0) return

    wx.showModal({
      title: '重置天赋',
      content: `你有 ${student.rerollChances} 次机会，确定要重新随机天赋吗？\n注意：这会重新计算所有属性！`,
      success: async (res) => {
        if (!res.confirm) return
        wx.navigateTo({ url: '/pages/create-character/create-character?reroll=1' })
      },
    })
  },

  _formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },
})
