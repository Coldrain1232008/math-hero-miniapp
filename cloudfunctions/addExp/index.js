// cloudfunctions/addExp/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 天赋大类映射
const TALENT_MAP = {
  'A': 'explorer',    // 探索者
  'B': 'forger',      // 铸造者
  'C': 'weaver',      // 编织者
  'D': 'guardian',    // 守护者
  'E': 'guide',       // 引导者
  'F': 'breaker',     // 突破者
}

// 行为标签权重（用于自动判定）
const BEHAVIOR_WEIGHTS = {
  explorer: ['提问', '发现', '规律', '探索', '提问'],
  forger: ['练习', '作业', '完成', '认真', '书写'],
  weaver: ['讲解', '表达', '清楚', '条理', '说明'],
  guardian: ['坚持', '稳定', '连续', '登录', '打卡'],
  guide: ['总结', '归纳', '梳理', '对比', '联系'],
  breaker: ['挑战', '难题', '突破', '爆发', '超越'],
}

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

// 天赋基础属性
const TALENT_BASE_ATTRS = {
  'A1': [12, 8, 8, 10, 8, 9], 'A2': [11, 10, 8, 9, 8, 9], 'A3': [10, 8, 7, 12, 9, 9], 'A4': [9, 9, 11, 8, 8, 10],
  'B1': [9, 11, 11, 8, 8, 10], 'B2': [10, 13, 9, 7, 8, 9], 'B3': [9, 9, 10, 8, 9, 12], 'B4': [10, 10, 10, 9, 9, 9],
  'C1': [10, 9, 8, 9, 12, 8], 'C2': [9, 8, 8, 11, 11, 8], 'C3': [9, 7, 7, 13, 10, 8], 'C4': [9, 9, 9, 9, 10, 10],
  'D1': [9, 9, 9, 7, 8, 14], 'D2': [8, 9, 11, 8, 8, 12], 'D3': [9, 11, 9, 8, 9, 11], 'D4': [9, 9, 10, 8, 8, 11],
  'E1': [11, 9, 8, 9, 11, 8], 'E2': [12, 8, 7, 11, 9, 8], 'E3': [11, 11, 9, 8, 8, 9], 'E4': [11, 9, 9, 9, 9, 9],
  'F1': [9, 7, 7, 15, 9, 9], 'F2': [9, 15, 7, 7, 9, 9], 'F3': [8, 9, 15, 7, 7, 10], 'F4': [8, 8, 10, 7, 8, 15], 'F5': [15, 8, 7, 9, 8, 9],
}

// 天赋成长率
const TALENT_GROWTH = {
  'A1': [2.5, 0.8, 0.7, 2.0, 1.0, 1.0], 'A2': [2.2, 1.5, 0.8, 1.5, 1.0, 1.0], 'A3': [1.8, 0.8, 0.6, 2.8, 1.2, 0.8], 'A4': [1.5, 1.0, 2.5, 1.0, 0.8, 2.2],
  'B1': [1.5, 2.2, 2.0, 0.8, 0.8, 1.7], 'B2': [1.8, 2.8, 1.0, 0.5, 1.2, 1.7], 'B3': [1.2, 1.5, 2.0, 0.8, 1.0, 2.5], 'B4': [1.7, 1.7, 1.7, 1.3, 1.3, 1.3],
  'C1': [2.0, 1.0, 0.8, 1.2, 2.5, 0.5], 'C2': [1.3, 0.8, 0.8, 2.2, 2.4, 0.5], 'C3': [1.5, 0.5, 0.5, 3.0, 1.8, 0.7], 'C4': [1.5, 1.0, 1.0, 1.5, 2.0, 2.0],
  'D1': [1.5, 1.5, 1.5, 0.5, 0.8, 3.2], 'D2': [1.2, 1.2, 2.5, 0.8, 0.8, 2.5], 'D3': [1.5, 2.0, 1.2, 0.8, 1.0, 2.5], 'D4': [1.5, 1.5, 1.8, 1.2, 1.2, 1.8],
  'E1': [2.3, 1.0, 0.8, 1.2, 2.2, 0.5], 'E2': [2.5, 0.8, 0.5, 2.2, 1.2, 0.8], 'E3': [2.2, 2.0, 1.0, 0.8, 1.0, 1.0], 'E4': [2.0, 1.3, 1.2, 1.3, 1.2, 1.0],
  'F1': [1.5, 0.5, 0.5, 3.5, 1.0, 1.0], 'F2': [1.5, 3.5, 0.5, 0.5, 1.0, 1.0], 'F3': [1.0, 1.0, 3.5, 0.5, 0.5, 1.5], 'F4': [1.0, 0.8, 1.5, 0.8, 0.8, 3.1], 'F5': [3.5, 0.8, 0.5, 1.2, 1.0, 1.0],
}

// 等级经验表（100级）
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
  const maxIdx = sortedIndices[0].idx
  const maxAttr = ATTR_NAMES[maxIdx]
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

// ============ 原有函数 ============

/**
 * 根据学生历史行为自动判定额外加成
 * 简化版：随机给予额外奖励，后续可根据实际行为数据优化
 */
async function calculateBonus(studentId, talentId, baseExp) {
  const category = TALENT_MAP[talentId.charAt(0).toUpperCase()]
  if (!category) return 0
  
  // 30% 概率获得额外奖励
  const hasBonus = Math.random() < 0.3
  if (!hasBonus) return 0
  
  // 额外奖励 1 EXP
  return 1
}

exports.main = async (event) => {
  const { studentIds, batchList, exp, type, desc, classId, autoBonus = true } = event

  // 统一处理两种输入：
  //   studentIds + exp（相同经验）
  //   batchList: [{studentId, exp}, ...] （各自不同经验）
  let tasks = []
  if (batchList && batchList.length > 0) {
    tasks = batchList
  } else if (studentIds && studentIds.length > 0) {
    tasks = studentIds.map(id => ({ studentId: id, exp: exp || 1 }))
  }

  if (tasks.length === 0) return { success: false, message: 'no targets' }

  try {
    const results = []
    
    for (const { studentId, exp: expVal } of tasks) {
      // 获取学生信息
      const studentRes = await db.collection('students').doc(studentId).get()
      const student = studentRes.data
      
      if (!student) continue
      
      // 计算额外奖励
      let bonusExp = 0
      let totalExp = expVal
      let bonusDesc = ''
      
      if (autoBonus && type === 'class') {
        bonusExp = await calculateBonus(studentId, student.talentId, expVal)
        if (bonusExp > 0) {
          totalExp += bonusExp
          const category = TALENT_MAP[student.talentId.charAt(0).toUpperCase()]
          const categoryNames = {
            explorer: '探索者',
            forger: '铸造者',
            weaver: '编织者',
            guardian: '守护者',
            guide: '引导者',
            breaker: '突破者',
          }
          bonusDesc = `（${categoryNames[category]}加成 +${bonusExp}）`
        }
      }

      // 计算新的总经验值和等级
      const oldLevel = calcLevel(student.totalExp || 0)
      const newTotalExp = (student.totalExp || 0) + totalExp
      const newLevel = calcLevel(newTotalExp)
      
      // 准备更新数据
      const updateData = {
        totalExp: _.inc(totalExp),
        level: newLevel,  // 修复：始终同步写入最新等级，避免 level 字段缺失或过期
        updatedAt: db.serverDate(),
      }
      
      // 如果升级了，更新称号
      if (newLevel > oldLevel) {
        const attrs = calcAttributes(student.talentId, newLevel)
        const titleInfo = calcTitle(attrs, newLevel)
        updateData.title = titleInfo.title
        updateData.titleColor = titleInfo.color
      }
      
      // 1. 更新学生经验值（可能包含称号更新）
      await db.collection('students').doc(studentId).update({
        data: updateData,
      })

      // 2. 写入经验日志
      await db.collection('expLogs').add({
        data: {
          studentId,
          classId,
          amount: totalExp,
          baseExp: expVal,
          bonusExp: bonusExp,
          type: type || 'class',
          description: (desc || '') + bonusDesc,
          createdAt: db.serverDate(),
          undone: false,
        },
      })
      
      results.push({
        studentId,
        totalExp,
        bonusExp,
        hasBonus: bonusExp > 0
      })
    }

    return { success: true, count: tasks.length, results }
  } catch (e) {
    console.error(e)
    return { success: false, message: e.message }
  }
}
