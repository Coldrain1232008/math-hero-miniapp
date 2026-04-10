// 云函数：confirmTask
// 教师确认任务完成，发放奖励

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ============ 称号系统 v2.0 ============
const ATTR_NAMES = ['智识', '专注', '毅力', '灵感', '表达', '心志']
const ATTR_PRIORITY = ['智识', '毅力', '心志', '专注', '灵感', '表达']

// 档内等级配置（7档）
const TITLE_RANK_THRESHOLDS = [
  { maxLevel: 20, rank: 1, name: '初阶' },
  { maxLevel: 30, rank: 2, name: '入门' },
  { maxLevel: 40, rank: 3, name: '登堂' },
  { maxLevel: 55, rank: 4, name: '小成' },
  { maxLevel: 70, rank: 5, name: '精通' },
  { maxLevel: 85, rank: 6, name: '大成' },
  { maxLevel: 100, rank: 7, name: '化境' },
]

// 档位配置（3档）
const TITLE_TIER_THRESHOLDS = [
  { maxLevel: 10, suffix: '·启明', color: '#6c63ff' },
  { maxLevel: 25, suffix: '·洞察', color: '#8b5cf6' },
  { maxLevel: Infinity, suffix: '·天算', color: '#a855f7' },
]

// 单峰型称号
const SINGLE_PEAK_TITLES = {
  '智识': { prefix: '学神', color: '#6c63ff' },
  '专注': { prefix: '战神', color: '#f59e0b' },
  '毅力': { prefix: '勇者', color: '#10b981' },
  '灵感': { prefix: '天才', color: '#ec4899' },
  '表达': { prefix: '名师', color: '#3b82f6' },
  '心志': { prefix: '圣者', color: '#ef4444' },
}

// 双峰型称号
const DOUBLE_PEAK_TITLES = {
  '智识_灵感': { prefix: '鬼才', color: '#a855f7' },
  '智识_表达': { prefix: '博文', color: '#3b82f6' },
  '专注_毅力': { prefix: '铁壁', color: '#f59e0b' },
  '专注_心志': { prefix: '静心', color: '#ef4444' },
  '毅力_心志': { prefix: '铁魂', color: '#10b981' },
  '灵感_表达': { prefix: '妙语', color: '#ec4899' },
}

// 专精型称号（正向措辞）
const SPECIALIZED_TITLES = {
  '智识': { prefix: '行动派', color: '#10b981' },
  '专注': { prefix: '灵感派', color: '#ec4899' },
  '毅力': { prefix: '速攻派', color: '#f59e0b' },
  '灵感': { prefix: '实务派', color: '#3b82f6' },
  '表达': { prefix: '沉思者', color: '#8b5cf6' },
  '心志': { prefix: '热血派', color: '#ef4444' },
}

// 均衡型称号
const BALANCED_TITLE = { prefix: '六边形', color: '#6366f1' }

const TALENT_BASE_ATTRS = {
  'A1': [12, 8, 8, 10, 8, 9], 'A2': [11, 10, 8, 9, 8, 9], 'A3': [10, 8, 7, 12, 9, 9], 'A4': [9, 9, 11, 8, 8, 10],
  'B1': [9, 11, 11, 8, 8, 10], 'B2': [10, 13, 9, 7, 8, 9], 'B3': [9, 9, 10, 8, 9, 12], 'B4': [10, 10, 10, 9, 9, 9],
  'C1': [10, 9, 8, 9, 12, 8], 'C2': [9, 8, 8, 11, 11, 8], 'C3': [9, 7, 7, 13, 10, 8], 'C4': [9, 9, 9, 9, 10, 10],
  'D1': [9, 9, 9, 7, 8, 14], 'D2': [8, 9, 11, 8, 8, 12], 'D3': [9, 11, 9, 8, 9, 11], 'D4': [9, 9, 10, 8, 8, 11],
  'E1': [11, 9, 8, 9, 11, 8], 'E2': [12, 8, 7, 11, 9, 8], 'E3': [11, 11, 9, 8, 8, 9], 'E4': [11, 9, 9, 9, 9, 9],
  'F1': [9, 7, 7, 15, 9, 9], 'F2': [9, 15, 7, 7, 9, 9], 'F3': [8, 9, 15, 7, 7, 10], 'F4': [8, 8, 10, 7, 8, 15], 'F5': [15, 8, 7, 9, 8, 9],
}

const TALENT_GROWTH = {
  'A1': [2.5, 0.8, 0.7, 2.0, 1.0, 1.0], 'A2': [2.2, 1.5, 0.8, 1.5, 1.0, 1.0], 'A3': [1.8, 0.8, 0.6, 2.8, 1.2, 0.8], 'A4': [1.5, 1.0, 2.5, 1.0, 0.8, 2.2],
  'B1': [1.5, 2.2, 2.0, 0.8, 0.8, 1.7], 'B2': [1.8, 2.8, 1.0, 0.5, 1.2, 1.7], 'B3': [1.2, 1.5, 2.0, 0.8, 1.0, 2.5], 'B4': [1.7, 1.7, 1.7, 1.3, 1.3, 1.3],
  'C1': [2.0, 1.0, 0.8, 1.2, 2.5, 0.5], 'C2': [1.3, 0.8, 0.8, 2.2, 2.4, 0.5], 'C3': [1.5, 0.5, 0.5, 3.0, 1.8, 0.7], 'C4': [1.5, 1.0, 1.0, 1.5, 2.0, 2.0],
  'D1': [1.5, 1.5, 1.5, 0.5, 0.8, 3.2], 'D2': [1.2, 1.2, 2.5, 0.8, 0.8, 2.5], 'D3': [1.5, 2.0, 1.2, 0.8, 1.0, 2.5], 'D4': [1.5, 1.5, 1.8, 1.2, 1.2, 1.8],
  'E1': [2.3, 1.0, 0.8, 1.2, 2.2, 0.5], 'E2': [2.5, 0.8, 0.5, 2.2, 1.2, 0.8], 'E3': [2.2, 2.0, 1.0, 0.8, 1.0, 1.0], 'E4': [2.0, 1.3, 1.2, 1.3, 1.2, 1.0],
  'F1': [1.5, 0.5, 0.5, 3.5, 1.0, 1.0], 'F2': [1.5, 3.5, 0.5, 0.5, 1.0, 1.0], 'F3': [1.0, 1.0, 3.5, 0.5, 0.5, 1.5], 'F4': [1.0, 0.8, 1.5, 0.8, 0.8, 3.1], 'F5': [3.5, 0.8, 0.5, 1.2, 1.0, 1.0],
}

const LEVEL_EXP_TABLE = [0, 1, 1, 1, 2, 2, 2, 4, 5, 6, 7, 7, 8, 9, 9, 10, 11, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 37, 39, 41, 43, 46, 48, 50, 53, 55, 57, 60, 62, 64, 66, 69, 71, 74, 78, 82, 86, 90, 93, 97, 101, 105, 109, 112, 116, 120, 124, 128, 131, 135, 139, 143, 147, 154, 162, 169, 177, 184, 192, 199, 207, 214, 222, 229, 237, 244, 252, 259, 267, 274, 282, 289, 297, 304, 312, 319, 327]

function calcLevel(totalExp) {
  let level = 1
  let accumulated = 0
  for (let i = 0; i < LEVEL_EXP_TABLE.length - 1; i++) {
    accumulated += LEVEL_EXP_TABLE[i + 1]
    if (totalExp < accumulated) {
      return level
    }
    level++
  }
  return 100
}

function calcAttributes(talentId, level) {
  const base = TALENT_BASE_ATTRS[talentId]
  const growth = TALENT_GROWTH[talentId]
  if (!base || !growth) return [10, 10, 10, 10, 10, 10]
  return base.map((b, i) => Math.floor(b + growth[i] * (level - 1)))
}

/**
 * 综合称号计算 v2.0
 */
function calcTitle(attrs, level) {
  if (!attrs || attrs.length < 6) {
    return { title: '无名', color: '#999', type: null, mainAttr: null }
  }

  const sum = attrs.reduce((a, b) => a + b, 0)
  const mean = sum / 6
  const variance = attrs.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 6
  const std = Math.sqrt(variance)

  const sortedIndices = attrs.map((val, idx) => ({ val, idx })).sort((a, b) => b.val - a.val)
  const maxVal = sortedIndices[0].val
  const maxAttr = ATTR_NAMES[sortedIndices[0].idx]
  const secondVal = sortedIndices[1].val
  const secondAttr = ATTR_NAMES[sortedIndices[1].idx]
  const thirdVal = sortedIndices[2].val
  const minVal = sortedIndices[5].val
  const minAttr = ATTR_NAMES[sortedIndices[5].idx]

  let titleType = 'singlePeak'
  let prefix = ''
  let color = SINGLE_PEAK_TITLES[maxAttr].color

  // 1. 均衡型
  if (std < mean * 0.2) {
    titleType = 'balanced'
    prefix = BALANCED_TITLE.prefix
    color = BALANCED_TITLE.color
  }
  // 2. 专精型
  else if (minVal < mean * 0.7) {
    titleType = 'specialized'
    prefix = SPECIALIZED_TITLES[minAttr].prefix
    color = SPECIALIZED_TITLES[minAttr].color
  }
  // 3. 双峰型
  else if (secondVal >= thirdVal * 1.3) {
    titleType = 'doublePeak'
    const key = [maxAttr, secondAttr].sort().join('_')
    const doublePeak = DOUBLE_PEAK_TITLES[key]
    if (doublePeak) {
      prefix = doublePeak.prefix
      color = doublePeak.color
    } else {
      prefix = SINGLE_PEAK_TITLES[maxAttr].prefix
      color = SINGLE_PEAK_TITLES[maxAttr].color
    }
  }
  // 4. 单峰型
  else if (maxVal >= secondVal * 1.3) {
    titleType = 'singlePeak'
    prefix = SINGLE_PEAK_TITLES[maxAttr].prefix
    color = SINGLE_PEAK_TITLES[maxAttr].color
  }
  // 5. 默认
  else {
    prefix = SINGLE_PEAK_TITLES[maxAttr].prefix
    color = SINGLE_PEAK_TITLES[maxAttr].color
  }

  // 计算档位
  let tierSuffix = '·启明'
  for (const tier of TITLE_TIER_THRESHOLDS) {
    if (level <= tier.maxLevel) {
      tierSuffix = tier.suffix
      break
    }
  }

  // 计算档内等级
  let rankName = '初阶'
  for (const threshold of TITLE_RANK_THRESHOLDS) {
    if (level <= threshold.maxLevel) {
      rankName = threshold.name
      break
    }
  }

  return {
    title: `${prefix}${tierSuffix}·${rankName}`,
    color: color,
    type: titleType,
    mainAttr: titleType === 'balanced' ? null : (titleType === 'specialized' ? minAttr : maxAttr),
  }
}

exports.main = async (event, context) => {
  const { taskId, teacherId, action = 'confirm' } = event
  
  if (!taskId) {
    return { success: false, error: '缺少taskId' }
  }
  
  try {
    // 获取任务信息
    const taskRes = await db.collection('dailyTasks').doc(taskId).get()
    const task = taskRes.data
    
    if (!task) {
      return { success: false, error: '任务不存在' }
    }
    
    if (task.status !== 'submitted') {
      return { success: false, error: '任务状态不正确，无法确认' }
    }
    
    // 如果拒绝
    if (action === 'reject') {
      await db.collection('dailyTasks').doc(taskId).update({
        data: {
          status: 'rejected',
          confirmTime: new Date(),
          teacherId: teacherId || null
        }
      })
      
      return {
        success: true,
        message: '任务已驳回',
        taskId
      }
    }
    
    // 确认任务
    const now = new Date()
    
    // 更新任务状态
    await db.collection('dailyTasks').doc(taskId).update({
      data: {
        status: 'confirmed',
        confirmTime: now,
        teacherId: teacherId || null
      }
    })
    
    // 给学生增加经验值
    // 防御性查询：先用 _id 查，查不到（老数据 studentId 存的是 openid）再用 openid 兜底
    let studentRes = await db.collection('students').doc(task.studentId).get()
    let student = studentRes.data
    if (!student) {
      // 兜底：task.studentId 可能是 openid（历史数据）
      const fallbackRes = await db.collection('students').where({ openid: task.studentId }).get()
      student = fallbackRes.data && fallbackRes.data.length > 0 ? fallbackRes.data[0] : null
      if (student) {
        console.warn('confirmTask: 通过 openid 兜底查到学生，task.studentId 可能是 openid:', task.studentId)
      }
    }

    // 在外层声明，防止 return 时引用不到
    let newTotalExp = null
    let newDailyDrawLeft = null

    if (student) {
      const oldLevel = calcLevel(student.totalExp || 0)
      newTotalExp = (student.totalExp || 0) + task.expReward
      const newLevel = calcLevel(newTotalExp)

      // 准备更新数据
      const drawBonus = task.isSpecial ? 5 : 3

      // 判断今天日期字符串（用于跨日重置判断）
      const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const lastDrawDate = student.lastDrawDate || ''

      // 新的逻辑：基础次数 3 永远不变，bonusToday 单独记录今日任务奖励
      // 跨日时 bonusToday 重置为 drawBonus，否则累加
      let newBonusToday
      if (lastDrawDate !== todayStr) {
        // 新的一天，bonus 重置为本次奖励
        newBonusToday = drawBonus
      } else {
        // 今天已有奖励，累加（bonusToday 不存在时视为 0）
        const existingBonus = (typeof student.bonusToday === 'number') ? student.bonusToday : 0
        newBonusToday = existingBonus + drawBonus
      }
      // dailyDrawLeft 永远存基础次数 3（兼容老账号，如果 > 3 说明有历史奖励数据，保持不变）
      const newDailyDrawLeft = 3

      const updateData = {
        totalExp: newTotalExp,
        level: newLevel,  // 同步更新等级
        lastTaskCompleteTime: now,
        dailyDrawLeft: newDailyDrawLeft,  // 基础次数，固定为3
        bonusToday: newBonusToday,         // 今日任务奖励，单独累计
        lastDrawDate: todayStr,  // 修复：同步更新 lastDrawDate，防止 getDrawStatus 误判重置
      }
      
      // 如果升级了，更新称号
      if (newLevel > oldLevel) {
        const attrs = calcAttributes(student.talentId, newLevel)
        const titleInfo = calcTitle(attrs, newLevel)
        updateData.title = titleInfo.title
        updateData.titleColor = titleInfo.color
      }
      
      await db.collection('students').doc(task.studentId).update({
        data: updateData
      })

      // 记录经验日志
      await db.collection('expLogs').add({
        data: {
          studentId: task.studentId,
          classId: student.classId,
          type: 'task',
          amount: task.expReward,
          description: `完成任务：${task.title}`,
          taskId: taskId,
          createdAt: now,
          undone: false
        }
      })
      
      // 更新任务完成记录（用于徽章计算）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      await db.collection('taskCompletions').add({
        data: {
          studentId: task.studentId,
          taskId: taskId,
          date: today,
          expReward: task.expReward,
          isPreference: task.isPreference,
          isSpecial: task.isSpecial || false,
          category: task.category,
          createTime: now
        }
      })
      
      // 触发徽章检查（不等待，快速返回）
      cloud.callFunction({
        name: 'checkBadges',
        data: { studentId: task.studentId }
      }).catch(err => console.error('checkBadges error:', err))
    }
    
    return {
      success: true,
      message: '任务已确认',
      taskId,
      expReward: task.expReward,
      dailyDrawLeft: newDailyDrawLeft,  // 基础次数，永远为3
      bonusToday: newBonusToday,         // 今日任务奖励（单独累计）
      totalLeft: newDailyDrawLeft + newBonusToday,  // 当日总剩余次数
      totalExp: newTotalExp,
      studentOpenid: student.openid,
    }
    
  } catch (err) {
    console.error('confirmTask error:', err)
    return { success: false, error: err.message }
  }
}
