#!/usr/bin/env node
/**
 * tools/add-share-hooks.js
 *
 * 给 miniprogram/pages 下的页面批量注入分享钩子。
 * 幂等：已经注入过的会跳过，可以反复跑（新加了页面时再跑一次即可）。
 *
 * 用法：
 *   node tools/add-share-hooks.js --dry   # 只看会改哪些，不落盘
 *   node tools/add-share-hooks.js         # 真正写入
 *
 * 注入内容：
 *   const share = require('../../utils/share')
 *   Page({
 *     onShareAppMessage() { return share.appMessage('<页面名>') },
 *     ...原有内容
 *
 * ⚠️ 为什么不给每个页面都注入 onShareTimeline：
 *    朋友圈打开的是「单页模式」—— 没有登录态、且禁止任何页面跳转。
 *    学生端/教师端页面都依赖 globalData 里的登录信息，那种环境下渲染不出来，
 *    连「未登录跳登录页」的兜底都跳不走，分享出去就是白屏。
 *    所以朋友圈入口只保留在登录页（已做单页模式适配，切成静态介绍视图）。
 *    只有确认某个页面在无登录态下也能独立展示时，才把它加进 TIMELINE_OK。
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PAGES = path.join(ROOT, 'miniprogram', 'pages')
const DRY = process.argv.includes('--dry')

// 允许暴露「分享到朋友圈」的页面白名单（必须已做单页模式适配）
const TIMELINE_OK = new Set(['login'])

const dirs = fs
  .readdirSync(PAGES)
  .filter((d) => fs.statSync(path.join(PAGES, d)).isDirectory())
  .sort()

const done = []
const skip = []

for (const d of dirs) {
  const file = path.join(PAGES, d, `${d}.js`)
  if (!fs.existsSync(file)) {
    skip.push(`${d} —— 没有同名 js 文件`)
    continue
  }

  let src = fs.readFileSync(file, 'utf8')

  if (src.includes('utils/share')) {
    skip.push(`${d} —— 已注入`)
    continue
  }
  if (!/^Page\(\{/m.test(src)) {
    skip.push(`${d} —— 未找到行首的 Page({，需人工处理`)
    continue
  }

  const hooks = [
    '  // 分享：好友转发（path 指向登录页，接收者没有账号也能自助注册）。',
    `  onShareAppMessage() { return share.appMessage('${d}') },`,
  ]

  // 仅白名单页面额外暴露朋友圈入口
  if (TIMELINE_OK.has(d)) {
    hooks[0] =
      '  // 分享：好友转发 + 朋友圈。微信要求两者成对定义，缺一则朋友圈入口不渲染。'
    hooks.push(`  onShareTimeline() { return share.timeline('${d}') },`)
  }

  src = src.replace(
    /^Page\(\{/m,
    () => `const share = require('../../utils/share')\n\nPage({\n${hooks.join('\n')}\n`
  )

  if (!DRY) fs.writeFileSync(file, src)
  done.push(d)
}

console.log(DRY ? `【dry-run】将注入 ${done.length} 个页面：` : `已注入 ${done.length} 个页面：`)
done.forEach((d) => console.log('  ✔ ' + d))

if (skip.length) {
  console.log(`\n跳过 ${skip.length} 个：`)
  skip.forEach((s) => console.log('  · ' + s))
}
