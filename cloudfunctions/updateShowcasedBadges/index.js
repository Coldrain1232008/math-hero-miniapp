// 云函数：updateShowcasedBadges
// 更新用户选择展示的徽章ID数组

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId, badgeIds } = event
  
  if (!studentId) {
    return { success: false, error: '缺少studentId' }
  }
  
  // 验证 badgeIds 是数组
  if (!Array.isArray(badgeIds)) {
    return { success: false, error: 'badgeIds 必须是数组' }
  }
  
  // 验证长度不超过3
  if (badgeIds.length > 3) {
    return { success: false, error: '最多展示3个徽章' }
  }
  
  try {
    // 获取学生信息
    const studentRes = await db.collection('students').doc(studentId).get()
    const student = studentRes.data
    
    if (!student) {
      return { success: false, error: '学生不存在' }
    }
    
    // 验证每个 badgeId 都是已获得的徽章
    if (badgeIds.length > 0) {
      const badgeRes = await db.collection('badgeStatus')
        .where({
          studentId,
          badgeId: db.command.in(badgeIds),
          currentLevel: db.command.gt(0)
        })
        .get()
      
      const achievedBadgeIds = badgeRes.data.map(b => b.badgeId)
      const invalidIds = badgeIds.filter(id => !achievedBadgeIds.includes(id))
      
      if (invalidIds.length > 0) {
        return { success: false, error: `以下徽章未获得：${invalidIds.join(', ')}` }
      }
    }
    
    // 更新学生记录
    await db.collection('students').doc(studentId).update({
      data: {
        showcasedBadges: badgeIds
      }
    })
    
    return {
      success: true,
      showcasedBadges: badgeIds
    }
    
  } catch (err) {
    console.error('updateShowcasedBadges error:', err)
    return { success: false, error: err.message }
  }
}
