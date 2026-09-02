// 云函数：createClass
// 创建新班级，自动生成教师密钥和班级密钥
//
// 安全机制（2026-09-01 新增）：注册新班级时必须提供「邀请口令」
//   —— 口令为任意一个已存在班级的教师密钥或班级密钥，验证通过才允许创建
// 冷启动例外：classes 集合为空时（全系统第一个班）免邀请口令，否则无人能开第一个班

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 生成随机密钥（剔除易混淆字符 I O 0 1）
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genKey(len) {
  let key = ''
  for (let i = 0; i < len; i++) {
    key += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return key
}

// 生成全局唯一密钥：前缀 + 5 位随机码，最多重试 20 次
async function genUniqueKey(prefix, field) {
  for (let i = 0; i < 20; i++) {
    const key = prefix + genKey(5)
    const res = await db.collection('classes').where({ [field]: key }).count()
    if (res.total === 0) return key
  }
  throw new Error('密钥生成失败，请重试')
}

exports.main = async (event, context) => {
  const { className, inviteKey } = event

  if (!className || !className.trim()) {
    return { success: false, error: '请输入班级名称' }
  }

  const name = className.trim()

  try {
    // 1. 判断是否为全系统第一个班级（冷启动免邀请）
    const totalRes = await db.collection('classes').count()
    const isFirstClass = totalRes.total === 0

    // 2. 邀请口令校验
    let invitedBy = null
    let inviterName = null

    if (!isFirstClass) {
      const key = (inviteKey || '').trim().toUpperCase()

      if (!key) {
        return { success: false, error: '请输入邀请口令', needInviteKey: true }
      }

      // 口令可以是任一班级的教师密钥，或任一班级的班级密钥
      let inviteClass = null
      const byTeacher = await db.collection('classes')
        .where({ teacherKey: key })
        .limit(1)
        .get()
      if (byTeacher.data.length > 0) {
        inviteClass = byTeacher.data[0]
      } else {
        const byStudent = await db.collection('classes')
          .where({ studentKey: key })
          .limit(1)
          .get()
        if (byStudent.data.length > 0) inviteClass = byStudent.data[0]
      }

      if (!inviteClass) {
        return { success: false, error: '邀请口令无效，请向已在使用本小程序的老师索取' }
      }

      invitedBy = inviteClass._id
      inviterName = inviteClass.name
    }

    // 3. 班级名是否重复（仅提示，不阻断——同名班级允许存在）
    const dupName = await db.collection('classes').where({ name }).count()

    // 4. 生成双密钥：教师密钥 T 开头，班级密钥 S 开头
    const teacherKey = await genUniqueKey('T', 'teacherKey')
    const studentKey = await genUniqueKey('S', 'studentKey')

    const addRes = await db.collection('classes').add({
      data: {
        name,
        teacherKey,
        studentKey,
        createdAt: new Date(),
        invitedBy,        // 邀请来源班级 _id（第一个班为 null）
        inviterName,      // 邀请来源班级名，方便追溯
        keyUpdatedAt: null
      }
    })

    console.log('createClass success:', name, addRes._id, 'invitedBy:', invitedBy)

    return {
      success: true,
      isFirstClass,
      nameDuplicated: dupName.total > 0,
      classInfo: {
        _id: addRes._id,
        name,
        teacherKey,
        studentKey
      }
    }
  } catch (err) {
    console.error('createClass error:', err)
    return { success: false, error: err.message || '创建班级失败' }
  }
}
