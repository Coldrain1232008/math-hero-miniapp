// 云函数：checkBadges
// 检查并更新学生徽章状态（连续徽章 + 里程碑徽章）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 连续行为徽章定义
const BADGE_DEFINITIONS = {
  // 任务之火 - 连续完成任务
  'task_fire': {
    name: '任务之火',
    icon: '🔥',
    hint: '连续完成每日任务',
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
    hint: '连续在课堂上获得老师加分',
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
    hint: '每天登录小程序',
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
    hint: '连续完成探索系偏好任务',
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
    hint: '连续完成锻造系偏好任务',
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
    hint: '连续完成编织系偏好任务',
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
    hint: '连续完成守护系偏好任务',
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
    hint: '连续完成引导系偏好任务',
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
    hint: '连续完成突破系偏好任务',
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

// 里程碑徽章定义（一次性）
const MILESTONE_DEFINITIONS = {
  'first_login': {
    name: '初来乍到',
    icon: '🌟',
    desc: '首次登录',
    hint: '第一次登录小程序即可获得',
    checkType: 'login'
  },
  'first_task': {
    name: '任务新手',
    icon: '✅',
    desc: '首次完成任务',
    hint: '完成一次每日任务即可获得',
    checkType: 'task'
  },
  'first_gacha': {
    name: '手气不错',
    icon: '🎰',
    desc: '首次抽卡',
    hint: '在幸运转盘抽一次卡即可获得',
    checkType: 'gacha'
  },
  'first_challenge': {
    name: '初出茅庐',
    icon: '⚔️',
    desc: '首次挑战',
    hint: '向同学发起一次挑战即可获得',
    checkType: 'challenge'
  },
  'level_10': {
    name: '崭露头角',
    icon: '🔰',
    desc: '达到 Lv.10',
    hint: '累计经验值达到 Lv.10 即可获得',
    checkType: 'level',
    threshold: 10
  },
  'level_25': {
    name: '小有成就',
    icon: '🏅',
    desc: '达到 Lv.25',
    hint: '累计经验值达到 Lv.25 即可获得',
    checkType: 'level',
    threshold: 25
  },
  'level_50': {
    name: '一方霸主',
    icon: '👑',
    desc: '达到 Lv.50',
    hint: '成为班级中的一方霸主',
    checkType: 'level',
    threshold: 50,
    isHidden: true
  },
  'level_100': {
    name: '传奇英雄',
    icon: '🏆',
    desc: '达到 Lv.100',
    hint: '成为传说中的传奇英雄',
    checkType: 'level',
    threshold: 100,
    isHidden: true
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
      
    } else if (checkType === 'class') {
      // 检查是否获得课堂加分（修复：类型从 class_score 改为 class）
      const nextDay = new Date(checkDate)
      nextDay.setDate(nextDay.getDate() + 1)
      
      const scores = await db.collection('expLogs')
        .where({
          studentId,
          type: 'class',
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
 * 计算里程碑徽章
 */
async function calculateMilestone(studentId, student, badgeDef) {
  const { checkType, threshold } = badgeDef

  try {
    if (checkType === 'login') {
      // 检查是否有任何登录记录
      const count = await db.collection('expLogs')
        .where({ studentId })
        .limit(1)
        .count()
      return count.total > 0

    } else if (checkType === 'task') {
      // 检查是否有任何任务完成记录
      const count = await db.collection('taskCompletions')
        .where({ studentId })
        .limit(1)
        .count()
      return count.total > 0

    } else if (checkType === 'gacha') {
      // 检查是否有任何抽卡记录
      const count = await db.collection('expLogs')
        .where({ studentId, type: 'gacha' })
        .limit(1)
        .count()
      return count.total > 0

    } else if (checkType === 'challenge') {
      // 检查是否有任何挑战记录
      // ⚠️ 集合名与字段必须和写入侧（useChallenge）保持一致：
      // useChallenge 写入 challengeLogs，字段为 challengerId / opponentId。
      // 早期版本误查 challengeHistory + targetId，导致挑战类徽章永远无法解锁。
      const count = await db.collection('challengeLogs')
        .where(_.or([
          { challengerId: studentId },
          { opponentId: studentId }
        ]))
        .limit(1)
        .count()
      return count.total > 0

    } else if (checkType === 'level') {
      // 检查等级是否达到阈值
      const level = student.level || 0
      return level >= threshold
    }
  } catch (err) {
    console.warn(`calculateMilestone error for ${checkType}:`, err.message)
    return false
  }

  return false
}

/**
 * 获取徽章当前等级
 */
function getBadgeLevel(badgeDef, streak, isTalentMatch) {
  const { levels } = badgeDef
  
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
  
  // 先构建 allBadges（用于图鉴页），确保即使计算出错也能返回徽章定义
  const allBadges = []
  
  // 连续徽章
  for (const [badgeId, badgeDef] of Object.entries(BADGE_DEFINITIONS)) {
    allBadges.push({
      badgeId,
      badgeName: badgeDef.name,
      badgeType: 'streak',
      icon: badgeDef.levels[0].icon,
      hint: badgeDef.hint,
      isHidden: badgeDef.isHidden || false,
      achieved: false,
      currentLevel: 0,
      levelName: null,
      currentStreak: 0,
      requiredDays: null,
      levels: badgeDef.levels
    })
  }
  
  // 里程碑徽章
  for (const [badgeId, badgeDef] of Object.entries(MILESTONE_DEFINITIONS)) {
    allBadges.push({
      badgeId,
      badgeName: badgeDef.name,
      badgeType: 'milestone',
      icon: badgeDef.icon,
      desc: badgeDef.desc,
      hint: badgeDef.hint,
      isHidden: badgeDef.isHidden || false,
      achieved: false,
      currentLevel: 0,
      levelName: null
    })
  }
  
  try {
    // 获取学生信息
    const studentRes = await db.collection('students').doc(studentId).get()
    const student = studentRes.data
    
    if (!student) {
      return { success: false, error: '学生不存在' }
    }
    
    const talentCategory = TALENT_MAP[student.talentId?.charAt(0)?.toUpperCase()]
    
    // 获取当前徽章状态
    const badgeRes = await db.collection('badgeStatus')
      .where({ studentId })
      .get()
    
    const currentBadges = {}
    badgeRes.data.forEach(b => {
      currentBadges[b.badgeId] = b
    })
    
    const now = new Date()
    const results = []
    const newBadgeNotifications = [] // 新解锁的徽章通知
    
    // ========== 1. 处理连续行为徽章 ==========
    for (const [badgeId, badgeDef] of Object.entries(BADGE_DEFINITIONS)) {
      let checkType = ''
      
      // 确定检查类型
      if (badgeId === 'task_fire') {
        checkType = 'task'
      } else if (badgeId === 'class_star') {
        checkType = 'class' // 修复：从 class_score 改为 class
      } else if (badgeId === 'login_streak') {
        checkType = 'login'
      } else if (badgeId.includes('explorer') || badgeId.includes('forger') || 
                 badgeId.includes('weaver') || badgeId.includes('guardian') || 
                 badgeId.includes('guide') || badgeId.includes('breaker')) {
        checkType = 'task'
      }
      
      // 计算连续天数
      const streak = await calculateStreak(studentId, checkType, badgeDef.talentMatch)
      
      // 判断是否匹配天赋
      const isTalentMatch = badgeDef.talentMatch === talentCategory
      
      // 获取当前等级
      const levelInfo = getBadgeLevel(badgeDef, streak, isTalentMatch)
      
      // 更新或创建徽章记录
      const badgeData = {
        studentId,
        badgeId,
        badgeName: badgeDef.name,
        badgeType: 'streak',
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
      
      // 检查是否是新解锁
      const oldBadge = currentBadges[badgeId]
      if (levelInfo && (!oldBadge || oldBadge.currentLevel < levelInfo.level)) {
        newBadgeNotifications.push({
          badgeId,
          badgeName: badgeDef.name,
          levelName: levelInfo.levelName,
          icon: levelInfo.icon,
          isNew: !oldBadge || oldBadge.currentLevel === 0,
          isLevelUp: oldBadge && oldBadge.currentLevel > 0
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
    
    // ========== 2. 处理里程碑徽章 ==========
    for (const [badgeId, badgeDef] of Object.entries(MILESTONE_DEFINITIONS)) {
      const achieved = await calculateMilestone(studentId, student, badgeDef)
      console.log(`Milestone ${badgeId}: achieved=${achieved}`)

      const badgeData = {
        studentId,
        badgeId,
        badgeName: badgeDef.name,
        badgeType: 'milestone',
        icon: badgeDef.icon,
        desc: badgeDef.desc,
        achieved,
        lastCheckTime: now,
        currentLevel: achieved ? 1 : 0,
        levelName: achieved ? badgeDef.name : null
      }
      
      // 检查是否是新解锁
      const oldBadge = currentBadges[badgeId]
      if (achieved && (!oldBadge || !oldBadge.achieved)) {
        newBadgeNotifications.push({
          badgeId,
          badgeName: badgeDef.name,
          icon: badgeDef.icon,
          isNew: true,
          isLevelUp: false
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

    // 更新 allBadges 中的 achieved 状态
    console.log('results count:', results.length)
    console.log('results with currentLevel > 0:', results.filter(b => b.currentLevel > 0).length)
    for (const badge of allBadges) {
      const achievedBadge = results.find(b => b.badgeId === badge.badgeId && b.currentLevel > 0)
      if (achievedBadge) {
        badge.achieved = true
        badge.currentLevel = achievedBadge.currentLevel
        badge.levelName = achievedBadge.levelName
        badge.icon = achievedBadge.icon
        if (badge.badgeType === 'streak') {
          badge.currentStreak = achievedBadge.currentStreak
          badge.requiredDays = achievedBadge.requiredDays
        }
      }
    }

    console.log('allBadges achieved count:', allBadges.filter(b => b.achieved).length)

    return {
      success: true,
      badges: results.filter(b => b.currentLevel > 0),
      allBadges,
      totalBadgeCount: allBadges.length,
      achievedBadgeCount: allBadges.filter(b => b.achieved).length,
      newBadges: newBadgeNotifications
    }
    
  } catch (err) {
    console.error('checkBadges error:', err)
    console.error('Error stack:', err.stack)
    // 即使出错也返回 allBadges，确保图鉴页能显示
    return {
      success: false,
      error: err.message,
      allBadges,
      totalBadgeCount: allBadges.length,
      achievedBadgeCount: 0
    }
  }
}
