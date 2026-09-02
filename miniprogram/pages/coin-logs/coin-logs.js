// pages/coin-logs/coin-logs.js
// 金币明细：收入/支出流水

Page({
  data: {
    loading: true,
    logs: [],
    filter: 'all',        // all | income | expense
    coins: 0,
    totalCoinsEarned: 0,
    hasMore: false,
    loadingMore: false,
    pageSize: 30,
  },

  onLoad() {
    this.loadSummary()
    this.loadLogs(true)
  },

  onPullDownRefresh() {
    Promise.all([this.loadSummary(), this.loadLogs(true)]).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore()
    }
  },

  // 余额与累计
  async loadSummary() {
    const app = getApp()
    const student = app.globalData.studentInfo
    if (!student) return
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoinLogs',
        data: { action: 'summary', studentId: student._id }
      })
      if (res.result && res.result.success) {
        this.setData({
          coins: res.result.coins || 0,
          totalCoinsEarned: res.result.totalCoinsEarned || 0,
        })
      }
    } catch (e) {
      console.error('加载金币余额失败:', e)
    }
  },

  // 流水列表
  async loadLogs(reset) {
    const app = getApp()
    const student = app.globalData.studentInfo
    if (!student) {
      this.setData({ loading: false })
      return
    }

    if (reset) this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoinLogs',
        data: {
          action: 'list',
          studentId: student._id,
          type: this.data.filter,
          limit: this.data.pageSize,
          skip: 0,
        }
      })
      if (res.result && res.result.success) {
        const logs = (res.result.logs || []).map((item) => ({
          ...item,
          icon: this._icon(item.type),
        }))
        this.setData({
          logs,
          hasMore: !!res.result.hasMore,
          loading: false,
        })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.result?.error || '加载失败', icon: 'none' })
      }
    } catch (e) {
      console.error('加载金币流水失败:', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadMore() {
    const app = getApp()
    const student = app.globalData.studentInfo
    if (!student) return

    this.setData({ loadingMore: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoinLogs',
        data: {
          action: 'list',
          studentId: student._id,
          type: this.data.filter,
          limit: this.data.pageSize,
          skip: this.data.logs.length,
        }
      })
      if (res.result && res.result.success) {
        const more = (res.result.logs || []).map((item) => ({
          ...item,
          icon: this._icon(item.type),
        }))
        this.setData({
          logs: this.data.logs.concat(more),
          hasMore: !!res.result.hasMore,
          loadingMore: false,
        })
      } else {
        this.setData({ loadingMore: false })
      }
    } catch (e) {
      console.error('加载更多失败:', e)
      this.setData({ loadingMore: false })
    }
  },

  // 切换筛选
  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.filter) return
    this.setData({ filter }, () => {
      this.loadLogs(true)
    })
  },

  _icon(type) {
    const map = {
      teacher_grant: '🧑‍🏫',
      teacher_deduct: '↩️',
      transfer_out: '🎁',
      transfer_in: '💰',
      shop_purchase: '🛒',
    }
    return map[type] || '🪙'
  },
})
