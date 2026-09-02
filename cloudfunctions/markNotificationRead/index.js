// 云函数：markNotificationRead
// 标记消息为已读

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { notificationId, studentId, markAll = false } = event

  try {
    if (markAll && studentId) {
      // 标记所有未读消息为已读
      await db.collection('notifications')
        .where({ studentId, read: false })
        .update({ data: { read: true } })
      return { success: true, message: '已全部标记为已读' }
    } else if (notificationId) {
      // 标记单条消息为已读
      await db.collection('notifications').doc(notificationId).update({
        data: { read: true }
      })
      return { success: true, message: '已标记为已读' }
    } else {
      return { success: false, error: '缺少参数' }
    }
  } catch (err) {
    console.error('markNotificationRead error:', err)
    return { success: false, error: err.message }
  }
}
