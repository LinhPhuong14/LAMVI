// Kiểm thử độc lập G-108 / D-105 (T-11): rò dữ liệu, SSR, XSS, Mây, cache, tham chiếu favicon
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { JSDOM } from 'jsdom'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMessageService } from './messages/service.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import { runTool } from './may/tools.js'
import { buildSeedSql } from '../scripts/gen-seed-sql.js'
import { collections, products } from './data/seed.js'

const EVIL = '<script>alert(1)</script><img src=x onerror=alert(2)>'
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const config = { publicSiteUrl: 'https://lamvi.test' }
const withStory = (story) => products.map((p, i) => (i === 0 ? { ...p, story } : p))
const ssr = (repo, url) => renderPage({ repo, config, template, render, url, pathname: url })

describe('SSR trang sản phẩm có tab Câu chuyện', () => {
  const slug = products[0].slug
  it('HTML có tab + panel câu chuyện, mỗi đoạn một <p>, theo ngôn ngữ', async () => {
    const repo = createMemoryRepo({ products, collections })
    for (const [url, lang] of [[`/products/${slug}`, 'vi'], [`/en/products/${slug}`, 'en'], [`/zh/products/${slug}`, 'zh']]) {
      const r = await ssr(repo, url)
      expect(r.status, url).toBe(200)
      const doc = new JSDOM(r.html).window.document
      expect(doc.querySelector('#pdp-tab-story'), url).not.toBeNull()
      const ps = [...doc.querySelectorAll('#pdp-panel-story p')].map((p) => p.textContent)
      const expected = products[0].story[lang].split(/\n{2,}/).map((s) => s.trim())
      expect(ps, url).toEqual(expected)
    }
  })
  it('đèn chưa có câu chuyện → không có tab', async () => {
    const r = await ssr(createMemoryRepo({ products: withStory(null), collections }), `/products/${slug}`)
    expect(r.html).not.toContain('pdp-tab-story')
  })
  it('đèn nháp/ẩn: 404 và HTML không chứa câu chuyện', async () => {
    for (const status of ['draft', 'hidden']) {
      const repo = createMemoryRepo({ products: products.map((p, i) => (i === 0 ? { ...p, status } : p)), collections })
      const r = await ssr(repo, `/products/${slug}`)
      expect(r.status).toBe(404)
      expect(r.html).not.toContain(products[0].story.vi.slice(0, 40))
    }
  })
  it('XSS: câu chuyện chứa HTML/script chỉ hiện dạng chữ, không thoát khỏi script dữ liệu', async () => {
    const repo = createMemoryRepo({ products: withStory({ vi: `Đoạn 1\n\n${EVIL}` }), collections })
    const r = await ssr(repo, `/products/${slug}`)
    expect(r.html).not.toContain('<script>alert(1)</script>')
    expect(r.html).not.toContain('<img src=x')
    const doc = new JSDOM(r.html).window.document
    expect(doc.querySelectorAll('#pdp-panel-story img, #pdp-panel-story script')).toHaveLength(0)
    expect(doc.querySelector('#pdp-panel-story').textContent).toContain(EVIL)
  })
})

describe('API: cache và rò câu chuyện', () => {
  const app = (repo) => createApp({ repo, auth: createMemoryAuth(), storage: createMemoryStorage(), config })
  it('đèn nháp/ẩn → 404 no-store (không cache công khai), không có story trong thân', async () => {
    for (const status of ['draft', 'hidden']) {
      const repo = createMemoryRepo({ products: products.map((p, i) => (i === 0 ? { ...p, status } : p)), collections })
      const r = await request(app(repo)).get(`/api/products/${products[0].slug}`)
      expect(r.status).toBe(404)
      expect(r.headers['cache-control']).toBe('no-store')
      expect(JSON.stringify(r.body)).not.toContain(products[0].story.vi.slice(0, 30))
    }
  })
  it('danh sách, bộ sưu tập, chi tiết bộ sưu tập: không chứa câu chuyện của đèn', async () => {
    const a = app(createMemoryRepo({ products, collections }))
    const needle = products[0].story.vi.slice(0, 30)
    for (const url of ['/api/products', '/api/collections', `/api/collections/${collections[0].slug}`]) {
      const r = await request(a).get(url)
      expect(JSON.stringify(r.body), url).not.toContain(needle)
    }
  })
  it('PATCH story kiểu sai → 400; story số/mảng/chuỗi', async () => {
    const repo = createMemoryRepo({ products, collections })
    const auth = createMemoryAuth()
    const { user } = await auth.signUp({ email: 'ad2@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'Ad', role: 'admin' })
    const token = `Bearer ${(await auth.signIn({ email: 'ad2@lamvi.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
    const a = createApp({ repo, auth, storage: createMemoryStorage(), config })
    const p = (await repo.listProducts({ publishedOnly: true }))[0]
    for (const bad of [123, 'abc', ['x'], { vi: 5 }, { vi: 'ok', fr: 'x' }]) {
      const r = await request(a).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ story: bad })
      expect(r.status, JSON.stringify(bad)).toBe(400)
    }
    const ok = await request(a).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ story: { vi: '  ', en: '' } })
    expect(ok.status).toBe(200)
    expect((await request(a).get(`/api/products/${p.slug}`)).body.item.story).toBeNull()
  })
})

describe('MessageService.view — lamps không rò dữ liệu nội bộ', () => {
  const now = new Date('2026-10-14T00:00:00Z')
  const prod = { id: 'SECRET-ID', slug: 'a', status: 'hidden', price: 999000, stock: 3, kind: 'single', name: { vi: 'A' }, description: { vi: 'd' }, story: { vi: 's' }, tone: 'amber', imageUrl: 'https://i/x.jpg', imageAlt: { vi: 'alt' }, specs: { size: { vi: 'x' } }, collectionSlug: 'c' }
  const svc = (order, message) =>
    createMessageService({
      repo: {
        getOrderByQrToken: async () => ({ id: 'o1', code: 'LV2026-ABCDEFG', orderKind: 'gift', qrLang: 'en', deliveredAt: now.toISOString(), items: [{ slug: 'a', unitPrice: 5, quantity: 2 }], ...order }),
        getGiftMessage: async () => message,
        listBatches: async () => [],
        getProductBySlug: async () => prod,
      },
      storage: { signedUrl: async () => 'u', removeObject: async () => {} },
      now: () => now,
    }).view('a'.repeat(64))

  it('active: mỗi lamp chỉ có đúng slug/name/description/story/tone/image', async () => {
    const v = await svc({ status: 'delivered' }, { text: 't', textLang: 'vi', confirmedAt: now.toISOString() })
    expect(Object.keys(v.lamps[0]).sort()).toEqual(['description', 'image', 'name', 'slug', 'story', 'tone'])
    expect(Object.keys(v.lamps[0].image).sort()).toEqual(['alt', 'url'])
    const raw = JSON.stringify(v)
    for (const s of ['SECRET-ID', '999000', 'LV2026-ABCDEFG', 'hidden', 'unitPrice']) expect(raw).not.toContain(s)
  })
  it('preparing và greeting: không có lamps', async () => {
    const prep = await svc({ status: 'paid' }, { text: 't', confirmedAt: now.toISOString() })
    expect(prep).toEqual({ state: 'preparing', lang: 'en' })
    const greet = await svc({ status: 'delivered' }, { text: 't', confirmedAt: null })
    expect('lamps' in greet).toBe(false)
  })
})

describe('Mây: get_product có story, get_products thì không', () => {
  const repo = () => createMemoryRepo({ products, collections })
  it('get_product trả story theo ngôn ngữ; đèn nháp → not_found', async () => {
    const r = await runTool('get_product', { slug: products[0].slug }, { repo: repo(), lang: 'en' })
    expect(r.product.story).toContain(products[0].story.en.slice(0, 30))
    const draft = createMemoryRepo({ products: products.map((p, i) => (i === 0 ? { ...p, status: 'draft' } : p)), collections })
    expect(await runTool('get_product', { slug: products[0].slug }, { repo: draft, lang: 'vi' })).toEqual({ error: 'not_found' })
  })
  it('get_products: story null cho mọi đèn (không phình prompt)', async () => {
    const r = await runTool('get_products', {}, { repo: repo(), lang: 'vi' })
    expect(r.products.every((p) => p.story === null)).toBe(true)
  })
})

describe('Tài sản và seed', () => {
  it('index.html và vercel.json không còn favicon.svg; có favicon.png + apple-touch-icon', () => {
    const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
    expect(template).not.toContain('favicon.svg')
    expect(vercel).not.toContain('favicon.svg')
    expect(template).toContain('/favicon.png')
    expect(template).toContain('/apple-touch-icon.png')
    for (const f of ['favicon.png', 'apple-touch-icon.png']) expect(() => readFileSync(new URL(`../public/${f}`, import.meta.url))).not.toThrow()
  })
  it('supabase/seed.sql khớp seed.js (đủ story 5 đèn) và migration có cột story', () => {
    const file = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8')
    expect(file).toBe(buildSeedSql())
    expect(file.match(/insert into public\.products .*, story\) values/g)).toHaveLength(5)
    const mig = readFileSync(new URL('../supabase/migrations/20261014000022_product_story.sql', import.meta.url), 'utf8')
    expect(mig).toMatch(/add column if not exists story jsonb/)
  })
  it('chuỗi UI/email không còn "QR khắc trên đèn" dạng khẳng định', () => {
    for (const f of ['vi', 'zh', 'en']) {
      const src = readFileSync(new URL(`../src/i18n/messages/${f}.js`, import.meta.url), 'utf8')
      expect(src, f).not.toMatch(/(?<!không )khắc (mã )?QR|(?<!not )engrave[sd]? (a )?QR|(?<!不会在灯上)刻二维码/i)
    }
  })
})
