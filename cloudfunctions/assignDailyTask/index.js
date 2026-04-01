// 云函数：assignDailyTask
// 为学生分配每日任务（考虑天赋偏好）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 任务池 - 按天赋类型分类
const TASK_POOL = {
  // 探索者偏好：发现、提问类
  explorer: [
    { id: 'exp_1', title: '向老师提出一个发现规律的问题', desc: '在课堂或课后向老师提出一个你发现的数学规律或疑问' },
    { id: 'exp_2', title: '找出3道题的共同点', desc: '从今天的作业中找出3道题，总结它们的共同解题思路' },
    { id: 'exp_3', title: '发现生活中的数学', desc: '找到1个生活中的数学现象，拍照记录' },
    { id: 'exp_4', title: '挑战一道变式题', desc: '在原有题目基础上，自己改编一道变式题并解答' },
  ],
  // 铸造者偏好：练习、整理类
  forger: [
    { id: 'for_1', title: '完成额外5道练习题', desc: '完成课本或练习册上的5道额外练习题' },
    { id: 'for_2', title: '整理今天的错题', desc: '将今天的错题整理到错题本上，写明错误原因' },
    { id: 'for_3', title: '规范书写解题过程', desc: '选择1道题，用最规范的书写完成完整解题过程' },
    { id: 'for_4', title: '复习本周知识点', desc: '用思维导图或表格形式复习本周学过的知识点' },
  ],
  // 编织者偏好：讲解、表达类
  weaver: [
    { id: 'wea_1', title: '给同学讲解一道题', desc: '选择1道你会的题，给同学讲解清楚解题思路' },
    { id: 'wea_2', title: '用多种方法解一道题', desc: '选择1道题，尝试用至少2种不同方法解答' },
    { id: 'wea_3', title: '录制解题语音', desc: '录制1分钟的解题思路语音，清晰表达你的思考过程' },
    { id: 'wea_4', title: '总结解题口诀', desc: '为某一类题型编一个记忆口诀或顺口溜' },
  ],
  // 守护者偏好：坚持、打卡类
  guardian: [
    { id: 'gua_1', title: '按时完成今日作业', desc: '在今晚9点前完成所有数学作业' },
    { id: 'gua_2', title: '提前预习明天内容', desc: '预习明天的数学课内容，标记不懂的地方' },
    { id: 'gua_3', title: '坚持计算训练', desc: '完成20道计算题，保持计算准确率' },
    { id: 'gua_4', title: '整理数学笔记', desc: '将今天的课堂笔记整理清晰，重点突出' },
  ],
  // 引导者偏好：总结、归纳类
  guide: [
    { id: 'gui_1', title: '总结今日所学', desc: '用3句话总结今天数学课的核心内容' },
    { id: 'gui_2', title: '对比相似题型', desc: '找出2道相似但有区别的题，对比它们的异同' },
    { id: 'gui_3', title: '制作知识卡片', desc: '为1个重要公式或定理制作记忆卡片' },
    { id: 'gui_4', title: '梳理知识脉络', desc: '画出今天所学内容与之前知识的联系图' },
  ],
  // 突破者偏好：挑战、高难度类
  breaker: [
    { id: 'bre_1', title: '挑战一道难题', desc: '尝试解答1道课本外的拓展题或竞赛题' },
    { id: 'bre_2', title: '限时解题挑战', desc: '选择3道基础题，在5分钟内完成，追求速度' },
    { id: 'bre_3', title: '一题多解挑战', desc: '用尽可能多的方法解答同一道题' },
    { id: 'bre_4', title: '逆向思维训练', desc: '从答案倒推，尝试用逆向思维解题' },
  ],
}

// 通用任务（所有天赋都可能获得）
const COMMON_TASKS = [
  { id: 'com_1', title: '向老师提问1次', desc: '在课堂或课后向老师提出1个问题' },
  { id: 'com_2', title: '主动举手回答1次', desc: '明天数学课上主动举手回答1个问题' },
  { id: 'com_3', title: '帮助同学1次', desc: '帮助同学解答1个数学问题' },
  { id: 'com_4', title: '完成一道拓展题', desc: '完成课本或练习册上的1道拓展题' },
]

// 天赋大类映射
const TALENT_MAP = {
  'A': 'explorer',    // 探索者
  'B': 'forger',      // 铸造者
  'C': 'weaver',      // 编织者
  'D': 'guardian',    // 守护者
  'E': 'guide',       // 引导者
  'F': 'breaker',     // 突破者
}

/**
 * 根据天赋获取任务池
 */
function getTaskPoolByTalent(talentId) {
  const category = talentId.charAt(0).toUpperCase()
  const preferenceKey = TALENT_MAP[category]
  
  // 70%概率获得偏好任务，30%概率获得通用任务
  const isPreference = Math.random() < 0.7
  
  if (isPreference && preferenceKey) {
    return {
      tasks: TASK_POOL[preferenceKey],
      isPreference: true,
      category: preferenceKey
    }
  }
  
  return {
    tasks: COMMON_TASKS,
    isPreference: false,
    category: 'common'
  }
}

/**
 * 随机选择一个任务
 */
function randomTask(tasks) {
  return tasks[Math.floor(Math.random() * tasks.length)]
}

exports.main = async (event, context) => {
  const { studentId, refreshCount = 0 } = event
  
  if (!studentId) {
    return { success: false, error: '缺少studentId' }
  }
  
  try {
    // 获取学生信息
    const studentRes = await db.collection('students').doc(studentId).get()
    const student = studentRes.data
    
    if (!student) {
      return { success: false, error: '学生不存在' }
    }
    
    // 检查今天是否已有任务
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const existingTask = await db.collection('dailyTasks')
      .where({
        studentId,
        date: db.command.gte(today).and(db.command.lt(tomorrow))
      })
      .get()
    
    // 如果已有任务且不是刷新操作，返回现有任务
    if (existingTask.data.length > 0 && refreshCount === 0) {
      const task = existingTask.data[0]
      return {
        success: true,
        task: {
          id: task._id,
          title: task.title,
          desc: task.desc,
          isPreference: task.isPreference,
          category: task.category,
          status: task.status,
          refreshCount: task.refreshCount || 0,
          expReward: task.expReward
        }
      }
    }
    
    // 检查刷新次数限制
    if (refreshCount > 0 && existingTask.data.length > 0) {
      const currentTask = existingTask.data[0]
      if ((currentTask.refreshCount || 0) >= 3) {
        return { success: false, error: '今日刷新次数已用完' }
      }
    }
    
    // 获取任务池
    const { tasks, isPreference, category } = getTaskPoolByTalent(student.talentId)
    const selectedTask = randomTask(tasks)
    
    // 计算奖励
    const baseExp = 10
    const bonusExp = isPreference ? 5 : 0
    const totalExp = baseExp + bonusExp
    
    // 删除旧任务（如果有）
    if (existingTask.data.length > 0) {
      await db.collection('dailyTasks').doc(existingTask.data[0]._id).remove()
    }
    
    // 创建新任务
    const newTask = {
      studentId,
      title: selectedTask.title,
      desc: selectedTask.desc,
      taskId: selectedTask.id,
      isPreference,
      category,
      status: 'pending', // pending, submitted, confirmed, expired
      expReward: totalExp,
      refreshCount: refreshCount,
      date: today,
      createTime: new Date(),
      submitTime: null,
      confirmTime: null,
    }
    
    const addRes = await db.collection('dailyTasks').add({ data: newTask })
    
    return {
      success: true,
      task: {
        id: addRes._id,
        title: newTask.title,
        desc: newTask.desc,
        isPreference: newTask.isPreference,
        category: newTask.category,
        status: newTask.status,
        refreshCount: newTask.refreshCount,
        expReward: newTask.expReward
      }
    }
    
  } catch (err) {
    console.error('assignDailyTask error:', err)
    return { success: false, error: err.message }
  }
}
