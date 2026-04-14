// cloudfunctions/teacherGrantItem/index.js
// 教师端：手动给学生发放道具或增加抽卡次数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { teacherId, studentId, action, amount } = event

    if (!teacherId) return { success: false, error: '缺少 teacherId' }
    if (!studentId) return { success: false, error: '缺少 studentId' }
    if (!action) return { success: false, error: '缺少 action' }

    const num = typeof amount === 'number' && amount > 0 ? amount : 1

    // 验证教师身份（检查 openid 匹配）
    const teacherRes = await db.collection('teachers').doc(teacherId).get()
    if (!teacherRes.data) {
      return { success: false, error: '教师身份验证失败' }
    }

    // 获取学生信息
    const studentRes = await db.collection('students').doc(studentId).get()
    if (!studentRes.data) {
      return { success: false, error: '学生不存在' }
    }
    const student = studentRes.data

    // 验证教师和学生在同一个班
    if (student.classId !== teacherRes.data.classId) {
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
        // 增加今日抽卡次数（叠加到 remainingDraws）
        updateData = { remainingDraws: _.inc(num) }
        logDesc = `教师增加抽卡次数 x${num}`
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

    // 记录发放日志
    await db.collection('teacherGrantLogs').add({
      data: {
        teacherId,
        teacherName: teacherRes.data.name || teacherRes.data.title || '教师',
        studentId,
        studentName: student.name || student.heroName || '学生',
        classId: student.classId,
        action,
        amount: num,
        desc: logDesc,
        createTime: Date.now()
      }
    })

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
        challengeVouchers: latest.challengeVouchers ?? 0,
        growthAccelerants: latest.growthAccelerants ?? 0
      }
    }

  } catch (e) {
    console.error('teacherGrantItem error:', e)
    return { success: false, error: e.message || '操作失败' }
  }
}
