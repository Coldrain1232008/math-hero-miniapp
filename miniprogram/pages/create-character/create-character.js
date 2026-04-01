// pages/create-character/create-character.js
const { randomTalent, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

Page({
  data: {
    step: 1,
    heroName: '',
    gender: 'male',
    selectedAvatar: null,
    avatarList: [],
    talent: null,
    revealed: false,
    rolling: false,
    rerollCount: 2, // 最多重置2次
    creating: false,
    attrNames: ATTR_NAMES,
    attrColors: ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444'],
  },

  onLoad() {
    // 加载头像列表
    const avatarList = AvatarManager.getAvatars()
    // 默认选中第一个
    this.setData({
      avatarList,
      selectedAvatar: avatarList[0].id
    })
  },

  setMale() { this.setData({ gender: 'male' }) },
  setFemale() { this.setData({ gender: 'female' }) },
  selectAvatar(e) { this.setData({ selectedAvatar: e.currentTarget.dataset.id }) },
  onNameInput(e) { this.setData({ heroName: e.detail.value }) },

  toStep2() {
    const { heroName } = this.data
    if (!heroName.trim() || heroName.trim().length < 2) {
      wx.showToast({ title: '名字至少2个字', icon: 'none' })
      return
    }
    this.setData({ step: 2 })
  },

  revealTalent() {
    if (this.data.rolling) return
    this.setData({ rolling: true })
    setTimeout(() => {
      const talent = randomTalent()
      this.setData({ talent, revealed: true, rolling: false })
      wx.vibrateShort()
    }, 800)
  },

  reroll() {
    const count = this.data.rerollCount
    if (count <= 0) return
    const talent = randomTalent()
    this.setData({ talent, rerollCount: count - 1 })
    wx.vibrateShort()
  },

  async confirmCreate() {
    if (this.data.creating) return
    this.setData({ creating: true })
    const app = getApp()
    const { heroName, gender, selectedAvatar, talent } = this.data
    // 预导入学生的 _id（通过登录时传入 globalData）
    const existingId = app.globalData.studentInfo?._id || ''

    try {
      const studentData = {
        classId: app.globalData.classId,
        studentId: existingId,  // 预导入学生传 _id，云函数据此更新
        heroName: heroName.trim(),
        gender,
        avatar: selectedAvatar,
        talentId: talent.id,
        talentName: talent.name,
        talentCategory: talent.categoryId,
        talentColor: talent.color,
      }

      const res = await wx.cloud.callFunction({
        name: 'createStudent',
        data: studentData,
      })

      if (res.result && res.result.success) {
        // 更新 globalData 中的学生信息
        app.globalData.studentInfo = {
          ...app.globalData.studentInfo,
          ...studentData,
          totalExp: app.globalData.studentInfo?.totalExp || 0,
          level: app.globalData.studentInfo?.level || 1,
          _id: res.result.id || existingId,
        }
        wx.showToast({ title: '角色创建成功！', icon: 'success' })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/character/character' })
        }, 1500)
      } else {
        throw new Error(res.result?.message || '创建失败')
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
    this.setData({ creating: false })
  },
})
