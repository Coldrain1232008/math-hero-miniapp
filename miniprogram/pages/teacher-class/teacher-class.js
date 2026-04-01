// pages/teacher-class/teacher-class.js
const { calcLevel, calcAttributes, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()
const _ = db.command

const ATTR_COLORS = ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444']

Page({
  data: {
    students: [],
    classInfo: null,       // 班级信息（含密钥等）
    showAdd: false,
    nameInput: '',
    addLoading: false,
    // 任务确认
    showTaskConfirm: false,
    pendingTasks: [],
    pendingTaskCount: 0,
  },

  onLoad() {
    this.loadClassInfo()
    this.loadStudents()
    this.loadPendingTasks()
  },
  onShow() {
    this.loadClassInfo()
    this.loadStudents()
    this.loadPendingTasks()
  },

  // ========== 加载班级信息 ==========
  async loadClassInfo() {
    const app = getApp()
    try {
      const res = await db.collection('classes').doc(app.globalData.classId).get()
      this.setData({ classInfo: res.data })
    } catch (e) { console.error(e) }
  },

  // ========== 加载学生列表 ==========
  async loadStudents() {
    const app = getApp()
    try {
      const res = await db.collection('students')
        .where({ classId: app.globalData.classId })
        .orderBy('totalExp', 'desc')
        .get()

      const students = res.data.map(s => {
        const levelInfo = calcLevel(s.totalExp)
        const attrs = calcAttributes(s.talentId, levelInfo.level)
        const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
        const attrDisplay = ATTR_NAMES.map((name, i) => ({
          name, val: attrs[i], color: ATTR_COLORS[i],
        }))
        return { ...s, level: levelInfo.level, attrDisplay, avatarColor: avatarInfo.color, avatarIcon: avatarInfo.icon }
      })
      this.setData({ students })
    } catch (e) { console.error(e) }
  },

  // ========== 复制密钥到剪贴板 ==========
  copyText(e) {
    const { text, label } = e.currentTarget.dataset
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: `${label}已复制`, icon: 'success' })
      }
    })
  },

  // ========== 补发密钥（通过云函数为没有 studentKey 的旧学生自动生成） ==========
  async fixKeys() {
    const noKeyStudents = this.data.students.filter(s => !s.studentKey || s.studentKey === '')
    if (noKeyStudents.length === 0) {
      wx.showToast({ title: '所有学生都已有密钥', icon: 'none' })
      return
    }

    wx.showModal({
      title: '补发密钥',
      content: `发现 ${noKeyStudents.length} 名学生没有个人密钥，是否自动生成？`,
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '生成中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'fixStudentKeys',
            data: { classId: getApp().globalData.classId },
          })
          wx.hideLoading()
          if (result.result?.success) {
            const { count, total } = result.result
            wx.showToast({ title: count > 0 ? `已为 ${count}/${total} 人补发密钥` : '所有学生都已有密钥', icon: 'success' })
            this.loadStudents()
          } else {
            wx.showToast({ title: result.result?.message || '操作失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          console.error('补发密钥失败:', e)
          wx.showToast({ title: '操作失败，请重试', icon: 'none' })
        }
      }
    })
  },

  // ========== 导出密钥（复制全部学生密钥到剪贴板） ==========
  exportKeys() {
    const students = this.data.students
    if (students.length === 0) {
      wx.showToast({ title: '暂无学生', icon: 'none' })
      return
    }

    // 找出没有密钥的学生
    const noKey = students.filter(s => !s.studentKey || s.studentKey === '')
    if (noKey.length > 0) {
      wx.showModal({
        title: '提示',
        content: `有 ${noKey.length} 名学生还没有个人密钥，建议先补发。是否继续导出已有的密钥？`,
        success: (res) => {
          if (res.confirm) this._doExport(students)
        }
      })
      return
    }

    this._doExport(students)
  },

  _doExport(students) {
    const classInfo = this.data.classInfo
    let text = `【数学英雄 - ${classInfo?.name || '我的班级'}】\n`
    text += `班级密钥：${classInfo?.studentKey || '-'}\n`
    text += `\n--- 学生个人密钥 ---\n`
    text += `格式：学号 姓名 角色名 密钥\n\n`
    students.forEach(s => {
      const id = s.studentId || '-'
      const realName = s.realName || '-'
      const heroName = s.heroName || '未创建'
      const key = s.studentKey || '未生成'
      text += `${id} ${realName} ${heroName} ${key}\n`
    })

    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '密钥已复制到剪贴板', icon: 'success' })
      }
    })
  },

  // ========== 导入名单弹窗 ==========
  showAddDialog() { this.setData({ showAdd: true }) },
  hideAddDialog() { this.setData({ showAdd: false, nameInput: '' }) },
  onNameInput(e) { this.setData({ nameInput: e.detail.value }) },

  async importNames() {
    // 直接传递原始输入行，由云函数解析学号和姓名
    const lines = this.data.nameInput
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0)

    if (lines.length === 0) {
      wx.showToast({ title: '请输入学生信息', icon: 'none' })
      return
    }

    this.setData({ addLoading: true })
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'importStudents',
        data: { lines, classId: app.globalData.classId },
      })
      if (res.result?.success) {
        const results = res.result.results || []
        const newStudents = results.filter(r => r.status === 'created')
        const existStudents = results.filter(r => r.status === 'exists')
        let msg = ''
        if (newStudents.length > 0) msg += `新增 ${newStudents.length} 人`
        if (existStudents.length > 0) msg += (msg ? '，' : '') + `${existStudents.length} 人已存在`
        wx.showToast({ title: msg, icon: 'success' })
        this.hideAddDialog()
        this.loadStudents()
      } else {
        wx.showToast({ title: res.result?.message || '导入失败', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '导入失败', icon: 'none' })
    }
    this.setData({ addLoading: false })
  },

  // ========== 复制学生个人密钥 ==========
  copyKey(e) {
    const { key, name } = e.currentTarget.dataset
    wx.setClipboardData({
      data: key,
      success() {
        wx.showToast({ title: `${name} 的密钥已复制`, icon: 'success' })
      }
    })
  },

  // ========== 删除学生（踢出班级，保留数据） ==========
  removeStudent(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除学生',
      content: `确定将 ${name} 移出班级？\n\n该学生的数据会保留在数据库中，之后可重新分配到其他班级。`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        try {
          // 清空 classId，表示不在任何班级
          await db.collection('students').doc(id).update({
            data: { classId: '', updatedAt: db.serverDate() }
          })
          wx.showToast({ title: `已将 ${name} 移出班级`, icon: 'success' })
          this.loadStudents()
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  },

  // ========== 永久删除学生数据 ==========
  permanentDelete(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '永久删除',
      content: `确定永久删除 ${name} 的所有数据？\n\n此操作不可恢复！该学生的角色、经验、记录将全部清除。`,
      confirmColor: '#ef4444',
      confirmText: '永久删除',
      success: async (res) => {
        if (!res.confirm) return
        // 二次确认
        wx.showModal({
          title: '再次确认',
          content: `真的要永久删除 ${name} 吗？此操作绝对无法撤销！`,
          confirmColor: '#ef4444',
          confirmText: '确认删除',
          success: async (res2) => {
            if (!res2.confirm) return
            wx.showLoading({ title: '删除中...' })
            try {
              // 调用云函数删除（前端受数据库权限限制）
              const result = await wx.cloud.callFunction({
                name: 'deleteStudent',
                data: { studentId: id }
              })
              wx.hideLoading()
              if (result.result?.success) {
                wx.showToast({ title: `已永久删除 ${name}`, icon: 'success' })
                this.loadStudents()
              } else {
                wx.showToast({ title: result.result?.message || '删除失败', icon: 'none' })
              }
            } catch (e) {
              wx.hideLoading()
              console.error(e)
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          },
        })
      },
    })
  },

  // 阻止冒泡（用于弹窗内部点击）
  preventBubble() {
    // 什么都不做，只是阻止事件冒泡
  },

  // ========== 任务确认功能 ==========
  async loadPendingTasks() {
    const app = getApp()
    try {
      // 获取班级所有学生的待确认任务
      const studentRes = await db.collection('students')
        .where({ classId: app.globalData.classId })
        .get()
      
      const studentIds = studentRes.data.map(s => s._id)
      const studentMap = {}
      studentRes.data.forEach(s => {
        studentMap[s._id] = s
      })
      
      if (studentIds.length === 0) {
        this.setData({ pendingTasks: [], pendingTaskCount: 0 })
        return
      }
      
      const taskRes = await db.collection('dailyTasks')
        .where({
          studentId: db.command.in(studentIds),
          status: 'submitted'
        })
        .orderBy('submitTime', 'asc')
        .get()
      
      const pendingTasks = taskRes.data.map(task => {
        const student = studentMap[task.studentId] || {}
        return {
          ...task,
          studentName: student.realName || student.heroName || '未知',
          studentId: student.studentId || '',
          submitTimeStr: this._formatTime(task.submitTime)
        }
      })
      
      this.setData({ 
        pendingTasks, 
        pendingTaskCount: pendingTasks.length 
      })
    } catch (e) {
      console.error('加载待确认任务失败:', e)
    }
  },

  _formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
        wx.showToast({ title: res.result.error || '确认失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('确认任务失败:', e)
      wx.showToast({ title: '确认失败', icon: 'none' })
    }
  },

  async rejectTask(e) {
    const taskId = e.currentTarget.dataset.id
    wx.showModal({
      title: '驳回任务',
      content: '确定驳回该任务吗？学生可以重新完成并提交。',
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
            wx.showToast({ title: result.result.error || '驳回失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          console.error('驳回任务失败:', e)
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
        let failCount = 0
        
        for (const task of pendingTasks) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'confirmTask',
              data: { taskId: task._id, action: 'confirm' }
            })
            if (result.result && result.result.success) {
              successCount++
            } else {
              failCount++
            }
          } catch (e) {
            failCount++
          }
        }
        
        wx.hideLoading()
        wx.showToast({ 
          title: `成功 ${successCount} 个${failCount > 0 ? `，失败 ${failCount} 个` : ''}`, 
          icon: 'none' 
        })
        this.loadPendingTasks()
      }
    })
  },

  // ========== 赠送重置天赋机会 ==========
  async grantReroll(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '赠予重置机会',
      content: `确定给 ${name} +1 次重置天赋机会？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await db.collection('students').doc(id).update({
            data: { rerollChances: _.inc(1) },
          })
          wx.showToast({ title: `已给 ${name} +1 次机会`, icon: 'success' })
          this.loadStudents()
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  },
})
