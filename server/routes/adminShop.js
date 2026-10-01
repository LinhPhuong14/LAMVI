import { Router } from 'express'
import { HttpError, notFound } from '../errors.js'
import { RepoError } from '../adapters/repoErrors.js'
import { requireAdmin } from '../middleware/auth.js'
import { SHOP_SETTING_KEY, loadShopConfig, validateShopConfig } from '../orders/pricing.js'
import { crossCheckCoupon, validateCoupon } from '../orders/coupons.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

function assertValid(errors) {
  if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
}

async function write(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof RepoError && err.code === 'CONFLICT') throw new HttpError(409, 'COUPON_CODE_TAKEN', 'Mã đã tồn tại', { code: 'COUPON_CODE_TAKEN' })
    if (err instanceof RepoError && err.code === 'IN_USE') throw new HttpError(409, 'COUPON_IN_USE', 'Coupon đã có đơn dùng — hãy tắt thay vì xoá')
    throw err
  }
}

// Admin: đơn hàng (FR-ORD-002), coupon (FR-CPN-*), cấu hình phí ship/COD (D-63, D-71)
export function adminShopRouter({ repo, auth, adminOrders, audit }) {
  const r = Router()
  r.use('/admin', requireAdmin(auth, repo))
  const actor = (req) => ({ id: req.user.id, role: req.role })

  // --- Cấu hình cửa hàng
  r.get('/admin/shop', async (req, res) => {
    res.json({ config: await loadShopConfig(repo) })
  })
  r.put('/admin/shop', async (req, res) => {
    const { errors, values } = validateShopConfig(body(req))
    assertValid(errors)
    const before = await loadShopConfig(repo)
    await repo.setSetting(SHOP_SETTING_KEY, values, req.user.id)
    const after = await loadShopConfig(repo)
    await audit.log({ actor: actor(req), entity: 'shop', entityId: SHOP_SETTING_KEY, action: 'update', oldValue: before, newValue: after })
    res.json({ config: after })
  })

  // --- Coupon
  const withUses = async (c) => ({ ...c, used: (await repo.countCouponUses(c.id, null)).total })
  r.get('/admin/coupons', async (req, res) => {
    const items = []
    for (const c of await repo.listCoupons()) items.push(await withUses(c))
    res.json({ items })
  })
  r.post('/admin/coupons', async (req, res) => {
    const { errors, values } = validateCoupon(body(req))
    assertValid({ ...errors, ...(Object.keys(errors).length ? {} : crossCheckCoupon(values)) })
    const item = await write(() => repo.createCoupon(values))
    await audit.log({ actor: actor(req), entity: 'coupon', entityId: item.id, action: 'create', newValue: item })
    res.status(201).json({ item: await withUses(item) })
  })
  r.patch('/admin/coupons/:id', async (req, res) => {
    const { errors, values } = validateCoupon(body(req), { partial: true })
    assertValid(errors)
    const cur = await repo.getCouponById(req.params.id)
    if (!cur) throw notFound()
    assertValid(crossCheckCoupon({ ...cur, ...values }))
    if (!Object.keys(values).length) return res.json({ item: await withUses(cur) })
    const item = await write(() => repo.updateCoupon(cur.id, values))
    const oldValue = {}
    const newValue = {}
    for (const k of Object.keys(values)) {
      if (JSON.stringify(cur[k] ?? null) === JSON.stringify(item[k] ?? null)) continue
      oldValue[k] = cur[k] ?? null
      newValue[k] = item[k] ?? null
    }
    if (Object.keys(newValue).length) await audit.log({ actor: actor(req), entity: 'coupon', entityId: cur.id, action: 'update', oldValue, newValue })
    res.json({ item: await withUses(item) })
  })
  r.delete('/admin/coupons/:id', async (req, res) => {
    const cur = await repo.getCouponById(req.params.id)
    if (!cur || !(await write(() => repo.deleteCoupon(cur.id)))) throw notFound()
    await audit.log({ actor: actor(req), entity: 'coupon', entityId: cur.id, action: 'delete', oldValue: cur })
    res.status(204).end()
  })
  r.get('/admin/coupons/:id/history', async (req, res) => {
    res.json({ items: await repo.listAudit({ entity: 'coupon', entityId: req.params.id }) })
  })

  // --- Đơn hàng
  r.get('/admin/orders', async (req, res) => {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined
    res.json(await adminOrders.list({ status, flagged: req.query.flagged === '1' }))
  })
  r.get('/admin/orders/:id', async (req, res) => {
    res.json(await adminOrders.get(req.params.id))
  })
  r.post('/admin/orders/:id/actions/:action', async (req, res) => {
    res.json(await adminOrders.act(req.params.id, req.params.action, body(req), actor(req)))
  })
  r.put('/admin/orders/:id/items/:itemId/batch', async (req, res) => {
    const { batchId } = body(req)
    if (batchId !== null && typeof batchId !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', 'Lô không hợp lệ', { batchId: 'INVALID' })
    res.json(await adminOrders.assignBatch(req.params.id, req.params.itemId, batchId, actor(req)))
  })

  return r
}
