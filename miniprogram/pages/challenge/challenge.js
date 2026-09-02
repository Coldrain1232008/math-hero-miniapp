// miniprogram/pages/challenge/challenge.js
const app = getApp()
const { calcLevel } = require('../../utils/gameData')

const ATTR_NAMES = ['智识', '专注', '毅力', '灵感', '表达', '心志']

// 计算挑战奖励（与云函数 useChallenge 中的 calcChallengeReward 保持一致）
function calcChallengeReward(myLevel, opponentLevel) {
  const levelDiff = opponentLevel - myLevel
  if (levelDiff <= -10) {
    return { rewardText: '1EXP', note: '（对手等级过低，奖励缩水）' }
  } else if (levelDiff >= 5) {
    const bonus = Math.floor(levelDiff / 5) * 5
    return { rewardText: `${5 + bonus}EXP`, note: `（对手等级高${levelDiff}级，额外+${bonus}）` }
  }
  return { rewardText: '5EXP', note: '' }
}

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
    // 初始化时从 globalData 读取凭证数量
    const info = app.globalData.studentInfo || {}
    this.setData({ vouchersLeft: info.challengeVouchers || 0 })
    this.loadClassmates()
  },

  onShow() {
    // 每次进入页面同步最新凭证数量
    const info = app.globalData.studentInfo || {}
    this.setData({ vouchersLeft: info.challengeVouchers || 0 })
  },

  async loadClassmates() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getClassmates',
        data: { studentId: app.globalData.studentInfo._id }
      })
      if (res.result.success) {
        const myInfo = app.globalData.studentInfo || {}
        const myLevel = (calcLevel(myInfo.totalExp || 0) || {}).level || 1

        // 为每个同学计算等级差
        const classmates = (res.result.classmates || []).map(c => {
          const levelInfo = calcLevel(c.totalExp || 0)
          const level = levelInfo.level || 1
          const levelDiff = level - myLevel
          let diffText = ''
          let diffClass = ''
          if (levelDiff > 0) {
            diffText = `+${levelDiff}`
            diffClass = 'higher'
          } else if (levelDiff < 0) {
            diffText = `${levelDiff}`
            diffClass = 'lower'
          }
          return {
            ...c,
            level,
            levelDiff,
            diffText,
            diffClass
          }
        })

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
    if ((myInfo.challengeVouchers || 0) <= 0) {
      wx.showToast({ title: '没有挑战凭证了', icon: 'none' })
      return
    }
    this.setData({ selectedOpponent: opponent })

    const myLevel = (calcLevel(myInfo.totalExp || 0) || {}).level || 1
    const reward = calcChallengeReward(myLevel, opponent.level)
    const diffInfo = opponent.levelDiff !== 0
      ? (opponent.levelDiff > 0 ? `对手等级比你高${opponent.levelDiff}级，` : `对手等级比你低${Math.abs(opponent.levelDiff)}级，`)
      : '对手等级与你相同，'

    wx.showModal({
      title: `向「${opponent.name}」发起挑战？`,
      content: `${diffInfo}胜利可获得 ${reward.rewardText}${reward.note}，失败 -5 EXP！\n\n系统随机抽取3个属性对决，胜多负少者获胜。`,
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
          studentId: app.globalData.studentInfo._id,
          targetId: opponent._id
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
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/challenge-history/challenge-history' })
  }
})
