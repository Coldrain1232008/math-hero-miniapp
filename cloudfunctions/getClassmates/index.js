// cloudfunctions/getClassmates/index.js
// 获取同班同学列表，用于挑战功能
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ATTR_NAMES_ZH = ['智识', '专注', '毅力', '灵感', '表达', '心志']
const ATTR_NAMES_EN = ['wisdom', 'focus', 'perseverance', 'inspiration', 'expression', 'willpower']

// 根据天赋和等级计算当前属性
function calcAttributes(talentId, level) {
  const TALENT_BASE = {
    A: [12, 8, 8, 10, 8, 9], B: [11, 10, 8, 9, 8, 9],
    C: [9, 9, 8, 9, 12, 8], D: [9, 10, 10, 8, 8, 10],
    E: [11, 9, 8, 9, 11, 8], F: [8, 9, 10, 9, 8, 11]
  }
  const TALENT_GROWTH = {
    A: [2.5, 0.8, 0.7, 2.0, 1.0, 1.0], B: [2.2, 1.5, 0.8, 1.5, 1.0, 1.0],
    C: [2.0, 1.0, 0.8, 1.2, 2.5, 0.5], D: [1.5, 2.0, 2.0, 0.8, 0.8, 1.0],
    E: [2.3, 1.0, 0.8, 1.2, 2.2, 0.5], F: [1.0, 1.5, 1.5, 1.5, 1.0, 2.0]
  }
  const base = TALENT_BASE[talentId.charAt(0).toUpperCase()] || [10, 10, 10, 10, 10, 10]
  const growth = TALENT_GROWTH[talentId.charAt(0).toUpperCase()] || [1, 1, 1, 1, 1, 1]
  return base.map((b, i) => Math.floor(b + growth[i] * (level - 1)))
}

exports.main = async (event, context) => {
  try {
    const { openid, targetOpenid } = event

    if (!openid) return { success: false, error: '缺少 openid' }

    // 获取自己的信息
    const myRes = await db.collection('students').where({ openid }).get()
    if (!myRes.data || myRes.data.length === 0) {
      return { success: false, error: '学生信息不存在' }
    }
    const my = myRes.data[0]

    // 查询同班同学（排除自己）
    // 先按 classId 查所有同学，再用 JS 过滤自己
    const classmatesRes = await db.collection('students')
      .where({ classId: my.classId })
      .field({
        _id: true, realName: true, heroName: true, openid: true,
        talentId: true, totalExp: true, level: true
      })
      .orderBy('totalExp', 'desc')
      .limit(50)  // 防止数据量过大
      .get()

    const rawData = classmatesRes.data || []
    // 详细调试：看所有原始 openid
    const allOpenids = rawData.map(s => s.openid)
    const filteredData = rawData.filter(s => s.openid && s.openid !== openid)
    const classmates = filteredData.map(s => {
      const attrs = calcAttributes(s.talentId || 'A1', s.level || 1)
      return {
        openid: s.openid,
        name: s.realName || s.heroName || '未知',
        level: s.level || 1,
        totalExp: s.totalExp || 0,
        attrs
      }
    })

    return {
      success: true,
      classmates,
      // DEBUG
      debug: {
        myClassId: my.classId,
        rawCount: rawData.length,
        myOpenid: openid,
        allOpenids,
        filteredCount: filteredData.length,
        classmatesCount: classmates.length
      }
    }

  } catch (e) {
    console.error('getClassmates error:', e)
    return { success: false, error: e.message || '获取同学列表失败' }
  }
}
