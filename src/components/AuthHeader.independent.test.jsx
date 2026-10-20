// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: { items: [], itemCount: 0 } }),
  'GET /site': () => ({ body: { phone: '0901 234 567' } }),
}
const btn = () => document.querySelector('header.nav .nav-menu-btn')
const drawer = () => document.getElementById('mobile-menu')
const open = async (p) => {
  mockApi(base)
  renderAt(p)
  await waitFor(() => expect(btn()).toBeTruthy())
  fireEvent.click(btn())
  await waitFor(() => expect(drawer()).toBeTruthy())
}
const pre = (l) => (l === 'vi' ? '' : `/${l}`)

describe('AuthHeader mobile drawer', () => {
  for (const l of ['vi', 'en', 'zh']) {
    for (const [p, target] of [['/login', 'register'], ['/register', 'login'], ['/forgot-password', 'login']]) {
      it(`${l}${p}`, async () => {
        await open(`${pre(l)}${p}`)
        const hrefs = [...drawer().querySelectorAll('.mobile-menu-links a')].map((a) => a.getAttribute('href'))
        expect(hrefs).toEqual([`${pre(l)}/`.replace(/\/$/, '') || '/', `${pre(l)}/shop`, `${pre(l)}/contact`].map((h) => (h === '' ? '/' : h)))
        expect(drawer().querySelectorAll('.lang-switch a').length).toBe(3)
        expect(drawer().querySelector('.mobile-menu-cta').getAttribute('href')).toBe(`${pre(l)}/${target}`)
        expect(drawer().querySelector('a[href*="/account"]')).toBeNull()
        expect(drawer().querySelector('a[href*="/cart"]')).toBeNull()
        expect(drawer().querySelector('.mobile-menu-logout')).toBeNull()
        expect(btn().getAttribute('aria-expanded')).toBe('true')
        expect(document.body.style.overflow).toBe('hidden')
        cleanup()
      })
    }
  }

  it('Esc đóng, trả focus, mở khoá cuộn', async () => {
    await open('/login')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(drawer()).toBeNull())
    expect(btn().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(btn())
    expect(document.body.style.overflow).toBe('')
  })
  it('bấm nền đóng; bấm trong ngăn kéo không đóng', async () => {
    await open('/login')
    fireEvent.click(drawer())
    expect(drawer()).toBeTruthy()
    fireEvent.click(document.querySelector('.mobile-menu-backdrop'))
    await waitFor(() => expect(drawer()).toBeNull())
    expect(document.activeElement).toBe(btn())
    expect(document.body.style.overflow).toBe('')
  })
  it('nút × đóng; nút menu bật/tắt', async () => {
    await open('/login')
    fireEvent.click(within(drawer()).getByRole('button', { name: /./ }))
    await waitFor(() => expect(drawer()).toBeNull())
    fireEvent.click(btn())
    await waitFor(() => expect(drawer()).toBeTruthy())
    expect(btn().getAttribute('aria-expanded')).toBe('true')
  })
  it('đổi route (bấm CTA) đóng ngăn kéo', async () => {
    await open('/login')
    fireEvent.click(drawer().querySelector('.mobile-menu-cta'))
    await waitFor(() => expect(drawer()).toBeNull())
    expect(document.body.style.overflow).toBe('')
    expect(document.querySelector('header .nav-cta').getAttribute('href')).toBe('/login')
  })
  it('Tab xoay vòng trong ngăn kéo', async () => {
    await open('/login')
    const items = [...drawer().querySelectorAll('a[href], button:not([disabled])')]
    items.at(-1).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(items.at(-1))
  })
})

describe('SiteHeader regression', () => {
  it('menu site có account, logout ẩn khi khách, CTA shop', async () => {
    mockApi(base)
    renderAt('/')
    await waitFor(() => expect(btn()).toBeTruthy())
    fireEvent.click(btn())
    await waitFor(() => expect(drawer()).toBeTruthy())
    expect(drawer().querySelector('a[href="/account"]')).toBeTruthy()
    expect(drawer().querySelector('.mobile-menu-cta').getAttribute('href')).toBe('/shop')
    expect(drawer().querySelector('.mobile-menu-logout')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(drawer()).toBeNull())
    expect(document.activeElement).toBe(btn())
    expect(document.body.style.overflow).toBe('')
    expect(screen).toBeTruthy()
  })
})
