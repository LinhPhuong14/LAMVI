// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@moc.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@moc.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const snapshot = {
  configured: true,
  fetchedAt: '2026-10-01T03:00:00.000Z',
  activeUsers: 12,
  pageViews: 40,
  perMinute: Array.from({ length: 30 }, (_, i) => ({ minutesAgo: i, users: i === 0 ? 5 : 0 })),
  pages: [{ name: 'Trang chủ', value: 7 }],
  countries: [{ name: 'Vietnam', value: 11 }],
  devices: [{ name: 'mobile', value: 9 }],
}

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))

describe('Admin — GA realtime', () => {
  it('hiện số người online và các bảng xếp hạng; có mục trên thanh điều hướng', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/analytics/realtime': () => ({ body: snapshot }) })
    renderAt('/admin/analytics')
    expect(await screen.findByRole('heading', { name: 'Truy cập thời gian thực' })).toBeInTheDocument()
    const kpi = (await screen.findByText('Đang online (30 phút qua)')).parentElement
    expect(within(kpi).getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Trang chủ')).toBeInTheDocument()
    expect(screen.getByText('Vietnam')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Truy cập \(GA\)/ })).toHaveAttribute('href', '/admin/analytics')
  })

  it('chưa cấu hình → hướng dẫn đặt biến môi trường', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/analytics/realtime': () => ({ body: { configured: false } }) })
    renderAt('/admin/analytics')
    expect(await screen.findByText('Chưa cấu hình báo cáo GA realtime.')).toBeInTheDocument()
    expect(screen.getByText(/GA_PROPERTY_ID/)).toBeInTheDocument()
  })

  it('GA lỗi → cảnh báo theo mã', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/analytics/realtime': () => ({ status: 502, body: { error: { code: 'GA_QUOTA' } } }) })
    renderAt('/admin/analytics')
    expect(await screen.findByRole('alert')).toHaveTextContent('Vượt hạn mức')
  })
})
