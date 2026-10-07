#!/usr/bin/env node
// 一次性脚本：把非登录页的 onShareTimeline 移除，只保留好友转发。
//
// 原因：朋友圈打开的是「单页模式」—— 没有登录态、且禁止任何页面跳转。
// 学生端/教师端页面都依赖 globalData 里的登录信息，在单页模式下会白屏，
// 连「未登录跳登录页」的兜底都跳不走。所以朋友圈入口只保留在登录页
// （登录页已做单页模式适配，会切成静态介绍视图）。
//
// 好友转发不受影响：path 一律指向登录页，落地体验是好的。

const fs = require('fs')
const path = require('path')

const PAGES = path.resolve(__dirname, '..', 'miniprogram', 'pages')
const KEEP = new Set(['login'])

const removed = []

for (const d of fs.readdirSync(PAGES)) {
  if (KEEP.has(d)) continue
  const file = path.join(PAGES, d, `${d}.js`)
  if (!fs.existsSync(file)) continue

  let src = fs.readFileSync(file, 'utf8')
  const line = new RegExp(
    `\\n[ \\t]*onShareTimeline\\(\\) \\{ return share\\.timeline\\('${d}'\\) \\},?`
  )
  if (!line.test(src)) continue

  src = src.replace(line, '')
  src = src.replace(
    /[ \t]*\/\/ 分享：好友转发 \+ 朋友圈。微信要求两者成对定义，缺一则朋友圈入口不渲染。/,
    '  // 分享：仅好友转发（path 指向登录页）。\n' +
      '  // 朋友圈入口只在登录页开放 —— 朋友圈打开是「单页模式」，无登录态且禁止跳转，\n' +
      '  // 本页在那种环境下渲染不出来，所以不暴露入口，避免分享出去是白屏。'
  )
  fs.writeFileSync(file, src)
  removed.push(d)
}

console.log(`已移除 onShareTimeline 的页面（${removed.length} 个）：`)
removed.forEach((d) => console.log('  · ' + d))
