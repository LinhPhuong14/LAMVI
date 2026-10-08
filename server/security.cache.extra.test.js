// Kiểm thử độc lập (T-11) — security headers (T-37) và cache headers (deploy-vercel.md quy tắc 8, 9).
import { readFileSync } from 'node:fs'
import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createWeb, renderPage } from './ssr.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { buildCsp, cspHash, securityHeaders } from './middleware/security.js'
import { loadConfig } from './config.js'
import { render } from '../src/entry-server.jsx'
import { products } from './data/seed.js'

const GA_ID = 'G-TEST12345'
const config = { publicSiteUrl: 'https://lamvi.test', gaMeasurementId: GA_ID }
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

// Chạy middleware thật với req/res giả để xem header mà không cần dựng cả app
function runMiddleware({ headers = {}, dev = false, cfg = config } = {}) {
  const set = {}
  const req = { secure: false, get: (h) => headers[h.toLowerCase()] }
  const res = { locals: {}, set: (k, v) => { set[k] = v } }
  securityHeaders({ config: cfg, dev })(req, res, () => {})
  return { headers: set, locals: res.locals }
}

const directives = (csp) => csp.split('; ').map((d) => d.split(' ')[0])
// Script nội tuyến (không có src) trong HTML, kèm cả type để phân biệt ld+json
const inlineScripts = (html) =>
  [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({ attrs: m[1], body: m[2] }))

const pageAt = (url, cfg = config, data) =>
  renderPage({ repo: createMemoryRepo(data), config: cfg, template, render, url, pathname: url.split('?')[0] })

describe('CSP — chính sách mặc định và chế độ dev', () => {
  it('mặc định KHÔNG cho script nội tuyến nào và không dùng nonce', () => {
    const csp = runMiddleware().headers['Content-Security-Policy']
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain('nonce-')
    expect(csp).not.toContain('sha256-')
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
  })

  it('chế độ dev: không đặt CSP và không có setCsp', () => {
    const { headers, locals } = runMiddleware({ dev: true })
    expect(headers['Content-Security-Policy']).toBeUndefined()
    expect(locals.setCsp).toBeUndefined()
  })

  it('setCsp thêm đúng hash được truyền vào, mỗi hash bọc nháy đơn', () => {
    const { headers, locals } = runMiddleware()
    locals.setCsp(['sha256-AAAA', 'sha256-BBBB'])
    expect(headers['Content-Security-Policy']).toContain("script-src 'self' 'sha256-AAAA' 'sha256-BBBB'")
  })

  it('HSTS: req.secure hoặc x-forwarded-proto=https; giá trị khác không kích hoạt', () => {
    expect(runMiddleware().headers['Strict-Transport-Security']).toBeUndefined()
    expect(runMiddleware({ headers: { 'x-forwarded-proto': 'http' } }).headers['Strict-Transport-Security']).toBeUndefined()
    expect(runMiddleware({ headers: { 'x-forwarded-proto': 'https,http' } }).headers['Strict-Transport-Security']).toBeUndefined()
    expect(runMiddleware({ headers: { 'x-forwarded-proto': 'https' } }).headers['Strict-Transport-Security']).toContain(
      'max-age=63072000; includeSubDomains; preload',
    )
  })
})

describe('buildCsp — host bên ngoài và cấu trúc header', () => {
  it('mỗi directive chỉ xuất hiện một lần, đúng thứ tự', () => {
    const csp = buildCsp({ supabaseUrl: 'https://abc.supabase.co', gaEnabled: true })
    expect(directives(csp)).toEqual([
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'media-src',
      'font-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
      'upgrade-insecure-requests',
    ])
    expect(new Set(directives(csp)).size).toBe(directives(csp).length)
  })

  it('Supabase self-host http + cổng: mở đúng origin (kèm scheme và cổng)', () => {
    const csp = buildCsp({ supabaseUrl: 'http://localhost:54321', gaEnabled: false })
    expect(csp).toContain('http://localhost:54321')
    // Lưu ý: upgrade-insecure-requests vẫn bật — host http tự dựng (ngoài localhost) sẽ bị nâng https
    expect(csp).toContain('upgrade-insecure-requests')
  })

  it('URL Supabase có đường dẫn/query → chỉ lấy origin', () => {
    const csp = buildCsp({ supabaseUrl: 'https://abc.supabase.co/rest/v1?x=1', gaEnabled: false })
    expect(csp).toContain('https://abc.supabase.co')
    expect(csp).not.toContain('/rest/v1')
  })

  it('URL Supabase dị dạng → bỏ qua, không chèn chuỗi rác vào CSP', () => {
    for (const bad of ['', null, undefined, 'khong-phai-url', '//abc.supabase.co', 'javascript:alert(1)']) {
      const csp = buildCsp({ supabaseUrl: bad, gaEnabled: false })
      expect(csp).not.toContain('javascript:')
      expect(csp).not.toContain('khong-phai-url')
      expect(directives(csp)).toContain('connect-src')
    }
  })

  it('hash không chứa ký tự phá cấu trúc header (; hoặc khoảng trắng)', () => {
    const h = cspHash('window.__INITIAL_DATA__={"a":1}')
    expect(h).toMatch(/^sha256-[A-Za-z0-9+/]+={0,2}$/)
    expect(buildCsp({ supabaseUrl: null, gaEnabled: false, inlineScriptHashes: [h] })).toContain(`'${h}'`)
  })
})

describe('Hash CSP khớp đúng nội dung script nội tuyến của response', () => {
  it('trang chủ: mỗi script nội tuyến chạy được đều có hash tương ứng', async () => {
    const r = await pageAt('/')
    const js = inlineScripts(r.html).filter((s) => !s.attrs.includes('ld+json'))
    expect(js.length).toBeGreaterThan(0)
    for (const s of js) expect(r.scriptHashes).toContain(cspHash(s.body))
    expect(r.scriptHashes).toHaveLength(js.length)
  })

  it('nội dung sản phẩm có ký tự thay thế đặc biệt ($&, $\', </script>) vẫn khớp hash', async () => {
    // fill() dùng hàm thay thế nên $& / $` / $' trong dữ liệu DB không bị diễn giải; nếu ai đó đổi
    // sang chuỗi thay thế, HTML sẽ khác chuỗi đã hash → toàn bộ script bị CSP chặn.
    const doc = {
      ...products[0],
      slug: 'den-nguyet',
      name: "Đèn $& $` $' </script><script>alert(1)</script>",
      description: 'mô tả $& đặc biệt',
    }
    const r = await pageAt('/products/den-nguyet', config, { products: [doc] })
    const js = inlineScripts(r.html).filter((s) => !s.attrs.includes('ld+json'))
    expect(js.length).toBeGreaterThan(0)
    for (const s of js) expect(r.scriptHashes).toContain(cspHash(s.body))
    // và không thoát được khỏi thẻ script
    expect(r.html).not.toContain('<script>alert(1)')
  })

  it('trang riêng tư: chỉ có script GA (không có dữ liệu nạp sẵn)', async () => {
    const r = await pageAt('/cart')
    const js = inlineScripts(r.html).filter((s) => !s.attrs.includes('ld+json'))
    expect(js).toHaveLength(1)
    expect(r.scriptHashes).toEqual([cspHash(js[0].body)])
  })

  it('không cấu hình GA: trang riêng tư không có script nội tuyến nào và không có hash', async () => {
    const r = await pageAt('/cart', { publicSiteUrl: 'https://lamvi.test' })
    expect(inlineScripts(r.html).filter((s) => !s.attrs.includes('ld+json'))).toHaveLength(0)
    expect(r.scriptHashes).toEqual([])
  })

  it('trang bảo trì không có script nội tuyến và không có hash', async () => {
    const r = await renderPage({
      repo: createMemoryRepo(),
      config,
      template,
      render,
      url: '/',
      pathname: '/',
      maintenance: { get: async () => ({ enabled: true }) },
    })
    expect(r.status).toBe(503)
    expect(inlineScripts(r.html)).toHaveLength(0)
    expect(r.scriptHashes).toEqual([])
  })

  it('khối JSON-LD không được tính hash (type dữ liệu, trình duyệt không thực thi)', async () => {
    // Ghi nhận ràng buộc: nếu sau này ld+json bị CSP chặn thì dữ liệu có cấu trúc biến mất ở
    // trình duyệt (Googlebot đọc HTML thô nên SEO không ảnh hưởng).
    const r = await pageAt('/')
    const ld = inlineScripts(r.html).filter((s) => s.attrs.includes('ld+json'))
    expect(ld.length).toBeGreaterThan(0)
    for (const s of ld) expect(r.scriptHashes).not.toContain(cspHash(s.body))
  })
})

describe('PUBLIC_SITE_URL — chuẩn hoá URL gốc (§23.2)', () => {
  it('bỏ trống → mặc định localhost, không có dấu "/" cuối', () => {
    expect(loadConfig({}).publicSiteUrl).toBe('http://localhost:5173')
  })

  it('dấu "/" ở cuối bị cắt để không sinh URL hai gạch chéo', async () => {
    expect(loadConfig({ PUBLIC_SITE_URL: 'https://lamvi.vercel.app/' }).publicSiteUrl).toBe('https://lamvi.vercel.app')
    expect(loadConfig({ PUBLIC_SITE_URL: 'https://lamvi.vercel.app///' }).publicSiteUrl).toBe('https://lamvi.vercel.app')

    const a = createApp({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://lamvi.test/' }, dev: false })
    const res = await request(a).get('/sitemap.xml')
    expect(res.text).not.toContain('https://lamvi.test//')
  })
})

describe('Security headers trên mọi loại response', () => {
  const appWith = (web) => createApp({ repo: createMemoryRepo(), config, web, dev: false })

  it('API 200/404, sitemap, robots đều có CSP và nosniff, mỗi header đúng một lần', async () => {
    const a = appWith()
    for (const url of ['/api/health', '/api/khong-co', '/sitemap.xml', '/robots.txt']) {
      const res = await request(a).get(url)
      expect(res.headers['content-security-policy'], url).toBeDefined()
      expect(res.headers['x-content-type-options'], url).toBe('nosniff')
      // supertest gộp header lặp bằng dấu phẩy → kiểm tra không có hai chính sách nối nhau
      expect(res.headers['content-security-policy'].match(/default-src/g), url).toHaveLength(1)
      expect(res.headers['content-security-policy'], url).not.toContain('sha256-')
    }
  })

  it('trang lỗi 500 vẫn có CSP (middleware chạy trước router)', async () => {
    const boom = express.Router()
    boom.get(/.*/, () => {
      throw new Error('vo')
    })
    const res = await request(appWith(boom)).get('/')
    expect(res.status).toBe(500)
    expect(res.headers['content-security-policy']).toBeDefined()
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it('Permissions-Policy tắt camera/mic/geo/payment/usb', async () => {
    const res = await request(appWith()).get('/api/health')
    for (const feat of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']) {
      expect(res.headers['permissions-policy']).toContain(feat)
    }
  })
})

describe('Cache headers qua createWeb thật (deploy-vercel.md quy tắc 9)', () => {
  let app
  let maintenanceOn = false
  const maintenance = {
    get: async () => ({ enabled: maintenanceOn }),
    apiGuard: (req, res, next) => next(),
  }

  async function getApp() {
    if (!app) {
      const repo = createMemoryRepo()
      app = createApp({
        repo,
        config,
        maintenance,
        dev: false,
        web: await createWeb({ repo, config, dev: true, maintenance }),
      })
    }
    return app
  }

  it('trang riêng tư KHÔNG được có s-maxage (tránh CDN giữ bản chung)', async () => {
    const a = await getApp()
    for (const url of [
      '/cart',
      '/account',
      '/en/account',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/admin',
      '/admin/products',
      '/it',
    ]) {
      const res = await request(a).get(url)
      const cc = res.headers['cache-control'] ?? ''
      expect(cc, url).toContain('no-store')
      expect(cc, url).not.toContain('s-maxage')
      expect(cc, url).not.toContain('public')
      expect(res.headers['x-robots-tag'], url).toBe('noindex')
    }
  })

  it('trang 404 và trang lô: noindex nhưng vẫn được CDN giữ (không phụ thuộc phiên đăng nhập)', async () => {
    // Chính sách cache theo "có phụ thuộc phiên đăng nhập hay không", KHÔNG theo noindex:
    // /lo/:code là trang công khai in trên đèn (D-44 chỉ yêu cầu noindex, không yêu cầu no-store),
    // và 404 được CDN giữ giúp chặn bớt tải từ bot. Cả hai vẫn phải có X-Robots-Tag: noindex.
    const a = await getApp()
    for (const url of ['/khong-co', '/products/khong-co', '/lo/DEMO-2026-01']) {
      const res = await request(a).get(url)
      const cc = res.headers['cache-control'] ?? ''
      expect(cc, url).toContain('s-maxage=60')
      expect(cc, url).not.toContain('no-store')
      expect(res.headers['x-robots-tag'], url).toBe('noindex')
    }
  })

  it('trang công khai 3 ngôn ngữ: s-maxage=60 + stale-while-revalidate', async () => {
    const a = await getApp()
    for (const url of ['/', '/en', '/zh', '/products/den-nguyet']) {
      const cc = (await request(a).get(url)).headers['cache-control'] ?? ''
      expect(cc, url).toContain('s-maxage=60')
      expect(cc, url).toContain('stale-while-revalidate=300')
    }
  })

  it('trang bảo trì 503: no-store, noindex, Retry-After, không nhúng GA', async () => {
    const a = await getApp()
    maintenanceOn = true
    try {
      const res = await request(a).get('/')
      expect(res.status).toBe(503)
      expect(res.headers['cache-control']).toContain('no-store')
      expect(res.headers['cache-control']).not.toContain('s-maxage')
      expect(res.headers['retry-after']).toBe('600')
      expect(res.headers['x-robots-tag']).toBe('noindex')
      expect(res.text).not.toContain('googletagmanager')
    } finally {
      maintenanceOn = false
    }
  })

  it('API không đặt s-maxage (không để CDN giữ dữ liệu theo phiên)', async () => {
    const a = await getApp()
    const cc = (await request(a).get('/api/health')).headers['cache-control'] ?? ''
    expect(cc).not.toContain('s-maxage')
  })

  it('response được CDN chia sẻ không phụ thuộc giá trị sinh riêng mỗi request', async () => {
    // Đây là ràng buộc gắn liền quy tắc 8 + 9: nếu quay lại dùng nonce, bản HTML kèm nonce X sẽ
    // được CDN phát lại cho mọi khách trong 60 s (tới 300 s khi SWR) → nonce mất tác dụng.
    const a = await getApp()
    const r1 = await request(a).get('/')
    const r2 = await request(a).get('/')
    expect(r1.headers['cache-control']).toContain('s-maxage=60')
    expect(r1.headers['content-security-policy']).not.toContain('nonce-')
    expect(r1.text).not.toContain('nonce=')
    // Hai response liên tiếp phải cho CSP y hệt nhau, nếu không bản cache và header sẽ lệch
    expect(r1.headers['content-security-policy']).toBe(r2.headers['content-security-policy'])
  })

  it('trang công khai: CSP kèm hash cho script nội tuyến; API thì không', async () => {
    const a = await getApp()
    const home = await request(a).get('/')
    expect(home.headers['content-security-policy']).toContain('sha256-')
    const api = await request(a).get('/api/health')
    expect(api.headers['content-security-policy']).not.toContain('sha256-')
  })
})
