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

const COUPON_COLS = {
  code: 'code', status: 'status', type: 'type', value: 'value', maxDiscount: 'max_discount', minOrder: 'min_order',
  startsAt: 'starts_at', endsAt: 'ends_at', usageLimit: 'usage_limit', perUserLimit: 'per_user_limit', productIds: 'product_ids', note: 'note',
}
const ORDER_COLS = {
  userId: 'user_id', clientKey: 'client_key', status: 'status', productionStage: 'production_stage', orderType: 'order_type',
  hasMessage: 'has_message', qrLang: 'qr_lang', recipientType: 'recipient_type', recipient: 'recipient', paymentMethod: 'payment_method',
  paymentStatus: 'payment_status', couponId: 'coupon_id', couponCode: 'coupon_code', subtotal: 'subtotal', discount: 'discount',
  shippingFee: 'shipping_fee', vat: 'vat', total: 'total', paymentExpiresAt: 'payment_expires_at', paymentLinkId: 'payment_link_id',
  checkoutUrl: 'checkout_url', paidAt: 'paid_at', paidAmount: 'paid_amount', paymentRef: 'payment_ref', flags: 'flags',
  trackingCode: 'tracking_code', cancelledAt: 'cancelled_at', cancelReason: 'cancel_reason', codCollectedAt: 'cod_collected_at',
  refundedAt: 'refunded_at', refundedAmount: 'refunded_amount', refundNote: 'refund_note',
}
const ITEM_COLS = { productId: 'product_id', productSlug: 'product_slug', productName: 'product_name', unitPrice: 'unit_price', quantity: 'quantity', lineTotal: 'line_total', batchId: 'batch_id' }

// timestamptz của Postgres → ISO (so sánh chuỗi với thời điểm của server)
const isoOrNull = (v) => (v ? new Date(v).toISOString() : null)
const fromRow = (r, cols) => {
  const o = {}
  for (const [k, col] of Object.entries(cols)) o[k] = r[col] ?? null
  return o
}
const toCoupon = (r) => {
  const c = { id: r.id, ...fromRow(r, COUPON_COLS), createdAt: r.created_at, updatedAt: r.updated_at }
  c.startsAt = isoOrNull(c.startsAt)
  c.endsAt = isoOrNull(c.endsAt)
  return c
}
const toItem = (r) => ({ id: r.id, orderId: r.order_id, ...fromRow(r, ITEM_COLS) })
const toOrder = (r) => {
  const o = { id: r.id, code: Number(r.code), ...fromRow(r, ORDER_COLS), createdAt: isoOrNull(r.created_at), updatedAt: isoOrNull(r.updated_at) }
  for (const k of ['paymentExpiresAt', 'paidAt', 'cancelledAt', 'codCollectedAt', 'refundedAt']) o[k] = isoOrNull(o[k])
  o.flags = o.flags ?? []
  o.hasMessage = Boolean(o.hasMessage)
  o.items = (r.order_items ?? []).map(toItem)
  return o
}
const ORDER_SELECT = '*, order_items(*)'
// Lỗi nghiệp vụ do create_order() raise
const ORDER_RPC_ERRORS = ['COUPON_INVALID', 'COUPON_USED_UP', 'COUPON_USER_LIMIT']

const toUsage = (r) => ({
  month: r.month,
  requests: r.requests,
  promptTokens: Number(r.prompt_tokens),
  completionTokens: Number(r.completion_tokens),
  costUsd: Number(r.cost_usd),
})

function toRow(obj, cols) {
  const row = {}
  for (const [k, col] of Object.entries(cols)) if (obj[k] !== undefined) row[col] = obj[k]
  return row
}

// 23505 = unique_violation của Postgres
const UNIQUE_FIELD = { products_slug_key: 'slug', batches_code_key: 'code', coupons_code_key: 'code', orders_user_id_client_key_key: 'clientKey' }

function unwrap({ data, error }) {
  if (error) {
    const rpc = ORDER_RPC_ERRORS.find((c) => error.message === c)
    if (rpc) throw new RepoError(rpc)
    // 23503 = foreign_key_violation (vd xoá coupon đã có đơn)
    if (error.code === '23503') throw new RepoError('IN_USE')
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
    // --- Giám sát (D-52, D-53)
    async ping() {
      unwrap(await client.from('products').select('id').limit(1))
      return true
    },
    async recordApiMetrics(rows) {
      // Cộng dồn nguyên tử trong DB (nhiều server cùng ghi một phút)
      unwrap(await client.rpc('record_api_metrics', { rows }))
    },
    async listApiMetrics({ since }) {
      return unwrap(await client.from('api_metrics').select('*').gte('bucket', since)).map((r) => ({
        ...r,
        bucket: new Date(r.bucket).toISOString(),
      }))
    },
    async deleteApiMetricsBefore(before) {
      unwrap(await client.from('api_metrics').delete().lt('bucket', before))
      unwrap(await client.from('api_errors').delete().lt('at', before))
    },
    async recordApiErrors(rows) {
      if (rows.length) unwrap(await client.from('api_errors').insert(rows))
    },
    async listApiErrors({ since, limit = 50 }) {
      return unwrap(
        await client.from('api_errors').select('*').gte('at', since).order('at', { ascending: false }).limit(limit),
      ).map((r) => ({ ...r, at: new Date(r.at).toISOString() }))
    },
    async getSetting(key) {
      const r = unwrap(await client.from('app_settings').select('*').eq('key', key).maybeSingle())
      return r ? { key: r.key, value: r.value, updatedBy: r.updated_by, updatedAt: r.updated_at } : null
    },
    async setSetting(key, value, userId) {
      const r = unwrap(
        await client
          .from('app_settings')
          .upsert({ key, value, updated_by: userId ?? null, updated_at: new Date().toISOString() })
          .select('*')
          .single(),
      )
      return { key: r.key, value: r.value, updatedBy: r.updated_by, updatedAt: r.updated_at }
    },

    // --- Giỏ hàng (FR-CART-001)
    async getCart(userId) {
      const rows = unwrap(await client.from('cart_items').select('*').eq('user_id', userId).order('added_at'))
      return rows.map((r) => ({ productId: r.product_id, quantity: r.quantity, addedAt: r.added_at }))
    },
    async setCartItem(userId, productId, quantity) {
      unwrap(
        await client
          .from('cart_items')
          .upsert({ user_id: userId, product_id: productId, quantity }, { onConflict: 'user_id,product_id' }),
      )
    },
    async removeCartItem(userId, productId) {
      unwrap(await client.from('cart_items').delete().eq('user_id', userId).eq('product_id', productId))
    },

    // --- Nhật ký (NFR-AUD-001)
    async appendAudit(r) {
      unwrap(
        await client.from('audit_log').insert({
          at: r.at, actor_id: r.actorId, actor_role: r.actorRole, entity: r.entity, entity_id: r.entityId, action: r.action, old_value: r.oldValue, new_value: r.newValue,
        }),
      )
    },
    async listAudit({ entity, entityId, limit = 200 }) {
      const rows = unwrap(
        await client.from('audit_log').select('*').eq('entity', entity).eq('entity_id', entityId).order('at', { ascending: false }).order('id', { ascending: false }).limit(limit),
      )
      return rows.map((r) => ({
        id: r.id, at: new Date(r.at).toISOString(), actorId: r.actor_id, actorRole: r.actor_role, entity: r.entity, entityId: r.entity_id, action: r.action, oldValue: r.old_value, newValue: r.new_value,
      }))
    },

    // --- Coupon (§14)
    async listCoupons() {
      return unwrap(await client.from('coupons').select('*').order('created_at', { ascending: false })).map(toCoupon)
    },
    getCouponById: (id) => one('coupons', id, toCoupon),
    async getCouponByCode(code) {
      const row = unwrap(await client.from('coupons').select('*').eq('code', code).maybeSingle())
      return row ? toCoupon(row) : null
    },
    createCoupon: (c) => insert('coupons', toRow(c, COUPON_COLS), toCoupon),
    updateCoupon: (id, c) => patch('coupons', id, toRow(c, COUPON_COLS), toCoupon),
    deleteCoupon: (id) => del('coupons', id),
    // D-68: lượt đã dùng = đơn chưa huỷ có coupon
    async countCouponUses(couponId, userId) {
      const base = () => client.from('orders').select('id', { count: 'exact', head: true }).eq('coupon_id', couponId).neq('status', 'CANCELLED')
      const total = (await base()).count
      const byUser = userId ? (await base().eq('user_id', userId)).count : 0
      for (const r of [total, byUser]) if (r === null || r === undefined) throw new Error('countCouponUses failed')
      return { total, byUser }
    },

    // --- Đơn hàng (§16)
    async createOrder(order, items) {
      const id = unwrap(
        await client.rpc('create_order', {
          p_order: toRow(order, ORDER_COLS),
          p_items: items.map((i) => toRow(i, ITEM_COLS)),
        }),
      )
      return toOrder(unwrap(await client.from('orders').select(ORDER_SELECT).eq('id', id).single()))
    },
    async getOrderById(id) {
      const r = unwrap(await client.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle())
      return r ? toOrder(r) : null
    },
    async getOrderByCode(code) {
      const r = unwrap(await client.from('orders').select(ORDER_SELECT).eq('code', code).maybeSingle())
      return r ? toOrder(r) : null
    },
    async getOrderByClientKey(userId, clientKey) {
      const r = unwrap(await client.from('orders').select(ORDER_SELECT).eq('user_id', userId).eq('client_key', clientKey).maybeSingle())
      return r ? toOrder(r) : null
    },
    async listOrdersByUser(userId) {
      return unwrap(
        await client.from('orders').select(ORDER_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).order('code', { ascending: false }),
      ).map(toOrder)
    },
    async listOrders({ status, limit = 200 } = {}) {
      let q = client.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).order('code', { ascending: false }).limit(limit)
      if (status) q = q.eq('status', status)
      return unwrap(await q).map(toOrder)
    },
    async listExpiredPendingOrders(before) {
      return unwrap(
        await client.from('orders').select(ORDER_SELECT).eq('status', 'PENDING_PAYMENT').lte('payment_expires_at', before).limit(100),
      ).map(toOrder)
    },
    // Cập nhật có điều kiện theo trạng thái hiện tại (compare-and-set)
    async updateOrder(id, values, fromStatuses) {
      let q = client.from('orders').update(toRow(values, ORDER_COLS)).eq('id', id)
      if (fromStatuses) q = q.in('status', fromStatuses)
      const rows = unwrap(await q.select('id'))
      if (!rows.length) return null
      return toOrder(unwrap(await client.from('orders').select(ORDER_SELECT).eq('id', id).single()))
    },
    async updateOrderItem(orderId, itemId, values) {
      const rows = unwrap(await client.from('order_items').update(toRow(values, ITEM_COLS)).eq('id', itemId).eq('order_id', orderId).select('*'))
      return rows.length ? toItem(rows[0]) : null
    },
    async recordPaymentEvent({ provider, reference, orderCode, payload }) {
      const { error } = await client.from('payment_events').insert({ provider, reference, order_code: orderCode ?? null, payload })
      if (error?.code === '23505') return false
      if (error) throw error
      return true
    },
    async deletePaymentEvent(provider, reference) {
      unwrap(await client.from('payment_events').delete().eq('provider', provider).eq('reference', reference))
    },

    // --- Mây (FR-AI-*)
    async incrementMayCounter(key, ttlSeconds) {
      return unwrap(await client.rpc('may_increment', { p_key: key, p_ttl_seconds: ttlSeconds }))
    },
    async addMayUsage(month, { promptTokens, completionTokens, costUsd }) {
      const r = unwrap(
        await client.rpc('may_add_usage', { p_month: month, p_prompt: promptTokens, p_completion: completionTokens, p_cost: costUsd }),
      )
      return toUsage(Array.isArray(r) ? r[0] : r)
    },
    async getMayUsage(month) {
      const r = unwrap(await client.from('may_usage').select('*').eq('month', month).maybeSingle())
      return r ? toUsage(r) : { month, requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 }
    },
    async appendChatMessages(rows) {
      if (!rows.length) return
      unwrap(
        await client.from('chat_messages').insert(
          rows.map((m) => ({ user_id: m.userId, session_id: m.sessionId, role: m.role, kind: m.kind, content: m.content, lang: m.lang })),
        ),
      )
    },
    async listChatMessages(userId, { limit = 100 } = {}) {
      const rows = unwrap(
        await client.from('chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
      )
      return rows.reverse().map((r) => ({
        id: r.id,
        userId: r.user_id,
        sessionId: r.session_id,
        role: r.role,
        kind: r.kind,
        content: r.content,
        lang: r.lang,
        createdAt: r.created_at,
      }))
    },

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
