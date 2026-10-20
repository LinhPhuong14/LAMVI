// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'it@moc.test' } }
beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
const health = (enabled, updatedAt = null) => ({
  status: 'ok', checks: [],
  system: { version: '0', commit: null, node: 'v22', env: 'production', startedAt: '2026-09-28T00:00:00Z', uptimeSec: 1, memoryMb: { rss: 1, heapUsed: 1 }, dataMode: 'supabase' },
  maintenance: { enabled, updatedAt, updatedBy: null },
})
const mk = (log, extra = {}) => ({
  'GET /me': () => ({ body: { profile: { id: 'u1', email: 'it@moc.test', role: 'it', preferredLocale: 'vi', fullName: 'IT' } } }),
  'GET /it/health': () => ({ body: health(false) }),
  'GET /it/metrics': () => ({ body: { range: '24h', totals: { count: 0, errorRate: 0, p95Ms: 0, avgMs: 0 }, routes: [] } }),
  'GET /it/errors': () => ({ body: { items: [] } }),
  'GET /it/maintenance/log': log,
  ...extra,
})
const row = (i, o = {}) => ({ id: `id${i}`, at: '2026-09-28T09:00:00Z', actorId: `actor${String(i).padStart(4, '0')}-xxxx`, actorRole: 'it', action: i % 2 ? 'enable' : 'disable', ...o })

describe('MaintenanceLog (independent)', () => {
  it('tối đa 20 dòng', async () => {
    mockApi(mk(() => ({ body: { items: Array.from({ length: 50 }, (_, i) => row(i)) } })))
    renderAt('/it')
    await screen.findByText('Nhật ký bảo trì')
    expect(document.querySelectorAll('.it-maint-log li').length).toBe(20)
    expect(screen.getAllByText(/bởi it \(actor000/).length).toBeGreaterThan(0)
  })
  it('trạng thái rỗng', async () => {
    mockApi(mk(() => ({ body: { items: [] } })))
    renderAt('/it')
    expect(await screen.findByText('Chưa có lần bật/tắt nào.')).toBeInTheDocument()
  })
  it('body không có items không sập', async () => {
    mockApi(mk(() => ({ body: {} })))
    renderAt('/it')
    expect(await screen.findByText('Chưa có lần bật/tắt nào.')).toBeInTheDocument()
  })
  it('lỗi log: dashboard vẫn hiện', async () => {
    mockApi(mk(() => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } })))
    renderAt('/it')
    expect(await screen.findByText('Chế độ bảo trì')).toBeInTheDocument()
    expect(await screen.findByText('Số liệu API')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0))
    expect(screen.getByRole('heading', { name: 'Chế độ bảo trì' })).toBeInTheDocument()
  })
  it('thiếu actorId/actorRole/at không sập; XSS là text', async () => {
    mockApi(mk(() => ({ body: { items: [
      { id: 'a', action: 'enable' },
      { id: 'b', at: 'garbage', actorId: null, actorRole: null, action: 'disable' },
      { id: 'c', at: '2026-09-28T09:00:00Z', actorId: '<img src=x onerror=alert(1)>', actorRole: '<script>x</script>', action: 'enable' },
    ] } })))
    renderAt('/it')
    await screen.findByText('Nhật ký bảo trì')
    expect(document.querySelectorAll('.it-maint-log li').length).toBe(3)
    expect(document.querySelector('.it-maint-log img, .it-maint-log script')).toBeNull()
    expect(document.querySelector('.it-maint-log').textContent).toContain('<script>x</script>')
  })
  it('tải lại sau khi bật bảo trì', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let log = []
    const f = mockApi(mk(() => ({ body: { items: log } }), {
      'PUT /it/maintenance': () => {
        log = [row(1, { id: 'new', actorRole: 'it', actorId: 'zzzzzzzzqq' })]
        return { body: { enabled: true, updatedAt: '2026-09-28T10:00:00Z', updatedBy: 'u1' } }
      },
    }))
    renderAt('/it')
    await screen.findByText('Chưa có lần bật/tắt nào.')
    fireEvent.click(screen.getByRole('button', { name: 'Bật bảo trì' }))
    await waitFor(() => expect(document.querySelectorAll('.it-maint-log li').length).toBe(1))
    expect(screen.getByText(/zzzzzzzz\)/)).toBeInTheDocument()
    expect(f.mock.calls.filter(([u]) => String(u).includes('maintenance/log')).length).toBeGreaterThan(1)
  })
  it('không dùng dangerouslySetInnerHTML', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/it/ItDashboard.jsx', 'utf8')).not.toMatch(/dangerouslySetInnerHTML/)
  })
})
