// cloudfunctions/drawGacha/index.js
// 抽卡系统：每天免费3次，完成普通任务+3次，完成特殊任务+5次
// 概率：70% 获得1EXP，15% 成长加速剂，15% 挑战凭证
// 核心：用 _id（主键）直接查询，用数据库条件更新保证原子性
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  try {
    const { studentId } = event
    if (!studentId) return { success: false, error: '缺少 studentId' }

    // 直接用 _id 主键查询，保证查到的是正确的学生记录
    const studentRes = await db.collection('students').doc(studentId).get()
    if (!studentRes.data) {
      return { success: false, error: '学生信息不存在' }
    }
    const student = studentRes.data
    const today = getTodayStr()

    // === 第一步：处理跨日重置 ===
    const lastDrawDate = student.lastDrawDate || ''
    if (lastDrawDate !== today) {
      await db.collection('students').doc(studentId).update({
        data: {
          remainingDraws: 3,
          lastDrawDate: today
        }
      })
    }

    // === 第二步：原子扣减次数 ===
    // 用 where 条件更新，只有 remainingDraws > 0 时才扣，多请求并发也不重复扣
    const updateRes = await db.collection('students').where({
      _id: studentId,
      remainingDraws: _.gt(0)
    }).update({
      data: {
        remainingDraws: _.inc(-1),
        lastDrawDate: today
      }
    })

    // where().update() 的返回结构是 { stats: { updated: N }, errMsg: "..." }
    // 注意：不是 updateRes.updated，而是 updateRes.stats.updated
    const updatedCount = updateRes && updateRes.stats ? updateRes.stats.updated : 0

    if (!updatedCount) {
      // 重新查询当前状态，返回真实的剩余次数
      const current = await db.collection('students').doc(studentId).get()
      const realLeft = current.data?.remainingDraws ?? 0
      return { success: false, error: '今日抽卡次数已用完', dailyLeft: realLeft }
    }

    // === 第三步：随机结果并发放奖励 ===
    const rand = Math.random()
    let result = {}

    if (rand < 0.15) {
      result = { type: 'growthAccelerant', desc: '成长加速剂', subDesc: '可永久提升任一属性成长速度 +0.1' }
      await db.collection('students').doc(studentId).update({
        data: { growthAccelerants: _.inc(1) }
      })
    } else if (rand < 0.30) {
      result = { type: 'challengeVoucher', desc: '挑战凭证', subDesc: '可挑战同班同学，胜者获得 5 EXP' }
      await db.collection('students').doc(studentId).update({
        data: { challengeVouchers: _.inc(1) }
      })
    } else {
      result = { type: 'exp', desc: '+1 EXP', subDesc: '继续加油！' }
      await db.collection('students').doc(studentId).update({
        data: { totalExp: _.inc(1) }
      })
      await db.collection('expLogs').add({
        data: {
          studentId: studentId,
          classId: student.classId,
          type: 'gacha',
          amount: 1,
          baseExp: 1,
          bonusExp: 0,
          desc: '抽卡奖励',
          createdAt: Date.now()
        }
      })
    }

    // === 第四步：返回最新状态 ===
    const updated = await db.collection('students').doc(studentId).get()
    const latest = updated.data || {}
    return {
      success: true,
      result,
      dailyLeft: latest.remainingDraws !== undefined ? latest.remainingDraws : 0,
      newTotalExp: latest.totalExp || 0,
      challengeVouchers: latest.challengeVouchers || 0,
      growthAccelerants: latest.growthAccelerants || 0
    }

  } catch (e) {
    console.error('drawGacha error:', e)
    return { success: false, error: e.message || '抽卡失败' }
  }
}
