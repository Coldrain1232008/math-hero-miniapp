// pages/create-character/create-character.js
const { TALENT_DATA, randomTalent, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

Page({
  data: {
    step: 1,
    heroName: '',
    gender: 'male',
    selectedAvatar: null,
    avatarList: [],
    selectedCategory: null, // 选中的天赋大类
    talentCategories: [],   // 天赋大类列表
    talent: null,
    revealed: false,
    rolling: false,
    rerollCount: 2, // 最多重置2次
    creating: false,
    attrNames: ATTR_NAMES,
    attrColors: ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444'],
  },

  onLoad(options) {
    // 加载头像列表
    const avatarList = AvatarManager.getAvatars()
    // 加载天赋大类
    const categories = Object.keys(TALENT_DATA).map(key => ({
      id: key,
      ...TALENT_DATA[key]
    }))

    // 检查是否是重置天赋模式（教师触发）
    const isReroll = options.reroll === '1'

    if (isReroll) {
      // 重置模式：直接跳到天赋选择（保留之前的名字和头像）
      const app = getApp()
      const student = app.globalData.studentInfo || {}
      this.setData({
        avatarList,
        selectedAvatar: student.avatar || avatarList[0].id,
        heroName: student.heroName || '',
        talentCategories: categories,
        step: 2,  // 直接到 step 2（选择天赋大类）
        isRerollMode: true,
      })
    } else {
      // 正常创建模式
      this.setData({
        avatarList,
        selectedAvatar: avatarList[0].id,
        talentCategories: categories,
      })
    }
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

  // 选择天赋大类
  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id
    this.setData({ selectedCategory: categoryId })
  },

  // 从选中大类随机天赋
  toStep3() {
    if (!this.data.selectedCategory) {
      wx.showToast({ title: '请先选择一个天赋方向', icon: 'none' })
      return
    }
    this.setData({ step: 3 })
  },

  revealTalent() {
    if (this.data.rolling) return
    this.setData({ rolling: true })
    setTimeout(() => {
      // 从选中大类随机
      const { selectedCategory } = this.data
      const category = TALENT_DATA[selectedCategory]
      const subtypes = category.subtypes
      const randomSubtype = subtypes[Math.floor(Math.random() * subtypes.length)]
      const talent = {
        categoryId: selectedCategory,
        categoryName: category.name,
        color: category.color,
        ...randomSubtype
      }
      this.setData({ talent, revealed: true, rolling: false })
      wx.vibrateShort()
    }, 800)
  },

  reroll() {
    const count = this.data.rerollCount
    if (count <= 0) return
    const { selectedCategory } = this.data
    const category = TALENT_DATA[selectedCategory]
    const subtypes = category.subtypes
    const randomSubtype = subtypes[Math.floor(Math.random() * subtypes.length)]
    const talent = {
      categoryId: selectedCategory,
      categoryName: category.name,
      color: category.color,
      ...randomSubtype
    }
    this.setData({ talent, rerollCount: count - 1 })
    wx.vibrateShort()
  },

  async confirmCreate() {
    if (this.data.creating) return
    this.setData({ creating: true })
    const app = getApp()
    const { heroName, gender, selectedAvatar, talent, isRerollMode } = this.data
    // 预导入学生的 _id（通过登录时传入 globalData）
    const existingId = app.globalData.studentInfo?._id || ''

    try {
      // 重置天赋模式：直接调用 updateStudent 更新天赋
      if (isRerollMode) {
        const res = await wx.cloud.callFunction({
          name: 'updateStudent',
          data: {
            action: 'rerollTalent',
            studentId: existingId,
            talentId: talent.id,
            talentName: talent.name,
            talentCategory: talent.categoryId,
            talentColor: talent.color,
          },
        })

        if (res.result && res.result.success) {
          // 更新 globalData 中的学生信息
          app.globalData.studentInfo = {
            ...app.globalData.studentInfo,
            talentId: talent.id,
            talentName: talent.name,
            talentCategory: talent.categoryId,
            talentColor: talent.color,
          }
          wx.showToast({ title: '天赋重置成功！', icon: 'success' })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/character/character' })
          }, 1500)
        } else {
          throw new Error(res.result?.error || '重置失败')
        }
        this.setData({ creating: false })
        return
      }

      // 正常创建模式：调用 createStudent
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
