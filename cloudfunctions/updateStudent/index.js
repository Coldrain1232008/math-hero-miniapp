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
      const { talentId, talentName, talentCategory, talentColor, growthMultiplier, testCompleted } = event
      if (!talentId || !talentName) {
        return { success: false, error: '缺少天赋信息' }
      }
      await db.collection('students').doc(studentId).update({
        data: {
          talentId,
          talentName,
          talentCategory,
          talentColor,
          growthMultiplier: growthMultiplier !== undefined ? growthMultiplier : 1.0,
          testCompleted: testCompleted !== undefined ? testCompleted : false,
          rerollChances: _.inc(-1),  // 扣除一次重置机会
          updatedAt: new Date()
        }
      })
      return { success: true, message: '天赋已重置' }
    }
    
    // 修改个人口令（学生自助）
    if (action === 'changeKey') {
      const { newKey } = event
      if (!newKey || newKey.length < 6) {
        return { success: false, error: '口令至少6位' }
      }
      // 口令格式：6位以上字母+数字
      if (!/^[A-Za-z0-9]{6,20}$/.test(newKey)) {
        return { success: false, error: '口令只能包含字母和数字' }
      }
      // 获取当前学生信息（需要classId做班级内唯一性检查）
      const stu = await db.collection('students').doc(studentId).get()
      if (stu.data.studentKey === newKey) {
        return { success: false, error: '新口令不能和当前口令相同' }
      }
      // 检查班级内是否有其他学生已使用该口令（防止登录冲突）
      const conflict = await db.collection('students').where({
        classId: stu.data.classId,
        studentKey: newKey,
        _id: _.neq(studentId),
      }).get()
      if (conflict.data.length > 0) {
        return { success: false, error: '该口令已被其他同学使用，请换一个' }
      }
      await db.collection('students').doc(studentId).update({
        data: { studentKey: newKey, updatedAt: new Date() }
      })
      return { success: true, message: '口令修改成功' }
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
