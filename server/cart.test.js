import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMaintenance } from './monitoring/maintenance.js'

let app, repo, auth, maintenance, token

async function login(email) {
  const { user } = await auth.signUp({ email, password: 'matkhau123' })
  await repo.upsertProfile({ id: user.id, fullName: email })
  return `Bearer ${(await auth.signIn({ email, password: 'matkhau123' })).accessToken}`
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  maintenance = createMaintenance({ repo, ttlMs: 0 })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://moc.test' }, maintenance })
  token = await login('an@moc.test')
})

const put = (slug, quantity, t = token) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', t).send({ quantity })
const hide = async (slug) => {
  const p = await repo.getProductBySlug(slug)
  await repo.updateProduct(p.id, { status: 'hidden' })
}

describe('Giỏ của người đã đăng nhập (FR-CART-001, D-41)', () => {
  it('thêm, sửa số lượng, xoá; tạm tính theo giá hiện hành chưa VAT', async () => {
    await put('den-nguyet', 2).expect(200)
    const res = await put('den-vong', 1)
    expect(res.body).toMatchObject({ subtotal: 2 * 890000 + 1050000, currency: 'VND', itemCount: 3, maxQuantity: 10 })
    expect(res.body.items.map((i) => [i.slug, i.quantity, i.lineTotal])).toEqual([
      ['den-nguyet', 2, 1780000],
      ['den-vong', 1, 1050000],
    ])
    await put('den-nguyet', 5).expect(200)
    const del = await request(app).delete('/api/cart/items/den-vong').set('Authorization', token)
    expect(del.body.items.map((i) => [i.slug, i.quantity])).toEqual([['den-nguyet', 5]])
    const get = await request(app).get('/api/cart?lang=en').set('Authorization', token)
    expect(get.body.items[0].product.name).toBe('Nguyet Lantern')
  })

  it('D-60: số lượng 1..10; sai → 400', async () => {
    for (const q of [0, 11, 1.5, '2', null]) {
      const res = await put('den-nguyet', q)
      expect(res.status, String(q)).toBe(400)
      expect(res.body.error.fields).toEqual({ quantity: 'INVALID_QUANTITY' })
    }
    expect((await put('den-nguyet', 10)).status).toBe(200)
  })

  it('giá đổi sau khi thêm → giỏ hiện giá mới (BR-PRC-002: chỉ chốt lúc tạo đơn)', async () => {
    await put('den-nguyet', 1)
    const p = await repo.getProductBySlug('den-nguyet')
    await repo.updateProduct(p.id, { price: 900000 })
    const res = await request(app).get('/api/cart').set('Authorization', token)
    expect(res.body.subtotal).toBe(900000)
  })

  it('§11: sản phẩm bị ẩn khi đang trong giỏ → cảnh báo, không tính tạm tính; không tăng được, vẫn xoá được', async () => {
    await put('den-nguyet', 2)
    await put('den-vong', 1)
    await hide('den-vong')
    const res = await request(app).get('/api/cart').set('Authorization', token)
    expect(res.body.hasUnavailable).toBe(true)
    expect(res.body.items.find((i) => i.slug === 'den-vong')).toMatchObject({ available: false, lineTotal: null, product: { price: null } })
    expect(res.body.subtotal).toBe(1780000)
    expect((await put('den-vong', 2)).body.error.code).toBe('PRODUCT_UNAVAILABLE')
    expect((await request(app).delete('/api/cart/items/den-vong').set('Authorization', token)).body.hasUnavailable).toBe(false)
  })

  it('thêm sản phẩm không có / nháp → lỗi', async () => {
    expect((await put('khong-co', 1)).status).toBe(404)
    await hide('den-nguyet')
    expect((await put('den-nguyet', 1)).status).toBe(404) // cùng mã với không tồn tại — không dò được slug (D-39)
  })

  it('giỏ riêng từng tài khoản; chưa đăng nhập → 401', async () => {
    await put('den-nguyet', 3)
    const other = await login('binh@moc.test')
    expect((await request(app).get('/api/cart').set('Authorization', other)).body.items).toEqual([])
    expect((await request(app).get('/api/cart')).status).toBe(401)
    expect((await request(app).put('/api/cart/items/den-nguyet').send({ quantity: 1 })).status).toBe(401)
  })
})

describe('Giỏ khách vãng lai + gộp khi đăng nhập (D-59)', () => {
  it('quote: server tính giá, không tin giá client; gộp dòng trùng; bỏ sản phẩm không tồn tại', async () => {
    const res = await request(app)
      .post('/api/cart/quote?lang=zh')
      .send({ items: [{ slug: 'den-vong', quantity: 2, price: 1 }, { slug: 'den-vong', quantity: 1 }, { slug: 'khong-co', quantity: 1 }, { slug: 'SAI SLUG', quantity: 1 }] })
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({ slug: 'den-vong', quantity: 3, lineTotal: 3150000, product: { name: '望灯' } })
  })

  it('quote: số lượng vượt 10 bị giới hạn; body sai → 400', async () => {
    const res = await request(app).post('/api/cart/quote').send({ items: [{ slug: 'den-vong', quantity: 99 }] })
    expect(res.body.items[0].quantity).toBe(10)
    expect((await request(app).post('/api/cart/quote').send({ items: 'x' })).status).toBe(400)
  })

  it('merge: cộng số lượng với giỏ server, tối đa 10, bỏ sản phẩm ẩn', async () => {
    await put('den-nguyet', 8)
    await hide('den-sum-vay')
    const res = await request(app)
      .post('/api/cart/merge')
      .set('Authorization', token)
      .send({ items: [{ slug: 'den-nguyet', quantity: 5 }, { slug: 'den-vong', quantity: 2 }, { slug: 'den-sum-vay', quantity: 1 }] })
    expect(res.body.items.map((i) => [i.slug, i.quantity])).toEqual([
      ['den-nguyet', 10],
      ['den-vong', 2],
    ])
  })
})

describe('Bảo trì (D-54)', () => {
  it('ghi giỏ bị 503; quote (chỉ tính giá) vẫn chạy', async () => {
    await maintenance.set(true, null)
    expect((await put('den-nguyet', 1)).status).toBe(503)
    expect((await request(app).post('/api/cart/quote').send({ items: [{ slug: 'den-vong', quantity: 1 }] })).status).toBe(200)
  })
})
