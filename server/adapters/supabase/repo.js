import { RepoError } from '../repoErrors.js'

// Adapter Supabase (T-03, T-04). Dùng service role key — chỉ chạy ở server.

const toProduct = (r) => ({
  id: r.id,
  slug: r.slug,
  kind: r.kind,
  status: r.status,
  priceExclVat: r.price_excl_vat,
  tone: r.tone,
  sortOrder: r.sort_order,
  name: r.name,
  description: r.description,
  badge: r.badge,
  updatedAt: r.updated_at,
})

const toFaq = (r) => ({
  id: r.id,
  sortOrder: r.sort_order,
  isPublished: r.is_published,
  question: r.question,
  answer: r.answer,
  updatedAt: r.updated_at,
})

const toBatch = (r) => ({
  id: r.id,
  code: r.code,
  status: r.status,
  videoUrl: r.video_url,
  producedOn: r.produced_on,
  title: r.title,
  story: r.story,
  videoPath: r.video_path,
  updatedAt: r.updated_at,
})

const toProfile = (r) => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  preferredLocale: r.preferred_locale,
  role: r.role,
  createdAt: r.created_at,
})

// camelCase → snake_case cho các trường được phép ghi
const PRODUCT_COLS = { slug: 'slug', kind: 'kind', status: 'status', priceExclVat: 'price_excl_vat', tone: 'tone', sortOrder: 'sort_order', name: 'name', description: 'description', badge: 'badge' }
const FAQ_COLS = { sortOrder: 'sort_order', isPublished: 'is_published', question: 'question', answer: 'answer' }
const BATCH_COLS = { code: 'code', status: 'status', videoUrl: 'video_url', videoPath: 'video_path', producedOn: 'produced_on', title: 'title', story: 'story' }

function toRow(obj, cols) {
  const row = {}
  for (const [k, col] of Object.entries(cols)) if (obj[k] !== undefined) row[col] = obj[k]
  return row
}

// 23505 = unique_violation của Postgres
const UNIQUE_FIELD = { products_slug_key: 'slug', batches_code_key: 'code' }

function unwrap({ data, error }) {
  if (error) {
    if (error.code === '23505') {
      const constraint = Object.keys(UNIQUE_FIELD).find((c) => error.message?.includes(c))
      throw new RepoError('CONFLICT', UNIQUE_FIELD[constraint])
    }
    throw error
  }
  return data
}

export function createSupabaseRepo(client) {
  const one = async (table, id, map) => {
    const row = unwrap(await client.from(table).select('*').eq('id', id).maybeSingle())
    return row ? map(row) : null
  }
  const insert = async (table, row, map) => map(unwrap(await client.from(table).insert(row).select('*').single()))
  const patch = async (table, id, row, map) => {
    const data = unwrap(await client.from(table).update(row).eq('id', id).select('*'))
    return data.length ? map(data[0]) : null
  }
  const del = async (table, id) => unwrap(await client.from(table).delete().eq('id', id).select('id')).length > 0

  return {
    getProductById: (id) => one('products', id, toProduct),
    createProduct: (p) => insert('products', toRow(p, PRODUCT_COLS), toProduct),
    updateProduct: (id, p) => patch('products', id, toRow(p, PRODUCT_COLS), toProduct),
    deleteProduct: (id) => del('products', id),

    getFaq: (id) => one('faq_entries', id, toFaq),
    createFaq: (f) => insert('faq_entries', toRow(f, FAQ_COLS), toFaq),
    updateFaq: (id, f) => patch('faq_entries', id, toRow(f, FAQ_COLS), toFaq),
    deleteFaq: (id) => del('faq_entries', id),

    async listBatches() {
      return unwrap(await client.from('batches').select('*').order('produced_on', { ascending: false, nullsFirst: false })).map(toBatch)
    },
    getBatchById: (id) => one('batches', id, toBatch),
    createBatch: (b) => insert('batches', toRow({ status: 'created', ...b }, BATCH_COLS), toBatch),
    updateBatch: (id, b) => patch('batches', id, toRow(b, BATCH_COLS), toBatch),
    deleteBatch: (id) => del('batches', id),

    async listProducts({ statuses } = {}) {
      let q = client.from('products').select('*').order('sort_order')
      if (statuses) q = q.in('status', statuses)
      return unwrap(await q).map(toProduct)
    },

    async getProductBySlug(slug) {
      const row = unwrap(await client.from('products').select('*').eq('slug', slug).maybeSingle())
      return row ? toProduct(row) : null
    },

    async listFaq({ publishedOnly = true } = {}) {
      let q = client.from('faq_entries').select('*').order('sort_order')
      if (publishedOnly) q = q.eq('is_published', true)
      return unwrap(await q).map(toFaq)
    },

    async getBatchByCode(code) {
      const row = unwrap(await client.from('batches').select('*').eq('code', code).maybeSingle())
      return row ? toBatch(row) : null
    },

    async getProfile(userId) {
      const row = unwrap(await client.from('profiles').select('*').eq('id', userId).maybeSingle())
      return row ? toProfile(row) : null
    },

    async upsertProfile(profile) {
      const row = { id: profile.id }
      if (profile.fullName !== undefined) row.full_name = profile.fullName
      if (profile.phone !== undefined) row.phone = profile.phone
      if (profile.preferredLocale !== undefined) row.preferred_locale = profile.preferredLocale
      // role không cho cập nhật qua upsert từ API khách
      const data = unwrap(await client.from('profiles').upsert(row).select('*').single())
      return toProfile(data)
    },
  }
}
