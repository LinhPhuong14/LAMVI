import { randomUUID } from 'node:crypto'
import { collections, products, faqEntries, demoBatches } from '../../data/seed.js'
import { RepoError } from '../repoErrors.js'
import { mediaExpired } from '../../domain/message.js'
import { couponRejectReason } from '../../domain/coupon.js'

const clone = (v) => structuredClone(v)

// Adapter bộ nhớ (T-04) — cùng interface với adapters/supabase/repo.js
export function createMemoryRepo(data = {}) {
  const state = {
    // G-44: sản phẩm mặc định không theo dõi tồn kho (stock null), như cột `stock` NULL ở Supabase
    products: clone(data.products ?? products).map((p) => ({ stock: null, ...p })),
    collections: clone(data.collections ?? collections),
    faqEntries: clone(data.faqEntries ?? faqEntries),
    batches: clone(data.batches ?? demoBatches),
    profiles: new Map(),
    apiMetrics: new Map(), // `${bucket}|${method}|${route}|${status}` → row
    apiErrors: [],
    apiMetricBatches: new Set(),
    settings: new Map(),
    chatMessages: [],
    carts: new Map(), // userId → Map(productId → { quantity, addedAt })
    mayCounters: new Map(), // key → { count, expiresAt }
    mayUsage: new Map(), // month → usage
    coupons: clone(data.coupons ?? []),
    orders: clone(data.orders ?? []), // mỗi đơn kèm items
    couponRedemptions: [],
    auditLog: [],
    giftMessages: [], // lời chúc, mỗi đơn tối đa một dòng (FR-MSG-001)
  }

  const now = () => new Date().toISOString()
  const byId = (list, id) => list.find((x) => x.id === id)
  const assertUnique = (list, field, value, exceptId) => {
    if (list.some((x) => x[field] === value && x.id !== exceptId)) throw new RepoError('CONFLICT', field)
  }
  const update = (list, id, patch, uniqueField) => {
    const row = byId(list, id)
    if (!row) return null
    if (uniqueField && patch[uniqueField] !== undefined) assertUnique(list, uniqueField, patch[uniqueField], id)
    Object.assign(row, patch, { updatedAt: now() })
    return clone(row)
  }
  const remove = (list, id) => {
    const i = list.findIndex((x) => x.id === id)
    if (i < 0) return false
    list.splice(i, 1)
    return true
  }
  const create = (list, row, uniqueField) => {
    if (uniqueField) assertUnique(list, uniqueField, row[uniqueField])
    const full = { id: randomUUID(), createdAt: now(), updatedAt: now(), ...row }
    list.push(full)
    return clone(full)
  }

  const HIST = ['le_50', 'le_100', 'le_250', 'le_500', 'le_1000', 'le_2500', 'gt_2500']

  const updateOrder = (id, values) => {
    const o = byId(state.orders, id)
    if (!o) return null
    if (values.status === 'cancelled' && o.status !== 'cancelled') {
      for (const i of o.items ?? []) {
        const p = byId(state.products, i.productId)
        if (p?.stock != null && i.stockReserved > 0) p.stock += i.stockReserved
      }
      const redemption = state.couponRedemptions.find((r) => r.orderId === id)
      if (redemption) {
        const c = byId(state.coupons, redemption.couponId)
        if (c) c.usedCount = Math.max(0, c.usedCount - 1)
        state.couponRedemptions = state.couponRedemptions.filter((r) => r.orderId !== id)
      }
    }
    return update(state.orders, id, values)
  }

  return {
    // --- Giám sát (D-52, D-53)
    async ping() {
      return true
    },
    async recordApiMetricBatch(batchId, rows, errors) {
      if (state.apiMetricBatches.has(batchId)) return
      await this.recordApiMetrics(rows)
      await this.recordApiErrors(errors)
      state.apiMetricBatches.add(batchId)
    },
    async recordApiMetrics(rows) {
      for (const r of rows) {
        const k = `${r.bucket}|${r.method}|${r.route}|${r.status}`
        const cur = state.apiMetrics.get(k)
        if (!cur) {
          state.apiMetrics.set(k, { ...r })
          continue
        }
        cur.count += r.count
        cur.total_ms += r.total_ms
        cur.max_ms = Math.max(cur.max_ms, r.max_ms)
        for (const h of HIST) cur[h] += r[h]
      }
    },
    async listApiMetrics({ since }) {
      return clone([...state.apiMetrics.values()].filter((r) => r.bucket >= since))
    },
    async deleteApiMetricsBefore(before) {
      for (const [k, r] of state.apiMetrics) if (r.bucket < before) state.apiMetrics.delete(k)
      state.apiErrors = state.apiErrors.filter((e) => e.at >= before)
    },
    async recordApiErrors(rows) {
      state.apiErrors.push(...clone(rows))
    },
    async listApiErrors({ since, limit = 50 }) {
      return clone(
        state.apiErrors
          .filter((e) => e.at >= since)
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, limit),
      )
    },
    async getSetting(key) {
      const s = state.settings.get(key)
      return s ? clone(s) : null
    },
    async setSetting(key, value, userId) {
      const s = { key, value, updatedBy: userId ?? null, updatedAt: now() }
      state.settings.set(key, s)
      return clone(s)
    },

    // --- Giỏ hàng (FR-CART-001)
    async getCart(userId) {
      const c = state.carts.get(userId)
      if (!c) return []
      return [...c.entries()]
        .map(([productId, v]) => ({ productId, quantity: v.quantity, addedAt: v.addedAt }))
        .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    },
    async mutateCart(userId, mode, lines) {
      // No awaits in this method: validation and the entire mutation are one commit.
      if (!['set', 'remove', 'merge'].includes(mode) || !Array.isArray(lines) || lines.length > 100 || (mode !== 'merge' && lines.length !== 1)) throw new RepoError('INVALID_CART_MUTATION')
      const original = state.carts.get(userId) ?? new Map()
      const cart = new Map([...original].map(([id, value]) => [id, { ...value }]))
      for (const line of lines) {
        const product = state.products.find((row) => row.slug === line.slug)
        const current = product ? cart.get(product.id) : null
        if (mode === 'remove') { if (product) cart.delete(product.id); continue }
        if (product && mode !== 'remove' && (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10)) throw new RepoError('INVALID_CART_MUTATION')
        if (mode === 'set') {
          if (!product || (product.status !== 'published' && !current)) throw new RepoError('PRODUCT_UNAVAILABLE')
          if (product.status !== 'published' && line.quantity > current.quantity) throw new RepoError('PRODUCT_UNAVAILABLE_INCREASE')
          if (product.stock != null && line.quantity > (current?.quantity ?? 0) && product.stock < line.quantity) throw new RepoError('OUT_OF_STOCK', String(Math.max(0, product.stock)))
          if (!current && cart.size >= 50) throw new RepoError('CART_FULL')
          cart.set(product.id, { quantity: line.quantity, addedAt: current?.addedAt ?? now() })
        } else if (mode === 'merge') {
          if (!product || product.status !== 'published' || (!current && cart.size >= 50)) continue
          const quantity = Math.min(10, (current?.quantity ?? 0) + line.quantity, product.stock ?? Infinity)
          if (quantity < 1) continue
          cart.set(product.id, { quantity, addedAt: current?.addedAt ?? now() })
        } else throw new RepoError('INVALID_CART_MUTATION')
      }
      state.carts.set(userId, cart)
      return [...cart].map(([productId, value]) => ({ productId, ...value })).sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    },
    async setCartItem(userId, productId, quantity) {
      if (!state.carts.has(userId)) state.carts.set(userId, new Map())
      const c = state.carts.get(userId)
      c.set(productId, { quantity, addedAt: c.get(productId)?.addedAt ?? now() })
    },
    async removeCartItem(userId, productId) {
      state.carts.get(userId)?.delete(productId)
    },

    // --- Mây (FR-AI-*)
    async incrementMayCounter(key, ttlSeconds, at = Date.now()) {
      const c = state.mayCounters.get(key)
      if (!c || c.expiresAt <= at) {
        state.mayCounters.set(key, { count: 1, expiresAt: at + ttlSeconds * 1000 })
        return 1
      }
      c.count += 1
      return c.count
    },
    async addMayUsage(month, { promptTokens, completionTokens, costUsd }) {
      const u = state.mayUsage.get(month) ?? { month, requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 }
      u.requests += 1
      u.promptTokens += promptTokens
      u.completionTokens += completionTokens
      u.costUsd += costUsd
      state.mayUsage.set(month, u)
      return clone(u)
    },
    async getMayUsage(month) {
      return clone(state.mayUsage.get(month) ?? { month, requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 })
    },
    async appendChatMessages(rows) {
      for (const r of rows) state.chatMessages.push({ id: state.chatMessages.length + 1, createdAt: now(), ...clone(r) })
    },
    async listChatMessages(userId, { limit = 100 } = {}) {
      return clone(state.chatMessages.filter((m) => m.userId === userId).slice(-limit))
    },

    // --- Sản phẩm (FR-CAT-004)
    async getProductsByIds(ids) {
      const selected = new Set(ids)
      return clone(state.products.filter((product) => selected.has(product.id)))
    },
    async getProductById(id) {
      const p = byId(state.products, id)
      return p ? clone(p) : null
    },
    async createProduct(row) {
      return create(state.products, row, 'slug')
    },
    async updateProduct(id, patch) {
      return update(state.products, id, patch, 'slug')
    },
    async deleteProduct(id) {
      return remove(state.products, id)
    },

    // --- FAQ
    async getFaq(id) {
      const f = byId(state.faqEntries, id)
      return f ? clone(f) : null
    },
    async createFaq(row) {
      return create(state.faqEntries, row)
    },
    async updateFaq(id, patch) {
      return update(state.faqEntries, id, patch)
    },
    async deleteFaq(id) {
      return remove(state.faqEntries, id)
    },

    // --- Lô (FR-QR-007)
    async listBatches() {
      return clone([...state.batches].sort((a, b) => (b.producedOn ?? '').localeCompare(a.producedOn ?? '')))
    },
    async getBatchById(id) {
      const b = byId(state.batches, id)
      return b ? clone(b) : null
    },
    async createBatch(row) {
      return create(state.batches, { status: 'created', videoUrl: null, videoPath: null, ...row }, 'code')
    },
    async updateBatch(id, patch) {
      return update(state.batches, id, patch, 'code')
    },
    async deleteBatch(id) {
      return remove(state.batches, id)
    },

    async listProducts({ statuses } = {}) {
      return clone(
        state.products
          .filter((p) => !statuses || statuses.includes(p.status))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      )
    },

    async getCollectionById(id) { return clone(byId(state.collections, id) ?? null) },
    async createCollection(row) { return create(state.collections, row, 'slug') },
    async updateCollection(id, row) { return update(state.collections, id, row, 'slug') },
    async deleteCollection(id) {
      const c = byId(state.collections, id)
      if (c && state.products.some((p) => p.collectionSlug === c.slug)) throw new RepoError('COLLECTION_IN_USE')
      return remove(state.collections, id)
    },

    async listCollections({ statuses } = {}) {
      return clone(
        state.collections
          .filter((c) => !statuses || statuses.includes(c.status))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      )
    },

    async getProductBySlug(slug) {
      const p = state.products.find((x) => x.slug === slug)
      return p ? clone(p) : null
    },

    async listFaq({ publishedOnly = true } = {}) {
      return clone(
        state.faqEntries
          .filter((f) => !publishedOnly || f.isPublished)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      )
    },

    async getBatchByCode(code) {
      const b = state.batches.find((x) => x.code === code)
      return b ? clone(b) : null
    },

    // --- Coupon (FR-CPN-001/002)
    async listCoupons() {
      return clone([...state.coupons].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
    },
    async getCouponById(id) {
      const c = byId(state.coupons, id)
      return c ? clone(c) : null
    },
    async getCouponByCode(code) {
      const c = state.coupons.find((x) => x.code === code)
      return c ? clone(c) : null
    },
    async createCoupon(row) {
      return create(state.coupons, { usedCount: 0, status: 'active', value: 0, ...row }, 'code')
    },
    async updateCoupon(id, patch) {
      return update(state.coupons, id, patch, 'code')
    },
    async deleteCoupon(id) {
      return remove(state.coupons, id)
    },
    async countCouponUsesByUser(couponId, userId) {
      return state.couponRedemptions.filter((r) => r.couponId === couponId && r.userId === userId).length
    },
    async claimCoupon(couponId) {
      const c = byId(state.coupons, couponId)
      if (!c || c.status !== 'active') return null
      if (c.usageLimit != null && c.usedCount >= c.usageLimit) return null
      c.usedCount += 1
      return c.usedCount
    },
    // C-8: trả cả lượt tổng và lượt theo khách (xoá bản ghi lượt dùng của đơn)
    // G-44, D-100: giữ chỗ tồn kho cho cả đơn (null = giữ được; ngược lại id sản phẩm thiếu hàng)
    async reserveStock(items) {
      const need = new Map()
      for (const i of items) need.set(i.productId, (need.get(i.productId) ?? 0) + i.quantity)
      for (const [id, qty] of need) {
        const p = byId(state.products, id)
        if (p && p.stock !== null && p.stock !== undefined && p.stock < qty) return id
      }
      for (const [id, qty] of need) {
        const p = byId(state.products, id)
        if (p && p.stock !== null && p.stock !== undefined) p.stock -= qty
      }
      return null
    },
    async releaseStock(items) {
      for (const i of items) {
        const p = byId(state.products, i.productId)
        if (p && p.stock !== null && p.stock !== undefined) p.stock += i.quantity
      }
    },
    async releaseCoupon(couponId, orderId) {
      const c = byId(state.coupons, couponId)
      if (c) c.usedCount = Math.max(0, c.usedCount - 1)
      if (orderId) state.couponRedemptions = state.couponRedemptions.filter((r) => r.orderId !== orderId)
    },

    // --- Đơn hàng (FR-CHK-*, FR-ORD-*)
    async createOrder(order, items, redemption, { now: checkoutNow = new Date(), fromCart = false } = {}) {
      // No await between validation and commit: mirrors the Postgres transaction.
      if (order.checkoutIdempotencyKey) {
        const existing = state.orders.find((row) => row.userId === order.userId && row.checkoutIdempotencyKey === order.checkoutIdempotencyKey)
        if (existing) {
          if (existing.checkoutFingerprint !== order.checkoutFingerprint) throw new RepoError('CHECKOUT_KEY_CONFLICT')
          return { ...clone(existing), checkoutReplayed: true }
        }
      }
      const cart = state.carts.get(order.userId)
      if (fromCart) {
        if (!cart?.size) throw new RepoError('CART_EMPTY')
        if (cart.size !== items.length || items.some((i) => cart.get(i.productId)?.quantity !== i.quantity)) {
          throw new RepoError('CART_HAS_UNAVAILABLE')
        }
      }
      const need = new Map()
      if (fromCart) for (const i of items) need.set(i.productId, (need.get(i.productId) ?? 0) + i.quantity)
      for (const [id, qty] of need) {
        const p = byId(state.products, id)
        if (!p || p.status !== 'published') throw new RepoError('CART_HAS_UNAVAILABLE')
        if (items.some((i) => i.productId === id && i.unitPrice !== p.price)) throw new RepoError('PRICE_CHANGED')
        if (p.stock != null && p.stock < qty) throw new RepoError('OUT_OF_STOCK', p.slug)
      }
      const c = redemption ? byId(state.coupons, redemption.couponId) : null
      if (redemption) {
        const reason = couponRejectReason(c, {
          subtotal: order.subtotal, now: checkoutNow, productIds: [...need.keys()],
          userUses: state.couponRedemptions.filter((r) => r.couponId === c?.id && r.userId === order.userId).length,
        })
        if (reason) throw new RepoError(reason)
        const keys = ['type', 'value', 'maxDiscount', 'minOrder', 'productIds', 'usageLimit', 'perUserLimit', 'startsAt', 'endsAt']
        if (redemption.coupon && keys.some((k) => JSON.stringify(c[k] ?? null) !== JSON.stringify(redemption.coupon[k] ?? null))) {
          throw new RepoError('PRICE_CHANGED')
        }
      }
      if (state.orders.some((o) => o.code === order.code)) throw new RepoError('CONFLICT', 'code')
      const row = {
        id: randomUUID(),
        createdAt: now(),
        updatedAt: now(),
        paymentFlag: null,
        trackingCode: null,
        cancelledAt: null,
        cancelReason: null,
        ...order,
        items: items.map((i) => ({ id: randomUUID(), ...i, stockReserved: fromCart && byId(state.products, i.productId)?.stock != null ? i.quantity : 0 })),
      }
      for (const [id, qty] of need) {
        const p = byId(state.products, id)
        if (p.stock != null) p.stock -= qty
      }
      if (c) c.usedCount += 1
      state.orders.push(row)
      if (fromCart) state.carts.delete(order.userId)
      if (redemption) {
        state.couponRedemptions.push({ ...redemption, orderId: row.id, createdAt: now() })
      }
      return clone(row)
    },
    async getOrderByCheckoutKey(userId, key) {
      const order = state.orders.find((row) => row.userId === userId && row.checkoutIdempotencyKey === key)
      return order ? clone(order) : null
    },
    async getOrderById(id) {
      const o = byId(state.orders, id)
      return o ? clone(o) : null
    },
    async getOrderByCode(code) {
      const o = state.orders.find((x) => x.code === code)
      return o ? clone(o) : null
    },
    async getOrderByPayosCode(payosOrderCode) {
      const o = state.orders.find((x) => x.payosOrderCode === payosOrderCode)
      return o ? clone(o) : null
    },
    async listOrdersByUser(userId, { limit = 50 } = {}) {
      return clone(
        state.orders
          .filter((o) => o.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit),
      )
    },
    async listOrders({ status, limit = 100 } = {}) {
      return clone(
        state.orders
          .filter((o) => !status || o.status === status)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit),
      )
    },
    async listExpiredPendingOrders(nowIso) {
      return clone(
        state.orders.filter((o) => o.status === 'pending_payment' && o.paymentExpiresAt && o.paymentExpiresAt < nowIso),
      )
    },
    async updateOrder(id, values) {
      return updateOrder(id, values)
    },
    async updateOrderIfStatus(id, expectedStatus, values, expectedPaymentStatus, expectedPaymentFlag) {
      const o = byId(state.orders, id)
      if (!o || o.status !== expectedStatus || (expectedPaymentStatus !== undefined && o.paymentStatus !== expectedPaymentStatus) || (expectedPaymentFlag !== undefined && o.paymentFlag !== expectedPaymentFlag)) return null
      return updateOrder(id, values)
    },

    // --- NFR-AUD-001
    async appendAuditLog(entries) {
      for (const e of entries) {
        state.auditLog.push({ id: state.auditLog.length + 1, at: now(), ...clone(e) })
      }
    },
    async listAuditLog({ entity, entityId, limit = 100 } = {}) {
      return clone(
        state.auditLog
          .filter((e) => (!entity || e.entity === entity) && (!entityId || e.entityId === entityId))
          .sort((a, b) => b.id - a.id)
          .slice(0, limit),
      )
    },

    async getProfile(userId) {
      const p = state.profiles.get(userId)
      return p ? clone(p) : null
    },

    async upsertProfile(profile) {
      const existing = state.profiles.get(profile.id)
      const next = {
        role: 'customer',
        fullName: null,
        phone: null,
        preferredLocale: 'vi',
        email: null,
        lockedAt: null,
        lockedReason: null,
        createdAt: new Date().toISOString(),
        ...existing,
        ...profile,
      }
      // Khoá chỉ đổi qua updateProfileAdmin, không qua upsert từ API khách (role giữ như cũ: test dùng upsert để cấp quyền)
      if (existing) {
        next.lockedAt = existing.lockedAt
        next.lockedReason = existing.lockedReason
      }
      state.profiles.set(profile.id, next)
      return clone(next)
    },

    // --- Quản lý người dùng (G-19)
    async listProfiles({ q, role, locked, limit = 20, offset = 0 } = {}) {
      const needle = typeof q === 'string' ? q.trim().toLowerCase() : ''
      const rows = [...state.profiles.values()]
        .filter((p) => !role || p.role === role)
        .filter((p) => locked === undefined || Boolean(p.lockedAt) === locked)
        .filter(
          (p) =>
            !needle ||
            [p.email, p.fullName, p.phone].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return { items: clone(rows.slice(offset, offset + limit)), total: rows.length }
    },
    async countOrdersByUsers(userIds) {
      const out = {}
      for (const id of userIds) out[id] = state.orders.filter((o) => o.userId === id).length
      return out
    },
    async updateProfileAdmin(id, patch) {
      const p = state.profiles.get(id)
      if (!p) return null
      for (const k of ['role', 'lockedAt', 'lockedReason']) if (patch[k] !== undefined) p[k] = patch[k]
      return clone(p)
    },

    // Khoá/mở khoá có điều kiện: hai admin cùng bấm thì chỉ một người thành công (trả null cho người sau)
    async lockProfile(id, { lockedAt, lockedReason }) {
      const p = state.profiles.get(id)
      if (!p || p.lockedAt) return null
      Object.assign(p, { lockedAt, lockedReason })
      return clone(p)
    },
    async unlockProfile(id) {
      const p = state.profiles.get(id)
      if (!p || !p.lockedAt) return null
      Object.assign(p, { lockedAt: null, lockedReason: null })
      return clone(p)
    },

    // --- Lời chúc (FR-MSG-001, FR-QR-002…005)
    async getOrderByQrToken(token) {
      const o = state.orders.find((x) => x.qrToken === token)
      return o ? clone(o) : null
    },
    async getGiftMessage(orderId) {
      const m = state.giftMessages.find((x) => x.orderId === orderId)
      return m ? clone(m) : null
    },
    async upsertGiftMessage(orderId, patch) {
      let m = state.giftMessages.find((x) => x.orderId === orderId)
      if (!m) {
        m = {
          id: randomUUID(),
          orderId,
          text: null,
          textLang: null,
          voicePath: null,
          voiceType: null,
          videoPath: null,
          videoType: null,
          confirmedAt: null,
          mediaDeletedAt: null,
          translations: {},
          createdAt: now(),
        }
        state.giftMessages.push(m)
      }
      Object.assign(m, patch, { updatedAt: now() })
      return clone(m)
    },
    // US-004 AC-002: confirmedAt chỉ ghi lần đầu, hai lần bấm đồng thời không ghi đè nhau
    async confirmGiftMessage(orderId, at) {
      const m = await this.upsertGiftMessage(orderId, {})
      const row = state.giftMessages.find((x) => x.id === m.id)
      if (!row.confirmedAt) row.confirmedAt = at
      return clone(row)
    },
    async listGiftMediaCandidates({ before = new Date().toISOString(), after = null, limit = 100 } = {}) {
      return state.giftMessages
        .filter((m) => (m.voicePath || m.videoPath) && !m.mediaDeletedAt && (!after || m.id > after))
        .map((m) => {
          const o = byId(state.orders, m.orderId)
          return o ? { message: clone(m), order: clone(o) } : null
        })
        .filter((r) => r && mediaExpired(r.order, r.message, new Date(before)))
        .sort((a, b) => a.message.id.localeCompare(b.message.id))
        .slice(0, Math.max(1, Math.min(limit, 100)))
    },
  }
}
