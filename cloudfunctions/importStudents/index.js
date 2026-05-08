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
// "20240101 张三 ABC123" -> {studentId: '20240101', realName: '张三', studentKey: 'ABC123'}
// "20240101 张三" -> {studentId: '20240101', realName: '张三', studentKey: null}
// "20240101,张三,ABC123" -> {studentId: '20240101', realName: '张三', studentKey: 'ABC123'}
// "20240101,张三" -> {studentId: '20240101', realName: '张三', studentKey: null}
// "张三" -> {studentId: null, realName: '张三', studentKey: null}
function parseStudentLine(line) {
  line = line.trim()
  if (!line) return null

  // 按逗号或空格/制表符分割（支持中英文逗号）
  const parts = line.split(/[,，\t ]+/).filter(p => p.length > 0)

  if (parts.length >= 3) {
    // 学号 姓名 口令
    const idMatch = parts[0].match(/^\d+$/)
    if (idMatch) {
      return { studentId: parts[0], realName: parts[1], studentKey: parts[2] }
    }
  }

  if (parts.length >= 2) {
    // 学号 姓名（或 姓名 口令）
    const idMatch = parts[0].match(/^\d+$/)
    if (idMatch) {
      return { studentId: parts[0], realName: parts[1], studentKey: null }
    }
  }

  // 只有姓名
  return { studentId: null, realName: parts[0], studentKey: null }
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

      let { studentId, realName, studentKey } = parsed

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

      // 如果指定了口令，检查班级内是否已有其他学生使用
      if (studentKey) {
        const keyConflict = await db.collection('students')
          .where({ classId, studentKey })
          .get()
        if (keyConflict.data.length > 0) {
          results.push({
            studentId,
            realName,
            key: studentKey,
            status: 'error',
            message: '口令已被其他学生使用'
          })
          continue
        }
      }

      // 如果未指定口令，随机生成（确保不重复）
      if (!studentKey) {
        let attempts = 0
        do {
          studentKey = genKey(6)
          const dup = await db.collection('students')
            .where({ classId, studentKey })
            .get()
          if (dup.data.length === 0) break
          attempts++
        } while (attempts < 10)
      }
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
