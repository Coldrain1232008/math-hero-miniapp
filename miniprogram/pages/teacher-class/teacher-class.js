// pages/teacher-class/teacher-class.js
const { calcLevel, calcAttributes, getTalentById, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

const ATTR_COLORS = ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444']

Page({
  data: {
    students: [],
    showAdd: false,
    nameInput: '',
    addLoading: false,
  },

  onLoad() { this.loadStudents() },
  onShow() { this.loadStudents() },

  async loadStudents() {
    const app = getApp()
    try {
      const res = await db.collection('students')
        .where({ classId: app.globalData.classId })
        .orderBy('totalExp', 'desc')
        .get()

      const students = res.data.map(s => {
        const levelInfo = calcLevel(s.totalExp)
        const attrs = calcAttributes(s.talentId, levelInfo.level)
        const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
        const attrDisplay = ATTR_NAMES.map((name, i) => ({
          name, val: attrs[i], color: ATTR_COLORS[i],
        }))
        return { ...s, level: levelInfo.level, attrDisplay, avatarColor: avatarInfo.color, avatarIcon: avatarInfo.icon }
      })
      this.setData({ students })
    } catch (e) { console.error(e) }
  },

  showAddDialog() { this.setData({ showAdd: true }) },
  hideAddDialog() { this.setData({ showAdd: false, nameInput: '' }) },
  onNameInput(e) { this.setData({ nameInput: e.detail.value }) },

  // 批量导入学生名单（老师端预创建，生成密钥）
  async importNames() {
    const names = this.data.nameInput
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0)

    if (names.length === 0) {
      wx.showToast({ title: '请输入名字', icon: 'none' })
      return
    }

    this.setData({ addLoading: true })
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'importStudents',
        data: { names, classId: app.globalData.classId },
      })
      if (res.result?.success) {
        wx.showToast({ title: `成功导入 ${names.length} 人`, icon: 'success' })
        this.hideAddDialog()
        this.loadStudents()
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '导入失败', icon: 'none' })
    }
    this.setData({ addLoading: false })
  },

  // 赠送重置天赋机会
  async grantReroll(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '赠予重置机会',
      content: `确定给 ${name} +1 次重置天赋机会？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await db.collection('students').doc(id).update({
            data: { rerollChances: db.command.inc(1) },
          })
          wx.showToast({ title: `已给 ${name} +1 次机会`, icon: 'success' })
          this.loadStudents()
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  },
})
