// @vitest-environment jsdom
// Kiểm thử độc lập bổ sung: trang GA realtime (T-11) — tự làm mới 30s, giữ số liệu cũ khi lỗi, dọn dẹp, tên rỗng
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@moc.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@moc.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const snap = (over = {}) => ({
  configured: true,
  fetchedAt: '2026-10-01T03:00:00.000Z',
  activeUsers: 12,
  pageViews: 40,
  perMinute: Array.from({ length: 30 }, (_, i) => ({ minutesAgo: i, users: i === 0 ? 5 : 0 })),
  pages: [],
  countries: [],
  devices: [],
  ...over,
})
const PATH = 'GET /admin/analytics/realtime'
const calls = (fetchMock) => fetchMock.mock.calls.filter(([u]) => String(u).includes('analytics/realtime')).length

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// Đồng hồ giả chỉ cho setInterval để findBy*/waitFor vẫn chạy bằng đồng hồ thật
async function renderFake(handlers) {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  const fetchMock = mockApi({ 'GET /me': me, ...handlers })
  const view = renderAt('/admin/analytics')
  await screen.findByText('Đang online (30 phút qua)')
  return { fetchMock, view }
}
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('Admin GA realtime — tự làm mới', () => {
  it('gọi lại đúng mỗi 30 giây, không sớm hơn', async () => {
    let n = 0
    const { fetchMock } = await renderFake({ [PATH]: () => ({ body: snap({ activeUsers: ++n }) }) })
    expect(calls(fetchMock)).toBe(1)
    await tick(29_000)
    expect(calls(fetchMock)).toBe(1)
    await tick(1_000)
    expect(calls(fetchMock)).toBe(2)
    await tick(30_000)
    expect(calls(fetchMock)).toBe(3)
    await waitFor(() => expect(screen.getByText('3', { selector: 'strong' })).toBeInTheDocument())
  })

  it('nút Làm mới gọi ngay', async () => {
    const { fetchMock } = await renderFake({ [PATH]: () => ({ body: snap() }) })
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(calls(fetchMock)).toBe(2))
  })

  it('làm mới lỗi → giữ số liệu cũ, hiện cảnh báo; lần sau thành công → cảnh báo biến mất', async () => {
    let mode = 'ok'
    const { fetchMock } = await renderFake({
      [PATH]: () => (mode === 'ok' ? { body: snap({ activeUsers: 77 }) } : { status: 502, body: { error: { code: 'GA_UPSTREAM' } } }),
    })
    mode = 'fail'
    await tick(30_000)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không lấy được số liệu')
    expect(screen.getByText('77')).toBeInTheDocument()
    expect(screen.queryByText('Đang tải…')).not.toBeInTheDocument()
    mode = 'ok'
    await tick(30_000)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByText('77')).toBeInTheDocument()
    expect(calls(fetchMock)).toBe(3)
  })

  it('lỗi không có mã (mạng) → thông báo mặc định, vẫn giữ số liệu cũ', async () => {
    let fail = false
    await renderFake({ [PATH]: () => (fail ? { status: 500, body: {} } : { body: snap({ activeUsers: 21 }) }) })
    fail = true
    await tick(30_000)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được báo cáo.')
    expect(screen.getByText('21')).toBeInTheDocument()
  })

  it('lần tải đầu lỗi → chỉ cảnh báo (không số liệu), 30s sau tự thử lại và hiển thị', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    let ok = false
    mockApi({ 'GET /me': me, [PATH]: () => (ok ? { body: snap({ activeUsers: 5 }) } : { status: 502, body: { error: { code: 'GA_AUTH' } } }) })
    renderAt('/admin/analytics')
    expect(await screen.findByRole('alert')).toHaveTextContent('Google từ chối khoá')
    expect(screen.queryByText('Đang online (30 phút qua)')).not.toBeInTheDocument()
    ok = true
    await tick(30_000)
    expect(await screen.findByText('Đang online (30 phút qua)')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('chưa cấu hình → vẫn polling (admin cài xong biến môi trường là thấy số liệu)', async () => {
    let configured = false
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    mockApi({ 'GET /me': me, [PATH]: () => ({ body: configured ? snap({ activeUsers: 9 }) : { configured: false } }) })
    renderAt('/admin/analytics')
    expect(await screen.findByText('Chưa cấu hình báo cáo GA realtime.')).toBeInTheDocument()
    configured = true
    await tick(30_000)
    expect(await screen.findByText('Đang online (30 phút qua)')).toBeInTheDocument()
    expect(screen.queryByText('Chưa cấu hình báo cáo GA realtime.')).not.toBeInTheDocument()
  })

  it('rời trang → dừng interval, không gọi API nữa, không cảnh báo setState sau unmount', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { fetchMock, view } = await renderFake({ [PATH]: () => ({ body: snap() }) })
    const before = calls(fetchMock)
    view.unmount()
    await tick(120_000)
    expect(calls(fetchMock)).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
    expect(err).not.toHaveBeenCalled()
  })

  it('unmount khi request đang bay → kết quả bị bỏ, không lỗi', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    let release
    const gate = new Promise((r) => (release = r))
    mockApi({ 'GET /me': me, [PATH]: async () => { await gate; return { body: snap() } } })
    const view = renderAt('/admin/analytics')
    await waitFor(() => expect(screen.getByText('Đang tải…')).toBeInTheDocument())
    view.unmount()
    release()
    await act(async () => { await Promise.resolve() })
    expect(err).not.toHaveBeenCalled()
  })

  it('phản hồi cũ về muộn không ghi đè phản hồi mới (làm mới liên tiếp)', async () => {
    const releases = []
    let n = 0
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    mockApi({
      'GET /me': me,
      [PATH]: () => {
        const mine = ++n
        return new Promise((r) => releases.push(() => r({ body: snap({ activeUsers: mine * 100 }) })))
      },
    })
    renderAt('/admin/analytics')
    await waitFor(() => expect(releases).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(releases).toHaveLength(2))
    await act(async () => { releases[1]() })
    expect(await screen.findByText('200')).toBeInTheDocument()
    await act(async () => { releases[0]() })
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.queryByText('100')).not.toBeInTheDocument()
  })
})

describe('Admin GA realtime — hiển thị dữ liệu biên', () => {
  it('trang có tên rỗng → hiện "—", không lỗi key; hai dòng tên rỗng đều hiện', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi({
      'GET /me': me,
      [PATH]: () => ({ body: snap({ pages: [{ name: '', value: 3 }, { name: '', value: 1 }, { name: 'Trang chủ', value: 2 }] }) }),
    })
    renderAt('/admin/analytics')
    await screen.findByText('Trang chủ')
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(err.mock.calls.flat().join(' ')).not.toMatch(/same key|unique "key"/)
  })

  it('bảng rỗng → câu "chưa có ai truy cập" cho cả 3 bảng; KPI 0', async () => {
    mockApi({ 'GET /me': me, [PATH]: () => ({ body: snap({ activeUsers: 0, pageViews: 0 }) }) })
    renderAt('/admin/analytics')
    await screen.findByText('Đang online (30 phút qua)')
    expect(screen.getAllByText('Chưa có ai truy cập trong 30 phút qua.')).toHaveLength(3)
  })

  it('biểu đồ: 30 cột, phút hiện tại ở bên phải, không chia cho 0 khi toàn 0', async () => {
    mockApi({ 'GET /me': me, [PATH]: () => ({ body: snap({ activeUsers: 0, perMinute: Array.from({ length: 30 }, (_, i) => ({ minutesAgo: i, users: 0 })) }) }) })
    const { container } = renderAt('/admin/analytics')
    await screen.findByText('Đang online (30 phút qua)')
    const cols = container.querySelectorAll('.ga-col')
    expect(cols).toHaveLength(30)
    expect(cols[29].getAttribute('title')).toMatch(/^Hiện tại/)
    for (const c of cols) expect(c.querySelector('span').style.height).toBe('0%')
  })

  it('số lớn được định dạng vi-VN và giá trị tên chứa HTML không bị chèn thành phần tử', async () => {
    mockApi({
      'GET /me': me,
      [PATH]: () => ({ body: snap({ activeUsers: 1234567, countries: [{ name: '<img src=x onerror=alert(1)>', value: 2 }] }) }),
    })
    const { container } = renderAt('/admin/analytics')
    await screen.findByText('Đang online (30 phút qua)')
    expect(screen.getByText(/1\.234\.567/)).toBeInTheDocument()
    expect(container.querySelector('img[src="x"]')).toBeNull()
  })

  it('fetchedAt hỏng → không làm sập trang', async () => {
    mockApi({ 'GET /me': me, [PATH]: () => ({ body: snap({ fetchedAt: 'không phải ngày' }) }) })
    renderAt('/admin/analytics')
    expect(await screen.findByText('Đang online (30 phút qua)')).toBeInTheDocument()
  })
})
