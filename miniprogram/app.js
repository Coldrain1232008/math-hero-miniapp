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
  }
})
