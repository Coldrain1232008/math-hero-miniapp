// pages/teacher-upload/teacher-upload.js
const { calcScoreExpCustom } = require('../../utils/gameData')

// 递减规则选项
const DECAY_RULES = [
  { id: 'linear', name: '线性递减', desc: '第1名到末名均匀递减' },
  { id: 'exponential', name: '指数递减', desc: '前几名差距大，后面差距小' },
  { id: 'logarithmic', name: '对数递减', desc: '前几名差距小，后面差距大' },
  { id: 'normal', name: '正态递减', desc: '中间名次变化平缓，两端变化大' },
]

Page({
  data: {
    fileName: '',
    preview: [],
    matchedCount: 0,
    unmatchedCount: 0,
    unmatchedList: [],
    importing: false,
    _parsedData: [],   // [{studentId, name, score}]
    _students: [],     // 数据库学生列表
    
    // 经验值规则配置
    showRuleConfig: false,
    decayRules: DECAY_RULES,
    selectedRule: 'linear',
    selectedRuleName: '线性递减',
    maxExp: 150,
    minExp: 50,
  },

  onLoad() {
    this.loadStudents()
  },

  async loadStudents() {
    const app = getApp()
    try {
      const res = await wx.cloud.callFunction({
        name: 'getClassData',
        data: { classId: app.globalData.classId, action: 'students' }
      })
      if (res.result && res.result.success) {
        this.data._students = res.result.students
      }
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

      if (res.result && res.result.success && res.result.data) {
        this._buildPreview(res.result.data)
        // 显示格式检测提示
        if (res.result.format) {
          const fmt = res.result.format
          const msg = fmt.hasId 
            ? `检测到「${fmt.idColumn} | ${fmt.nameColumn} | ${fmt.scoreColumn}」格式` 
            : `检测到「${fmt.nameColumn} | ${fmt.scoreColumn}」格式`
          wx.showToast({ title: msg, icon: 'none', duration: 2000 })
        }
        // 显示解析错误
        if (res.result.errors && res.result.errors.length > 0) {
          const errMsg = res.result.errors.slice(0, 3).map(e => `第${e.row}行：${e.reason}`).join('\n')
          const more = res.result.errors.length > 3 ? `\n...还有${res.result.errors.length - 3}条错误` : ''
          wx.showModal({
            title: '部分数据解析失败',
            content: errMsg + more,
            showCancel: false
          })
        }
      } else {
        wx.showToast({ title: res.result?.message || '解析失败，请检查格式', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '解析出错', icon: 'none' })
    }
    wx.hideLoading()
  },

  // 显示/隐藏规则配置
  showRuleDialog() { this.setData({ showRuleConfig: true }) },
  hideRuleDialog() { this.setData({ showRuleConfig: false }) },
  
  // 选择递减规则
  selectRule(e) {
    const rule = e.currentTarget.dataset.rule
    const ruleName = DECAY_RULES.find(r => r.id === rule)?.name || '线性递减'
    this.setData({ selectedRule: rule, selectedRuleName: ruleName })
    // 重新计算预览
    if (this.data._parsedData.length > 0) {
      this._buildPreview(this.data._parsedData)
    }
  },
  
  // 修改最大/最小经验值
  onMaxExpInput(e) {
    const val = parseInt(e.detail.value) || 0
    this.setData({ maxExp: Math.max(val, this.data.minExp + 10) })
    if (this.data._parsedData.length > 0) {
      this._buildPreview(this.data._parsedData)
    }
  },
  onMinExpInput(e) {
    const val = parseInt(e.detail.value) || 0
    this.setData({ minExp: Math.min(val, this.data.maxExp - 10) })
    if (this.data._parsedData.length > 0) {
      this._buildPreview(this.data._parsedData)
    }
  },

  // 构建预览匹配
  _buildPreview(parsedData) {
    // parsedData: [{studentId, name, score}, ...]，按分数降序排列
    const sorted = [...parsedData].sort((a, b) => b.score - a.score)
    const total = sorted.length
    const students = this.data._students
    const { maxExp, minExp, selectedRule } = this.data

    const preview = sorted.map((row, i) => {
      const rank = i + 1
      const exp = calcScoreExpCustom(rank, total, maxExp, minExp, selectedRule)
      
      // 优先按学号匹配，其次按姓名匹配
      let matched = null
      if (row.studentId) {
        matched = students.find(s => s.studentId === row.studentId)
      }
      if (!matched && row.name) {
        matched = students.find(s => s.realName === row.name || s.heroName === row.name)
      }
      
      return {
        studentId: row.studentId || '',
        name: row.name,
        score: row.score,
        rank,
        exp,
        matched: !!matched,
        studentDocId: matched?._id,
        matchBy: matched ? (row.studentId && matched.studentId === row.studentId ? 'id' : 'name') : null,
      }
    })

    const matchedCount = preview.filter(p => p.matched).length
    const unmatchedCount = preview.length - matchedCount
    const unmatchedList = preview.filter(p => !p.matched).map(p => 
      p.studentId ? `${p.studentId} ${p.name}` : p.name
    )
    
    this.setData({ 
      preview, 
      matchedCount, 
      unmatchedCount,
      unmatchedList 
    })
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
            studentId: p.studentDocId,
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

  // 阻止冒泡（用于弹窗内部点击）
  preventBubble() {
    // 什么都不做，只是阻止事件冒泡
  },
})
