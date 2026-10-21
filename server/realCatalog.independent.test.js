// Kiểm thử độc lập D-104: chạy app trên SEED THẬT (LAMVI_SEED=real) — API, SSR, sitemap, gallery, seed.sql
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { JSDOM } from 'jsdom'

// vitest.setup.js đặt 'demo' trước khi nạp file test; import tĩnh bị hoist nên phải import động SAU khi đổi biến.
process.env.LAMVI_SEED = 'real'
const { createApp } = await import('./app.js')
const { createMemoryRepo } = await import('./adapters/memory/repo.js')
const { createMemoryAuth } = await import('./adapters/memory/auth.js')
const { createMemoryStorage } = await import('./adapters/memory/storage.js')
const { renderPage } = await import('./ssr.js')
const { render } = await import('../src/entry-server.jsx')
const { buildSeedSql } = await import('../scripts/gen-seed-sql.js')
const realSeed = await import('./data/seed.js')
const demoSeed = await import('./data/demoCatalog.js')
const { default: vi } = await import('../src/i18n/messages/vi.js')
const { default: en } = await import('../src/i18n/messages/en.js')
const { default: zh } = await import('../src/i18n/messages/zh.js')

const SITE = 'https://moc.test'
const config = { publicSiteUrl: SITE }
const SLUGS = ['den-thu-hoach', 'den-tu-linh', 'den-phuc-loc-song-toan', 'den-ga-tam-duong-khai-thai', 'den-lon-dan']
const COL = 'bo-suu-tap-dau-tien'
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const page = (url, repo = createMemoryRepo()) => renderPage({ repo, config, template, render, url, pathname: url.split('?')[0] })

describe('cơ chế LAMVI_SEED', () => {
  it('đặt "real" trước import động → repo bộ nhớ dùng seed thật, không lẫn demo', async () => {
    const repo = createMemoryRepo()
    const slugs = (await repo.listProducts({})).map((p) => p.slug).sort()
    expect(slugs).toEqual([...SLUGS].sort())
    expect(slugs.some((s) => demoSeed.products.some((d) => d.slug === s))).toBe(false)
  })
})

describe('API công khai trên seed thật', () => {
  const app = createApp({ repo: createMemoryRepo(), config })

  it('/api/products: 5 đèn lẻ, 1.499.000, không có gói set; ba ngôn ngữ', async () => {
    for (const lang of ['vi', 'en', 'zh']) {
      const res = await request(app).get(`/api/products?lang=${lang}`)
      expect(res.status).toBe(200)
      const items = res.body.items
      expect(items.map((p) => p.slug)).toEqual(SLUGS)
      expect(items.every((p) => p.kind === 'single' && p.price === 1499000 && p.collection === COL)).toBe(true)
      expect(items.every((p) => typeof p.name === 'string' && p.name.length > 0)).toBe(true)
    }
  })

  it('/api/products/:slug có specs đúng ngôn ngữ; slug demo cũ → 404', async () => {
    const vn = await request(app).get('/api/products/den-thu-hoach?lang=vi')
    expect(vn.status).toBe(200)
    expect(vn.body.item.specs.size).toContain('20 cm')
    const zhRes = await request(app).get('/api/products/den-thu-hoach?lang=zh')
    expect(zhRes.body.item.specs.size).toMatch(/[一-鿿]/)
    for (const old of ['den-nguyet', 'den-sum-vay', 'den-hoi-dong']) {
      expect((await request(app).get(`/api/products/${old}`)).status).toBe(404)
    }
  })

  it('/api/collections: đúng 1 bộ; chi tiết liệt kê 5 đèn theo pieceOrder', async () => {
    const list = await request(app).get('/api/collections?lang=vi')
    expect(list.body.items.map((c) => c.slug)).toEqual([COL])
    const one = await request(app).get(`/api/collections/${COL}?lang=en`)
    expect(one.status).toBe(200)
    const pieces = one.body.item.lamps
    expect(pieces.map((p) => p.slug)).toEqual(SLUGS)
    expect((await request(app).get('/api/collections/sum-vay')).status).toBe(404)
  })

  it('/api/faq: 9 câu ở cả ba ngôn ngữ, câu về QR nói rõ thiệp cảm ơn', async () => {
    for (const lang of ['vi', 'en', 'zh']) {
      const res = await request(app).get(`/api/faq?lang=${lang}`)
      expect(res.body.items).toHaveLength(9)
    }
    const all = (await request(app).get('/api/faq?lang=vi')).body.items
    const qr = all.find((f) => /QR/.test(f.question))
    expect(qr.answer).toContain('thiệp cảm ơn')
  })
})

describe('SSR / SEO / sitemap trên seed thật', () => {
  it('/products/den-thu-hoach 200, có JSON-LD Product giá 1499000 VND; slug cũ 404', async () => {
    const r = await page('/products/den-thu-hoach')
    expect(r.status).toBe(200)
    const ld = [...r.html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]))
    const prod = ld.flat().find((o) => o['@type'] === 'Product')
    expect(prod, 'có Product JSON-LD').toBeTruthy()
    expect(JSON.stringify(prod)).toContain('1499000')
    for (const old of ['/products/den-nguyet', '/en/products/den-sum-vay']) {
      const o = await page(old)
      expect(o.status, old).toBe(404)
      expect(o.noindex).toBe(true)
    }
  })

  it('/collections/bo-suu-tap-dau-tien 200 (vi/en/zh); /shop 200 và hiện thẻ bộ sưu tập', async () => {
    for (const url of [`/collections/${COL}`, `/en/collections/${COL}`, `/zh/collections/${COL}`]) {
      const r = await page(url)
      expect(r.status, url).toBe(200)
    }
    const shop = await page('/shop')
    expect(shop.status).toBe(200)
    expect(shop.html).toContain(COL)
    expect((await page('/collections/sum-vay')).status).toBe(404)
  })

  it('trang chủ SSR: không còn số liệu mẫu cũ, có tên nghệ nhân thật và 5 đèn', async () => {
    const r = await page('/')
    expect(r.status).toBe(200)
    const text = new JSDOM(r.html).window.document.body.textContent
    expect(text).toContain('Nguyễn Hữu Quả')
    expect(text).not.toContain('Nguyễn Văn Tài')
    expect(text).not.toContain('4.000+')
    expect(text).not.toContain('Yên Thái')
    expect(text).toContain('chiếc đèn trong bộ sưu tập đầu tiên')
    for (const n of vi.lookbook.items) expect(text).toContain(n)
  })

  it('sitemap: 5 sản phẩm + 1 bộ sưu tập × 3 ngôn ngữ, không còn slug demo', async () => {
    const res = await request(createApp({ repo: createMemoryRepo(), config })).get('/sitemap.xml')
    const locs = [...res.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    for (const s of SLUGS) {
      for (const pre of ['', '/en', '/zh']) expect(locs).toContain(`${SITE}${pre}/products/${s}`)
    }
    for (const pre of ['', '/en', '/zh']) expect(locs).toContain(`${SITE}${pre}/collections/${COL}`)
    expect(locs.some((l) => /den-nguyet|sum-vay|hoi-lang|den-vong/.test(l))).toBe(false)
  })
})

describe('Gallery trên seed thật (1 bộ, 5 đèn, không có set)', () => {
  let app, repo, auth, bearer, user, n = 0
  beforeAll(async () => {
    repo = createMemoryRepo()
    auth = createMemoryAuth()
    app = createApp({ repo, auth, storage: createMemoryStorage(), config })
    const { user: u } = await auth.signUp({ email: 'g@moc.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: u.id, fullName: 'G', role: 'customer' })
    user = u
    bearer = `Bearer ${(await auth.signIn({ email: 'g@moc.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
  })
  const buy = (slug) => {
    n += 1
    return repo.createOrder(
      { code: `LV2610-RC${String(n).padStart(4, '0')}`, userId: user.id, status: 'delivered', orderKind: 'self', hasMessage: false, qrToken: `t${n}`.padEnd(64, 'a'), deliveredAt: `2026-10-0${n}T10:00:00Z`, total: 1 },
      [{ slug, name: { vi: slug }, unitPrice: 1, quantity: 1, lineTotal: 1 }],
    )
  }
  const get = () => request(app).get('/api/gallery?lang=vi').set('Authorization', bearer)

  it('chưa mua: bộ có 5 mảnh, 0 sở hữu, chưa lộ cốt truyện', async () => {
    const g = (await get()).body
    expect(g.collections).toHaveLength(1)
    expect(g.collections[0].pieces.map((p) => p.slug)).toEqual(SLUGS)
    expect(g.quilt).toMatchObject({ totalPieces: 5, unlockedPieces: 0, completedCollections: 0, complete: false })
    expect(g.collections[0].reward).toBeNull()
  })

  it('mua 4/5 đèn: chưa có phần thưởng; mua đủ 5: mở cốt truyện', async () => {
    for (const s of SLUGS.slice(0, 4)) await buy(s)
    let g = (await get()).body
    expect(g.quilt.unlockedPieces).toBe(4)
    expect(g.collections[0].reward).toBeNull()
    expect(JSON.stringify(g)).not.toContain(realSeed.collections[0].story.vi.slice(0, 30))
    await buy(SLUGS[4])
    g = (await get()).body
    expect(g.quilt).toMatchObject({ unlockedPieces: 5, completedCollections: 1, complete: true })
    expect(g.collections[0].reward.story).toBe(realSeed.collections[0].story.vi)
  })
})

describe('supabase/seed.sql khớp seed.js', () => {
  it('file đã commit = đầu ra buildSeedSql() (chạy lại npm run db:seed-sql không đổi gì)', () => {
    const sql = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8')
    expect(sql).toBe(buildSeedSql())
  })

  it('có đủ 5 sản phẩm, 1 bộ sưu tập, 9 FAQ; không còn id/slug demo', () => {
    const sql = buildSeedSql()
    expect(sql.match(/insert into public\.products /g)).toHaveLength(5)
    expect(sql.match(/insert into public\.collections /g)).toHaveLength(1)
    expect(sql.match(/insert into public\.faq_entries /g)).toHaveLength(9)
    expect(sql).not.toMatch(/'set'/)
    expect(sql).not.toMatch(/den-nguyet|sum-vay|hoi-lang/)
  })
})

describe('i18n: đủ key ở en/zh như vi, không còn key đã xoá', () => {
  const keys = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]))
  const lens = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) => (Array.isArray(v) ? [[`${p}${k}`, v.length]] : v && typeof v === 'object' ? lens(v, `${p}${k}.`) : []))

  it('tập key en/zh = vi; mảng cùng độ dài', () => {
    const base = keys(vi).sort()
    expect(keys(en).sort()).toEqual(base)
    expect(keys(zh).sort()).toEqual(base)
    const L = Object.fromEntries(lens(vi))
    expect(Object.fromEntries(lens(en))).toEqual(L)
    expect(Object.fromEntries(lens(zh))).toEqual(L)
  })

  it('key mới có giá trị không rỗng ở ba ngôn ngữ', () => {
    for (const m of [vi, en, zh]) {
      for (const k of ['statLamps', 'statStages', 'statStory']) expect(m.story[k]?.trim()).toBeTruthy()
      for (const k of ['name', 'place', 'quote']) expect(m.artisan[k]?.trim()).toBeTruthy()
      expect(m.gift.watchBatch?.trim()).toBeTruthy()
    }
  })

  it('không file nguồn nào (ngoài test) còn tham chiếu key đã xoá', () => {
    const files = ['src/pages/HomePage.jsx', 'src/components/Motion.jsx'].map((f) => {
      try { return readFileSync(new URL(`../${f}`, import.meta.url), 'utf8') } catch { return '' }
    }).join('\n')
    expect(files).not.toMatch(/story\.statYears|story\.statArtisans|artisan\.years|artisan\.made/)
  })
})
