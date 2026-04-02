// pages/teacher-task/teacher-task.js
const { calcLevel, ATTR_NAMES } = require('../../utils/gameData')

Page({
  data: {
    // tab切换
    currentTab: 0, // 0-特殊任务 1-普通任务池 2-待确认

    // 特殊任务
    specialTask: null,
    showSpecialEdit: false,
    specialForm: { title: '', desc: '', expReward: 20 },
    editingSpecialId: null,

    // 普通任务池
    builtinTasks: [],
    customTasks: [],
    showCustomEdit: false,
    customForm: { title: '', desc: '', category: 'common', categoryIndex: 6 },
    editingCustomId: null,

    // 待确认任务
    pendingTasks: [],
    showTaskConfirm: false,

    // 天赋分类选项
    categoryOptions: [
      { id: 'explorer', name: '探索者' },
      { id: 'forger', name: '铸造者' },
      { id: 'weaver', name: '编织者' },
      { id: 'guardian', name: '守护者' },
      { id: 'guide', name: '引导者' },
      { id: 'breaker', name: '突破者' },
      { id: 'common', name: '通用' },
    ],

    loading: false,
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateRole()
      this.getTabBar().setData({ selected: 2 }) // 教师tab（第3个）
    }
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    const classId = app.globalData.classId
    if (!classId) return

    this.setData({ loading: true })
    try {
      // 并行加载数据
      await Promise.all([
        this.loadSpecialTask(),
        this.loadTaskPool(),
        this.loadPendingTasks(),
      ])
    } catch (e) {
      console.error('加载数据失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // ========== 特殊任务 ==========
  async loadSpecialTask() {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageSpecialTask',
        data: { action: 'get', classId: app.globalData.classId }
      })
      if (res.result && res.result.success) {
        this.setData({ specialTask: res.result.task })
      }
    } catch (e) {
      console.error('加载特殊任务失败:', e)
    }
  },

  showAddSpecial() {
    this.setData({
      showSpecialEdit: true,
      editingSpecialId: null,
      specialForm: { title: '', desc: '', expReward: 20 }
    })
  },

  showEditSpecial() {
    const task = this.data.specialTask
    if (!task) return
    this.setData({
      showSpecialEdit: true,
      editingSpecialId: task._id,
      specialForm: {
        title: task.title,
        desc: task.desc,
        expReward: task.expReward || 20
      }
    })
  },

  hideSpecialEdit() {
    this.setData({ showSpecialEdit: false })
  },

  onSpecialTitleInput(e) {
    this.setData({ 'specialForm.title': e.detail.value })
  },

  onSpecialDescInput(e) {
    this.setData({ 'specialForm.desc': e.detail.value })
  },

  onSpecialRewardChange(e) {
    let value = e.detail.value
    // 移除前导0（除了单独一个0）
    if (value.length > 1 && value.startsWith('0')) {
      value = value.replace(/^0+/, '') || '0'
    }
    const num = parseInt(value) || 0
    this.setData({ 'specialForm.expReward': num })
  },

  async saveSpecial() {
    const { specialForm, editingSpecialId } = this.data
    if (!specialForm.title.trim() || !specialForm.desc.trim()) {
      wx.showToast({ title: '请填写完整', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const app = getApp()
      let res
      if (editingSpecialId) {
        // 修改
        res = await wx.cloud.callFunction({
          name: 'manageSpecialTask',
          data: {
            action: 'update',
            classId: app.globalData.classId,
            taskId: editingSpecialId,
            title: specialForm.title,
            desc: specialForm.desc,
            expReward: specialForm.expReward
          }
        })
      } else {
        // 发布新任务
        res = await wx.cloud.callFunction({
          name: 'manageSpecialTask',
          data: {
            action: 'publish',
            classId: app.globalData.classId,
            title: specialForm.title,
            desc: specialForm.desc,
            expReward: specialForm.expReward
          }
        })
      }

      wx.hideLoading()
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.hideSpecialEdit()
        this.loadSpecialTask()
      } else {
        wx.showToast({ title: res.result?.error || '保存失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('保存特殊任务失败:', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async deleteSpecial() {
    const task = this.data.specialTask
    if (!task) return

    wx.showModal({
      title: '删除特殊任务',
      content: '确定删除当前特殊任务吗？',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '删除中...' })
        try {
          const app = getApp()
          const result = await wx.cloud.callFunction({
            name: 'manageSpecialTask',
            data: {
              action: 'delete',
              classId: app.globalData.classId,
              taskId: task._id
            }
          })
          wx.hideLoading()
          if (result.result && result.result.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.setData({ specialTask: null })
          } else {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // ========== 普通任务池 ==========
  async loadTaskPool() {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageTaskPool',
        data: { action: 'getPool', classId: app.globalData.classId }
      })
      if (res.result && res.result.success) {
        this.setData({
          builtinTasks: res.result.builtinTasks,
          customTasks: res.result.customTasks || []
        })
      }
    } catch (e) {
      console.error('加载任务池失败:', e)
    }
  },

  showAddCustom() {
    this.setData({
      showCustomEdit: true,
      editingCustomId: null,
      customForm: { title: '', desc: '', category: 'common' }
    })
  },

  showEditCustom(e) {
    const { id } = e.currentTarget.dataset
    const task = this.data.customTasks.find(t => t._id === id)
    if (!task) return
    const categoryIndex = this.data.categoryOptions.findIndex(c => c.id === (task.category || 'common'))
    this.setData({
      showCustomEdit: true,
      editingCustomId: id,
      customForm: {
        title: task.title,
        desc: task.desc,
        category: task.category || 'common',
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 6
      }
    })
  },

  hideCustomEdit() {
    this.setData({ showCustomEdit: false })
  },

  onCustomTitleInput(e) {
    this.setData({ 'customForm.title': e.detail.value })
  },

  onCustomDescInput(e) {
    this.setData({ 'customForm.desc': e.detail.value })
  },

  onCustomCategoryChange(e) {
    const index = parseInt(e.detail.value)
    const category = this.data.categoryOptions[index].id
    this.setData({
      'customForm.category': category,
      'customForm.categoryIndex': index
    })
  },

  async saveCustom() {
    const { customForm, editingCustomId } = this.data
    if (!customForm.title.trim() || !customForm.desc.trim()) {
      wx.showToast({ title: '请填写完整', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const app = getApp()
      let res
      if (editingCustomId) {
        res = await wx.cloud.callFunction({
          name: 'manageTaskPool',
          data: {
            action: 'update',
            classId: app.globalData.classId,
            taskId: editingCustomId,
            title: customForm.title,
            desc: customForm.desc,
            category: customForm.category
          }
        })
      } else {
        res = await wx.cloud.callFunction({
          name: 'manageTaskPool',
          data: {
            action: 'add',
            classId: app.globalData.classId,
            title: customForm.title,
            desc: customForm.desc,
            category: customForm.category
          }
        })
      }

      wx.hideLoading()
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.hideCustomEdit()
        this.loadTaskPool()
      } else {
        wx.showToast({ title: res.result?.error || '保存失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('保存自定义任务失败:', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async deleteCustom(e) {
    const { id } = e.currentTarget.dataset

    wx.showModal({
      title: '删除任务',
      content: '确定删除这个自定义任务吗？',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '删除中...' })
        try {
          const app = getApp()
          const result = await wx.cloud.callFunction({
            name: 'manageTaskPool',
            data: {
              action: 'delete',
              classId: app.globalData.classId,
              taskId: id
            }
          })
          wx.hideLoading()
          if (result.result && result.result.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadTaskPool()
          } else {
            wx.showToast({ title: result.result?.error || '删除失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // ========== 待确认任务 ==========
  async loadPendingTasks() {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPendingTasks',
        data: { classId: app.globalData.classId }
      })
      if (res.result && res.result.success) {
        this.setData({
          pendingTasks: res.result.pendingTasks || []
        })
      }
    } catch (e) {
      console.error('加载待确认任务失败:', e)
    }
  },

  showTaskDialog() {
    this.loadPendingTasks()
    this.setData({ showTaskConfirm: true })
  },

  hideTaskDialog() {
    this.setData({ showTaskConfirm: false })
  },

  async confirmTask(e) {
    const taskId = e.currentTarget.dataset.id
    wx.showLoading({ title: '确认中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'confirmTask',
        data: { taskId, action: 'confirm' }
      })
      wx.hideLoading()
      if (res.result && res.result.success) {
        wx.showToast({ title: '已确认', icon: 'success' })
        this.loadPendingTasks()
      } else {
        wx.showToast({ title: res.result?.error || '确认失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '确认失败', icon: 'none' })
    }
  },

  async rejectTask(e) {
    const taskId = e.currentTarget.dataset.id
    wx.showModal({
      title: '驳回任务',
      content: '确定驳回该任务吗？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '驳回中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'confirmTask',
            data: { taskId, action: 'reject' }
          })
          wx.hideLoading()
          if (result.result && result.result.success) {
            wx.showToast({ title: '已驳回', icon: 'success' })
            this.loadPendingTasks()
          } else {
            wx.showToast({ title: '驳回失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '驳回失败', icon: 'none' })
        }
      }
    })
  },

  async confirmAllTasks() {
    const { pendingTasks } = this.data
    if (pendingTasks.length === 0) return

    wx.showModal({
      title: '一键确认',
      content: `确定确认全部 ${pendingTasks.length} 个任务吗？`,
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '确认中...' })

        let successCount = 0
        for (const task of pendingTasks) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'confirmTask',
              data: { taskId: task._id, action: 'confirm' }
            })
            if (result.result && result.result.success) {
              successCount++
            }
          } catch (e) {}
        }

        wx.hideLoading()
        wx.showToast({
          title: `成功 ${successCount} 个`,
          icon: 'none'
        })
        this.loadPendingTasks()
      }
    })
  },

  // ========== Tab切换 ==========
  switchTab(e) {
    const { index } = e.currentTarget.dataset
    this.setData({ currentTab: index })
  },

  // 阻止冒泡
  preventBubble() {},
})
