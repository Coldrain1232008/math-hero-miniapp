// cloudfunctions/deleteStudent/index.js
// 永久删除单个学生的全部数据
//
// 清理范围（12 个集合）：
//   学生主记录 + 经验日志 + 每日任务 + 任务完成记录 + 道具日志
//   + 金币流水 + 徽章状态 + 消息通知 + 周报统计 + 挑战历史 + 挑战日志
// 说明：只有把这些一并清掉，之后 deleteClass 才不会留下找不到归属的孤儿数据。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const BATCH = 100

/**
 * 按条件删除，返回 { deleted, error }
 *
 * 优先用云函数端支持的 where().remove() 一次批量删完，避免大量数据库往返导致超时；
 * 删完再 count 校验，有残留（可能触及单次批量上限）则退回分页删除兜底。
 * 集合不存在（未创建）时返回 error，不阻断其它集合的清理。
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
    console.error(`[deleteStudent] ${name} 批量删除不可用，退回分页删除:`, e)
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
    console.error(`[deleteStudent] 清理 ${name} 失败:`, e)
    return { deleted: total, error: e.message || String(e) }
  }

  return { deleted: total }
}

exports.main = async (event, context) => {
  const { studentId } = event || {}

  if (!studentId) {
    return { success: false, message: '缺少学生ID' }
  }

  try {
    // 先确认学生存在，拿到姓名用于回显
    let student = null
    try {
      const stuRes = await db.collection('students').doc(studentId).get()
      student = stuRes.data
    } catch (e) {
      console.error('[deleteStudent] 读取学生失败:', e)
    }

    if (!student) {
      return { success: false, message: '学生不存在或已被删除' }
    }

    console.log(`[deleteStudent] 开始清理学生 ${studentId} (${student.realName || student.heroName || '未命名'})`)

    const report = {}

    // 1) 以 studentId 为主键的集合
    report.expLogs = await removeWhere('expLogs', { studentId })
    report.dailyTasks = await removeWhere('dailyTasks', { studentId })
    report.taskCompletions = await removeWhere('taskCompletions', { studentId })
    report.itemLogs = await removeWhere('itemLogs', { studentId })
    report.coinLogs = await removeWhere('coinLogs', { studentId })
    report.badgeStatus = await removeWhere('badgeStatus', { studentId })
    report.notifications = await removeWhere('notifications', { studentId })
    report.weeklyStats = await removeWhere('weeklyStats', { studentId })
    report.shopOrders = await removeWhere('shopOrders', { studentId })

    // 2) 挑战记录：学生可能是发起方，也可能是被挑战方，两个字段都要清
    for (const [name, fields] of [
      ['challengeHistory', ['challengerId', 'targetId']],
      ['challengeLogs', ['challengerId', 'opponentId']],
    ]) {
      report[name] = { deleted: 0 }
      for (const field of fields) {
        const r = await removeWhere(name, { [field]: studentId })
        report[name].deleted += r.deleted || 0
        if (r.error) report[name].error = r.error
      }
    }

    // 3) 最后删除学生主记录，并做写后读回验证
    try {
      await db.collection('students').doc(studentId).remove()
      let stillExists = false
      try {
        await db.collection('students').doc(studentId).get()
        stillExists = true
      } catch (e) {
        stillExists = false
      }
      if (stillExists) {
        return { success: false, message: '学生记录未能删除，请重试', report }
      }
    } catch (e) {
      console.error('[deleteStudent] 删除学生主记录失败:', e)
      return { success: false, message: e.message || '删除学生记录失败', report }
    }

    const totalDeleted = Object.keys(report).reduce((sum, k) => sum + (report[k].deleted || 0), 0) + 1

    console.log(`[deleteStudent] 完成，共清理 ${totalDeleted} 条数据`)

    return {
      success: true,
      message: '删除成功',
      studentName: student.realName || student.heroName || '',
      totalDeleted,
      report,
    }
  } catch (e) {
    console.error('[deleteStudent] error:', e)
    return { success: false, message: e.message || '删除失败' }
  }
}
