// pages/login/login.js
Page({
  data: {
    classKey: '',       // 学生登录用：班级密钥
    studentKey: '',     // 学生登录用：个人密钥
    secretKey: '',      // 教师登录用：教师密钥
    role: 'student',
    loading: false,
  },

  setStudent() { this.setData({ role: 'student' }) },
  setTeacher() { this.setData({ role: 'teacher' }) },
  onKeyInput(e) { this.setData({ secretKey: e.detail.value }) },
  onClassKeyInput(e) { this.setData({ classKey: e.detail.value }) },
  onStudentKeyInput(e) { this.setData({ studentKey: e.detail.value }) },

  async onLogin() {
    const { classKey, studentKey, secretKey, role } = this.data
    this.setData({ loading: true })
    try {
      if (role === 'teacher') {
        await this._teacherLogin(secretKey)
      } else {
        await this._studentLogin(classKey, studentKey)
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  // 教师登录
  async _teacherLogin(key) {
    if (!key.trim()) {
      wx.showToast({ title: '请输入教师密钥', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '登录中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { action: 'teacherLogin', teacherKey: key }
      })
      
      wx.hideLoading()
      
      if (res.result && res.result.success) {
        const classInfo = res.result.classInfo
        const app = getApp()
        app.globalData.isTeacher = true
        app.globalData.classId = classInfo._id
        app.globalData.className = classInfo.name
        wx.reLaunch({ url: '/pages/teacher/teacher' })
      } else {
        wx.showToast({ title: res.result?.error || '登录失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error(e)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  // 学生登录：用班级密钥 + 个人密钥
  async _studentLogin(classKey, stuKey) {
    if (!classKey.trim()) {
      wx.showToast({ title: '请输入班级密钥', icon: 'none' })
      return
    }
    if (!stuKey.trim()) {
      wx.showToast({ title: '请输入个人密钥', icon: 'none' })
      return
    }

    wx.showLoading({ title: '登录中...' })
    try {
      // 调用登录云函数（云函数内部会自动获取 openid）
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {
          action: 'studentLogin',
          classKey,
          studentKey: stuKey
        }
      })

      wx.hideLoading()

      if (res.result && res.result.success) {
        const { classInfo, student } = res.result
        const app = getApp()
        app.globalData.isTeacher = false
        app.globalData.classId = classInfo._id
        app.globalData.className = classInfo.name
        app.globalData.studentInfo = student

        // 判断是否已创建角色
        if (student.talentId && student.talentId !== '') {
          // 已有完整角色 -> 直接到角色页
          wx.reLaunch({ url: '/pages/character/character' })
        } else {
          // 预导入但未创建角色 -> 去创建角色页
          wx.reLaunch({ url: '/pages/create-character/create-character' })
        }
      } else {
        wx.showToast({ title: res.result?.error || '登录失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error(e)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },
})
