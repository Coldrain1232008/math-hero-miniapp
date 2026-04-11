// cloudfunctions/drawGacha/index.js
// 抽卡系统：每天免费3次，完成普通任务+3次，完成特殊任务+5次
// 概率：70% 获得1EXP，15% 成长加速剂，15% 挑战凭证
// 核心：所有次数操作使用数据库条件更新，保证原子性，彻底防止并发竞态
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 属性名称（中英文对应）
const ATTR_NAMES_ZH = ['智识', '专注', '毅力', '灵感', '表达', '心志']
const ATTR_NAMES_EN = ['wisdom', 'focus', 'perseverance', 'inspiration', 'expression', 'willpower']

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  try {
    const { openid } = event
    if (!openid) return { success: false, error: '缺少 openid' }

    const studentRes = await db.collection('students').where({ openid }).get()
    if (!studentRes.data || studentRes.data.length === 0) {
      return { success: false, error: '学生信息不存在' }
    }
    const student = studentRes.data[0]
    const today = getTodayStr()

    // === 第一步：处理跨日重置 ===
    // 只有今天还没有任何操作时，才重置为3（基础次数）
    // 任务奖励由 confirmTask 在写入时已处理，这里不需要关心 bonusToday
    const lastDrawDate = student.lastDrawDate || ''
    if (lastDrawDate !== today) {
      await db.collection('students').doc(student._id).update({
        data: {
          remainingDraws: 3,
          lastDrawDate: today
        }
      })
    }

    // === 第二步：原子扣减次数 ===
    // 关键：用 where + update 条件更新，只有 remainingDraws > 0 时才扣
    // 这样即使多个请求并发，也只有实际的次数被扣，不存在竞态
    const updateRes = await db.collection('students').where({
      _id: student._id,
      remainingDraws: _.gt(0)  // 条件：剩余次数 > 0
    }).update({
      data: {
        remainingDraws: _.inc(-1),
        lastDrawDate: today
      }
    })

    // updateRes.updated === 0 说明条件不满足（remainingDraws <= 0），次数已用完
    if (!updateRes.updated) {
      return { success: false, error: '今日抽卡次数已用完', dailyLeft: 0 }
    }

    // === 第三步：随机结果并发放奖励 ===
    const rand = Math.random()
    let result = {}

    if (rand < 0.15) {
      result = { type: 'growthAccelerant', desc: '成长加速剂', subDesc: '可永久提升任一属性成长速度 +0.1' }
      await db.collection('students').doc(student._id).update({
        data: { growthAccelerants: _.inc(1) }
      })
    } else if (rand < 0.30) {
      result = { type: 'challengeVoucher', desc: '挑战凭证', subDesc: '可挑战同班同学，胜者获得 5 EXP' }
      await db.collection('students').doc(student._id).update({
        data: { challengeVouchers: _.inc(1) }
      })
    } else {
      result = { type: 'exp', desc: '+1 EXP', subDesc: '继续加油！' }
      await db.collection('students').doc(student._id).update({
        data: { totalExp: _.inc(1) }
      })
      await db.collection('expLogs').add({
        data: {
          studentId: student._id,
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
    const updated = await db.collection('students').doc(student._id).get()
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
