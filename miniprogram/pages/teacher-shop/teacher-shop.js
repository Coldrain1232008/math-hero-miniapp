// pages/teacher-shop/teacher-shop.js
// 教师端商城商品管理
//
// 权限边界（服务端 manageShop 强制，前端只是提示）：
//   本班商品（classId = 本班）→ 可增删改
//   全局模板（classId 为空）  → 只读，仅 super 能改

const ICON_OPTIONS = ['🎁', '🎲', '🎫', '⚡', '🏅', '📖', '✏️', '🍭', '👑', '🌟']

const TYPE_OPTIONS = [
  { value: 'draw_ticket', label: '抽卡次数（永久有效，不过期）' },
  { value: 'challenge_voucher', label: '挑战凭证' },
  { value: 'growth_accelerant', label: '成长加速剂' },
  { value: 'coupon', label: '特权券（需线下核销，暂未开放）' },
]

function emptyForm() {
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
    loading: true,
    errorMsg: '',
    items: [],

    showForm: false,
    editingId: '',      // 空 = 新增
    form: emptyForm(),
    saving: false,

    iconOptions: ICON_OPTIONS,
    typeOptions: TYPE_OPTIONS,
    typeIndex: 0,
  },

  onLoad() {
    this.loadItems()
  },

  onPullDownRefresh() {
    this.loadItems().then(() => wx.stopPullDownRefresh())
  },

  // ============ 加载 ============
  async loadItems() {
    const app = getApp()
    const teacherKey = app.globalData.teacherKey

    if (!teacherKey) {
      this.setData({
        loading: false,
        errorMsg: '未获取到教师密钥，请重新登录后再来',
      })
      return
    }

    this.setData({ loading: true, errorMsg: '' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageShop',
        data: { action: 'list', teacherKey },
      })
      const r = res.result || {}
      if (!r.success) {
        this.setData({ loading: false, errorMsg: r.error || '加载失败' })
        return
      }
      this.setData({ loading: false, items: r.items || [] })
    } catch (e) {
      console.error('加载商品失败:', e)
      this.setData({
        loading: false,
        errorMsg: '加载失败：' + (e.message || '网络异常，请下拉重试'),
      })
    }
  },

  // ============ 新增 / 编辑 ============
  openAdd() {
    this.setData({
      showForm: true,
      editingId: '',
      form: emptyForm(),
      typeIndex: 0,
    })
  },

  openEdit(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.items[index]
    if (!item) return

    const tIdx = TYPE_OPTIONS.findIndex((t) => t.value === item.type)
    this.setData({
      showForm: true,
      editingId: item._id,
      typeIndex: tIdx >= 0 ? tIdx : 0,
      form: {
        name: item.name || '',
        desc: item.desc || '',
        icon: item.icon || '🎁',
        type: item.type || 'draw_ticket',
        payload: String(item.payload || 1),
        price: String(item.price || ''),
        // 后端用 -1 表示库存不限、0 表示不限购，展示时空出来更友好
        stock: item.stock >= 0 ? String(item.stock) : '',
        limitPerUser: item.limitPerUser > 0 ? String(item.limitPerUser) : '',
        limitPerDay: item.limitPerDay > 0 ? String(item.limitPerDay) : '',
        status: item.status || 'on',
      },
    })
  },

  closeForm() {
    this.setData({ showForm: false, editingId: '', saving: false })
  },

  noop() {},

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  pickIcon(e) {
    this.setData({ 'form.icon': e.currentTarget.dataset.icon })
  },

  onTypeChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      typeIndex: idx,
      'form.type': TYPE_OPTIONS[idx].value,
    })
  },

  onStatusSwitch(e) {
    this.setData({ 'form.status': e.detail.value ? 'on' : 'off' })
  },

  // ============ 提交 ============
  submitForm() {
    if (this.data.saving) return

    const f = this.data.form
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
      settleType: 'burn',       // 本期全为虚拟商品，金币销毁
    }

    this.saveItem(data)
  },

  async saveItem(data) {
    const app = getApp()
    const teacherKey = app.globalData.teacherKey
    if (!teacherKey) {
      wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    const payloadData = {
      teacherKey,
      data,
    }
    if (this.data.editingId) {
      payloadData.action = 'update'
      payloadData.itemId = this.data.editingId
    } else {
      payloadData.action = 'add'
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageShop',
        data: payloadData,
      })
      const r = res.result || {}

      if (!r.success) {
        wx.showToast({ title: r.error || '保存失败', icon: 'none', duration: 2500 })
        this.setData({ saving: false })
        return
      }

      wx.showToast({ title: r.message || '已保存', icon: 'success' })
      this.setData({ showForm: false, editingId: '', saving: false })
      await this.loadItems()
    } catch (e) {
      console.error('保存商品失败:', e)
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  // ============ 上下架 ============
  async toggleStatus(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.items[index]
    if (!item) return

    const app = getApp()
    const teacherKey = app.globalData.teacherKey
    if (!teacherKey) {
      wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
      return
    }

    const nextStatus = item.status === 'off' ? 'on' : 'off'

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageShop',
        data: {
          action: 'update',
          teacherKey,
          itemId: item._id,
          data: { status: nextStatus },
        },
      })
      const r = res.result || {}
      if (!r.success) {
        wx.showToast({ title: r.error || '操作失败', icon: 'none', duration: 2500 })
        return
      }
      wx.showToast({ title: nextStatus === 'on' ? '已上架' : '已下架', icon: 'success' })
      await this.loadItems()
    } catch (err) {
      console.error('切换上下架失败:', err)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  // ============ 删除 ============
  removeItem(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.items[index]
    if (!item) return

    wx.showModal({
      title: '删除商品',
      content: `确定删除「${item.name}」吗？如果该商品已有学生购买，会改为下架而不是删除。`,
      confirmColor: '#dc2626',
      success: async (res) => {
        if (!res.confirm) return
        await this.doRemove(item._id)
      },
    })
  },

  async doRemove(itemId) {
    const app = getApp()
    const teacherKey = app.globalData.teacherKey
    if (!teacherKey) {
      wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
      return
    }

    wx.showLoading({ title: '处理中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageShop',
        data: { action: 'remove', teacherKey, itemId },
      })
      wx.hideLoading()
      const r = res.result || {}
      if (!r.success) {
        wx.showToast({ title: r.error || '删除失败', icon: 'none', duration: 2500 })
        return
      }
      wx.showToast({ title: r.message || '已删除', icon: 'success', duration: 2500 })
      await this.loadItems()
    } catch (err) {
      wx.hideLoading()
      console.error('删除商品失败:', err)
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  },
})
