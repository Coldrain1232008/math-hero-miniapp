// utils/share.js
// 分享配置单一真源 —— 各页面不要自己写死文案，改这里即可全局生效。
//
// ⚠️ 微信的两条硬规则（踩了会静默失败，不报错，很难查）：
//   1. 一个页面要启用「分享到朋友圈」，必须 **同时** 定义 onShareAppMessage
//      和 onShareTimeline。缺任何一个，右上角菜单里连「分享到朋友圈」都不渲染。
//   2. onShareTimeline **不支持自定义 path** —— 它只能分享当前页面，
//      参数只能通过 query 传递。所以朋友圈的落地页就是「当前页本身」。
//
// ⚠️ 本项目只在登录页暴露朋友圈入口，其余 19 个页面只有好友转发。原因：
//   朋友圈打开的是「单页模式」—— 没有登录态，而且**禁止任何页面跳转**。
//   学生端/教师端页面都依赖 globalData 里的登录信息，在那种环境下渲染不出来，
//   连「未登录跳登录页」的兜底都跳不走，分享出去只会是白屏。
//   登录页已做单页模式适配（切成静态介绍视图），是唯一合适的分享源。
//
//   好友转发不受此限：path 一律指向登录页，走的是完整模式，体验是好的。
//
// 关于 imageUrl：
//   好友分享用代码包路径（/images/share-cover.png）一定能显示。
//   朋友圈卡片在部分机型要求 HTTPS 直链，若发现朋友圈卡片没图，
//   把这张图上传到云存储，把 SHARE_IMAGE 换成云存储链接即可。

const SHARE_IMAGE = '/images/share-cover.png'

// 品牌名与落地页。path 一律指向登录页 ——
// 接收者多半还没有账号，落到功能页会卡在无权限状态；
// 落到登录页才有「注册新班级」这条出路。
const BRAND = '学业英雄养成记'
const HOME = '/pages/login/login'

// 各页面分享文案，键为 pages/ 下的目录名
const CONFIG = {
  login: { title: `${BRAND}｜把每次进步，变成看得见的成长` },
  'create-character': { title: `来测测你的数学天赋是哪一型｜${BRAND}` },
  character: { title: `我在${BRAND}里养了个角色，来看看` },
  ranking: { title: `我们班的英雄排行榜｜${BRAND}` },
  challenge: { title: `来挑战这道题｜${BRAND}` },
  'challenge-history': { title: `挑战记录｜${BRAND}` },
  gacha: { title: `抽卡时间到｜${BRAND}` },
  'badge-book': { title: `我的徽章册｜${BRAND}` },
  shop: { title: `班级商城｜${BRAND}` },
  'weekly-report': { title: `本周学习周报｜${BRAND}` },
  notifications: { title: BRAND },
  'coin-logs': { title: `金币流水｜${BRAND}` },
  teacher: { title: `一分钟建好一个班｜${BRAND}教师端` },
  'class-analytics': { title: `班级学习数据一览｜${BRAND}` },
}

/**
 * 「转发给好友 / 群」的分享内容
 * @param {string} pageKey pages/ 下的目录名
 */
function appMessage(pageKey) {
  const cfg = CONFIG[pageKey] || {}
  return {
    title: cfg.title || BRAND,
    path: cfg.path || HOME,
    imageUrl: SHARE_IMAGE,
  }
}

/**
 * 「分享到朋友圈」的内容
 *
 * ⚠️ 注意这里没有 path —— 微信不允许。接收者打开的是**当前页面**，
 *    并且运行在「单页模式」：无登录态、不能跳转其它页面、
 *    tabBar 不渲染、wx.login 等接口不可用。
 *    因此被分享的页面必须自己适配单页模式，否则用户进来会卡住。
 *
 * @param {string} pageKey pages/ 下的目录名
 */
function timeline(pageKey) {
  const cfg = CONFIG[pageKey] || {}
  return {
    title: cfg.title || BRAND,
    query: 'from=timeline',   // 用于区分来源，登录页可据此做埋点
    imageUrl: SHARE_IMAGE,
  }
}

/**
 * 显式声明本页要暴露的两个分享菜单项。
 * 实现了上面两个钩子后微信通常会自动显示，但部分机型/基础库需要显式声明，
 * 代价为零，所以主要分享源页面的 onLoad 里调一次。
 */
function enableShareMenu() {
  if (!wx.showShareMenu) return
  try {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  } catch (e) {
    // 单页模式等受限环境下不支持页面内发起分享，忽略即可 —— 不能让它把页面打挂
    console.warn('[share] showShareMenu 调用失败:', e)
  }
}

module.exports = {
  appMessage,
  timeline,
  enableShareMenu,
  SHARE_IMAGE,
  BRAND,
  HOME,
}
