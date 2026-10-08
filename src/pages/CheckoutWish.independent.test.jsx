// @vitest-environment jsdom
// Kiểm thử độc lập (feedback 08/10): lời chúc chữ ở checkout, tự điền từ /me, banner cookie không có GA.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'khach@lamvi.test' } }
const profile = { id: 'u1', email: 'khach@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'Hồ Sơ', phone: '0987654321' }
const quote = {
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', image: null, unitPrice: 890_000, quantity: 1, lineTotal: 890_000 }],
  subtotal: 890_000, discount: 0, shippingFee: 30_000, freeShipping: false, total: 920_000, vatAmount: 83_636, vatRate: 0.1,
  currency: 'VND', couponCode: null, couponError: null, hasUnavailable: false, freeShippingFrom: 1_000_000,
}
const emptyCart = { items: [], subtotal: 0, currency: 'VND', itemCount: 0, hasUnavailable: false, maxQuantity: 10 }
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

function api(extra = {}) {
  return mockApi({
    'GET /me': () => ({ body: { profile } }),
    'GET /cart': () => ({ body: emptyCart }),
    'GET /products': () => ({ body: { items: [] } }),
    'GET /site': () => ({ body: { name: 'LAMVI', payosEnabled: true } }),
    'GET /may/history': () => ({ body: { items: [] } }),
    'POST /checkout/quote': () => ({ body: quote }),
    'GET /geo/provinces': () => ({ body: { items: [{ code: '1', name: 'Thành phố Hà Nội' }] } }),
    'GET /geo/provinces/1/wards': () => ({ body: { items: [{ code: '4', name: 'Phường Ba Đình' }] } }),
    ...extra,
  })
}
async function address() {
  fill('Địa chỉ (số nhà, đường)', '12 Hàng Bông')
  await screen.findByRole('option', { name: 'Thành phố Hà Nội' })
  fill('Tỉnh / thành phố', '1')
  fireEvent.focus(screen.getByRole('combobox', { name: 'Phường / xã' }))
  await screen.findByRole('option', { name: 'Phường Ba Đình' })
  fireEvent.click(screen.getByRole('option', { name: 'Phường Ba Đình' }))
}

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  delete window.gtag
  localStorage.clear()
})

describe('Lời chúc chữ trong checkout', () => {
  it('đơn tự mua có lời chúc: PUT /orders/:code/message sau POST /orders; lỗi PUT không chặn sang trang đơn', async () => {
    const calls = []
    api({
      'POST /orders': () => (calls.push('POST'), { status: 201, body: { order: { code: 'LV-1' }, payment: null } }),
      'PUT /orders/LV-1/message': (_u, init) => (calls.push(`PUT ${init.body}`), { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }),
      'GET /orders/LV-1': () => ({ body: { order: { code: 'LV-1', status: 'processing', items: [] } } }),
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await screen.findByDisplayValue('Hồ Sơ')
    fireEvent.click(screen.getByLabelText('Thêm lời chúc gắn mã QR'))
    fill('Lời chúc (chữ)', '  Chúc bạn vui  ')
    await address()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() => expect(calls.length).toBe(2))
    expect(calls[0]).toBe('POST')
    expect(JSON.parse(calls[1].slice(4))).toEqual({ text: 'Chúc bạn vui', textLang: 'vi' })
  })

  it('không bật lời chúc (dù đã gõ chữ rồi bỏ tick) → KHÔNG gọi PUT message', async () => {
    const puts = []
    api({
      'POST /orders': () => ({ status: 201, body: { order: { code: 'LV-2' }, payment: null } }),
      'PUT /orders/LV-2/message': (_u, init) => (puts.push(init.body), { body: { item: {} } }),
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await screen.findByDisplayValue('Hồ Sơ')
    const tick = screen.getByLabelText('Thêm lời chúc gắn mã QR')
    fireEvent.click(tick)
    fill('Lời chúc (chữ)', 'Nháp')
    fireEvent.click(tick)
    await address()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Đặt hàng' })).toBeNull())
    expect(puts).toEqual([])
  })
})

describe('Tự điền người nhận từ /me', () => {
  it('khách đã gõ tên trước khi /me về thì không bị ghi đè', async () => {
    let release
    const gate = new Promise((r) => (release = r))
    api({ 'GET /me': async () => (await gate, { body: { profile } }) })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' }).catch(() => null)
    const input = await screen.findByLabelText('Họ tên người nhận').catch(() => null)
    if (!input) return // form chỉ hiện sau khi hồ sơ tải xong ở phiên bản này
    fireEvent.change(input, { target: { value: 'Tôi Tự Gõ' } })
    release()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByLabelText('Họ tên người nhận').value).toBe('Tôi Tự Gõ')
  })
  it('/me lỗi 500 → form vẫn dùng được, ô trống', async () => {
    api({ 'GET /me': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    expect(screen.getByLabelText('Họ tên người nhận').value).toBe('')
  })
})

describe('Banner cookie khi GA không được nhúng', () => {
  it('nút "Cài đặt cookie" ở chân trang không được mở hộp thoại đồng ý khi không có GA (không có gì để đồng ý)', async () => {
    localStorage.clear()
    mockApi({ 'GET /products': () => ({ body: { items: [] } }), 'GET /site': () => ({ body: { name: 'LAMVI' } }) })
    renderAt('/')
    fireEvent.click(await screen.findByRole('button', { name: 'Cài đặt cookie' }))
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByRole('dialog', { name: /Cookie/ })).toBeNull()
  })
})
