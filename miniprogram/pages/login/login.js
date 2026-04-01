// pages/login/login.js
const db = wx.cloud.database()

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
    const res = await db.collection('classes').where({ teacherKey: key }).get()
    if (res.data.length === 0) {
      wx.showToast({ title: '教师密钥不正确', icon: 'none' })
      return
    }
    const classInfo = res.data[0]
    const app = getApp()
    app.globalData.isTeacher = true
    app.globalData.classId = classInfo._id
    app.globalData.className = classInfo.name
    wx.reLaunch({ url: '/pages/teacher/teacher' })
  },

  // 学生登录：用班级密钥 + 个人密钥
  async _studentLogin(classKey, stuKey) {
    if (!classKey.trim()) {
      wx.showToast({ title: '请输入班级密钥', icon: 'none' })
      return
    }

    // 1. 先用班级密钥找到班级
    const classRes = await db.collection('classes').where({ studentKey: classKey }).get()
    if (classRes.length === 0) {
      wx.showToast({ title: '班级密钥不正确', icon: 'none' })
      return
    }
    const classInfo = classRes.data[0]
    const app = getApp()
    app.globalData.isTeacher = false
    app.globalData.classId = classInfo._id
    app.globalData.className = classInfo.name

    // 2. 用个人密钥查找学生
    if (!stuKey.trim()) {
      wx.showToast({ title: '请输入个人密钥', icon: 'none' })
      return
    }

    const studentRes = await db.collection('students').where({
      classId: classInfo._id,
      studentKey: stuKey,
    }).get()

    if (studentRes.data.length === 0) {
      wx.showToast({ title: '个人密钥不正确', icon: 'none' })
      return
    }

    const student = studentRes.data[0]

    // 3. 获取当前 openid 并绑定到学生记录（首次登录绑定）
    if (!student.openid) {
      try {
        const loginRes = await wx.cloud.callFunction({ name: 'createStudent', data: { _action: 'getOpenId' } })
        const openid = loginRes.result?.openid || ''
        if (openid) {
          await db.collection('students').doc(student._id).update({
            data: { openid }
          })
          student.openid = openid
        }
      } catch (e) {
        console.warn('绑定 openid 失败', e)
      }
    }

    app.globalData.studentInfo = student

    // 4. 判断是否已创建角色
    if (student.talentId && student.talentId !== '') {
      // 已有完整角色 -> 直接到角色页
      wx.reLaunch({ url: '/pages/character/character' })
    } else {
      // 预导入但未创建角色 -> 去创建角色页
      wx.reLaunch({ url: '/pages/create-character/create-character' })
    }
  },
})
