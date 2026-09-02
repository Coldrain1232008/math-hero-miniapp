// cloudfunctions/getChallengeHistory/index.js
// 获取学生的挑战历史记录（我发起的 + 被挑战的）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { studentId } = event
    if (!studentId) return { success: false, error: '缺少 studentId' }

    console.log('查询挑战历史, studentId:', studentId)

    // 直接查询该学生参与的所有挑战记录
    const res = await db.collection('challengeLogs')
      .where(_.or([
        { challengerId: studentId },
        { opponentId: studentId }
      ]))
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()

    console.log('查询到记录数:', res.data.length)

    const logs = res.data || []

    // 整理为自己发起的（asInitiator=true）和被挑战的（asInitiator=false）
    const asInitiator = []   // 我挑战别人的
    const asReceiver = []    // 别人挑战我的

    for (const log of logs) {
      const isInitiator = log.challengerId === studentId
      const myWins = isInitiator ? (log.result === 'me') : (log.result === 'opponent')
      const expChange = isInitiator ? (log.challengerExpChange || 0) : (log.opponentExpChange || 0)

      // 等级差显示
      let levelDiffText = ''
      if (log.levelDiff !== undefined && log.levelDiff !== null) {
        if (log.levelDiff > 0) {
          levelDiffText = `对手高${log.levelDiff}级`
        } else if (log.levelDiff < 0) {
          levelDiffText = `对手低${Math.abs(log.levelDiff)}级`
        }
      }

      const item = {
        _id: log._id,
        myName: isInitiator ? log.challengerName : log.opponentName,
        opponentName: isInitiator ? log.opponentName : log.challengerName,
        result: log.result,
        resultText: log.result === 'me' ? '胜利' : (log.result === 'opponent' ? '失败' : '平局'),
        expChange,
        expText: expChange > 0 ? `+${expChange}` : (expChange < 0 ? `${expChange}` : '0'),
        expTextClass: expChange > 0 ? 'win' : (expChange < 0 ? 'lose' : 'draw'),
        rewardNote: log.rewardNote || '',  // 额外奖励说明
        resultClass: myWins ? 'win' : (log.result === 'draw' ? 'draw' : 'lose'),
        levelDiff: log.levelDiff,
        levelDiffText,
        myLevel: log.myLevel,
        opponentLevel: isInitiator ? log.opponentLevel : log.myLevel,
        createTime: log.createTime,
        createTimeStr: formatTime(log.createTime)
      }

      if (isInitiator) {
        asInitiator.push(item)
      } else {
        asReceiver.push(item)
      }
    }

    console.log('整理后 - 我发起的:', asInitiator.length, '被挑战:', asReceiver.length)

    return {
      success: true,
      asInitiator,
      asReceiver,
      total: logs.length
    }

  } catch (e) {
    console.error('getChallengeHistory error:', e)
    return { success: false, error: e.message || '获取历史记录失败' }
  }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const now = new Date()
  const todayStr = `${now.getFullYear()}${month}${day}`
  const logDateStr = `${d.getFullYear()}${month}${day}`
  if (todayStr === logDateStr) {
    return `今天 ${hour}:${min}`
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`
  if (yesterdayStr === logDateStr) {
    return `昨天 ${hour}:${min}`
  }
  return `${month}-${day} ${hour}:${min}`
}
