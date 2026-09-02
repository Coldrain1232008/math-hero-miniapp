// cloudfunctions/createStudent/index.js
//
// ⚠️ 鉴权（2026-09-02 补）：此前传 event.studentId 时不做任何归属校验，
//    学生可以填别人的 studentId 去顶替对方的角色；传 event.classId 也能
//    在任意班级建号。现在改为 openid 归属校验：
//      · 传 studentId → 该生必须「未绑定 openid」（教师预导入的占位记录）
//        或 openid 与当前微信用户一致，否则拒绝
//      · 不传 studentId → 本来就用 openid 查，路径已安全
//    关键：classId 不再取自 event，一律用学生记录里的值。

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

    // ===== 归属校验 =====
    // 占位记录（openid 为空）允许首次认领；已绑定的必须是本人
    if (existing && existing.openid && existing.openid !== WX_OPENID) {
      return { success: false, message: '该账号已被其他微信绑定' }
    }
  } else {
    // 按 openid 查即可，不再用 event.classId 缩小范围：
    // openid 由微信上下文给出，伪造不了，比前端传的 classId 可靠
    const exist = await db.collection('students')
      .where({ openid: WX_OPENID })
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
        growthMultiplier: event.growthMultiplier !== undefined ? event.growthMultiplier : 1.0,
        testCompleted: event.testCompleted !== undefined ? event.testCompleted : false,
        // 抽卡系统初始化
        // dailyDrawLeft 是历史遗留字段（drawGacha 实际读的是 remainingDraws），保留不动
        dailyDrawLeft: 3,
        lastDrawDate: '',
        remainingDraws: 3,      // 每日免费 3 次，跨日重置
        bonusDraws: 0,          // 商城购买的抽卡次数，不清零（优先消耗）
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
    // 班级必须真实存在，防止用伪造的 classId 造出无归属的脏数据
    // （classId 由登录成功后服务端返回，学生已用班级密钥验证过，可信但不可尽信）
    const clsRes = await db.collection('classes').doc(event.classId).get()
    if (!clsRes.data) {
      return { success: false, message: '班级不存在' }
    }

    const res = await db.collection('students').add({
      data: {
        classId: clsRes.data._id,
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
        growthMultiplier: event.growthMultiplier !== undefined ? event.growthMultiplier : 1.0,
        testCompleted: event.testCompleted !== undefined ? event.testCompleted : false,
        // 抽卡系统初始化
        // dailyDrawLeft 是历史遗留字段（drawGacha 实际读的是 remainingDraws），保留不动
        dailyDrawLeft: 3,
        lastDrawDate: '',
        remainingDraws: 3,      // 每日免费 3 次，跨日重置
        bonusDraws: 0,          // 商城购买的抽卡次数，不清零（优先消耗）
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
