// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho giao diện kính mờ + sáng/tối + nền mây khói của dashboard tài khoản (T-35)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'Nguyễn An', phone: null, preferredLocale: 'vi', role: 'customer' }
const emptyCart = { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10 }
const THEME = 'moc.dashTheme'

function login() {
  localStorage.setItem('moc.session', JSON.stringify(session))
}

function api(extra = {}) {
  return mockApi({
    'GET /products': () => ({ body: productsVi }),
    'GET /faq': () => ({ body: faqVi }),
    'GET /me': () => ({ body: { profile } }),
    'GET /may/history': () => ({ body: { items: [] } }),
    'GET /cart': () => ({ body: emptyCart }),
    'POST /auth/logout': () => ({ status: 204 }),
    'POST /auth/login': () => ({ body: session }),
    ...extra,
  })
}

const dash = () => document.querySelector('.dash')
const themeBtn = () => document.querySelector('button.dash-theme')
const tablist = () => screen.getByRole('tablist')
const tab = (name) => within(tablist()).getByRole('tab', { name: new RegExp(name) })

async function open(p = '/account') {
  login()
  api()
  const r = renderAt(p)
  await screen.findByRole('tablist')
  return r
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Nút giao diện tối — 3 ngôn ngữ', () => {
  it.each([
    ['/account', 'Giao diện tối', 'Giao diện sáng'],
    ['/en/account', 'Dark mode', 'Light mode'],
    ['/zh/account', '深色模式', '浅色模式'],
  ])('%s: nhãn đúng, aria-pressed đổi, title đổi, không lộ khoá thô', async (p, dark, light) => {
    await open(p)
    const btn = screen.getByRole('button', { name: dark })
    expect(btn).toBe(themeBtn())
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('title', dark)
    fireEvent.click(btn)
    expect(dash()).toHaveAttribute('data-theme', 'dark')
    // Nhãn giữ cố định (nút bật/tắt), trạng thái qua aria-pressed; title gợi ý hành động kế tiếp
    const btn2 = screen.getByRole('button', { name: dark })
    expect(btn2).toHaveAttribute('aria-pressed', 'true')
    expect(btn2).toHaveAttribute('title', light)
    fireEvent.click(btn2)
    expect(dash()).toHaveAttribute('data-theme', 'light')
    expect(document.body.innerHTML).not.toMatch(/account\.theme/)
    expect(document.body.textContent).not.toMatch(/\baccount\.[a-zA-Z]/)
  })

  it('khoá i18n themeDark/themeLight có đủ ở vi/en/zh và khác nhau', async () => {
    for (const l of ['vi', 'en', 'zh']) {
      const m = (await import(`../i18n/messages/${l}.js`)).default
      expect(typeof m.account.themeDark).toBe('string')
      expect(typeof m.account.themeLight).toBe('string')
      expect(m.account.themeDark.length).toBeGreaterThan(0)
      expect(m.account.themeDark).not.toBe(m.account.themeLight)
    }
  })
})

describe('localStorage lỗi / thiếu matchMedia', () => {
  it('getItem ném lỗi với khoá giao diện → không sập, mặc định sáng, bật tắt vẫn chạy', async () => {
    const orig = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (k) {
      if (k === THEME) throw new Error('SecurityError')
      return orig.call(this, k)
    })
    await open()
    expect(dash()).toHaveAttribute('data-theme', 'light')
    fireEvent.click(themeBtn())
    expect(dash()).toHaveAttribute('data-theme', 'dark')
    fireEvent.click(themeBtn())
    expect(dash()).toHaveAttribute('data-theme', 'light')
  })

  it('setItem ném lỗi (hết quota/riêng tư) → không sập, vẫn đổi trong phiên, chuyển tab vẫn giữ', async () => {
    const orig = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (k === THEME) throw new Error('QuotaExceededError')
      return orig.call(this, k, v)
    })
    await open()
    fireEvent.click(themeBtn())
    expect(dash()).toHaveAttribute('data-theme', 'dark')
    fireEvent.click(tab('Hồ sơ'))
    expect(tab('Hồ sơ')).toHaveAttribute('aria-selected', 'true')
    expect(dash()).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(THEME)).toBeNull()
  })

  it('không có window.matchMedia → không sập, mặc định sáng', async () => {
    const orig = window.matchMedia
    delete window.matchMedia
    try {
      await open()
      expect(dash()).toHaveAttribute('data-theme', 'light')
      fireEvent.click(themeBtn())
      expect(dash()).toHaveAttribute('data-theme', 'dark')
    } finally {
      window.matchMedia = orig
    }
  })

  it('giá trị đã lưu "light" thắng thiết bị tối', async () => {
    const orig = window.matchMedia
    window.matchMedia = (q) => ({ matches: q.includes('dark'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
    try {
      localStorage.setItem(THEME, 'light')
      await open()
      expect(dash()).toHaveAttribute('data-theme', 'light')
    } finally {
      window.matchMedia = orig
    }
  })
})

describe('Lưu giao diện qua tab và đăng xuất → đăng nhập', () => {
  it('?tab= chuyển qua lại vẫn tối; mở thẳng ?tab=may vẫn tối', async () => {
    const r = await open()
    fireEvent.click(themeBtn())
    for (const n of ['Đơn hàng', 'Trò chuyện', 'Hồ sơ', 'Tổng quan']) {
      fireEvent.click(tab(n))
      expect(tab(n)).toHaveAttribute('aria-selected', 'true')
      expect(dash()).toHaveAttribute('data-theme', 'dark')
    }
    r.unmount()
    await open('/account?tab=may')
    expect(tab('Trò chuyện')).toHaveAttribute('aria-selected', 'true')
    expect(dash()).toHaveAttribute('data-theme', 'dark')
  })

  it('đăng xuất rồi đăng nhập lại → vẫn tối', async () => {
    const r = await open()
    fireEvent.click(themeBtn())
    fireEvent.click(screen.getByRole('button', { name: /Đăng xuất/ }))
    await waitFor(() => expect(dash()).toBeNull())
    expect(localStorage.getItem('moc.session')).toBeNull()
    expect(localStorage.getItem(THEME)).toBe('dark')
    r.unmount()
    await open()
    expect(dash()).toHaveAttribute('data-theme', 'dark')
  })
})

describe('DashSky', () => {
  it('nằm trong .dash, aria-hidden, không có phần tử focus được, 8 đèn; chỉ ảnh thật, không SVG tự vẽ', async () => {
    await open()
    const sky = document.querySelector('.dash-sky')
    expect(sky).not.toBeNull()
    expect(sky.parentElement).toBe(dash())
    expect(sky).toHaveAttribute('aria-hidden', 'true')
    expect(sky.querySelectorAll('a, button, input, select, textarea, [tabindex], [contenteditable]')).toHaveLength(0)
    expect(sky.querySelectorAll('.dash-rise-lantern')).toHaveLength(8)
    expect(sky.querySelectorAll('svg, .motif-layer')).toHaveLength(0)
    const imgs = [...sky.querySelectorAll('img')]
    expect(imgs.length).toBeGreaterThan(8)
    for (const img of imgs) {
      expect(img.getAttribute('src')).toMatch(/^\/images\/dash\/[\w-]+\.webp$/)
      expect(img.getAttribute('alt')).toBe('')
    }
    expect(sky.textContent.trim()).toBe('')
    expect(document.querySelectorAll('.dash-sky')).toHaveLength(1)
  })

  it('mọi ảnh nền dashboard có trong public/images/dash và có dòng nguồn CC0 trong CREDITS.md', async () => {
    const { existsSync } = await import('node:fs')
    const credits = readFileSync(join(process.cwd(), 'public/images/dash/CREDITS.md'), 'utf8')
    const srcs = [readFileSync(join(process.cwd(), 'src/components/DashSky.jsx'), 'utf8'), readFileSync(join(process.cwd(), 'src/components/DashArt.jsx'), 'utf8'), readFileSync(join(process.cwd(), 'src/styles/pages.css'), 'utf8')].join('\n')
    const files = [...new Set([...srcs.matchAll(/([\w-]+\.webp)/g)].map((m) => m[1]))].filter((f) => srcs.includes(`dash/${f}`) || /DashSky|smoke|sky-|mist/.test(f))
    expect(files.length).toBeGreaterThanOrEqual(5)
    for (const f of files) {
      expect(existsSync(join(process.cwd(), 'public/images/dash', f)), f).toBe(true)
      const row = credits.split('\n').find((l) => l.includes('`' + f + '`'))
      expect(row, f).toBeDefined()
      expect(row).toMatch(/CC0 1\.0/)
    }
  })
})

describe('Bàn phím', () => {
  it('nút giao diện đến được bằng Tab, không nằm trong tablist; mũi tên trong tablist không bị ảnh hưởng', async () => {
    await open()
    const btn = themeBtn()
    expect(btn.tabIndex).toBe(0)
    expect(btn).not.toBeDisabled()
    expect(btn.closest('[role="tablist"]')).toBeNull()
    expect(within(tablist()).getAllByRole('tab')).toHaveLength(4)
    btn.focus()
    expect(document.activeElement).toBe(btn)
    // Mũi tên trên nút giao diện không đổi tab
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(tab('Tổng quan')).toHaveAttribute('aria-selected', 'true')
    // Mũi tên trong tablist vẫn chạy
    tab('Tổng quan').focus()
    fireEvent.keyDown(tab('Tổng quan'), { key: 'ArrowDown' })
    expect(tab('Đơn hàng')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tab('Đơn hàng'))
    fireEvent.keyDown(document.activeElement, { key: 'End' })
    expect(tab('Hồ sơ')).toHaveAttribute('aria-selected', 'true')
    // Bấm Enter/Space trên nút (button gốc → click) vẫn đổi giao diện
    btn.focus()
    fireEvent.click(btn)
    expect(dash()).toHaveAttribute('data-theme', 'dark')
    expect(tab('Hồ sơ')).toHaveAttribute('aria-selected', 'true')
  })
})

// ---------- CSS ----------
const read = (f) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const pages = read('src/styles/pages.css')
const app = read('src/styles/App.css')
const index = read('src/index.css')
const allCss = [index, app, pages].join('\n')

function block(css, selectorRe) {
  const m = css.match(new RegExp(`${selectorRe}\\s*\\{([^{}]*)\\}`))
  return m ? m[1] : null
}

function tokens(body) {
  const out = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

function hex(c) {
  const h = c.replace('#', '')
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16))
}

function lum([r, g, b]) {
  const ch = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

function contrast(a, b) {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('CSS giao diện tối', () => {
  it('mọi var(--x) dùng trong pages.css đều được khai báo (hoặc có giá trị dự phòng)', () => {
    const defined = new Set([...allCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const missing = []
    for (const m of pages.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) if (!m[2] && !defined.has(m[1])) missing.push(m[1])
    expect([...new Set(missing)]).toEqual([])
  })

  it('tương phản WCAG ≥ 4.5 cho các cặp chữ/nền tối thực dùng', () => {
    const dark = tokens(block(pages, "\\.dash\\[data-theme='dark'\\]"))
    const pairs = [
      ['--than', '--diep'],
      ['--than', '--diep-light'],
      ['--than-soft', '--diep'],
      ['--than-soft', '--diep-light'],
      ['--sepia', '--diep'],
      ['--sepia', '--diep-light'],
      ['--son-deep', '--diep-light'],
    ]
    const low = []
    for (const [fg, bg] of pairs) {
      const r = contrast(dark[fg], dark[bg])
      if (r < 4.5) low.push(`${fg} on ${bg}: ${r.toFixed(2)}`)
    }
    // Thẻ kính tối nhất có thể là --diep-deep (glass-strong): chữ phụ vẫn phải đọc được
    for (const fg of ['--than', '--than-soft']) {
      const r = contrast(dark[fg], dark['--diep-deep'])
      if (r < 4.5) low.push(`${fg} on --diep-deep: ${r.toFixed(2)}`)
    }
    const btn = block(pages, "\\.dash\\[data-theme='dark'\\] \\.btn-primary")
    const bg = btn.match(/background:\s*(#[0-9a-f]{3,6})/i)[1]
    const fgc = btn.match(/[^-]color:\s*(#[0-9a-f]{3,6})/i)[1]
    expect(fgc.toLowerCase()).toBe('#fbf7ef')
    const rb = contrast(fgc, bg)
    if (rb < 4.5) low.push(`btn-primary ${fgc} on ${bg}: ${rb.toFixed(2)}`)
    expect(low).toEqual([])
  })

  it('nút chính khi hover (tối) vẫn đạt 4.5:1', () => {
    const btn = block(pages, "\\.dash\\[data-theme='dark'\\] \\.btn-primary")
    const fgc = btn.match(/[^-]color:\s*(#[0-9a-f]{3,6})/i)[1]
    const hover = block(pages, "\\.dash\\[data-theme='dark'\\] \\.btn-primary:hover")
    const hb = hover.match(/background:\s*(#[0-9a-f]{3,6})/i)[1]
    expect(contrast(fgc, hb)).toBeGreaterThanOrEqual(4.5)
  })

  it('tối khai báo lại các bí danh cũ mà thành phần dùng chung dựa vào', () => {
    const dark = tokens(block(pages, "\\.dash\\[data-theme='dark'\\]"))
    const rootBody = block(index, ':root')
    const rootTokens = tokens(rootBody)
    // Bí danh ở :root trỏ về token khác (var(--x)) sẽ bị "đóng băng" giá trị sáng → phải khai báo lại
    const aliases = Object.entries(rootTokens)
      .filter(([, v]) => {
        const target = v.match(/^var\((--[\w-]+)\)$/)?.[1]
        return target && target in dark
      })
      .map(([k]) => k)
    expect(aliases.length).toBeGreaterThan(5)
    const notRedefined = aliases.filter((k) => !(k in dark))
    expect(notRedefined).toEqual([])
  })

  it('giảm chuyển động tắt .dash-smoke và .dash-rise', () => {
    const reduce = [...pages.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n')
    expect(reduce).toMatch(/\.dash-smoke\s*\{[^}]*animation:\s*none/)
    expect(reduce).toMatch(/\.dash-rise\s*\{[^}]*display:\s*none/)
  })

  it('backdrop-filter không bao giờ trên .dash-side/.dash-tabs và chỉ trên phần tử cuộn cùng trang', () => {
    const allowed = /^\.dash-(top|stats|card|promo)$/
    for (const m of allCss.matchAll(/([^{}]+)\{[^{}]*backdrop-filter[^{}]*\}/g)) {
      const sels = m[1].split(',').map((s) => s.trim())
      for (const s of sels) {
        expect(s).not.toMatch(/dash-side|dash-tabs/)
        if (/^\.dash/.test(s)) expect(s).toMatch(allowed)
      }
    }
  })

  it('có @supports dự phòng khi không hỗ trợ backdrop-filter, tăng độ đục', () => {
    const m = pages.match(/@supports\s+not\s*\(([\s\S]*?)\)\s*\{([\s\S]*?)\n\}/)
    expect(m).not.toBeNull()
    expect(m[1]).toMatch(/backdrop-filter/)
    expect(m[1]).toMatch(/-webkit-backdrop-filter/)
    expect(m[2]).toMatch(/\.dash-card/)
    expect(m[2]).toMatch(/background(-color)?:\s*var\(--glass-strong\)/)
  })

  it('không phần tử position: fixed/sticky nào có backdrop-filter trong src/styles và index.css', () => {
    for (const m of allCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/backdrop-filter/.test(m[2])) expect(m[2]).not.toMatch(/position:\s*(fixed|sticky)/)
    }
    // Và các selector được làm mờ không được đặt fixed/sticky ở bất kỳ quy tắc nào khác
    const blurred = new Set()
    for (const m of allCss.matchAll(/([^{}]+)\{[^{}]*backdrop-filter[^{}]*\}/g)) for (const s of m[1].split(',')) blurred.add(s.trim())
    for (const m of allCss.matchAll(/([^{}]+)\{([^{}]*position:\s*(?:fixed|sticky)[^{}]*)\}/g)) {
      for (const s of m[1].split(',')) expect(blurred.has(s.trim())).toBe(false)
    }
  })
})
