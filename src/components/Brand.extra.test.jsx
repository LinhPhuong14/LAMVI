// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho D-62: đổi tên thương hiệu "MỘC" → "LAMVI" (viết liền, không dấu). Không dùng "MỘC", không dùng "LÂM VỊ".
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'
import { S as ADMIN_S } from '../admin/strings.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '/', en: '/en', zh: '/zh' }
const ROOT = process.cwd()
const handlers = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: faqVi }),
}

// Tên cũ / sai: MỘC, Mộc (viết hoa đầu — tên riêng), LÂM VỊ, Lâm Vị/Lâm vị, và mọi biến thể Latin khác "LAMVI" (Lamvi, Lam Vi, LAM VI…).
// Chữ "mộc" viết thường là từ chung (Trầm mộc, mộc bản) → không tính là thương hiệu, liệt kê riêng ở test dưới.
const OLD_BRAND = /MỘC|Mộc(?! bản)|LÂM VỊ|Lâm [Vv]ị|lâm vị/u
const WRONG_LATIN = /\b(?!LAMVI\b)[Ll][Aa][Mm][ _-]?[Vv][Ii]\b/
const badLines = (text) =>
  text
    .normalize('NFC')
    .split('\n')
    .flatMap((l, i) => (OLD_BRAND.test(l) || WRONG_LATIN.test(l) ? [`${i + 1}: ${l.trim().slice(0, 140)}`] : []))

const SKIP_DIRS = new Set(['node_modules', 'dist', 'test'])
const isTest = (f) => /\.test\.[jt]sx?$/.test(f)
function walk(dir, exts) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...walk(p, exts))
    } else if (exts.test(name) && !isTest(name)) out.push(p)
  }
  return out
}
const SOURCE_FILES = [
  ...walk(join(ROOT, 'src'), /\.(jsx?|css|json|html|svg)$/),
  ...walk(join(ROOT, 'server'), /\.(jsx?|json|html)$/),
  ...walk(join(ROOT, 'api'), /\.(jsx?|json)$/),
  join(ROOT, 'index.html'),
  ...readdirSync(join(ROOT, 'public'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => join(ROOT, 'public', f)),
]

describe('D-62: mã nguồn không còn tên thương hiệu cũ', () => {
  it('danh sách file quét không rỗng và có các file chính', () => {
    const rel = SOURCE_FILES.map((f) => relative(ROOT, f))
    for (const f of ['index.html', 'server/ssr.js', 'server/may/service.js', 'src/components/SiteHeader.jsx', 'src/i18n/messages/vi.js', 'api/index.js'])
      expect(rel).toContain(f)
  })

  it('src/**, server/**, api/**, index.html, public/*.svg (không kể test): không có MỘC/Mộc/LÂM VỊ/Lâm Vị hay biến thể Latin sai', () => {
    const hits = {}
    for (const f of SOURCE_FILES) {
      const b = badLines(readFileSync(f, 'utf8'))
      if (b.length) hits[relative(ROOT, f)] = b
    }
    expect(hits).toEqual({})
  })

  it('chữ "mộc" viết thường còn lại chỉ là từ chung đã biết (Trầm mộc), không phải tên thương hiệu', () => {
    const ALLOWED = /Trầm mộc|mộc bản|gỗ mộc|thợ mộc/gu
    const hits = []
    for (const f of SOURCE_FILES) {
      readFileSync(f, 'utf8')
        .normalize('NFC')
        .split('\n')
        .forEach((l, i) => {
          if (/mộc/iu.test(l.replace(ALLOWED, ''))) hits.push(`${relative(ROOT, f)}:${i + 1}: ${l.trim().slice(0, 120)}`)
        })
    }
    expect(hits).toEqual([])
  })
})

// Duyệt mọi chuỗi trong object thông điệp
function strings(obj, prefix = '') {
  if (typeof obj === 'string') return [[prefix, obj]]
  if (Array.isArray(obj)) return obj.flatMap((v, i) => strings(v, `${prefix}[${i}]`))
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k))
  return []
}

describe('D-62: i18n vi/en/zh', () => {
  it.each(['vi', 'en', 'zh'])('%s: không giá trị nào có tên cũ hoặc biến thể sai của LAMVI', (lang) => {
    const bad = strings(MESSAGES[lang]).filter(([, s]) => OLD_BRAND.test(s.normalize('NFC')) || WRONG_LATIN.test(s))
    expect(bad).toEqual([])
  })

  it.each(['vi', 'en', 'zh'])('%s: meta.title, meta.productTitle, footer.copyright, maintenance.title chứa "LAMVI"', (lang) => {
    const m = MESSAGES[lang]
    expect(m.meta.title).toContain('LAMVI')
    expect(m.meta.productTitle).toContain('LAMVI')
    expect(m.meta.productTitle).toContain('{name}')
    expect(m.footer.copyright).toContain('LAMVI')
    expect(m.maintenance.title).toContain('LAMVI')
  })

  it('cùng tập key có nhắc thương hiệu ở cả ba ngôn ngữ (không sót bản dịch)', () => {
    const keys = (lang) =>
      strings(MESSAGES[lang])
        .filter(([, s]) => s.includes('LAMVI'))
        .map(([k]) => k)
        .sort()
    expect(keys('en')).toEqual(keys('vi'))
    expect(keys('zh')).toEqual(keys('vi'))
  })

  it('admin strings: tiêu đề "Quản trị LAMVI", không còn tên cũ', () => {
    expect(ADMIN_S.title).toBe('Quản trị LAMVI')
    const bad = strings(ADMIN_S).filter(([, s]) => OLD_BRAND.test(s.normalize('NFC')))
    expect(bad).toEqual([])
  })
})

describe('D-62: trang chủ (client) /, /en, /zh', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each(['vi', 'en', 'zh'])('%s: logo header, ấn triện dọc, footer, tiêu đề document đều là LAMVI', async (lang) => {
    mockApi(handlers)
    const { container } = renderAt(PREFIX[lang])

    // Header: link về trang chủ, tên truy cập được "LAMVI", con dấu ghi LAMVI
    const logo = screen.getByRole('link', { name: 'LAMVI' })
    expect(logo).toHaveClass('nav-mark')
    expect(logo).toHaveAttribute('href', PREFIX[lang])
    expect(logo.querySelector('.seal').textContent).toBe('LAMVI')

    // Ấn triện dọc
    const vseal = container.querySelector('.hero-seal .vseal')
    expect([...vseal.children].map((c) => c.textContent)).toEqual(['L', 'A', 'M', 'V', 'I'])

    // Footer: Seal LAMVI + chữ lớn BrandHover
    const footer = container.querySelector('footer.footer')
    expect(footer.querySelector('.footer-brand .seal').textContent).toBe('LAMVI')
    const brand = footer.querySelector('.footer-brandmark svg.brand-hover')
    expect(brand).not.toBeNull()
    expect(brand.textContent).toContain('LAMVI')
    expect(footer.textContent).toContain(MESSAGES[lang].footer.copyright)

    // Tiêu đề document
    await waitFor(() => expect(document.title).toBe(MESSAGES[lang].meta.title))
    expect(document.title).toContain('LAMVI')

    // Toàn bộ DOM không còn tên cũ
    const html = container.innerHTML.normalize('NFC')
    expect(html).not.toMatch(OLD_BRAND)
    expect(document.title).not.toMatch(OLD_BRAND)
  })
})

describe('D-62: admin & IT dashboard hiển thị LAMVI', () => {
  const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'x@lamvi.test' } }
  const me = (role) => () => ({ body: { profile: { id: 'u1', email: 'x@lamvi.test', role, preferredLocale: 'vi', fullName: 'A' } } })
  beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('admin: ấn triện "LAMVI", tiêu đề "Quản trị LAMVI", không có tên cũ', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/products': () => ({ body: { items: [] } }) })
    const { container } = renderAt('/admin/products')
    expect(await screen.findByText('Quản trị LAMVI')).toBeInTheDocument()
    // Thanh bên dùng ấn triện son như dashboard tài khoản (design-rules §12)
    expect(container.querySelector('.admin-brand .seal').textContent).toBe('LAMVI')
    expect(container.innerHTML.normalize('NFC')).not.toMatch(OLD_BRAND)
    await waitFor(() => expect(document.title).toContain('LAMVI'))
  })

  it('IT dashboard: ấn triện "LAMVI", không có tên cũ', async () => {
    mockApi({
      'GET /me': me('it'),
      'GET /it/health': () => ({
        body: {
          status: 'ok',
          checks: [],
          system: { version: '0', commit: 'x', node: 'v22', env: 'test', startedAt: '2026-09-28T00:00:00Z', uptimeSec: 1, memoryMb: { rss: 1, heapUsed: 1 }, dataMode: 'memory' },
          maintenance: { enabled: false, updatedAt: null, updatedBy: null },
        },
      }),
      'GET /it/metrics': () => ({ body: { range: '24h', totals: { count: 0, errorRate: 0, p95Ms: null, avgMs: null }, routes: [] } }),
      'GET /it/errors': () => ({ body: { items: [] } }),
    })
    const { container } = renderAt('/it')
    await waitFor(() => expect(container.querySelector('.admin-brand .seal')).not.toBeNull())
    expect(container.querySelector('.admin-brand .seal').textContent).toBe('LAMVI')
    expect(container.innerHTML.normalize('NFC')).not.toMatch(OLD_BRAND)
  })
})
