// miniprogram/pages/gacha/gacha.js
const app = getApp()

Page({
  data: {
    studentInfo: null,
    dailyLeft: 3,  // 默认3，loadData 后由 getDrawStatus 覆盖
    challengeVouchers: 0,
    growthAccelerants: 0,
    isDrawing: false,
    result: null, // { type, desc, subDesc }
    showResult: false
  },

  onLoad() {
    this._pageLoaded = false
    this.loadData()
  },

  onShow() {
    // onLoad 与 onShow 会同时触发，用标记避免重复调用 loadData
    if (this._pageLoaded) {
      this.loadData()
    }
  },

  async loadData() {
    const info = app.globalData.studentInfo
    if (!info) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'getDrawStatus',
        data: { openid: info.openid }
      })
      if (res.result && res.result.success) {
        // 同步到 globalData，避免下次进入页面时丢失
        app.globalData.studentInfo = {
          ...info,
          dailyDrawLeft: res.result.dailyLeft,
          remainingDraws: res.result.dailyLeft,
          challengeVouchers: res.result.challengeVouchers,
          growthAccelerants: res.result.growthAccelerants
        }
        this.setData({
          studentInfo: app.globalData.studentInfo,
          dailyLeft: res.result.dailyLeft,
          challengeVouchers: res.result.challengeVouchers,
          growthAccelerants: res.result.growthAccelerants
        })
        this._pageLoaded = true
        return
      }
      // getDrawStatus 返回 success: false（如学生不存在、openid 异常等），用 globalData 兜底
      console.warn('getDrawStatus success:false, fallback to globalData', res.result && res.result.error)
      throw new Error(res.result && res.result.error || 'getDrawStatus failed')
    } catch (e) {
      // getDrawStatus 失败时，直接查数据库获取最新数据
      console.error('getDrawStatus error:', e)
      try {
        const freshRes = await wx.cloud.callFunction({
          name: 'getStudentInfo',
          data: { openid: info.openid }
        })
        if (freshRes.result && freshRes.result.success) {
          app.globalData.studentInfo = {
            ...info,
            dailyDrawLeft: freshRes.result.dailyDrawLeft,
            remainingDraws: freshRes.result.dailyDrawLeft,
            challengeVouchers: freshRes.result.challengeVouchers,
            growthAccelerants: freshRes.result.growthAccelerants
          }
          this.setData({
            studentInfo: app.globalData.studentInfo,
            dailyLeft: freshRes.result.dailyDrawLeft,
            challengeVouchers: freshRes.result.challengeVouchers,
            growthAccelerants: freshRes.result.growthAccelerants
          })
          this._pageLoaded = true
          return
        }
      } catch (e2) {
        console.error('getStudentInfo error:', e2)
      }
      // 全都失败时用本地缓存，优先读 remainingDraws（新字段），兼容 dailyDrawLeft（旧字段）
      const localLeft = (typeof info.remainingDraws === 'number' && info.remainingDraws >= 0)
        ? info.remainingDraws
        : ((info.dailyDrawLeft !== undefined && info.dailyDrawLeft !== null)
            ? info.dailyDrawLeft : 3)
      this.setData({
        studentInfo: info,
        dailyLeft: localLeft,
        challengeVouchers: info.challengeVouchers || 0,
        growthAccelerants: info.growthAccelerants || 0
      })
      this._pageLoaded = true
    }
  },

  _getTodayStr() {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  },

  // 抽卡
  async drawTap() {
    // 用同步标记防止 setData 异步导致的重复点击
    if (this._isDrawing) return
    if (this.data.dailyLeft <= 0) {
      wx.showToast({ title: '今日次数已用完', icon: 'none' })
      return
    }
    this._isDrawing = true
    this.setData({ isDrawing: true, showResult: false })

    try {
      const res = await wx.cloud.callFunction({
        name: 'drawGacha',
        data: { openid: app.globalData.studentInfo.openid }
      })

      if (res.result.success) {
        // 更新本地数据（同时更新 remainingDraws，确保角色页能正确读取）
        app.globalData.studentInfo = {
          ...app.globalData.studentInfo,
          totalExp: res.result.newTotalExp,
          lastDrawDate: this._getTodayStr(),
          dailyDrawLeft: res.result.dailyLeft,
          remainingDraws: res.result.dailyLeft,
          challengeVouchers: res.result.challengeVouchers !== undefined
            ? res.result.challengeVouchers
            : (app.globalData.studentInfo.challengeVouchers || 0),
          growthAccelerants: res.result.growthAccelerants !== undefined
            ? res.result.growthAccelerants
            : (app.globalData.studentInfo.growthAccelerants || 0),
        }
        this.setData({
          result: res.result.result,
          showResult: true,
          dailyLeft: res.result.dailyLeft,
          newTotalExp: res.result.newTotalExp,
          challengeVouchers: app.globalData.studentInfo.challengeVouchers,
          growthAccelerants: app.globalData.studentInfo.growthAccelerants
        })
      } else {
        // 失败时也同步真实次数，避免前端显示与数据库不一致
        const realLeft = typeof res.result.dailyLeft === 'number' ? res.result.dailyLeft : this.data.dailyLeft
        this.setData({ dailyLeft: realLeft })
        wx.showToast({ title: res.result.error || '抽卡失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '抽卡失败，请重试', icon: 'none' })
      console.error(e)
    } finally {
      this._isDrawing = false
      this.setData({ isDrawing: false })
    }
  },

  // 关闭结果弹窗
  closeResult() {
    this.setData({ showResult: false })
  },

  // 前往挑战页面
  goChallenge() {
    this.closeResult()
    wx.navigateTo({ url: '/pages/challenge/challenge' })
  },

  // 使用成长加速剂
  async useAccelerant(e) {
    const attrIdx = e.currentTarget.dataset.idx
    const attrs = ['智识', '专注', '毅力', '灵感', '表达', '心志']
    wx.showModal({
      title: '使用成长加速剂',
      content: `确定永久提升「${attrs[attrIdx]}」的成长速度 +0.1？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const updateRes = await wx.cloud.callFunction({
              name: 'useGrowthAccelerant',
              data: { openid: app.globalData.studentInfo.openid, attrIndex: attrIdx }
            })
            if (updateRes.result.success) {
              wx.showToast({ title: `${attrs[attrIdx]}成长加速！`, icon: 'success' })
              this.loadData()  // 刷新页面获取最新数据
            } else {
              wx.showToast({ title: updateRes.result.error || '使用失败', icon: 'none' })
            }
          } catch (e) {
            wx.showToast({ title: '使用失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 展开道具菜单
  showItems() {
    const items = []
    const vouchers = this.data.challengeVouchers
    const accel = this.data.growthAccelerants
    if (vouchers > 0) items.push({ type: 'voucher', name: '挑战凭证', count: vouchers })
    if (accel > 0) items.push({ type: 'accelerant', name: '成长加速剂', count: accel })
    if (items.length === 0) {
      wx.showToast({ title: '暂无道具', icon: 'none' })
      return
    }
    wx.showActionSheet({
      itemList: items.map(i => `${i.name} ×${i.count}`),
      success: (res) => {
        const item = items[res.tapIndex]
        if (item.type === 'voucher') {
          this.goChallenge()
        } else {
          // 选择属性
          const attrs = ['智识', '专注', '毅力', '灵感', '表达', '心志']
          wx.showActionSheet({
            itemList: attrs,
            success: (r) => this.useAccelerant({ currentTarget: { dataset: { idx: r.tapIndex } } })
          })
        }
      }
    })
  }
})
