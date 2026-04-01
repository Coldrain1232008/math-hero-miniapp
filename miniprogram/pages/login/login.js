// pages/login/login.js
const db = wx.cloud.database()

Page({
  data: {
    secretKey: '',
    role: 'student',
    loading: false,
  },

  setStudent() { this.setData({ role: 'student' }) },
  setTeacher() { this.setData({ role: 'teacher' }) },
  onKeyInput(e) { this.setData({ secretKey: e.detail.value }) },

  async onLogin() {
    const { secretKey, role } = this.data
    if (!secretKey.trim()) {
      wx.showToast({ title: '请输入密钥', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      if (role === 'teacher') {
        // 教师登录：用教师密钥查找班级
        const res = await db.collection('classes').where({ teacherKey: secretKey }).get()
        if (res.data.length === 0) {
          wx.showToast({ title: '教师密钥不正确', icon: 'none' })
          this.setData({ loading: false })
          return
        }
        const classInfo = res.data[0]
        const app = getApp()
        app.globalData.isTeacher = true
        app.globalData.classId = classInfo._id
        app.globalData.className = classInfo.name
        wx.reLaunch({ url: '/pages/teacher/teacher' })
      } else {
        // 学生登录：用班级密钥查找
        const res = await db.collection('classes').where({ studentKey: secretKey }).get()
        if (res.data.length === 0) {
          wx.showToast({ title: '密钥不正确', icon: 'none' })
          this.setData({ loading: false })
          return
        }
        const classInfo = res.data[0]
        const app = getApp()
        app.globalData.isTeacher = false
        app.globalData.classId = classInfo._id
        app.globalData.className = classInfo.name

        // 通过云函数获取 openid（更可靠）
        let openid = ''
        try {
          const loginRes = await wx.cloud.callFunction({ name: 'createStudent', data: { _action: 'getOpenId' } })
          openid = loginRes.result?.openid || ''
        } catch (e) {
          console.warn('获取 openid 失败，尝试备用方案', e)
        }

        // 查找是否已有角色
        const studentRes = await db.collection('students').where({
          classId: classInfo._id,
          openid: openid,
        }).get()

        if (studentRes.data.length > 0 && studentRes.data[0].talentId) {
          // 已有完整角色
          app.globalData.studentInfo = studentRes.data[0]
          wx.reLaunch({ url: '/pages/character/character' })
        } else if (studentRes.data.length > 0) {
          // 有占位记录但未创建角色（老师预导入的）
          app.globalData.studentInfo = studentRes.data[0]
          wx.reLaunch({ url: '/pages/create-character/create-character' })
        } else {
          // 全新学生
          wx.reLaunch({ url: '/pages/create-character/create-character' })
        }
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    this.setData({ loading: false })
  },
})
