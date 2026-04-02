// utils/gameData.js
// ============================================================
// 游戏核心数据配置
// 属性说明：智识/专注/毅力/灵感/表达/心志
// ============================================================

/**
 * 天赋大类 × 子类
 * growth: 每升一级各属性增加的点数（对应 [智识, 专注, 毅力, 灵感, 表达, 心志]）
 * baseAttrs: 角色初始属性值
 */
const TALENT_DATA = {
  // ============ A类：探索者 ============
  A: {
    name: '探索者',
    desc: '善于发现规律，思维活跃',
    color: '#6c63ff',
    subtypes: [
      {
        id: 'A1',
        name: '星图探索者',
        desc: '擅长找到问题的内在规律，智识与灵感双高成长',
        growth: [2.5, 0.8, 0.7, 2.0, 1.0, 1.0],
        baseAttrs: [12, 8, 8, 10, 8, 9],
      },
      {
        id: 'A2',
        name: '迷宫探索者',
        desc: '在复杂问题中抽丝剥茧，智识与专注均衡成长',
        growth: [2.2, 1.5, 0.8, 1.5, 1.0, 1.0],
        baseAttrs: [11, 10, 8, 9, 8, 9],
      },
      {
        id: 'A3',
        name: '海图探索者',
        desc: '好奇心驱动学习，灵感爆发型',
        growth: [1.8, 0.8, 0.6, 2.8, 1.2, 0.8],
        baseAttrs: [10, 8, 7, 12, 9, 9],
      },
      {
        id: 'A4',
        name: '废墟探索者',
        desc: '越挫越勇，毅力与心志极高成长',
        growth: [1.5, 1.0, 2.5, 1.0, 0.8, 2.2],
        baseAttrs: [9, 9, 11, 8, 8, 10],
      },
    ],
  },

  // ============ B类：铸造者 ============
  B: {
    name: '铸造者',
    desc: '踏实稳健，积累型学习者',
    color: '#f59e0b',
    subtypes: [
      {
        id: 'B1',
        name: '烈火铸造者',
        desc: '专注与毅力并重，稳定输出高分',
        growth: [1.5, 2.2, 2.0, 0.8, 0.8, 1.7],
        baseAttrs: [9, 11, 11, 8, 8, 10],
      },
      {
        id: 'B2',
        name: '寒冰铸造者',
        desc: '沉稳冷静，专注力极强，不受干扰',
        growth: [1.8, 2.8, 1.0, 0.5, 1.2, 1.7],
        baseAttrs: [10, 13, 9, 7, 8, 9],
      },
      {
        id: 'B3',
        name: '岩石铸造者',
        desc: '心志坚定，长线积累爆发强',
        growth: [1.2, 1.5, 2.0, 0.8, 1.0, 2.5],
        baseAttrs: [9, 9, 10, 8, 9, 12],
      },
      {
        id: 'B4',
        name: '光明铸造者',
        desc: '全面均衡发展，没有明显短板',
        growth: [1.7, 1.7, 1.7, 1.3, 1.3, 1.3],
        baseAttrs: [10, 10, 10, 9, 9, 9],
      },
    ],
  },

  // ============ C类：编织者 ============
  C: {
    name: '编织者',
    desc: '善于表达与组织，逻辑清晰',
    color: '#10b981',
    subtypes: [
      {
        id: 'C1',
        name: '语言编织者',
        desc: '答题条理清晰，表达与智识均衡成长',
        growth: [2.0, 1.0, 0.8, 1.2, 2.5, 0.5],
        baseAttrs: [10, 9, 8, 9, 12, 8],
      },
      {
        id: 'C2',
        name: '图腾编织者',
        desc: '善用图形辅助思考，灵感与表达双高',
        growth: [1.3, 0.8, 0.8, 2.2, 2.4, 0.5],
        baseAttrs: [9, 8, 8, 11, 11, 8],
      },
      {
        id: 'C3',
        name: '梦境编织者',
        desc: '思维跳跃，灵感超强但需要锻炼专注',
        growth: [1.5, 0.5, 0.5, 3.0, 1.8, 0.7],
        baseAttrs: [9, 7, 7, 13, 10, 8],
      },
      {
        id: 'C4',
        name: '命运编织者',
        desc: '心志支撑表达，越重要的考试越超常发挥',
        growth: [1.5, 1.0, 1.0, 1.5, 2.0, 2.0],
        baseAttrs: [9, 9, 9, 9, 10, 10],
      },
    ],
  },

  // ============ D类：守护者 ============
  D: {
    name: '守护者',
    desc: '稳定可靠，保持高度自律',
    color: '#ec4899',
    subtypes: [
      {
        id: 'D1',
        name: '圣盾守护者',
        desc: '心志最强，面对压力从容不迫',
        growth: [1.5, 1.5, 1.5, 0.5, 0.8, 3.2],
        baseAttrs: [9, 9, 9, 7, 8, 14],
      },
      {
        id: 'D2',
        name: '自然守护者',
        desc: '毅力与心志双高，持久稳定',
        growth: [1.2, 1.2, 2.5, 0.8, 0.8, 2.5],
        baseAttrs: [8, 9, 11, 8, 8, 12],
      },
      {
        id: 'D3',
        name: '星光守护者',
        desc: '专注与心志支撑，考场稳定发挥',
        growth: [1.5, 2.0, 1.2, 0.8, 1.0, 2.5],
        baseAttrs: [9, 11, 9, 8, 9, 11],
      },
      {
        id: 'D4',
        name: '黎明守护者',
        desc: '所有属性持续稳定成长，适应各种学习场景',
        growth: [1.5, 1.5, 1.8, 1.2, 1.2, 1.8],
        baseAttrs: [9, 9, 10, 8, 8, 11],
      },
    ],
  },

  // ============ E类：引导者 ============
  E: {
    name: '引导者',
    desc: '善于总结归纳，思维系统性强',
    color: '#3b82f6',
    subtypes: [
      {
        id: 'E1',
        name: '光之引导者',
        desc: '智识与表达双强，擅长总结规律并表达',
        growth: [2.3, 1.0, 0.8, 1.2, 2.2, 0.5],
        baseAttrs: [11, 9, 8, 9, 11, 8],
      },
      {
        id: 'E2',
        name: '风之引导者',
        desc: '思维敏捷，智识与灵感共同高速成长',
        growth: [2.5, 0.8, 0.5, 2.2, 1.2, 0.8],
        baseAttrs: [12, 8, 7, 11, 9, 8],
      },
      {
        id: 'E3',
        name: '时之引导者',
        desc: '专注力支撑智识，稳步提升成绩',
        growth: [2.2, 2.0, 1.0, 0.8, 1.0, 1.0],
        baseAttrs: [11, 11, 9, 8, 8, 9],
      },
      {
        id: 'E4',
        name: '空之引导者',
        desc: '六维均衡中偏智识，全面发展',
        growth: [2.0, 1.3, 1.2, 1.3, 1.2, 1.0],
        baseAttrs: [11, 9, 9, 9, 9, 9],
      },
    ],
  },

  // ============ F类：突破者 ============
  F: {
    name: '突破者',
    desc: '天赋异禀，在某一维度爆发',
    color: '#ef4444',
    subtypes: [
      {
        id: 'F1',
        name: '烈焰突破者',
        desc: '灵感极强，创意解题无人能及',
        growth: [1.5, 0.5, 0.5, 3.5, 1.0, 1.0],
        baseAttrs: [9, 7, 7, 15, 9, 9],
      },
      {
        id: 'F2',
        name: '雷霆突破者',
        desc: '专注力惊人，一旦投入进入极度高效状态',
        growth: [1.5, 3.5, 0.5, 0.5, 1.0, 1.0],
        baseAttrs: [9, 15, 7, 7, 9, 9],
      },
      {
        id: 'F3',
        name: '钢铁突破者',
        desc: '毅力无与伦比，最擅长题海战术',
        growth: [1.0, 1.0, 3.5, 0.5, 0.5, 1.5],
        baseAttrs: [8, 9, 15, 7, 7, 10],
      },
      {
        id: 'F4',
        name: '深渊突破者',
        desc: '心志碾压一切，在极端压力下反而爆发',
        growth: [1.0, 0.8, 1.5, 0.8, 0.8, 3.1],
        baseAttrs: [8, 8, 10, 7, 8, 15],
      },
      {
        id: 'F5',
        name: '黄金突破者',
        desc: '智识爆炸型，天生对数学有感觉',
        growth: [3.5, 0.8, 0.5, 1.2, 1.0, 1.0],
        baseAttrs: [15, 8, 7, 9, 8, 9],
      },
    ],
  },
}

/**
 * Upgrade experience table (v1.0.1: 100 levels)
 * Design goals:
 *   - Lv1-3: 1 EXP each (every class score = level up!)
 *   - Lv10: cumulative ~31 EXP (~1 week active student)
 *   - Lv20: cumulative ~135 EXP (~1 month, with some exams)
 *   - Lv35: cumulative ~476 EXP (mid-semester active)
 *   - Lv50: cumulative ~1139 EXP (full semester top student)
 *   - Lv100: cumulative ~9453 EXP (legendary, almost impossible)
 *
 * Typical semester EXP:
 *   - Top student:    ~940 EXP (6 exams ranked #1 + 40 class scores) -> Lv47
 *   - Average student: ~430 EXP (6 exams mid-rank + 10 class scores) -> Lv34
 *
 * Experience sources:
 *   - Class score: +1 EXP per award
 *   - Exam rank #1: +150 EXP, last place: +50 EXP, linear interpolation
 */
const LEVEL_EXP_TABLE = [0, 1, 1, 1, 2, 2, 2, 4, 5, 6, 7, 7, 8, 9, 9, 10, 11, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 37, 39, 41, 43, 46, 48, 50, 53, 55, 57, 60, 62, 64, 66, 69, 71, 74, 78, 82, 86, 90, 93, 97, 101, 105, 109, 112, 116, 120, 124, 128, 131, 135, 139, 143, 147, 154, 162, 169, 177, 184, 192, 199, 207, 214, 222, 229, 237, 244, 252, 259, 267, 274, 282, 289, 297, 304, 312, 319, 327]
const MAX_LEVEL = 100

/**
 * 根据班级总人数和排名，计算本次考试经验值
 * 排名第1 → 150，排名末位 → 50，中间线性插值
 */
function calcScoreExp(rank, total) {
  if (total <= 1) return 150
  const ratio = (rank - 1) / (total - 1) // 0(第一) ~ 1(最后)
  return Math.round(150 - ratio * 100) // 150 → 50
}

/**
 * 自定义经验值计算
 * @param {number} rank - 排名（从1开始）
 * @param {number} total - 总人数
 * @param {number} maxExp - 第一名经验值
 * @param {number} minExp - 最后一名经验值
 * @param {string} rule - 递减规则：linear|exponential|logarithmic|normal
 */
function calcScoreExpCustom(rank, total, maxExp = 150, minExp = 50, rule = 'linear') {
  if (total <= 1) return maxExp
  const ratio = (rank - 1) / (total - 1) // 0(第一) ~ 1(最后)
  const range = maxExp - minExp
  
  let factor
  switch (rule) {
    case 'exponential':
      // 指数递减：前几名差距大，后面差距小
      // 使用指数曲线：e^(x*ln(0.1))，从1降到0.1
      factor = Math.exp(ratio * Math.log(0.1))
      break
    case 'logarithmic':
      // 对数递减：前几名差距小，后面差距大
      // 使用对数曲线：1 - ln(1+x*(e-1))/1
      factor = 1 - Math.log(1 + ratio * (Math.E - 1))
      break
    case 'normal':
      // 正态递减：中间变化平缓，两端变化大
      // 使用正态分布的累积分布函数近似
      // 将ratio映射到[-2, 2]区间，然后计算erf近似
      const x = (ratio - 0.5) * 4
      factor = 0.5 * (1 - Math.tanh(x))
      break
    case 'linear':
    default:
      // 线性递减
      factor = 1 - ratio
      break
  }
  
  return Math.round(minExp + range * factor)
}

/**
 * 根据累计经验值计算当前等级和本级进度
 */
function calcLevel(totalExp) {
  let level = 1
  let accumulated = 0
  for (let i = 0; i < MAX_LEVEL - 1; i++) {
    accumulated += LEVEL_EXP_TABLE[i + 1]
    if (totalExp < accumulated) {
      const prevAccumulated = accumulated - LEVEL_EXP_TABLE[i + 1]
      const progressExp = totalExp - prevAccumulated
      const needExp = LEVEL_EXP_TABLE[i + 1]
      return {
        level: level,
        progressExp,
        needExp,
        percent: Math.floor((progressExp / needExp) * 100),
      }
    }
    level++
  }
  // 满级
  return { level: MAX_LEVEL, progressExp: 0, needExp: 0, percent: 100 }
}

/**
 * 根据天赋ID和等级计算当前属性值
 */
function calcAttributes(talentId, level) {
  const talent = getTalentById(talentId)
  if (!talent) return [10, 10, 10, 10, 10, 10]
  const base = talent.baseAttrs
  const growth = talent.growth
  return base.map((b, i) => Math.floor(b + growth[i] * (level - 1)))
}

/**
 * 随机获取一个天赋子类
 */
function randomTalent() {
  const keys = Object.keys(TALENT_DATA)
  const randKey = keys[Math.floor(Math.random() * keys.length)]
  const subtypes = TALENT_DATA[randKey].subtypes
  const randSubtype = subtypes[Math.floor(Math.random() * subtypes.length)]
  return {
    categoryId: randKey,
    categoryName: TALENT_DATA[randKey].name,
    color: TALENT_DATA[randKey].color,
    ...randSubtype,
  }
}

/**
 * 根据天赋ID查找天赋数据
 */
function getTalentById(talentId) {
  for (const key of Object.keys(TALENT_DATA)) {
    const found = TALENT_DATA[key].subtypes.find(t => t.id === talentId)
    if (found) return { ...found, categoryName: TALENT_DATA[key].name, color: TALENT_DATA[key].color }
  }
  return null
}

/**
 * 称号系统 v2.0 - 综合六维属性分布
 * 
 * 称号格式：[属性类型称号][档位名][档内等级]
 * 示例：学神·启明·初阶、鬼才·洞察·精通、六边形·天算·大成
 */

// ============ 档内等级配置（11档，与升级曲线互补） ============
const TITLE_RANK_THRESHOLDS = [
  { maxLevel: 20,  rank: 1, name: '初阶' },  // Lv.1-20, 20级
  { maxLevel: 30,  rank: 2, name: '入门' },  // Lv.21-30, 10级
  { maxLevel: 40,  rank: 3, name: '登堂' },  // Lv.31-40, 10级
  { maxLevel: 55,  rank: 4, name: '小成' },  // Lv.41-55, 15级
  { maxLevel: 70,  rank: 5, name: '精通' },  // Lv.56-70, 15级
  { maxLevel: 85,  rank: 6, name: '大成' },  // Lv.71-85, 15级
  { maxLevel: 100, rank: 7, name: '化境' },  // Lv.86-100, 15级
]

// ============ 档位配置（3档） ============
const TITLE_TIER_THRESHOLDS = [
  { maxLevel: 10,  tier: 1, suffix: '·启明', color: '#6c63ff' },  // Lv.1-10
  { maxLevel: 25,  tier: 2, suffix: '·洞察', color: '#8b5cf6' },  // Lv.11-25
  { maxLevel: Infinity, tier: 3, suffix: '·天算', color: '#a855f7' }, // Lv.26+
]

// ============ 属性类型定义 ============
const ATTR_NAMES = ['智识', '专注', '毅力', '灵感', '表达', '心志']

// 属性优先级（相同属性时用于决出胜者）
const ATTR_PRIORITY = ['智识', '毅力', '心志', '专注', '灵感', '表达']

// ============ 单峰型称号（6种属性） ============
const SINGLE_PEAK_TITLES = {
  '智识': { prefix: '学神', color: '#6c63ff' },
  '专注': { prefix: '战神', color: '#f59e0b' },
  '毅力': { prefix: '勇者', color: '#10b981' },
  '灵感': { prefix: '天才', color: '#ec4899' },
  '表达': { prefix: '名师', color: '#3b82f6' },
  '心志': { prefix: '圣者', color: '#ef4444' },
}

// ============ 双峰型称号（6种组合） ============
const DOUBLE_PEAK_TITLES = {
  '智识_灵感': { prefix: '鬼才', color: '#a855f7' },
  '智识_表达': { prefix: '博文', color: '#3b82f6' },
  '专注_毅力': { prefix: '铁壁', color: '#f59e0b' },
  '专注_心志': { prefix: '静心', color: '#ef4444' },
  '毅力_心志': { prefix: '铁魂', color: '#10b981' },
  '灵感_表达': { prefix: '妙语', color: '#ec4899' },
}

// ============ 专精型称号（6种弱势属性，正向措辞） ============
const SPECIALIZED_TITLES = {
  '智识': { prefix: '行动派', color: '#10b981' },
  '专注': { prefix: '灵感派', color: '#ec4899' },
  '毅力': { prefix: '速攻派', color: '#f59e0b' },
  '灵感': { prefix: '实务派', color: '#3b82f6' },
  '表达': { prefix: '沉思者', color: '#8b5cf6' },
  '心志': { prefix: '热血派', color: '#ef4444' },
}

// ============ 均衡型称号 ============
const BALANCED_TITLE = { prefix: '六边形', color: '#6366f1' }

/**
 * 根据六维属性和等级计算综合称号
 * @param {number[]} attrs - 六维属性数组 [智识, 专注, 毅力, 灵感, 表达, 心志]
 * @param {number} level - 当前等级
 * @returns {Object} { title: '学神·启明·初阶', color: '#6c63ff', type: 'singlePeak', mainAttr: '智识' }
 */
function calcTitle(attrs, level) {
  if (!attrs || attrs.length < 6) {
    return { title: '无名', color: '#999', type: null, mainAttr: null }
  }

  // ============ 第1步：分析属性分布 ============
  const sum = attrs.reduce((a, b) => a + b, 0)
  const mean = sum / 6
  const variance = attrs.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 6
  const std = Math.sqrt(variance)

  // 找出排序后的属性
  const sortedIndices = attrs
    .map((val, idx) => ({ val, idx }))
    .sort((a, b) => b.val - a.val)
  
  const maxVal = sortedIndices[0].val
  const maxIdx = sortedIndices[0].idx
  const maxAttr = ATTR_NAMES[maxIdx]
  
  const secondVal = sortedIndices[1].val
  const secondIdx = sortedIndices[1].idx
  const secondAttr = ATTR_NAMES[secondIdx]
  
  const thirdVal = sortedIndices[2].val
  const minVal = sortedIndices[5].val
  const minIdx = sortedIndices[5].idx
  const minAttr = ATTR_NAMES[minIdx]

  // ============ 第2步：判断分布类型 ============
  let titleType = 'singlePeak'
  let prefix = ''
  let color = SINGLE_PEAK_TITLES[maxAttr].color

  // 1. 均衡型：标准差 < 平均值×0.2
  if (std < mean * 0.2) {
    titleType = 'balanced'
    prefix = BALANCED_TITLE.prefix
    color = BALANCED_TITLE.color
  }
  // 2. 专精型：最低 < 平均值×0.7（且不是均衡型）
  else if (minVal < mean * 0.7) {
    titleType = 'specialized'
    prefix = SPECIALIZED_TITLES[minAttr].prefix
    color = SPECIALIZED_TITLES[minAttr].color
  }
  // 3. 双峰型：前二高 > 第三×1.3
  else if (secondVal >= thirdVal * 1.3) {
    titleType = 'doublePeak'
    // 组合键：按字母排序确保一致性
    const key = [maxAttr, secondAttr].sort().join('_')
    const doublePeak = DOUBLE_PEAK_TITLES[key]
    if (doublePeak) {
      prefix = doublePeak.prefix
      color = doublePeak.color
    } else {
      // 回退到单峰型
      prefix = SINGLE_PEAK_TITLES[maxAttr].prefix
      color = SINGLE_PEAK_TITLES[maxAttr].color
    }
  }
  // 4. 单峰型：最高 > 次高×1.3
  else if (maxVal >= secondVal * 1.3) {
    titleType = 'singlePeak'
    prefix = SINGLE_PEAK_TITLES[maxAttr].prefix
    color = SINGLE_PEAK_TITLES[maxAttr].color
  }
  // 5. 默认：单峰型（最高属性）
  else {
    titleType = 'singlePeak'
    prefix = SINGLE_PEAK_TITLES[maxAttr].prefix
    color = SINGLE_PEAK_TITLES[maxAttr].color
  }

  // ============ 第3步：计算档位 ============
  let tierSuffix = '·启明'
  let tierColor = '#6c63ff'
  for (const tier of TITLE_TIER_THRESHOLDS) {
    if (level <= tier.maxLevel) {
      tierSuffix = tier.suffix
      tierColor = tier.color
      break
    }
  }

  // ============ 第4步：计算档内等级 ============
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

module.exports = {
  TALENT_DATA,
  LEVEL_EXP_TABLE,
  MAX_LEVEL,
  ATTR_NAMES,
  ATTR_PRIORITY,
  TITLE_RANK_THRESHOLDS,
  TITLE_TIER_THRESHOLDS,
  SINGLE_PEAK_TITLES,
  DOUBLE_PEAK_TITLES,
  SPECIALIZED_TITLES,
  BALANCED_TITLE,
  calcScoreExp,
  calcScoreExpCustom,
  calcLevel,
  calcAttributes,
  calcTitle,
  randomTalent,
  getTalentById,
}
