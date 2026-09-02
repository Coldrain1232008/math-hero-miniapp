#!/usr/bin/env node
/**
 * tools/sync-auth.js —— 把鉴权模板同步到各云函数目录
 *
 * 用法：
 *   node tools/sync-auth.js          同步到 TARGETS 里的所有云函数
 *   node tools/sync-auth.js <名字>    只同步指定云函数
 *   node tools/sync-auth.js --check   只检查是否过期，不同步（可挂 CI）
 *
 * 为什么要这个脚本：
 *   微信开发者工具上传单个云函数时不会带上层目录，所以公共模块
 *   （cloudfunctions/common/）部署不过去。
 *   折中方案：每个云函数目录自带一份 auth.js，内容由本脚本统一同步。
 *   改鉴权逻辑 → 改 tools/auth-template.js → 跑一次本脚本 → 全部生效。
 *
 * 注意：
 *   新接入鉴权的云函数要把名字加进 TARGETS，否则下次同步不会覆盖到。
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TEMPLATE = path.join(__dirname, 'auth-template.js')
const CF_DIR = path.join(ROOT, 'cloudfunctions')

// 需要鉴权的云函数。加新函数时在这里登记。
const TARGETS = [
  'coinOperation',
  'addExp',
  'fixStudentKeys',
  'manageSpecialTask',
  'manageTaskPool',
  'teacherGrantItem',
  'resetTaskProgress',
  'updateClassKeys',
  'deleteStudent',
  'importStudents', // 已有内联实现，同步后改为 require('./auth')
]

function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const only = args.filter((a) => !a.startsWith('--'))

  if (!fs.existsSync(TEMPLATE)) {
    console.error('✘ 模板不存在:', TEMPLATE)
    process.exit(1)
  }
  const tpl = fs.readFileSync(TEMPLATE, 'utf8')
  const targets = only.length ? only : TARGETS

  let synced = 0
  let stale = 0
  const missing = []

  for (const name of targets) {
    const dir = path.join(CF_DIR, name)
    const dest = path.join(dir, 'auth.js')

    if (!fs.statSync(dir, { throwIfNoEntry: false })) {
      missing.push(name + '（目录不存在）')
      continue
    }

    if (checkOnly) {
      if (!fs.existsSync(dest)) {
        console.log(`  ✘ ${name.padEnd(20)} 缺 auth.js`)
        stale++
      } else if (fs.readFileSync(dest, 'utf8') !== tpl) {
        console.log(`  ✘ ${name.padEnd(20)} auth.js 已过期`)
        stale++
      }
      continue
    }

    fs.writeFileSync(dest, tpl, 'utf8')
    console.log(`  ✔ ${name.padEnd(20)} auth.js 已同步`)
    synced++
  }

  if (missing.length) {
    console.log()
    missing.forEach((m) => console.log('  ⚠️  ' + m))
  }

  console.log()
  if (checkOnly) {
    if (stale === 0) {
      console.log('✔ 所有 auth.js 均为最新')
      process.exit(0)
    }
    console.log(`✘ ${stale} 个云函数的 auth.js 缺失或过期，请跑 node tools/sync-auth.js`)
    process.exit(1)
  }

  console.log(`已同步 ${synced} 个云函数`)
  console.log()
  console.log('提醒：同步后需在各云函数 index.js 里改成 require：')
  console.log("  const { verifyTeacher } = require('./auth')")
}

main()
