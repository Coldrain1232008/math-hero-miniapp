// cloudfunctions/getChallengeHistory/index.js
// 获取学生的挑战历史记录（我发起的 + 被挑战的）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

exports.main = async (event, context) => {
  try {
    const { studentId } = event
    if (!studentId) return { success: false, error: '缺少 studentId' }

    // 验证学生存在
    const studentRes = await db.collection('students').doc(studentId).get()
    if (!studentRes.data) {
      return { success: false, error: '学生信息不存在' }
    }

    const classId = studentRes.data.classId
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    // 查询该学生参与的所有挑战（30天内）
    const res = await db.collection('challengeLogs')
      .aggregate()
      .match({
        classId,
        createTime: _.gte(thirtyDaysAgo),
        or: [
          { challengerId: studentId },
          { opponentId: studentId }
        ]
      })
      .sort({ createTime: -1 })
      .limit(50)
      .end()

    const logs = res.list || []

    // 整理为自己发起的（asInitiator=true）和被挑战的（asInitiator=false）
    const asInitiator = []   // 我挑战别人的
    const asReceiver = []    // 别人挑战我的

    for (const log of logs) {
      const isInitiator = log.challengerId === studentId
      const myWins = isInitiator ? (log.result === 'me') : (log.result === 'opponent')
      const expChange = isInitiator ? (log.challengerExpChange || 0) : (log.opponentExpChange || 0)

      const item = {
        _id: log._id,
        myName: isInitiator ? log.challengerName : log.opponentName,
        opponentName: isInitiator ? log.opponentName : log.challengerName,
        result: log.result,
        resultText: log.result === 'me' ? '胜利' : (log.result === 'opponent' ? '失败' : '平局'),
        expChange,
        expText: expChange > 0 ? `+${expChange}` : (expChange < 0 ? `${expChange}` : '0'),
        expTextClass: expChange > 0 ? 'win' : (expChange < 0 ? 'lose' : 'draw'),
        resultClass: myWins ? 'win' : (log.result === 'draw' ? 'draw' : 'lose'),
        createTime: log.createTime,
        createTimeStr: formatTime(log.createTime)
      }

      if (isInitiator) {
        asInitiator.push(item)
      } else {
        asReceiver.push(item)
      }
    }

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
