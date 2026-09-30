// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'it@moc.test' } }
const me = (role) => () => ({ body: { profile: { id: 'u1', email: 'it@moc.test', role, preferredLocale: 'vi', fullName: 'IT' } } })
const health = (enabled = false) => ({
  status: 'degraded',
  checks: [
    { name: 'database', provider: 'supabase', status: 'ok', latencyMs: 12 },
    { name: 'storage', provider: 'supabase', status: 'error', latencyMs: 3000, message: 'timeout' },
    { name: 'openai', status: 'not_integrated', configured: false },
  ],
  system: { version: '0.0.0', commit: null, node: 'v22', env: 'production', startedAt: '2026-09-28T00:00:00Z', uptimeSec: 3700, memoryMb: { rss: 80, heapUsed: 40 }, dataMode: 'supabase' },
  maintenance: { enabled, updatedAt: null, updatedBy: null },
})
const metrics = {
  range: '24h',
  totals: { count: 120, errorRate: 0.025, p95Ms: 250, avgMs: 40 },
  routes: [{ method: 'GET', route: '/api/products', count: 100, s2xx: 97, s3xx: 0, s4xx: 0, s5xx: 3, errorRate: 0.03, avgMs: 30, p50Ms: 50, p95Ms: 250, maxMs: 900 }],
}
const errors = { items: [{ at: '2026-09-28T09:00:00Z', method: 'GET', route: '/api/faq', path: '/api/faq', status: 500, code: 'INTERNAL_ERROR', message: 'db down' }] }

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))

const base = (role = 'it', extra = {}) => ({
  'GET /me': me(role),
  'GET /it/health': () => ({ body: health() }),
  'GET /it/metrics': () => ({ body: metrics }),
  'GET /it/errors': () => ({ body: errors }),
  ...extra,
})

describe('Dashboard IT (D-51, D-52)', () => {
  it('admin/khách không vào được /it; không gọi API IT', async () => {
    const f = mockApi(base('admin'))
    renderAt('/it')
    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
    expect(f.mock.calls.some(([u]) => String(u).includes('/api/it/'))).toBe(false)
  })

  it('hiện sức khoẻ, số liệu, lỗi gần đây; noindex', async () => {
    mockApi(base())
    renderAt('/it')
    expect(await screen.findByText('Có thành phần gặp sự cố')).toBeInTheDocument()
    const storage = screen.getByText('Lưu trữ video (Storage)').closest('li')
    expect(within(storage).getByText('Lỗi')).toBeInTheDocument()
    expect(within(storage).getByText('timeout')).toBeInTheDocument()
    expect(screen.getByText('Chưa tích hợp')).toBeInTheDocument()
    expect(await screen.findByText('2.5%')).toBeInTheDocument()
    expect(screen.getByText('GET /api/products')).toBeInTheDocument()
    expect(await screen.findByText('db down')).toBeInTheDocument()
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it('đổi khoảng thời gian gọi lại API với range mới', async () => {
    const f = mockApi(base())
    renderAt('/it')
    fireEvent.click(await screen.findByRole('button', { name: '7 ngày' }))
    await screen.findByText('GET /api/products')
    expect(f.mock.calls.some(([u]) => String(u).includes('/api/it/metrics?range=7d'))).toBe(true)
  })

  it('bật bảo trì: hỏi xác nhận, gọi PUT, hiện trạng thái BẬT (D-54)', async () => {
    const puts = []
    mockApi(
      base('it', {
        'PUT /it/maintenance': (url, init) => {
          puts.push(JSON.parse(init.body))
          return { body: { enabled: true, updatedAt: '2026-09-28T10:00:00Z' } }
        },
      }),
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderAt('/it')
    fireEvent.click(await screen.findByRole('button', { name: 'Bật bảo trì' }))
    expect(puts).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Bật bảo trì' }))
    expect(await screen.findByText(/ĐANG BẬT/)).toBeInTheDocument()
    expect(puts).toEqual([{ enabled: true }])
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('IT vào được /admin và có link sang /it', async () => {
    mockApi({ 'GET /me': me('it'), 'GET /admin/products': () => ({ body: { items: [] } }) })
    renderAt('/admin/products')
    expect(await screen.findByRole('heading', { name: 'Sản phẩm' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard IT' })).toHaveAttribute('href', '/it')
  })
})
