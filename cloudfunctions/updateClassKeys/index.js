// 云函数：updateClassKeys
// 教师修改本班的班级密钥 / 教师密钥，带全局查重
//
// 两种模式（用 action 区分，合并成一个云函数，减少上传数量）：
//   action: 'check'  —— 只查重，不落库，用于输入框实时提示「可用 / 已被占用」
//   action: 'update' —— 校验通过后真正写入（默认）
//
// 参数：teacherKey, type('teacherKey' | 'studentKey'), newKey, action
//
// ⚠️ 鉴权（2026-09-02 补）：此前只收 event.classId 且无任何身份校验，
//    任何人都能把任意班级的密钥改成自己知道的值 —— 等于直接接管班级。
//    现在改为凭当前 teacherKey 由服务端反查 classId，不信任前端传参。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 鉴权：verifyTeacher 用 teacherKey 反查 classId（不信任前端传的 classId）
// auth.js 由 tools/sync-auth.js 从 tools/auth-template.js 同步，勿直接修改
const { verifyTeacher } = require('./auth')

// 密钥格式：4-12 位字母或数字（内部统一转大写，方便学生手抄）
const KEY_REG = /^[A-Z0-9]{4,12}$/

function normalizeKey(raw) {
  return (raw || '').trim().toUpperCase()
}

// 查重：教师密钥和班级密钥两个字段都要比对，避免两类密钥撞车
// 排除自己（selfId），否则「原值不变」会被误判为冲突
async function isKeyTaken(key, selfId) {
  const fields = ['teacherKey', 'studentKey']
  for (const f of fields) {
    const res = await db.collection('classes').where({ [f]: key }).get()  // auth-ok: 查重，key 已由 KEY_REG 保证大写
    const conflict = (res.data || []).filter(c => c._id !== selfId)
    if (conflict.length > 0) return true
  }
  return false
}

exports.main = async (event, context) => {
  const { type, newKey } = event
  const mode = event.action || 'update'

  // ===== 鉴权第一道：教师密钥 =====
  // classId 由服务端反查。改密钥属于最高危操作，必须确认是本班教师本人
  const auth = await verifyTeacher(event.teacherKey)
  if (!auth.ok) return { success: false, error: auth.error }
  const classId = auth.classId

  if (type !== 'teacherKey' && type !== 'studentKey') {
    return { success: false, error: '密钥类型不正确' }
  }

  const key = normalizeKey(newKey)

  if (!KEY_REG.test(key)) {
    return { success: false, error: '密钥需为 4-12 位字母或数字', invalidFormat: true }
  }

  try {
    // 校验班级存在
    const clsRes = await db.collection('classes').doc(classId).get()
    const cls = clsRes.data
    if (!cls) {
      return { success: false, error: '班级不存在' }
    }

    // 与原值相同：无需改，也不算冲突
    if (cls[type] === key) {
      return { success: true, unchanged: true, message: '新密钥与原密钥相同' }
    }

    // 本班内部：班级密钥与教师密钥不能撞车，否则学生和老师会用同一个口令进错端
    const otherField = type === 'teacherKey' ? 'studentKey' : 'teacherKey'
    if (cls[otherField] && normalizeKey(cls[otherField]) === key) {
      return {
        success: false,
        error: type === 'teacherKey'
          ? '不能与本班的班级密钥相同'
          : '不能与本班的教师密钥相同',
        duplicated: true
      }
    }

    // 查重（跨班级）
    if (await isKeyTaken(key, classId)) {
      return {
        success: false,
        error: '该密钥已被其他班级占用，请换一个',
        duplicated: true
      }
    }

    // 仅查重模式：到此说明可用
    if (mode === 'check') {
      return { success: true, available: true }
    }

    // 执行更新
    const updateRes = await db.collection('classes').doc(classId).update({
      data: {
        [type]: key,
        keyUpdatedAt: new Date()
      }
    })
    console.log('updateClassKeys update:', classId, type, key, JSON.stringify(updateRes))

    // ⚠️ 写后读回验证：不信任 update 的返回结构（doc().update() 与 where().update()
    // 返回格式不同，踩过坑），直接重新读一次，以数据库真实值为准
    const verifyRes = await db.collection('classes').doc(classId).get()
    const saved = verifyRes.data

    if (!saved || saved[type] !== key) {
      console.error('updateClassKeys 写入未生效:', {
        classId, type, expect: key, actual: saved && saved[type]
      })
      return {
        success: false,
        error: '密钥写入未生效，请重试',
        updateRes
      }
    }

    return {
      success: true,
      message: type === 'teacherKey' ? '教师密钥已更新' : '班级密钥已更新',
      classInfo: {
        _id: classId,
        name: saved.name,
        teacherKey: saved.teacherKey,
        studentKey: saved.studentKey
      }
    }
  } catch (err) {
    console.error('updateClassKeys error:', err)
    return { success: false, error: err.message || '修改失败' }
  }
}
