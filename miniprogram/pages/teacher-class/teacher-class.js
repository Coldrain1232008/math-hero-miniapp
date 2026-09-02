// pages/teacher-class/teacher-class.js
const { calcLevel, calcAttributes, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')

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
    // 修改密钥弹窗
    showKeyEdit: false,
    keyEditType: '',        // 'teacherKey' | 'studentKey'
    keyEditOldValue: '',
    keyEditValue: '',
    keyCheckStatus: '',     // '' | 'checking' | 'ok' | 'bad' | 'same'
    keyCheckMsg: '',
    keyUpdating: false,
    // 删除班级
    showDeleteClass: false,
    deleteConfirmName: '',
    deleteNameMatched: false,
    deleting: false,
  },

  // ========== 修改班级密钥 / 教师密钥 ==========
  openKeyEdit(e) {
    const type = e.currentTarget.dataset.type
    const classInfo = this.data.classInfo || {}
    this.setData({
      showKeyEdit: true,
      keyEditType: type,
      keyEditOldValue: classInfo[type] || '',
      keyEditValue: '',
      keyCheckStatus: '',
      keyCheckMsg: '',
      keyUpdating: false,
    })
  },

  closeKeyEdit() {
    this.setData({
      showKeyEdit: false,
      keyEditValue: '',
      keyCheckStatus: '',
      keyCheckMsg: '',
      keyUpdating: false,
    })
    if (this._keyCheckTimer) {
      clearTimeout(this._keyCheckTimer)
      this._keyCheckTimer = null
    }
  },

  // 输入时本地先做格式校验，通过后再防抖调用云函数查重
  onKeyEditInput(e) {
    // 输入即归一化：去空格 + 转大写
    // 云函数写入前也会这样做（normalizeKey），这里同步处理，
    // 保证"输入框里看到的" === "数据库里存的" === "登录时要输的"
    const raw = (e.detail.value || '').replace(/\s/g, '').toUpperCase()
    this.setData({ keyEditValue: raw })

    if (this._keyCheckTimer) {
      clearTimeout(this._keyCheckTimer)
      this._keyCheckTimer = null
    }

    if (!raw) {
      this.setData({ keyCheckStatus: '', keyCheckMsg: '' })
      return
    }

    if (!/^[A-Z0-9]{4,12}$/.test(raw)) {
      this.setData({
        keyCheckStatus: 'bad',
        keyCheckMsg: '需为 4-12 位字母或数字（空格已自动去除）',
      })
      return
    }

    // 与原值相同无需查重
    if (raw.toUpperCase() === (this.data.keyEditOldValue || '').toUpperCase()) {
      this.setData({ keyCheckStatus: 'same', keyCheckMsg: '与原密钥相同' })
      return
    }

    this.setData({ keyCheckStatus: 'checking', keyCheckMsg: '正在检查是否可用...' })
    const value = raw
    this._keyCheckTimer = setTimeout(() => {
      this.checkKeyAvailable(value)
    }, 500)
  },

  async checkKeyAvailable(value) {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateClassKeys',
        data: {
          action: 'check',
          classId: app.globalData.classId,
          type: this.data.keyEditType,
          newKey: value,
        }
      })
      const r = res.result || {}
      // 云函数里与原值相同会返回 unchanged，这里单独提示
      if (r.success && r.unchanged) {
        this.setData({ keyCheckStatus: 'same', keyCheckMsg: '与原密钥相同' })
      } else if (r.success) {
        this.setData({ keyCheckStatus: 'ok', keyCheckMsg: '可以使用' })
      } else {
        this.setData({
          keyCheckStatus: 'bad',
          keyCheckMsg: r.error || '该密钥不可用',
        })
      }
    } catch (err) {
      console.error('查重失败:', err)
      this.setData({ keyCheckStatus: 'bad', keyCheckMsg: '校验失败，请检查网络后重试' })
    }
  },

  async saveKeyEdit() {
    const { keyEditType, keyEditValue, keyCheckStatus } = this.data
    // 粘贴等情况可能绕过输入监听，这里再归一化一次，确保与云函数规则一致
    const value = (keyEditValue || '').replace(/\s/g, '').toUpperCase()

    if (!value) {
      wx.showToast({ title: '请输入新密钥', icon: 'none' })
      return
    }
    if (keyCheckStatus === 'bad') {
      wx.showToast({ title: '当前密钥不可用', icon: 'none' })
      return
    }
    if (keyCheckStatus === 'same') {
      this.closeKeyEdit()
      return
    }

    // 还没查重过（例如粘贴后直接点保存），先查一次
    if (keyCheckStatus !== 'ok') {
      this.setData({ keyCheckStatus: 'checking', keyCheckMsg: '正在检查是否可用...' })
      await this.checkKeyAvailable(value)
      if (this.data.keyCheckStatus === 'bad') return
      if (this.data.keyCheckStatus === 'same') { this.closeKeyEdit(); return }
    }

    const label = keyEditType === 'teacherKey' ? '教师密钥' : '班级密钥'
    wx.showModal({
      title: `确认修改${label}？`,
      content: `新${label}：${value}\n\n请照此大写形式使用，登录时输入大小写均可。\n\n修改后旧的${label}立即失效，请第一时间通知学生。`,
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ keyUpdating: true })
        wx.showLoading({ title: '保存中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'updateClassKeys',
            data: {
              action: 'update',
              classId: getApp().globalData.classId,
              type: keyEditType,
              newKey: value,
            }
          })
          wx.hideLoading()
          const r = result.result || {}
          if (r.success) {
            wx.showToast({ title: r.unchanged ? '密钥未变化' : `${label}已更新`, icon: 'success' })
            this.closeKeyEdit()
            await this.loadClassInfo()
          } else {
            wx.showToast({ title: r.error || '修改失败', icon: 'none' })
            this.setData({
              keyCheckStatus: 'bad',
              keyCheckMsg: r.error || '修改失败',
            })
          }
        } catch (err) {
          wx.hideLoading()
          console.error('修改密钥失败:', err)
          wx.showToast({ title: '修改失败，请重试', icon: 'none' })
        }
        this.setData({ keyUpdating: false })
      }
    })
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
      const res = await wx.cloud.callFunction({
        name: 'getClassData',
        data: { classId: app.globalData.classId, action: 'classInfo' }
      })
      if (res.result && res.result.success) {
        this.setData({ classInfo: res.result.classInfo })
      }
    } catch (e) { console.error(e) }
  },

  // ========== 加载学生列表 ==========
  async loadStudents() {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'getClassData',
        data: { classId: app.globalData.classId, action: 'students' }
      })

      if (res.result && res.result.success) {
        const students = res.result.students.map(s => {
          const levelInfo = calcLevel(s.totalExp)
          const attrs = calcAttributes(s.talentId, levelInfo.level, s.growthMultiplier || 1.0)
          const avatarInfo = AvatarManager.getAvatarById(s.avatar) || AvatarManager.getRandomAvatar()
          const attrDisplay = ATTR_NAMES.map((name, i) => ({
            name, val: attrs[i], color: ATTR_COLORS[i],
          }))
          return { ...s, level: levelInfo.level, attrDisplay, avatarColor: avatarInfo.color, avatarIcon: avatarInfo.icon }
        })
        this.setData({ students })
      }
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

    // 服务端要用 teacherKey 反查 classId（不信任前端传的 classId）
    // 缺失说明是旧登录态，重新登录一次即可补上
    if (!app.globalData.teacherKey) {
      this.setData({ addLoading: false })
      wx.showModal({
        title: '需要重新登录',
        content: '登录信息已过期，请退出后重新登录再导入。',
        showCancel: false,
      })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'importStudents',
        data: { lines, teacherKey: app.globalData.teacherKey },
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
        wx.showLoading({ title: '操作中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'updateStudent',
            data: { action: 'removeFromClass', studentId: id }
          })
          wx.hideLoading()
          if (result.result && result.result.success) {
            wx.showToast({ title: `已将 ${name} 移出班级`, icon: 'success' })
            this.loadStudents()
          } else {
            wx.showToast({ title: result.result?.error || '操作失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
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

  // ========== 删除班级（危险操作） ==========
  openDeleteClass() {
    if (!this.data.classInfo) {
      wx.showToast({ title: '班级信息未加载完成', icon: 'none' })
      return
    }
    this.setData({
      showDeleteClass: true,
      deleteConfirmName: '',
      deleteNameMatched: false,
      deleting: false,
    })
  },

  closeDeleteClass() {
    if (this.data.deleting) return // 删除进行中不允许关闭
    this.setData({
      showDeleteClass: false,
      deleteConfirmName: '',
      deleteNameMatched: false,
      deleting: false,
    })
  },

  onDeleteNameInput(e) {
    const v = (e.detail.value || '').trim()
    const target = ((this.data.classInfo && this.data.classInfo.name) || '').trim()
    this.setData({
      deleteConfirmName: v,
      deleteNameMatched: !!target && v === target,
    })
  },

  confirmDeleteClass() {
    const { classInfo, deleteNameMatched, students, deleting } = this.data
    if (deleting) return

    if (students.length > 0) {
      wx.showToast({ title: `还有 ${students.length} 名学生未删除`, icon: 'none' })
      return
    }
    if (!deleteNameMatched) {
      wx.showToast({ title: '班级名称不一致', icon: 'none' })
      return
    }

    const className = (classInfo && classInfo.name) || '该班级'
    wx.showModal({
      title: '最后确认',
      content: `即将永久删除「${className}」及其全部数据。\n\n此操作无法撤销，确定继续吗？`,
      confirmColor: '#ef4444',
      confirmText: '永久删除',
      success: (r) => {
        if (r.confirm) this.doDeleteClass()
      },
    })
  },

  async doDeleteClass() {
    const app = getApp()
    const classInfo = this.data.classInfo || {}

    this.setData({ deleting: true })
    wx.showLoading({ title: '正在清除数据...', mask: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteClass',
        data: {
          classId: app.globalData.classId,
          teacherKey: classInfo.teacherKey || '',
          confirmName: (this.data.deleteConfirmName || '').trim(),
        },
      })
      wx.hideLoading()
      const r = res.result || {}

      if (r.success) {
        // 清理本地登录态，避免停留在已不存在的班级
        app.globalData.classId = null
        app.globalData.className = null
        app.globalData.isTeacher = false
        app.globalData.studentInfo = null

        this.setData({ showDeleteClass: false, deleting: false })

        wx.showModal({
          title: '删除完成',
          content: r.message || '班级已永久删除',
          showCancel: false,
          confirmText: '返回登录',
          success: () => {
            wx.reLaunch({ url: '/pages/login/login' })
          },
        })
      } else {
        this.setData({ deleting: false })
        wx.showModal({
          title: '无法删除',
          content: r.error || '删除失败，请重试',
          showCancel: false,
        })
        // 若是因为还有学生，顺手刷新一下列表，保证数量是最新的
        if (r.needRemoveStudents) this.loadStudents()
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ deleting: false })
      console.error('[deleteClass] 调用失败:', e)
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  },

  // 阻止冒泡（用于弹窗内部点击）
  preventBubble() {
    // 什么都不做，只是阻止事件冒泡
  },

  // ========== 任务确认功能 ==========
  async loadPendingTasks() {
    const app = getApp()
    try {
      // 使用云函数查询待确认任务（避免前端权限问题）
      const res = await wx.cloud.callFunction({
        name: 'getPendingTasks',
        data: { classId: app.globalData.classId }
      })
      
      if (res.result && res.result.success) {
        this.setData({ 
          pendingTasks: res.result.pendingTasks || [], 
          pendingTaskCount: res.result.count || 0 
        })
      } else {
        console.error('加载待确认任务失败:', res.result?.error)
        this.setData({ pendingTasks: [], pendingTaskCount: 0 })
      }
    } catch (e) {
      console.error('加载待确认任务失败:', e)
      this.setData({ pendingTasks: [], pendingTaskCount: 0 })
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
      // 调试：打印完整返回，方便排查抽卡次数是否增加
      console.error('【confirmTask 云函数返回】', JSON.stringify(res.result, null, 2))
      if (res.result && res.result.success) {
        const remaining = res.result.remainingDraws ?? 3
        const bonus = Math.max(0, remaining - 3)
        const taskType = res.result.expReward >= 30 ? '(特殊)' : '(普通)'
        const msg = bonus > 0
          ? `已确认 ${taskType}，今日奖励+${bonus}次`
          : `已确认 ${taskType}`
        wx.showToast({ title: msg, icon: 'success' })
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
        wx.showLoading({ title: '操作中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'updateStudent',
            data: { action: 'grantReroll', studentId: id }
          })
          wx.hideLoading()
          if (result.result && result.result.success) {
            wx.showToast({ title: `已给 ${name} +1 次机会`, icon: 'success' })
            this.loadStudents()
          } else {
            wx.showToast({ title: result.result?.error || '操作失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  },
})
