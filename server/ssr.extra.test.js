// Kiểm thử độc lập phía server cho SEO/SSR (D-49, D-68, BR-SEO-001, §23.2) — bổ sung cho seo.test.js
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { JSDOM } from 'jsdom'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import { classifyPath, dataKeysFor } from '../src/seo/routes.js'
import { products, demoBatches, faqEntries } from './data/seed.js'

const SITE = 'https://moc.test'
const config = { publicSiteUrl: SITE }
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

const pageWith = (repo, url) =>
  renderPage({ repo, config, template, render, url, pathname: url.split('?')[0] })
const page = (url, data) => pageWith(createMemoryRepo(data), url)

const count = (html, re) => (html.match(re) ?? []).length
const headOf = (html) => html.slice(html.indexOf('<head>'), html.indexOf('</head>'))

// Trích __INITIAL_DATA__ như trình duyệt: chạy nội dung script (JSON hợp lệ trong JS)
function initialData(html) {
  const m = html.match(/<script>window\.__INITIAL_DATA__=(.*?)<\/script>/s)
  if (!m) return null
  return JSON.parse(m[1])
}

afterEach(() => vi.restoreAllMocks())

describe('SSR — mã trạng thái', () => {
  it('slug draft / hidden / không tồn tại → 404 + noindex', async () => {
    const data = {
      products: [
        { ...products[0], status: 'draft' },
        { ...products[1], status: 'hidden' },
      ],
    }
    for (const url of ['/products/den-nguyet', '/en/products/den-vong', '/zh/products/khong-co']) {
      const r = await page(url, data)
      expect(r.status, url).toBe(404)
      expect(r.noindex, url).toBe(true)
    }
  })

  it('route lạ → 404 (vi/en/zh, có/không dấu / cuối)', async () => {
    for (const url of ['/abc', '/en/abc', '/zh/products', '/products/a/b', '/lo', '/abc/']) {
      const r = await page(url)
      expect(r.status, url).toBe(404)
      expect(r.noindex, url).toBe(true)
    }
  })

  it('lô chưa xuất bản video / không có → 404 + noindex', async () => {
    for (const url of ['/lo/DEMO-2026-02', '/en/lo/KHONG-CO']) {
      const r = await page(url)
      expect(r.status, url).toBe(404)
      expect(r.noindex, url).toBe(true)
      expect(r.html).not.toContain('<video')
    }
  })

  it('repo ném lỗi khi nạp sản phẩm → 500, HTML không lộ thông điệp lỗi gốc', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    repo.getProductBySlug = async () => {
      throw new Error('SECRET-DB-CONNECTION-STRING postgres://u:p@h')
    }
    const r = await pageWith(repo, '/products/den-nguyet')
    expect(r.status).toBe(500)
    expect(r.noindex).toBe(true)
    expect(r.html).not.toContain('SECRET-DB')
    expect(r.html).not.toContain('postgres://')
    expect(initialData(r.html)['/products/den-nguyet|vi']).toEqual({
      error: { status: 500, code: 'INTERNAL_ERROR' },
    })
  })

  it('repo ném lỗi khi nạp lô → 500, không lộ lỗi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    repo.getBatchByCode = async () => {
      throw new Error('SECRET-BATCH')
    }
    const r = await pageWith(repo, '/lo/DEMO-2026-01')
    expect(r.status).toBe(500)
    expect(r.html).not.toContain('SECRET-BATCH')
  })

  it('repo danh sách sản phẩm (footer) ném lỗi → trang chủ vẫn render, không lộ lỗi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    repo.listProducts = async () => {
      throw new Error('SECRET-LIST')
    }
    const r = await pageWith(repo, '/')
    expect([200, 500]).toContain(r.status)
    expect(r.html).not.toContain('SECRET-LIST')
    expect(r.html).toContain('<html lang="vi">')
  })

  it('trang riêng tư → 200 + noindex, không SSR nội dung; lang theo URL', async () => {
    for (const [url, lang] of [
      ['/login', 'vi'],
      ['/en/register', 'en'],
      ['/zh/forgot-password', 'zh-Hans'],
      ['/reset-password', 'vi'],
      ['/account/', 'vi'],
      ['/admin', 'vi'],
      ['/admin/batches/123', 'vi'],
    ]) {
      const r = await page(url)
      expect(r.status, url).toBe(200)
      expect(r.noindex, url).toBe(true)
      expect(r.html, url).toContain(`<html lang="${lang}">`)
      expect(r.html, url).toContain('<div id="root"></div>')
      expect(count(r.html, /<meta name="robots"/g), url).toBe(1)
      expect(r.html, url).not.toContain('rel="canonical"')
      expect(r.html, url).not.toContain('hreflang')
      expect(r.html, url).not.toContain('application/ld+json')
    }
  })

  it('trang riêng tư không gọi repo', async () => {
    const repo = createMemoryRepo()
    const boom = async () => {
      throw new Error('không được gọi')
    }
    Object.assign(repo, { listProducts: boom, listFaq: boom, getProductBySlug: boom, getBatchByCode: boom })
    const r = await pageWith(repo, '/account')
    expect(r.status).toBe(200)
  })

  it('/en/admin, /zh/admin/products, /administrator không phải trang admin riêng tư → 404', async () => {
    for (const url of ['/en/admin', '/zh/admin/products', '/administrator', '/admin-x']) {
      expect(classifyPath(url).kind, url).not.toBe('private')
      const r = await page(url)
      expect(r.status, url).toBe(404)
      expect(r.noindex, url).toBe(true)
      // Có SSR (trang 404), không phải khung rỗng
      expect(r.html, url).not.toContain('<div id="root"></div>')
    }
  })
})

describe('SSR — head', () => {
  const publicPages = [
    ['/', 'vi', '/'],
    ['/en', 'en', '/en'],
    ['/zh/', 'zh', '/zh'],
    ['/products/den-nguyet', 'vi', '/products/den-nguyet'],
    ['/en/products/den-vong', 'en', '/en/products/den-vong'],
    ['/zh/products/den-sum-vay', 'zh', '/zh/products/den-sum-vay'],
  ]

  it.each(publicPages)('%s: đúng 1 title, 1 canonical, 4 alternate, og:*', async (url, lang, canonicalPath) => {
    const r = await page(url)
    expect(r.status).toBe(200)
    expect(r.noindex).toBe(false)
    const head = headOf(r.html)
    expect(count(head, /<title[\s>]/g)).toBe(1)
    expect(count(r.html, /<title[\s>]/g)).toBe(1)
    expect(count(head, /rel="canonical"/g)).toBe(1)
    const canonical = head.match(/<link rel="canonical" href="([^"]+)"/)[1]
    expect(canonical.replace(SITE, '') || '/').toBe(canonicalPath === '/' ? '/' : canonicalPath)
    const alts = [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])
    expect(alts.map((a) => a[0]).sort()).toEqual(['en', 'vi', 'x-default', 'zh-Hans'])
    const byLang = Object.fromEntries(alts)
    expect(byLang['x-default']).toBe(byLang.vi)
    expect(Object.values(byLang).every((h) => h.startsWith(SITE))).toBe(true)
    for (const p of ['og:title', 'og:url', 'og:type', 'og:locale', 'og:description']) {
      expect(count(head, new RegExp(`property="${p}"`, 'g')), p).toBe(1)
    }
    expect(head).toContain(`property="og:url" content="${canonical}"`)
    expect(count(head, /name="description"/g)).toBe(1)
    expect(head).not.toContain('name="robots"')
  })

  it('canonical / hreflang / og:url không mang query string hay fragment', async () => {
    const r = await renderPage({
      repo: createMemoryRepo(),
      config,
      template,
      render,
      url: '/en/products/den-vong?utm_source=x&ref=%22%3E',
      pathname: '/en/products/den-vong',
    })
    expect(r.status).toBe(200)
    const head = headOf(r.html)
    expect(head).toContain('<link rel="canonical" href="https://moc.test/en/products/den-vong" data-seo>')
    expect(head).not.toContain('utm_source')
    const seoTags = head.split('\n').filter((l) => l.includes('data-seo')).join('\n')
    expect(seoTags).not.toMatch(/(canonical|alternate|og:url)[^\n]*\?/)
    expect(seoTags).not.toContain('#')
  })

  it('JSON-LD sản phẩm: Product + BreadcrumbList, giá đã gồm VAT, valueAddedTaxIncluded=true (D-68), url = canonical', async () => {
    const r = await page('/zh/products/den-sum-vay')
    const blocks = [...r.html.matchAll(/<script type="application\/ld\+json" data-seo>(.*?)<\/script>/gs)]
    // §23.2: mỗi khối JSON-LD là một <script> riêng (Product, rồi BreadcrumbList)
    expect(blocks).toHaveLength(2)
    expect(JSON.parse(blocks[1][1])['@type']).toBe('BreadcrumbList')
    const ld = JSON.parse(blocks[0][1])
    expect(ld['@type']).toBe('Product')
    expect(ld.offers.price).toBe(1680000)
    expect(ld.offers.priceSpecification).toMatchObject({ price: 1680000, valueAddedTaxIncluded: true, priceCurrency: 'VND' })
    expect(ld.url).toBe('https://moc.test/zh/products/den-sum-vay')
    expect(ld.offers.url).toBe(ld.url)
    expect(ld.name).toBe('团圆灯组')
  })

  it('trang chủ không có JSON-LD Product', async () => {
    const r = await page('/')
    expect(r.html).not.toMatch(/"@type":"Product"/)
  })

  it.each([['/lo/DEMO-2026-01'], ['/products/khong-co'], ['/abc'], ['/en/lo/DEMO-2026-01']])(
    '%s (noindex): đúng 1 meta robots, 1 title, không canonical/hreflang/JSON-LD/og:url',
    async (url) => {
      const r = await page(url)
      expect(r.noindex).toBe(true)
      expect(count(r.html, /<meta name="robots"/g)).toBe(1)
      expect(count(r.html, /<title[\s>]/g)).toBe(1)
      expect(r.html).not.toContain('rel="canonical"')
      expect(r.html).not.toContain('hreflang')
      expect(r.html).not.toContain('application/ld+json')
      expect(r.html).not.toContain('og:url')
    },
  )

  it('<html lang> chỉ bị thay đúng một lần', async () => {
    const r = await page('/en')
    expect(count(r.html, /<html lang=/g)).toBe(1)
    expect(r.html).toContain('<html lang="en">')
  })
})

describe('SSR — bảo mật / nội dung DB độc', () => {
  const EVIL = 'A</script><script>alert(1)</script><!-- "q" & \u2028 \u2029 \'s <!--app-html--> <!--app-data--> end'

  const evilData = () => ({
    products: [
      {
        ...products[0],
        name: { vi: EVIL, en: EVIL, zh: EVIL },
        description: { vi: EVIL, en: EVIL, zh: EVIL },
        badge: { vi: EVIL },
      },
    ],
    faqEntries: [{ ...faqEntries[0], question: { vi: EVIL }, answer: { vi: EVIL } }],
    batches: [{ ...demoBatches[0], title: { vi: EVIL }, story: { vi: EVIL } }],
  })

  it.each([['/products/den-nguyet'], ['/'], ['/lo/DEMO-2026-01'], ['/en/products/den-nguyet']])(
    '%s: không thoát khỏi script, placeholder không bị chèn lặp, JSON parse lại được',
    async (url) => {
      const r = await page(url, evilData())
      expect(r.status).toBe(200)
      expect(r.html).not.toContain('<script>alert(1)</script>')
      // Chỉ có đúng 1 thẻ __INITIAL_DATA__ và 1 #root
      expect(count(r.html, /window\.__INITIAL_DATA__=/g)).toBe(1)
      expect(count(r.html, /<div id="root">/g)).toBe(1)
      // Placeholder thô không còn sót / không bị nhân bản
      expect(r.html).not.toContain('<!--app-html-->')
      expect(r.html).not.toContain('<!--app-data-->')
      expect(r.html).not.toContain('<!--app-head-->')
      // Số thẻ <script đúng như mong đợi: data + module, cộng 2 khối ld+json ở trang được index
      // (trang chủ: Organization + WebSite; trang sản phẩm: Product + BreadcrumbList).
      // Trang lô noindex (D-44) → không có ld+json.
      const scripts = count(r.html, /<script[\s>]/g)
      expect(scripts).toBe(r.noindex ? 2 : 4)
      // U+2028/2029 thô không nằm trong script
      const m = r.html.match(/<script>window\.__INITIAL_DATA__=(.*?)<\/script>/s)
      expect(m[1]).not.toMatch(/[\u2028\u2029<]/)
      const data = JSON.parse(m[1])
      const all = JSON.stringify(data)
      expect(all).toContain(JSON.stringify(EVIL).slice(1, -1))
    },
  )

  it('HTML parse bằng jsdom giữ nguyên cấu trúc; title hiển thị đúng chuỗi gốc', async () => {
    const r = await page('/products/den-nguyet', evilData())
    const dom = new JSDOM(r.html)
    const doc = dom.window.document
    expect(doc.querySelectorAll('script').length).toBe(4)
    expect(doc.title.startsWith('A</script><script>alert(1)</script>')).toBe(true)
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)
    expect(ld.name).toBe(EVIL)
    const desc = doc.querySelector('meta[name="description"]').getAttribute('content')
    expect(desc).toBe(EVIL)
    const code = [...doc.querySelectorAll('script')].find((el) => el.textContent.startsWith('window.__INITIAL_DATA__=')).textContent
    const json = JSON.parse(code.replace(/^window\.__INITIAL_DATA__=/, ''))
    expect(json['/products/den-nguyet|vi'].data.item.name).toBe(EVIL)
  })

  it('chuỗi thay thế đặc biệt của String.replace ($&, $`, $\', $$) trong DB được giữ nguyên', async () => {
    const DOLLAR = "Gia $& $` $' $$ $1"
    const r = await page('/products/den-nguyet', {
      products: [{ ...products[0], name: { vi: DOLLAR }, description: { vi: DOLLAR } }],
    })
    const doc = new JSDOM(r.html).window.document
    expect(doc.title.startsWith(DOLLAR)).toBe(true)
    expect(doc.querySelector('h1').textContent).toBe(DOLLAR)
    const json = initialData(r.html)
    expect(json['/products/den-nguyet|vi'].data.item.name).toBe(DOLLAR)
    expect(count(r.html, /<!doctype html>/gi)).toBe(1)
  })

  it.each([
    ['/products/%E0%A4%A'],
    ['/products/%'],
    ['/lo/%ZZ'],
    ['/en/products/%C0%AF'],
    ['//'],
    ['//evil.com/products/den-nguyet'],
    ['/products/../admin'],
    ['/products/..%2Fadmin'],
    ['/en/..'],
    ['/' + 'a'.repeat(8000)],
    ['/products/' + 'x'.repeat(8000)],
    ['/products/den-nguyet%00'],
  ])('URL bất thường %s không gây 500', async (url) => {
    const r = await page(url)
    expect(r.status, url).not.toBe(500)
    expect([200, 404]).toContain(r.status)
    expect(r.html).toContain('<!doctype html>')
  })

  it('URL có dấu nháy/thẻ trong slug không bị phản chiếu thô vào HTML', async () => {
    const r = await page('/products/%22%3E%3Cscript%3Ealert(2)%3C%2Fscript%3E')
    expect(r.status).toBe(404)
    expect(r.html).not.toContain('<script>alert(2)')
  })
})

describe('SSR — __INITIAL_DATA__', () => {
  const expectKeys = async (url, keys) => {
    const r = await page(url)
    const data = initialData(r.html)
    expect(Object.keys(data).sort(), url).toEqual(keys.sort())
    return data
  }

  it('chỉ chứa key trang cần (dataKeysFor)', async () => {
    await expectKeys('/', ['/products|vi', '/site|vi', '/faq|vi'])
    await expectKeys('/en/products/den-vong', ['/products|en', '/site|en', '/products/den-vong|en'])
    await expectKeys('/zh/lo/DEMO-2026-01', ['/products|zh', '/site|zh', '/batches/DEMO-2026-01|zh'])
    await expectKeys('/abc', ['/products|vi', '/site|vi'])
    const route = classifyPath('/en/products/den-vong')
    expect(dataKeysFor(route)).toEqual(['/products', '/site', '/products/den-vong'])
  })

  it('không chứa trường nội bộ (id sản phẩm, status, videoPath, sortOrder, id lô)', async () => {
    const data = {
      products: [{ ...products[0], secretNote: 'NOI-BO' }, { ...products[1], status: 'draft' }],
      batches: [{ ...demoBatches[0], videoPath: 'private/bucket/raw.mp4', note: 'NOI-BO' }],
    }
    for (const url of ['/', '/products/den-nguyet', '/lo/DEMO-2026-01']) {
      const r = await page(url, data)
      const s = r.html.match(/window\.__INITIAL_DATA__=(.*?)<\/script>/s)[1]
      expect(s, url).not.toContain(products[0].id)
      expect(s, url).not.toContain(demoBatches[0].id)
      expect(s, url).not.toContain('"status":"published"')
      expect(s, url).not.toContain('video_published')
      expect(s, url).not.toContain('videoPath')
      expect(s, url).not.toContain('private/bucket')
      expect(s, url).not.toContain('sortOrder')
      expect(s, url).not.toContain('NOI-BO')
      // Sản phẩm draft không lọt vào danh sách footer
      expect(s, url).not.toContain('den-vong')
      // HTML nói chung cũng không lộ
      expect(r.html, url).not.toContain('private/bucket')
      expect(r.html, url).not.toContain(products[0].id)
    }
  })

  it('slug có ký tự đặc biệt: key encode khớp useApi', async () => {
    const slug = 'đèn a&b'
    const r = await page(`/products/${encodeURIComponent(slug)}`, {
      products: [{ ...products[0], slug }],
    })
    expect(r.status).toBe(200)
    const data = initialData(r.html)
    expect(Object.keys(data)).toContain(`/products/${encodeURIComponent(slug)}|vi`)
    // canonical dùng slug đã encode, escape & trong thuộc tính
    expect(headOf(r.html)).not.toMatch(/href="[^"]*&b/)
  })
})

describe('sitemap.xml', () => {
  const get = async (data, cfg = config) => {
    const res = await request(createApp({ repo: createMemoryRepo(data), config: cfg })).get('/sitemap.xml')
    return res
  }
  const { DOMParser } = new JSDOM('').window
  const parse = (text) => new DOMParser().parseFromString(text, 'application/xml')

  it('XML hợp lệ, escape & trong slug và URL gốc, có lastmod khi có updatedAt', async () => {
    const data = {
      products: [
        { ...products[0], slug: 'a&b<c', updatedAt: '2026-09-01T10:00:00.000Z' },
        { ...products[1] }, // không updatedAt
        { ...products[2], status: 'draft', slug: 'nhap' },
        { ...products[0], id: 'x', slug: 'an', status: 'hidden' },
      ],
    }
    const res = await get(data, { publicSiteUrl: 'https://moc.test/?a=1&b=2' })
    expect(res.status).toBe(200)
    const doc = parse(res.text)
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(res.text).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/)
    const urls = [...doc.getElementsByTagName('url')]
    expect(urls).toHaveLength(12 * 3) // trang chủ + cửa hàng + 6 trang chính sách/liên hệ + 2 bộ sưu tập + 2 sản phẩm Published
    const locs = urls.map((u) => u.getElementsByTagName('loc')[0].textContent)
    expect(locs.some((l) => l.includes('/nhap'))).toBe(false)
    expect(locs.some((l) => l.endsWith('/an'))).toBe(false)
    const withLastmod = urls.filter((u) => u.getElementsByTagName('lastmod').length)
    expect(withLastmod).toHaveLength(3) // chỉ sản phẩm có updatedAt
    for (const u of withLastmod) {
      expect(u.getElementsByTagName('lastmod')[0].textContent).toBe('2026-09-01T10:00:00.000Z')
      expect(u.getElementsByTagName('loc')[0].textContent).toContain(encodeURIComponent('a&b<c'))
    }
    // mỗi url có 4 xhtml:link
    for (const u of urls) expect(u.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')).toHaveLength(4)
  })

  it('chỉ trang chủ + sản phẩm Published; không /lo/, trang riêng tư, admin', async () => {
    const res = await get()
    const doc = parse(res.text)
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    const locs = [...doc.getElementsByTagName('loc')].map((l) => l.textContent)
    expect(locs).toHaveLength((10 + products.length) * 3) // + cửa hàng + 6 trang chính sách/liên hệ + 2 bộ sưu tập
    for (const bad of ['/lo/', '/login', '/register', '/account', '/admin', '/forgot-password', '/reset-password']) {
      expect(res.text).not.toContain(bad)
    }
    expect(locs.every((l) => l.startsWith(SITE))).toBe(true)
  })

  it('không có sản phẩm nào → vẫn XML hợp lệ với trang chủ và cửa hàng', async () => {
    const res = await get({ products: [] })
    const doc = parse(res.text)
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(doc.getElementsByTagName('url')).toHaveLength(30) // trang chủ + cửa hàng + 6 trang chính sách/liên hệ + 2 bộ sưu tập × 3 ngôn ngữ
  })

  it('robots.txt: text/plain, không Disallow trang riêng tư công khai khác, trỏ sitemap tuyệt đối', async () => {
    const res = await request(createApp({ repo: createMemoryRepo(), config })).get('/robots.txt')
    expect(res.status).toBe(200)
    expect(res.type).toBe('text/plain')
    const disallow = res.text.split('\n').filter((l) => l.startsWith('Disallow:'))
    // /admin$ + /admin/: không chặn nhầm đường dẫn khác bắt đầu bằng /admin
    expect(disallow.sort()).toEqual(['Disallow: /admin$', 'Disallow: /admin/', 'Disallow: /api/'])
    expect(res.text).toMatch(/^User-agent: \*/m)
    expect(res.text).toMatch(/^Sitemap: https:\/\/moc\.test\/sitemap\.xml$/m)
  })
})

describe('createApp với web', () => {
  const web = (req, res) => res.type('text/plain').send('WEB')
  const app = () => createApp({ repo: createMemoryRepo(), config, web })

  it('/api/khong-co vẫn 404 JSON (không rơi vào web)', async () => {
    const res = await request(app()).get('/api/khong-co')
    expect(res.status).toBe(404)
    expect(res.type).toBe('application/json')
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(res.text).not.toBe('WEB')
  })

  it('/api/health vẫn do API xử lý', async () => {
    const res = await request(app()).get('/api/health')
    expect(res.body).toEqual({ ok: true })
  })

  it('/sitemap.xml và /robots.txt do seoRouter xử lý', async () => {
    const s = await request(app()).get('/sitemap.xml')
    expect(s.type).toBe('application/xml')
    expect(s.text).toContain('<urlset')
    const r = await request(app()).get('/robots.txt')
    expect(r.text).toContain('Sitemap:')
  })

  it('/abc, /, /en/products/x rơi vào web', async () => {
    for (const url of ['/abc', '/', '/en/products/x', '/login']) {
      const res = await request(app()).get(url)
      expect(res.text, url).toBe('WEB')
    }
  })

  it('web ném lỗi → errorHandler 500 JSON không lộ thông điệp', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = () => {
      throw new Error('SECRET-WEB')
    }
    const res = await request(createApp({ repo: createMemoryRepo(), config, web: bad })).get('/abc')
    expect(res.status).toBe(500)
    expect(res.text).not.toContain('SECRET-WEB')
  })
})
