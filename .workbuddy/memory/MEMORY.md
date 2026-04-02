# Math Hero Miniapp - 长期记忆

## 项目概况
- 微信小程序：数学英雄（Math Hero）- 将初中生数学成绩转化为角色养成游戏
- 云开发环境ID: cloud1-3g0pzu4pe8d12b17
- 技术栈: 微信小程序 + 云开发（云数据库 + 云函数）

## 重要教训（Bug修复记录）

### WXML data-* 属性类型问题
- **教训**: WXML的`data-*`属性永远是字符串
- **错误写法**: `data-index="0"` + `currentTab === 0` → 永远不相等
- **正确写法**: `const index = parseInt(e.currentTarget.dataset.index)` 或使用 `==`

### loading遮罩层覆盖交互
- **教训**: fixed定位的遮罩层可能覆盖其他可交互元素
- **解决**: 使用更轻量的提示方式，或确保z-index正确

### 云函数package.json必须声明依赖
- 新增云函数时，必须包含 `"wx-server-sdk": "~2.6.3"` 依赖

## v1.5.0 新增功能（2026-04-02）

### 教师端任务管理页面重构
- 路径: miniprogram/pages/teacher-task/
- Tab 3 从「待确认」改为「学生任务」
- 新增云函数: getStudentTasksStatus - 获取全班学生任务状态
- 显示所有学生的任务状态: 已完成(✓)/进行中/待确认/未开始
- 每个学生卡片都有独立的「重置」按钮
- 底部保留「重置全班任务」按钮

### 教师端任务重置功能
- 新增云函数: resetTaskProgress
- 功能: 重置单个学生/全班学生的今日任务
- 重置后可让学生重新获取任务（适合重复练习场景）

### 每日自动刷新任务
- 新增云函数: dailyTaskRefresh
- 配置定时触发器: config.json (cron: 0 6 * * * *)
- 逻辑: 未完成任务保留，已完成/已刷新任务重新分配

### 学生端特殊任务刷新逻辑（2026-04-02 下午）
- 学生刷新特殊任务时弹出确认弹窗，说明"奖励丰厚，刷新后将失去机会"
- 确认后刷新成普通任务
- 在 students 集合添加 completedSpecialTaskIds 字段
- 学生完成/放弃特殊任务后，该任务ID记录到 completedSpecialTaskIds
- 重置后不再分配已完成过的特殊任务

### 职业分类选项
- teacher-task 页面使用 categoryOptions 数组
- 选项: explorer(探索系), forger(锻造系), weaver(编织系), guardian(守护系), guide(引导系), breaker(突破系), common(通用)

## 用户偏好
- 教师端更喜欢在任务管理页面直接操作，不喜欢多层级弹窗
- 反馈要及时清晰，用户想知道操作是否成功
- Tab 3 改为「学生任务」视图而不是「待确认」- 更符合实际管理需求
