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

      // 1. 更新学生经验值
      await db.collection('students').doc(studentId).update({
        data: {
          totalExp: _.inc(totalExp),
          updatedAt: db.serverDate(),
        },
      })

      // 2. 写入经验日志
      await db.collection('expLogs').add({
        data: {
          studentId,
          classId,
          exp: totalExp,
          baseExp: expVal,
          bonusExp: bonusExp,
          type: type || 'class',
          desc: (desc || '') + bonusDesc,
          createdAt: db.serverDate(),
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
