// cloudfunctions/shop/index.js
// 商城：商品列表 + 购买（学生端）
//
// 资金模型（金币出口，与 coinOperation 的入口对称）：
//   settleType = 'burn'   → 虚拟商品，零成本 → 金币销毁，记 wallets.totalBurned
//                           （不回流钱包，否则教师钱包虚增 → 通胀失控）
//   settleType = 'refund' → 实物商品，教师掏钱采购 → 金币回流班级钱包
//                           （补偿采购成本，逻辑等同于 teacher_deduct）
//
// 账目守恒式随之变为：
//   totalRecharged = studentCoins + walletBalance + totalBurned
//
// 一致性保证（沿用金币模块四条工程决策）：
//   1. 用 db.runTransaction，冲突自动回滚重试
//   2. 业务失败（余额不足/超限购）用返回值标记，不抛异常，避免无意义重试
//   3. 库存扣减用 where 条件更新（stock > 0 才扣），天然防超卖
//   4. 扣币 + 发货 + 流水 + 订单 + 库存 全部在同一事务内

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function getToday() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

// ============ 商品类型 → 发货动作 ============
// 与 teacherGrantItem 的 action 命名对齐，两边语义一致
const DELIVERY = {
  draw_ticket: (n) => ({ bonusDraws: _.inc(n) }),          // 永久抽卡次数，不清零
  challenge_voucher: (n) => ({ challengeVouchers: _.inc(n) }),
  growth_accelerant: (n) => ({ growthAccelerants: _.inc(n) }),
}

const TYPE_LABEL = {
  draw_ticket: '抽卡次数',
  challenge_voucher: '挑战凭证',
  growth_accelerant: '成长加速剂',
  coupon: '特权券',
}

/**
 * 查询学生在某商品上的购买量
 * @returns { total: 累计购买件数, today: 今日购买件数 }
 */
async function getPurchaseStats(studentId, itemId, today) {
  try {
    const res = await db.collection('shopOrders')
      .where({ studentId, itemId, status: _.neq('cancelled') })
      .limit(100)
      .get()
    const list = res.data || []

    // ⚠️ 限购按"件数"统计，不能按"订单条数"：
    //    一次买 3 件只落 1 条订单，按条数算限购会形同虚设
    let total = 0
    let todayQty = 0
    for (const o of list) {
      const q = Number(o.quantity) > 0 ? Number(o.quantity) : 1
      total += q
      if (o.date === today) todayQty += q
    }
    return { total, today: todayQty }
  } catch (e) {
    // 查不到限流依据时放行比拒绝更危险，这里返回 error 让调用方直接拒绝下单
    console.error('[shop] 查询购买记录失败:', e)
    return { total: 0, today: 0, error: e.message || String(e) }
  }
}

/**
 * 确保班级钱包存在
 *
 * ⚠️ 事务里 `doc().update()` 对不存在的文档会 reject（不是返回 updated=0），
 *    一旦 reject 整个事务回滚、购买失败。而班级完全可能从没充值过 → 没有钱包。
 *    所以必须在事务外先补建。
 *    add 用 _id = classId（见金币模块决策 3），并发时后者 add 会失败，
 *    但文档已存在，随后的 update 照常生效，无需额外处理。
 */
async function ensureWallet(classId) {
  try {
    const res = await db.collection('wallets').doc(classId).get()
    if (res.data) {
      // 存量钱包是商城上线前建的，没有 totalBurned 字段。
      // 统一在这里补齐，后面事务里就能放心用 _.inc
      if (res.data.totalBurned === undefined) {
        await db.collection('wallets').doc(classId).update({
          data: { totalBurned: 0, updatedAt: db.serverDate() },
        })
      }
      return true
    }
  } catch (e) {
    // 文档不存在，往下走补建
  }
  try {
    await db.collection('wallets').add({
      data: {
        _id: classId,
        classId,
        balance: 0,
        totalRecharged: 0,
        totalGranted: 0,
        totalRecycled: 0,
        totalBurned: 0,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  } catch (e) {
    // 并发下另一个请求可能刚建好，忽略即可
    console.warn('[shop] 补建钱包失败（并发时已存在则无妨）:', e.message)
  }
  return true
}

// ==================== 商品列表 ====================
async function listItems(studentId) {
  const stuRes = await db.collection('students').doc(studentId).get()
  const student = stuRes.data
  if (!student) return { success: false, error: '学生不存在' }
  const classId = student.classId

  // 全局模板（classId 为空）+ 本班自定义，两者并集
  let items = []
  try {
    const res = await db.collection('shopItems')
      .where({
        classId: _.in(['', classId]),
        status: 'on',
      })
      .get()
    items = res.data || []
  } catch (e) {
    return {
      success: false,
      error: 'shopItems 集合未创建或查询失败，请先在云控制台创建该集合',
      detail: e.message || String(e),
    }
  }

  // 该学生的购买记录（用于显示"已购 N/M"和校验限购）
  let orders = []
  try {
    const oRes = await db.collection('shopOrders')
      .where({ studentId, status: _.neq('cancelled') })
      .get()
    orders = oRes.data || []
  } catch (e) {
    // 订单集合缺失时不阻断浏览，只是显示不出已购数量
    console.warn('[shop] 查询订单失败:', e.message)
  }

  const today = getToday()
  const boughtMap = {}
  for (const o of orders) {
    const key = o.itemId
    if (!boughtMap[key]) boughtMap[key] = { total: 0, today: 0 }
    // 同样是"件数"而非"订单条数"，与 getPurchaseStats 口径保持一致
    const q = Number(o.quantity) > 0 ? Number(o.quantity) : 1
    boughtMap[key].total += q
    if (o.date === today) boughtMap[key].today += q
  }

  const list = items.map((it) => {
    const bought = boughtMap[it._id] || { total: 0, today: 0 }
    const limitTotal = it.limitPerUser || 0
    const limitDay = it.limitPerDay || 0
    const soldOut = it.stock === 0
    const reachTotal = limitTotal > 0 && bought.total >= limitTotal
    const reachDay = limitDay > 0 && bought.today >= limitDay
    return {
      _id: it._id,
      name: it.name,
      desc: it.desc || '',
      icon: it.icon || '🎁',
      price: it.price,
      type: it.type,
      typeLabel: TYPE_LABEL[it.type] || it.type,
      payload: it.payload || 1,
      stock: it.stock === undefined ? -1 : it.stock,
      limitPerUser: limitTotal,
      limitPerDay: limitDay,
      isGlobal: !it.classId,
      boughtTotal: bought.total,
      boughtToday: bought.today,
      soldOut,
      reachTotal,
      reachDay,
      canBuy: !soldOut && !reachTotal && !reachDay,
      disabledReason: soldOut ? '已售罄'
        : reachTotal ? `每人限购 ${limitTotal} 件`
        : reachDay ? `今日限购 ${limitDay} 件`
        : '',
    }
  })

  return {
    success: true,
    balance: student.coins || 0,
    items: list,
  }
}

// ==================== 购买 ====================
async function buy({ studentId, itemId, quantity }) {
  const qty = Number(quantity) > 0 ? Math.floor(Number(quantity)) : 1
  if (qty > 10) return { success: false, error: '单次最多购买 10 件' }

  const stuRes = await db.collection('students').doc(studentId).get()
  const student = stuRes.data
  if (!student) return { success: false, error: '学生不存在' }
  const classId = student.classId

  // 商品必须属于本班或全局模板，防止跨班购买
  const itemRes = await db.collection('shopItems').doc(itemId).get()
  const item = itemRes.data
  if (!item) return { success: false, error: '商品不存在' }
  if (item.classId && item.classId !== classId) {
    return { success: false, error: '该商品不属于你的班级' }
  }
  if (item.status !== 'on') return { success: false, error: '商品已下架' }

  // ⚠️ 库存为 0 必须在这里拦掉。下面的库存扣减只在 stock > 0 时才走条件更新，
  //    stock === 0 会整个跳过扣减分支直接发货 —— 那就是超卖。
  if (item.stock === 0) return { success: false, error: '已售罄', soldOut: true }
  if (item.stock > 0 && item.stock < qty) {
    return { success: false, error: `库存不足（仅剩 ${item.stock} 件）`, soldOut: true }
  }

  if (item.type === 'coupon') {
    return { success: false, error: '特权券需要线下核销，暂未开放' }
  }

  // 限购校验（在事务外先查一次，事务内再查一次防并发）
  const today = getToday()
  const stats = await getPurchaseStats(studentId, itemId, today)
  if (stats.error) {
    return { success: false, error: '无法校验限购，请稍后再试' }
  }
  if (item.limitPerUser > 0 && stats.total + qty > item.limitPerUser) {
    return {
      success: false,
      error: `每人限购 ${item.limitPerUser} 件，你已购买 ${stats.total} 件`,
    }
  }
  if (item.limitPerDay > 0 && stats.today + qty > item.limitPerDay) {
    return {
      success: false,
      error: `今日限购 ${item.limitPerDay} 件，你今天已购买 ${stats.today} 件`,
    }
  }

  const totalPrice = item.price * qty
  const deliverFn = DELIVERY[item.type]
  if (!deliverFn) return { success: false, error: `未知商品类型: ${item.type}` }

  // 事务外补建钱包：事务内 doc().update() 撞上不存在的文档会直接 reject
  await ensureWallet(classId)

  const txResult = await db.runTransaction(async (transaction) => {
    // 1. 事务内重新读余额，保证是最新的
    const sRes = await transaction.collection('students').doc(studentId).get()
    const stu = sRes.data
    if (!stu) return { ok: false, reason: '学生不存在' }
    const before = stu.coins || 0
    if (before < totalPrice) {
      return { ok: false, reason: `金币不足（需要 ${totalPrice}，当前 ${before}）`, needCoin: true }
    }

    // 2. 库存扣减（条件更新：stock > 0 才扣，天然防超卖）
    if (item.stock > 0) {
      const stockRes = await transaction.collection('shopItems')
        .where({ _id: itemId, stock: _.gte(qty) })
        .update({ data: { stock: _.inc(-qty) } })
      const updated = stockRes && stockRes.stats ? stockRes.stats.updated : 0
      if (!updated) return { ok: false, reason: '库存不足', soldOut: true }
    }

    // 3. 扣币 + 发货（合并为一次 update，少一次写、也少一个中间态）
    const deliverData = deliverFn((item.payload || 1) * qty)
    await transaction.collection('students').doc(studentId).update({
      data: {
        coins: _.inc(-totalPrice),
        ...deliverData,
        updatedAt: db.serverDate(),
      },
    })

    // 4. 金币去向：虚拟品销毁记账 / 实物回流钱包
    const isBurn = item.settleType !== 'refund'
    if (isBurn) {
      // 虚拟商品零成本，金币离开系统 → wallets.totalBurned +N
      // 不回流钱包，否则教师钱包虚增、通胀失控
      await transaction.collection('wallets').doc(classId).update({
        data: { totalBurned: _.inc(totalPrice), updatedAt: db.serverDate() },
      })
    } else {
      // 实物商品：金币回流班级钱包，补偿教师采购成本
      await transaction.collection('wallets').doc(classId).update({
        data: {
          balance: _.inc(totalPrice),
          totalRecycled: _.inc(totalPrice),
          updatedAt: db.serverDate(),
        },
      })
    }

    // 5. 金币流水（复用 coinOperation 预留的 shop_purchase 类型）
    const afterBalance = before - totalPrice
    await transaction.collection('coinLogs').add({
      data: {
        studentId,
        classId,
        amount: -totalPrice,
        balance: afterBalance,
        type: 'shop_purchase',
        description: `商城购买：${item.name} ×${qty}`,
        operatorId: studentId,
        operatorName: student.heroName || student.realName || '学生',
        relatedId: itemId,
        date: today,
        createdAt: db.serverDate(),
      },
    })

    // 6. 订单留痕（虚拟商品即时完成）
    await transaction.collection('shopOrders').add({
      data: {
        studentId,
        classId,
        itemId,
        itemName: item.name,
        itemIcon: item.icon || '🎁',
        type: item.type,
        price: item.price,
        quantity: qty,
        totalPrice,
        settleType: isBurn ? 'burn' : 'refund',
        status: 'completed',
        date: today,
        createdAt: db.serverDate(),
        completedAt: db.serverDate(),
      },
    })

    return { ok: true, afterBalance }
  })

  if (!txResult.ok) {
    return { success: false, error: txResult.reason, soldOut: txResult.soldOut || false }
  }

  // 写后读回，不信任事务内的内存计算
  const verify = await db.collection('students').doc(studentId).get()
  const realBalance = (verify.data && verify.data.coins) || 0

  return {
    success: true,
    message: `购买成功：${item.name} ×${qty}`,
    spent: totalPrice,
    balance: realBalance,
    itemName: item.name,
    quantity: qty,
  }
}

exports.main = async (event, context) => {
  const { action, studentId, itemId, quantity } = event

  if (!action) return { success: false, error: '缺少 action' }
  if (!studentId) return { success: false, error: '缺少 studentId' }

  try {
    if (action === 'list') return await listItems(studentId)
    if (action === 'buy') {
      if (!itemId) return { success: false, error: '缺少 itemId' }
      return await buy({ studentId, itemId, quantity })
    }
    return { success: false, error: `未知操作: ${action}` }
  } catch (e) {
    console.error('shop error:', e)
    return { success: false, error: e.message || '操作失败' }
  }
}
