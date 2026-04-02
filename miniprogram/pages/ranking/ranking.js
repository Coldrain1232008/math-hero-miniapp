// pages/ranking/ranking.js
const { calcLevel, calcAttributes, calcTitle, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')

Page({
  data: {
    topThree: [],
    rankList: [],
    myRank: 0,
    myStudent: null,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateRole()
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadRanking()
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
        const maxExp = students[0]?.totalExp || 1

        const rankList = students.map((s, i) => {
          const levelInfo = calcLevel(s.totalExp)
          const attrs = calcAttributes(s.talentId, levelInfo.level)
          const titleInfo = calcTitle(attrs, levelInfo.level)
          const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
          return {
            ...s,
            rank: i + 1,
            level: levelInfo.level,
            isMe: s._id === myStudentId,
            expPercent: Math.round(s.totalExp / maxExp * 100),
            avatarColor: avatarInfo.color,
            avatarIcon: avatarInfo.icon,
            title: titleInfo.title,
            titleColor: titleInfo.color,
          }
        })

        const topThree = rankList.slice(0, 3)
        const myItem = rankList.find(s => s._id === myStudentId)
        const myRank = myItem ? myItem.rank : 0

        this.setData({ rankList, topThree, myRank, myStudent: myItem || null })
      }
    } catch (e) {
      console.error(e)
    } finally {
      wx.hideNavigationBarLoading()
    }
  },
})
