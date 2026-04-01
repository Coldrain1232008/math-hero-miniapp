// pages/teacher-upload/teacher-upload.js
const { calcScoreExp } = require('../../utils/gameData')
const db = wx.cloud.database()

Page({
  data: {
    fileName: '',
    preview: [],
    matchedCount: 0,
    importing: false,
    _parsedData: [],   // [{name, score}]
    _students: [],     // 数据库学生列表
  },

  onLoad() {
    this.loadStudents()
  },

  async loadStudents() {
    const app = getApp()
    try {
      const res = await db.collection('students')
        .where({ classId: app.globalData.classId })
        .get()
      this.data._students = res.data
    } catch (e) { console.error(e) }
  },

  // 选取 Excel 文件并解析
  pickFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: (res) => {
        const file = res.tempFiles[0]
        this.setData({ fileName: file.name })
        this._parseExcel(file.path)
      },
      fail: () => {
        // 部分设备不支持，换成chooseMedia
        wx.showToast({ title: '请从聊天文件选取', icon: 'none' })
      },
    })
  },

  // 解析 Excel（调用云函数）
  async _parseExcel(filePath) {
    wx.showLoading({ title: '解析中...' })
    try {
      // 先上传到云存储
      const cloudPath = `excel/${Date.now()}.xlsx`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath })

      // 调用云函数解析
      const res = await wx.cloud.callFunction({
        name: 'parseExcel',
        data: { fileID: uploadRes.fileID },
      })

      if (res.result && res.result.data) {
        this._buildPreview(res.result.data)
      } else {
        wx.showToast({ title: '解析失败，请检查格式', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '解析出错', icon: 'none' })
    }
    wx.hideLoading()
  },

  // 构建预览匹配
  _buildPreview(parsedData) {
    // parsedData: [{name, score}, ...]，按分数降序排列
    const sorted = [...parsedData].sort((a, b) => b.score - a.score)
    const total = sorted.length
    const students = this.data._students

    const preview = sorted.map((row, i) => {
      const rank = i + 1
      const exp = calcScoreExp(rank, total)
      // 模糊匹配学生（姓名包含）
      const matched = students.find(s => s.heroName === row.name || s.realName === row.name)
      return {
        name: row.name,
        score: row.score,
        rank,
        exp,
        matched: !!matched,
        studentId: matched?._id,
      }
    })

    const matchedCount = preview.filter(p => p.matched).length
    this.setData({ preview, matchedCount })
    this.data._parsedData = parsedData
  },

  // 确认导入
  async confirmImport() {
    if (this.data.importing) return
    this.setData({ importing: true })
    const app = getApp()
    const toImport = this.data.preview.filter(p => p.matched)

    try {
      await wx.cloud.callFunction({
        name: 'addExp',
        data: {
          batchList: toImport.map(p => ({
            studentId: p.studentId,
            exp: p.exp,
          })),
          type: 'score',
          desc: `导入成绩 · ${this.data.fileName}`,
          classId: app.globalData.classId,
        },
      })

      wx.showModal({
        title: '导入成功',
        content: `成功为 ${toImport.length} 位同学发放经验值！`,
        showCancel: false,
        success: () => wx.navigateBack(),
      })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '导入失败', icon: 'none' })
    }
    this.setData({ importing: false })
  },
})
