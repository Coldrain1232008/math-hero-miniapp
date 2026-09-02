// 云函数：sendNotification
// 创建消息通知

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId, classId, type, title, content, data = {} } = event

  if (!studentId || !type || !title || !content) {
    return { success: false, error: '缺少必要参数' }
  }

  try {
    // 创建消息记录
    const notification = {
      studentId,
      classId: classId || '',
      type,
      title,
      content,
      data,
      read: false,
      createTime: db.serverDate()
    }

    await db.collection('notifications').add({ data: notification })

    return { success: true, message: '通知已发送' }

  } catch (err) {
    console.error('sendNotification error:', err)
    return { success: false, error: err.message }
  }
}
