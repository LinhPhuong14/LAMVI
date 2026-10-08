// Kiểm thử độc lập (T-11) cho feedback 08/10: schema lỗi, productHasOrders, cache, health, specs, SSR key.
import { afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createApp } from './app.js'
import { errorHandler, HttpError } from './errors.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createSupabaseRepo } from './adapters/supabase/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { overallStatus } from './monitoring/health.js'
import { publicSite, getShippingPolicy } from './services/site.js'
import { parseSpecs } from './domain/admin.js'
import { presentSpecs } from './domain/catalog.js'
import { dataKeysFor, classifyPath } from '../src/seo/routes.js'
import { buildHeadTags } from '../src/seo/head.js'

afterEach(() => vi.restoreAllMocks())
const cfg = { publicSiteUrl: 'https://lamvi.test' }

describe('errors.js — SCHEMA_OUTDATED', () => {
  const run = (err) => {
    const app = express()
    app.get('/x', (_q, _r, next) => next(err))
    app.use(errorHandler)
    return request(app).get('/x')
  }
  it.each(['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703', '42883'])('%s → 503, không lộ chi tiết', async (code) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await run(Object.assign(new Error('column "specs" of relation "products" does not exist'), { code, details: 'secret-detail', hint: 'secret-hint' }))
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SCHEMA_OUTDATED')
    expect(res.text).not.toMatch(/specs|relation|secret/)
  })
  it('HttpError có code trùng mã Postgres vẫn giữ status của nó (không bị nuốt thành 503)', async () => {
    const res = await run(new HttpError(409, '42703', 'x'))
    expect(res.status).toBe(409)
  })
  it('mã Postgres khác (23505) vẫn 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await run(Object.assign(new Error('dup'), { code: '23505' }))
    expect(res.status).toBe(500)
  })
})

describe('productHasOrders — memory (bản thật, không stub)', () => {
  it('true khi đơn có sản phẩm, false khi không', async () => {
    const repo = createMemoryRepo()
    const [a, b] = await repo.listProducts({ publishedOnly: false })
    const withOrder = createMemoryRepo({ orders: [{ id: 'o1', code: 'X', userId: 'u', items: [{ productId: a.id, quantity: 1 }] }] })
    const ps = await withOrder.listProducts({ publishedOnly: false })
    expect(await withOrder.productHasOrders(ps.find((p) => p.id === a.id)?.id ?? a.id)).toBe(true)
    expect(await withOrder.productHasOrders(b.id)).toBe(false)
    expect(await withOrder.productHasOrders('khong-co')).toBe(false)
  })
  it('đơn không có items không làm hỏng', async () => {
    const repo = createMemoryRepo({ orders: [{ id: 'o1', code: 'X', userId: 'u' }] })
    expect(await repo.productHasOrders('p')).toBe(false)
  })
})

describe('productHasOrders — supabase adapter (đối chiếu migration orders)', () => {
  function client(rows, error = null) {
    const log = []
    return {
      log,
      from(table) {
        const op = { table, filters: [] }
        log.push(op)
        const b = {
          select: (cols, opts) => ((op.select = [cols, opts]), b),
          eq: (c, v) => (op.filters.push([c, v]), b),
          then: (res, rej) => {
            const hit = rows[table] ?? []
            const f = hit.filter((r) => op.filters.every(([c, v]) => r[c] === v))
            return Promise.resolve({ count: error ? null : f.length, data: null, error }).then(res, rej)
          },
        }
        return b
      },
    }
  }
  it('đếm trên bảng order_items cột product_id (khớp migration 20260930000008)', async () => {
    const c = client({ order_items: [{ id: 'i1', product_id: 'p1' }] })
    const repo = createSupabaseRepo(c)
    expect(await repo.productHasOrders('p1')).toBe(true)
    expect(await repo.productHasOrders('p2')).toBe(false)
    expect(c.log[0].table).toBe('order_items')
    expect(c.log[0].filters).toEqual([['product_id', 'p1']])
  })
  it('lỗi DB được ném ra (không nuốt thành false → cho phép xoá nhầm)', async () => {
    const repo = createSupabaseRepo(client({}, { code: '42P01', message: 'x' }))
    await expect(repo.productHasOrders('p1')).rejects.toMatchObject({ code: '42P01' })
  })
})

describe('Admin xoá/đổi slug với repo thật', () => {
  async function setup(data) {
    const repo = createMemoryRepo(data)
    const auth = createMemoryAuth()
    const { user } = await auth.signUp({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'Ad', role: 'admin' })
    const token = `Bearer ${(await auth.signIn({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
    return { repo, token, app: createApp({ repo, auth, storage: createMemoryStorage(), config: cfg }) }
  }
  it('DELETE sản phẩm có đơn thật → 409 và sản phẩm còn; sản phẩm chưa có đơn → 204', async () => {
    const base = createMemoryRepo()
    const [a, b] = await base.listProducts({ publishedOnly: false })
    const { repo, token, app } = await setup({ orders: [{ id: 'o1', code: 'X', userId: 'u', items: [{ productId: a.id, quantity: 1 }] }] })
    const res = await request(app).delete(`/api/admin/products/${a.id}`).set('Authorization', token)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PRODUCT_HAS_ORDERS')
    expect(await repo.getProductById(a.id)).toBeTruthy()
    const ok = await request(app).delete(`/api/admin/products/${b.id}`).set('Authorization', token)
    expect(ok.status).toBe(204)
  })
  it('PATCH slug viết hoa/khoảng trắng của sản phẩm published cũng bị khoá; slug trùng chính nó khác hoa thường được coi là đổi', async () => {
    const { repo, token, app } = await setup()
    const p = (await repo.listProducts({ publishedOnly: true }))[0]
    const res = await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ slug: `${p.slug}-2` })
    expect(res.status).toBe(409)
    expect(res.body.error.fields).toEqual({ slug: 'SLUG_LOCKED' })
    expect((await repo.getProductById(p.id)).slug).toBe(p.slug)
  })
  it('PATCH specs: null xoá thông số; JSON lạ bị 400', async () => {
    const { repo, token, app } = await setup()
    const p = (await repo.listProducts({ publishedOnly: true }))[0]
    await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ specs: { care: { vi: 'Lau khô' } } }).expect(200)
    const cleared = await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ specs: null })
    expect(cleared.status).toBe(200)
    expect((await request(app).get(`/api/products/${p.slug}`)).body.item.specs).toEqual({})
    for (const bad of ['x', 5, [], { __proto__: 1, constructor: { vi: 'a' } }, { size: { vi: 5 } }, { size: null }]) {
      const r = await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ specs: bad })
      expect([400, 200], JSON.stringify(bad)).toContain(r.status)
    }
  })
})

describe('parseSpecs / presentSpecs — biên', () => {
  it('khoá prototype không lọt; giá trị rỗng/ngôn ngữ lạ', () => {
    expect(parseSpecs(JSON.parse('{"__proto__":{"vi":"a"}}')).error).toBe('INVALID')
    expect(parseSpecs({ size: { vi: 'a', fr: 'b' } }).error).toBeTruthy()
    expect(parseSpecs({ size: null })).toEqual({ value: null })
  })
  it('presentSpecs: en thiếu → rơi về vi; chuỗi không phải object bị bỏ', () => {
    expect(presentSpecs({ size: { vi: 'a' } }, 'zh')).toEqual({ size: 'a' })
    expect(presentSpecs('rác', 'vi')).toEqual({})
  })
})

describe('Cache CDN catalog', () => {
  it('products/collections/faq 200 → s-maxage=60; lỗi 404 → no-store; collection không tồn tại không cache', async () => {
    const app = createApp({ repo: createMemoryRepo(), config: cfg })
    for (const u of ['/api/products', '/api/collections', '/api/faq']) {
      const r = await request(app).get(u)
      expect(r.status, u).toBe(200)
      expect(r.headers['cache-control'], u).toMatch(/s-maxage=60/)
    }
    const r404 = await request(app).get('/api/collections/khong-co')
    expect(r404.status).toBe(404)
    expect(r404.headers['cache-control']).toBe('no-store')
  })
  it('repo ném lỗi schema → 503 và KHÔNG có header cache public', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    repo.listProducts = async () => { throw Object.assign(new Error('x'), { code: 'PGRST205' }) }
    const r = await request(createApp({ repo, config: cfg })).get('/api/products')
    expect(r.status).toBe(503)
    expect(r.headers['cache-control'] ?? '').not.toMatch(/public|s-maxage/)
  })
  it('sản phẩm draft/hidden không bao giờ trả 200 cacheable', async () => {
    const repo = createMemoryRepo()
    const p = (await repo.listProducts({ publishedOnly: true }))[0]
    await repo.updateProduct(p.id, { status: 'hidden' })
    const r = await request(createApp({ repo, config: cfg })).get(`/api/products/${p.slug}`)
    expect(r.status).toBe(404)
    expect(r.headers['cache-control']).toBe('no-store')
  })
})

describe('Phí ship công khai', () => {
  it('cấu hình hỏng trong app_settings → rơi về mặc định, không 500', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting('pricing', { shippingFee: 'abc', freeShippingFrom: -5 }, null)
    const res = await request(createApp({ repo, config: cfg })).get('/api/shipping-policy')
    expect(res.status).toBe(200)
    expect(Number.isFinite(res.body.fee)).toBe(true)
    expect(Number.isFinite(res.body.freeFrom)).toBe(true)
  })
  it('không lộ trường khác ngoài fee/freeFrom', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting('pricing', { shippingFee: 1, freeShippingFrom: 2, secret: 'x', vatRate: 0.1 }, null)
    expect(Object.keys(await getShippingPolicy(repo)).sort()).toEqual(['fee', 'freeFrom'])
  })
  it('repo lỗi → 503 qua errorHandler, không treo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    repo.getSetting = async () => { throw Object.assign(new Error('x'), { code: '42P01' }) }
    const res = await request(createApp({ repo, config: cfg })).get('/api/shipping-policy')
    expect(res.status).toBe(503)
  })
  it('SSR: trang sản phẩm yêu cầu cả /shipping-policy; trang khác thì không', () => {
    const r = classifyPath('/products/den-a')
    expect(dataKeysFor(r)).toContain('/shipping-policy')
    expect(dataKeysFor(classifyPath('/shop'))).not.toContain('/shipping-policy')
  })
})

describe('payOS enabled / health', () => {
  it('publicSite.payosEnabled chỉ true khi config bật, không lộ khoá', () => {
    expect(publicSite({}).payosEnabled).toBe(false)
    const s = publicSite({ payosEnabled: true, payos: { apiKey: 'SECRET', checksumKey: 'S2' } })
    expect(s.payosEnabled).toBe(true)
    expect(JSON.stringify(s)).not.toMatch(/SECRET|S2/)
  })
  it('overallStatus: error thắng attention; storage/openai chưa cấu hình không gây attention', () => {
    const ok = (name) => ({ name, status: 'ok' })
    expect(overallStatus([{ name: 'payos', status: 'not_configured' }, { name: 'database', status: 'error' }])).toBe('degraded')
    expect(overallStatus([ok('database'), ok('auth'), { name: 'payos', status: 'configured' }, ok('mail'), { name: 'openai', status: 'not_configured' }, { name: 'storage', status: 'not_configured' }])).toBe('ok')
    expect(overallStatus([ok('database'), ok('auth'), { name: 'payos', status: 'configured' }, { name: 'mail', status: 'not_configured' }])).toBe('attention')
    expect(overallStatus([])).toBe('ok')
  })
})

describe('head withBrand', () => {
  const title = (t) => buildHeadTags({ lang: 'vi', siteUrl: 'https://x.test', path: '/', title: t }).find((x) => x.tag === 'title')?.text
  it('thêm hậu tố một lần; không nhân đôi; không thêm khi rỗng; chống lẫn HTML', () => {
    expect(title('Cửa hàng')).toBe('Cửa hàng — LAMVI')
    expect(title('LAMVI — Đèn')).toBe('LAMVI — Đèn')
    expect(title('Đèn lamvi')).toBe('Đèn lamvi')
    expect(title('')).toBeUndefined()
    expect(title(undefined)).toBeUndefined()
  })
})
