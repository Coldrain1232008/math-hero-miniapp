// tools/auth-template.js —— 云函数鉴权模板（源）
//
// ⚠️ 不要直接修改各云函数目录下的 auth.js，改这里然后跑：
//      node tools/sync-auth.js
//
// 背景（2026-09-02 审计）：
//   项目里 26 个云函数压根不鉴权，只收 event.classId。
//   classId 在小程序 globalData 里就有，学生改个参数就能跨班写入
//   （比如调 coinOperation 给自己刷金币）。
//
// 为什么不用公共模块（cloudfunctions/common/）：
//   微信开发者工具上传单个云函数时不会带上层目录，公共模块部署不过去。
//   所以改成「每个云函数自带一份 auth.js + 脚本同步」：
//   部署零成本，维护靠 sync-auth.js 一处改全局生效。
//
// 双查策略（与 login.findByKey / manageShop.verifyTeacher 一致）：
//   先按用户输入原值查，查不到再按归一化值查。
//   早期写入数据库的历史密钥可能是小写，只查归一化值会把这批人挡在门外
//   ——这就是 teacher-shop「密钥不正确」事故的根因。

const cloud = require('wx-server-sdk')
const db = cloud.database()

/** 密钥归一化：去空白 + 转大写 */
function normalizeKey(raw) {
  return String(raw || '').trim().toUpperCase()
}

/**
 * 按教师密钥反查班级（双查，兼容历史小写密钥）
 * @param {string} teacherKey 用户输入的原始密钥
 * @returns {Promise<object|null>} 班级文档，查不到返回 null
 */
async function findClassByTeacherKey(teacherKey) {
  const raw = String(teacherKey || '').trim()
  if (!raw) return null

  // 第一次：按用户输入原值查（兼容历史小写密钥）
  try {
    const res = await db.collection('classes')
      .where({ teacherKey: raw })
      .limit(1)
      .get()
    if (res.data && res.data.length > 0) return res.data[0]
  } catch (e) {
    console.error('[auth] 按原值查班级失败:', e)
  }

  // 第二次：按归一化值查
  const upper = normalizeKey(raw)
  if (upper !== raw) {
    try {
      const res = await db.collection('classes')
        .where({ teacherKey: upper })
        .limit(1)
        .get()
      if (res.data && res.data.length > 0) return res.data[0]
    } catch (e) {
      console.error('[auth] 按归一化值查班级失败:', e)
    }
  }

  return null
}

/**
 * 教师鉴权：凭 teacherKey 拿到班级，服务端决定 classId
 *
 * 用法（云函数入口第一行）：
 *   const auth = await verifyTeacher(event.teacherKey)
 *   if (!auth.ok) return { success: false, error: auth.error }
 *   const classId = auth.classId      // ← 用这个，不要用 event.classId
 *
 * @returns {Promise<{ok: boolean, error?: string, classId?: string, className?: string}>}
 */
async function verifyTeacher(teacherKey) {
  const cls = await findClassByTeacherKey(teacherKey)
  if (!cls) {
    return { ok: false, error: '教师密钥不正确，请重新登录' }
  }
  return { ok: true, classId: cls._id, className: cls.name }
}

/**
 * super 管理员鉴权
 *
 * 用法：
 *   const auth = await verifySuper(event.superKey)
 *   if (!auth.ok) return { success: false, error: auth.error }
 *
 * @returns {Promise<{ok: boolean, error?: string, admin?: object}>}
 */
async function verifySuper(superKey) {
  const raw = String(superKey || '').trim()
  if (!raw) return { ok: false, error: '缺少管理员密钥' }

  // 双查：先原值后归一化，与教师鉴权保持一致
  const attempts = [raw]
  const upper = normalizeKey(raw)
  if (upper !== raw) attempts.push(upper)

  for (const key of attempts) {
    try {
      const res = await db.collection('admins')
        .where({ role: 'super', superKey: key })
        .limit(1)
        .get()
      if (res.data && res.data.length > 0) return { ok: true, admin: res.data[0] }
    } catch (e) {
      console.error('[auth] 查 admins 失败:', e)
    }
  }

  return { ok: false, error: '管理员密钥不正确' }
}

/**
 * 学生身份校验：确认该 studentId 属于当前微信用户
 *
 * 用于学生端云函数（drawGacha / checkIn / transferCoins 等）——
 * 这些函数学生本来就该能调，但要保证只能操作「自己」。
 * 判定依据：students.openid 字段，首次登录时已绑定（见 login 云函数）。
 *
 * 用法：
 *   const own = await verifyStudentOwner(event.studentId)
 *   if (!own.ok) return { success: false, error: own.error }
 *
 * @returns {Promise<{ok: boolean, error?: string, student?: object}>}
 */
async function verifyStudentOwner(studentId) {
  const { WX_OPENID } = cloud.getWXContext()
  if (!studentId) return { ok: false, error: '缺少 studentId' }
  if (!WX_OPENID) return { ok: false, error: '无法识别用户身份' }

  try {
    const res = await db.collection('students').doc(studentId).get()
    const student = res.data
    if (!student) return { ok: false, error: '学生不存在' }

    // 已绑定 openid 的必须是本人；未绑定的（预导入学生）允许首次绑定
    if (student.openid && student.openid !== WX_OPENID) {
      return { ok: false, error: '只能操作自己的数据' }
    }
    return { ok: true, student, isFirstBind: !student.openid }
  } catch (e) {
    return { ok: false, error: '学生信息查询失败：' + e.message }
  }
}

module.exports = {
  normalizeKey,
  findClassByTeacherKey,
  verifyTeacher,
  verifySuper,
  verifyStudentOwner,
}
