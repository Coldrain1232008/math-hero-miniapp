// cloudfunctions/coinOperation/index.js
// 金币核心操作：教师发放 / 扣除（走班级对公钱包）
//
// 资金模型：
//   super 管理员（手动改库充值） → 班级对公钱包 wallets → 学生金币 students.coins
//   教师发放：钱包 -N，学生 +N   教师扣除：学生 -N，钱包 +N（回收）
//   学生互赠不经过钱包，走 transferCoins
//
// 一致性保证：
//   钱包扣减 + 学生到账 + 流水写入放在同一个事务里，
//   三者要么全成功要么全回滚，杜绝"钱扣了没到账"。
//   批量发放时每个学生各开一个短事务，避免长事务超时，
//   单笔失败不影响其他人，失败明细会原样返回。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 鉴权：verifyTeacher 用 teacherKey 反查 classId（不信任前端传的 classId）
// auth.js 由 tools/sync-auth.js 从 tools/auth-template.js 同步，勿直接修改
const { verifyTeacher } = require('./auth')

// ============ 规则常量（想调随时改这里） ============
const MIN_AMOUNT = 1        // 单次最小金额
const MAX_AMOUNT = 999      // 单次最大金额
const MAX_BATCH = 60        // 单次批量最多人数（防止长事务超时）

// 金币流水类型
const TYPE = {
  GRANT: 'teacher_grant',     // 教师发放（收入）
  DEDUCT: 'teacher_deduct',   // 教师扣除（支出）
  TRANSFER_OUT: 'transfer_out',
  TRANSFER_IN: 'transfer_in',
  SHOP: 'shop_purchase',      // 预留：商城消费
}

/**
 * 今日日期字符串 YYYYMMDD（与 checkIn 保持同一口径，避免出现两个"今天"）
 * 注意：云函数时区取决于环境配置，这里沿用项目现有约定不做偏移。
 */
function getToday() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

/**
 * 获取（或自动创建）班级钱包
 *
 * 直接用 classId 作为钱包的 _id，天然保证"一个班只有一个钱包"：
 * 若两个请求同时首次使用金币功能，后一个会因主键冲突而失败，
 * 失败后重新读回即可，不会出现两个钱包导致余额分散。
 */
async function ensureWallet(classId, transaction) {
  const conn = transaction || db
  const res = await conn.collection('wallets').where({ classId }).limit(1).get()
  if (res.data && res.data.length > 0) return res.data[0]

  const now = db.serverDate()
  const data = {
    classId,
    balance: 0,
    totalRecharged: 0,   // super 管理员累计充值
    totalGranted: 0,     // 累计发放给学生
    totalRecycled: 0,    // 累计从学生扣回
    createdAt: now,
    updatedAt: now,
  }

  try {
    await conn.collection('wallets').add({ data: { _id: classId, ...data } })
    return { _id: classId, ...data }
  } catch (e) {
    // 主键冲突说明并发下已被创建，读回即可
    const again = await conn.collection('wallets').where({ classId }).limit(1).get()
    if (again.data && again.data.length > 0) return again.data[0]
    throw e
  }
}

/**
 * 单笔发放/扣除 —— 一个学生一个事务
 *
 * 用 db.runTransaction：冲突时自动回滚重试，比手动 startTransaction 可靠。
 * 业务性失败（余额不足）用返回值标记，不抛异常，
 * 避免无意义的重试把错误放大。
 *
 * @returns { success, studentId, name, amount, balance, error }
 */
async function processOne({ walletId, student, amount, action, classId, reason, operatorName, operatorId }) {
  const studentId = student._id

  try {
    const txResult = await db.runTransaction(async (transaction) => {
      // 1. 校验钱包余额（发放时）
      if (action === 'grant') {
        const walletRes = await transaction.collection('wallets').doc(walletId).get()
        const wallet = walletRes.data
        if (!wallet) return { ok: false, reason: '钱包不存在' }
        if ((wallet.balance || 0) < amount) {
          return { ok: false, reason: '钱包余额不足', needRecharge: true }
        }
      }

      // 2. 读取学生当前余额（事务内读，保证是最新的）
      const stuRes = await transaction.collection('students').doc(studentId).get()
      const stu = stuRes.data
      if (!stu) return { ok: false, reason: '学生不存在' }
      const before = stu.coins || 0

      // 扣除时余额必须够，且扣完不能为负
      if (action === 'deduct' && before < amount) {
        return { ok: false, reason: `余额不足（当前 ${before} 金币）` }
      }

      // 3. 钱包变动（发放 -N，扣除 +N 回流钱包）
      const isGrant = action === 'grant'
      const walletUpdate = {
        balance: _.inc(isGrant ? -amount : amount),
        updatedAt: db.serverDate(),
      }
      if (isGrant) walletUpdate.totalGranted = _.inc(amount)
      else walletUpdate.totalRecycled = _.inc(amount)
      await transaction.collection('wallets').doc(walletId).update({ data: walletUpdate })

      // 4. 学生金币变动（累计获得只增不减，供成就/排行用）
      const studentUpdate = {
        coins: _.inc(isGrant ? amount : -amount),
        updatedAt: db.serverDate(),
      }
      if (isGrant) studentUpdate.totalCoinsEarned = _.inc(amount)
      await transaction.collection('students').doc(studentId).update({ data: studentUpdate })

      // 5. 流水留痕（与资金变动同事务，账实必然一致）
      const afterBalance = before + (isGrant ? amount : -amount)
      await transaction.collection('coinLogs').add({
        data: {
          studentId,
          classId,
          amount: isGrant ? amount : -amount,
          balance: afterBalance,
          type: isGrant ? TYPE.GRANT : TYPE.DEDUCT,
          description: reason || (isGrant ? '教师发放' : '教师扣除'),
          operatorId: operatorId || '',
          operatorName: operatorName || '教师',
          date: getToday(),
          createdAt: db.serverDate(),
        },
      })

      return { ok: true, afterBalance }
    })

    if (!txResult.ok) {
      return {
        success: false,
        studentId,
        name: student.name,
        error: txResult.reason,
        needRecharge: txResult.needRecharge || false,
      }
    }

    return {
      success: true,
      studentId,
      name: student.name,
      amount: action === 'grant' ? amount : -amount,
      balance: txResult.afterBalance,
    }
  } catch (e) {
    console.error(`[coinOperation] 处理学生 ${studentId} 失败:`, e)
    return { success: false, studentId, name: student.name, error: e.message || '操作失败' }
  }
}

exports.main = async (event, context) => {
  const {
    action,           // 'grant' | 'deduct' | 'query'
    studentIds,       // 批量
    studentId,        // 单个
    amount,
    reason,
    operatorName,
    operatorId,
  } = event

  // ===== 鉴权第一道：教师密钥 =====
  // classId 一律由服务端用 teacherKey 反查，绝不用前端传的 event.classId。
  // 这条如果被绕过，学生改个参数就能给自己刷金币（2026-09-02 审计发现）。
  const auth = await verifyTeacher(event.teacherKey)
  if (!auth.ok) return { success: false, error: auth.error }
  const classId = auth.classId

  if (!action) return { success: false, error: '缺少 action' }

  try {
    // ========== 查询模式：返回钱包信息 ==========
    if (action === 'query') {
      const wallet = await ensureWallet(classId)
      return {
        success: true,
        wallet: {
          balance: wallet.balance || 0,
          totalRecharged: wallet.totalRecharged || 0,
          totalGranted: wallet.totalGranted || 0,
          totalRecycled: wallet.totalRecycled || 0,
        },
      }
    }

    if (action !== 'grant' && action !== 'deduct') {
      return { success: false, error: `未知操作: ${action}` }
    }

    // ========== 参数校验 ==========
    const ids = studentIds && studentIds.length > 0 ? studentIds : (studentId ? [studentId] : [])
    if (ids.length === 0) return { success: false, error: '请选择学生' }
    if (ids.length > MAX_BATCH) {
      return { success: false, error: `单次最多操作 ${MAX_BATCH} 人，当前 ${ids.length} 人` }
    }

    const rawAmount = Number(amount)
    if (!Number.isInteger(rawAmount) || rawAmount < MIN_AMOUNT || rawAmount > MAX_AMOUNT) {
      return { success: false, error: `金额需为 ${MIN_AMOUNT}-${MAX_AMOUNT} 之间的整数` }
    }

    // ========== 校验学生都在本班 ==========
    const students = []
    for (const id of ids) {
      const res = await db.collection('students').doc(id).get()
      const s = res.data
      if (!s) return { success: false, error: `学生不存在: ${id}` }
      if (s.classId !== classId) {
        return { success: false, error: '只能操作本班学生' }
      }
      students.push({ _id: s._id, name: s.heroName || s.realName || '未知' })
    }

    // ========== 前置校验钱包余额（发放时） ==========
    const wallet = await ensureWallet(classId)
    if (action === 'grant') {
      const need = rawAmount * students.length
      if ((wallet.balance || 0) < need) {
        return {
          success: false,
          error: `钱包余额不足：需要 ${need} 金币，当前仅剩 ${wallet.balance || 0} 金币`,
          needRecharge: true,
          walletBalance: wallet.balance || 0,
          required: need,
        }
      }
    }

    // ========== 逐人执行（每人一个短事务） ==========
    const results = []
    for (const student of students) {
      const r = await processOne({
        walletId: wallet._id,
        student,
        amount: rawAmount,
        rawAmount,
        action,
        classId,
        reason,
        operatorName,
        operatorId,
      })
      results.push(r)
    }

    const okList = results.filter((r) => r.success)
    const failList = results.filter((r) => !r.success)

    // 读回钱包最新余额（写后读回，不信任内存计算）
    const finalWalletRes = await db.collection('wallets').doc(wallet._id).get()
    const finalBalance = (finalWalletRes.data && finalWalletRes.data.balance) || 0

    return {
      success: okList.length > 0,
      message: failList.length === 0
        ? `${action === 'grant' ? '发放' : '扣除'}成功，共 ${okList.length} 人`
        : `成功 ${okList.length} 人，失败 ${failList.length} 人`,
      successCount: okList.length,
      failCount: failList.length,
      results,
      failures: failList,
      walletBalance: finalBalance,
    }
  } catch (e) {
    console.error('coinOperation error:', e)
    return { success: false, error: e.message || '操作失败' }
  }
}
