// 云函数：checkBadges
// 检查并更新学生徽章状态

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 徽章定义
const BADGE_DEFINITIONS = {
  // 任务之火 - 连续完成任务
  'task_fire': {
    name: '任务之火',
    icon: '🔥',
    levels: [
      { days: 3, name: '小火苗', icon: '🔥' },
      { days: 7, name: '火焰', icon: '🔥🔥' },
      { days: 14, name: '烈焰', icon: '🔥🔥🔥' },
      { days: 30, name: '传说之火', icon: '🔥🔥🔥🔥' },
    ],
    decayDays: 1, // 断1天降1级
    resetDays: 3  // 断3天清零
  },
  // 课堂之星 - 连续获得课堂加分
  'class_star': {
    name: '课堂之星',
    icon: '⭐',
    levels: [
      { days: 3, name: '新星', icon: '⭐' },
      { days: 7, name: '明星', icon: '⭐⭐' },
      { days: 14, name: '巨星', icon: '⭐⭐⭐' },
    ],
    decayDays: 1,
    resetDays: 2
  },
  // 打卡达人 - 连续登录
  'login_streak': {
    name: '打卡达人',
    icon: '🌱',
    levels: [
      { days: 3, name: '嫩芽', icon: '🌱' },
      { days: 7, name: '幼苗', icon: '🌿' },
      { days: 14, name: '小树', icon: '🌳' },
      { days: 30, name: '参天大树', icon: '🌲✨' },
    ],
    decayDays: 1,
    resetDays: 2
  },
  // 探索先锋 - 完成偏好任务（探索者）
  'explorer_pioneer': {
    name: '探索先锋',
    icon: '🔍',
    levels: [
      { days: 3, name: '好奇者', icon: '🔍' },
      { days: 7, name: '发现者', icon: '🔍🔍' },
      { days: 14, name: '探索家', icon: '🔍🔍🔍' },
    ],
    decayDays: 2,
    resetDays: 5,
    talentMatch: 'explorer'
  },
  // 铸造大师 - 完成偏好任务（铸造者）
  'forger_master': {
    name: '铸造大师',
    icon: '⚒️',
    levels: [
      { days: 3, name: '学徒', icon: '⚒️' },
      { days: 7, name: '工匠', icon: '⚒️⚒️' },
      { days: 14, name: '大师', icon: '⚒️⚒️⚒️' },
    ],
    decayDays: 2,
    resetDays: 5,
    talentMatch: 'forger'
  },
  // 编织能手 - 完成偏好任务（编织者）
  'weaver_expert': {
    name: '编织能手',
    icon: '🧵',
    levels: [
      { days: 3, name: '学徒', icon: '🧵' },
      { days: 7, name: '能手', icon: '🧵🧵' },
      { days: 14, name: '大师', icon: '🧵🧵🧵' },
    ],
    decayDays: 2,
    resetDays: 5,
    talentMatch: 'weaver'
  },
  // 守护卫士 - 完成偏好任务（守护者）
  'guardian_defender': {
    name: '守护卫士',
    icon: '🛡️',
    levels: [
      { days: 3, name: '卫士', icon: '🛡️' },
      { days: 7, name: '骑士', icon: '🛡️🛡️' },
      { days: 14, name: '圣骑士', icon: '🛡️🛡️🛡️' },
    ],
    decayDays: 2,
    resetDays: 5,
    talentMatch: 'guardian'
  },
  // 引导之光 - 完成偏好任务（引导者）
  'guide_light': {
    name: '引导之光',
    icon: '💡',
    levels: [
      { days: 3, name: '微光', icon: '💡' },
      { days: 7, name: '明灯', icon: '💡💡' },
      { days: 14, name: '灯塔', icon: '💡💡💡' },
    ],
    decayDays: 2,
    resetDays: 5,
    talentMatch: 'guide'
  },
  // 突破先锋 - 完成偏好任务（突破者）
  'breaker_pioneer': {
    name: '突破先锋',
    icon: '⚡',
    levels: [
      { days: 3, name: '勇者', icon: '⚡' },
      { days: 7, name: '战士', icon: '⚡⚡' },
      { days: 14, name: '英雄', icon: '⚡⚡⚡' },
    ],
    decayDays: 2,
    resetDays: 5,
    talentMatch: 'breaker'
  },
}

// 天赋映射
const TALENT_MAP = {
  'A': 'explorer',
  'B': 'forger',
  'C': 'weaver',
  'D': 'guardian',
  'E': 'guide',
  'F': 'breaker',
}

/**
 * 计算连续天数
 */
async function calculateStreak(studentId, checkType, talentCategory = null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  let streak = 0
  let checkDate = new Date(today)
  
  while (true) {
    let hasActivity = false
    
    if (checkType === 'task') {
      // 检查是否完成任务
      const nextDay = new Date(checkDate)
      nextDay.setDate(nextDay.getDate() + 1)
      
      const completions = await db.collection('taskCompletions')
        .where({
          studentId,
          date: db.command.gte(checkDate).and(db.command.lt(nextDay)),
          ...(talentCategory ? { category: talentCategory } : {})
        })
        .count()
      
      hasActivity = completions.total > 0
      
    } else if (checkType === 'class_score') {
      // 检查是否获得课堂加分
      const nextDay = new Date(checkDate)
      nextDay.setDate(nextDay.getDate() + 1)
      
      const scores = await db.collection('expLogs')
        .where({
          studentId,
          type: 'class_score',
          createTime: db.command.gte(checkDate).and(db.command.lt(nextDay))
        })
        .count()
      
      hasActivity = scores.total > 0
      
    } else if (checkType === 'login') {
      // 检查是否登录（通过expLogs记录判断）
      const nextDay = new Date(checkDate)
      nextDay.setDate(nextDay.getDate() + 1)
      
      const activities = await db.collection('expLogs')
        .where({
          studentId,
          createTime: db.command.gte(checkDate).and(db.command.lt(nextDay))
        })
        .count()
      
      hasActivity = activities.total > 0
    }
    
    if (hasActivity) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      // 检查是否是今天（今天还没结束，不算断）
      if (checkDate.getTime() === today.getTime()) {
        checkDate.setDate(checkDate.getDate() - 1)
        continue
      }
      break
    }
  }
  
  return streak
}

/**
 * 获取徽章当前等级
 */
function getBadgeLevel(badgeDef, streak, isTalentMatch) {
  const { levels, decayDays, resetDays } = badgeDef
  
  // 根据是否匹配天赋调整要求
  const multiplier = isTalentMatch ? 0.7 : 1.3
  
  // 从最高级开始检查
  for (let i = levels.length - 1; i >= 0; i--) {
    const requiredDays = Math.ceil(levels[i].days * multiplier)
    if (streak >= requiredDays) {
      return {
        level: i + 1,
        levelName: levels[i].name,
        icon: levels[i].icon,
        requiredDays: requiredDays,
        currentStreak: streak
      }
    }
  }
  
  return null
}

exports.main = async (event, context) => {
  const { studentId } = event
  
  if (!studentId) {
    return { success: false, error: '缺少studentId' }
  }
  
  try {
    // 获取学生信息
    const studentRes = await db.collection('students').doc(studentId).get()
    const student = studentRes.data
    
    if (!student) {
      return { success: false, error: '学生不存在' }
    }
    
    const talentCategory = TALENT_MAP[student.talentId.charAt(0).toUpperCase()]
    
    // 获取当前徽章状态
    const badgeRes = await db.collection('badgeStatus')
      .where({ studentId })
      .get()
    
    const currentBadges = {}
    badgeRes.data.forEach(b => {
      currentBadges[b.badgeId] = b
    })
    
    // 计算各徽章状态
    const results = []
    const now = new Date()
    
    for (const [badgeId, badgeDef] of Object.entries(BADGE_DEFINITIONS)) {
      let streak = 0
      let checkType = ''
      
      // 确定检查类型
      if (badgeId === 'task_fire') {
        checkType = 'task'
      } else if (badgeId === 'class_star') {
        checkType = 'class_score'
      } else if (badgeId === 'login_streak') {
        checkType = 'login'
      } else if (badgeId.includes('explorer')) {
        checkType = 'task'
      } else if (badgeId.includes('forger')) {
        checkType = 'task'
      } else if (badgeId.includes('weaver')) {
        checkType = 'task'
      } else if (badgeId.includes('guardian')) {
        checkType = 'task'
      } else if (badgeId.includes('guide')) {
        checkType = 'task'
      } else if (badgeId.includes('breaker')) {
        checkType = 'task'
      }
      
      // 计算连续天数
      streak = await calculateStreak(studentId, checkType, badgeDef.talentMatch)
      
      // 判断是否匹配天赋
      const isTalentMatch = badgeDef.talentMatch === talentCategory
      
      // 获取当前等级
      const levelInfo = getBadgeLevel(badgeDef, streak, isTalentMatch)
      
      // 更新或创建徽章记录
      const badgeData = {
        studentId,
        badgeId,
        badgeName: badgeDef.name,
        currentStreak: streak,
        lastCheckTime: now,
        isTalentMatch,
        ...(levelInfo ? {
          currentLevel: levelInfo.level,
          levelName: levelInfo.levelName,
          icon: levelInfo.icon,
          requiredDays: levelInfo.requiredDays
        } : {
          currentLevel: 0,
          levelName: null,
          icon: null,
          requiredDays: null
        })
      }
      
      if (currentBadges[badgeId]) {
        await db.collection('badgeStatus').doc(currentBadges[badgeId]._id).update({
          data: badgeData
        })
      } else {
        await db.collection('badgeStatus').add({
          data: { ...badgeData, createTime: now }
        })
      }
      
      results.push(badgeData)
    }
    
    return {
      success: true,
      badges: results.filter(b => b.currentLevel > 0)
    }
    
  } catch (err) {
    console.error('checkBadges error:', err)
    return { success: false, error: err.message }
  }
}
