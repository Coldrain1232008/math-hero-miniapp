// pages/super/super.js
// super 管理员后台
//
// 安全说明：本页只负责交互，真正的鉴权在云函数 superAdmin 里做。
// 页面隐藏入口只是防学生误触，不是安全边界 —— 这一点不能反过来依赖。

const SUPER_KEY_CACHE = 'superKey'
const MAX_RECHARGE = 100000

const ICON_OPTIONS = ['🎁', '🎲', '🎫', '⚡', '🏅', '📖', '✏️', '🍭', '👑', '🌟']

const TYPE_OPTIONS = [
  { value: 'draw_ticket', label: '抽卡次数（永久有效，不过期）' },
  { value: 'challenge_voucher', label: '挑战凭证' },
  { value: 'growth_accelerant', label: '成长加速剂' },
  { value: 'coupon', label: '特权券（需线下核销，暂未开放）' },
]

function emptyItemForm() {
  return {
    name: '',
    desc: '',
    icon: '🎁',
    type: 'draw_ticket',
    payload: '1',
    price: '',
    stock: '',          // 空 = 不限（-1）
    limitPerUser: '',   // 空 = 不限（0）
    limitPerDay: '',    // 空 = 不限（0）
    status: 'on',
  }
}

Page({
  data: {
    // 登录态
    logged: false,
    superKey: '',
    adminName: '',
    loading: false,
    loginError: '',

    // 内容
    tab: 'classes',
    overview: {},
    classes: [],
    logs: [],
    loadingList: false,

    // 全局商品模板
    shopItems: [],
    loadingShop: false,
    showItemForm: false,
    itemFormId: '',          // 空 = 新增
    itemForm: emptyItemForm(),
    itemFormTypeIndex: 0,
    savingItem: false,
    iconOptions: ICON_OPTIONS,
    typeOptions: TYPE_OPTIONS,

    // 充值弹窗
    showRecharge: false,
    rechargeTarget: {},
    rechargeAmount: '',
    rechargeNote: '',
    previewBalance: 0,
    recharging: false
  },

  onLoad() {
    // 有缓存密钥就静默登录，省得每次都输
    const cached = wx.getStorageSync(SUPER_KEY_CACHE)
    if (cached) {
      this.setData({ superKey: cached })
      this.doLogin(cached, true)
    }
  },

  onSuperKeyInput(e) {
    this.setData({ superKey: e.detail.value, loginError: '' })
  },

  onLogin() {
    const key = (this.data.superKey || '').trim()
    if (!key) {
      this.setData({ loginError: '请输入管理员密钥' })
      return
    }
    this.doLogin(key, false)
  },

  // silent = true 时失败不弹错（用于缓存过期后的静默登录）
  async doLogin(key, silent) {
    this.setData({ loading: true, loginError: '' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'superAdmin',
        data: { action: 'login', superKey: key }
      })
      const r = res.result || {}

      if (!r.success) {
        if (silent) {
          // 缓存的密钥失效了，清掉即可，不要打扰用户
          wx.removeStorageSync(SUPER_KEY_CACHE)
          this.setData({ loading: false })
          return
        }
        this.setData({ loading: false, loginError: r.error || '登录失败' })
        return
      }

      wx.setStorageSync(SUPER_KEY_CACHE, key)
      this.setData({
        logged: true,
        adminName: (r.admin && r.admin.name) || 'super',
        loading: false
      })
      this.loadDashboard()
      this.loadLogs()
      this.loadShopItems()
    } catch (err) {
      this.setData({ loading: false })
      if (!silent) {
        this.setData({ loginError: '调用失败：' + (err.message || '未知错误') })
      }
    }
  },

  onLogout() {
    wx.removeStorageSync(SUPER_KEY_CACHE)
    this.setData({
      logged: false,
      superKey: '',
      adminName: '',
      classes: [],
      logs: [],
      overview: {},
      shopItems: [],
      showRecharge: false,
      showItemForm: false
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'logs') this.loadLogs()
    if (tab === 'shop') this.loadShopItems()
  },

  async loadDashboard() {
    this.setData({ loadingList: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'superAdmin',
        data: { action: 'dashboard', superKey: this.data.superKey }
      })
      const r = res.result || {}
      this.setData({ loadingList: false })
      if (r.success) {
        this.setData({ classes: r.classes || [], overview: r.overview || {} })
      } else {
        wx.showToast({ title: r.error || '加载失败', icon: 'none', duration: 3000 })
      }
    } catch (err) {
      this.setData({ loadingList: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadLogs() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'superAdmin',
        data: {
          action: 'getAdminLogs',
          superKey: this.data.superKey,
          limit: 50
        }
      })
      const r = res.result || {}
      if (r.success) {
        const logs = (r.logs || []).map(l => ({
          ...l,
          actionLabel: l.action === 'recharge' ? '钱包充值' : l.action,
          timeStr: this.formatTime(l.createdAt)
        }))
        this.setData({ logs })
      } else {
        wx.showToast({ title: r.error || '日志加载失败', icon: 'none', duration: 3000 })
      }
    } catch (err) {
      wx.showToast({ title: '日志加载失败', icon: 'none' })
    }
  },

  // ==================== 全局商品模板 ====================
  // classId 传 '' 表示操作全局模板；super 身份下 canOperate 一律放行

  callManageShop(action, extra) {
    return wx.cloud.callFunction({
      name: 'manageShop',
      data: Object.assign(
        { action, superKey: this.data.superKey, classId: '' },
        extra || {}
      ),
    })
  },

  async loadShopItems() {
    this.setData({ loadingShop: true })
    try {
      const res = await this.callManageShop('list')
      const r = res.result || {}
      this.setData({ loadingShop: false })
      if (r.success) {
        this.setData({ shopItems: r.items || [] })
      } else {
        this.setData({ shopItems: [] })
        wx.showToast({ title: r.error || '商品加载失败', icon: 'none', duration: 3000 })
      }
    } catch (err) {
      this.setData({ loadingShop: false })
      wx.showToast({ title: '商品加载失败', icon: 'none' })
    }
  },

  // data-index = -1 表示新增；>= 0 表示编辑第 N 个
  openItemForm(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)

    if (index < 0) {
      this.setData({
        showItemForm: true,
        itemFormId: '',
        itemForm: emptyItemForm(),
        itemFormTypeIndex: 0,
        savingItem: false,
      })
      return
    }

    const item = this.data.shopItems[index]
    if (!item) return
    const tIdx = TYPE_OPTIONS.findIndex((t) => t.value === item.type)

    this.setData({
      showItemForm: true,
      itemFormId: item._id,
      itemFormTypeIndex: tIdx >= 0 ? tIdx : 0,
      savingItem: false,
      itemForm: {
        name: item.name || '',
        desc: item.desc || '',
        icon: item.icon || '🎁',
        type: item.type || 'draw_ticket',
        payload: String(item.payload || 1),
        price: String(item.price || ''),
        // 后端 -1 / 0 表示不限，表单里留空更好懂
        stock: item.stock >= 0 ? String(item.stock) : '',
        limitPerUser: item.limitPerUser > 0 ? String(item.limitPerUser) : '',
        limitPerDay: item.limitPerDay > 0 ? String(item.limitPerDay) : '',
        status: item.status || 'on',
      },
    })
  },

  closeItemForm() {
    if (this.data.savingItem) return
    this.setData({ showItemForm: false, itemFormId: '' })
  },

  onItemField(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`itemForm.${field}`]: e.detail.value })
  },

  pickItemIcon(e) {
    this.setData({ 'itemForm.icon': e.currentTarget.dataset.icon })
  },

  onItemTypeChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      itemFormTypeIndex: idx,
      'itemForm.type': TYPE_OPTIONS[idx].value,
    })
  },

  onItemStatusSwitch(e) {
    this.setData({ 'itemForm.status': e.detail.value ? 'on' : 'off' })
  },

  submitItemForm() {
    if (this.data.savingItem) return

    const f = this.data.itemForm
    if (!String(f.name).trim()) {
      wx.showToast({ title: '请填写商品名称', icon: 'none' })
      return
    }

    const price = Number(f.price)
    if (!f.price || !Number.isInteger(price) || price < 1 || price > 9999) {
      wx.showToast({ title: '价格需为 1-9999 的整数', icon: 'none' })
      return
    }

    const payload = Number(f.payload)
    if (!Number.isInteger(payload) || payload < 1 || payload > 99) {
      wx.showToast({ title: '发放数量需为 1-99 的整数', icon: 'none' })
      return
    }

    // 空值语义：库存空 = 不限(-1)，限购空 = 不限(0)
    const stock = f.stock === '' ? -1 : Number(f.stock)
    if (!Number.isInteger(stock) || stock < -1) {
      wx.showToast({ title: '库存需填 -1（不限）或 >= 0', icon: 'none' })
      return
    }

    const limitPerUser = f.limitPerUser === '' ? 0 : Number(f.limitPerUser)
    if (!Number.isInteger(limitPerUser) || limitPerUser < 0) {
      wx.showToast({ title: '每人限购需填 0（不限）或正整数', icon: 'none' })
      return
    }

    const limitPerDay = f.limitPerDay === '' ? 0 : Number(f.limitPerDay)
    if (!Number.isInteger(limitPerDay) || limitPerDay < 0) {
      wx.showToast({ title: '每日限购需填 0（不限）或正整数', icon: 'none' })
      return
    }

    this.setData({ savingItem: true })

    const data = {
      name: String(f.name).trim(),
      desc: String(f.desc).trim(),
      icon: f.icon,
      type: f.type,
      payload,
      price,
      stock,
      limitPerUser,
      limitPerDay,
      status: f.status,
      settleType: 'burn',   // 本期全为虚拟商品，金币销毁
    }

    const extra = { data }
    if (this.data.itemFormId) extra.itemId = this.data.itemFormId

    this.callManageShop(this.data.itemFormId ? 'update' : 'add', extra)
      .then((res) => {
        const r = res.result || {}
        this.setData({ savingItem: false })
        if (!r.success) {
          wx.showToast({ title: r.error || '保存失败', icon: 'none', duration: 2500 })
          return
        }
        wx.showToast({ title: r.message || '已保存', icon: 'success' })
        this.setData({ showItemForm: false, itemFormId: '' })
        return this.loadShopItems()
      })
      .catch((err) => {
        console.error('保存商品失败:', err)
        this.setData({ savingItem: false })
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      })
  },

  async toggleItemStatus(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const item = this.data.shopItems[index]
    if (!item) return

    const nextStatus = item.status === 'off' ? 'on' : 'off'

    try {
      const res = await this.callManageShop('update', {
        itemId: item._id,
        data: { status: nextStatus },
      })
      const r = res.result || {}
      if (!r.success) {
        wx.showToast({ title: r.error || '操作失败', icon: 'none', duration: 2500 })
        return
      }
      wx.showToast({ title: nextStatus === 'on' ? '已上架' : '已下架', icon: 'success' })
      await this.loadShopItems()
    } catch (err) {
      console.error('切换上下架失败:', err)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  removeShopItem(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const item = this.data.shopItems[index]
    if (!item) return

    wx.showModal({
      title: '删除全局商品',
      content: `确定删除「${item.name}」吗？所有班级都将看不到它；如果已有学生购买，会改为下架而不是删除。`,
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return
        this.doRemoveItem(item._id)
      },
    })
  },

  async doRemoveItem(itemId) {
    wx.showLoading({ title: '处理中...' })
    try {
      const res = await this.callManageShop('remove', { itemId })
      wx.hideLoading()
      const r = res.result || {}
      if (!r.success) {
        wx.showToast({ title: r.error || '删除失败', icon: 'none', duration: 2500 })
        return
      }
      wx.showToast({ title: r.message || '已删除', icon: 'success', duration: 2500 })
      await this.loadShopItems()
    } catch (err) {
      wx.hideLoading()
      console.error('删除商品失败:', err)
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  },

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const p = n => (n < 10 ? '0' + n : '' + n)
    return (
      d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
    )
  },

  // ⚠️ WXML 的 data-* 永远是字符串，必须 parseInt
  openRecharge(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const target = this.data.classes[index]
    if (!target) return
    this.setData({
      showRecharge: true,
      rechargeTarget: target,
      rechargeAmount: '',
      rechargeNote: '',
      previewBalance: target.balance || 0
    })
  },

  closeRecharge() {
    if (this.data.recharging) return
    this.setData({ showRecharge: false })
  },

  preventBubble() {},

  onAmountInput(e) {
    const raw = e.detail.value
    const target = this.data.rechargeTarget
    const n = parseInt(raw, 10)
    const base = target.balance || 0
    this.setData({
      rechargeAmount: raw,
      previewBalance: isNaN(n) ? base : base + n
    })
  },

  onNoteInput(e) {
    this.setData({ rechargeNote: e.detail.value })
  },

  async submitRecharge() {
    const { rechargeTarget, rechargeAmount, rechargeNote, superKey } = this.data

    const n = parseInt(rechargeAmount, 10)
    if (!Number.isInteger(n) || n <= 0) {
      wx.showToast({ title: '请输入正整数', icon: 'none' })
      return
    }
    if (n > MAX_RECHARGE) {
      wx.showToast({ title: '单次最多 ' + MAX_RECHARGE, icon: 'none' })
      return
    }

    const from = rechargeTarget.balance || 0
    const to = from + n

    // 二次确认：金币是能换东西的资产，充错了只能靠人工再扣回来
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认充值',
        content: '给「' + rechargeTarget.name + '」充值 ' + n + ' 金币？\n余额 ' + from + ' → ' + to,
        confirmText: '确认充值',
        cancelText: '再想想',
        success: res => resolve(!!res.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    this.setData({ recharging: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'superAdmin',
        data: {
          action: 'recharge',
          superKey,
          classId: rechargeTarget._id,
          amount: n,
          note: rechargeNote || ''
        }
      })
      const r = res.result || {}
      this.setData({ recharging: false })

      if (r.success) {
        wx.showToast({ title: '已充值 ' + n, icon: 'success' })
        this.setData({ showRecharge: false })
        this.loadDashboard()
        this.loadLogs()
      } else {
        wx.showModal({
          title: '充值失败',
          content: r.error || '未知错误',
          showCancel: false
        })
      }
    } catch (err) {
      this.setData({ recharging: false })
      wx.showModal({
        title: '充值失败',
        content: err.message || '网络异常',
        showCancel: false
      })
    }
  }
})
