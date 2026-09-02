// pages/ranking/ranking.js
const { calcLevel, calcAttributes, calcTitle, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')

Page({
  data: {
    activeTab: 'exp',      // 'exp' 英雄榜 | 'coin' 富豪榜
    // 两份榜单一次加载好，切换时不用重新请求
    expData: { list: [], topThree: [], myRank: 0, myItem: null },
    coinData: { list: [], topThree: [], myRank: 0, myItem: null },
    // 当前显示的榜单
    topThree: [],
    rankList: [],
    myRank: 0,
    myStudent: null,
    vouchersLeft: 0,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateRole()
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadRanking()
    this.loadVouchers()
  },

  // 加载挑战凭证数量
  async loadVouchers() {
    const app = getApp()
    const studentId = app.globalData.studentInfo?._id
    if (!studentId) return

    try {
      const res = await wx.cloud.callFunction({
        name: 'getDrawStatus',
        data: { studentId }
      })
      if (res.result && res.result.success) {
        this.setData({ vouchersLeft: res.result.challengeVouchers || 0 })
      }
    } catch (e) {
      console.error('loadVouchers error:', e)
    }
  },

  // 跳转到挑战页面
  goToChallenge() {
    wx.navigateTo({
      url: '/miniprogram/pages/challenge/challenge'
    })
  },

  async loadRanking() {
    const app = getApp()
    const classId = app.globalData.classId
    const myStudentId = app.globalData.studentInfo?._id

    if (!classId) return

    try {
      wx.showNavigationBarLoading()
      const res = await wx.cloud.callFunction({
        name: 'getClassData',
        data: { classId, action: 'ranking' }
      })

      if (res.result && res.result.success) {
        const students = res.result.students

        // 批量加载所有学生的徽章数据
        const badgeMap = await this._loadAllBadges(students.map(s => s._id))

        // 经验榜：数据库已按 totalExp 降序，直接用
        const expList = this._buildList(students, 'totalExp', myStudentId, badgeMap)
        // 金币榜：同一批数据按 coins 降序重排
        const coinSorted = [...students].sort((a, b) => (b.coins || 0) - (a.coins || 0))
        const coinList = this._buildList(coinSorted, 'coins', myStudentId, badgeMap)

        this.setData({
          expData: this._pack(expList, myStudentId),
          coinData: this._pack(coinList, myStudentId),
        }, () => {
          this._applyTab(this.data.activeTab)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  // 切换榜单
  switchTab(e) {
    this._applyTab(e.currentTarget.dataset.tab)
  },

  _applyTab(tab) {
    const src = tab === 'coin' ? this.data.coinData : this.data.expData
    this.setData({
      activeTab: tab,
      rankList: src.list || [],
      topThree: src.topThree || [],
      myRank: src.myRank || 0,
      myStudent: src.myItem || null,
    })
  },

  /**
   * 构造榜单数据
   * @param sorted  已按 valueKey 降序排好的学生数组
   * @param valueKey 'totalExp' | 'coins'，决定进度条与排序依据
   */
  _buildList(sorted, valueKey, myStudentId, badgeMap) {
    const max = sorted.length > 0 ? (sorted[0][valueKey] || 0) : 0

    return sorted.map((s, i) => {
      const levelInfo = calcLevel(s.totalExp)
      const attrs = calcAttributes(s.talentId, levelInfo.level, s.growthMultiplier || 1.0)
      const titleInfo = calcTitle(attrs, levelInfo.level)
      const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
      const studentBadges = badgeMap[s._id] || []
      const badgeIcons = studentBadges.slice(0, 3).map(b => b.icon)
      const val = s[valueKey] || 0

      return {
        ...s,
        rank: i + 1,
        level: levelInfo.level,
        isMe: s._id === myStudentId,
        percent: max > 0 ? Math.round(val / max * 100) : 0,
        avatarColor: avatarInfo.color,
        avatarIcon: avatarInfo.icon,
        title: titleInfo.title,
        titleColor: titleInfo.color,
        badgeIcons,
        coins: s.coins || 0,
      }
    })
  },

  _pack(list, myStudentId) {
    const myItem = list.find(s => s._id === myStudentId) || null
    return {
      list,
      topThree: list.slice(0, 3),
      myRank: myItem ? myItem.rank : 0,
      myItem,
    }
  },

  // 批量加载徽章数据
  async _loadAllBadges(studentIds) {
    const badgeMap = {}
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const res = await db.collection('badgeStatus')
        .where({
          studentId: _.in(studentIds),
          currentLevel: _.gt(0)
        })
        .limit(100)
        .get()
      
      res.data.forEach(badge => {
        if (!badgeMap[badge.studentId]) {
          badgeMap[badge.studentId] = []
        }
        badgeMap[badge.studentId].push(badge)
      })
    } catch (e) {
      console.error('load badges error:', e)
    }
    return badgeMap
  },
})
