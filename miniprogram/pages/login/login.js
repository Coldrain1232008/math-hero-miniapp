// pages/login/login.js
Page({
  data: {
    classKey: '',       // 学生登录用：班级密钥
    studentKey: '',     // 学生登录用：个人密钥
    secretKey: '',      // 教师登录用：教师密钥
    role: 'student',
    loading: false,
    // 注册新班级
    showRegister: false,    // 是否显示注册弹窗
    registerName: '',       // 输入的班级名称
    inviteKey: '',          // 邀请口令（已存在班级的密钥）
    registering: false,     // 提交中
    createdClass: null,     // 创建成功后的班级信息（含双密钥）
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
        // 保存教师密钥：商城管理（manageShop）靠它在服务端鉴权。
        // ⚠️ 不能只用 classId 鉴权 —— 那是从前端传的，任何人都能伪造。
        //    密钥只存在内存与服务端，小程序包被反编译也拿不到。
        app.globalData.teacherKey = key
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

  // ========== super 管理员后台 ==========

  // 长按 Logo 进入（隐藏入口，学生不易误触）
  // ⚠️ 入口隐藏只是防误触，不是安全边界。
  //    真正的鉴权在云函数 superAdmin 的 verifySuper 里做服务端校验。
  goSuper() {
    wx.vibrateShort({ type: 'light', fail: () => {} })
    wx.navigateTo({ url: '/pages/super/super' })
  },

  // ========== 注册新班级 ==========

  // 打开注册弹窗
  showRegisterDialog() {
    this.setData({
      showRegister: true,
      registerName: '',
      inviteKey: '',
      createdClass: null
    })
  },

  // 关闭注册弹窗
  hideRegisterDialog() {
    this.setData({ showRegister: false })
  },

  // 阻止冒泡
  preventBubble() {},

  // 输入班级名称
  onRegisterNameInput(e) {
    this.setData({ registerName: e.detail.value })
  },

  // 输入邀请口令
  onInviteKeyInput(e) {
    this.setData({ inviteKey: e.detail.value })
  },

  // 提交创建班级
  async submitRegister() {
    const { registerName, inviteKey, registering } = this.data
    const name = (registerName || '').trim()

    if (!name) {
      wx.showToast({ title: '请输入班级名称', icon: 'none' })
      return
    }
    if (!(inviteKey || '').trim()) {
      wx.showToast({ title: '请输入邀请口令', icon: 'none' })
      return
    }
    if (registering) return

    this.setData({ registering: true })
    wx.showLoading({ title: '创建中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'createClass',
        data: { className: name, inviteKey: inviteKey.trim() }
      })
      wx.hideLoading()

      if (res.result && res.result.success) {
        this.setData({ createdClass: res.result.classInfo, registerName: '' })
        if (res.result.nameDuplicated) {
          wx.showToast({ title: '已存在同名班级，请核对', icon: 'none' })
        } else {
          wx.showToast({ title: '创建成功', icon: 'success' })
        }
      } else {
        wx.showToast({ title: res.result?.error || '创建失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('注册班级失败:', e)
      wx.showToast({ title: '创建失败，请检查云函数是否已上传', icon: 'none' })
    } finally {
      this.setData({ registering: false })
    }
  },

  // 复制密钥
  copyKey(e) {
    const { text, label } = e.currentTarget.dataset
    if (!text) return
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: `${label}已复制`, icon: 'none' })
      }
    })
  },

  // 用新班级的教师密钥直接进入教师端
  async enterNewClass() {
    const cls = this.data.createdClass
    if (!cls) return
    this.setData({ showRegister: false })
    await this._teacherLogin(cls.teacherKey)
  },
})
