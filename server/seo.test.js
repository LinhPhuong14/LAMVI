import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import { products } from './data/seed.js'

const config = { publicSiteUrl: 'https://moc.test' }
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const page = (url, data) =>
  renderPage({ repo: createMemoryRepo(data), config, template, render, url, pathname: url.split('?')[0] })

describe('sitemap.xml & robots.txt (§23.2)', () => {
  it('sitemap: trang chủ + sản phẩm Published × 3 ngôn ngữ, có hreflang; không có sản phẩm ẩn, trang lô', async () => {
    const data = { products: [products[0], { ...products[1], status: 'hidden' }] }
    const res = await request(createApp({ repo: createMemoryRepo(data), config })).get('/sitemap.xml')
    expect(res.status).toBe(200)
    expect(res.type).toBe('application/xml')
    const locs = [...res.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual([
      'https://moc.test/',
      'https://moc.test/en',
      'https://moc.test/zh',
      'https://moc.test/products/den-nguyet',
      'https://moc.test/en/products/den-nguyet',
      'https://moc.test/zh/products/den-nguyet',
    ])
    expect(res.text).toContain('hreflang="zh-Hans" href="https://moc.test/zh/products/den-nguyet"')
    expect(res.text).toContain('hreflang="x-default" href="https://moc.test/products/den-nguyet"')
    expect(res.text).not.toContain('den-vong')
    expect(res.text).not.toContain('/lo/')
  })

  it('robots.txt: chặn /api/ và /admin, trỏ sitemap', async () => {
    const res = await request(createApp({ repo: createMemoryRepo(), config })).get('/robots.txt')
    expect(res.text).toContain('Disallow: /api/')
    expect(res.text).toContain('Disallow: /admin')
    expect(res.text).toContain('Sitemap: https://moc.test/sitemap.xml')
  })
})

describe('SSR (D-49, G-12)', () => {
  it('trang sản phẩm en: HTML có nội dung, lang, title, canonical, hreflang, JSON-LD giá chưa VAT (D-50)', async () => {
    const r = await page('/en/products/den-vong')
    expect(r.status).toBe(200)
    expect(r.noindex).toBe(false)
    expect(r.html).toContain('<html lang="en">')
    expect(r.html).toMatch(/<h1[^>]*>Vong Lantern<\/h1>/)
    expect(r.html).toContain('excl. VAT')
    expect(r.html).toContain('<title data-seo>Vong Lantern — LAMVI · handmade dó paper lanterns</title>')
    expect(r.html).toContain('<link rel="canonical" href="https://moc.test/en/products/den-vong" data-seo>')
    expect(r.html).toContain('hreflang="zh-Hans" href="https://moc.test/zh/products/den-vong"')
    const ld = JSON.parse(r.html.match(/<script type="application\/ld\+json" data-seo>(.*?)<\/script>/)[1])
    expect(ld).toMatchObject({
      '@type': 'Product',
      name: 'Vong Lantern',
      offers: { price: 1050000, priceCurrency: 'VND', priceSpecification: { valueAddedTaxIncluded: false } },
    })
    // Dữ liệu nạp sẵn cho hydrate
    expect(r.html).toContain('window.__INITIAL_DATA__=')
    expect(r.html).toContain('"/products/den-vong|en"')
  })

  it('trang chủ zh: có sản phẩm và FAQ từ DB trong HTML', async () => {
    const r = await page('/zh')
    expect(r.html).toContain('<html lang="zh-Hans">')
    expect(r.html).toContain('月灯')
    expect(r.html).toContain('视频和祝福会保存多久？')
    expect(r.html).toContain('<link rel="canonical" href="https://moc.test/zh" data-seo>')
  })

  it('sản phẩm không tồn tại / đã ẩn → 404 + noindex', async () => {
    const r = await page('/products/den-vong', { products: [{ ...products[1], status: 'hidden' }] })
    expect(r.status).toBe(404)
    expect(r.noindex).toBe(true)
    expect(r.html).toContain('<meta name="robots" content="noindex" data-seo>')
    expect(r.html).not.toContain('rel="canonical"')
    expect((await page('/khong-co-trang-nay')).status).toBe(404)
  })

  it('trang lô: SSR video nhưng noindex (D-44)', async () => {
    const r = await page('/lo/DEMO-2026-01')
    expect(r.status).toBe(200)
    expect(r.noindex).toBe(true)
    expect(r.html).toContain('<video')
  })

  it('trang riêng tư (đăng nhập, tài khoản, admin): chỉ khung HTML + noindex, không nạp dữ liệu', async () => {
    for (const url of ['/login', '/en/account', '/admin/products']) {
      const r = await page(url)
      expect(r.noindex).toBe(true)
      expect(r.html).toContain('<div id="root"></div>')
      expect(r.html).not.toContain('__INITIAL_DATA__')
      expect(r.html).toContain('<meta name="robots" content="noindex" data-seo>')
    }
  })

  it('nội dung DB không phá được HTML (escape trong title/JSON-LD/dữ liệu nạp sẵn)', async () => {
    const evil = { ...products[0], name: { vi: 'Đèn </script><script>alert(1)</script>' } }
    const r = await page('/products/den-nguyet', { products: [evil] })
    expect(r.html).not.toContain('<script>alert(1)</script>')
    expect(r.html).toContain('\\u003c/script>')
  })
})

describe('Hồi quy sau kiểm thử độc lập (SEO)', () => {
  it('sitemap bỏ lastmod không hợp lệ thay vì trả 500', async () => {
    const data = { products: [{ ...products[0], updatedAt: 'khong-phai-ngay' }] }
    const res = await request(createApp({ repo: createMemoryRepo(data), config })).get('/sitemap.xml')
    expect(res.status).toBe(200)
    expect(res.text).not.toContain('<lastmod>')
  })
})
