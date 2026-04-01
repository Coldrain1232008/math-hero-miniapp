// pages/teacher-class/teacher-class.js
const { calcLevel, calcAttributes, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()
const _ = db.command

const ATTR_COLORS = ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444']

function genKey(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let key = ''
  for (let i = 0; i < len; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

Page({
  data: {
    students: [],
    classInfo: null,       // 班级信息（含密钥等）
    showAdd: false,
    nameInput: '',
    addLoading: false,
  },

  onLoad() {
    this.loadClassInfo()
    this.loadStudents()
  },
  onShow() {
    this.loadClassInfo()
    this.loadStudents()
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

  // ========== 补发密钥（为没有 studentKey 的旧学生自动生成） ==========
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
        let successCount = 0
        for (const s of noKeyStudents) {
          try {
            const newKey = genKey(6)
            await db.collection('students').doc(s._id).update({
              data: { studentKey: newKey, updatedAt: db.serverDate() }
            })
            successCount++
          } catch (e) {
            console.error(`补发密钥失败: ${s._id}`, e)
          }
        }
        wx.hideLoading()
        wx.showToast({ title: `已为 ${successCount} 人补发密钥`, icon: 'success' })
        this.loadStudents()
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
    students.forEach(s => {
      text += `${s.heroName || '-'}：${s.studentKey || '未生成'}\n`
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
    const names = this.data.nameInput
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0)

    if (names.length === 0) {
      wx.showToast({ title: '请输入名字', icon: 'none' })
      return
    }

    this.setData({ addLoading: true })
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'importStudents',
        data: { names, classId: app.globalData.classId },
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
            try {
              // 删除学生记录
              await db.collection('students').doc(id).remove()
              // 删除该学生的经验日志
              const logs = await db.collection('expLogs')
                .where({ studentId: id })
                .limit(100)
                .get()
              for (const log of logs.data) {
                await db.collection('expLogs').doc(log._id).remove()
              }
              wx.showToast({ title: `已永久删除 ${name}`, icon: 'success' })
              this.loadStudents()
            } catch (e) {
              console.error(e)
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          },
        })
      },
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
