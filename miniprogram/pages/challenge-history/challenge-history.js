// pages/challenge-history/challenge-history.js
const app = getApp()

Page({
  data: {
    activeTab: 'initiator', // 'initiator' | 'receiver'
    asInitiator: [],
    asReceiver: [],
    loading: true,
    emptyText: ''
  },

  onLoad() {
    this.loadHistory()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateRole()
    }
  },

  onPullDownRefresh() {
    this.loadHistory().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadHistory() {
    const studentId = app.globalData.studentInfo?._id
    if (!studentId) return

    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getChallengeHistory',
        data: { studentId }
      })
      if (res.result && res.result.success) {
        this.setData({
          asInitiator: res.result.asInitiator || [],
          asReceiver: res.result.asReceiver || [],
          loading: false,
          emptyText: this.getEmptyText()
        })
      } else {
        wx.showToast({ title: res.result?.error || '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab, emptyText: this.getEmptyText() })
  },

  getEmptyText() {
    const { activeTab, asInitiator, asReceiver } = this.data
    const list = activeTab === 'initiator' ? asInitiator : asReceiver
    if (list.length === 0) {
      return activeTab === 'initiator' ? '暂无发起的挑战' : '暂无被挑战记录'
    }
    return ''
  }
})
