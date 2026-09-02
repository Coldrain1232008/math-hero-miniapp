// cloudfunctions/deleteClass/index.js
// 永久删除班级及其全部云数据
//
// 安全策略（三道锁）：
//   1. 必须提供当前生效的教师密钥，且与班级记录匹配（大小写不敏感）
//   2. 必须准确输入班级名称作为确认（confirmName）
//   3. 班级内必须已经没有任何学生 —— 需先在学生列表里逐个「永久删除」
//
// 清理范围（17 个集合，含班级本身）：
//   · 带 classId 的（expLogs / taskCompletions / dailyTasks / itemLogs /
//     specialTasks / taskPool / challengeLogs / notifications / coinLogs / wallets /
//     shopItems / shopOrders）
//     —— 直接按 classId 删。注意 taskPool 混有全局预置任务，只会命中本班自定义任务
//   · shopItems 里 classId 为空的是全局模板，where({ classId }) 命中不到，不会误删
//   · 只有 studentId 维度的（badgeStatus / weeklyStats / challengeHistory）——
//     先从历史记录里反查该班曾出现过的所有 studentId，再按 ID 清理，避免留下孤儿数据
//   · challengeLogs / notifications 两种方式都跑，覆盖 classId 为空的历史脏数据
//   · wallets 是班级对公钱包，随班级一起注销
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const BATCH = 100

function normalizeKey(k) {
  return String(k === undefined || k === null ? '' : k).replace(/\s/g, '').toUpperCase()
}

/**
 * 按条件删除，返回 { deleted, error }
 *
 * 优先用云函数端支持的 where().remove() 一次批量删完 —— 逐条/分页删除会产生大量
 * 数据库往返，很容易撞上云函数超时。删除后再 count 校验一次，若有残留
 * （可能触及单次批量上限）再退回分页删除兜底。
 * 集合不存在或查询失败时返回 error，不阻断整体流程。
 */
async function removeWhere(name, where, maxRounds = 100) {
  let total = 0

  // 1) 批量删除（快）
  let batchOk = false
  try {
    const res = await db.collection(name).where(where).remove()
    total = (res && res.stats && res.stats.removed) || 0
    batchOk = true
  } catch (e) {
    console.error(`[deleteClass] ${name} 批量删除不可用，退回分页删除:`, e)
  }

  // 2) 残留校验 / 分页兜底
  try {
    let left = 0
    if (batchOk) {
      const countRes = await db.collection(name).where(where).count()
      left = countRes.total || 0
    }

    if (!batchOk || left > 0) {
      for (let i = 0; i < maxRounds; i++) {
        const res = await db.collection(name).where(where).limit(BATCH).get()
        if (!res.data || res.data.length === 0) break
        const ids = res.data.map((d) => d._id)
        await db.collection(name).where({ _id: _.in(ids) }).remove()
        total += ids.length
        if (res.data.length < BATCH) break
      }
    }
  } catch (e) {
    console.error(`[deleteClass] 清理 ${name} 失败:`, e)
    return { deleted: total, error: e.message || String(e) }
  }

  return { deleted: total }
}

/**
 * 从带有 classId 的历史集合里，反查该班曾出现过的所有 studentId
 */
async function collectStudentIds(classId) {
  const idSet = new Set()
  const sources = ['expLogs', 'taskCompletions', 'dailyTasks', 'itemLogs']

  for (const name of sources) {
    try {
      for (let page = 0; page < 50; page++) {
        const res = await db
          .collection(name)
          .where({ classId })
          .field({ studentId: true })
          .skip(page * BATCH)
          .limit(BATCH)
          .get()
        if (!res.data || res.data.length === 0) break
        res.data.forEach((d) => {
          if (d.studentId) idSet.add(d.studentId)
        })
        if (res.data.length < BATCH) break
      }
    } catch (e) {
      // 集合不存在（如 itemLogs 未创建）时跳过，不影响其它集合
      console.error(`[deleteClass] 收集 ${name} 的 studentId 失败:`, e)
    }
  }

  // 保险起见：students 集合里若还有残留（理论上已被前置校验拦住）也一并收集
  try {
    const stuRes = await db.collection('students').where({ classId }).field({ _id: true }).limit(BATCH).get()
    ;(stuRes.data || []).forEach((d) => idSet.add(d._id))
  } catch (e) {
    console.error('[deleteClass] 收集 students 的 _id 失败:', e)
  }

  return Array.from(idSet)
}

/**
 * 排除"已经转到其它班级的活跃学生"
 *
 * 重要：班主任可能用「移出班级」把学生转到别的班，此时该生在 students 里依然存在，
 * 但 classId 已变。反查历史记录时他的旧 ID 会被捞出来，若照单全删，
 * 会连带删掉他在新班级的徽章、周报等数据 —— 必须排除。
 * （前置校验已保证本班无学生，因此仍存在于 students 的必然已转到别班）
 */
async function filterOutActiveStudents(ids, classId) {
  if (!ids || ids.length === 0) return []

  const active = new Set()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const res = await db
        .collection('students')
        .where({ _id: _.in(chunk) })
        .field({ classId: true })
        .limit(BATCH)
        .get()
      ;(res.data || []).forEach((d) => {
        if (d.classId !== classId) active.add(d._id)
      })
    } catch (e) {
      console.error('[deleteClass] 检查活跃学生失败:', e)
    }
  }

  const kept = ids.filter((id) => !active.has(id))
  if (active.size > 0) {
    console.log(`[deleteClass] 已排除 ${active.size} 名转到其它班级的活跃学生`)
  }
  return kept
}

exports.main = async (event, context) => {
  const { classId, teacherKey, confirmName } = event || {}

  if (!classId) {
    return { success: false, error: '缺少班级ID' }
  }
  if (!teacherKey) {
    return { success: false, error: '缺少教师密钥' }
  }

  try {
    // ---------- 锁 1：班级存在 + 教师密钥匹配 ----------
    let cls = null
    try {
      const clsRes = await db.collection('classes').doc(classId).get()
      cls = clsRes.data
    } catch (e) {
      console.error('[deleteClass] 读取班级失败:', e)
    }

    if (!cls) {
      return { success: false, error: '班级不存在或已被删除' }
    }

    const inputKey = normalizeKey(teacherKey)
    const realKey = normalizeKey(cls.teacherKey)
    if (!realKey || inputKey !== realKey) {
      return { success: false, error: '教师密钥不正确，无法执行删除' }
    }

    // ---------- 锁 2：班级名称确认 ----------
    if (confirmName !== undefined && confirmName !== null && String(confirmName).trim() !== '') {
      if (String(confirmName).trim() !== String(cls.name || '').trim()) {
        return { success: false, error: '班级名称输入不一致，未执行删除' }
      }
    } else {
      return { success: false, error: '请输入班级名称以确认删除' }
    }

    // ---------- 锁 3：班级内必须没有学生 ----------
    let studentCount = 0
    try {
      const countRes = await db.collection('students').where({ classId }).count()
      studentCount = countRes.total || 0
    } catch (e) {
      console.error('[deleteClass] 统计学生数失败:', e)
      return { success: false, error: '无法确认班级学生数量，已中止删除' }
    }

    if (studentCount > 0) {
      return {
        success: false,
        error: `班级内还有 ${studentCount} 名学生，请先在学生列表中逐个「永久删除」，清空后才能删除班级`,
        studentCount,
        needRemoveStudents: true,
      }
    }

    // ---------- 执行清理 ----------
    console.log(`[deleteClass] 开始清理班级 ${classId} (${cls.name})`)

    // 先收集历史学生 ID —— 必须在按 classId 删除之前做，否则线索会一起被删掉
    const rawIds = await collectStudentIds(classId)
    // 剔除已转到其它班级的活跃学生，只清理"确已随本班消失"的数据
    const studentIds = await filterOutActiveStudents(rawIds, classId)
    console.log(`[deleteClass] 收集到历史学生 ${rawIds.length} 名，实际可清理 ${studentIds.length} 名`)

    const report = {}

    // 1) 带 classId 的班级级数据：直接按 classId 删除
    //    注意 taskPool 里混有全局预置任务，where({ classId }) 只会命中本班自定义任务，不会误删公共题库
    const classLevel = ['expLogs', 'taskCompletions', 'dailyTasks', 'itemLogs', 'specialTasks', 'taskPool', 'challengeLogs', 'notifications', 'coinLogs', 'wallets', 'shopItems', 'shopOrders']
    for (const name of classLevel) {
      report[name] = await removeWhere(name, { classId })
    }

    // 2) 只有 studentId 维度的集合：按历史学生 ID 分批清理
    //    challengeLogs / notifications 上面已按 classId 清过，这里再兜底一次，
    //    覆盖那些 classId 为空的历史脏数据（删除条数会累加）
    const studentLevel = {
      badgeStatus: ['studentId'],
      weeklyStats: ['studentId'],
      notifications: ['studentId'],
      challengeHistory: ['challengerId', 'targetId'],
      challengeLogs: ['challengerId', 'opponentId'],
    }

    for (const name of Object.keys(studentLevel)) {
      report[name] = report[name] || { deleted: 0 }
    }

    if (studentIds.length > 0) {
      // _.in() 一次塞太多 ID 可能超限，每批 50 个
      for (let i = 0; i < studentIds.length; i += 50) {
        const chunk = studentIds.slice(i, i + 50)
        for (const name of Object.keys(studentLevel)) {
          const fields = studentLevel[name]
          for (const field of fields) {
            const r = await removeWhere(name, { [field]: _.in(chunk) })
            report[name].deleted = (report[name].deleted || 0) + (r.deleted || 0)
            if (r.error) report[name].error = r.error
          }
        }
      }
    }

    // 3) 兜底：students 集合里若仍有本班残留（理论上为 0）一并清掉
    report.students = await removeWhere('students', { classId })

    // 4) 最后删除班级本身
    let classDeleted = false
    try {
      await db.collection('classes').doc(classId).remove()
      // 写后读回验证，杜绝"假成功"
      try {
        await db.collection('classes').doc(classId).get()
        classDeleted = false // 还能读到，说明没删掉
      } catch (e) {
        classDeleted = true // 读不到即已删除
      }
    } catch (e) {
      console.error('[deleteClass] 删除班级文档失败:', e)
      return { success: false, error: `删除班级记录失败：${e.message || e}`, report }
    }

    if (!classDeleted) {
      return { success: false, error: '班级记录未能删除，请重试', report }
    }

    const totalDeleted = Object.keys(report).reduce((sum, k) => sum + (report[k].deleted || 0), 0)

    console.log(`[deleteClass] 完成，共清理 ${totalDeleted} 条数据`)

    return {
      success: true,
      message: `班级「${cls.name}」已永久删除，共清理 ${totalDeleted} 条数据`,
      className: cls.name,
      studentIdsFound: studentIds.length,
      totalDeleted,
      report,
    }
  } catch (err) {
    console.error('[deleteClass] deleteClass error:', err)
    return { success: false, error: err.message || '删除失败' }
  }
}
