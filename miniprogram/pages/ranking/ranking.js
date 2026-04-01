// pages/ranking/ranking.js
const { calcLevel } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

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
      const res = await db.collection('students')
        .where({ classId })
        .orderBy('totalExp', 'desc')
        .limit(50)
        .get()

      const maxExp = res.data[0]?.totalExp || 1

      const rankList = res.data.map((s, i) => {
        const levelInfo = calcLevel(s.totalExp)
        const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
        return {
          ...s,
          rank: i + 1,
          level: levelInfo.level,
          isMe: s._id === myStudentId,
          expPercent: Math.round(s.totalExp / maxExp * 100),
          avatarColor: avatarInfo.color,
          avatarIcon: avatarInfo.icon,
        }
      })

      const topThree = rankList.slice(0, 3)
      const myItem = rankList.find(s => s._id === myStudentId)
      const myRank = myItem ? myItem.rank : 0

      this.setData({ rankList, topThree, myRank, myStudent: myItem || null })
    } catch (e) {
      console.error(e)
    } finally {
      wx.hideNavigationBarLoading()
    }
  },
})
