// Kiểm thử độc lập (T-11): đơn hàng / coupon / payment_events qua adapter Supabase (client giả).
// Không chạy Postgres thật — chỉ kiểm tra mapping cột, lời gọi RPC create_order và cập nhật có điều kiện.
import { describe, expect, it } from 'vitest'
import { createSupabaseRepo } from './repo.js'
import { RepoError } from '../repoErrors.js'

function fakeClient(init = {}, { rpcResult, errors = {} } = {}) {
  const tables = { orders: [], coupons: [], payment_events: [], order_items: [], ...structuredClone(init) }
  const calls = []
  const client = {
    tables,
    calls,
    rpc(name, args) {
      calls.push({ rpc: name, args })
      if (errors.rpc) return Promise.resolve({ data: null, error: errors.rpc })
      return Promise.resolve({ data: rpcResult ?? null, error: null })
    },
    from(table) {
      const ops = []
      calls.push({ table, ops })
      let mode = 'select'
      let payload = null
      let selectOpts = null
      const filters = []
      const match = (r) => filters.every((f) => f(r))
      const exec = () => {
        const err = errors[`${table}.${mode}`]
        if (err) return { data: null, error: err, count: null }
        const rows = tables[table]
        if (mode === 'insert') {
          rows.push(payload)
          return { data: [payload], error: null }
        }
        if (mode === 'update') {
          const hit = rows.filter(match)
          for (const r of hit) Object.assign(r, payload)
          return { data: hit.map((r) => ({ ...r })), error: null }
        }
        if (mode === 'delete') {
          const hit = rows.filter(match)
          tables[table] = rows.filter((r) => !match(r))
          return { data: hit, error: null }
        }
        const out = rows.filter(match).map((r) => (table === 'orders' ? { ...r, order_items: tables.order_items.filter((i) => i.order_id === r.id) } : { ...r }))
        if (selectOpts?.head) return { data: null, error: null, count: out.length }
        return { data: out, error: null }
      }
      const b = {
        select: (cols, opts) => (ops.push(['select', cols, opts]), mode === 'select' && (selectOpts = opts), b),
        insert: (row) => (ops.push(['insert', row]), (mode = 'insert'), (payload = row), b),
        update: (row) => (ops.push(['update', row]), (mode = 'update'), (payload = row), b),
        delete: () => (ops.push(['delete']), (mode = 'delete'), b),
        eq: (c, v) => (ops.push(['eq', c, v]), filters.push((r) => r[c] === v), b),
        neq: (c, v) => (ops.push(['neq', c, v]), filters.push((r) => r[c] !== v), b),
        in: (c, vs) => (ops.push(['in', c, vs]), filters.push((r) => vs.includes(r[c])), b),
        lte: (c, v) => (ops.push(['lte', c, v]), filters.push((r) => r[c] <= v), b),
        order: (c, o) => (ops.push(['order', c, o]), b),
        limit: (n) => (ops.push(['limit', n]), b),
        maybeSingle: () => {
          const r = exec()
          return Promise.resolve(r.error ? r : { data: r.data[0] ?? null, error: null })
        },
        single: () => {
          const r = exec()
          return Promise.resolve(r.error ? r : r.data.length === 1 ? { data: r.data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not single' } })
        },
        then: (res, rej) => Promise.resolve(exec()).then(res, rej),
      }
      return b
    },
  }
  return client
}

const orderRow = (over = {}) => ({
  id: 'o1',
  code: '100001',
  user_id: 'u1',
  client_key: 'key-12345678',
  status: 'PENDING_PAYMENT',
  production_stage: null,
  order_type: 'gift',
  has_message: true,
  qr_lang: 'en',
  recipient_type: 'other',
  recipient: { name: 'An' },
  payment_method: 'payos',
  payment_status: 'PENDING',
  coupon_id: 'c1',
  coupon_code: 'GIAM',
  subtotal: 890000,
  discount: 10000,
  shipping_fee: 30000,
  vat: 88000,
  total: 998000,
  payment_expires_at: '2026-10-01 03:15:00+00',
  payment_link_id: null,
  checkout_url: null,
  paid_at: null,
  paid_amount: null,
  payment_ref: null,
  flags: null,
  tracking_code: null,
  cancelled_at: null,
  cancel_reason: null,
  cod_collected_at: null,
  refunded_at: null,
  refunded_amount: null,
  refund_note: null,
  created_at: '2026-10-01 03:00:00.123+00',
  updated_at: '2026-10-01 03:00:00.123+00',
  ...over,
})

const domainOrder = {
  userId: 'u1',
  clientKey: 'key-12345678',
  status: 'PENDING_PAYMENT',
  paymentStatus: 'PENDING',
  paymentExpiresAt: '2026-10-01T03:15:00.000Z',
  orderType: 'gift',
  hasMessage: true,
  qrLang: 'en',
  recipientType: 'other',
  recipient: { name: 'An', phone: '0912345678' },
  paymentMethod: 'payos',
  couponId: 'c1',
  couponCode: 'GIAM',
  subtotal: 890000,
  discount: 10000,
  shippingFee: 30000,
  vat: 88000,
  total: 998000,
  flags: [],
}
const domainItems = [{ productId: 'p1', productSlug: 'den-nguyet', productName: { vi: 'Đèn Nguyệt' }, unitPrice: 890000, quantity: 1, lineTotal: 890000 }]

describe('Adapter Supabase — orders', () => {
  it('createOrder: gọi RPC create_order với cột snake_case (không lọt camelCase), rồi đọc lại đơn + dòng hàng', async () => {
    const client = fakeClient(
      { orders: [orderRow()], order_items: [{ id: 'i1', order_id: 'o1', product_id: 'p1', product_slug: 'den-nguyet', product_name: { vi: 'Đèn Nguyệt' }, unit_price: 890000, quantity: 1, line_total: 890000, batch_id: null }] },
      { rpcResult: 'o1' },
    )
    const repo = createSupabaseRepo(client)
    const o = await repo.createOrder(domainOrder, domainItems)
    const rpc = client.calls.find((c) => c.rpc)
    expect(rpc.rpc).toBe('create_order')
    expect(rpc.args.p_order).toEqual({
      user_id: 'u1',
      client_key: 'key-12345678',
      status: 'PENDING_PAYMENT',
      payment_status: 'PENDING',
      payment_expires_at: '2026-10-01T03:15:00.000Z',
      order_type: 'gift',
      has_message: true,
      qr_lang: 'en',
      recipient_type: 'other',
      recipient: { name: 'An', phone: '0912345678' },
      payment_method: 'payos',
      coupon_id: 'c1',
      coupon_code: 'GIAM',
      subtotal: 890000,
      discount: 10000,
      shipping_fee: 30000,
      vat: 88000,
      total: 998000,
      flags: [],
    })
    expect(rpc.args.p_items).toEqual([
      { product_id: 'p1', product_slug: 'den-nguyet', product_name: { vi: 'Đèn Nguyệt' }, unit_price: 890000, quantity: 1, line_total: 890000 },
    ])
    // Không gửi id / code / created_at từ client
    for (const k of ['id', 'code', 'created_at']) expect(rpc.args.p_order).not.toHaveProperty(k)
    expect(o).toMatchObject({ id: 'o1', code: 100001, userId: 'u1', clientKey: 'key-12345678', hasMessage: true, flags: [] })
    expect(typeof o.code).toBe('number')
    expect(o.items).toEqual([{ id: 'i1', orderId: 'o1', productId: 'p1', productSlug: 'den-nguyet', productName: { vi: 'Đèn Nguyệt' }, unitPrice: 890000, quantity: 1, lineTotal: 890000, batchId: null }])
  })

  it('toOrder: timestamptz của Postgres → ISO (so sánh chuỗi với đồng hồ server được)', async () => {
    const repo = createSupabaseRepo(fakeClient({ orders: [orderRow()] }))
    const o = await repo.getOrderById('o1')
    expect(o.paymentExpiresAt).toBe('2026-10-01T03:15:00.000Z')
    expect(o.createdAt).toBe('2026-10-01T03:00:00.123Z')
    expect(o.paidAt).toBeNull()
    expect(o.flags).toEqual([])
  })

  it('lỗi nghiệp vụ của create_order → RepoError cùng mã; trùng clientKey → CONFLICT field clientKey', async () => {
    for (const code of ['COUPON_INVALID', 'COUPON_USED_UP', 'COUPON_USER_LIMIT']) {
      const repo = createSupabaseRepo(fakeClient({}, { errors: { rpc: { code: 'P0001', message: code } } }))
      const err = await repo.createOrder(domainOrder, domainItems).catch((e) => e)
      expect(err).toBeInstanceOf(RepoError)
      expect(err.code).toBe(code)
    }
    const repo = createSupabaseRepo(
      fakeClient({}, { errors: { rpc: { code: '23505', message: 'duplicate key value violates unique constraint "orders_user_id_client_key_key"' } } }),
    )
    const err = await repo.createOrder(domainOrder, domainItems).catch((e) => e)
    expect(err).toMatchObject({ code: 'CONFLICT', field: 'clientKey' })
  })

  it('lỗi khác của RPC được ném nguyên (không nuốt)', async () => {
    const e = { code: '42883', message: 'function create_order does not exist' }
    const repo = createSupabaseRepo(fakeClient({}, { errors: { rpc: e } }))
    await expect(repo.createOrder(domainOrder, domainItems)).rejects.toBe(e)
  })

  it('updateOrder có điều kiện: lọc theo id + status IN (...); không khớp → null, không ghi', async () => {
    const client = fakeClient({ orders: [orderRow({ status: 'CANCELLED' })] })
    const repo = createSupabaseRepo(client)
    expect(await repo.updateOrder('o1', { status: 'CONFIRMED', paymentStatus: 'PAID' }, ['PENDING_PAYMENT'])).toBeNull()
    expect(client.tables.orders[0].status).toBe('CANCELLED')
    const upd = client.calls.find((c) => c.ops?.some((o) => o[0] === 'update'))
    expect(upd.ops).toContainEqual(['update', { status: 'CONFIRMED', payment_status: 'PAID' }])
    expect(upd.ops).toContainEqual(['eq', 'id', 'o1'])
    expect(upd.ops).toContainEqual(['in', 'status', ['PENDING_PAYMENT']])
  })

  it('updateOrder khớp → trả đơn đã cập nhật; patch camelCase → snake_case; trường lạ bị bỏ', async () => {
    const client = fakeClient({ orders: [orderRow()] })
    const repo = createSupabaseRepo(client)
    const o = await repo.updateOrder(
      'o1',
      { status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['AMOUNT_MISMATCH'], paidAmount: 1, paymentRef: 'FT1', cancelReason: 'payment_mismatch', id: 'hack', code: 1, userId: 'u2', hacker: true },
      ['PENDING_PAYMENT'],
    )
    expect(o).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['AMOUNT_MISMATCH'], paidAmount: 1, paymentRef: 'FT1' })
    const patch = client.calls.find((c) => c.ops?.some((x) => x[0] === 'update')).ops.find((x) => x[0] === 'update')[1]
    expect(patch).not.toHaveProperty('id')
    expect(patch).not.toHaveProperty('code')
    expect(patch).not.toHaveProperty('hacker')
    // userId là cột ORDER_COLS nên vẫn ghi được — service không bao giờ truyền userId vào updateOrder
    expect(Object.keys(patch).every((k) => /^[a-z_]+$/.test(k))).toBe(true)
  })

  it('updateOrder không có fromStatuses → không lọc status', async () => {
    const client = fakeClient({ orders: [orderRow({ status: 'SHIPPED' })] })
    const repo = createSupabaseRepo(client)
    expect(await repo.updateOrder('o1', { trackingCode: 'GHN-1' })).toMatchObject({ trackingCode: 'GHN-1' })
    const upd = client.calls.find((c) => c.ops?.some((o) => o[0] === 'update'))
    expect(upd.ops.some((o) => o[0] === 'in')).toBe(false)
  })

  it('updateOrderItem: lọc cả order_id (không sửa dòng hàng của đơn khác)', async () => {
    const client = fakeClient({ order_items: [{ id: 'i1', order_id: 'o2', batch_id: null }] })
    const repo = createSupabaseRepo(client)
    expect(await repo.updateOrderItem('o1', 'i1', { batchId: 'b1' })).toBeNull()
    expect(client.tables.order_items[0].batch_id).toBeNull()
    const ops = client.calls.at(-1).ops
    expect(ops).toContainEqual(['eq', 'order_id', 'o1'])
    expect(ops).toContainEqual(['update', { batch_id: 'b1' }])
  })

  it('listExpiredPendingOrders: status PENDING_PAYMENT + payment_expires_at ≤ mốc + có giới hạn', async () => {
    const client = fakeClient({ orders: [orderRow({ payment_expires_at: '2026-10-01T03:15:00.000Z' })] })
    const repo = createSupabaseRepo(client)
    await repo.listExpiredPendingOrders('2026-10-01T03:15:00.000Z')
    const ops = client.calls.at(-1).ops
    expect(ops).toContainEqual(['eq', 'status', 'PENDING_PAYMENT'])
    expect(ops).toContainEqual(['lte', 'payment_expires_at', '2026-10-01T03:15:00.000Z'])
    expect(ops.some((o) => o[0] === 'limit')).toBe(true)
  })

  it('getOrderByClientKey lọc theo cả user_id', async () => {
    const client = fakeClient({ orders: [orderRow({ user_id: 'u2' })] })
    const repo = createSupabaseRepo(client)
    expect(await repo.getOrderByClientKey('u1', 'key-12345678')).toBeNull()
    expect(client.calls.at(-1).ops).toContainEqual(['eq', 'user_id', 'u1'])
  })
})

describe('Adapter Supabase — coupon & payment_events', () => {
  it('countCouponUses: chỉ đơn chưa huỷ; byUser lọc theo user; userId null → 0', async () => {
    const client = fakeClient({
      orders: [
        { id: '1', coupon_id: 'c1', status: 'CONFIRMED', user_id: 'u1' },
        { id: '2', coupon_id: 'c1', status: 'CANCELLED', user_id: 'u1' },
        { id: '3', coupon_id: 'c1', status: 'PENDING_PAYMENT', user_id: 'u2' },
        { id: '4', coupon_id: 'c2', status: 'CONFIRMED', user_id: 'u1' },
      ],
    })
    const repo = createSupabaseRepo(client)
    expect(await repo.countCouponUses('c1', 'u1')).toEqual({ total: 2, byUser: 1 })
    expect(await repo.countCouponUses('c1', null)).toEqual({ total: 2, byUser: 0 })
    expect(client.calls.some((c) => c.ops?.some((o) => o[0] === 'neq' && o[1] === 'status' && o[2] === 'CANCELLED'))).toBe(true)
  })

  it('countCouponUses: lỗi đếm → ném lỗi (không coi là 0 lượt)', async () => {
    const repo = createSupabaseRepo(fakeClient({}, { errors: { 'orders.select': { code: '500', message: 'x' } } }))
    await expect(repo.countCouponUses('c1', 'u1')).rejects.toThrow()
  })

  it('coupon: map cột, starts_at/ends_at → ISO; trùng mã → CONFLICT; xoá coupon đã có đơn (23503) → IN_USE', async () => {
    const client = fakeClient({
      coupons: [{ id: 'c1', code: 'GIAM', status: 'active', type: 'percent', value: 10, max_discount: 5000, min_order: null, starts_at: '2026-10-01 00:00:00+07', ends_at: null, usage_limit: 5, per_user_limit: 1, product_ids: ['p1'], note: null, created_at: 'x', updated_at: 'y' }],
    })
    const repo = createSupabaseRepo(client)
    expect(await repo.getCouponByCode('GIAM')).toMatchObject({ id: 'c1', maxDiscount: 5000, startsAt: '2026-09-30T17:00:00.000Z', endsAt: null, usageLimit: 5, perUserLimit: 1, productIds: ['p1'] })
    const dup = createSupabaseRepo(fakeClient({}, { errors: { 'coupons.insert': { code: '23505', message: 'duplicate key value violates unique constraint "coupons_code_key"' } } }))
    expect(await dup.createCoupon({ code: 'GIAM', type: 'amount', value: 1 }).catch((e) => e)).toMatchObject({ code: 'CONFLICT', field: 'code' })
    const inUse = createSupabaseRepo(fakeClient({}, { errors: { 'coupons.delete': { code: '23503', message: 'fk' } } }))
    expect(await inUse.deleteCoupon('c1').catch((e) => e)).toMatchObject({ code: 'IN_USE' })
  })

  it('createCoupon: ghi cột snake_case', async () => {
    const client = fakeClient()
    const repo = createSupabaseRepo(client)
    await repo.createCoupon({ code: 'X', status: 'active', type: 'percent', value: 10, maxDiscount: 100, minOrder: 0, usageLimit: 1, perUserLimit: 1, productIds: null, startsAt: null, endsAt: null, note: null })
    expect(client.tables.coupons[0]).toEqual({ code: 'X', status: 'active', type: 'percent', value: 10, max_discount: 100, min_order: 0, usage_limit: 1, per_user_limit: 1, product_ids: null, starts_at: null, ends_at: null, note: null })
  })

  it('recordPaymentEvent: lần đầu true; trùng (23505) → false; lỗi khác → ném', async () => {
    const client = fakeClient()
    const repo = createSupabaseRepo(client)
    expect(await repo.recordPaymentEvent({ provider: 'payos', reference: 'FT1', orderCode: 100001, payload: { a: 1 } })).toBe(true)
    expect(client.tables.payment_events[0]).toEqual({ provider: 'payos', reference: 'FT1', order_code: 100001, payload: { a: 1 } })
    const dup = createSupabaseRepo(fakeClient({}, { errors: { 'payment_events.insert': { code: '23505', message: 'dup' } } }))
    expect(await dup.recordPaymentEvent({ provider: 'payos', reference: 'FT1', payload: {} })).toBe(false)
    const e = { code: '57014', message: 'timeout' }
    const bad = createSupabaseRepo(fakeClient({}, { errors: { 'payment_events.insert': e } }))
    await expect(bad.recordPaymentEvent({ provider: 'payos', reference: 'FT1', payload: {} })).rejects.toBe(e)
  })

  it('deletePaymentEvent lọc theo provider + reference', async () => {
    const client = fakeClient({ payment_events: [{ provider: 'payos', reference: 'FT1' }, { provider: 'fake', reference: 'FT1' }] })
    const repo = createSupabaseRepo(client)
    await repo.deletePaymentEvent('payos', 'FT1')
    expect(client.tables.payment_events).toEqual([{ provider: 'fake', reference: 'FT1' }])
  })

  it('xoá lô đã gán cho dòng hàng (23503) → RepoError IN_USE', async () => {
    const repo = createSupabaseRepo(fakeClient({ batches: [] }, { errors: { 'batches.delete': { code: '23503', message: 'fk order_items_batch_id_fkey' } } }))
    expect(await repo.deleteBatch('b1').catch((e) => e)).toMatchObject({ code: 'IN_USE' })
  })
})
