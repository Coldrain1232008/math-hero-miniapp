// 云函数：manageTaskPool
// 管理任务池（获取/添加/修改/删除任务模板）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 内置任务池定义（按天赋类型分类）
const BUILTIN_TASK_POOL = {
  explorer: [
    { id: 'exp_1', title: '向老师提出一个发现规律的问题', desc: '在课堂或课后向老师提出一个你发现的数学规律或疑问', category: 'explorer' },
    { id: 'exp_2', title: '找出3道题的共同点', desc: '从今天的作业中找出3道题，总结它们的共同解题思路', category: 'explorer' },
    { id: 'exp_3', title: '发现生活中的数学', desc: '找到1个生活中的数学现象，拍照记录', category: 'explorer' },
    { id: 'exp_4', title: '挑战一道变式题', desc: '在原有题目基础上，自己改编一道变式题并解答', category: 'explorer' },
  ],
  forger: [
    { id: 'for_1', title: '完成额外5道练习题', desc: '完成课本或练习册上的5道额外练习题', category: 'forger' },
    { id: 'for_2', title: '整理今天的错题', desc: '将今天的错题整理到错题本上，写明错误原因', category: 'forger' },
    { id: 'for_3', title: '规范书写解题过程', desc: '选择1道题，用最规范的书写完成完整解题过程', category: 'forger' },
    { id: 'for_4', title: '复习本周知识点', desc: '用思维导图或表格形式复习本周学过的知识点', category: 'forger' },
  ],
  weaver: [
    { id: 'wea_1', title: '给同学讲解一道题', desc: '选择1道你会的题，给同学讲解清楚解题思路', category: 'weaver' },
    { id: 'wea_2', title: '用多种方法解一道题', desc: '选择1道题，尝试用至少2种不同方法解答', category: 'weaver' },
    { id: 'wea_3', title: '录制解题语音', desc: '录制1分钟的解题思路语音，清晰表达你的思考过程', category: 'weaver' },
    { id: 'wea_4', title: '总结解题口诀', desc: '为某一类题型编一个记忆口诀或顺口溜', category: 'weaver' },
  ],
  guardian: [
    { id: 'gua_1', title: '按时完成今日作业', desc: '在今晚9点前完成所有数学作业', category: 'guardian' },
    { id: 'gua_2', title: '提前预习明天内容', desc: '预习明天的数学课内容，标记不懂的地方', category: 'guardian' },
    { id: 'gua_3', title: '坚持计算训练', desc: '完成20道计算题，保持计算准确率', category: 'guardian' },
    { id: 'gua_4', title: '整理数学笔记', desc: '将今天的课堂笔记整理清晰，重点突出', category: 'guardian' },
  ],
  guide: [
    { id: 'gui_1', title: '总结今日所学', desc: '用3句话总结今天数学课的核心内容', category: 'guide' },
    { id: 'gui_2', title: '对比相似题型', desc: '找出2道相似但有区别的题，对比它们的异同', category: 'guide' },
    { id: 'gui_3', title: '制作知识卡片', desc: '为1个重要公式或定理制作记忆卡片', category: 'guide' },
    { id: 'gui_4', title: '梳理知识脉络', desc: '画出今天所学内容与之前知识的联系图', category: 'guide' },
  ],
  breaker: [
    { id: 'bre_1', title: '挑战一道难题', desc: '尝试解答1道课本外的拓展题或竞赛题', category: 'breaker' },
    { id: 'bre_2', title: '限时解题挑战', desc: '选择3道基础题，在5分钟内完成，追求速度', category: 'breaker' },
    { id: 'bre_3', title: '一题多解挑战', desc: '用尽可能多的方法解答同一道题', category: 'breaker' },
    { id: 'bre_4', title: '逆向思维训练', desc: '从答案倒推，尝试用逆向思维解题', category: 'breaker' },
  ],
}

// 通用任务
const COMMON_TASKS = [
  { id: 'com_1', title: '向老师提问1次', desc: '在课堂或课后向老师提出1个问题', category: 'common' },
  { id: 'com_2', title: '主动举手回答1次', desc: '明天数学课上主动举手回答1个问题', category: 'common' },
  { id: 'com_3', title: '帮助同学1次', desc: '帮助同学解答1个数学问题', category: 'common' },
  { id: 'com_4', title: '完成一道拓展题', desc: '完成课本或练习册上的1道拓展题', category: 'common' },
]

// 天赋大类映射
const TALENT_MAP = {
  'A': 'explorer',
  'B': 'forger',
  'C': 'weaver',
  'D': 'guardian',
  'E': 'guide',
  'F': 'breaker',
}

exports.main = async (event, context) => {
  const { action, classId, taskId, title, desc, category } = event

  if (!classId) {
    return { success: false, error: '缺少classId' }
  }

  try {
    // 获取任务池（合并内置和自定义任务）
    if (action === 'getPool') {
      // 获取班级自定义任务
      const customRes = await db.collection('taskPool')
        .where({ classId, status: 'active' })
        .get()
      
      // 合并所有内置任务
      const builtinTasks = []
      Object.entries(BUILTIN_TASK_POOL).forEach(([cat, tasks]) => {
        tasks.forEach(t => builtinTasks.push(t))
      })
      COMMON_TASKS.forEach(t => builtinTasks.push(t))

      return {
        success: true,
        builtinTasks,
        customTasks: customRes.data,
        totalCount: builtinTasks.length + customRes.data.length
      }
    }

    // 添加自定义任务
    if (action === 'add') {
      if (!title || !desc) {
        return { success: false, error: '标题和描述不能为空' }
      }

      const newTask = {
        classId,
        title: title.trim(),
        desc: desc.trim(),
        category: category || 'common',
        status: 'active',
        createTime: new Date(),
        isCustom: true,
      }

      const addRes = await db.collection('taskPool').add({ data: newTask })
      return { success: true, taskId: addRes._id, task: { ...newTask, _id: addRes._id } }
    }

    // 修改自定义任务
    if (action === 'update') {
      if (!taskId) {
        return { success: false, error: '缺少taskId' }
      }

      // 检查是否为自定义任务
      const taskRes = await db.collection('taskPool').doc(taskId).get()
      if (!taskRes.data || !taskRes.data.isCustom) {
        return { success: false, error: '只能修改自定义任务' }
      }

      const updateData = {}
      if (title) updateData.title = title.trim()
      if (desc) updateData.desc = desc.trim()
      if (category) updateData.category = category

      await db.collection('taskPool').doc(taskId).update({ data: updateData })
      
      const updated = await db.collection('taskPool').doc(taskId).get()
      return { success: true, task: updated.data }
    }

    // 删除自定义任务（软删除）
    if (action === 'delete') {
      if (!taskId) {
        return { success: false, error: '缺少taskId' }
      }

      // 检查是否为自定义任务
      const taskRes = await db.collection('taskPool').doc(taskId).get()
      if (!taskRes.data || !taskRes.data.isCustom) {
        return { success: false, error: '只能删除自定义任务' }
      }

      await db.collection('taskPool').doc(taskId).update({
        data: { status: 'deleted' }
      })
      return { success: true }
    }

    // 获取某个学生的有效任务池（排除已完成今日任务的）
    if (action === 'getForStudent') {
      const { studentId } = event
      if (!studentId) {
        return { success: false, error: '缺少studentId' }
      }

      // 获取学生的天赋类型
      const studentRes = await db.collection('students').doc(studentId).get()
      if (!studentRes.data) {
        return { success: false, error: '学生不存在' }
      }

      const student = studentRes.data
      const category = TALENT_MAP[student.talentId?.charAt(0).toUpperCase()] || 'common'

      // 获取该类别的内置任务
      const categoryTasks = BUILTIN_TASK_POOL[category] || []

      // 获取通用任务
      const allCommon = COMMON_TASKS

      // 获取班级自定义任务
      const customRes = await db.collection('taskPool')
        .where({ classId, status: 'active' })
        .get()

      return {
        success: true,
        preferenceTasks: categoryTasks,
        commonTasks: allCommon,
        customTasks: customRes.data,
        talentCategory: category
      }
    }

    return { success: false, error: '未知的操作类型' }

  } catch (err) {
    console.error('manageTaskPool error:', err)
    return { success: false, error: err.message }
  }
}
