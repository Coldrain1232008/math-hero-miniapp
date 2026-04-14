# Math Hero Miniapp - 长期记忆

## 项目概况
- 微信小程序：数学英雄（Math Hero）- 将初中生数学成绩转化为角色养成游戏
- 云开发环境ID: cloud1-3g0pzu4pe8d12b17
- 技术栈: 微信小程序 + 云开发（云数据库 + 云函数）

## ⚠️ 协作原则（非常重要，每次 Debug 必看）

### 不要把"用户未更新代码"作为默认假设
- 马老师是有经验的开发者，不会反复犯同一个低级错误
- **当同一个问题被反复提出时，问题一定在代码里，而不在用户操作上**
- 正确做法：先假设代码有问题，认真读代码，而不是先怀疑用户没有上传/操作错误

### Debug 时的正确姿势
1. 用户提出疑问时，**先认真看代码逻辑**，不要先解释"为什么这样没问题"
2. 如果用户指出某行代码有疑问，**认真验证那行代码**，不要绕过去
3. 日志/截图是最权威的证据，要仔细读，不要只看表面
4. 不要用"可能是你没有上传最新代码"来解释 bug，除非有明确证据

### 具体案例（2026-04-11 ~ 04-14，drawGacha bug）
- 马老师很早就指出 `if (!updateRes.updated)` 这个判断有疑问
- 我没有认真核查 `where().update()` 的返回结构，反而一直强调"可能没有上传最新代码"
- 最终靠日志才确认：`where().update()` 返回 `{ stats: { updated: 1 } }`，而我判断的是 `updateRes.updated`（undefined）
- **如果当时听了马老师的质疑，立刻查文档验证返回结构，可以节省几天时间**

## 重要教训（Bug修复记录）

### 抽卡次数跨日/任务奖励 Bug（2026-04-10）
- **教训**: `getDrawStatus` 和 `drawGacha` 之间逻辑不一致，导致任务奖励次数失效
- **根本原因**: `getDrawStatus` 在 `lastDrawDate != today` 时无条件返回 3，忽略了 `confirmTask` 已写入的任务奖励次数
- **修复方案**:
  1. `confirmTask`: 任务确认时同步写入 `lastDrawDate`，并处理跨日基础次数重置（跨日=3+奖励，当日=现有+奖励）
  2. `drawGacha`: 重置判断中，若 `dailyDrawLeft > 3` 说明有任务奖励，保留该值不重置
  3. `getDrawStatus`: `lastDrawDate != today` 时，若次数 > 3 则保留（任务奖励），否则返回 3
- **设计原则**: `lastDrawDate` 是"今日是否已有任何抽卡/任务行为"的标志，`confirmTask` 确认任务时也要写入

### WXML data-* 属性类型问题
- **教训**: WXML的`data-*`属性永远是字符串
- **错误写法**: `data-index="0"` + `currentTab === 0` → 永远不相等
- **正确写法**: `const index = parseInt(e.currentTarget.dataset.index)` 或使用 `==`

### loading遮罩层覆盖交互
- **教训**: fixed定位的遮罩层可能覆盖其他可交互元素
- **解决**: 使用更轻量的提示方式，或确保z-index正确

### 云函数package.json必须声明依赖
- 新增云函数时，必须包含 `"wx-server-sdk": "~2.6.3"` 依赖

### ⚠️ where().update() vs doc().update() 返回结构不同（2026-04-14）
- **`doc().update()`** 返回：`{ updated: 1 }`
- **`where().update()`** 返回：`{ stats: { updated: 1 }, errMsg: "collection.update:ok" }`
- **教训**：判断更新是否成功，必须区分调用方式：
  - `doc().update()` → `if (!res.updated)`
  - `where().update()` → `if (!res.stats?.updated)`
- **影响**：drawGacha 用了 `where().update()` 但判断的是 `updateRes.updated`（始终 undefined），导致每次抽卡都返回"今日次数已用完"

### gacha.js 页面显示次数与 drawGacha 查询不一致（2026-04-11）
- **问题**: gacha 页面用 `getStudentData` 获取次数，但 `drawGacha` 用 `doc(studentId).get()` 直接查数据库，两套数据源可能不一致
- **教训**: **不要混用多个数据源获取同一字段**。抽卡次数是 `drawGacha`/`getDrawStatus` 的专属领域，应该统一用 `getDrawStatus`
- **修复**: gacha.js `loadData` 改用 `getDrawStatus` 获取权威抽卡次数，不再用 `getStudentData`
- **fallback 安全**: catch 兜底时宁可显示 0，也不要 fallback 到 3（避免掩盖真实状态）

### openid 不稳定导致学生查询失败（2026-04-11）
- **问题**: 模拟器测试环境只有一个 openid，但登录不同账号，导致用 openid 查询的学生数据互相覆盖
- **根因**: 多个云函数用 `where({ openid })` 查询，在 openid 重复时查到错误记录
- **修复原则**: openid 保留在数据库中作为记录字段，但**不作为常规操作的匹配 key**
- **统一改用 `studentId`（_id 主键）查询**，用 `doc(studentId).get()` 精确查找
- **兼容策略**: 前端调用优先传 `studentId`，云函数内同时保留 `openid` fallback（兼容老调用方式）
- **涉及文件（2026-04-11 修复）**:
  - `getStudentInfo`: 改用 `doc(studentId).get()`
  - `getDrawStatus`: 改用 `doc(studentId).get()`
  - `getClassmates`: 改用 `doc(studentId).get()` 获取自己信息
  - `useChallenge`: 改用 `doc(studentId).get()` 获取挑战者，参数改为 `studentId` + `targetId`
  - `challenge.js`: 前端调用改用 `studentId`
  - `useGrowthAccelerant`: 清理重复 return 代码
- **⚠️ 必须重新上传的云函数**: getStudentInfo, getDrawStatus, getClassmates, useChallenge, useGrowthAccelerant

## v1.7.0 新增功能（2026-04-10 拉取自另一台电脑）

### 抽卡系统（gacha）
- 新增页面: miniprogram/pages/gacha/
- 新增云函数: drawGacha, getDrawStatus
- 每日3次基础抽卡，完成普通任务+3次，完成特殊任务+5次
- 概率: 70% +1EXP，15% 成长加速剂，15% 挑战凭证

### 挑战系统（challenge）
- 新增页面: miniprogram/pages/challenge/
- 新增云函数: useChallenge, getClassmates
- 消耗挑战凭证挑战同班同学，胜者获得5EXP

### 道具系统
- 新增云函数: useGrowthAccelerant - 消耗成长加速剂永久提升属性成长速度 +0.1
- 新增云函数: getStudentInfo - 获取学生详细信息

### 修复（2026-04-10）
- 修复抽卡次数跨日/任务奖励累加 Bug（3个云函数：confirmTask/drawGacha/getDrawStatus）

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

## GitHub 仓库配置（2026-04-02）

### 公开仓库 - 项目代码
- **地址**: https://github.com/Coldrain1232008/math-hero-miniapp
- **用途**: 微信小程序项目代码
- **本地路径**: ~/WorkBuddy/Claw/math-hero-miniapp

### 私有仓库 - WorkBuddy 配置
- **地址**: https://github.com/Coldrain1232008/workbuddy-config
- **用途**: AI 灵魂、身份、技能配置
- **本地路径**: ~/.workbuddy/
- **包含**: SOUL.md, IDENTITY.md, USER.md, skills/, inspiration/

### GitHub Token
- **Token**: 已存储在 WorkBuddy 云端记忆和本地 git remote，不在此文件中明文保存
- **GitHub 用户名**: Coldrain1232008
- ⚠️ Token 不应提交到公开仓库，请从 USER.md（~/.workbuddy/USER.md）获取

### 换电脑同步流程
1. 克隆项目代码: `git clone https://github.com/Coldrain1232008/math-hero-miniapp.git ~/WorkBuddy/Claw/math-hero-miniapp`
2. 克隆配置: `git clone https://github.com/Coldrain1232008/workbuddy-config.git ~/.workbuddy`
3. 重启 WorkBuddy 使配置生效
