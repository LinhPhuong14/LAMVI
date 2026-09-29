import { randomUUID } from 'node:crypto'
import { products, faqEntries, demoBatches } from '../../data/seed.js'
import { RepoError } from '../repoErrors.js'

const clone = (v) => structuredClone(v)

// Adapter bộ nhớ (T-04) — cùng interface với adapters/supabase/repo.js
export function createMemoryRepo(data = {}) {
  const state = {
    products: clone(data.products ?? products),
    faqEntries: clone(data.faqEntries ?? faqEntries),
    batches: clone(data.batches ?? demoBatches),
    profiles: new Map(),
    apiMetrics: new Map(), // `${bucket}|${method}|${route}|${status}` → row
    apiErrors: [],
    settings: new Map(),
    chatMessages: [],
    carts: new Map(), // userId → Map(productId → { quantity, addedAt })
    mayCounters: new Map(), // key → { count, expiresAt }
    mayUsage: new Map(), // month → usage
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

  return {
    // --- Giám sát (D-52, D-53)
    async ping() {
      return true
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
        createdAt: new Date().toISOString(),
        ...existing,
        ...profile,
      }
      state.profiles.set(profile.id, next)
      return clone(next)
    },
  }
}
