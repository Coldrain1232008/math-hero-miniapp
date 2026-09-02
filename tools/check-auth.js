#!/usr/bin/env node
/**
 * tools/check-auth.js —— 密钥鉴权兼容性自检
 *
 * 背景（2026-09-02 事故）：
 *   教师用小写密钥能登录，进 teacher-shop 商城管理页却弹「密钥不正确」。
 *   根因是 login.findByKey 做了双查（raw + 归一化），而 manageShop 只查
 *   归一化后的值 —— 数据库里存的是历史小写密钥，单查永远命中不了。
 *
 *   同一个坑会反复出现在「任何一个需要鉴权的新云函数」上，靠人记不靠谱，
 *   所以做成脚本，每次新增/修改鉴权逻辑后跑一遍。
 *
 * 用法：
 *   node tools/check-auth.js
 *
 * 判定的两种正确模式：
 *   ① 双查    —— 按密钥反查文档：先用用户输入原值查，查不到再用归一化值查
 *   ② 双归一  —— 已拿到文档做比对：两侧都过 normalizeKey 再比较
 *
 * 说明：
 *   本脚本是「清单 + 提示」，不是严格 lint。它按行做启发式判断，
 *   可能对复杂写法误报；看到 ⚠️ 时人工扫一眼列出的行号即可确认。
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const CF_DIR = path.join(ROOT, 'cloudfunctions')

// 需要做大小写兼容的密钥字段
const KEY_FIELDS = ['teacherKey', 'studentKey', 'classKey', 'superKey']

function readIfExists(p) {
  try {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null
  } catch (e) {
    return null
  }
}

/** 找出一行里涉及的密钥字段（排除注释行） */
function keyFieldsInWhere(line) {
  const trimmed = line.trim()
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return []
  return KEY_FIELDS.filter((f) => new RegExp('\\b' + f + '\\b').test(line))
}

/**
 * 判定一组 where 查询是否构成真正的双查（raw + 归一化值配对）
 * 不能只看次数：importStudents 里两次查询都是重复检测，值变量相同
 */
function isDualQuery(hits) {
  if (!hits || !hits.length) return false

  // 单行写法：_.in([raw, upper])
  for (const h of hits) {
    const inner = (h.text.match(/_\.in\s*\(\s*\[([^\]]*)\]/) || [])[1]
    if (inner && /\braw\b/i.test(inner) && /(upper|normalize)/i.test(inner)) return true
  }

  if (hits.length < 2) return false

  // 多行写法：提取每个 where 里字段对应的值表达式
  const vals = hits.map((h) => {
    const m = h.text.match(
      /\b(?:teacherKey|studentKey|classKey|superKey)\s*:\s*([^,}\)]+)/
    )
    return m ? m[1].trim() : ''
  })
  const hasRaw = vals.some((v) => /^(raw|key|input\w*)$/i.test(v))
  const hasNorm = vals.some((v) => /(upper|normalize)/i.test(v))
  return hasRaw && hasNorm
}

/**
 * 识别「泛型双查函数」——如 login 的 findByKey(field, rawKey)，
 * 内部用 where({ [field]: raw }) 动态键，字面量抓不到，只能靠调用点反推
 * @returns {{fields: Set<string>, calledFields: Set<string>}}
 */
function detectGenericDualQuery(src) {
  const calledFields = new Set()
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const defRe = /function\s+(\w+)\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*\{/g
  let m
  while ((m = defRe.exec(code))) {
    const fnName = m[1]
    const fieldArg = m[2]

    // 取函数体（括号配对）
    const start = m.index + m[0].length - 1
    let depth = 0
    let end = start
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') depth++
      else if (code[i] === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const body = code.slice(start, end)

    // 必须是动态键查询，且函数体内查了两次、带归一化
    const isDynKey = new RegExp('\\[\\s*' + fieldArg + '\\s*\\]\\s*:').test(body)
    if (!isDynKey) continue
    const whereCount = (body.match(/where\s*\(/g) || []).length
    if (whereCount < 2) continue
    if (!/(upper|normalize)/i.test(body)) continue

    const callRe = new RegExp('\\b' + fnName + "\\s*\\(\\s*'(\\w+)'", 'g')
    let c
    while ((c = callRe.exec(code))) calledFields.add(c[1])
  }

  return { fields: new Set(calledFields), calledFields }
}

/**
 * 维度二：写操作的鉴权扫描
 *
 * 维度一只管「查了密钥但只查一次」，管不到「压根不查密钥」——
 * 而这恰恰是更常见也更危险的形态：云函数从 event 直接拿 classId，
 * 前端给什么就写什么班。classId 在小程序 globalData 里就能拿到，
 * 学生改一下参数就能给自己刷金币、给全班塞学生。
 *
 * 分级：
 *   🔴 写操作 + event 直接收 classId + 无密钥鉴权 → 可跨班写任意数据
 *   ⚠️  写操作 + event 直接收 studentId + 无密钥/openid 校验 → 可操作同班他人
 *   ✅ 有密钥鉴权，或身份由 openid 推导不可伪造
 *
 * @param {string[]} dirs 云函数目录名
 * @returns {{red: Array, warn: Array, ok: Array}}
 */
function scanMissingAuth(dirs) {
  const red = []
  const warn = []
  const ok = []

  for (const d of dirs) {
    const src = readIfExists(path.join(CF_DIR, d, 'index.js'))
    if (!src) continue
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    // 只读函数不关心
    // 注意：.remove() 常常不带参数直接跟在 .where() 后面，
    //      所以不能要求后面必须跟 `{`，否则会漏掉 resetTaskProgress 这类
    const writes = []
    if (/\.add\s*\(/.test(code)) writes.push('add')
    if (/\.update\s*\(/.test(code) || /\.set\s*\(/.test(code)) writes.push('update')
    if (/\.remove\s*\(/.test(code)) writes.push('remove')
    if (!writes.length) continue

    // 鉴权手段：是否调用了鉴权函数
    //   不能靠「出现 teacherKey + where」判断——teacherGrantItem 用 doc() 不用
    //   where()，会被漏判；直接认鉴权函数名最稳
    const hasKeyAuth =
      /verifyTeacher|verifySuper|authenticate|findByKey/.test(code) ||
      /require\(\s*['"]\.\/auth['"]\s*\)/.test(code)
    // openid 归属校验：身份由微信上下文推导，前端伪造不了
    const hasOpenidCheck = /WX_OPENID|getWXContext/.test(code)

    // 从 event 直接接收的可伪造身份参数
    const takesClassId =
      /event\.classId/.test(code) ||
      /const\s*\{[^}]*\bclassId\b[^}]*\}\s*=\s*event/.test(code)
    const takesStudentId =
      /event\.studentId/.test(code) ||
      /const\s*\{[^}]*\bstudentId\b[^}]*\}\s*=\s*event/.test(code)

    // 「先查后验」模式（deleteClass 用的这种）：
    //   用 classId 取出班级文档，再把归一化后的密钥和输入值比对，不匹配就拒绝。
    //   这也是安全的——classId 只用于查找，写操作用的是校验通过后的文档。
    //
    //   判定必须收紧到「点号访问班级密钥字段」的字面量写法：
    //     ✅ deleteClass      normalizeKey(cls.teacherKey)   —— 拿真实密钥比对，是鉴权
    //     ✘  updateClassKeys  normalizeKey(cls[otherField])  —— 动态字段，那是查重不是鉴权
    //   两者正则长得像，但语义完全不同，不能一并赦免。
    const dualNormalizedCmp =
      /normalizeKey\s*\(\s*cls\.(teacherKey|superKey)\s*\)/.test(code) &&
      /===|!==/.test(code)
    const hasKeyCompare =
      dualNormalizedCmp || /inputKey\s*[!=]==?\s*realKey/.test(code)

    const row = { fn: d, writes: writes.join('/'), takesClassId, takesStudentId }

    if (hasKeyAuth || hasKeyCompare) {
      ok.push(row)
    } else if (takesClassId) {
      // 前端传什么班就写什么班。
      // 但如果做了 openid 校验（身份伪造不了），降级为中危——
      // 剩下的问题只是「能指定进哪个班」，危害小得多
      if (hasOpenidCheck) warn.push(row)
      else red.push(row)
    } else if (takesStudentId && !hasOpenidCheck) {
      warn.push(row)
    } else {
      ok.push(row)
    }
  }

  return { red, warn, ok }
}

function main() {
  const dirs = fs
    .readdirSync(CF_DIR)
    .filter((d) => fs.statSync(path.join(CF_DIR, d)).isDirectory())
    .sort()

  const findings = []

  for (const d of dirs) {
    const file = path.join(CF_DIR, d, 'index.js')
    const src = readIfExists(file)
    if (!src) continue

    const lines = src.split('\n')
    // 去注释后的代码，用于判断「有没有归一化意识」
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    // 1) 收集：按密钥字段做 where 查询的行
    //    两种写法都要收：
    //      · 字面量键  where({ teacherKey: raw })
    //      · 动态键    where({ [field]: raw })   —— login.findByKey 用的这种
    const whereHits = []
    const isDynKeyLine = (t) => /where\s*\(\s*\{[^}]*\[\s*\w+\s*\]\s*:/.test(t)

    lines.forEach((line, i) => {
      if (!/where\s*\(/.test(line)) return
      const fields = keyFieldsInWhere(line)
      const dyn = isDynKeyLine(line)
      if (fields.length || dyn) {
        whereHits.push({ line: i + 1, text: line.trim(), fields, dyn })
      }
    })

    // 完全没有按密钥查库的，不关心
    if (!whereHits.length) continue

    // 2) 归一化意识：有 normalizeKey 定义，或直接用 toUpperCase
    const hasNormalizeFn = /function\s+normalizeKey|const\s+normalizeKey|normalizeKey\s*=/.test(code)
    const hasUpper = /toUpperCase\s*\(/.test(code)

    // 3) 双查特征：同一字段被查多次，且值表达式是 raw / 归一化值 的配对
    //    · login.findByKey 用的是动态键 where({ [field]: raw })，抓不到字面量，
    //      单独走「泛型双查函数」识别
    //    · 只看「查了几次」会误判：importStudents 里两次查询都是重复检测，
    //      值变量相同，不是 raw+upper 配对
    const genericDual = detectGenericDualQuery(src)
    const queriedFields = new Set()
    whereHits.forEach((h) => h.fields.forEach((f) => queriedFields.add(f)))
    genericDual.calledFields.forEach((f) => queriedFields.add(f))

    const dualQueryFields = []
    const singleQueryFields = []
    for (const f of queriedFields) {
      const hits = whereHits.filter((h) => h.fields.includes(f))
      let dual = isDualQuery(hits)
      // 动态键查询：靠泛型函数（如 findByKey）兜底
      if (!dual && genericDual.fields.has(f)) dual = true

      if (dual) {
        const inline = hits.some((h) => /_\.in\s*\(/.test(h.text))
        dualQueryFields.push(f + (inline ? '(_.in)' : hits.length ? `×${hits.length}` : '(泛型函数)'))
      } else {
        singleQueryFields.push(f)
      }
    }

    // 动态键行若没被任何字段覆盖（如 updateClassKeys 的 where({ [f]: key })），
    // 单独列出来待确认，不能静默放过
    const dynHits = whereHits.filter((h) => h.dyn)
    if (dynHits.length) {
      const covered = dynHits.some((h) =>
        h.fields.some((f) => dualQueryFields.some((d) => d.indexOf(f) === 0))
      )
      // 泛型双查函数（如 login.findByKey）的动态键行本身不带字面量字段，
      // 已通过调用点判定为双查，这里不能再报一次
      const viaGeneric = genericDual.calledFields.size > 0
      if (!covered && !viaGeneric) {
        singleQueryFields.push(
          '动态键(' + dynHits.map((h) => 'L' + h.line).join(',') + ')'
        )
      }
    }

    // 4) 双归一比对：两侧都过 normalizeKey 再 !==/===
    const dualNormalizedCmp = lines.some((l) => {
      if (!/normalizeKey\s*\(/.test(l)) return false
      return /===|!==/.test(l) && (l.match(/normalizeKey\s*\(/g) || []).length >= 2
    })

    // 5) 用途区分——决定单查是「高危」还是「低危」
    //    鉴权（按密钥反查身份）漏双查 = 用户直接被拒之门外（本次事故）
    //    查重（新建/改密钥时判冲突）漏双查 = 极低概率撞号，且不致命
    //
    //    只认函数名特征，不用中文关键词——注释里写「登录」「鉴权」会大面积误判
    const isAuthPurpose = /verify\w*Key|verifyTeacher|verifySuper|authenticate|findByKey|checkAuth/.test(code)

    findings.push({
      fn: d,
      whereHits,
      hasNormalizeFn,
      hasUpper,
      dualQueryFields,
      singleQueryFields,
      dualNormalizedCmp,
      isAuthPurpose,
    })
  }

  // ---------------- 输出报告 ----------------
  console.log('='.repeat(66))
  console.log('  密钥鉴权兼容性自检')
  console.log('='.repeat(66))
  console.log()
  console.log('正确模式：① 双查（raw + 归一化）  ② 双归一比对（两侧都 normalize）')
  console.log()

  let red = 0
  let warn = 0

  for (const f of findings) {
    const verdicts = []

    if (!f.hasNormalizeFn && !f.hasUpper) {
      verdicts.push('🔴 完全没有归一化，历史小写密钥必挂')
      red++
    } else if (f.singleQueryFields.length) {
      if (f.dualNormalizedCmp && !f.dualQueryFields.length && !f.isAuthPurpose) {
        verdicts.push('✅ 双归一比对')
      } else if (f.isAuthPurpose) {
        // 鉴权路径单查 = 复刻本次事故：能登录但进不了任何需鉴权的页面
        verdicts.push(
          `🔴 鉴权用途但只查 1 次，历史小写密钥会被拒：${f.singleQueryFields.join(', ')}`
        )
        red++
      } else {
        verdicts.push(`⚠️  查重/匹配用途，单查低危：${f.singleQueryFields.join(', ')}`)
        warn++
      }
    }

    if (f.dualQueryFields.length) {
      verdicts.push(`✅ 双查：${f.dualQueryFields.join(', ')}`)
    }

    console.log(`【${f.fn}】  ${verdicts.join('   ') || '—'}`)
    for (const h of f.whereHits) {
      console.log(`    L${String(h.line).padEnd(4)} ${h.text.slice(0, 88)}`)
    }
    console.log()
  }

  console.log('-'.repeat(66))
  console.log(`共 ${findings.length} 个云函数涉及密钥查询    🔴 高危 ${red}    ⚠️  待确认 ${warn}`)
  console.log()

  if (red === 0 && warn === 0) {
    console.log('✔ 维度一通过：所有密钥查询都是双查或双归一比对')
  } else {
    console.log('处理建议：')
    console.log('  🔴 必须补 normalizeKey + 双查，参照 cloudfunctions/login/index.js 的 findByKey')
    console.log('  ⚠️  确认该处用途：')
    console.log('      · 鉴权（按密钥反查文档）→ 必须双查')
    console.log('      · 唯一性查重（新建/改密钥）→ 低危，可暂不处理，见 MEMORY.md')
  }

  // ---------------- 维度二：写操作的鉴权扫描 ----------------
  const missing = scanMissingAuth(dirs)

  console.log()
  console.log('='.repeat(66))
  console.log('  维度二：写操作鉴权扫描（是否存在压根不鉴权的云函数）')
  console.log('='.repeat(66))
  console.log()

  if (missing.red.length) {
    console.log(`🔴 高危 ${missing.red.length} 个 —— event 直接收 classId，且无密钥鉴权：`)
    console.log('   前端传什么班就写什么班，学生改参数即可跨班写入')
    console.log()
    for (const r of missing.red) {
      console.log(`   ${r.fn.padEnd(24)} 写操作: ${r.writes}`)
    }
    console.log()
  }

  if (missing.warn.length) {
    console.log(`⚠️  中危 ${missing.warn.length} 个 —— event 收 studentId，无密钥也无 openid 校验：`)
    console.log('   可操作同班其他学生的数据')
    console.log()
    for (const w of missing.warn) {
      console.log(`   ${w.fn.padEnd(24)} 写操作: ${w.writes}`)
    }
    console.log()
  }

  console.log(`✅ 已鉴权或身份不可伪造：${missing.ok.length} 个`)
  console.log()
  console.log('修法：云函数内用 teacherKey 反查 classId（不信任 event.classId），')
  console.log('     前端调 callFunction 时改传 teacherKey。参照 importStudents 的写法。')

  process.exit(red > 0 || missing.red.length > 0 ? 1 : 0)
}

main()
