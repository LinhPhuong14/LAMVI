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
})

const toFaq = (r) => ({
  id: r.id,
  sortOrder: r.sort_order,
  isPublished: r.is_published,
  question: r.question,
  answer: r.answer,
})

const toBatch = (r) => ({
  id: r.id,
  code: r.code,
  status: r.status,
  videoUrl: r.video_url,
  producedOn: r.produced_on,
  title: r.title,
  story: r.story,
})

const toProfile = (r) => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  preferredLocale: r.preferred_locale,
  role: r.role,
  createdAt: r.created_at,
})

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

export function createSupabaseRepo(client) {
  return {
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
