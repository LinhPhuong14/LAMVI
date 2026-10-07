import { RepoError } from '../repoErrors.js'

// Adapter Supabase (T-03, T-04). Dùng service role key — chỉ chạy ở server.

const toProduct = (r) => ({
  id: r.id,
  slug: r.slug,
  kind: r.kind,
  status: r.status,
  price: r.price,
  tone: r.tone,
  sortOrder: r.sort_order,
  name: r.name,
  description: r.description,
  badge: r.badge,
  imageUrl: r.image_url,
  imagePath: r.image_path,
  imageAlt: r.image_alt,
  stock: r.stock ?? null,
  collectionSlug: r.collection_slug ?? null,
  pieceOrder: r.piece_order ?? 0,
  updatedAt: r.updated_at,
})

const toCollection = (r) => ({
  id: r.id,
  slug: r.slug,
  status: r.status,
  tone: r.tone,
  sortOrder: r.sort_order,
  name: r.name,
  description: r.description,
  storyTitle: r.story_title,
  story: r.story,
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

const toCoupon = (r) => ({
  id: r.id,
  code: r.code,
  type: r.type,
  value: r.value,
  maxDiscount: r.max_discount,
  minOrder: r.min_order,
  productIds: r.product_ids,
  usageLimit: r.usage_limit,
  perUserLimit: r.per_user_limit,
  usedCount: r.used_count,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const toOrderItem = (r) => ({
  id: r.id,
  productId: r.product_id,
  slug: r.slug,
  name: r.name,
  unitPrice: r.unit_price,
  quantity: r.quantity,
  lineTotal: r.line_total,
  stockReserved: r.stock_reserved ?? null,
})

const toOrder = (r) => ({
  id: r.id,
  code: r.code,
  userId: r.user_id,
  status: r.status,
  orderKind: r.order_kind,
  hasMessage: r.has_message,
  qrLang: r.qr_lang,
  recipientIsSelf: r.recipient_is_self,
  recipientName: r.recipient_name,
  recipientPhone: r.recipient_phone,
  addressLine: r.address_line,
  ward: r.ward,
  district: r.district,
  province: r.province,
  provinceCode: r.province_code ?? null,
  wardCode: r.ward_code ?? null,
  note: r.note,
  checkoutIdempotencyKey: r.checkout_idempotency_key ?? null,
  checkoutFingerprint: r.checkout_fingerprint ?? null,
  checkoutReplayed: r.checkout_replayed === true,
  paymentMethod: r.payment_method,
  paymentStatus: r.payment_status,
  paymentExpiresAt: r.payment_expires_at,
  payosOrderCode: r.payos_order_code === null || r.payos_order_code === undefined ? null : Number(r.payos_order_code),
  paymentFlag: r.payment_flag,
  subtotal: r.subtotal,
  discount: r.discount,
  shippingFee: r.shipping_fee,
  total: r.total,
  vatAmount: r.vat_amount,
  vatRate: Number(r.vat_rate),
  couponId: r.coupon_id,
  couponCode: r.coupon_code,
  trackingCode: r.tracking_code,
  qrToken: r.qr_token,
  deliveredAt: r.delivered_at,
  cancelledAt: r.cancelled_at,
  cancelReason: r.cancel_reason,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  items: (r.order_items ?? []).map(toOrderItem),
})

const toProfile = (r) => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  preferredLocale: r.preferred_locale,
  role: r.role,
  email: r.email ?? null,
  lockedAt: r.locked_at ?? null,
  lockedReason: r.locked_reason ?? null,
  createdAt: r.created_at,
})

const toGiftMessage = (r) => ({
  id: r.id,
  orderId: r.order_id,
  text: r.text,
  textLang: r.text_lang,
  voicePath: r.voice_path,
  voiceType: r.voice_type,
  videoPath: r.video_path,
  videoType: r.video_type,
  confirmedAt: r.confirmed_at,
  mediaDeletedAt: r.media_deleted_at,
  translations: r.translations ?? {},
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
const GIFT_COLS = { text: 'text', textLang: 'text_lang', voicePath: 'voice_path', voiceType: 'voice_type', videoPath: 'video_path', videoType: 'video_type', confirmedAt: 'confirmed_at', mediaDeletedAt: 'media_deleted_at', translations: 'translations' }

// camelCase → snake_case cho các trường được phép ghi
const COLLECTION_COLS = { slug: 'slug', status: 'status', tone: 'tone', sortOrder: 'sort_order', name: 'name', description: 'description', storyTitle: 'story_title', story: 'story' }
const PRODUCT_COLS = { slug: 'slug', kind: 'kind', status: 'status', price: 'price', tone: 'tone', sortOrder: 'sort_order', name: 'name', description: 'description', badge: 'badge', imageUrl: 'image_url', imagePath: 'image_path', imageAlt: 'image_alt', stock: 'stock', collectionSlug: 'collection_slug', pieceOrder: 'piece_order' }
const FAQ_COLS = { sortOrder: 'sort_order', isPublished: 'is_published', question: 'question', answer: 'answer' }
const BATCH_COLS = { code: 'code', status: 'status', videoUrl: 'video_url', videoPath: 'video_path', producedOn: 'produced_on', title: 'title', story: 'story' }
const COUPON_COLS = { code: 'code', type: 'type', value: 'value', maxDiscount: 'max_discount', minOrder: 'min_order', productIds: 'product_ids', usageLimit: 'usage_limit', perUserLimit: 'per_user_limit', startsAt: 'starts_at', endsAt: 'ends_at', status: 'status' }
const ORDER_COLS = { status: 'status', paymentStatus: 'payment_status', paymentExpiresAt: 'payment_expires_at', payosOrderCode: 'payos_order_code', paymentFlag: 'payment_flag', trackingCode: 'tracking_code', deliveredAt: 'delivered_at', cancelledAt: 'cancelled_at', cancelReason: 'cancel_reason' }

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
const UNIQUE_FIELD = { collections_slug_key: 'slug', products_slug_key: 'slug', batches_code_key: 'code', coupons_code_key: 'code', orders_code_key: 'code' }

function unwrap({ data, error }) {
  if (error) {
    if (error.code === '23503' && error.message?.includes('products_collection_slug_fkey')) throw new RepoError('COLLECTION_IN_USE', 'collectionSlug')
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
    async recordApiMetricBatch(batchId, rows, errors) {
      unwrap(await client.rpc('record_api_metric_batch', { batch_id: batchId, rows, errors }))
    },
    async aggregateApiMetrics({ since }) {
      return unwrap(await client.rpc('aggregate_api_metrics', { since_at: since })) ?? []
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
      unwrap(await client.from('api_metric_batches').delete().lt('created_at', before))
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
    async mutateCart(userId, mode, lines) {
      const { data, error } = await client.rpc('mutate_cart', { p_user: userId, p_mode: mode, p_lines: lines })
      if (error) {
        const codes = ['PRODUCT_UNAVAILABLE', 'PRODUCT_UNAVAILABLE_INCREASE', 'OUT_OF_STOCK', 'CART_FULL', 'INVALID_CART_MUTATION']
        if (error.code === 'P0001' && codes.includes(error.message)) throw new RepoError(error.message, error.details)
        throw error
      }
      return data.map((row) => ({ productId: row.product_id, quantity: row.quantity, addedAt: row.added_at }))
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

    // --- Coupon (FR-CPN-001/002)
    async listCoupons() {
      return unwrap(await client.from('coupons').select('*').order('created_at', { ascending: false })).map(toCoupon)
    },
    getCouponById: (id) => one('coupons', id, toCoupon),
    async getCouponByCode(code) {
      const r = unwrap(await client.from('coupons').select('*').eq('code', code).maybeSingle())
      return r ? toCoupon(r) : null
    },
    createCoupon: (c) => insert('coupons', toRow(c, COUPON_COLS), toCoupon),
    updateCoupon: (id, c) => patch('coupons', id, toRow(c, COUPON_COLS), toCoupon),
    deleteCoupon: (id) => del('coupons', id),
    async countCouponUsesByUser(couponId, userId) {
      const { count, error } = await client
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .eq('user_id', userId)
      if (error) throw error
      return count ?? 0
    },
    // C-5: tăng lượt nguyên tử; hết lượt → null
    async claimCoupon(couponId) {
      const r = unwrap(await client.rpc('claim_coupon', { p_coupon_id: couponId }))
      return r ?? null
    },
    /**
     * C-8: trả lượt khi huỷ đơn. Phải trả cả lượt TỔNG và lượt THEO KHÁCH — xoá bản ghi
     * coupon_redemptions của đơn, nếu không per_user_limit bị tiêu vĩnh viễn dù đơn đã huỷ.
     */
    /**
     * G-44, D-100: giữ chỗ tồn kho nguyên tử cho cả đơn. Trả null nếu giữ được, hoặc id sản phẩm
     * đầu tiên không đủ hàng (khi đó không trừ gì).
     */
    async reserveStock(items) {
      const r = unwrap(await client.rpc('reserve_stock', { p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })) }))
      return r ?? null
    },
    async releaseStock(items) {
      unwrap(await client.rpc('release_stock', { p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })) }))
    },
    async releaseCoupon(couponId, orderId) {
      unwrap(await client.rpc('release_coupon', { p_coupon_id: couponId }))
      if (orderId) unwrap(await client.from('coupon_redemptions').delete().eq('order_id', orderId))
    },

    // --- Đơn hàng (FR-CHK-*, FR-ORD-*)
    async createOrder(order, items, redemption) {
      const { data, error } = await client.rpc('create_checkout_order', {
        p_order: {
          code: order.code, user_id: order.userId, status: order.status,
          checkout_idempotency_key: order.checkoutIdempotencyKey ?? null, checkout_fingerprint: order.checkoutFingerprint ?? null,
          order_kind: order.orderKind, has_message: order.hasMessage, qr_lang: order.qrLang,
          recipient_is_self: order.recipientIsSelf, recipient_name: order.recipientName,
          recipient_phone: order.recipientPhone, address_line: order.addressLine,
          ward: order.ward, district: order.district, province: order.province,
          province_code: order.provinceCode ?? null, ward_code: order.wardCode ?? null,
          note: order.note, payment_method: order.paymentMethod, payment_status: order.paymentStatus,
          payment_expires_at: order.paymentExpiresAt, payos_order_code: order.payosOrderCode,
          subtotal: order.subtotal, discount: order.discount, shipping_fee: order.shippingFee,
          total: order.total, vat_amount: order.vatAmount, vat_rate: order.vatRate,
          coupon_id: order.couponId, coupon_code: order.couponCode, qr_token: order.qrToken,
        },
        p_items: items.map((i) => ({
          product_id: i.productId, slug: i.slug, name: i.name,
          unit_price: i.unitPrice, quantity: i.quantity, line_total: i.lineTotal,
        })),
        p_coupon: redemption?.coupon ? toRow(redemption.coupon, {
          ...COUPON_COLS, id: 'id', usedCount: 'used_count',
        }) : null,
      })
      if (error) {
        const codes = ['CHECKOUT_KEY_CONFLICT', 'OUT_OF_STOCK', 'CART_EMPTY', 'CART_HAS_UNAVAILABLE', 'PRICE_CHANGED',
          'COUPON_NOT_FOUND', 'COUPON_INACTIVE', 'COUPON_NOT_STARTED', 'COUPON_EXPIRED',
          'COUPON_USED_UP', 'COUPON_USER_LIMIT', 'COUPON_MIN_ORDER', 'COUPON_NOT_APPLICABLE']
        if (error.code === 'P0001' && codes.includes(error.message)) {
          throw new RepoError(error.message, error.message === 'OUT_OF_STOCK' ? error.details : undefined)
        }
        throw error
      }
      return toOrder(data)
    },
    async getOrderByCheckoutKey(userId, key) {
      const row = unwrap(await client.from('orders').select('*, order_items(*)').eq('user_id', userId).eq('checkout_idempotency_key', key).maybeSingle())
      return row ? toOrder(row) : null
    },
    async getOrderById(id) {
      const r = unwrap(await client.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle())
      return r ? toOrder(r) : null
    },
    async getOrderByCode(code) {
      const r = unwrap(await client.from('orders').select('*, order_items(*)').eq('code', code).maybeSingle())
      return r ? toOrder(r) : null
    },
    async getOrderByPayosCode(payosOrderCode) {
      const r = unwrap(
        await client.from('orders').select('*, order_items(*)').eq('payos_order_code', payosOrderCode).maybeSingle(),
      )
      return r ? toOrder(r) : null
    },
    async listOrdersByUser(userId, { limit = 50 } = {}) {
      const rows = unwrap(
        await client
          .from('orders')
          .select('*, order_items(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit),
      )
      return rows.map(toOrder)
    },
    async listOrders({ status, limit = 100 } = {}) {
      let q = client.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(limit)
      if (status) q = q.eq('status', status)
      return unwrap(await q).map(toOrder)
    },
    async listExpiredPendingOrders(now) {
      const rows = unwrap(
        await client
          .from('orders')
          .select('*, order_items(*)')
          .eq('status', 'pending_payment')
          .lt('payment_expires_at', now),
      )
      return rows.map(toOrder)
    },
    async updateOrder(id, values) {
      const data = unwrap(await client.from('orders').update({ ...toRow(values, ORDER_COLS), ...(values.status === 'cancelled' ? { atomic_cancellation: true } : {}) }).eq('id', id).select('*, order_items(*)'))
      return data.length ? toOrder(data[0]) : null
    },
    /**
     * Đổi trạng thái chỉ khi trạng thái hiện tại đúng như mong đợi (khoá lạc quan) — hai request
     * đồng thời (khách huỷ + webhook PAID) không được cùng thành công.
     */
    async updateOrderIfStatus(id, expectedStatus, values, expectedPaymentStatus, expectedPaymentFlag) {
      let query = client.from('orders')
        .update({ ...toRow(values, ORDER_COLS), ...(values.status === 'cancelled' ? { atomic_cancellation: true } : {}) })
        .eq('id', id).eq('status', expectedStatus)
      if (expectedPaymentStatus !== undefined) query = query.eq('payment_status', expectedPaymentStatus)
      if (expectedPaymentFlag !== undefined) query = query.eq('payment_flag', expectedPaymentFlag)
      const data = unwrap(await query.select('*, order_items(*)'))
      return data.length ? toOrder(data[0]) : null
    },

    // --- NFR-AUD-001
    async appendAuditLog(entries) {
      if (!entries.length) return
      unwrap(
        await client.from('audit_log').insert(
          entries.map((e) => ({
            actor_id: e.actorId ?? null,
            actor_role: e.actorRole,
            entity: e.entity,
            entity_id: e.entityId ?? null,
            action: e.action,
            old_value: e.oldValue ?? null,
            new_value: e.newValue ?? null,
          })),
        ),
      )
    },
    async listAuditLog({ entity, entityId, limit = 100 } = {}) {
      let q = client.from('audit_log').select('*').order('at', { ascending: false }).limit(limit)
      if (entity) q = q.eq('entity', entity)
      if (entityId) q = q.eq('entity_id', entityId)
      return unwrap(await q).map((r) => ({
        id: Number(r.id),
        at: r.at,
        actorId: r.actor_id,
        actorRole: r.actor_role,
        entity: r.entity,
        entityId: r.entity_id,
        action: r.action,
        oldValue: r.old_value,
        newValue: r.new_value,
      }))
    },

    async getProductsByIds(ids) {
      if (!ids.length) return []
      const rows = unwrap(await client.from('products').select('*').in('id', [...new Set(ids)]))
      return rows.map(toProduct)
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

    getCollectionById: (id) => one('collections', id, toCollection),
    createCollection: (c) => insert('collections', toRow(c, COLLECTION_COLS), toCollection),
    updateCollection: (id, c) => patch('collections', id, toRow(c, COLLECTION_COLS), toCollection),
    deleteCollection: (id) => del('collections', id),

    // D-96: bộ sưu tập
    async listCollections({ statuses } = {}) {
      let q = client.from('collections').select('*').order('sort_order')
      if (statuses) q = q.in('status', statuses)
      const result = await q
      if (['PGRST205', '42P01', '42703', 'PGRST204'].includes(result.error?.code)) {
        throw new RepoError('CATALOG_NOT_READY', 'collections')
      }
      return unwrap(result).map(toCollection)
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
      if (profile.email !== undefined) row.email = profile.email
      // role không cho cập nhật qua upsert từ API khách
      const data = unwrap(await client.from('profiles').upsert(row).select('*').single())
      return toProfile(data)
    },

    // --- Quản lý người dùng (G-19)
    async listProfiles({ q, role, locked, limit = 20, offset = 0 } = {}) {
      let query = client.from('profiles').select('*', { count: 'exact' })
      if (role) query = query.eq('role', role)
      if (locked === true) query = query.not('locked_at', 'is', null)
      if (locked === false) query = query.is('locked_at', null)
      const needle = typeof q === 'string' ? q.trim() : ''
      if (needle) {
        // Bỏ ký tự có nghĩa với cú pháp lọc của PostgREST (dấu phẩy, ngoặc) và ký tự đại diện của LIKE
        const safe = needle.replace(/[,()*%_\\]/g, ' ').trim()
        // Chỉ toàn ký tự đặc biệt → không khớp ai (không được bỏ lọc rồi liệt kê tất cả như adapter bộ nhớ không làm)
        if (!safe) return { items: [], total: 0 }
        query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
      }
      const { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      if (error) throw error
      return { items: data.map(toProfile), total: count ?? data.length }
    },
    async countOrdersByUsers(userIds) {
      const out = Object.fromEntries(userIds.map((id) => [id, 0]))
      if (!userIds.length) return out
      for (const r of unwrap(await client.from('orders').select('user_id').in('user_id', userIds))) out[r.user_id] += 1
      return out
    },
    async updateProfileAdmin(id, patch) {
      const row = {}
      if (patch.role !== undefined) row.role = patch.role
      if (patch.lockedAt !== undefined) row.locked_at = patch.lockedAt
      if (patch.lockedReason !== undefined) row.locked_reason = patch.lockedReason
      const data = unwrap(await client.from('profiles').update(row).eq('id', id).select('*'))
      return data.length ? toProfile(data[0]) : null
    },

    // Khoá/mở khoá có điều kiện (một câu lệnh nguyên tử): người đến sau nhận null
    async lockProfile(id, { lockedAt, lockedReason }) {
      const data = unwrap(
        await client.from('profiles').update({ locked_at: lockedAt, locked_reason: lockedReason }).eq('id', id).is('locked_at', null).select('*'),
      )
      return data.length ? toProfile(data[0]) : null
    },
    async unlockProfile(id) {
      const data = unwrap(
        await client.from('profiles').update({ locked_at: null, locked_reason: null }).eq('id', id).not('locked_at', 'is', null).select('*'),
      )
      return data.length ? toProfile(data[0]) : null
    },

    // --- Lời chúc (FR-MSG-001, FR-QR-002…005)
    async getOrderByQrToken(token) {
      const row = unwrap(await client.from('orders').select('*, order_items(*)').eq('qr_token', token).maybeSingle())
      return row ? toOrder(row) : null
    },
    async getGiftMessage(orderId) {
      const row = unwrap(await client.from('gift_messages').select('*').eq('order_id', orderId).maybeSingle())
      return row ? toGiftMessage(row) : null
    },
    async upsertGiftMessage(orderId, patch) {
      const row = { order_id: orderId, ...toRow(patch, GIFT_COLS) }
      return toGiftMessage(unwrap(await client.from('gift_messages').upsert(row, { onConflict: 'order_id' }).select('*').single()))
    },
    // confirmed_at chỉ ghi lần đầu: tạo dòng nếu chưa có, rồi cập nhật khi còn NULL
    async confirmGiftMessage(orderId, at) {
      unwrap(await client.from('gift_messages').upsert({ order_id: orderId }, { onConflict: 'order_id', ignoreDuplicates: true }))
      unwrap(await client.from('gift_messages').update({ confirmed_at: at }).eq('order_id', orderId).is('confirmed_at', null))
      return this.getGiftMessage(orderId)
    },
    async listGiftMediaCandidates({ before = new Date().toISOString(), after = null, limit = 100 } = {}) {
      const rows = unwrap(await client.rpc('list_expired_gift_media', { before_at: before, after_id: after, batch_limit: limit })) ?? []
      return rows.map((r) => ({
        message: toGiftMessage(r.message),
        order: { id: r.order.id, status: r.order.status, deliveredAt: r.order.delivered_at },
      }))
    },
  }
}
