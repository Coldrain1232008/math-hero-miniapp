// 云函数：updateStudent
// 更新学生信息（移出班级、赠予重置机会等）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, studentId, data } = event
  
  if (!studentId) {
    return { success: false, error: '缺少studentId' }
  }
  
  try {
    // 移出班级（清空classId）
    if (action === 'removeFromClass') {
      await db.collection('students').doc(studentId).update({
        data: { 
          classId: '', 
          updatedAt: new Date() 
        }
      })
      return { success: true, message: '已移出班级' }
    }
    
    // 增加重置机会
    if (action === 'grantReroll') {
      await db.collection('students').doc(studentId).update({
        data: { 
          rerollChances: _.inc(1),
          updatedAt: new Date()
        }
      })
      return { success: true, message: '已赠予重置机会' }
    }
    
    // 重置天赋（保留原有名字、头像、经验等，同时扣除一次机会）
    if (action === 'rerollTalent') {
      const { talentId, talentName, talentCategory, talentColor } = event
      if (!talentId || !talentName) {
        return { success: false, error: '缺少天赋信息' }
      }
      await db.collection('students').doc(studentId).update({
        data: {
          talentId,
          talentName,
          talentCategory,
          talentColor,
          rerollChances: _.inc(-1),  // 扣除一次重置机会
          updatedAt: new Date()
        }
      })
      return { success: true, message: '天赋已重置' }
    }
    
    // 通用更新
    if (action === 'update') {
      await db.collection('students').doc(studentId).update({
        data: { ...data, updatedAt: new Date() }
      })
      return { success: true, message: '更新成功' }
    }
    
    return { success: false, error: '未知的操作类型' }
    
  } catch (err) {
    console.error('updateStudent error:', err)
    return { success: false, error: err.message }
  }
}
