// pages/create-character/create-character.js
const {
  TALENT_DATA, TALENT_QUESTIONS, randomTalent, ATTR_NAMES,
  evaluateTest, matchTalent, getPersonalitySummary
} = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

Page({
  data: {
    step: 1,              // 1=基本信息, 2=天赋选择(测试/跳过), 3=测试答题, 4=结果展示
    heroName: '',
    gender: 'male',
    selectedAvatar: null,
    avatarList: [],
    creating: false,
    isRerollMode: false,

    // 测试相关
    questions: TALENT_QUESTIONS,
    currentQuestion: 0,    // 当前题号（0-based）
    answers: [],           // 用户选择的答案索引
    testScores: null,      // 测试得分 [智,专,毅,灵,表,心]

    // 结果相关
    talent: null,
    growthMultiplier: 1.0,
    testCompleted: false,
    personalitySummary: '',
    attrNames: ATTR_NAMES,
    attrColors: ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444'],

    // 随机动画
    rolling: false,
  },

  onLoad(options) {
    const avatarList = AvatarManager.getAvatars()
    const isReroll = options.reroll === '1'

    if (isReroll) {
      const app = getApp()
      const student = app.globalData.studentInfo || {}
      this.setData({
        avatarList,
        selectedAvatar: student.avatar || avatarList[0].id,
        heroName: student.heroName || '',
        step: 2,
        isRerollMode: true,
      })
    } else {
      this.setData({
        avatarList,
        selectedAvatar: avatarList[0].id,
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

  // ========== 天赋选择：测试 or 跳过 ==========

  startTest() {
    this.setData({
      step: 3,
      currentQuestion: 0,
      answers: [],
    })
  },

  skipTest() {
    // 随机觉醒，成长率×0.8
    this.setData({ rolling: true })
    setTimeout(() => {
      const talent = randomTalent()
      this.setData({
        step: 4,
        talent,
        growthMultiplier: 0.8,
        testCompleted: false,
        rolling: false,
      })
      wx.vibrateShort()
    }, 1000)
  },

  // ========== 测试答题 ==========

  selectOption(e) {
    const optionIdx = parseInt(e.currentTarget.dataset.idx)
    const { currentQuestion, answers } = this.data
    const newAnswers = [...answers, optionIdx]

    if (currentQuestion < TALENT_QUESTIONS.length - 1) {
      // 下一题
      this.setData({
        currentQuestion: currentQuestion + 1,
        answers: newAnswers,
      })
    } else {
      // 最后一题，评估结果
      const scores = evaluateTest(newAnswers)
      const talent = matchTalent(scores)
      const summary = getPersonalitySummary(scores)
      this.setData({
        step: 4,
        answers: newAnswers,
        testScores: scores,
        talent,
        growthMultiplier: 1.0,
        testCompleted: true,
        personalitySummary: summary,
      })
      wx.vibrateShort()
    }
  },

  // ========== 确认创建 ==========

  async confirmCreate() {
    if (this.data.creating) return
    this.setData({ creating: true })
    const app = getApp()
    const {
      heroName, gender, selectedAvatar, talent,
      growthMultiplier, testCompleted, isRerollMode
    } = this.data
    const existingId = app.globalData.studentInfo?._id || ''

    try {
      if (isRerollMode) {
        // 重置天赋模式
        const res = await wx.cloud.callFunction({
          name: 'updateStudent',
          data: {
            action: 'rerollTalent',
            studentId: existingId,
            talentId: talent.id,
            talentName: talent.name,
            talentCategory: talent.categoryId,
            talentColor: talent.color,
            growthMultiplier,
            testCompleted,
          },
        })

        if (res.result && res.result.success) {
          app.globalData.studentInfo = {
            ...app.globalData.studentInfo,
            talentId: talent.id,
            talentName: talent.name,
            talentCategory: talent.categoryId,
            talentColor: talent.color,
            growthMultiplier,
            testCompleted,
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

      // 正常创建模式
      const studentData = {
        classId: app.globalData.classId,
        studentId: existingId,
        heroName: heroName.trim(),
        gender,
        avatar: selectedAvatar,
        talentId: talent.id,
        talentName: talent.name,
        talentCategory: talent.categoryId,
        talentColor: talent.color,
        growthMultiplier,
        testCompleted,
      }

      const res = await wx.cloud.callFunction({
        name: 'createStudent',
        data: studentData,
      })

      if (res.result && res.result.success) {
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
