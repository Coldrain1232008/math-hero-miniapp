// cloudfunctions/manageShop/index.js
// 商城商品管理 —— 两级权限
//
//   教师（teacherKey）→ 只能增删改本班商品（classId = 自己的班）
//   super（superKey）  → 能增删改全局模板（classId = ''），也能改任何班
//
// ⚠️ 安全原则（与 superAdmin 一致）：
//   每个 action 第一行必须服务端鉴权。前端藏入口 ≠ 安全，
//   任何人都能直接 wx.cloud.callFunction 调到本函数。
//
// ⚠️ 删除策略：
//   已有订单的商品不做物理删除，改为下架（status: 'off'），
//   否则历史订单里的商品信息会变成孤儿数据，对不上账。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 允许的商品类型（与 shop 云函数的 DELIVERY 保持一致）
const ALLOWED_TYPES = ['draw_ticket', 'challenge_voucher', 'growth_accelerant', 'coupon']

const TYPE_LABEL = {
  draw_ticket: '抽卡次数',
  challenge_voucher: '挑战凭证',
  growth_accelerant: '成长加速剂',
  coupon: '特权券',
}

function normalizeKey(raw) {
  return (raw || '').trim().toUpperCase()
}

// ===== 鉴权 A：教师（按 teacherKey 找班）=====
async function verifyTeacher(teacherKey) {
  const key = normalizeKey(teacherKey)
  if (!key) return { ok: false, error: '缺少教师密钥' }
  try {
    const res = await db.collection('classes')
      .where({ teacherKey: key })
      .limit(1)
      .get()
    if (!res.data || res.data.length === 0) {
      return { ok: false, error: '教师密钥不正确' }
    }
    return { ok: true, role: 'teacher', classId: res.data[0]._id, className: res.data[0].name }
  } catch (err) {
    return { ok: false, error: 'classes 集合查询失败：' + err.message }
  }
}

// ===== 鉴权 B：super（按 superKey 查 admins）=====
async function verifySuper(superKey) {
  const key = normalizeKey(superKey)
  if (!key) return { ok: false, error: '缺少管理员密钥' }
  try {
    const res = await db.collection('admins')
      .where({ role: 'super', superKey: key })
      .limit(1)
      .get()
    if (!res.data || res.data.length === 0) {
      return { ok: false, error: '管理员密钥不正确' }
    }
    return { ok: true, role: 'super', admin: res.data[0] }
  } catch (err) {
    return {
      ok: false,
      error: 'admins 集合未创建或查询失败，请先在云控制台建集合：' + err.message,
    }
  }
}

/**
 * 统一鉴权入口
 * 传 superKey 走 super，传 teacherKey 走教师；两个都没传直接拒绝
 */
async function authenticate(event) {
  if (event.superKey) return await verifySuper(event.superKey)
  if (event.teacherKey) return await verifyTeacher(event.teacherKey)
  return { ok: false, error: '缺少身份凭证（superKey 或 teacherKey）' }
}

/**
 * 判断调用者能否操作某个商品
 * 教师只能碰自己班的；super 能碰全局模板和任何班
 */
function canOperate(auth, item, targetClassId) {
  if (auth.role === 'super') return true
  if (auth.role === 'teacher') {
    return targetClassId === auth.classId && (!item || item.classId === auth.classId)
  }
  return false
}

// ===== 商品字段校验 =====
function validateItem(data) {
  const { name, price, type } = data
  if (!name || !String(name).trim()) return '商品名称不能为空'
  if (String(name).trim().length > 20) return '商品名称不超过 20 字'

  const p = Number(price)
  if (!Number.isInteger(p) || p < 1 || p > 9999) {
    return '价格需为 1-9999 之间的整数'
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return `商品类型不合法（可选：${ALLOWED_TYPES.join(' / ')}）`
  }

  const payload = Number(data.payload || 1)
  if (!Number.isInteger(payload) || payload < 1 || payload > 99) {
    return '发放数量需为 1-99 之间的整数'
  }

  const stock = Number(data.stock === undefined ? -1 : data.stock)
  if (!Number.isInteger(stock) || stock < -1) return '库存需为 -1（不限）或 >= 0 的整数'

  const limitPerUser = Number(data.limitPerUser || 0)
  if (!Number.isInteger(limitPerUser) || limitPerUser < 0 || limitPerUser > 999) {
    return '每人限购需为 0（不限）或 1-999 的整数'
  }

  const limitPerDay = Number(data.limitPerDay || 0)
  if (!Number.isInteger(limitPerDay) || limitPerDay < 0 || limitPerDay > 99) {
    return '每日限购需为 0（不限）或 1-99 的整数'
  }

  return null
}

function buildItemData(data, classId) {
  return {
    classId,                          // '' 表示全局模板
    name: String(data.name).trim(),
    desc: data.desc ? String(data.desc).trim() : '',
    icon: data.icon || '🎁',
    price: Number(data.price),
    type: data.type,
    payload: Number(data.payload || 1),
    settleType: data.settleType === 'refund' ? 'refund' : 'burn',
    stock: Number(data.stock === undefined ? -1 : data.stock),
    limitPerUser: Number(data.limitPerUser || 0),
    limitPerDay: Number(data.limitPerDay || 0),
    status: data.status === 'off' ? 'off' : 'on',
    updatedAt: db.serverDate(),
  }
}

// ==================== 列出可管理的商品 ====================
async function listItems(auth, targetClassId) {
  try {
    // 教师看本班的 + 全局模板；super 看指定班的 + 全局模板
    const res = await db.collection('shopItems')
      .where({ classId: _.in(['', targetClassId]) })
      .get()
    const items = (res.data || []).map((it) => ({
      ...it,
      isGlobal: !it.classId,
      typeLabel: TYPE_LABEL[it.type] || it.type,
      editable: auth.role === 'super' || !!it.classId,
    }))
    // 全局模板排前面，再按价格
    items.sort((a, b) => {
      if (a.isGlobal !== b.isGlobal) return a.isGlobal ? -1 : 1
      return a.price - b.price
    })
    return { success: true, items, role: auth.role, classId: targetClassId }
  } catch (e) {
    return {
      success: false,
      error: 'shopItems 集合未创建或查询失败，请先在云控制台创建该集合',
      detail: e.message || String(e),
    }
  }
}

// ==================== 新增 ====================
async function addItem(auth, data, targetClassId) {
  if (!canOperate(auth, null, targetClassId)) {
    return { success: false, error: '无权在该班级下创建商品' }
  }
  const err = validateItem(data)
  if (err) return { success: false, error: err }

  const payload = { ...buildItemData(data, targetClassId), createdAt: db.serverDate() }
  try {
    const res = await db.collection('shopItems').add({ data: payload })
    // 写后读回验证，不依赖 add 的返回结构
    const saved = await db.collection('shopItems').doc(res._id).get()
    if (!saved.data) return { success: false, error: '写入后读回失败' }
    return { success: true, message: '商品已创建', item: { ...saved.data, isGlobal: !targetClassId } }
  } catch (e) {
    return { success: false, error: '创建失败：' + (e.message || String(e)) }
  }
}

// ==================== 修改 ====================
async function updateItem(auth, itemId, data, targetClassId) {
  const oldRes = await db.collection('shopItems').doc(itemId).get()
  const old = oldRes.data
  if (!old) return { success: false, error: '商品不存在' }
  if (!canOperate(auth, old, old.classId)) {
    return { success: false, error: '无权修改该商品（全局模板只有 super 能改）' }
  }

  // 部分更新：只校验传进来的字段，用合并后的结果整体校验
  const merged = { ...old, ...data }
  const err = validateItem(merged)
  if (err) return { success: false, error: err }

  // classId 不允许通过 update 改变（防止教师把本班商品"升级"成全局模板）
  const payload = buildItemData(merged, old.classId)

  try {
    await db.collection('shopItems').doc(itemId).update({ data: payload })
    const saved = await db.collection('shopItems').doc(itemId).get()
    if (!saved.data) return { success: false, error: '写入后读回失败' }
    return { success: true, message: '商品已更新', item: { ...saved.data, isGlobal: !saved.data.classId } }
  } catch (e) {
    return { success: false, error: '更新失败：' + (e.message || String(e)) }
  }
}

// ==================== 删除（有订单则只下架）====================
async function removeItem(auth, itemId) {
  const oldRes = await db.collection('shopItems').doc(itemId).get()
  const old = oldRes.data
  if (!old) return { success: false, error: '商品不存在' }
  if (!canOperate(auth, old, old.classId)) {
    return { success: false, error: '无权删除该商品（全局模板只有 super 能删）' }
  }

  // 已产生订单的商品不能物理删除，否则历史订单对不上账
  try {
    const oRes = await db.collection('shopOrders').where({ itemId }).limit(1).get()
    if (oRes.data && oRes.data.length > 0) {
      await db.collection('shopItems').doc(itemId).update({
        data: { status: 'off', updatedAt: db.serverDate() },
      })
      const saved = await db.collection('shopItems').doc(itemId).get()
      if (!saved.data || saved.data.status !== 'off') {
        return { success: false, error: '下架失败（写后读回不一致）' }
      }
      return {
        success: true,
        message: '该商品已有购买记录，已改为下架（不删除，避免历史订单对不上账）',
        softDeleted: true,
      }
    }
  } catch (e) {
    // shopOrders 集合不存在时不阻断，按"无订单"处理
    console.warn('[manageShop] 查询订单失败，按无订单处理:', e.message)
  }

  try {
    await db.collection('shopItems').doc(itemId).remove()
    const check = await db.collection('shopItems').doc(itemId).get()
    if (check.data) return { success: false, error: '删除失败（记录仍存在）' }
    return { success: true, message: '商品已删除', softDeleted: false }
  } catch (e) {
    return { success: false, error: '删除失败：' + (e.message || String(e)) }
  }
}

exports.main = async (event, context) => {
  const { action, itemId, data, classId } = event

  if (!action) return { success: false, error: '缺少 action' }

  // 所有 action 第一行：服务端鉴权
  const auth = await authenticate(event)
  if (!auth.ok) return { success: false, error: auth.error }

  // 教师强制用自己的 classId（不信任前端传参）；super 可以指定任意班，'' 表示全局模板
  const targetClassId = auth.role === 'teacher'
    ? auth.classId
    : (classId === undefined ? '' : classId)

  try {
    if (action === 'list') return await listItems(auth, targetClassId)
    if (action === 'add') return await addItem(auth, data || {}, targetClassId)
    if (action === 'update') {
      if (!itemId) return { success: false, error: '缺少 itemId' }
      return await updateItem(auth, itemId, data || {}, targetClassId)
    }
    if (action === 'remove') {
      if (!itemId) return { success: false, error: '缺少 itemId' }
      return await removeItem(auth, itemId)
    }
    return { success: false, error: `未知操作: ${action}` }
  } catch (e) {
    console.error('manageShop error:', e)
    return { success: false, error: e.message || '操作失败' }
  }
}
