// cloudfunctions/teacherGrantItem/index.js
// 教师端：手动给学生发放道具或增加抽卡次数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { classId, studentId, action, amount } = event

    if (!classId) return { success: false, error: '缺少 classId' }
    if (!studentId) return { success: false, error: '缺少 studentId' }
    if (!action) return { success: false, error: '缺少 action' }

    const num = typeof amount === 'number' && amount > 0 ? amount : 1

    // 获取学生信息并验证同班
    const studentRes = await db.collection('students').doc(studentId).get()
    if (!studentRes.data) {
      return { success: false, error: '学生不存在' }
    }
    const student = studentRes.data

    // 验证学生在指定的班级
    if (student.classId !== classId) {
      return { success: false, error: '只能操作本班学生' }
    }

    const today = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`
    let updateData = {}
    let logDesc = ''

    switch (action) {
      case 'challengeVoucher':
        updateData = { challengeVouchers: _.inc(num) }
        logDesc = `教师发放挑战凭证 x${num}`
        break
      case 'growthAccelerant':
        updateData = { growthAccelerants: _.inc(num) }
        logDesc = `教师发放成长加速剂 x${num}`
        break
      case 'addDraws':
        // 增加今日抽卡次数（叠加到 remainingDraws，跨日会被重置 —— 当天有效）
        updateData = { remainingDraws: _.inc(num) }
        logDesc = `教师增加今日抽卡次数 x${num}`
        break
      case 'addBonusDraws':
        // 增加永久抽卡次数（叠加到 bonusDraws，不跨日重置 —— 与商城购买同一字段）
        updateData = { bonusDraws: _.inc(num) }
        logDesc = `教师发放永久抽卡次数 x${num}`
        break
      case 'resetDraws':
        // 重置今日抽卡次数（强制设为指定值，默认3）
        updateData = { remainingDraws: num, lastDrawDate: today }
        logDesc = `教师重置抽卡次数为 ${num}`
        break
      default:
        return { success: false, error: `未知操作: ${action}` }
    }

    await db.collection('students').doc(studentId).update({ data: updateData })

    // 返回学生最新状态
    const updated = await db.collection('students').doc(studentId).get()
    const latest = updated.data || {}

    return {
      success: true,
      message: logDesc,
      student: {
        _id: studentId,
        name: student.name || student.heroName,
        remainingDraws: latest.remainingDraws ?? 0,
        bonusDraws: latest.bonusDraws ?? 0,
        challengeVouchers: latest.challengeVouchers ?? 0,
        growthAccelerants: latest.growthAccelerants ?? 0
      }
    }

  } catch (e) {
    console.error('teacherGrantItem error:', e)
    return { success: false, error: e.message || '操作失败' }
  }
}
