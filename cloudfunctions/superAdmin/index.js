// 云函数：superAdmin
// super 管理员后台 —— 班级钱包充值 / 全局金币总览 / 操作审计
//
// ⚠️ 安全原则（务必保持）：
//   前端把入口藏起来 ≠ 安全。任何人都可以在小程序里直接 wx.cloud.callFunction
//   调到本函数，所以每个 action 的第一行必须是服务端 verifySuper 鉴权，
//   绝不能只靠页面隐藏或前端判断。
//
// ⚠️ 密钥存放原则：
//   管理员密钥只存在于 admins 集合和本函数的比对逻辑里，
//   前端只是把「用户输入的字符串」传过来，小程序包被反编译也拿不到密钥。
//
// 依赖集合：admins（白名单）、adminLogs（审计）、classes、wallets、students

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 单次充值上限，防止手滑多打一个 0
const MAX_RECHARGE = 100000

// 密钥归一化：与项目其它地方保持一致（trim + 大写）
// 写入侧和查询侧必须成对出现，否则改完密钥就登不进去
function normalizeKey(raw) {
  return (raw || '').trim().toUpperCase()
}

// ===== 鉴权：所有 action 的第一步 =====
// ⚠️ 必须与 login / manageShop 的密钥查询保持一致 —— 先按用户输入原值查
// （命中历史数据里的小写密钥），查不到再按归一化值查。否则小写密钥
// 用户能登录 super 后台但执行任何 action 都会被拒。
async function verifySuper(superKey) {
  const raw = (superKey || '').trim()
  if (!raw) return { ok: false, error: '缺少管理员密钥' }

  try {
    if (raw) {
      const r1 = await db.collection('admins').where({ role: 'super', superKey: raw }).limit(1).get()
      if (r1.data && r1.data.length > 0) {
        return { ok: true, admin: r1.data[0] }
      }
    }
    const upper = normalizeKey(superKey)
    if (upper && upper !== raw) {
      const r2 = await db.collection('admins').where({ role: 'super', superKey: upper }).limit(1).get()
      if (r2.data && r2.data.length > 0) {
        return { ok: true, admin: r2.data[0] }
      }
    }
    return { ok: false, error: '管理员密钥不正确' }
  } catch (err) {
    // 集合不存在时给明确提示，不要静默失败（项目铁律：绝不假设集合已存在）
    return {
      ok: false,
      error: 'admins 集合未创建或查询失败，请先在云控制台建集合：' + err.message
    }
  }
}

// ===== 全量拉学生（只取需要的字段）=====
// 云函数端单次 get 上限 1000 条，必须分页；这里同步拿人数和金币，避免 N+1 查询
async function fetchAllStudents() {
  const out = []
  const PAGE = 1000
  for (let i = 0; i < 20; i++) {
    const res = await db.collection('students')
      .field({ classId: true, coins: true })
      .skip(out.length)
      .limit(PAGE)
      .get()
    out.push(...res.data)
    if (res.data.length < PAGE) break
  }
  return out
}

// ===== 仪表盘：班级列表 + 全局总览 =====
async function getDashboard() {
  // 1. 班级
  const classRes = await db.collection('classes').limit(1000).get()
  const classes = classRes.data || []

  // 2. 钱包（_id = classId）
  let wallets = []
  try {
    const wRes = await db.collection('wallets').limit(1000).get()
    wallets = wRes.data || []
  } catch (err) {
    // wallets 可能还没建；不阻断，按「全部为 0」处理
    console.warn('wallets 查询失败，按空处理：', err.message)
  }
  const walletMap = {}
  wallets.forEach(w => { walletMap[w._id] = w })

  // 3. 学生统计
  let students = []
  try {
    students = await fetchAllStudents()
  } catch (err) {
    console.warn('students 查询失败，按空处理：', err.message)
  }
  const statMap = {}
  students.forEach(s => {
    const cid = s.classId
    if (!statMap[cid]) statMap[cid] = { count: 0, coins: 0 }
    statMap[cid].count += 1
    statMap[cid].coins += (s.coins || 0)
  })

  // 4. 组装班级列表
  const list = classes.map(c => {
    const w = walletMap[c._id]
    const st = statMap[c._id] || { count: 0, coins: 0 }
    return {
      _id: c._id,
      name: c.name || '未命名班级',
      teacherKey: c.teacherKey || '',
      studentKey: c.studentKey || '',
      studentCount: st.count,
      studentCoins: st.coins,
      balance: w ? (w.balance || 0) : 0,
      totalRecharged: w ? (w.totalRecharged || 0) : 0,
      totalGranted: w ? (w.totalGranted || 0) : 0,
      totalRecycled: w ? (w.totalRecycled || 0) : 0,
      totalBurned: w ? (w.totalBurned || 0) : 0,
      hasWallet: !!w
    }
  })

  // 5. 全局总览 + 守恒校验
  //    资金守恒：发行总量 = 学生持有 + 钱包沉淀 + 商城已销毁
  //      · grant / deduct 是钱包 ↔ 学生的转移，不改变总量
  //      · transfer 是学生之间的转移，不改变总量
  //      · 商城买虚拟品 → 学生金币销毁，记 wallets.totalBurned（出口，防通胀）
  //      · 商城买实物   → 金币回流钱包，记 balance + totalRecycled（补偿采购成本）
  //    ⚠️ 加商城后守恒式多了一项，漏掉 totalBurned 会让 dashboard 一直报假差额
  let totalRecharged = 0
  let walletBalance = 0
  let totalBurned = 0
  wallets.forEach(w => {
    totalRecharged += (w.totalRecharged || 0)
    walletBalance += (w.balance || 0)
    totalBurned += (w.totalBurned || 0)
  })
  let studentCoins = 0
  students.forEach(s => { studentCoins += (s.coins || 0) })

  const diff = totalRecharged - (studentCoins + walletBalance + totalBurned)

  return {
    success: true,
    classes: list,
    overview: {
      classCount: classes.length,
      studentCount: students.length,
      totalRecharged,
      studentCoins,
      walletBalance,
      totalBurned,
      diff,                       // 应为 0；非 0 说明有人手动改过库或存在 bug
      balanced: diff === 0
    }
  }
}

// ===== 充值：钱包 balance 与 totalRecharged 同时 += N =====
async function doRecharge(admin, event) {
  const { classId, amount, note } = event

  if (!classId) return { success: false, error: '缺少班级 ID' }

  const n = parseInt(amount, 10)
  if (!Number.isInteger(n) || n <= 0) {
    return { success: false, error: '充值金额必须是正整数' }
  }
  if (n > MAX_RECHARGE) {
    return { success: false, error: '单次充值不能超过 ' + MAX_RECHARGE }
  }

  // 校验班级存在
  let cls = null
  try {
    const r = await db.collection('classes').doc(classId).get()
    cls = r.data
  } catch (err) {
    return { success: false, error: '班级不存在：' + classId }
  }

  let before = 0
  let after = 0
  let created = false

  try {
    // 用 runTransaction（冲突自动回滚重试），钱包扣减 + 审计日志同一事务
    await db.runTransaction(async tx => {
      let wallet = null
      try {
        const r = await tx.collection('wallets').doc(classId).get()
        wallet = r.data
      } catch (err) {
        wallet = null   // 这个班还没用过金币，wallets 里没记录
      }

      before = wallet ? (wallet.balance || 0) : 0
      after = before + n

      if (!wallet) {
        created = true
        // ⚠️ _id 直接用 classId。若改成 where({classId}) 查不到再 add，
        //    并发时（班级首次使用金币）会建出两个钱包，余额分散，教师看到错误余额
        await tx.collection('wallets').add({
          data: {
            _id: classId,
            classId,
            balance: n,
            totalRecharged: n,
            totalGranted: 0,
            totalRecycled: 0,
            createdAt: Date.now()
          }
        })
      } else {
        await tx.collection('wallets').doc(classId).update({
          data: {
            balance: _.inc(n),
            totalRecharged: _.inc(n)
          }
        })
      }

      // 审计日志，与充值同事务：充了就必然有记录
      await tx.collection('adminLogs').add({
        data: {
          action: 'recharge',
          operatorName: admin.name || 'super',
          operatorOpenid: cloud.getWXContext().OPENID || '',
          targetClassId: classId,
          targetClassName: cls.name || '',
          amount: n,
          before,
          after,
          note: note || '',
          createdAt: Date.now()
        }
      })
    })
  } catch (err) {
    // 业务失败用返回值标记，不要在事务里抛异常触发无意义重试
    return { success: false, error: '充值事务失败：' + err.message }
  }

  // 写后读回验证（项目铁律：update 返回结构不可靠，一律读回确认）
  try {
    const saved = (await db.collection('wallets').doc(classId).get()).data
    if (!saved || saved.balance !== after) {
      return {
        success: false,
        error: '充值后校验失败，期望余额 ' + after + '，实际 ' + (saved ? saved.balance : '无记录')
      }
    }
  } catch (err) {
    return { success: false, error: '充值后校验失败：' + err.message }
  }

  return {
    success: true,
    amount: n,
    before,
    after,
    created,
    className: cls.name || ''
  }
}

// ===== 审计日志 =====
async function getAdminLogs(event) {
  const limit = Math.min(parseInt(event.limit, 10) || 50, 100)
  const skip = parseInt(event.skip, 10) || 0

  try {
    const res = await db.collection('adminLogs')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    return { success: true, logs: res.data || [] }
  } catch (err) {
    return {
      success: false,
      error: 'adminLogs 集合未创建或查询失败，请先在云控制台建集合：' + err.message,
      logs: []
    }
  }
}

exports.main = async (event, context) => {
  const { action, superKey } = event

  try {
    // 登录：只验密钥，返回管理员信息
    if (action === 'login') {
      const v = await verifySuper(superKey)
      if (!v.ok) return { success: false, error: v.error }
      return {
        success: true,
        admin: { name: v.admin.name || 'super', role: v.admin.role || 'super' }
      }
    }

    // ===== 以下所有操作：先鉴权，再办事 =====
    const v = await verifySuper(superKey)
    if (!v.ok) return { success: false, error: v.error }

    if (action === 'dashboard') return await getDashboard()
    if (action === 'recharge') return await doRecharge(v.admin, event)
    if (action === 'getAdminLogs') return await getAdminLogs(event)

    return { success: false, error: '未知操作：' + action }

  } catch (err) {
    console.error('superAdmin error:', err)
    return { success: false, error: err.message }
  }
}
