// pages/teacher-task/teacher-task.js
const { calcLevel, ATTR_NAMES } = require('../../utils/gameData')

Page({
  data: {
    // Tab切换
    currentTab: 0, // 0-特殊任务 1-普通任务池 2-学生任务

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

    // 学生任务
    studentList: [],
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
    // onShow 时不重新加载全部数据，只刷新当前 tab
    // 如果需要刷新，可以在对应 tab 下拉刷新
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadData() {
    const app = getApp()
    const classId = app.globalData.classId
    
    this.setData({ loading: true })
    
    if (!classId) {
      this.setData({ loading: false })
      return
    }

    // 分别加载，每个函数内部处理自己的错误
    await this.loadSpecialTask()
    await this.loadTaskPool()
    await this.loadStudentTasks()
    
    this.setData({ loading: false })
  },

  // ========== 特殊任务 ==========
  async loadSpecialTask() {
    const app = getApp()
    try {
      console.log('加载特殊任务, classId:', app.globalData.classId)
      const res = await wx.cloud.callFunction({
        name: 'manageSpecialTask',
        data: { action: 'get', classId: app.globalData.classId }
      })
      console.log('特殊任务返回:', res.result)
      if (res.result && res.result.success) {
        this.setData({ specialTask: res.result.task || null })
      } else {
        this.setData({ specialTask: null })
      }
    } catch (e) {
      console.error('加载特殊任务失败:', e)
      this.setData({ specialTask: null })
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
      console.log('加载任务池, classId:', app.globalData.classId)
      const res = await wx.cloud.callFunction({
        name: 'manageTaskPool',
        data: { action: 'getPool', classId: app.globalData.classId }
      })
      console.log('任务池返回:', res.result)
      if (res.result && res.result.success) {
        this.setData({
          builtinTasks: res.result.builtinTasks || [],
          customTasks: res.result.customTasks || []
        })
      } else {
        // 云函数返回失败，显示空列表
        console.warn('任务池加载失败')
        this.setData({ builtinTasks: [], customTasks: [] })
      }
    } catch (e) {
      console.error('加载任务池失败:', e)
      this.setData({ builtinTasks: [], customTasks: [] })
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

  // ========== 学生任务 ==========
  async loadStudentTasks() {
    const app = getApp()
    try {
      console.log('加载学生任务, classId:', app.globalData.classId)
      const res = await wx.cloud.callFunction({
        name: 'getStudentTasksStatus',
        data: { classId: app.globalData.classId }
      })
      console.log('学生任务返回:', res.result)
      if (res.result && res.result.success) {
        this.setData({ studentList: res.result.students || [] })
      } else {
        this.setData({ studentList: [] })
      }
    } catch (e) {
      console.error('加载学生任务失败:', e)
      this.setData({ studentList: [] })
    }
  },

  // ========== Tab切换 ==========
  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({ currentTab: index })
  },

  // ========== 任务重置 ==========
  async resetAllTasks() {
    const app = getApp()
    if (!app.globalData.classId) return

    wx.showModal({
      title: '重置全班任务',
      content: '确定重置全班学生的今日任务吗？学生可以重新获取任务。',
      confirmColor: '#f97316',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '重置中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'resetTaskProgress',
            data: { classId: app.globalData.classId }
          })
          wx.hideLoading()
          
          if (result.result && result.result.success) {
            wx.showToast({ 
              title: result.result.message || '已重置', 
              icon: 'success' 
            })
            this.loadStudentTasks()
          } else {
            wx.showToast({ 
              title: result.result?.error || '重置失败', 
              icon: 'none' 
            })
          }
        } catch (e) {
          wx.hideLoading()
          console.error('重置任务失败:', e)
          wx.showToast({ title: '重置失败', icon: 'none' })
        }
      }
    })
  },

  async resetStudentTask(e) {
    const studentId = e.currentTarget.dataset.studentid
    const studentName = e.currentTarget.dataset.name || '该学生'

    wx.showModal({
      title: '重置学生任务',
      content: `确定重置 ${studentName} 的今日任务吗？`,
      confirmColor: '#f97316',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '重置中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'resetTaskProgress',
            data: { studentId }
          })
          wx.hideLoading()
          
          if (result.result && result.result.success) {
            wx.showToast({ 
              title: '已重置', 
              icon: 'success' 
            })
            this.loadStudentTasks()
          } else {
            wx.showToast({ 
              title: result.result?.error || '重置失败', 
              icon: 'none' 
            })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '重置失败', icon: 'none' })
        }
      }
    })
  },

  // 阻止冒泡
  preventBubble() {},
})
