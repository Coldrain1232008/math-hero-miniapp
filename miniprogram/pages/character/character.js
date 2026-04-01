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
  },

  onShow() {
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
