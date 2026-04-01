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
 * 升级经验表（参考游戏数值：前期平缓，中期加速，后期陡峭）
 * 设计思路：
 *   - 每天最多获得约 5 经验（1节课1经验 × 5节）
 *   - 优秀考试可得 100-150 经验
 *   - 让学生在一个学期（约18周）内能升到 10-15 级
 *   - 20级封顶，留有空间感
 */
const LEVEL_EXP_TABLE = [
  0,    // Lv1 起始
  50,   // Lv1→2  累计 50
  120,  // Lv2→3  累计 170
  210,  // Lv3→4  累计 380
  320,  // Lv4→5  累计 700
  450,  // Lv5→6  累计 1150
  600,  // Lv6→7  累计 1750
  780,  // Lv7→8  累计 2530
  990,  // Lv8→9  累计 3520
  1230, // Lv9→10 累计 4750
  1500, // Lv10→11 累计 6250
  1800, // Lv11→12 累计 8050
  2130, // Lv12→13 累计 10180
  2490, // Lv13→14 累计 12670
  2880, // Lv14→15 累计 15550
  3300, // Lv15→16 累计 18850
  3750, // Lv16→17 累计 22600
  4230, // Lv17→18 累计 26830
  4740, // Lv18→19 累计 31570
  5280, // Lv19→20 累计 36850（满级）
]
const MAX_LEVEL = 20

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
 * 属性名称列表（顺序对应 growth 数组）
 */
const ATTR_NAMES = ['智识', '专注', '毅力', '灵感', '表达', '心志']

module.exports = {
  TALENT_DATA,
  LEVEL_EXP_TABLE,
  MAX_LEVEL,
  ATTR_NAMES,
  calcScoreExp,
  calcLevel,
  calcAttributes,
  randomTalent,
  getTalentById,
}
