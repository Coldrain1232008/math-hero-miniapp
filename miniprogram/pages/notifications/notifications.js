// pages/notifications/notifications.js
Page({
  data: {
    notifications: [],
    unreadCount: 0,
    loading: true,
    page: 1,
    hasMore: true,
  },

  onLoad() {
    this.loadNotifications()
  },

  async loadNotifications(loadMore = false) {
    if (loadMore) {
      this.setData({ page: this.data.page + 1 })
    } else {
      this.setData({ page: 1, notifications: [] })
    }

    this.setData({ loading: true })
    try {
      const app = getApp()
      const studentId = app.globalData.studentInfo?._id
      if (!studentId) return

      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: {
          studentId,
          page: this.data.page,
          pageSize: 20
        }
      })

      if (res.result && res.result.success) {
        const newNotifications = res.result.notifications || []
        const notifications = loadMore
          ? [...this.data.notifications, ...newNotifications]
          : newNotifications

        this.setData({
          notifications,
          unreadCount: res.result.unreadCount || 0,
          hasMore: res.result.hasMore
        })
      }
    } catch (e) {
      console.error('加载消息失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadNotifications(true)
    }
  },

  async markAllRead() {
    try {
      const app = getApp()
      const studentId = app.globalData.studentInfo?._id
      if (!studentId) return

      await wx.cloud.callFunction({
        name: 'markNotificationRead',
        data: { studentId, markAll: true }
      })

      // 更新本地状态
      const notifications = this.data.notifications.map(n => ({ ...n, read: true }))
      this.setData({ notifications, unreadCount: 0 })
      wx.showToast({ title: '已全部标记为已读', icon: 'success' })
    } catch (e) {
      console.error('标记已读失败:', e)
    }
  },

  async tapNotification(e) {
    const notification = e.currentTarget.dataset.item
    if (!notification) return

    // 标记为已读
    if (!notification.read) {
      try {
        await wx.cloud.callFunction({
          name: 'markNotificationRead',
          data: { notificationId: notification._id }
        })

        // 更新本地状态
        const notifications = this.data.notifications.map(n => {
          if (n._id === notification._id) {
            return { ...n, read: true }
          }
          return n
        })
        this.setData({
          notifications,
          unreadCount: Math.max(0, this.data.unreadCount - 1)
        })
      } catch (e) {
        console.error('标记已读失败:', e)
      }
    }

    // 根据消息类型跳转
    this.navigateToNotification(notification)
  },

  navigateToNotification(notification) {
    const { type, data } = notification

    switch (type) {
      case 'badge_unlock':
        wx.navigateTo({ url: '/pages/badge-book/badge-book' })
        break
      case 'challenge_win':
      case 'challenge_lose':
        wx.navigateTo({ url: '/pages/challenge-history/challenge-history' })
        break
      case 'level_up':
        wx.navigateTo({ url: '/pages/character/character' })
        break
      default:
        wx.navigateTo({ url: '/pages/character/character' })
    }
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diff = now - d

    if (diff < 60 * 1000) return '刚刚'
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}天前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  },
})
