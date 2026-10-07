// pages/login/login.js
const share = require('../../utils/share')

Page({
  // 分享：好友转发 + 朋友圈。微信要求两者成对定义，缺一则朋友圈入口不渲染。
  onShareAppMessage() { return share.appMessage('login') },
  onShareTimeline() { return share.timeline('login') },

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
    isSinglePage: false,    // 是否运行在朋友圈「单页模式」下
    // 邀请小程序码
    showQR: false,          // 是否显示小程序码弹窗
    qrFileID: '',           // 生成后的小程序码（cloud:// 路径，image 可直接渲染）
    qrLoading: false,       // 生成中
  },

  /**
   * 单页模式适配（朋友圈分享的落地页）
   *
   * 从朋友圈打开分享出去的小程序页面时，微信跑的不是完整小程序，而是
   * 「单页模式」，限制很硬：
   *   · 没有登录态，wx.login 等与登录相关的接口不可用
   *   · 不允许跳转到其它页面 —— 登录成功后 reLaunch 会失败，用户直接卡住
   *   · tabBar 不渲染，顶部固定导航栏、底部固定「前往小程序」操作栏
   *   · 页面内不能主动发起分享
   * 所以这个环境下渲染登录表单没有意义。改为展示静态介绍，
   * 让用户看完点微信自带的「前往小程序」进入完整版。
   *
   * 场景值 1154 = 从朋友圈打开的小程序页面。
   */
  onLoad() {
    let scene = 0
    try {
      const opt = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {}
      scene = (opt && opt.scene) || 0
    } catch (e) {
      console.warn('[login] 读取场景值失败', e)
    }

    const isSinglePage = scene === 1154
    if (isSinglePage) {
      console.log('[login] 单页模式（来自朋友圈），切换为介绍视图')
    } else {
      // 单页模式下不支持页面内发起分享，跳过
      share.enableShareMenu()
    }
    this.setData({ isSinglePage })
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

  // ========== 邀请小程序码 ==========

  /**
   * 打开小程序码弹窗。
   * 码由云函数 getShareCode 调用 wxacode.getUnlimited 生成后存进云存储，
   * 返回的是 cloud:// 路径，<image> 能直接渲染，不用换临时链接。
   * 因为路径固定，同一张码只会生成一次，之后再打开直接用缓存值。
   */
  async showQRCode() {
    this.setData({ showQR: true })
    if (this.data.qrFileID || this.data.qrLoading) return

    this.setData({ qrLoading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getShareCode' })
      const r = (res && res.result) || {}
      if (r.success) {
        this.setData({ qrFileID: r.fileID })
      } else {
        wx.showToast({ title: r.error || '生成失败', icon: 'none' })
      }
    } catch (e) {
      console.error('生成小程序码失败:', e)
      wx.showToast({
        title: '生成失败，请确认 getShareCode 云函数已上传',
        icon: 'none',
      })
    } finally {
      this.setData({ qrLoading: false })
    }
  },

  hideQRCode() {
    this.setData({ showQR: false })
  },

  // 保存小程序码到相册（方便发到教师群、印在讲义上）
  async saveQRCode() {
    const { qrFileID } = this.data
    if (!qrFileID) return

    wx.showLoading({ title: '保存中...' })
    try {
      const dl = await wx.cloud.downloadFile({ fileID: qrFileID })
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: dl.tempFilePath,
          success: resolve,
          fail: reject,
        })
      })
      wx.hideLoading()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      console.error('保存小程序码失败:', e)
      const msg = (e && e.errMsg) || ''
      if (/auth deny|authorize|permission/i.test(msg)) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在右上角「…」→ 设置里允许「保存到相册」后重试。',
          showCancel: false,
        })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }
  },

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
