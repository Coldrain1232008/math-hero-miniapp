// cloudfunctions/useGrowthAccelerant/index.js
// 使用成长加速剂，永久提升某一属性的成长速度
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const ATTR_NAMES_ZH = ['智识', '专注', '毅力', '灵感', '表达', '心志']

exports.main = async (event, context) => {
  try {
    const { studentId, attrIndex } = event
    if (!studentId || attrIndex === undefined) {
      return { success: false, error: '缺少参数' }
    }
    if (attrIndex < 0 || attrIndex > 5) {
      return { success: false, error: '无效的属性索引' }
    }

    const studentRes = await db.collection('students').doc(studentId).get()
    if (!studentRes.data) {
      return { success: false, error: '学生信息不存在' }
    }
    const student = studentRes.data

    const accels = student.attributeGrowthBonus || [0, 0, 0, 0, 0, 0]
    if ((accels[attrIndex] || 0) >= 5) {
      return { success: false, error: '该属性成长加速已达上限（最多5次）' }
    }

    // 检查道具数量
    if ((student.growthAccelerants || 0) <= 0) {
      return { success: false, error: '没有成长加速剂了' }
    }

    // 扣道具，加成长
    accels[attrIndex] = (accels[attrIndex] || 0) + 1

    await db.collection('students').doc(studentId).update({
      data: {
        growthAccelerants: _.inc(-1),
        attributeGrowthBonus: accels
      }
    })

    // 记录日志
    await db.collection('itemLogs').add({
      data: {
        studentId: studentId,
        classId: student.classId,
        type: 'use_accelerant',
        attrIndex,
        attrName: ATTR_NAMES_ZH[attrIndex],
        growthAdd: 0.1,
        createTime: Date.now()
      }
    })

    return {
      success: true,
      attrName: ATTR_NAMES_ZH[attrIndex],
      left: (student.growthAccelerants || 1) - 1,
      currentBonus: accels
    }

    // 记录日志
    await db.collection('itemLogs').add({
      data: {
        studentId: student._id,
        classId: student.classId,
        type: 'use_accelerant',
        attrIndex,
        attrName: ATTR_NAMES_ZH[attrIndex],
        growthAdd: 0.1,
        createTime: Date.now()
      }
    })

    return {
      success: true,
      attrName: ATTR_NAMES_ZH[attrIndex],
      left: (student.growthAccelerants || 1) - 1,
      currentBonus: accels
    }

  } catch (e) {
    console.error('useGrowthAccelerant error:', e)
    return { success: false, error: e.message || '使用失败' }
  }
}
