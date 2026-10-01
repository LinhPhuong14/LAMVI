// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { cleanup, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: { items: [], itemCount: 0 } }),
}
const hdr = () => document.querySelector('header.nav')
const cta = () => hdr().querySelector('.nav-cta')
const T = {
  vi: { login: 'Đăng nhập', register: 'Tạo tài khoản' },
  en: { login: 'Sign in', register: 'Create an account' },
  zh: { login: '登录', register: '创建账户' },
}
const pre = (l) => (l === 'vi' ? '' : `/${l}`)

describe('AuthHeader CTA', () => {
  const cases = [
    ['/login', 'register'],
    ['/register', 'login'],
    ['/forgot-password', 'login'],
    ['/reset-password', 'login'],
    ['/auth/callback', 'login'],
  ]
  for (const lang of ['vi', 'en', 'zh']) {
    for (const [p, target] of cases) {
      it(`${lang}${p} -> ${target}`, async () => {
        mockApi(base)
        renderAt(`${pre(lang)}${p}`)
        await waitFor(() => expect(hdr()).toBeTruthy())
        expect(hdr().classList.contains('nav-auth')).toBe(true)
        expect(hdr().querySelector('.nav-links')).toBeNull()
        expect(cta().getAttribute('href')).toBe(`${pre(lang)}/${target}`)
        expect(cta().textContent).toBe(T[lang][target])
        expect(document.querySelector('footer.auth-foot')).toBeTruthy()
        expect(document.querySelector('footer.footer')).toBeNull()
        cleanup()
      })
    }
  }
})

describe('AuthHeader language switcher', () => {
  it('giữ đường dẫn và ?next=', async () => {
    mockApi(base)
    renderAt('/login?next=%2Faccount')
    await waitFor(() => expect(hdr()).toBeTruthy())
    const links = [...hdr().querySelectorAll('.lang-switch a')]
    const href = (t) => links.find((a) => a.textContent === t).getAttribute('href')
    expect(href('EN')).toBe('/en/login?next=%2Faccount')
    expect(href('ZH')).toBe('/zh/login?next=%2Faccount')
    expect(href('VI')).toBe('/login?next=%2Faccount')
  })
  it('từ /en/register sang VI/ZH', async () => {
    mockApi(base)
    renderAt('/en/register')
    await waitFor(() => expect(hdr()).toBeTruthy())
    const links = [...hdr().querySelectorAll('.lang-switch a')]
    expect(links.find((a) => a.textContent === 'VI').getAttribute('href')).toBe('/register')
    expect(links.find((a) => a.textContent === 'ZH').getAttribute('href')).toBe('/zh/register')
  })
})

describe('Header theo loại trang', () => {
  for (const p of ['/', '/cart']) {
    it(`${p} dùng SiteHeader/SiteFooter`, async () => {
      mockApi(base)
      renderAt(p)
      await waitFor(() => expect(hdr()).toBeTruthy())
      expect(hdr().querySelector('.nav-links')).toBeTruthy()
      expect(hdr().classList.contains('nav-auth')).toBe(false)
      expect(document.querySelector('footer.footer')).toBeTruthy()
      expect(document.querySelector('footer.auth-foot')).toBeNull()
    })
  }
  it('/account không có header/footer của site hay auth', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }))
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile: { id: 'u1', email: 'an@example.com', fullName: 'An', phone: null, preferredLocale: 'vi', role: 'customer' } } }),
      'GET /me/orders': () => ({ body: { items: [] } }),
    })
    renderAt('/account')
    await waitFor(() => expect(document.querySelector('.page-app')).toBeTruthy())
    expect(document.querySelector('header.nav')).toBeNull()
    expect(document.querySelector('footer.footer')).toBeNull()
    expect(document.querySelector('footer.auth-foot')).toBeNull()
  })
  it('/login/ (dấu / cuối) vẫn dùng AuthHeader', async () => {
    mockApi(base)
    renderAt('/login/')
    await waitFor(() => expect(hdr()).toBeTruthy())
    expect(hdr().classList.contains('nav-auth')).toBe(true)
    expect(cta().getAttribute('href')).toBe('/register')
    expect(document.querySelector('footer.auth-foot')).toBeTruthy()
  })
  it('/en/login/ dùng AuthHeader, CTA -> /en/register', async () => {
    mockApi(base)
    renderAt('/en/login/')
    await waitFor(() => expect(hdr()).toBeTruthy())
    expect(cta().getAttribute('href')).toBe('/en/register')
  })
})

describe('Scene', () => {
  const src = readFileSync('src/components/Scene.jsx', 'utf8')
  const photos = [...src.matchAll(/photo:\s*'([\w-]+)'/g)].map((m) => m[1])
  it('đọc được danh sách ảnh', () => {
    expect(photos).toContain('bay-green')
    expect(photos).toContain('hills-gold')
  })
  it('mọi ảnh nền có bản 640 và 1280', () => {
    for (const p of new Set(photos))
      for (const w of [640, 1280]) expect(existsSync(`public/images/scene/${p}-${w}.webp`), `${p}-${w}`).toBe(true)
  })
  it('ảnh khói tồn tại', () => {
    for (const m of src.matchAll(/src:\s*'([\w-]+)'/g)) expect(existsSync(`public/images/scene/${m[1]}.webp`), m[1]).toBe(true)
    expect(existsSync('public/images/scene/sky-lantern-glow.webp')).toBe(true)
  })
  it('story->bay-green, lookbook->hills-gold', () => {
    expect(src).toMatch(/story:\s*\{\s*photo:\s*'bay-green'/)
    expect(src).toMatch(/lookbook:\s*\{\s*photo:\s*'hills-gold'/)
  })
  it('/login không render img.scene-photo', async () => {
    mockApi(base)
    renderAt('/login')
    await waitFor(() => expect(document.querySelector('.scene-auth')).toBeTruthy())
    expect(document.querySelector('img.scene-photo')).toBeNull()
  })
  it('/cart vẫn render ảnh', async () => {
    mockApi(base)
    renderAt('/cart')
    await waitFor(() => expect(document.querySelector('.scene-cart img.scene-photo')).toBeTruthy())
  })
})

describe('CREDITS.md', () => {
  const md = readFileSync('public/images/scene/CREDITS.md', 'utf8')
  for (const n of ['bay-green', 'hills-gold']) {
    it(`${n} có CC0`, () => {
      const rows = md.split('\n').filter((l) => l.includes(`${n}-1280.webp`) && l.includes(`${n}-640.webp`))
      expect(rows.length).toBe(1)
      expect(rows[0]).toMatch(/CC0 1\.0/)
    })
  }
})
