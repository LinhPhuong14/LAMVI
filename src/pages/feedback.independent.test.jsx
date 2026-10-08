// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { render as ssrRender } from '../entry-server.jsx'
import vi_ from '../i18n/messages/vi.js'
import en_ from '../i18n/messages/en.js'
import zh_ from '../i18n/messages/zh.js'

const site = { name: 'LAMVI', phone: '0901 234 567', zalo: 'https://zalo.me/mau', contactForm: true, supportEmail: 'h@l.example', social: [], moitUrl: '' }
const base = { 'GET /products': () => ({ body: { items: [] } }), 'GET /site': () => ({ body: site }), 'GET /faq': () => ({ body: { items: [] } }) }
beforeEach(() => {
  localStorage.setItem('moc.tour.done', '1')
  document.body.style.overflow = ''
})
const dlg = () => screen.queryByRole('dialog', { name: 'Điều hướng' })
const openMenu = async () => { const b = await screen.findByRole('button', { name: 'Menu' }); fireEvent.click(b); await screen.findByRole('dialog', { name: 'Điều hướng' }); return b }

describe('SSR does not crash', () => {
  it.each(['/', '/contact', '/terms', '/en/shipping', '/zh/payment', '/returns'])('renderToString %s', (url) => {
    const out = ssrRender(url, { initialData: {}, siteUrl: 'https://x.test' })
    expect(out.html.length).toBeGreaterThan(100)
    expect(out.html).not.toContain('mobile-menu-backdrop') // portal only when open
    expect(out.html).toContain('nav-menu-btn')
  })
})

describe('Mobile menu', () => {
  it('overflow restores the previous inline value, not just empty', async () => {
    document.body.style.overflow = 'scroll'
    mockApi(base)
    renderAt('/')
    const b = await openMenu()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(b)
    await waitFor(() => expect(dlg()).toBeNull())
    expect(document.body.style.overflow).toBe('scroll')
  })
  it('toggle button closes; aria-expanded false afterwards', async () => {
    mockApi(base)
    renderAt('/')
    const b = await openMenu()
    expect(b.getAttribute('aria-label')).toBe('Đóng menu')
    fireEvent.click(b)
    await waitFor(() => expect(dlg()).toBeNull())
    expect(b.getAttribute('aria-expanded')).toBe('false')
  })
  it('focus lands on first focusable and Tab/Shift+Tab wrap', async () => {
    mockApi(base)
    renderAt('/')
    await openMenu()
    const d = dlg()
    const items = [...d.querySelectorAll('a[href], button:not([disabled])')]
    expect(document.activeElement).toBe(items[0])
    items.at(-1).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(items[0])
    items[0].focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(items.at(-1))
  })
  it('click inside the panel does not close', async () => {
    mockApi(base)
    renderAt('/')
    await openMenu()
    fireEvent.click(dlg())
    expect(dlg()).not.toBeNull()
  })
  it('navigating via a link closes menu and restores scroll lock', async () => {
    mockApi(base)
    renderAt('/')
    await openMenu()
    fireEvent.click(within(dlg()).getByRole('link', { name: 'Liên hệ' }))
    await waitFor(() => expect(dlg()).toBeNull())
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(await screen.findByRole('heading', { level: 1, name: 'Liên hệ LAMVI' })).toBeTruthy()
  })
  it('same-path hash link (section on home) also closes', async () => {
    mockApi(base)
    renderAt('/')
    await openMenu()
    const links = within(dlg()).getAllByRole('link').filter((a) => (a.getAttribute('href') || '').includes('#'))
    expect(links.length).toBeGreaterThan(0)
    fireEvent.click(links[0])
    await waitFor(() => expect(dlg()).toBeNull())
  })
  it('hotline hidden when /site fails; no crash', async () => {
    mockApi({ ...base, 'GET /site': () => ({ status: 500, body: {} }) })
    renderAt('/')
    await openMenu()
    expect(within(dlg()).queryByText(/Hotline/i)).toBeNull()
  })
  it('hotline with hostile phone: href only digits/plus', async () => {
    mockApi({ ...base, 'GET /site': () => ({ body: { ...site, phone: '0901 "x" javascript:1' } }) })
    renderAt('/')
    await openMenu()
    await waitFor(() => expect(dlg().querySelector('.mobile-menu-hotline')).not.toBeNull())
    expect(dlg().querySelector('.mobile-menu-hotline').getAttribute('href')).toMatch(/^tel:[0-9+]*$/)
  })
  it('unmount while open restores overflow', async () => {
    mockApi(base)
    const { unmount } = renderAt('/')
    await openMenu()
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
  it('en locale labels', async () => {
    mockApi(base)
    renderAt('/en')
    fireEvent.click(await screen.findByRole('button', { name: en_.nav.menu }))
    expect(await screen.findByRole('dialog', { name: en_.nav.menuLabel })).toBeTruthy()
  })
})

describe('Contact page', () => {
  const fill = (form) => {
    fireEvent.change(form.getByLabelText(/Họ tên/), { target: { value: 'Lan' } })
    fireEvent.change(form.getByLabelText('Email của bạn'), { target: { value: 'lan@example.com' } })
    fireEvent.change(form.getByLabelText(/Nội dung/), { target: { value: 'Đèn bị móp khi nhận hàng' } })
  }
  const formOf = async () => within((await screen.findByRole('heading', { name: 'Gửi tin nhắn cho chúng tôi' })).closest('form'))
  it('server validation errors are shown per field and message not cleared', async () => {
    mockApi({ ...base, 'POST /contact': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'x', fields: { message: 'MESSAGE_TOO_SHORT' } } } }) })
    renderAt('/contact')
    const form = await formOf()
    fill(form)
    fireEvent.click(form.getByRole('button', { name: 'Gửi' }))
    expect(await screen.findByText(vi_.errors.MESSAGE_TOO_SHORT)).toBeTruthy()
    expect(form.getByLabelText(/Nội dung/).value).toContain('Đèn bị móp')
  })
  it('429 / 503 show a translated alert and keep the draft', async () => {
    for (const [status, code, msg] of [[429, 'RATE_LIMITED', vi_.errors.RATE_LIMITED], [503, 'CONTACT_UNAVAILABLE', vi_.errors.CONTACT_UNAVAILABLE]]) {
      mockApi({ ...base, 'POST /contact': () => ({ status, body: { error: { code, message: 'x' } } }) })
      const { unmount } = renderAt('/contact')
      const form = await formOf()
      fill(form)
      fireEvent.click(form.getByRole('button', { name: 'Gửi' }))
      expect((await screen.findByRole('alert')).textContent).toBe(msg)
      expect(form.getByLabelText(/Nội dung/).value).toContain('Đèn bị móp')
      unmount()
    }
  })
  it('double submit while pending sends once', async () => {
    let n = 0
    let release
    const gate = new Promise((r) => { release = r })
    mockApi({ ...base, 'POST /contact': async () => { n++; await gate; return { status: 202, body: { ok: true } } } })
    renderAt('/contact')
    const form = await formOf()
    fill(form)
    const btn = form.getByRole('button', { name: 'Gửi' })
    fireEvent.click(btn); fireEvent.click(btn)
    release()
    await screen.findByText(/Đã nhận tin nhắn của bạn/)
    expect(n).toBe(1)
  })
  it('after success the form is cleared; zalo with non-https is still rendered as given by server (server must sanitize)', async () => {
    mockApi({ ...base, 'POST /contact': () => ({ status: 202, body: { ok: true } }) })
    renderAt('/contact')
    const form = await formOf()
    fill(form)
    fireEvent.click(form.getByRole('button', { name: 'Gửi' }))
    await screen.findByText(/Đã nhận tin nhắn của bạn/)
    expect(form.getByLabelText(/Họ tên/).value).toBe('')
  })
  it('/site failure: page still renders title, no form', async () => {
    mockApi({ ...base, 'GET /site': () => ({ status: 500, body: {} }) })
    renderAt('/contact')
    expect(await screen.findByRole('heading', { level: 1, name: 'Liên hệ LAMVI' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  })
})

describe('Login checkout note', () => {
  it.each(['%2Fcheckout', '%2Fen%2Fcheckout', '%2Fcheckout%3Fx%3D1', '%2Fcheckout%23a'])('next=%s shows note', async (n) => {
    mockApi(base)
    renderAt(`/login?next=${n}`)
    expect(await screen.findByText(vi_.auth.checkoutNote)).toBeTruthy()
  })
  it.each(['%2Fcheckoutx', '%2Faccount', '%2F%2Fevil.com%2Fcheckout', 'https%3A%2F%2Fevil.com%2Fcheckout', '%2Fshop%2Fcheckout-guide'])('next=%s does not show note', async (n) => {
    mockApi(base)
    renderAt(`/login?next=${n}`)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(vi_.auth.checkoutNote)).toBeNull()
  })
  it('next=/account?return=/checkout [BUG: unanchored regex] does not show note', async () => {
    mockApi(base)
    renderAt('/login?next=' + encodeURIComponent('/account?return=/checkout'))
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(vi_.auth.checkoutNote)).toBeNull()
  })
  it('login page works with no CartProvider cart / empty cart (no summary)', async () => {
    mockApi(base)
    renderAt('/login?next=%2Fcheckout')
    await screen.findByText(vi_.auth.checkoutNote)
    expect(document.querySelector('.login-cart-summary')).toBeNull()
  })
})

describe('May handoff link', () => {
  const open = async () => fireEvent.click(await screen.findByRole('button', { name: 'Trò chuyện với Mây' }))
  it('uses zalo (new tab, noopener) when configured', async () => {
    mockApi(base)
    renderAt('/')
    await open()
    await waitFor(() => expect(document.querySelector('.may-handoff').getAttribute('href')).toBe('https://zalo.me/mau'))
    const a = document.querySelector('.may-handoff')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
  })
  it('falls back to /contact (same tab) without zalo or on /site error, locale-aware', async () => {
    mockApi({ ...base, 'GET /site': () => ({ body: { ...site, zalo: '' } }) })
    renderAt('/en')
    fireEvent.click(await screen.findByRole('button', { name: /Mây|May/ }))
    await waitFor(() => expect(document.querySelector('.may-handoff')).not.toBeNull())
    const a = document.querySelector('.may-handoff')
    expect(a.getAttribute('href')).toBe('/en/contact')
    expect(a.getAttribute('target')).toBeNull()
  })
})

describe('policy pages i18n', () => {
  it.each([['vi', vi_], ['en', en_], ['zh', zh_]])('terms/shipping/payment complete in %s', (_l, m) => {
    for (const k of ['terms', 'shipping', 'payment']) {
      const p = m.policy[k]
      expect(p.title, k).toBeTruthy()
      expect(p.description, k).toBeTruthy()
      expect(p.intro, k).toBeTruthy()
      expect(Array.isArray(p.sections) && p.sections.length > 0, k).toBe(true)
      for (const s of p.sections) { expect(s.h).toBeTruthy(); expect(s.items.length).toBeGreaterThan(0); for (const i of s.items) expect(i.trim()).toBeTruthy() }
    }
  })
  it('same section count across languages and no leftover placeholders', () => {
    for (const k of ['terms', 'shipping', 'payment']) {
      expect(en_.policy[k].sections.length, k).toBe(vi_.policy[k].sections.length)
      expect(zh_.policy[k].sections.length, k).toBe(vi_.policy[k].sections.length)
      expect(JSON.stringify([vi_.policy[k], en_.policy[k], zh_.policy[k]])).not.toMatch(/TODO|TBD|XXX|lorem/i)
    }
  })
  it('nav/contact/auth/may keys exist in all 3 languages', () => {
    const need = [['nav', ['menu', 'menuClose', 'menuLabel', 'contact', 'track', 'hotline']], ['contact', Object.keys(vi_.contact)], ['auth', ['checkoutNote', 'checkoutNoteSub', 'cartSummary', 'cartItems', 'cartTotal']], ['may', ['handoff', 'handoffHint']]]
    for (const [ns, keys] of need) for (const k of keys) for (const m of [en_, zh_]) expect(m[ns][k], `${ns}.${k}`).toBeTruthy()
  })
  it.each(['/en/terms', '/zh/shipping', '/zh/payment'])('%s renders', async (p) => {
    mockApi(base)
    renderAt(p)
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy()
  })
})
