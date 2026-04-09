// miniprogram/pages/challenge/challenge.js
const app = getApp()

const ATTR_NAMES = ['智识', '专注', '毅力', '灵感', '表达', '心志']

Page({
  data: {
    classmates: [],
    loading: true,
    selectedOpponent: null,
    showBattle: false,
    battleResult: null,
    battleResultClass: '',
    battleResultText: '',
    vouchersLeft: 0,
    myAttrs: [],
    opponentAttrs: []
  },

  onLoad() {
    this.loadClassmates()
  },

  async loadClassmates() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getClassmates',
        data: { openid: app.globalData.studentInfo.openid }
      })
      if (res.result.success) {
        const classmates = res.result.classmates || []
        if (classmates.length === 0 && res.result.debug) {
          const d = res.result.debug
          wx.showToast({ title: `班级ID:${d.myClassId} 无其他同学`, icon: 'none', duration: 3000 })
          console.log('[getClassmates debug]', res.result.debug)
        }
        this.setData({ classmates, loading: false })
      } else {
        wx.showToast({ title: res.result.error || '加载失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error(e)
    }
  },

  // 选择对手
  selectOpponent(e) {
    const opponent = this.data.classmates[e.currentTarget.dataset.idx]
    const myInfo = app.globalData.studentInfo || {}
    if (myInfo.challengeVouchers <= 0) {
      wx.showToast({ title: '没有挑战凭证了', icon: 'none' })
      return
    }
    this.setData({ selectedOpponent: opponent })
    wx.showModal({
      title: `向「${opponent.name}」发起挑战？`,
      content: '系统将随机抽取你的3个属性与对手的3个属性进行对决，胜者获得 +5 EXP，负方无惩罚。',
      confirmText: '发起挑战',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          await this.doChallenge(opponent)
        }
      }
    })
  },

  async doChallenge(opponent) {
    wx.showLoading({ title: '对决中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'useChallenge',
        data: {
          openid: app.globalData.studentInfo.openid,
          myId: app.globalData.studentInfo._id,
          targetOpenid: opponent._id  // 用 _id 查（开发环境 openid 可能重复）
        }
      })
      wx.hideLoading()
      if (res.result.success) {
        const battle = res.result.battle
        const battleResultClass = battle.winner === 'me' ? 'win' : (battle.winner === 'opponent' ? 'lose' : 'draw')
        const battleResultText = battle.winner === 'me' ? '你赢了！' : (battle.winner === 'opponent' ? '对手获胜' : '平局')
        this.setData({
          showBattle: true,
          battleResult: battle,
          battleResultClass,
          battleResultText,
          vouchersLeft: res.result.vouchersLeft
        })
        // 更新全局数据
        app.globalData.studentInfo = {
          ...app.globalData.studentInfo,
          challengeVouchers: res.result.vouchersLeft
        }
      } else {
        wx.showToast({ title: res.result.error || '挑战失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '挑战失败', icon: 'none' })
      console.error(e)
    }
  },

  closeBattle() {
    this.setData({ showBattle: false })
  },

  backToList() {
    this.closeBattle()
    this.loadClassmates()
  }
})
