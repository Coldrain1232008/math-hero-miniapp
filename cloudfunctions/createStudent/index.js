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

  // 防止重复创建
  const exist = await db.collection('students')
    .where({ classId: event.classId, openid: WX_OPENID })
    .get()

  if (exist.data.length > 0) {
    // 如果是预导入的占位记录，更新它
    const existing = exist.data[0]
    if (!existing.talentId || existing.talentId === '') {
      // 更新预导入的占位记录
      await db.collection('students').doc(existing._id).update({
        data: {
          heroName: event.heroName,
          gender: event.gender,
          avatar: event.avatar,
          talentId: event.talentId,
          talentName: event.talentName,
          talentCategory: event.talentCategory,
          talentColor: event.talentColor,
          updatedAt: db.serverDate(),
        },
      })
      return { success: true, id: existing._id }
    }
    return { success: false, message: '已有角色', id: existing._id }
  }

  try {
    const res = await db.collection('students').add({
      data: {
        classId: event.classId,
        openid: WX_OPENID,
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
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
    return { success: true, id: res._id }
  } catch (e) {
    return { success: false, message: e.message }
  }
}
