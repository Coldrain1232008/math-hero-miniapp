// cloudfunctions/importStudents/index.js
// 老师批量导入学生名单（支持 学号,姓名 或 学号 姓名 或 姓名 格式）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function genKey(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let key = ''
  for (let i = 0; i < len; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

// 解析输入行，支持多种格式：
// "20240101 张三" -> {studentId: '20240101', realName: '张三'}
// "20240101,张三" -> {studentId: '20240101', realName: '张三'}
// "20240101, 张三" -> {studentId: '20240101', realName: '张三'}
// "张三" -> {studentId: null, realName: '张三'}（无学号时自动生成）
function parseStudentLine(line) {
  line = line.trim()
  if (!line) return null

  // 尝试匹配 学号,姓名 或 学号 姓名 格式
  // 学号通常是数字
  const match = line.match(/^(\d+)[,，\s]+(.+)$/)
  if (match) {
    return {
      studentId: match[1].trim(),
      realName: match[2].trim()
    }
  }

  // 只有姓名，没有学号
  return {
    studentId: null,
    realName: line
  }
}

// 生成唯一学号（当用户未提供时）
function generateStudentId(classId, index) {
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase()
  const idx = String(index + 1).padStart(3, '0')
  return `AUTO${timestamp}${idx}`
}

exports.main = async (event) => {
  const { lines, classId } = event
  if (!lines || lines.length === 0) return { success: false, message: '没有数据' }
  if (!classId) return { success: false, message: '缺少 classId' }

  try {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const parsed = parseStudentLine(lines[i])
      if (!parsed) continue

      let { studentId, realName } = parsed

      // 如果没有提供学号，自动生成
      if (!studentId) {
        studentId = generateStudentId(classId, i)
      }

      // 检查该学号是否已存在（同一班级内）
      const exist = await db.collection('students')
        .where({ classId, studentId })
        .get()

      if (exist.data.length > 0) {
        results.push({
          studentId,
          realName,
          key: exist.data[0].studentKey,
          status: 'exists',
          message: '学号已存在'
        })
        continue
      }

      const studentKey = genKey(6)
      await db.collection('students').add({
        data: {
          classId,
          studentId,                // 学号（唯一标识，不可修改）
          realName,                 // 真实姓名（不可修改）
          heroName: '',             // 角色名（学生创建角色后设置）
          studentKey,               // 学生登录密钥
          openid: '',               // 待学生首次登录后绑定
          avatar: 'A1',
          gender: 'male',
          talentId: '',             // 待学生完成创建角色流程后赋值
          talentName: '未觉醒',
          talentCategory: '',
          talentColor: '#999',
          totalExp: 0,
          level: 1,
          rerollChances: 0,
          // 抽卡系统初始化
          dailyDrawLeft: 3,
          lastDrawDate: '',
          challengeVouchers: 0,
          growthAccelerants: 0,
          attributeGrowthBonus: [0, 0, 0, 0, 0, 0],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      })

      results.push({
        studentId,
        realName,
        key: studentKey,
        status: 'created'
      })
    }

    return { success: true, results }
  } catch (e) {
    console.error(e)
    return { success: false, message: e.message }
  }
}
