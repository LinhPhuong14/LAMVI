// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: { items: [], itemCount: 0 } }),
}
const page = () => document.querySelector('.page')
const pre = (l) => (l === 'vi' ? '' : `/${l}`)

afterEach(cleanup)

describe('LocaleLayout: class page-auth', () => {
  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback']
  for (const lang of ['vi', 'en', 'zh']) {
    for (const p of authPaths) {
      it(`${lang}${p} có page-auth và header/footer auth`, async () => {
        mockApi(base)
        renderAt(`${pre(lang)}${p}`)
        await waitFor(() => expect(document.querySelector('header.nav')).toBeTruthy())
        expect(page().classList.contains('page-auth')).toBe(true)
        expect(page().classList.contains('page-app')).toBe(false)
        expect(document.querySelector('header.nav').classList.contains('nav-auth')).toBe(true)
        expect(document.querySelector('footer.auth-foot')).toBeTruthy()
      })
    }
  }

  it('đường dẫn có dấu / cuối vẫn nhận page-auth', async () => {
    mockApi(base)
    renderAt('/login/')
    await waitFor(() => expect(document.querySelector('header.nav')).toBeTruthy())
    expect(page().classList.contains('page-auth')).toBe(true)
  })

  for (const p of ['/', '/shop', '/cart', '/faq']) {
    it(`${p} (trang thường) không có page-auth`, async () => {
      mockApi(base)
      renderAt(p)
      await waitFor(() => expect(document.querySelector('header.nav')).toBeTruthy())
      expect(page().classList.contains('page-auth')).toBe(false)
      expect(document.querySelector('header.nav').classList.contains('nav-auth')).toBe(false)
      expect(document.querySelector('footer.auth-foot')).toBeNull()
    })
  }

  it('/account (trang app) không có page-auth', async () => {
    localStorage.setItem(
      'moc.session',
      JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }),
    )
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile: { id: 'u1', email: 'an@example.com', fullName: 'An', phone: null, preferredLocale: 'vi', role: 'customer' } } }),
      'GET /may/history': () => ({ body: { items: [] } }),
    })
    renderAt('/account')
    await waitFor(() => expect(page().classList.contains('page-app')).toBe(true))
    expect(page().classList.contains('page-auth')).toBe(false)
    localStorage.clear()
  })
})

describe('CSS glass cho trang auth', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/App.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] }))
  const rulesFor = (sel) => rules.filter((r) => r.sels.includes(sel))

  for (const sel of ['.page-auth .nav-auth', '.page-auth .auth-foot']) {
    it(`${sel} có backdrop-filter và tiền tố -webkit-`, () => {
      const r = rulesFor(sel).filter((x) => /backdrop-filter:\s*blur/.test(x.body))
      expect(r.length).toBeGreaterThan(0)
      expect(r.some((x) => /-webkit-backdrop-filter:\s*blur/.test(x.body))).toBe(true)
    })
  }

  it('.nav-auth không dùng position fixed (giữ sticky kế thừa từ .nav)', () => {
    for (const r of rulesFor('.page-auth .nav-auth')) expect(r.body).not.toMatch(/position:\s*fixed/)
    for (const r of rulesFor('.nav-auth')) expect(r.body).not.toMatch(/position:\s*fixed/)
  })

  it('.auth-foot không fixed/sticky; .page-auth là mốc cho footer absolute', () => {
    for (const r of rulesFor('.page-auth .auth-foot')) expect(r.body).not.toMatch(/position:\s*(fixed|sticky)/)
    expect(css).toMatch(/\.page\s*\{[^}]*position:\s*relative/)
  })

  it('có @supports dự phòng khi thiếu backdrop-filter, nền đục hơn', () => {
    const blocks = [...css.matchAll(/@supports\s+not\s*\(\(backdrop-filter[^{]*\{([\s\S]*?\})\s*\}/g)]
    const m = blocks.find((b) => b[1].includes('.page-auth'))
    expect(m, 'không tìm thấy @supports cho auth').toBeTruthy()
    expect(m[1]).toMatch(/\.page-auth \.nav-auth/)
    expect(m[1]).toMatch(/\.page-auth \.auth-foot/)
    const alpha = (s) => Number(s.match(/rgba\([^)]*,\s*([\d.]+)\)/)[1])
    const glass = rulesFor('.page-auth .nav-auth').find((x) => /^\s*background:/m.test(x.body))
    expect(alpha(m[1])).toBeGreaterThan(alpha(glass.body))
  })

  it('mọi quy tắc glass đều nằm dưới .page-auth (không rò sang trang khác)', () => {
    for (const r of rules) {
      if (r.sels.some((s) => /(^|\s)\.(nav-auth|auth-foot)(\s|$)/.test(s) && !s.startsWith('.page-auth'))) {
        expect(r.body).not.toMatch(/backdrop-filter/)
      }
    }
  })
})
