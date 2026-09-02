// cloudfunctions/importStudents/index.js
// 老师批量导入学生名单（支持 学号,姓名 或 学号 姓名 或 姓名 格式）
//
// ⚠️ 鉴权（2026-09-02 补）：本函数会往指定班级写学生数据，此前完全无鉴权，
//    任何拿到 classId 的人都能直接调云函数往任意班级批量塞学生。
//    现在改为：凭 teacherKey 由服务端反查 classId，不信任前端传参。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 鉴权：verifyTeacher 用 teacherKey 反查 classId（不信任前端传的 classId）
// auth.js 由 tools/sync-auth.js 从 tools/auth-template.js 同步，勿直接修改
const { verifyTeacher, normalizeKey } = require('./auth')

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
  const { lines } = event

  // ===== 鉴权第一道：教师密钥 =====
  // classId 一律由服务端用 teacherKey 反查，绝不用前端传的 event.classId
  // （前端的 classId 是可伪造值，用它等于没鉴权）
  const classDoc = await verifyTeacher(event.teacherKey)
  if (!classDoc.ok) {
    return { success: false, message: classDoc.error }
  }
  const classId = classDoc.classId

  if (!lines || lines.length === 0) return { success: false, message: '没有数据' }

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

      // 口令统一归一化（trim + 大写）后再落库/查重。
      // 不归一化的话，教师填 abc123 而库里已有 ABC123 时查重查不到，
      // 会再建一条小写口令的学生 → 学生登录双查命中两条，行为不确定。
      if (studentKey) {
        studentKey = normalizeKey(studentKey)
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
        const keyConflict = await db.collection('students')   // auth-ok: studentKey 已归一化
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
          const dup = await db.collection('students')         // auth-ok: 同左，值已归一化
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
          // dailyDrawLeft 是历史遗留字段（drawGacha 实际读的是 remainingDraws），保留不动
          dailyDrawLeft: 3,
          lastDrawDate: '',
          remainingDraws: 3,      // 每日免费 3 次，跨日重置
          bonusDraws: 0,          // 商城购买的抽卡次数，不清零（优先消耗）
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
