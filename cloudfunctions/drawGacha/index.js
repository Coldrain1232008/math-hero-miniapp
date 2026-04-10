// cloudfunctions/drawGacha/index.js
// 抽卡系统：每天免费3次，完成普通任务+3次，完成特殊任务+5次
// 概率：70% 获得1EXP，15% 成长加速剂，15% 挑战凭证
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 属性名称（中英文对应）
const ATTR_NAMES_ZH = ['智识', '专注', '毅力', '灵感', '表达', '心志']
const ATTR_NAMES_EN = ['wisdom', 'focus', 'perseverance', 'inspiration', 'expression', 'willpower']

// 获取今天的日期字符串（YYYYMMDD），用于每日重置判断
function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  try {
    const { openid } = event
    if (!openid) return { success: false, error: '缺少 openid' }

    // 获取学生信息
    const studentRes = await db.collection('students').where({ openid }).get()
    if (!studentRes.data || studentRes.data.length === 0) {
      return { success: false, error: '学生信息不存在' }
    }
    const student = studentRes.data[0]

    // 检查每日重置
    const today = getTodayStr()
    const lastDrawDate = student.lastDrawDate || ''
    const isFirstDrawToday = !lastDrawDate || lastDrawDate !== today

    if (isFirstDrawToday) {
      // 新的一天：重置 bonusToday（任务奖励跨日清零），base 保持 3
      // 兼容老数据：bonusToday 不存在时，从 dailyDrawLeft 推断（总量-3）
      const currentBonus = (typeof student.bonusToday === 'number' && !isNaN(student.bonusToday))
        ? student.bonusToday
        : Math.max(0, (student.dailyDrawLeft || 3) - 3)  // 老数据迁移
      await db.collection('students').doc(student._id).update({
        data: {
          dailyDrawLeft: 3,  // 基础次数重置为3
          bonusToday: currentBonus,  // 保留旧 bonus（如果迁移值>0，说明是昨日奖励，清零更合理）
          lastDrawDate: today
        }
      })
    }

    // 重新查询最新次数（查数据库，不依赖内存中的旧值）
    const freshRes = await db.collection('students').doc(student._id).get()
    const freshStudent = freshRes.data
    const bonusToday = (typeof freshStudent.bonusToday === 'number' && !isNaN(freshStudent.bonusToday))
      ? freshStudent.bonusToday
      : Math.max(0, (freshStudent.dailyDrawLeft || 3) - 3)
    const totalLeft = 3 + bonusToday

    if (totalLeft <= 0) {
      return { success: false, error: '今日抽卡次数已用完', dailyLeft: 0 }
    }

    // 随机抽卡
    const rand = Math.random()
    let result = {} // 返回给前端的描述

    if (rand < 0.15) {
      // 15% 成长加速剂
      const bonus = {
        type: 'growthAccelerant',
        desc: '成长加速剂',
        subDesc: '可永久提升任一属性成长速度 +0.1'
      }
      const decrementData = bonusToday > 0
        ? { growthAccelerants: _.inc(1), bonusToday: _.inc(-1), lastDrawDate: today }
        : { growthAccelerants: _.inc(1), dailyDrawLeft: _.inc(-1), lastDrawDate: today }
      await db.collection('students').doc(student._id).update({ data: decrementData })
      result = bonus
    } else if (rand < 0.30) {
      // 15% 挑战凭证
      const bonus = {
        type: 'challengeVoucher',
        desc: '挑战凭证',
        subDesc: '可挑战同班同学，胜者获得 5 EXP'
      }
      const decrementData = bonusToday > 0
        ? { challengeVouchers: _.inc(1), bonusToday: _.inc(-1), lastDrawDate: today }
        : { challengeVouchers: _.inc(1), dailyDrawLeft: _.inc(-1), lastDrawDate: today }
      await db.collection('students').doc(student._id).update({ data: decrementData })
      result = bonus
    } else {
      // 70% 1 EXP
      const decrementData = bonusToday > 0
        ? { totalExp: _.inc(1), bonusToday: _.inc(-1), lastDrawDate: today }
        : { totalExp: _.inc(1), dailyDrawLeft: _.inc(-1), lastDrawDate: today }
      await db.collection('students').doc(student._id).update({ data: decrementData })
      // 记录日志
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
      result = { type: 'exp', desc: '+1 EXP', subDesc: '继续加油！' }
    }

    // 返回最新状态
    const updated = await db.collection('students').doc(student._id).get()
    const latest = updated.data || {}

    // 计算最新剩余总次数：基础3 + bonusToday
    const latestBonus = (typeof latest.bonusToday === 'number' && !isNaN(latest.bonusToday))
      ? latest.bonusToday
      : Math.max(0, (latest.dailyDrawLeft || 3) - 3)
    const latestDailyLeft = 3 + latestBonus
    return {
      success: true,
      result,
      dailyLeft: latestDailyLeft,
      newTotalExp: latest.totalExp
    }

  } catch (e) {
    console.error('drawGacha error:', e)
    return { success: false, error: e.message || '抽卡失败' }
  }
}
