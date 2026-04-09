// cloudfunctions/createStudent/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { WX_OPENID } = cloud.getWXContext()

  // 支持仅获取 openid
  if (event._action === 'getOpenId') {
    return { openid: WX_OPENID }
  }

  // 防止重复创建：优先用 _id 精确查找（预导入学生），其次用 openid 查找
  let existing = null
  if (event.studentId) {
    const res = await db.collection('students').doc(event.studentId).get()
    existing = res.data
  } else {
    const exist = await db.collection('students')
      .where({ classId: event.classId, openid: WX_OPENID })
      .get()
    if (exist.data.length > 0) existing = exist.data[0]
  }

  if (existing) {
    // 已有完整角色
    if (existing.talentId && existing.talentId !== '') {
      return { success: false, message: '已有角色', id: existing._id }
    }
    // 预导入的占位记录 -> 更新为完整角色
    // 注意：保留 studentId 和 realName（教师导入时设置），只更新 heroName 等角色信息
    await db.collection('students').doc(existing._id).update({
      data: {
        openid: WX_OPENID,
        heroName: event.heroName,  // 学生设置的角色名
        gender: event.gender,
        avatar: event.avatar,
        talentId: event.talentId,
        talentName: event.talentName,
        talentCategory: event.talentCategory,
        talentColor: event.talentColor,
        // 抽卡系统初始化
        dailyDrawLeft: 3,
        lastDrawDate: '',
        challengeVouchers: 0,
        growthAccelerants: 0,
        attributeGrowthBonus: [0, 0, 0, 0, 0, 0],
        updatedAt: db.serverDate(),
      },
    })
    return { success: true, id: existing._id }
  }

  // 全新学生（未通过教师导入）- 自主注册，无学号
  try {
    const res = await db.collection('students').add({
      data: {
        classId: event.classId,
        openid: WX_OPENID,
        studentId: '',           // 自主注册无学号
        realName: '',            // 自主注册无真实姓名
        studentKey: '',          // 自主注册无个人密钥
        heroName: event.heroName,
        gender: event.gender,
        avatar: event.avatar,
        talentId: event.talentId,
        talentName: event.talentName,
        talentCategory: event.talentCategory,
        talentColor: event.talentColor,
        totalExp: 0,
        level: 1,
        rerollChances: 0,
        // 抽卡系统初始化
        dailyDrawLeft: 3,
        lastDrawDate: '',
        challengeVouchers: 0,
        growthAccelerants: 0,
        attributeGrowthBonus: [0, 0, 0, 0, 0, 0],
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
    return { success: true, id: res._id }
  } catch (e) {
    return { success: false, message: e.message }
  }
}
