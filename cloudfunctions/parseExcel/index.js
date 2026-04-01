// cloudfunctions/parseExcel/index.js
// 解析上传的 Excel 文件，提取姓名和分数
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

    // 跳过表头，解析数据行
    const data = []
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const name = String(row[0] || '').trim()
      const score = parseFloat(row[1])
      if (name && !isNaN(score)) {
        data.push({ name, score })
      }
    }

    return { success: true, data }
  } catch (e) {
    console.error(e)
    return { success: false, message: e.message }
  }
}
