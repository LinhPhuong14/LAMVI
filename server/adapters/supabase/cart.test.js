// Kiểm thử độc lập: giỏ hàng qua adapter Supabase (FR-CART-001, D-59, D-60)
import { describe, expect, it } from 'vitest'
import { createSupabaseRepo } from './repo.js'
import { createCartService } from '../../cart/service.js'

// Client giả mô phỏng bảng cart_items (PK user_id + product_id) và products; ghi lại mọi lời gọi
function fakeClient(init = {}, { error } = {}) {
  const tables = { cart_items: [...(init.cart_items ?? [])], products: [...(init.products ?? [])] }
  const calls = []
  let clock = 0
  const client = {
    tables,
    calls,
    async rpc(name, { p_user: userId, p_mode: mode, p_lines: lines }) {
      calls.push({ rpc: name, mode, userId, lines })
      if (error) return { data: null, error }
      if (name !== 'mutate_cart') return { data: null, error: { code: '42883', message: 'function not found' } }
      const fail = (message, details) => ({ data: null, error: { code: 'P0001', message, details } })
      if (!['set', 'remove', 'merge'].includes(mode) || !Array.isArray(lines) || lines.length > 100 || (mode !== 'merge' && lines.length !== 1)) return fail('INVALID_CART_MUTATION')
      // Simulate one RPC transaction: publish staged rows only after every line succeeds.
      let staged = tables.cart_items.map((row) => ({ ...row }))
      for (const line of lines) {
        const product = tables.products.find((row) => row.slug === line.slug)
        const current = product ? staged.find((row) => row.user_id === userId && row.product_id === product.id) : null
        if (mode === 'remove') {
          if (product) staged = staged.filter((row) => row.user_id !== userId || row.product_id !== product.id)
          continue
        }
        if (!product) { if (mode === 'merge') continue; return fail('PRODUCT_UNAVAILABLE') }
        let quantity = line.quantity
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return fail('INVALID_CART_MUTATION')
        if (mode === 'merge') {
          if (product.status !== 'published' || (!current && staged.filter((row) => row.user_id === userId).length >= 50)) continue
          quantity = Math.min(10, (current?.quantity ?? 0) + quantity, product.stock ?? Infinity)
          if (quantity < 1) continue
        } else {
          if (product.status !== 'published' && !current) return fail('PRODUCT_UNAVAILABLE')
          if (product.status !== 'published' && quantity > current.quantity) return fail('PRODUCT_UNAVAILABLE_INCREASE')
          if (product.stock != null && quantity > (current?.quantity ?? 0) && quantity > product.stock) return fail('OUT_OF_STOCK', String(product.stock))
          if (!current && staged.filter((row) => row.user_id === userId).length >= 50) return fail('CART_FULL')
        }
        if (current) current.quantity = quantity
        else staged.push({ user_id: userId, product_id: product.id, quantity, added_at: String(++clock).padStart(6, '0') })
      }
      tables.cart_items = staged
      return { data: staged.filter((row) => row.user_id === userId).sort((a, b) => a.added_at.localeCompare(b.added_at)), error: null }
    },
    from(table) {
      const ops = []
      calls.push({ table, ops })
      let mode = 'select'
      let payload = null
      let upsertOpts = null
      const filters = []
      const inFilters = []
      let orderCol = null
      const match = (r) => filters.every(([c, v]) => r[c] === v) && inFilters.every(([c, values]) => values.includes(r[c]))
      const exec = () => {
        if (error) return { data: null, error }
        const rows = tables[table]
        if (mode === 'upsert') {
          const keys = upsertOpts?.onConflict?.split(',') ?? ['id']
          const i = rows.findIndex((r) => keys.every((k) => r[k] === payload[k]))
          if (i >= 0) rows[i] = { ...rows[i], ...payload }
          else rows.push({ added_at: String(++clock).padStart(6, '0'), ...payload })
          return { data: null, error: null }
        }
        if (mode === 'delete') {
          tables[table] = rows.filter((r) => !match(r))
          return { data: null, error: null }
        }
        let out = rows.filter(match)
        if (orderCol) out = [...out].sort((a, b) => String(a[orderCol]).localeCompare(String(b[orderCol])))
        return { data: out, error: null }
      }
      const b = {
        select: (...a) => (ops.push(['select', ...a]), b),
        upsert: (row, opts) => (ops.push(['upsert', row, opts]), (mode = 'upsert'), (payload = row), (upsertOpts = opts), b),
        delete: () => (ops.push(['delete']), (mode = 'delete'), b),
        eq: (c, v) => (ops.push(['eq', c, v]), filters.push([c, v]), b),
        in: (c, vs) => (ops.push(['in', c, vs]), inFilters.push([c, vs]), b),
        order: (c, o) => (ops.push(['order', c, o]), (orderCol = c), b),
        maybeSingle: () => {
          const r = exec()
          return Promise.resolve(r.error ? r : { data: r.data[0] ?? null, error: null })
        },
        then: (res, rej) => Promise.resolve(exec()).then(res, rej),
      }
      return b
    },
  }
  return client
}

const productRow = (over) => ({
  id: 'p1',
  slug: 'den-nguyet',
  kind: 'single',
  status: 'published',
  price: 890000,
  tone: 'amber',
  sort_order: 1,
  name: { vi: 'Đèn Nguyệt', en: 'Nguyet Lantern' },
  description: null,
  badge: null,
  updated_at: '2026-01-01',
  ...over,
})

describe('Adapter Supabase — cart_items', () => {
  it('getCart: lọc theo user_id, sắp theo added_at, map snake_case → camelCase', async () => {
    const client = fakeClient({
      cart_items: [
        { user_id: 'u1', product_id: 'p2', quantity: 2, added_at: '2026-09-02' },
        { user_id: 'u2', product_id: 'p1', quantity: 9, added_at: '2026-09-01' },
        { user_id: 'u1', product_id: 'p1', quantity: 1, added_at: '2026-09-01' },
      ],
    })
    const repo = createSupabaseRepo(client)
    expect(await repo.getCart('u1')).toEqual([
      { productId: 'p1', quantity: 1, addedAt: '2026-09-01' },
      { productId: 'p2', quantity: 2, addedAt: '2026-09-02' },
    ])
    const ops = client.calls.at(-1).ops
    expect(client.calls.at(-1).table).toBe('cart_items')
    expect(ops).toContainEqual(['eq', 'user_id', 'u1'])
    expect(ops.find((o) => o[0] === 'order')[1]).toBe('added_at')
  })

  it("setCartItem: upsert với onConflict 'user_id,product_id' (không tạo dòng trùng)", async () => {
    const client = fakeClient()
    const repo = createSupabaseRepo(client)
    await repo.setCartItem('u1', 'p1', 2)
    await repo.setCartItem('u1', 'p1', 5)
    const up = client.calls.at(-1).ops.find((o) => o[0] === 'upsert')
    expect(up[1]).toEqual({ user_id: 'u1', product_id: 'p1', quantity: 5 })
    expect(up[2]).toMatchObject({ onConflict: 'user_id,product_id' })
    expect(client.tables.cart_items).toHaveLength(1)
    expect(client.tables.cart_items[0].quantity).toBe(5)
  })

  it('removeCartItem: lọc cả user_id và product_id — không xoá dòng của người khác', async () => {
    const client = fakeClient({
      cart_items: [
        { user_id: 'u1', product_id: 'p1', quantity: 1, added_at: '1' },
        { user_id: 'u2', product_id: 'p1', quantity: 1, added_at: '1' },
      ],
    })
    const repo = createSupabaseRepo(client)
    await repo.removeCartItem('u1', 'p1')
    const ops = client.calls.at(-1).ops
    expect(ops).toContainEqual(['delete'])
    expect(ops).toContainEqual(['eq', 'user_id', 'u1'])
    expect(ops).toContainEqual(['eq', 'product_id', 'p1'])
    expect(client.tables.cart_items).toEqual([{ user_id: 'u2', product_id: 'p1', quantity: 1, added_at: '1' }])
  })

  it('lỗi Supabase được ném ra, không nuốt thành giỏ rỗng', async () => {
    const err = { code: '42501', message: 'permission denied' }
    const repo = createSupabaseRepo(fakeClient({}, { error: err }))
    await expect(repo.getCart('u1')).rejects.toBe(err)
    await expect(repo.setCartItem('u1', 'p1', 1)).rejects.toBe(err)
    await expect(repo.removeCartItem('u1', 'p1')).rejects.toBe(err)
    await expect(repo.mutateCart('u1', 'set', [{ slug: 'den-nguyet', quantity: 1 }])).rejects.toBe(err)
  })

  it('dịch vụ giỏ chạy trên adapter Supabase: thêm, gộp, giá hiện hành, sản phẩm bị xoá biến mất', async () => {
    const client = fakeClient({
      products: [productRow(), productRow({ id: 'p2', slug: 'den-vong', price: 1050000, sort_order: 2, name: { vi: 'Đèn Vọng' } })],
    })
    const cart = createCartService({ repo: createSupabaseRepo(client) })
    await cart.setQuantity('u1', 'den-nguyet', 3, 'en')
    const merged = await cart.merge('u1', [{ slug: 'den-nguyet', quantity: 9 }, { slug: 'den-vong', quantity: 1 }], 'en')
    expect(merged.items.map((i) => [i.slug, i.quantity])).toEqual([
      ['den-nguyet', 10],
      ['den-vong', 1],
    ])
    expect(merged.items[0].product.name).toBe('Nguyet Lantern')
    expect(merged.subtotal).toBe(8900000 + 1050000)
    expect(client.calls.filter((call) => call.rpc).map((call) => [call.rpc, call.mode])).toEqual([['mutate_cart', 'set'], ['mutate_cart', 'merge']])
    expect(client.calls.filter((call) => call.table === 'products').every((call) => call.ops.some((op) => op[0] === 'in' && op[1] === 'id'))).toBe(true)
    // Sản phẩm bị xoá khỏi DB (cascade) → không còn trong giỏ
    client.tables.products = client.tables.products.filter((p) => p.id !== 'p2')
    client.tables.cart_items = client.tables.cart_items.filter((r) => r.product_id !== 'p2')
    const after = await cart.get('u1', 'vi')
    expect(after.items.map((i) => i.slug)).toEqual(['den-nguyet'])
  })
})
