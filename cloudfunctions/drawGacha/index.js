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

    // 关键：新账号（lastDrawDate为空）或新的一天，重置为3次
    // 注意：不能用这个值直接 -1，要查数据库中的实际值再 -1
    const isFirstDrawToday = !lastDrawDate || lastDrawDate !== today

    if (isFirstDrawToday) {
      // 新一天，先把 dailyDrawLeft 重置为 3（如果需要）
      if (typeof student.dailyDrawLeft !== 'number') {
        await db.collection('students').doc(student._id).update({
          data: { dailyDrawLeft: 3, lastDrawDate: today }
        })
      } else if (student.dailyDrawLeft < 3) {
        await db.collection('students').doc(student._id).update({
          data: { dailyDrawLeft: 3, lastDrawDate: today }
        })
      }
    }

    // 重新查询最新次数（查数据库，不依赖内存中的旧值）
    const freshRes = await db.collection('students').doc(student._id).get()
    const currentDrawLeft = (typeof freshRes.data.dailyDrawLeft === 'number' && !isNaN(freshRes.data.dailyDrawLeft))
      ? freshRes.data.dailyDrawLeft : 3

    if (currentDrawLeft <= 0) {
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
      await db.collection('students').doc(student._id).update({
        data: {
          growthAccelerants: _.inc(1),
          dailyDrawLeft: _.inc(-1),
          lastDrawDate: today
        }
      })
      result = bonus
    } else if (rand < 0.30) {
      // 15% 挑战凭证
      const bonus = {
        type: 'challengeVoucher',
        desc: '挑战凭证',
        subDesc: '可挑战同班同学，胜者获得 5 EXP'
      }
      await db.collection('students').doc(student._id).update({
        data: {
          challengeVouchers: _.inc(1),
          dailyDrawLeft: _.inc(-1),
          lastDrawDate: today
        }
      })
      result = bonus
    } else {
      // 70% 1 EXP
      await db.collection('students').doc(student._id).update({
        data: {
          totalExp: _.inc(1),
          dailyDrawLeft: _.inc(-1),
          lastDrawDate: today
        }
      })
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

    return {
      success: true,
      result,
      dailyLeft: latest.dailyDrawLeft ?? 0,
      newTotalExp: latest.totalExp
    }

  } catch (e) {
    console.error('drawGacha error:', e)
    return { success: false, error: e.message || '抽卡失败' }
  }
}
