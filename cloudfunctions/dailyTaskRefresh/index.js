// 云函数：dailyTaskRefresh
// 每日自动刷新任务（每天早上6点触发）
// 逻辑：
// - 如果学生今天没有任务 → 分配新任务
// - 如果学生有任务且未完成（pending）且未刷新过 → 保留
// - 如果学生有任务且已提交（submitted）或已刷新过（refreshCount > 0）→ 重新分配

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 任务池（从天assignDailyTask复制，保持一致）
const TASK_POOL = {
  explorer: [
    { id: 'exp_1', title: '向老师提出一个发现规律的问题', desc: '在课堂或课后向老师提出一个你发现的数学规律或疑问' },
    { id: 'exp_2', title: '找出3道题的共同点', desc: '从今天的作业中找出3道题，总结它们的共同解题思路' },
    { id: 'exp_3', title: '发现生活中的数学', desc: '找到1个生活中的数学现象，拍照记录' },
    { id: 'exp_4', title: '挑战一道变式题', desc: '在原有题目基础上，自己改编一道变式题并解答' },
  ],
  forger: [
    { id: 'for_1', title: '完成额外5道练习题', desc: '完成课本或练习册上的5道额外练习题' },
    { id: 'for_2', title: '整理今天的错题', desc: '将今天的错题整理到错题本上，写明错误原因' },
    { id: 'for_3', title: '规范书写解题过程', desc: '选择1道题，用最规范的书写完成完整解题过程' },
    { id: 'for_4', title: '复习本周知识点', desc: '用思维导图或表格形式复习本周学过的知识点' },
  ],
  weaver: [
    { id: 'wea_1', title: '给同学讲解一道题', desc: '选择1道你会的题，给同学讲解清楚解题思路' },
    { id: 'wea_2', title: '用多种方法解一道题', desc: '选择1道题，尝试用至少2种不同方法解答' },
    { id: 'wea_3', title: '录制解题语音', desc: '录制1分钟的解题思路语音，清晰表达你的思考过程' },
    { id: 'wea_4', title: '总结解题口诀', desc: '为某一类题型编一个记忆口诀或顺口溜' },
  ],
  guardian: [
    { id: 'gua_1', title: '按时完成今日作业', desc: '在今晚9点前完成所有数学作业' },
    { id: 'gua_2', title: '提前预习明天内容', desc: '预习明天的数学课内容，标记不懂的地方' },
    { id: 'gua_3', title: '坚持计算训练', desc: '完成20道计算题，保持计算准确率' },
    { id: 'gua_4', title: '整理数学笔记', desc: '将今天的课堂笔记整理清晰，重点突出' },
  ],
  guide: [
    { id: 'gui_1', title: '总结今日所学', desc: '用3句话总结今天数学课的核心内容' },
    { id: 'gui_2', title: '对比相似题型', desc: '找出2道相似但有区别的题，对比它们的异同' },
    { id: 'gui_3', title: '制作知识卡片', desc: '为1个重要公式或定理制作记忆卡片' },
    { id: 'gui_4', title: '梳理知识脉络', desc: '画出今天所学内容与之前知识的联系图' },
  ],
  breaker: [
    { id: 'bre_1', title: '挑战一道难题', desc: '尝试解答1道课本外的拓展题或竞赛题' },
    { id: 'bre_2', title: '限时解题挑战', desc: '选择3道基础题，在5分钟内完成，追求速度' },
    { id: 'bre_3', title: '一题多解挑战', desc: '用尽可能多的方法解答同一道题' },
    { id: 'bre_4', title: '逆向思维训练', desc: '从答案倒推，尝试用逆向思维解题' },
  ],
}

const COMMON_TASKS = [
  { id: 'com_1', title: '向老师提问1次', desc: '在课堂或课后向老师提出1个问题' },
  { id: 'com_2', title: '主动举手回答1次', desc: '明天数学课上主动举手回答1个问题' },
  { id: 'com_3', title: '帮助同学1次', desc: '帮助同学解答1个数学问题' },
  { id: 'com_4', title: '完成一道拓展题', desc: '完成课本或练习册上的1道拓展题' },
]

const TALENT_MAP = {
  'A': 'explorer', 'B': 'forger', 'C': 'weaver',
  'D': 'guardian', 'E': 'guide', 'F': 'breaker',
}

exports.main = async (event, context) => {
  const { classId } = event
  
  // 获取今天的日期范围
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  try {
    const results = {
      totalStudents: 0,
      assigned: 0,      // 分配了新任务
      kept: 0,          // 保留了原任务
      skipped: 0,       // 跳过（已完成）
      errors: []
    }

    // 获取需要处理的班级
    let classes = []
    if (classId) {
      // 指定班级
      const classRes = await db.collection('classes').doc(classId).get()
      if (classRes.data) classes = [classRes.data]
    } else {
      // 所有班级
      const classRes = await db.collection('classes').get()
      classes = classRes.data || []
    }

    for (const cls of classes) {
      try {
        const classId = cls._id
        
        // 获取班级所有学生
        const studentsRes = await db.collection('students')
          .where({ classId })
          .get()
        
        results.totalStudents += studentsRes.data.length

        for (const student of studentsRes.data) {
          try {
            const action = await processStudentTask(student, today, tomorrow)
            
            if (action === 'assigned') results.assigned++
            else if (action === 'kept') results.kept++
            else if (action === 'skipped') results.skipped++
          } catch (e) {
            results.errors.push({
              studentId: student._id,
              error: e.message
            })
          }
        }
      } catch (e) {
        results.errors.push({
          classId: cls._id,
          error: e.message
        })
      }
    }

    console.log('每日任务刷新完成:', results)
    return {
      success: true,
      message: `处理完成：分配${results.assigned}个，保留${results.kept}个，跳过${results.skipped}个`,
      ...results
    }

  } catch (err) {
    console.error('dailyTaskRefresh error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 处理单个学生的任务
 * 返回值: 'assigned'(分配新任务) | 'kept'(保留原任务) | 'skipped'(跳过)
 */
async function processStudentTask(student, today, tomorrow) {
  const studentId = student._id
  const classId = student.classId

  // 查询学生今天的任务
  const taskRes = await db.collection('dailyTasks')
    .where({
      studentId,
      date: _.gte(today).and(_.lt(tomorrow))
    })
    .get()

  // 没有任务 → 分配新任务
  if (taskRes.data.length === 0) {
    await assignNewTask(student, today)
    return 'assigned'
  }

  const task = taskRes.data[0]

  // 任务已确认完成 → 跳过
  if (task.status === 'confirmed') {
    return 'skipped'
  }

  // 特殊任务且未完成 → 保留
  if (task.isSpecial) {
    return 'kept'
  }

  // 普通任务已刷新过(refreshCount >= 1) → 跳过
  if ((task.refreshCount || 0) > 0) {
    return 'skipped'
  }

  // 普通任务状态为pending且未刷新过 → 保留
  if (task.status === 'pending') {
    return 'kept'
  }

  // 其他情况（submitted但未确认）→ 保留
  return 'kept'
}

/**
 * 为学生分配新任务
 */
async function assignNewTask(student, today) {
  const studentId = student._id
  const classId = student.classId
  const talentId = student.talentId || 'A'

  // 检查班级是否有激活的特殊任务
  let specialTask = null
  try {
    const specialRes = await db.collection('specialTasks')
      .where({
        classId,
        status: 'active'
      })
      .get()
    
    if (specialRes.data.length > 0) {
      specialTask = specialRes.data.sort((a, b) => 
        new Date(b.createTime) - new Date(a.createTime)
      )[0]
    }
  } catch (e) {
    // 集合可能不存在
  }

  // 检查学生今天是否已完成特殊任务
  let todayCompletedSpecial = false
  if (specialTask) {
    const completedRes = await db.collection('dailyTasks')
      .where({
        studentId,
        isSpecial: true,
        status: 'confirmed',
        date: _.gte(today)
      })
      .count()
    todayCompletedSpecial = completedRes.total > 0
  }

  let newTask
  let isSpecial = false

  if (specialTask && !todayCompletedSpecial) {
    // 分配特殊任务
    isSpecial = true
    newTask = {
      studentId,
      classId, // 添加 classId，便于教师端按班级查询任务记录
      title: specialTask.title,
      desc: specialTask.desc,
      taskId: `special_${specialTask._id}`,
      isPreference: false,
      category: 'special',
      status: 'pending',
      expReward: specialTask.expReward || 20,
      refreshCount: 0,
      date: today,
      createTime: new Date(),
      submitTime: null,
      confirmTime: null,
      isSpecial: true,
      specialTaskId: specialTask._id,
    }
  } else {
    // 分配普通任务
    const category = talentId.charAt(0)?.toUpperCase() || 'A'
    const preferenceKey = TALENT_MAP[category] || 'explorer'
    const isPreference = Math.random() < 0.7
    
    let taskPool
    if (isPreference && TASK_POOL[preferenceKey]) {
      taskPool = TASK_POOL[preferenceKey]
    } else {
      taskPool = COMMON_TASKS
    }

    const selectedTask = taskPool[Math.floor(Math.random() * taskPool.length)]
    const baseExp = 10
    const bonusExp = isPreference ? 5 : 0

    newTask = {
      studentId,
      classId, // 添加 classId，便于教师端按班级查询任务记录
      title: selectedTask.title,
      desc: selectedTask.desc,
      taskId: selectedTask.id,
      isPreference,
      category: preferenceKey || 'common',
      status: 'pending',
      expReward: baseExp + bonusExp,
      refreshCount: 0,
      date: today,
      createTime: new Date(),
      submitTime: null,
      confirmTime: null,
      isSpecial: false,
    }
  }

  await db.collection('dailyTasks').add({ data: newTask })
}
