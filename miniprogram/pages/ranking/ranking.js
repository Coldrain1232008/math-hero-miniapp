// pages/ranking/ranking.js
const { calcLevel, calcAttributes, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

// 称号配置
const TITLE_CONFIG = {
  // 单属性称号
  智识: { name: '智多星', icon: '🧠' },
  专注: { name: '入定僧', icon: '🧘' },
  毅力: { name: '不倒翁', icon: '💪' },
  灵感: { name: '灵光一闪', icon: '💡' },
  表达: { name: '演说家', icon: '🎤' },
  心志: { name: '大心脏', icon: '❤️' },
}

// 组合称号
const COMBO_TITLES = [
  { attrs: ['智识', '灵感'], name: '创意大师', icon: '🎨' },
  { attrs: ['专注', '毅力'], name: '苦行僧', icon: '📿' },
  { attrs: ['表达', '心志'], name: '领袖气质', icon: '👑' },
  { attrs: ['智识', '表达'], name: '学者型', icon: '📚' },
  { attrs: ['专注', '灵感'], name: '入定创作者', icon: '✨' },
]

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

  // 计算称号
  calcTitle(student) {
    if (!student || !student.talentId) return null
    
    const levelInfo = calcLevel(student.totalExp)
    const attrs = calcAttributes(student.talentId, levelInfo.level)
    
    // 找出最高属性
    let maxVal = -1
    let maxIdx = -1
    let secondMaxVal = -1
    let secondMaxIdx = -1
    
    attrs.forEach((val, idx) => {
      if (val > maxVal) {
        secondMaxVal = maxVal
        secondMaxIdx = maxIdx
        maxVal = val
        maxIdx = idx
      } else if (val > secondMaxVal) {
        secondMaxVal = val
        secondMaxIdx = idx
      }
    })
    
    const maxAttrName = ATTR_NAMES[maxIdx]
    const secondAttrName = ATTR_NAMES[secondMaxIdx]
    
    // 检查是否有组合称号（两项都较高且差距不大）
    if (secondMaxVal > 0 && (maxVal - secondMaxVal) / maxVal < 0.15) {
      const combo = COMBO_TITLES.find(c => 
        (c.attrs[0] === maxAttrName && c.attrs[1] === secondAttrName) ||
        (c.attrs[0] === secondAttrName && c.attrs[1] === maxAttrName)
      )
      if (combo) {
        return { ...combo, isCombo: true }
      }
    }
    
    // 返回单属性称号
    const title = TITLE_CONFIG[maxAttrName]
    return title ? { ...title, isCombo: false } : null
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
        const title = this.calcTitle(s)
        return {
          ...s,
          rank: i + 1,
          level: levelInfo.level,
          isMe: s._id === myStudentId,
          expPercent: Math.round(s.totalExp / maxExp * 100),
          avatarColor: avatarInfo.color,
          avatarIcon: avatarInfo.icon,
          title: title,
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
