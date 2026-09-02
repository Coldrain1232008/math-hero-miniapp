// 云函数：getNotifications
// 获取学生消息列表

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId, page = 1, pageSize = 20 } = event

  if (!studentId) {
    return { success: false, error: '缺少studentId' }
  }

  try {
    // 获取未读消息数
    const unreadRes = await db.collection('notifications')
      .where({ studentId, read: false })
      .count()

    // 获取消息列表
    const skip = (page - 1) * pageSize
    const res = await db.collection('notifications')
      .where({ studentId })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return {
      success: true,
      notifications: res.data,
      unreadCount: unreadRes.total,
      hasMore: res.data.length === pageSize
    }

  } catch (err) {
    console.error('getNotifications error:', err)
    return { success: false, error: err.message }
  }
}
