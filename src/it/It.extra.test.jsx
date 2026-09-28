// @vitest-environment jsdom
// Kiểm thử độc lập: dashboard IT (D-51, D-52, D-54)
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { S } from './strings.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'it@moc.test' } }
const me = (role) => () => ({ body: { profile: { id: 'u1', email: 'it@moc.test', role, preferredLocale: 'vi', fullName: 'IT' } } })
const health = (enabled = false) => ({
  status: 'ok',
  checks: [
    { name: 'database', provider: 'supabase', status: 'ok', latencyMs: 12 },
    { name: 'payos', status: 'not_integrated', configured: true },
  ],
  system: { version: '0.0.0', commit: 'abc123', node: 'v22', env: 'production', startedAt: '2026-09-28T00:00:00Z', uptimeSec: 90061, memoryMb: { rss: 80, heapUsed: 40 }, dataMode: 'memory' },
  maintenance: { enabled, updatedAt: null, updatedBy: null },
})
const metrics = { range: '24h', totals: { count: 0, errorRate: 0, p95Ms: null, avgMs: null }, routes: [] }
const errors = { items: [] }

const base = (role = 'it', extra = {}) => ({
  'GET /me': me(role),
  'GET /it/health': () => ({ body: health() }),
  'GET /it/metrics': () => ({ body: metrics }),
  'GET /it/errors': () => ({ body: errors }),
  ...extra,
})

const count = (f, part) => f.mock.calls.filter(([u]) => String(u).includes(part)).length

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Gate /it (D-51)', () => {
  it.each(['admin', 'customer'])('vai trò %s → không có quyền, không gọi API IT', async (role) => {
    const f = mockApi(base(role))
    renderAt('/it')
    expect(await screen.findByRole('heading', { name: S.forbiddenTitle })).toBeInTheDocument()
    expect(count(f, '/api/it/')).toBe(0)
  })

  it('/me lỗi → không vào dashboard', async () => {
    const f = mockApi(base('it', { 'GET /me': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }))
    renderAt('/it')
    expect(await screen.findByRole('heading', { name: S.forbiddenTitle })).toBeInTheDocument()
    expect(count(f, '/api/it/')).toBe(0)
  })

  it('chưa đăng nhập → chuyển /login?next=/it', async () => {
    localStorage.removeItem('moc.session')
    const f = mockApi(base())
    renderAt('/it')
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByText(S.title)).toBeNull()
    expect(count(f, '/api/it/')).toBe(0)
  })
})

describe('Dashboard IT — tải dữ liệu', () => {
  it('lỗi tải health → thông báo lỗi; số liệu vẫn hiện', async () => {
    mockApi(base('it', { 'GET /it/health': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }))
    renderAt('/it')
    expect(await screen.findByText('Có lỗi xảy ra. Vui lòng thử lại sau.')).toBeInTheDocument()
    expect(await screen.findByText(S.metrics.empty)).toBeInTheDocument()
    // Không có health → không hiện panel bảo trì
    expect(screen.queryByRole('button', { name: S.maintenance.turnOn })).toBeNull()
  })

  it('lỗi tải metrics/errors → thông báo lỗi (role=alert)', async () => {
    mockApi(
      base('it', {
        'GET /it/metrics': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }),
        'GET /it/errors': () => ({ status: 403, body: { error: { code: 'FORBIDDEN' } } }),
      }),
    )
    renderAt('/it')
    expect(await screen.findByText('Có lỗi xảy ra. Vui lòng thử lại sau.')).toBeInTheDocument()
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2)
  })

  it('hiện cấu hình tích hợp, chế độ bộ nhớ, thời gian chạy; danh sách rỗng', async () => {
    mockApi(base())
    renderAt('/it')
    expect(await screen.findByText(S.health.configured)).toBeInTheDocument()
    expect(screen.getByText(S.health.memoryMode)).toBeInTheDocument()
    expect(screen.getByText('1 ngày 1 giờ 1 phút')).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(await screen.findByText(S.metrics.empty)).toBeInTheDocument()
    expect(await screen.findByText(S.errors.empty)).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0) // p95 null
  })

  it('tự làm mới mỗi 30 giây: gọi lại health/metrics/errors', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const f = mockApi(base())
    renderAt('/it')
    await screen.findByText(S.health.overall.ok)
    await screen.findByText(S.metrics.empty)
    const n = { h: count(f, '/api/it/health'), m: count(f, '/api/it/metrics'), e: count(f, '/api/it/errors') }
    await act(async () => {
      vi.advanceTimersByTime(29_000)
    })
    expect(count(f, '/api/it/health')).toBe(n.h)
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    await vi.waitFor(() => {
      expect(count(f, '/api/it/health')).toBe(n.h + 1)
      expect(count(f, '/api/it/metrics')).toBe(n.m + 1)
      expect(count(f, '/api/it/errors')).toBe(n.e + 1)
    })
  })

  it('làm mới bị lỗi sau khi đã có dữ liệu → giữ dữ liệu cũ', async () => {
    let fail = false
    mockApi(base('it', { 'GET /it/health': () => (fail ? { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } } : { body: health() }) }))
    renderAt('/it')
    await screen.findByText(S.health.overall.ok)
    fail = true
    fireEvent.click(screen.getByRole('button', { name: S.refresh }))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByText(S.health.overall.ok)).toBeInTheDocument()
  })
})

describe('Dashboard IT — bảo trì (D-54)', () => {
  it('huỷ xác nhận tắt → không gọi PUT', async () => {
    const f = mockApi(base('it', { 'GET /it/health': () => ({ body: health(true) }) }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/it')
    fireEvent.click(await screen.findByRole('button', { name: S.maintenance.turnOff }))
    expect(confirm).toHaveBeenCalledWith(S.maintenance.confirmOff)
    expect(f.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    expect(screen.getByText(S.maintenance.on)).toBeInTheDocument()
  })

  it('PUT lỗi → hiện thông báo lỗi, trạng thái không đổi, nút bật lại', async () => {
    mockApi(base('it', { 'PUT /it/maintenance': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/it')
    fireEvent.click(await screen.findByRole('button', { name: S.maintenance.turnOn }))
    expect(await screen.findByText('Có lỗi xảy ra. Vui lòng thử lại sau.')).toBeInTheDocument()
    expect(screen.getByText(S.maintenance.off)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: S.maintenance.turnOn })).toBeEnabled()
  })

  it('tắt bảo trì thành công → hiện Đang tắt', async () => {
    const puts = []
    mockApi(
      base('it', {
        'GET /it/health': () => ({ body: health(true) }),
        'PUT /it/maintenance': (u, init) => (puts.push(JSON.parse(init.body)), { body: { enabled: false, updatedAt: '2026-09-28T10:00:00Z' } }),
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/it')
    fireEvent.click(await screen.findByRole('button', { name: S.maintenance.turnOff }))
    expect(await screen.findByText(S.maintenance.off)).toBeInTheDocument()
    expect(puts).toEqual([{ enabled: false }])
  })
})

describe('Link /admin ↔ /it', () => {
  it('admin trong /admin không thấy link Dashboard IT', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/products': () => ({ body: { items: [] } }) })
    renderAt('/admin/products')
    expect(await screen.findByRole('heading', { name: 'Sản phẩm' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Dashboard IT/ })).toBeNull()
    expect(document.querySelector('a[href="/it"]')).toBeNull()
  })

  it('IT trong /it có link về /admin', async () => {
    mockApi(base())
    renderAt('/it')
    expect(await screen.findByRole('link', { name: S.nav.admin })).toHaveAttribute('href', '/admin')
  })
})

describe('Chuỗi giao diện (i18n)', () => {
  it('không có chuỗi tiếng Việt cứng trong src/it/*.jsx (ngoài strings.js, bỏ qua "MỘC")', () => {
    const dir = join(process.cwd(), 'src/it')
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
    expect(files.length).toBeGreaterThan(0)
    const vn = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
    for (const f of files) {
      const lines = readFileSync(join(dir, f), 'utf8').split('\n')
      const bad = lines
        .map((l, i) => [i + 1, l.replace(/MỘC/g, '')])
        .filter(([, l]) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)) // bỏ comment
        .filter(([, l]) => vn.test(l.replace(/\/\/.*$/, '')))
      expect(bad, f).toEqual([])
    }
  })
})
