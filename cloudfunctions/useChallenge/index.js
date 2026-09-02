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

// 根据经验值计算等级（与 addExp 和 gameData.js 一致，使用 LEVEL_EXP_TABLE）
const LEVEL_EXP_TABLE = [0, 1, 1, 1, 2, 2, 2, 4, 5, 6, 7, 7, 8, 9, 9, 10, 11, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 37, 39, 41, 43, 46, 48, 50, 53, 55, 57, 60, 62, 64, 66, 69, 71, 74, 78, 82, 86, 90, 93, 97, 101, 105, 109, 112, 116, 120, 124, 128, 131, 135, 139, 143, 147, 154, 162, 169, 177, 184, 192, 199, 207, 214, 222, 229, 237, 244, 252, 259, 267, 274, 282, 289, 297, 304, 312, 319, 327]

function calcLevel(totalExp) {
  let level = 1
  let accumulated = 0
  for (let i = 0; i < LEVEL_EXP_TABLE.length - 1; i++) {
    accumulated += LEVEL_EXP_TABLE[i + 1]
    if (totalExp < accumulated) {
      return level
    }
    level++
  }
  return 100
}

// 计算等级差奖励
// 规则：基础5EXP，对方比自己低≥10级时降为1EXP；对方每比自己高5级，额外+5EXP
function calcChallengeReward(myLevel, opponentLevel) {
  const levelDiff = opponentLevel - myLevel  // 正数=对手高，负数=对手低

  let baseExp = 5

  if (levelDiff <= -10) {
    // 对手比自己低10级以上，奖励降为1
    return { baseExp: 1, bonusExp: 0, levelDiff, rewardText: '1EXP', note: '对手等级过低，奖励缩水' }
  } else if (levelDiff >= 5) {
    // 对手比自己高，每高5级额外+5
    const bonusExp = Math.floor(levelDiff / 5) * 5
    return { baseExp, bonusExp, levelDiff, rewardText: `${baseExp + bonusExp}EXP`, note: `对手等级高${levelDiff}级，额外+${bonusExp}EXP` }
  } else {
    // 正常情况
    return { baseExp, bonusExp: 0, levelDiff, rewardText: `${baseExp}EXP`, note: null }
  }
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
    const studentId = event.studentId
    const openid = event.openid || cloud.getWXContext().OPENID
    const { targetId } = event

    if (!targetId) {
      return { success: false, error: '缺少 targetId' }
    }

    // 获取挑战者信息
    let me = null

    if (studentId) {
      const res = await db.collection('students').doc(studentId).get()
      me = res.data
    }

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

    // 获取被挑战者信息
    const targetRes = await db.collection('students').doc(targetId).get()
    if (!targetRes.data) {
      return { success: false, error: '对手信息不存在' }
    }
    const opponent = targetRes.data

    // 确保同班
    if (opponent.classId !== me.classId) {
      return { success: false, error: '只能挑战同班同学' }
    }

    // 计算等级和属性
    const myLevel = calcLevel(me.totalExp || 0)
    const opponentLevel = calcLevel(opponent.totalExp || 0)
    const myAttrs = calcAttributes(me.talentId || 'A1', myLevel)
    const opponentAttrs = calcAttributes(opponent.talentId || 'A1', opponentLevel)

    // 计算等级差奖励
    const reward = calcChallengeReward(myLevel, opponentLevel)

    // 进行对决
    const battle = doBattle(myAttrs, opponentAttrs)

    // 扣减挑战凭证
    await db.collection('students').doc(me._id).update({
      data: { challengeVouchers: _.inc(-1) }
    })

    // 奖惩逻辑（基于等级差）
    let expResult = null
    const totalExpReward = reward.baseExp + reward.bonusExp

    if (battle.winner === 'me') {
      // 发起者胜利：获得等级差奖励
      await db.collection('students').doc(me._id).update({
        data: { totalExp: _.inc(totalExpReward) }
      })
      await db.collection('expLogs').add({
        data: {
          studentId: me._id,
          classId: me.classId,
          type: 'challenge_win',
          amount: totalExpReward,
          baseExp: reward.baseExp,
          bonusExp: reward.bonusExp,
          levelDiff: reward.levelDiff,
          desc: `挑战「${opponent.name || opponent.heroName || '同学'}」胜利`,
          createdAt: Date.now()
        }
      })
      expResult = { winner: 'me', expAwarded: totalExpReward, baseExp: reward.baseExp, bonusExp: reward.bonusExp }
    } else if (battle.winner === 'opponent') {
      // 发起者失败：-5EXP（保底0）
      const myNewExp = (me.totalExp || 0) - 5
      if (myNewExp >= 0) {
        await db.collection('students').doc(me._id).update({
          data: { totalExp: _.inc(-5) }
        })
      } else {
        await db.collection('students').doc(me._id).update({
          data: { totalExp: -((me.totalExp || 0)) }
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
          levelDiff: reward.levelDiff,
          desc: `挑战「${opponent.name || opponent.heroName || '同学'}」失败`,
          createdAt: Date.now()
        }
      })
      // 被挑战者胜利：基础+1EXP（不因等级差变化）
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
          levelDiff: 0,
          desc: `防守「${me.name || me.heroName || '同学'}」挑战成功`,
          createdAt: Date.now()
        }
      })
      expResult = { winner: 'opponent', expAwarded: -5, baseExp: 5, bonusExp: 0 }
    } else {
      // 平局：双方无奖惩
      expResult = { winner: 'draw', expAwarded: 0, baseExp: 0, bonusExp: 0 }
    }

    // 记录挑战日志
    try {
      await db.collection('challengeLogs').add({
        data: {
          challengerId: me._id,
          challengerName: me.name || me.heroName || '未知',
          opponentId: opponent._id,
          opponentName: opponent.name || opponent.heroName || '未知',
          classId: me.classId,
          myLevel,
          opponentLevel,
          levelDiff: reward.levelDiff,
          // 只有胜利时才记录额外奖励说明
          rewardNote: battle.winner === 'me' ? (reward.note || '') : '',
          myAttrs,
          opponentAttrs,
          battleRounds: battle.rounds,
          result: battle.winner,
          challengerExpChange: battle.winner === 'me' ? totalExpReward : (battle.winner === 'opponent' ? -5 : 0),
          opponentExpChange: battle.winner === 'opponent' ? 1 : 0,
          createTime: Date.now()
        }
      })
    } catch (logErr) {
      console.warn('challengeLogs write failed (collection may not exist):', logErr.message)
    }

    // 获取挑战后我的最新状态
    const updatedMe = await db.collection('students').doc(me._id).get()
    const latestMe = updatedMe.data || {}
    const latestExp = latestMe.totalExp || me.totalExp
    const latestVouchers = typeof latestMe.challengeVouchers === 'number'
      ? latestMe.challengeVouchers
      : (me.challengeVouchers || 1) - 1

    // 异步触发徽章检查（fire-and-forget）
    try {
      cloud.callFunction({
        name: 'checkBadges',
        data: { studentId: me._id }
      }).catch(err => console.warn('checkBadges async error:', err.message))
      
      // 被挑战者也需要检查徽章（如果防守胜利）
      if (battle.winner === 'opponent') {
        cloud.callFunction({
          name: 'checkBadges',
          data: { studentId: opponent._id }
        }).catch(err => console.warn('checkBadges async error:', err.message))
      }
    } catch (e) {
      // 忽略同步错误
    }

    return {
      success: true,
      battle: {
        ...battle,
        ...expResult,
        opponentName: opponent.name || opponent.heroName || '未知',
        myName: me.name || me.heroName || '未知',
        myLevel,
        opponentLevel,
        levelDiff: reward.levelDiff,
        rewardText: reward.rewardText,
        rewardNote: reward.note
      },
      myNewExp: latestExp,
      vouchersLeft: latestVouchers
    }

  } catch (e) {
    console.error('useChallenge error:', e)
    return { success: false, error: e.message || '挑战失败' }
  }
}
