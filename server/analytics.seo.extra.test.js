// Kiểm thử GA (FR-GA-001, §23.3) và SEO mức production (FR-SEO-001, §23.2) ở tầng server.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import { loadConfig } from './config.js'
import { buildCsp, cspHash } from './middleware/security.js'

const GA_ID = 'G-TEST12345'
const baseConfig = { publicSiteUrl: 'https://lamvi.test' }
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

const page = (url, { config = baseConfig, data } = {}) =>
  renderPage({ repo: createMemoryRepo(data), config, template, render, url, pathname: url.split('?')[0] })

const ldBlocks = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))

describe('Nhúng Google Analytics (FR-GA-001, D-72)', () => {
  it('không đặt GA_MEASUREMENT_ID → không có gtag trong HTML', async () => {
    const r = await page('/')
    expect(r.html).not.toContain('googletagmanager')
  })

  it('có GA_MEASUREMENT_ID → nhúng gtag.js + config, tắt page_view tự động', async () => {
    const r = await page('/', { config: { ...baseConfig, gaMeasurementId: GA_ID } })
    expect(r.html).toContain(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`)
    expect(r.html).toContain('send_page_view:false')
  })

  it('D-102 (thay D-72): Consent Mode v2 mặc định denied, đặt trước lệnh config; banner do client dựng', async () => {
    const r = await page('/', { config: { ...baseConfig, gaMeasurementId: GA_ID } })
    expect(r.html).toContain('gtag("consent","default"')
    expect(r.html.indexOf('gtag("consent","default"')).toBeLessThan(r.html.indexOf('gtag("config"'))
    expect(r.html).toContain('analytics_storage:"denied"')
    expect(r.html).not.toContain('analytics_storage:"granted"')
  })

  it('trang nội bộ /admin và /it không nhúng GA', async () => {
    for (const url of ['/admin', '/admin/products', '/it']) {
      const r = await page(url, { config: { ...baseConfig, gaMeasurementId: GA_ID } })
      expect(r.html).not.toContain('googletagmanager')
    }
  })

  it('trang riêng tư của khách (giỏ, tài khoản) vẫn có GA — cần đo begin_checkout/purchase', async () => {
    for (const url of ['/cart', '/account']) {
      const r = await page(url, { config: { ...baseConfig, gaMeasurementId: GA_ID } })
      expect(r.html).toContain('googletagmanager')
    }
  })

  it('ID hỏng trong biến môi trường bị loại ở config, không lọt vào HTML', () => {
    const cfg = loadConfig({ GA_MEASUREMENT_ID: 'G-ABC"</script><script>alert(1)' })
    expect(cfg.gaMeasurementId).toBeNull()
  })

  it('trả hash CSP của đúng script nội tuyến trên trang (GA + dữ liệu nạp sẵn)', async () => {
    const r = await page('/', { config: { ...baseConfig, gaMeasurementId: GA_ID } })
    expect(r.scriptHashes).toHaveLength(2)
    for (const h of r.scriptHashes) expect(h).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/)
    // Hash phải khớp đúng nội dung nhúng trong HTML
    const inline = [...r.html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(inline).toHaveLength(2)
    for (const src of inline) expect(r.scriptHashes).toContain(cspHash(src))
  })
})

describe('Ảnh chia sẻ & dữ liệu có cấu trúc (G-23, §23.2)', () => {
  it('trang chủ: og:image tuyệt đối, kích thước, twitter card, og:site_name', async () => {
    const r = await page('/')
    expect(r.html).toContain('<meta property="og:image" content="https://lamvi.test/images/og/default.png"')
    expect(r.html).toContain('<meta property="og:image:width" content="1200"')
    expect(r.html).toContain('<meta property="og:image:height" content="630"')
    expect(r.html).toContain('<meta name="twitter:card" content="summary_large_image"')
    expect(r.html).toContain('<meta property="og:site_name" content="LAMVI"')
  })

  it('trang chủ: JSON-LD Organization + WebSite, liên kết bằng @id', async () => {
    const blocks = ldBlocks((await page('/')).html)
    const org = blocks.find((b) => b['@type'] === 'Organization')
    const site = blocks.find((b) => b['@type'] === 'WebSite')
    expect(org).toMatchObject({ name: 'LAMVI', url: 'https://lamvi.test' })
    expect(site.publisher['@id']).toBe(org['@id'])
    expect(site.inLanguage).toBe('vi')
  })

  it('trang chủ /en, /zh: WebSite đúng ngôn ngữ và URL', async () => {
    for (const [url, lang, path] of [
      ['/en', 'en', 'https://lamvi.test/en'],
      ['/zh', 'zh-Hans', 'https://lamvi.test/zh'],
    ]) {
      const site = ldBlocks((await page(url)).html).find((b) => b['@type'] === 'WebSite')
      expect(site).toMatchObject({ inLanguage: lang, url: path })
    }
  })

  it('trang sản phẩm: có cả Product và BreadcrumbList', async () => {
    const blocks = ldBlocks((await page('/products/den-nguyet')).html)
    expect(blocks.map((b) => b['@type'])).toEqual(['Product', 'BreadcrumbList'])
    const crumbs = blocks[1].itemListElement
    // Trang chủ → Cửa hàng → sản phẩm (D-87)
    expect(crumbs).toHaveLength(3)
    expect(crumbs[0]).toMatchObject({ position: 1, item: 'https://lamvi.test/' })
    expect(crumbs[1]).toMatchObject({ position: 2, item: 'https://lamvi.test/shop' })
    expect(crumbs[2]).toMatchObject({ position: 3, item: 'https://lamvi.test/products/den-nguyet' })
  })

  it('trang noindex không có og:image (không cần chia sẻ)', async () => {
    const r = await page('/lo/khong-co')
    expect(r.noindex).toBe(true)
    expect(r.html).not.toContain('og:image')
  })
})

describe('Security headers (T-37)', () => {
  const app = (config = baseConfig, dev = false) =>
    createApp({ repo: createMemoryRepo(), config, dev })

  it('mọi response có nosniff, referrer-policy, frame-options, permissions-policy', async () => {
    const res = await request(app()).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['permissions-policy']).toContain('geolocation=()')
  })

  it('CSP mặc định (API): không cho script nội tuyến nào, chặn object/frame', async () => {
    const csp = (await request(app()).get('/api/health')).headers['content-security-policy']
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(csp).not.toMatch(/script-src[^;]*(nonce|sha256)/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('chế độ dev: không đặt CSP (Vite chèn script nội tuyến riêng)', async () => {
    const res = await request(app(baseConfig, true)).get('/api/health')
    expect(res.headers['content-security-policy']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('HSTS chỉ gửi khi request qua HTTPS', async () => {
    const plain = await request(app()).get('/api/health')
    expect(plain.headers['strict-transport-security']).toBeUndefined()
    const https = await request(app()).get('/api/health').set('x-forwarded-proto', 'https')
    expect(https.headers['strict-transport-security']).toContain('max-age=31536000')
  })

  it('CSP chỉ mở đúng host Supabase và GA khi có cấu hình, không dùng ký tự đại diện', () => {
    const csp = buildCsp({ supabaseUrl: 'https://abc.supabase.co', gaEnabled: true })
    expect(csp).toContain('https://abc.supabase.co')
    expect(csp).toContain('https://www.googletagmanager.com')
    expect(csp).toContain('https://www.google-analytics.com')
    expect(csp).not.toContain("connect-src 'self' *")

    const off = buildCsp({ supabaseUrl: null, gaEnabled: false })
    expect(off).not.toContain('googletagmanager')
    expect(off).not.toContain('supabase')
  })

  it('URL Supabase hỏng không làm vỡ CSP', () => {
    expect(() => buildCsp({ supabaseUrl: 'khong-phai-url', gaEnabled: false })).not.toThrow()
  })
})

describe('Cache headers (§23.2, hiệu năng CDN)', () => {
  it('sitemap và robots có Cache-Control cho CDN', async () => {
    const a = createApp({ repo: createMemoryRepo(), config: baseConfig })
    expect((await request(a).get('/sitemap.xml')).headers['cache-control']).toContain('s-maxage=3600')
    expect((await request(a).get('/robots.txt')).headers['cache-control']).toContain('s-maxage=86400')
  })
})
