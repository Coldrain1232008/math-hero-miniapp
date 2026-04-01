// pages/teacher-score/teacher-score.js
const { calcLevel } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

Page({
  data: {
    allStudents: [],
    filteredList: [],
    keyword: '',
    selected: [],        // 已选学生id数组
    selectedMap: {},     // {id: true} 快速查找
    loadingMap: {},      // 单个按钮loading
    submitting: false,
  },

  onLoad() {
    this.loadStudents()
  },

  async loadStudents() {
    const app = getApp()
    try {
      const res = await db.collection('students')
        .where({ classId: app.globalData.classId })
        .orderBy('heroName', 'asc')
        .get()
      const students = res.data.map(s => {
        const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
        return {
          ...s,
          level: calcLevel(s.totalExp).level,
          avatarColor: avatarInfo.color,
          avatarIcon: avatarInfo.icon,
        }
      })
      this.setData({ allStudents: students, filteredList: students })
    } catch (e) { console.error(e) }
  },

  onSearch(e) {
    const kw = e.detail.value.trim()
    const filtered = kw
      ? this.data.allStudents.filter(s => s.heroName.includes(kw))
      : this.data.allStudents
    this.setData({ keyword: kw, filteredList: filtered })
  },

  toggleSelect(e) {
    const id = e.currentTarget.dataset.id
    const { selectedMap, selected } = this.data
    const newMap = { ...selectedMap }
    let newSelected = [...selected]
    if (newMap[id]) {
      delete newMap[id]
      newSelected = newSelected.filter(s => s !== id)
    } else {
      newMap[id] = true
      newSelected.push(id)
    }
    this.setData({ selectedMap: newMap, selected: newSelected })
  },

  clearSelect() {
    this.setData({ selected: [], selectedMap: {} })
  },

  // 单个 +1
  async addSingle(e) {
    const { id, name } = e.currentTarget.dataset
    const loadingMap = { ...this.data.loadingMap, [id]: true }
    this.setData({ loadingMap })
    await this._addExp([id], `课堂加分 · ${name}`)
    const newMap = { ...this.data.loadingMap }
    delete newMap[id]
    this.setData({ loadingMap: newMap })
    wx.showToast({ title: `+1 EXP · ${name}`, icon: 'success' })
    this.loadStudents()
  },

  // 批量 +1
  async batchAddExp() {
    if (this.data.submitting || this.data.selected.length === 0) return
    this.setData({ submitting: true })
    const names = this.data.selected
      .map(id => this.data.allStudents.find(s => s._id === id)?.heroName)
      .filter(Boolean)
      .join('、')
    await this._addExp(this.data.selected, `课堂批量加分 · ${names.substring(0, 20)}`)
    this.setData({ submitting: false, selected: [], selectedMap: {} })
    wx.showToast({ title: `已为 ${this.data.selected.length} 人 +1 EXP`, icon: 'success' })
    this.loadStudents()
  },

  async _addExp(studentIds, desc) {
    const app = getApp()
    try {
      await wx.cloud.callFunction({
        name: 'addExp',
        data: {
          studentIds,
          exp: 1,
          type: 'class',
          desc,
          classId: app.globalData.classId,
        },
      })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },
})
