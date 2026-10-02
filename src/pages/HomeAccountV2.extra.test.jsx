// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
beforeEach(() => localStorage.setItem('moc.tour.done', '1'))
const base = { 'GET /products': () => ({ body: productsVi }), 'GET /faq': () => ({ body: faqVi }) }

describe('B: bộ sưu tập trang chủ không có tab quà tặng/tự dùng', () => {
  it('không có .intent-toggle', async () => {
    mockApi(base)
    renderAt('/')
    await screen.findByText('Đèn Nguyệt', { selector: '.product-card a' })
    expect(document.querySelector('.intent-toggle')).toBeNull()
  })
})

describe('E: dashboard tổng quan', () => {
  it('.dash-actions có 2 điều khiển; 3 stat có data-tone amber/son/cham', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile: { id: 'u1', email: 'an@example.com', fullName: 'An', role: 'customer', preferredLocale: 'vi' } } }),
      'GET /may/history': () => ({ body: { items: [] } }),
      'GET /cart': () => ({ body: { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10 } }),
      'GET /orders': () => ({ body: { items: [] } }),
    })
    renderAt('/account')
    await waitFor(() => expect(document.querySelector('.dash-actions')).not.toBeNull())
    const actions = document.querySelector('.dash-actions')
    expect(actions.querySelectorAll('a, button')).toHaveLength(2)
    expect([...document.querySelectorAll('.dash-stat')].map((n) => n.dataset.tone)).toEqual(['amber', 'son', 'cham'])
  })
})
