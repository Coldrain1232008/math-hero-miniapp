// 云函数：manageSpecialTask
// 管理特殊任务（发布/修改/删除/获取）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, classId, taskId, title, desc, expReward, status } = event

  if (!classId && action !== 'getByClass') {
    return { success: false, error: '缺少classId' }
  }

  try {
    // 获取当前特殊任务
    if (action === 'get') {
      const today = new Date()
      const res = await db.collection('specialTasks')
        .where({
          classId,
          status: 'active',
          expireTime: _.or(_.exists(false), _.gt(today))
        })
        .get()
      
      if (res.data.length > 0) {
        // 按创建时间倒序，返回最新的
        const sorted = res.data.sort((a, b) => 
          new Date(b.createTime) - new Date(a.createTime)
        )
        return { success: true, task: sorted[0] }
      }
      return { success: true, task: null }
    }

    // 发布特殊任务（同时只能有1个active状态的）
    if (action === 'publish') {
      if (!title || !desc) {
        return { success: false, error: '标题和描述不能为空' }
      }

      // 先将现有的active任务设为过期
      await db.collection('specialTasks')
        .where({ classId, status: 'active' })
        .update({ data: { status: 'expired' } })

      // 创建新特殊任务
      const newTask = {
        classId,
        title: title.trim(),
        desc: desc.trim(),
        expReward: expReward || 20, // 默认20 EXP
        status: 'active',
        createTime: new Date(),
        expireTime: null, // 永不过期，直到手动删除
      }

      const addRes = await db.collection('specialTasks').add({ data: newTask })
      return { success: true, taskId: addRes._id, task: { ...newTask, _id: addRes._id } }
    }

    // 修改特殊任务
    if (action === 'update') {
      if (!taskId) {
        return { success: false, error: '缺少taskId' }
      }

      const updateData = {}
      if (title) updateData.title = title.trim()
      if (desc) updateData.desc = desc.trim()
      if (typeof expReward === 'number') updateData.expReward = expReward
      if (status) updateData.status = status

      await db.collection('specialTasks').doc(taskId).update({ data: updateData })
      
      const updated = await db.collection('specialTasks').doc(taskId).get()
      return { success: true, task: updated.data }
    }

    // 删除特殊任务（软删除）
    if (action === 'delete') {
      if (!taskId) {
        return { success: false, error: '缺少taskId' }
      }

      await db.collection('specialTasks').doc(taskId).update({
        data: { status: 'deleted' }
      })
      return { success: true }
    }

    // 获取班级的特殊任务历史
    if (action === 'history') {
      const res = await db.collection('specialTasks')
        .where({ classId })
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()
      return { success: true, tasks: res.data }
    }

    return { success: false, error: '未知的操作类型' }

  } catch (err) {
    console.error('manageSpecialTask error:', err)
    return { success: false, error: err.message }
  }
}
