// cloudfunctions/useChallenge/index.js
// 使用挑战凭证进行属性对决
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 属性优先级（相同属性时用于决出胜者）
const ATTR_PRIORITY = ['智识', '专注', '毅力', '灵感', '表达', '心志']

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

// Fisher-Yates 洗牌
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 进行对决，返回 { rounds, myWins, opponentWins, winner }
function doBattle(myAttrs, opponentAttrs) {
  const indices = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3) // 随机抽3个属性索引
  const rounds = indices.map(idx => ({
    attrName: ATTR_PRIORITY[idx],
    myValue: myAttrs[idx],
    opponentValue: opponentAttrs[idx],
    winner: myAttrs[idx] >= opponentAttrs[idx] ? 'me' : 'opponent'
  }))

  const myWins = rounds.filter(r => r.winner === 'me').length
  const opponentWins = rounds.filter(r => r.winner === 'opponent').length

  let winner = 'draw'
  if (myWins > opponentWins) winner = 'me'
  else if (opponentWins > myWins) winner = 'opponent'

  return { rounds, myWins, opponentWins, winner }
}

exports.main = async (event, context) => {
  try {
    // 优先用 studentId（_id 主键），fallback 到 openid（兼容老调用方式）
    const studentId = event.studentId
    const openid = event.openid || cloud.getWXContext().OPENID
    const { targetId } = event  // 对手的 _id

    if (!targetId) {
      return { success: false, error: '缺少 targetId' }
    }

    // 获取挑战者信息
    let me = null

    // 方式1：用 _id 主键精确查（推荐）
    if (studentId) {
      const res = await db.collection('students').doc(studentId).get()
      me = res.data
    }

    // 方式2：用 openid 兜底（兼容老数据/老调用）
    if (!me && openid) {
      const res = await db.collection('students').where({ openid }).get()
      if (res.data && res.data.length > 0) me = res.data[0]
    }

    if (!me) {
      return { success: false, error: '学生信息不存在' }
    }

    // 不能挑战自己
    if (me._id === targetId) {
      return { success: false, error: '不能挑战自己' }
    }

    // 检查是否有挑战凭证
    const vouchers = me.challengeVouchers || 0
    if (vouchers <= 0) {
      return { success: false, error: '没有挑战凭证了' }
    }

    // 获取被挑战者信息（用 _id 查）
    const targetRes = await db.collection('students').doc(targetId).get()
    if (!targetRes.data) {
      return { success: false, error: '对手信息不存在' }
    }
    const opponent = targetRes.data

    // 确保同班
    if (opponent.classId !== me.classId) {
      return { success: false, error: '只能挑战同班同学' }
    }

    // 计算属性
    const myAttrs = calcAttributes(me.talentId || 'A1', me.level || 1)
    const opponentAttrs = calcAttributes(opponent.talentId || 'A1', opponent.level || 1)

    // 进行对决
    const battle = doBattle(myAttrs, opponentAttrs)

    // 扣减挑战凭证
    await db.collection('students').doc(me._id).update({
      data: { challengeVouchers: _.inc(-1) }
    })

    // 奖惩逻辑：
    // - 发起挑战者（me）：胜+5EXP，负-5EXP（保底不低于0）
    // - 被挑战者（opponent）：对方胜则+1EXP，对方负则+0EXP（平局不奖不罚）
    let expResult = null
    if (battle.winner === 'me') {
      // 发起者胜利：+5EXP
      await db.collection('students').doc(me._id).update({
        data: { totalExp: _.inc(5) }
      })
      await db.collection('expLogs').add({
        data: {
          studentId: me._id,
          classId: me.classId,
          type: 'challenge_win',
          amount: 5,
          baseExp: 5,
          bonusExp: 0,
          desc: `挑战「${opponent.name || opponent.heroName || '同学'}」胜利`,
          createdAt: Date.now()
        }
      })
      // 被挑战者失败：无奖励（不记录）
      expResult = { winner: 'me', expAwarded: 5 }
    } else if (battle.winner === 'opponent') {
      // 发起者失败：-5EXP（保底0，防止负数）
      const myNewExp = (me.totalExp || 0) - 5
      if (myNewExp >= 0) {
        await db.collection('students').doc(me._id).update({
          data: { totalExp: _.inc(-5) }
        })
      } else {
        await db.collection('students').doc(me._id).update({
          data: { totalExp: -((me.totalExp || 0)) }  // 直接清到0
        })
      }
      await db.collection('expLogs').add({
        data: {
          studentId: me._id,
          classId: me.classId,
          type: 'challenge_lose',
          amount: -5,
          baseExp: 5,
          bonusExp: 0,
          desc: `挑战「${opponent.name || opponent.heroName || '同学'}」失败`,
          createdAt: Date.now()
        }
      })
      // 被挑战者胜利：+1EXP
      await db.collection('students').doc(opponent._id).update({
        data: { totalExp: _.inc(1) }
      })
      await db.collection('expLogs').add({
        data: {
          studentId: opponent._id,
          classId: opponent.classId,
          type: 'defend_win',
          amount: 1,
          baseExp: 1,
          bonusExp: 0,
          desc: `防守「${me.name || me.heroName || '同学'}」挑战成功`,
          createdAt: Date.now()
        }
      })
      expResult = { winner: 'opponent', expAwarded: -5 }
    } else {
      // 平局：双方无奖惩
      expResult = { winner: 'draw', expAwarded: 0 }
    }

    // 记录挑战日志（集合不存在时不影响挑战结果）
    try {
      await db.collection('challengeLogs').add({
        data: {
          challengerId: me._id,
          challengerName: me.name || me.heroName || '未知',
          opponentId: opponent._id,
          opponentName: opponent.name || opponent.heroName || '未知',
          classId: me.classId,
          myAttrs,
          opponentAttrs,
          battleRounds: battle.rounds,
          result: battle.winner,
          challengerExpChange: battle.winner === 'me' ? 5 : (battle.winner === 'opponent' ? -5 : 0),
          opponentExpChange: battle.winner === 'opponent' ? 1 : 0,
          createTime: Date.now()
        }
      })
    } catch (logErr) {
      // challengeLogs 集合不存在时忽略，不影响挑战流程
      console.warn('challengeLogs write failed (collection may not exist):', logErr.message)
    }

    // 获取挑战后我的最新状态
    const updatedMe = await db.collection('students').doc(me._id).get()
    const latestMe = updatedMe.data || {}
    const latestExp = latestMe.totalExp || me.totalExp
    const latestVouchers = typeof latestMe.challengeVouchers === 'number'
      ? latestMe.challengeVouchers
      : (me.challengeVouchers || 1) - 1

    return {
      success: true,
      battle: {
        ...battle,
        ...expResult,
        opponentName: opponent.name || opponent.heroName || '未知',
        myName: me.name || me.heroName || '未知'
      },
      myNewExp: latestExp,
      vouchersLeft: latestVouchers
    }

  } catch (e) {
    console.error('useChallenge error:', e)
    return { success: false, error: e.message || '挑战失败' }
  }
}
