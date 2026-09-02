// pages/shop/shop.js
// 金币商城（学生端）

Page({
  data: {
    loading: true,
    errorMsg: '',
    balance: 0,
    items: [],

    // 购买确认弹窗
    showConfirm: false,
    confirmItem: null,
    qty: 1,
    maxQty: 1,
    totalCost: 0,
    balanceAfter: 0,
    enough: false,
    shortage: 0,
    buying: false,
  },

  onLoad() {
    this.loadItems()
  },

  onPullDownRefresh() {
    this.loadItems().then(() => wx.stopPullDownRefresh())
  },

  // ============ 加载商品 ============
  async loadItems() {
    const app = getApp()
    const student = app.globalData.studentInfo
    if (!student || !student._id) {
      this.setData({ loading: false, errorMsg: '未获取到学生信息，请重新登录' })
      return
    }

    this.setData({ loading: true, errorMsg: '' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'shop',
        data: { action: 'list', studentId: student._id },
      })

      const r = res.result || {}
      if (!r.success) {
        // 集合未创建等情况，云函数会给出明确提示，原样展示
        this.setData({ loading: false, errorMsg: r.error || '加载失败' })
        return
      }

      this.setData({
        loading: false,
        balance: r.balance || 0,
        items: r.items || [],
      })
    } catch (e) {
      console.error('加载商城失败:', e)
      this.setData({
        loading: false,
        errorMsg: '加载失败：' + (e.message || '网络异常，请下拉重试'),
      })
    }
  },

  // ============ 打开购买确认 ============
  openConfirm(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.items[index]
    if (!item || !item.canBuy) return

    const maxQty = this.calcMaxQty(item)
    this.setData({
      showConfirm: true,
      confirmItem: item,
      qty: 1,
      maxQty,
    })
    this.recalc()
  },

  /**
   * 该商品当前最多能买几件
   * 取 库存 / 每人限购 / 每日限购 / 余额 四个维度的最小值，上限 10
   */
  calcMaxQty(item) {
    const cands = [10]

    if (item.stock >= 0) cands.push(item.stock)
    if (item.limitPerUser > 0) cands.push(item.limitPerUser - item.boughtTotal)
    if (item.limitPerDay > 0) cands.push(item.limitPerDay - item.boughtToday)
    cands.push(Math.floor(this.data.balance / item.price))

    const max = Math.min(...cands)
    return max >= 1 ? max : 1        // 余额为 0 时仍显示 1，由"金币不足"提示挡住
  },

  plusQty() {
    if (this.data.qty >= this.data.maxQty) return
    this.setData({ qty: this.data.qty + 1 })
    this.recalc()
  },

  minusQty() {
    if (this.data.qty <= 1) return
    this.setData({ qty: this.data.qty - 1 })
    this.recalc()
  },

  recalc() {
    const item = this.data.confirmItem
    if (!item) return
    const totalCost = item.price * this.data.qty
    const balance = this.data.balance
    const enough = balance >= totalCost

    this.setData({
      totalCost,
      enough,
      balanceAfter: enough ? balance - totalCost : 0,
      shortage: enough ? 0 : totalCost - balance,
    })
  },

  closeConfirm() {
    this.setData({ showConfirm: false, confirmItem: null })
  },

  // 阻止冒泡：点弹窗内部不关闭
  noop() {},

  // ============ 确认购买 ============
  async doBuy() {
    if (this.data.buying) return
    if (!this.data.enough) {
      wx.showToast({ title: '金币不足', icon: 'none' })
      return
    }

    const app = getApp()
    const student = app.globalData.studentInfo
    const item = this.data.confirmItem
    if (!student || !item) return

    this.setData({ buying: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'shop',
        data: {
          action: 'buy',
          studentId: student._id,
          itemId: item._id,
          quantity: this.data.qty,
        },
      })

      const r = res.result || {}
      if (!r.success) {
        wx.showToast({ title: r.error || '购买失败', icon: 'none', duration: 2500 })
        this.setData({ buying: false })
        // 限购/售罄类失败要刷新列表，前端状态已过期
        if (r.soldOut) this.loadItems()
        return
      }

      // 同步全局余额，返回角色页时显示正确（写后读回的值最可靠）
      if (app.globalData.studentInfo) {
        app.globalData.studentInfo.coins = r.balance
      }

      wx.vibrateShort({ type: 'medium' })
      wx.showToast({
        title: `购买成功，花费 ${r.spent} 金币`,
        icon: 'success',
        duration: 2000,
      })

      this.setData({ showConfirm: false, confirmItem: null, buying: false })
      await this.loadItems()
    } catch (e) {
      console.error('购买失败:', e)
      this.setData({ buying: false })
      wx.showToast({ title: '购买失败，请重试', icon: 'none' })
    }
  },

  goCoinLogs() {
    wx.navigateTo({ url: '/pages/coin-logs/coin-logs' })
  },
})
