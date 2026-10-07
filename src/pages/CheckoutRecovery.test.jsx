// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { clearCheckoutRequest } from './checkoutRequest.js'
const key = '19000000-0000-4000-8000-000000000019'
const storageKey = 'LAMVI.checkout.request.u1'
const profile = { id: 'u1', email: 'buyer@example.test', role: 'customer', fullName: 'Buyer', preferredLocale: 'vi' }
const quote = { items: [{ slug: 'lamp', name: 'Lamp', quantity: 1, unitPrice: 1000, lineTotal: 1000 }], subtotal: 1000, total: 1000, shippingFee: 0, freeShipping: true, discount: 0, vatRate: 0.1, vatAmount: 100, freeShippingFrom: 1000 }
beforeEach(() => {
 clearCheckoutRequest('u1')
 localStorage.setItem('moc.session', JSON.stringify({ user: { id: 'u1', email: profile.email }, accessToken: 'token', refreshToken: 'refresh', expiresAt: 9999999999 }))
 sessionStorage.setItem(storageKey, JSON.stringify({ key, fingerprint: 'a'.repeat(64) }))
})
function api(handler) {
 return mockApi({
  'GET /me': () => ({ body: { profile } }),
  'GET /cart': () => ({ body: { items: [], subtotal: 0, itemCount: 0 } }),
  'GET /products': () => ({ body: { items: [] } }),
  'GET /may/history': () => ({ body: { items: [] } }),
  [`GET /checkout/requests/${key}`]: handler,
  'POST /checkout/quote': () => ({ body: quote }),
  'GET /geo/provinces': () => ({ body: { items: [] } }),
 })
}
it('recovers the committed order before quoting an already-consumed cart after reload', async () => {
 const fetch = api(() => ({ body: { order: { code: 'RECOVERED' } } }))
 renderAt('/checkout')
 await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/orders/RECOVERED'))).toBe(true))
 expect(sessionStorage.getItem(storageKey)).toBeNull()
 expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/checkout/quote'))).toBe(false)
 expect(fetch.mock.calls.some(([url, options]) => String(url) === '/api/orders' && options.method === 'POST')).toBe(false)
})
it('keeps the key on transient lookup failure and retries recovery instead of creating a second order', async () => {
 let attempt = 0
 const fetch = api(() => ++attempt === 1 ? { status: 503, body: { error: { code: 'INTERNAL_ERROR' } } } : { body: { order: { code: 'RECOVERED' } } })
 renderAt('/checkout')
 const retry = await screen.findByRole('button', { name: 'Thử lại' })
 expect(sessionStorage.getItem(storageKey)).toContain(key)
 expect(screen.queryByRole('button', { name: 'Đặt hàng' })).toBeNull()
 fireEvent.click(retry)
 await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/orders/RECOVERED'))).toBe(true))
 expect(attempt).toBe(2)
 expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/checkout/quote'))).toBe(false)
})
it('clears an uncommitted request key and loads checkout after an authoritative 404', async () => {
 api(() => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }))
 renderAt('/checkout')
 expect(await screen.findByRole('button', { name: 'Đặt hàng' })).toBeEnabled()
 expect(sessionStorage.getItem(storageKey)).toBeNull()
})
it('does not consume a recovered key from a stale result after unmount', async () => {
 let release
 api(() => new Promise((resolve) => { release = resolve }))
 const view = renderAt('/checkout')
 await waitFor(() => expect(release).toBeTypeOf('function'))
 view.unmount()
 await act(async () => release({ body: { order: { code: 'RECOVERED' } } }))
 expect(sessionStorage.getItem(storageKey)).toContain(key)
})
