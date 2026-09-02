# Math Hero Miniapp - 长期记忆

微信小程序「数学英雄」：初中生数学表现 → 角色养成游戏
- 环境 `cloud1-3g0pzu4pe8d12b17`；本地 `~/WorkBuddy/Claw/math-hero-miniapp`
- 规模：页面 20 / 云函数 45 / 集合 19
- 仓库：公开 `Coldrain1232008/math-hero-miniapp`；
  私有配置 `Coldrain1232008/workbuddy-config` → `~/.workbuddy/`

## 集合（19）
students classes expLogs taskCompletions dailyTasks taskPool specialTasks
badgeStatus challengeLogs challengeHistory(废弃) itemLogs notifications
weeklyStats coinLogs wallets admins adminLogs shopItems shopOrders
- 带 `classId`：expLogs taskCompletions dailyTasks itemLogs specialTasks taskPool
  challengeLogs notifications coinLogs wallets shopOrders
- 只有 `studentId`：badgeStatus weeklyStats
- 全局：admins adminLogs；`shopItems.classId === ''` = 全局模板
- ⚠️ `challengeHistory` 废弃零写入仅兜底清理；`taskPool` 混全局预置任务（按班删只命中
  本班自定义的）；`weeklyStats` 只读不写

## 班级与密钥
- 一班 = `classes` 一条；**一教师账号 = 一班**（不做多班切换）
- 字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（剔除 I/O/0/1）
- `deleteClass` 三道锁；⚠️ 反查 studentId 时**排除已转到其它班的活跃学生**

## 金币 + 商城经济闭环
super 充值 → `wallets(_id=classId)` → 教师 grant/deduct → `students.coins`；
互赠不经过钱包。商城是出口：虚拟品 burn → `totalBurned`，实物品 refund → 回流钱包。
守恒式 `totalRecharged = studentCoins + walletBalance + totalBurned`。
- 云函数：`coinOperation` `transferCoins` `getCoinLogs` `shop` `manageShop`
- 权限两级：全局模板（classId=''，仅 super）+ 班级自定义（教师）
- 类型：`draw_ticket`(→bonusDraws) / `challenge_voucher` / `growth_accelerant` /
  `coupon`(未开放)
- ⚠️ **`bonusDraws` 绝不跨日重置**（买的，清零=吞钱）；`remainingDraws` 每日免费
  3 次会重置；消耗顺序先 bonus 后 daily
- 删商品：已有订单的只下架 `status:'off'`；鉴权用 `teacherKey` 反查 classId，
  **不信任前端传的 classId**
- 事务四决策：① `db.runTransaction` ② 失败用返回值标记不抛异常
  ③ 钱包 `_id` 直接用 classId ④ 批量发放每人一个短事务

## super 后台
- `pages/super/super`，入口 = 登录页长按 Logo；云函数 `superAdmin`
- Tab：班级 / 审计日志 / 全局商品模板
- 铁律：**每个 action 第一行 `verifySuper`**；前端零密钥；
  ⚠️ `admins.superKey` 必须存大写；守恒 `diff != 0` 直接显示差额

## 云函数鉴权（2026-09-02 审计后新增）
- 铁律：**任何写操作云函数都必须鉴权**，不能只收 `event.classId`
  —— classId 在前端 globalData 里就有，学生改参数即可跨班写入
- 正确写法：云函数凭 `teacherKey` 反查 classId，**不信任前端传的 classId**
  模板见 `importStudents.findClassByTeacherKey`
- 密钥查询一律**双查**（先原值后归一化），兼容历史小写密钥；
  只查归一化值 = 复刻 teacher-shop「密钥不正确」事故
- 自检：`node tools/check-auth.js`（维度一 密钥双查 / 维度二 写操作鉴权）
  ⚠️ 存量未修：🔴 8 个（addExp coinOperation createStudent dailyTaskRefresh
  fixStudentKeys manageSpecialTask manageTaskPool teacherGrantItem）+ ⚠️ 11 个

## 协作原则
- **不要把"用户未更新代码"当默认假设**，同一问题反复提出 = 问题在代码里
- **涉及新集合必须立刻告知用户创建**；改云函数先 grep 全部 `db.collection()` 列清单
- Debug：先看代码逻辑；现象矛盾时先怀疑**假失败**

## WXSS / WXML 硬规则
1. `width:100%` + `padding>0` 必须配 `box-sizing:border-box`
   - ⚠️ 禁止全局 `*{border-box}`（压缩固定 width+padding 的元素），**局部修复**
2. **条件指令所在节点不许再挂别的指令**（`wx:for` 等）
   - 报错误导：「Bad attr `wx:else` with message: `wx:if not found`」，真凶是同节点
     多指令 → 拆两层：外层纯条件外壳，内层循环
   - 表达式统一用 `===`（~~不许用===~~ 2026-09-01 证伪，全项目 100+ 处正常）
3. **`<button>` 有原生样式**（`padding:0 14px` + `margin:0 auto` + border-box）
   - flex 中抢走 ~44rpx/个 → `padding:0!important; margin:0!important`；
     `::after` 有 1px 边框 → `border:none`；被挤子项 `flex:1; min-width:0;`
4. **placeholder 绕过 native**：`<text>` 自渲染浮于 input，`wx:if` 隐藏
   - `.ph` 三件套：`display:block`（`<text>` 默认 inline，inline 上 ellipsis 全失效）+
     `left`/`right` 锁宽 + `top:50%` `translateY(-50%)` `height==line-height`
   - 多行 `.ph-textarea`：`top:<padding-top>` 不用 transform；不写全局 `.ph`
5. **flex item 必须"死宽度"，`min-width` 兜不住**（金币卡踩三轮）
   - 容器有剩余空间时 flex 会**平分给子项**，按钮被撑爆
   - `flex:0 0 N!important` + `width/min-width/max-width: N!important` +
     `padding:0!important; margin:0!important; box-sizing:border-box; text-align:center`
   - **外层容器也要显式 `width`**

## 教训
- **写后读回验证**：`doc().update()` / `where().update()` 返回结构不同，踩两次假失败
- **归一化必须写入侧 + 查询侧成对**：只在一侧 → `longyue7` 永远查不到 `LONGYUE7`
  - 进阶：**所有密钥查询函数都该双查**（先 raw 后 upper）兼容历史数据
    —— login.findByKey 是双查，所以小写密钥能登录；但 manageShop.verifyTeacher
    只查归一化值，登录后进任何需要鉴权的页面都失败。**统一为双查**
- **事务里 `doc().update()` 撞不存在文档会 reject**（不是 updated=0）→ 事务外先补建
- **限购按"件数"统计**（一次买 3 件只落 1 条订单）
- **分页批量删**：`get()` 上限 100；`_.in()` 一次 ≤50 ID；集合不存在不阻断
- `data-*` 永远是字符串（要 `parseInt`）；openid 不稳定用 `studentId`；
  新增云函数必须带 package.json

## 其它
- 徽章 streak + milestone，`checkBadges` 被 addExp/login/drawGacha/useChallenge 触发；
  挑战基础 +5EXP + 等级差修正，统一走 `challengeLogs`
- 教师端喜欢页面内直接操作；重大功能要确认门槛；输出要结构化/表格

## Git
- 主分支 `main`，提交风格 conventional commits（`feat:` / `chore:`）+ 中文正文
- 用户不常提交，易积压数月；提交前先 `git log -1` 看上次提交时间，
  积压多则**按模块拆多个 commit**并征询粒度
- 拆包技巧：对 `git diff` 新增行跑关键词计数自动归类；交叉文件归命中数最高的
  模块并在 message 里注明；app.json/app.wxss 放第一个 chore commit
- ⚠️ 远程地址明文嵌 PAT（`ghp_…`），已提醒用户改 SSH 或轮换 token
- ⚠️ 仓库**公开**，`.workbuddy/memory/` 已入库（含环境 ID 与密钥设计），
  用户知情并选择保持现状
