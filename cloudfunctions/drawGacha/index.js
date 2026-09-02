// cloudfunctions/drawGacha/index.js
// 抽卡系统：每天免费3次，完成普通任务+3次，完成特殊任务+5次
// 概率：60% 挑战凭证，10% 成长加速剂，30% EXP（10/5/3/1随机分布）
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
    // ⚠️ 只重置 remainingDraws（每日免费次数），绝对不能动 bonusDraws：
    //    bonusDraws 是学生在商城花金币买的，清零等于吞钱。
    //    两个字段必须分开，否则"买抽卡次数"这个商品就是骗局。
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
    // 消耗顺序：先花购买次数 bonusDraws，再花每日免费次数 remainingDraws。
    // 用 where 条件更新的方式保证原子性，多请求并发也不会重复扣。
    let usedBonus = false
    const bonusRes = await db.collection('students').where({
      _id: studentId,
      bonusDraws: _.gt(0)
    }).update({
      data: { bonusDraws: _.inc(-1) }
    })

    let updatedCount = bonusRes && bonusRes.stats ? bonusRes.stats.updated : 0
    usedBonus = updatedCount > 0

    if (!updatedCount) {
      // 没有购买次数，才动用每日免费次数
      const dailyRes = await db.collection('students').where({
        _id: studentId,
        remainingDraws: _.gt(0)
      }).update({
        data: {
          remainingDraws: _.inc(-1),
          lastDrawDate: today
        }
      })
      updatedCount = dailyRes && dailyRes.stats ? dailyRes.stats.updated : 0
    }

    if (!updatedCount) {
      // 两种次数都没了，重新查询返回真实剩余（免费 + 购买）
      const current = await db.collection('students').doc(studentId).get()
      const d = current.data || {}
      const realLeft = (d.remainingDraws ?? 0) + (d.bonusDraws ?? 0)
      return { success: false, error: '抽卡次数已用完', dailyLeft: realLeft }
    }

    // === 第三步：随机结果并发放奖励 ===
    // 概率分布：60% 挑战凭证，10% 成长加速剂，30% EXP（10/5/3/1随机）
    const rand = Math.random()
    let result = {}

    if (rand < 0.60) {
      result = { type: 'challengeVoucher', desc: '挑战凭证', subDesc: '可挑战同班同学，胜者获得 5 EXP' }
      await db.collection('students').doc(studentId).update({
        data: { challengeVouchers: _.inc(1) }
      })
    } else if (rand < 0.70) {
      result = { type: 'growthAccelerant', desc: '成长加速剂', subDesc: '可永久提升任一属性成长速度 +0.1' }
      await db.collection('students').doc(studentId).update({
        data: { growthAccelerants: _.inc(1) }
      })
    } else {
      // 30% EXP：5%概率+10，15%概率+5，30%概率+3，50%概率+1
      const expRand = Math.random()
      let expAmount = 1
      let expDesc = '+1 EXP'
      let expSubDesc = '小试牛刀'
      if (expRand < 0.05) {
        expAmount = 10; expDesc = '+10 EXP'; expSubDesc = '运气爆棚！'
      } else if (expRand < 0.20) {
        expAmount = 5; expDesc = '+5 EXP'; expSubDesc = '表现不错！'
      } else if (expRand < 0.50) {
        expAmount = 3; expDesc = '+3 EXP'; expSubDesc = '继续加油！'
      }
      result = { type: 'exp', desc: expDesc, subDesc: expSubDesc }
      await db.collection('students').doc(studentId).update({
        data: { totalExp: _.inc(expAmount) }
      })
      await db.collection('expLogs').add({
        data: {
          studentId: studentId,
          classId: student.classId,
          type: 'gacha',
          amount: expAmount,
          baseExp: expAmount,
          bonusExp: 0,
          desc: '抽卡奖励',
          createdAt: Date.now()
        }
      })
    }

    // === 第四步：返回最新状态 ===
    const updated = await db.collection('students').doc(studentId).get()
    const latest = updated.data || {}
    
    // 异步触发徽章检查（fire-and-forget）
    try {
      cloud.callFunction({
        name: 'checkBadges',
        data: { studentId }
      }).catch(err => console.warn('checkBadges async error:', err.message))
    } catch (e) {
      // 忽略同步错误
    }
    
    return {
      success: true,
      result,
      usedBonus,                       // true=用的购买次数，false=用的每日免费次数
      dailyLeft: latest.remainingDraws !== undefined ? latest.remainingDraws : 0,
      bonusLeft: latest.bonusDraws !== undefined ? latest.bonusDraws : 0,
      newTotalExp: latest.totalExp || 0,
      challengeVouchers: latest.challengeVouchers || 0,
      growthAccelerants: latest.growthAccelerants || 0
    }

  } catch (e) {
    console.error('drawGacha error:', e)
    return { success: false, error: e.message || '抽卡失败' }
  }
}
