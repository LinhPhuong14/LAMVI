// @vitest-environment jsdom
import { useEffect } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'
import { productsVi } from '../../test/fixtures.js'
import AuthProvider from '../../auth/AuthProvider.jsx'
import { safeNext, useAuth } from '../../auth/context.js'

// T-49 (kiểm thử độc lập): trang đặt lại mật khẩu, AuthProvider (cookie HttpOnly), callback Google
const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
}
const profile = { id: 'u1', email: 'an@example.com', fullName: 'Nguyễn An', phone: null, preferredLocale: 'vi', role: 'customer' }
const sess = (n = 1) => ({ accessToken: `a${n}`, expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } })
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const calls = (fetchMock, part) => fetchMock.mock.calls.filter(([u]) => String(u).includes(part))

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('ResetPasswordPage: đọc token từ fragment', () => {
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))

  it('token có ký tự đặc biệt (%2B, %3D, -, _) được giải mã đúng một lần', async () => {
    window.history.replaceState(null, '', '/reset-password#t=ab%2Bc%3D_-x')
    const f = mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 204 }) })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    submit()
    await screen.findByRole('status')
    expect(JSON.parse(calls(f, '/auth/reset-password')[0][1].body).token).toBe('ab+c=_-x')
  })

  it('nhiều tham số t (#t=a&t=b) → dùng giá trị đầu, không gửi mảng', async () => {
    window.history.replaceState(null, '', '/reset-password#t=first&t=second')
    const f = mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 204 }) })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    submit()
    await screen.findByRole('status')
    expect(JSON.parse(calls(f, '/auth/reset-password')[0][1].body).token).toBe('first')
  })

  it('#t= rỗng → báo link không hợp lệ, không có form, không gọi API', async () => {
    window.history.replaceState(null, '', '/reset-password#t=')
    const f = mockApi(base)
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    expect(await screen.findByRole('alert')).toHaveTextContent('không hợp lệ')
    expect(screen.queryByLabelText('Mật khẩu mới')).toBeNull()
    expect(calls(f, '/auth/reset-password')).toHaveLength(0)
  })

  it('token bị xoá khỏi URL ngay khi mở trang (không còn trong location.href / search)', async () => {
    window.history.replaceState(null, '', '/reset-password?x=1#t=BI-MAT')
    mockApi(base)
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    await screen.findByLabelText('Mật khẩu mới')
    expect(window.location.href).not.toContain('BI-MAT')
    expect(window.location.search).toBe('?x=1')
  })

  it('PASSWORD_BREACHED → thông báo cạnh trường, vẫn giữ form để thử mật khẩu khác', async () => {
    window.history.replaceState(null, '', '/reset-password#t=rec')
    let n = 0
    mockApi({
      ...base,
      'POST /auth/reset-password': () =>
        ++n === 1
          ? { status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { password: 'PASSWORD_BREACHED' } } } }
          : { status: 204 },
    })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'password123')
    type('Nhập lại mật khẩu mới', 'password123')
    submit()
    expect(await screen.findByText(/đã xuất hiện trong các vụ rò rỉ/, { selector: '.field-error' })).toBeInTheDocument()
    type('Mật khẩu mới', 'mot-mat-khau-tot-9')
    type('Nhập lại mật khẩu mới', 'mot-mat-khau-tot-9')
    submit()
    expect(await screen.findByRole('status')).toHaveTextContent('Đã đổi mật khẩu')
  })

  it('lỗi 500 / mạng khi gửi → hiện lỗi chung, KHÔNG chuyển sang trạng thái "link hỏng" (còn thử lại được)', async () => {
    window.history.replaceState(null, '', '/reset-password#t=rec')
    mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    submit()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Mật khẩu mới')).toBeInTheDocument()
  })

  it('429 RATE_LIMITED → hiện lỗi, form còn', async () => {
    window.history.replaceState(null, '', '/reset-password#t=rec')
    mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 429, body: { error: { code: 'RATE_LIMITED' } } }) })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    submit()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Mật khẩu mới')).toBeInTheDocument()
  })

  it('thành công không tạo phiên đăng nhập (không lưu localStorage, không gửi Authorization)', async () => {
    window.history.replaceState(null, '', '/reset-password#t=rec')
    const f = mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 204 }) })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    submit()
    await screen.findByRole('status')
    expect(localStorage.getItem('moc.session')).toBeNull()
    expect(calls(f, '/auth/reset-password')[0][1].headers.Authorization).toBeUndefined()
  })

  it('nhấp đúp gửi: nút bị khoá khi đang gửi → chỉ 1 request', async () => {
    window.history.replaceState(null, '', '/reset-password#t=rec')
    let release
    const gate = new Promise((r) => { release = r })
    const f = mockApi({ ...base, 'POST /auth/reset-password': async () => { await gate; return { status: 204 } } })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    const btn = screen.getByRole('button', { name: 'Lưu mật khẩu mới' })
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    fireEvent.click(btn)
    release()
    await screen.findByRole('status')
    expect(calls(f, '/auth/reset-password')).toHaveLength(1)
  })
})

describe('AuthProvider (refresh token chỉ ở cookie HttpOnly)', () => {
  const box = { ctx: null }
  const grab = (value) => { box.ctx = value }
  function Probe() {
    const value = useAuth()
    useEffect(() => grab(value))
    return <p data-testid="who">{value.user?.email ?? 'khach'}</p>
  }
  const mount = () => render(<AuthProvider><Probe /></AuthProvider>)

  it('login: server lỡ trả refreshToken trong body → không được lưu vào localStorage', async () => {
    mockApi({ 'POST /auth/login': () => ({ body: { ...sess(), refreshToken: 'LEAK' } }) })
    mount()
    await act(async () => { await box.ctx.login('an@example.com', 'Gio-Hoa#Sen2026') })
    expect(localStorage.getItem('moc.session')).not.toContain('LEAK')
    expect(localStorage.getItem('moc.session')).not.toContain('refreshToken')
  })

  it('refresh: lỗi 500 / mạng GIỮ phiên (để thử lại); 401 và 400 xoá phiên', async () => {
    for (const [status, kept] of [[500, true], [503, true], [0, true], [401, false], [400, false]]) {
      localStorage.setItem('moc.session', JSON.stringify(sess()))
      mockApi({ 'POST /auth/refresh': () => (status === 0 ? Promise.reject(new Error('net')) : { status, body: {} }) })
      const { unmount } = mount()
      await act(async () => { await box.ctx.refreshSession().catch(() => {}) })
      expect(localStorage.getItem('moc.session') !== null).toBe(kept)
      unmount()
    }
  })

  it('refresh: lỗi mạng (fetch ném) giữ phiên', async () => {
    localStorage.setItem('moc.session', JSON.stringify(sess()))
    const f = mockApi({})
    f.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
    mount()
    await act(async () => { await box.ctx.refreshSession().catch(() => {}) })
    expect(JSON.parse(localStorage.getItem('moc.session')).accessToken).toBe('a1')
  })

  it('refresh không gửi body hay Authorization; gọi đồng thời gộp thành 1 request, sau khi xong cho phép lần mới', async () => {
    localStorage.setItem('moc.session', JSON.stringify(sess()))
    let n = 0
    const f = mockApi({ 'POST /auth/refresh': () => ({ body: sess(++n + 1) }) })
    mount()
    await act(async () => { await Promise.all([box.ctx.refreshSession(), box.ctx.refreshSession(), box.ctx.refreshSession()]) })
    expect(calls(f, '/auth/refresh')).toHaveLength(1)
    expect(calls(f, '/auth/refresh')[0][1].body).toBeUndefined()
    expect(calls(f, '/auth/refresh')[0][1].headers.Authorization).toBeUndefined()
    await act(async () => { await box.ctx.refreshSession() })
    expect(calls(f, '/auth/refresh')).toHaveLength(2)
  })

  it('refresh thất bại rồi lần sau thành công: cờ "đang refresh" được reset', async () => {
    localStorage.setItem('moc.session', JSON.stringify(sess()))
    let n = 0
    mockApi({ 'POST /auth/refresh': () => (++n === 1 ? { status: 500, body: {} } : { body: sess(2) }) })
    mount()
    await act(async () => { await box.ctx.refreshSession().catch(() => {}) })
    await act(async () => { await box.ctx.refreshSession() })
    expect(JSON.parse(localStorage.getItem('moc.session')).accessToken).toBe('a2')
  })

  it('authedApi: 401 → refresh một lần → thử lại với token mới; refresh lỗi 500 → ném lỗi 500, giữ phiên', async () => {
    localStorage.setItem('moc.session', JSON.stringify(sess()))
    mockApi({
      'GET /me': (u, init) => (init.headers.Authorization === 'Bearer a2' ? { body: { profile } } : { status: 401, body: {} }),
      'POST /auth/refresh': () => ({ body: sess(2) }),
    })
    mount()
    let out
    await act(async () => { out = await box.ctx.authedApi('/me') })
    expect(out.profile.id).toBe('u1')

    localStorage.setItem('moc.session', JSON.stringify(sess()))
    mockApi({ 'GET /me': () => ({ status: 401, body: {} }), 'POST /auth/refresh': () => ({ status: 500, body: {} }) })
    const { unmount } = mount()
    let err
    await act(async () => { err = await box.ctx.authedApi('/me').catch((e) => e) })
    expect(err.status).toBe(500)
    expect(localStorage.getItem('moc.session')).not.toBeNull()
    unmount()
  })

  it('logout: xoá phiên cục bộ ngay, gọi /auth/logout kèm token; server lỗi vẫn không ném', async () => {
    localStorage.setItem('moc.session', JSON.stringify(sess()))
    const f = mockApi({ 'POST /auth/logout': () => ({ status: 500, body: {} }) })
    mount()
    await act(async () => { await box.ctx.logout() })
    expect(localStorage.getItem('moc.session')).toBeNull()
    expect(screen.getByTestId('who')).toHaveTextContent('khach')
    expect(calls(f, '/auth/logout')[0][1].headers.Authorization).toBe('Bearer a1')
  })

  it('logout khi không có phiên cục bộ vẫn gọi server (để xoá cookie HttpOnly), không Authorization', async () => {
    const f = mockApi({ 'POST /auth/logout': () => ({ status: 204 }) })
    mount()
    await act(async () => { await box.ctx.logout() })
    expect(calls(f, '/auth/logout')).toHaveLength(1)
    expect(calls(f, '/auth/logout')[0][1].headers.Authorization).toBeUndefined()
  })

  it('phiên cũ có refreshToken: dọn ngay lần render đầu, giữ accessToken và user', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ ...sess(), refreshToken: 'OLD' }))
    mockApi({})
    mount()
    const saved = JSON.parse(localStorage.getItem('moc.session'))
    expect(saved).toEqual(sess())
    expect(screen.getByTestId('who')).toHaveTextContent('an@example.com')
  })

  it('localStorage hỏng (JSON rác) → coi như chưa đăng nhập, không ném', () => {
    localStorage.setItem('moc.session', '{rac')
    mockApi({})
    mount()
    expect(screen.getByTestId('who')).toHaveTextContent('khach')
  })
})

describe('safeNext', () => {
  it.each([['//evil.com'], ['https://evil.com'], ['javascript:alert(1)'], [''], [null], [undefined], [['/a']], [{}], ['evil.com']])(
    'bác %j',
    (v) => expect(safeNext(v, '/account')).toBe('/account'),
  )
  it.each([['/account'], ['/en/orders?x=1#h'], ['/']])('nhận %s', (v) => expect(safeNext(v, '/account')).toBe(v))

  // RỦI RO: trình duyệt coi "\" như "/" nên "/\evil.com" ≈ "//evil.com" nếu bị đưa vào href/location
  it('bác "/\\evil.com"', () => expect(safeNext('/\\evil.com', '/account')).toBe('/account'))
  it('bác "/<tab>/evil.com" (trình duyệt bỏ tab/newline khi phân giải URL)', () => {
    expect(safeNext('/\t/evil.com', '/account')).toBe('/account')
  })
})

describe('AuthCallbackPage (T-49)', () => {
  it('refresh 500 → báo lỗi và KHÔNG xoá phiên đang có; chỉ gọi refresh một lần (StrictMode-safe)', async () => {
    window.history.replaceState(null, '', '/auth/callback')
    localStorage.setItem('moc.session', JSON.stringify(sess()))
    const f = mockApi({ ...base, 'POST /auth/refresh': () => ({ status: 500, body: {} }) })
    renderAt('/auth/callback')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không đăng nhập được bằng Google')
    expect(localStorage.getItem('moc.session')).not.toBeNull()
    expect(calls(f, '/auth/refresh')).toHaveLength(1)
  })

  it('next là mảng lặp (?next=/a&next=//evil.com) → lấy giá trị đầu, đã kiểm; không điều hướng ra ngoài', async () => {
    window.history.replaceState(null, '', '/auth/callback?next=%2F%2Fevil.com&next=%2Faccount')
    mockApi({ ...base, 'POST /auth/refresh': () => ({ body: sess() }), 'GET /me': () => ({ body: { profile } }) })
    renderAt('/auth/callback?next=%2F%2Fevil.com&next=%2Faccount')
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument()
    expect(window.location.hostname).not.toBe('evil.com')
  })

  it('sau khi xong URL không chứa token', async () => {
    window.history.replaceState(null, '', '/auth/callback')
    mockApi({ ...base, 'POST /auth/refresh': () => ({ body: sess() }), 'GET /me': () => ({ body: { profile } }) })
    renderAt('/auth/callback')
    await screen.findByRole('heading', { name: 'Tài khoản của tôi' })
    expect(window.location.href).not.toMatch(/a1|token/)
  })
})
