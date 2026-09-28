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

  return {
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
