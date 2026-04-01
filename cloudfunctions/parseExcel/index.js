// cloudfunctions/parseExcel/index.js
// 解析上传的 Excel 文件，提取学号、姓名和分数
// 支持格式：
//   三列：学号 | 姓名 | 分数
//   两列：姓名 | 分数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { fileID } = event
  try {
    // 下载文件
    const res = await cloud.downloadFile({ fileID })
    const buffer = res.fileContent

    // 使用 xlsx 解析
    const XLSX = require('xlsx')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (rows.length < 2) {
      return { success: false, message: 'Excel文件为空或缺少数据行' }
    }

    // 分析表头确定列格式
    const header = rows[0].map(h => String(h).trim())
    const headerLower = header.map(h => h.toLowerCase())
    
    // 检测列索引
    let idIndex = -1, nameIndex = -1, scoreIndex = -1
    
    // 尝试识别学号列（学号、id、编号、序号、学籍号等）
    const idKeywords = ['学号', 'id', '编号', '序号', '学籍号', '学生号', 'no', 'number']
    for (let i = 0; i < headerLower.length; i++) {
      if (idKeywords.some(k => headerLower[i].includes(k))) {
        idIndex = i
        break
      }
    }
    
    // 尝试识别姓名列
    const nameKeywords = ['姓名', '名字', 'name', '学生', '学生姓名']
    for (let i = 0; i < headerLower.length; i++) {
      if (nameKeywords.some(k => headerLower[i].includes(k))) {
        nameIndex = i
        break
      }
    }
    
    // 尝试识别分数列
    const scoreKeywords = ['分数', '成绩', 'score', '分', '得分', '考试', '测试']
    for (let i = 0; i < headerLower.length; i++) {
      if (scoreKeywords.some(k => headerLower[i].includes(k))) {
        scoreIndex = i
        break
      }
    }
    
    // 如果无法识别表头，使用默认列位置
    // 三列默认：学号(0) | 姓名(1) | 分数(2)
    // 两列默认：姓名(0) | 分数(1)
    const colCount = rows[1] ? rows[1].length : 0
    
    // 只有在未识别到对应列时才使用默认值
    if (scoreIndex === -1) {
      scoreIndex = colCount >= 3 ? 2 : 1  // 三列格式分数在第3列，两列格式在第2列
    }
    if (nameIndex === -1) {
      nameIndex = colCount >= 3 ? 1 : 0   // 三列格式姓名在第2列，两列格式在第1列
    }
    if (idIndex === -1 && colCount >= 3) {
      idIndex = 0  // 三列格式学号在第1列
    }

    // 跳过表头，解析数据行
    const data = []
    const errors = []
    
    // 调试日志
    console.log('表头识别结果:', { idIndex, nameIndex, scoreIndex, header })
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue
      
      // 跳过空行（所有单元格都为空）
      const isEmptyRow = row.every(cell => !cell || String(cell).trim() === '')
      if (isEmptyRow) continue
      
      const studentId = idIndex >= 0 ? String(row[idIndex] || '').trim() : ''
      const name = nameIndex >= 0 ? String(row[nameIndex] || '').trim() : ''
      const scoreValue = scoreIndex >= 0 ? row[scoreIndex] : null
      const score = parseFloat(scoreValue)
      
      console.log(`第${i+1}行:`, { studentId, name, scoreValue, score, row })
      
      // 验证数据
      if (!name && !studentId) {
        errors.push({ row: i + 1, reason: '缺少姓名和学号' })
        continue
      }
      if (isNaN(score)) {
        errors.push({ row: i + 1, name: name || studentId, reason: `分数格式错误: ${scoreValue}` })
        continue
      }
      if (score < 0 || score > 1000) {
        errors.push({ row: i + 1, name: name || studentId, reason: '分数超出合理范围(0-1000)' })
        continue
      }
      
      data.push({ studentId: studentId || null, name, score })
    }

    return { 
      success: true, 
      data,
      format: {
        hasId: idIndex >= 0,
        idColumn: idIndex >= 0 ? header[idIndex] || '学号' : null,
        nameColumn: header[nameIndex] || '姓名',
        scoreColumn: header[scoreIndex] || '分数'
      },
      errors: errors.length > 0 ? errors : null
    }
  } catch (e) {
    console.error(e)
    return { success: false, message: e.message }
  }
}
