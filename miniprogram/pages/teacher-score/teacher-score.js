// pages/teacher-score/teacher-score.js
const { calcLevel } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')

Page({
  data: {
    allStudents: [],
    filteredList: [],
    keyword: '',
    selected: [],        // 已选学生id数组
    selectedMap: {},     // {id: true} 快速查找
    loadingMap: {},      // 单个按钮loading
    submitting: false,
    // 金币模式
    mode: 'exp',         // 'exp' | 'coin'
    wallet: null,        // { balance, totalGranted, totalRecycled }
    coinAmount: '5',     // 本次发放/扣除金额
  },

  // options.mode === 'coin' 时直接进入发金币模式（教师台「金币管理」入口）
  onLoad(options) {
    if (options && options.mode === 'coin') {
      this.setData({ mode: 'coin' }, () => { this.loadWallet() })
    }
    this.loadStudents()
  },

  onShow() {
    if (this.data.mode === 'coin') this.loadWallet()
  },

  // 切换模式
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.mode) return
    this.setData({ mode, selected: [], selectedMap: {} })
    if (mode === 'coin') this.loadWallet()
  },

  // 加载班级钱包
  async loadWallet() {
    const app = getApp()
    try {
      const res = await app.callTeacherFn('coinOperation', { action: 'query' })
      if (res.result && res.result.success) {
        this.setData({ wallet: res.result.wallet })
      }
    } catch (e) {
      console.error('加载钱包失败:', e)
    }
  },

  onCoinAmountInput(e) {
    const val = (e.detail.value || '').replace(/[^\d]/g, '')
    this.setData({ coinAmount: val })
  },

  setQuickAmount(e) {
    this.setData({ coinAmount: String(e.currentTarget.dataset.amount) })
  },

  // 列表右侧按钮：按模式分发
  onItemAction(e) {
    if (this.data.mode === 'coin') return this.grantSingle(e)
    return this.addSingle(e)
  },

  async loadStudents() {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'getClassData',
        data: { classId: app.globalData.classId, action: 'studentsByName' }
      })
      if (res.result && res.result.success) {
        const students = res.result.students.map(s => {
          const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
          return {
            ...s,
            level: calcLevel(s.totalExp).level,
            avatarColor: avatarInfo.color,
            avatarIcon: avatarInfo.icon,
          }
        })
        this.setData({ allStudents: students, filteredList: students })
      }
    } catch (e) { console.error(e) }
  },

  onSearch(e) {
    const kw = e.detail.value.trim()
    const filtered = kw
      ? this.data.allStudents.filter(s => s.heroName.includes(kw))
      : this.data.allStudents
    this.setData({ keyword: kw, filteredList: filtered })
  },

  toggleSelect(e) {
    const id = e.currentTarget.dataset.id
    const { selectedMap, selected } = this.data
    const newMap = { ...selectedMap }
    let newSelected = [...selected]
    if (newMap[id]) {
      delete newMap[id]
      newSelected = newSelected.filter(s => s !== id)
    } else {
      newMap[id] = true
      newSelected.push(id)
    }
    this.setData({ selectedMap: newMap, selected: newSelected })
  },

  clearSelect() {
    this.setData({ selected: [], selectedMap: {} })
  },

  // 单个 +1
  async addSingle(e) {
    const { id, name } = e.currentTarget.dataset
    const loadingMap = { ...this.data.loadingMap, [id]: true }
    this.setData({ loadingMap })
    await this._addExp([id], `课堂加分 · ${name}`)
    const newMap = { ...this.data.loadingMap }
    delete newMap[id]
    this.setData({ loadingMap: newMap })
    wx.showToast({ title: `+1 EXP · ${name}`, icon: 'success' })
    this.loadStudents()
  },

  // 批量 +1
  async batchAddExp() {
    if (this.data.submitting || this.data.selected.length === 0) return
    this.setData({ submitting: true })
    const names = this.data.selected
      .map(id => this.data.allStudents.find(s => s._id === id)?.heroName)
      .filter(Boolean)
      .join('、')
    await this._addExp(this.data.selected, `课堂批量加分 · ${names.substring(0, 20)}`)
    this.setData({ submitting: false, selected: [], selectedMap: {} })
    wx.showToast({ title: `已为 ${this.data.selected.length} 人 +1 EXP`, icon: 'success' })
    this.loadStudents()
  },

  async _addExp(studentIds, desc) {
    const app = getApp()
    try {
      await app.callTeacherFn('addExp', {
        studentIds,
        exp: 1,
        type: 'class',
        desc,
      })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // ============ 金币操作 ============

  // 单人发放
  async grantSingle(e) {
    const { id, name } = e.currentTarget.dataset
    if (this.data.submitting) return
    this.setData({ submitting: true })
    const result = await this._doCoin('grant', [id])
    this.setData({ submitting: false })
    if (result) this._handleCoinResult(result, 'grant', 1, name)
    this.loadStudents()
    this.loadWallet()
  },

  // 批量发放
  async batchGrantCoins() {
    if (this.data.submitting || this.data.selected.length === 0) return
    this.setData({ submitting: true })
    const count = this.data.selected.length
    const result = await this._doCoin('grant', this.data.selected)
    this.setData({ submitting: false })
    if (result) {
      this._handleCoinResult(result, 'grant', count)
      this.setData({ selected: [], selectedMap: {} })
    }
    this.loadStudents()
    this.loadWallet()
  },

  // 批量扣除
  async batchDeductCoins() {
    if (this.data.submitting || this.data.selected.length === 0) return
    this.setData({ submitting: true })
    const count = this.data.selected.length
    const result = await this._doCoin('deduct', this.data.selected)
    this.setData({ submitting: false })
    if (result) {
      this._handleCoinResult(result, 'deduct', count)
      this.setData({ selected: [], selectedMap: {} })
    }
    this.loadStudents()
    this.loadWallet()
  },

  // 调用云函数执行金币变动
  async _doCoin(action, studentIds) {
    const app = getApp()
    const amount = parseInt(this.data.coinAmount, 10)

    if (!amount || amount < 1 || amount > 999) {
      wx.showToast({ title: '金额需为 1-999 的整数', icon: 'none' })
      return null
    }
    if (!studentIds || studentIds.length === 0) {
      wx.showToast({ title: '请先选择学生', icon: 'none' })
      return null
    }

    try {
      const res = await app.callTeacherFn('coinOperation', {
        action,
        studentIds,
        amount,
        reason: action === 'grant' ? '课堂奖励' : '教师回收',
        operatorName: '教师',
      })
      return res.result
    } catch (e) {
      console.error('金币操作失败:', e)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
      return null
    }
  },

  // 统一处理结果提示
  _handleCoinResult(result, action, count, singleName) {
    const verb = action === 'grant' ? '发放' : '扣除'

    if (!result.success) {
      // 钱包余额不足是最常见也最需要明确指引的失败
      if (result.needRecharge) {
        wx.showModal({
          title: '钱包余额不足',
          content: result.error || '班级钱包余额不足，请联系管理员分配额度',
          showCancel: false,
        })
      } else {
        wx.showToast({ title: result.error || `${verb}失败`, icon: 'none', duration: 2500 })
      }
      return
    }

    const amount = parseInt(this.data.coinAmount, 10)
    if (result.failCount > 0) {
      // 部分成功
      const firstErr = (result.failures && result.failures[0] && result.failures[0].error) || '未知原因'
      wx.showModal({
        title: `部分${verb}成功`,
        content: `成功 ${result.successCount} 人，失败 ${result.failCount} 人\n首个失败原因：${firstErr}`,
        showCancel: false,
      })
    } else {
      wx.showToast({
        title: singleName
          ? `${verb} ${amount} 金币 · ${singleName}`
          : `已为 ${count} 人${verb} ${amount} 金币`,
        icon: 'success',
        duration: 2000,
      })
    }
  },
})
