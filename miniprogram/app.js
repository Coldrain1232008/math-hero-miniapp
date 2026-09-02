// app.js
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-3g0pzu4pe8d12b17', // ⚠️ 重要：这不是 AppID！请在微信云开发控制台 → 设置 → 环境ID 获取
        traceUser: true,
      })
    }
    this.globalData = {}
  },
  globalData: {
    userInfo: null,
    studentInfo: null,
    isTeacher: false,
  },

  /**
   * 调用需要教师鉴权的云函数
   *
   * 背景（2026-09-02 安全审计）：
   *   一批云函数原本直接收前端传的 classId，而 classId 是可伪造值
   *   （globalData 里就有，改个参数就能跨班写数据）。现统一改为：
   *   云函数凭 teacherKey 由服务端反查 classId，前端一律改传 teacherKey。
   *
   * 用法（替换原来的 wx.cloud.callFunction）：
   *   const res = await app.callTeacherFn('coinOperation', { action, studentIds, amount })
   *
   * @param {string} name 云函数名
   * @param {object} data 业务参数（不要带 classId，服务端自己反查）
   * @returns {Promise<object>} callFunction 的原始返回
   * @throws {Error} teacherKey 缺失时抛错，调用方用 try/catch 兜住
   */
  callTeacherFn(name, data = {}) {
    const teacherKey = this.globalData.teacherKey
    if (!teacherKey) {
      wx.showModal({
        title: '需要重新登录',
        content: '登录信息已过期，请退出后重新登录。',
        showCancel: false,
      })
      return Promise.reject(new Error('缺少 teacherKey，请重新登录'))
    }
    return wx.cloud.callFunction({
      name,
      data: { ...data, teacherKey },
    })
  },
})
