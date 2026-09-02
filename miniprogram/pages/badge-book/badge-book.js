// pages/badge-book/badge-book.js
Page({
  data: {
    allBadges: [],
    filteredBadges: [],
    currentTab: 'all',
    achievedCount: 0,
    totalCount: 0,
    progressPercent: 0,
    loading: true,
    showDetail: false,
    selectedBadge: null,
  },

  onLoad() {
    this.loadBadges()
  },

  async loadBadges() {
    this.setData({ loading: true })
    try {
      const app = getApp()
      const studentId = app.globalData.studentInfo?._id
      if (!studentId) return

      const res = await wx.cloud.callFunction({
        name: 'checkBadges',
        data: { studentId }
      })

      // 即使 success 为 false，也要处理 allBadges（云函数出错时也会返回）
      if (res.result) {
        const allBadges = res.result.allBadges || []
        const achievedCount = res.result.achievedBadgeCount || allBadges.filter(b => b.achieved).length
        const totalCount = res.result.totalBadgeCount || allBadges.length
        const progressPercent = totalCount > 0 ? Math.round((achievedCount / totalCount) * 100) : 0

        this.setData({
          allBadges,
          achievedCount,
          totalCount,
          progressPercent
        })

        this.filterBadges()
      }
    } catch (e) {
      console.error('加载徽章失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    this.filterBadges()
  },

  filterBadges() {
    const { allBadges, currentTab } = this.data
    let filteredBadges = []

    if (currentTab === 'all') {
      filteredBadges = allBadges
    } else if (currentTab === 'streak') {
      filteredBadges = allBadges.filter(b => b.badgeType === 'streak')
    } else if (currentTab === 'milestone') {
      filteredBadges = allBadges.filter(b => b.badgeType === 'milestone' && !b.isHidden)
    } else if (currentTab === 'hidden') {
      filteredBadges = allBadges.filter(b => b.isHidden)
    }

    this.setData({ filteredBadges })
  },

  showBadgeDetail(e) {
    const badge = e.currentTarget.dataset.badge
    this.setData({
      showDetail: true,
      selectedBadge: badge
    })
  },

  hideDetail() {
    this.setData({
      showDetail: false,
      selectedBadge: null
    })
  },

  preventBubble() {},
})
