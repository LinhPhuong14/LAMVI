// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'
import { productsVi } from '../../test/fixtures.js'
import AuthProvider from '../../auth/AuthProvider.jsx'
import { useAuth } from '../../auth/context.js'

// Test bổ sung độc lập cho FR-ACC-001 phía giao diện
const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /products/den-nguyet': () => ({ body: { item: productsVi.items[0] } }),
}
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'Nguyễn An', phone: null, preferredLocale: 'vi', role: 'customer' }

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const calls = (fetchMock, part) => fetchMock.mock.calls.filter(([u]) => String(u).includes(part))
const robots = () => document.head.querySelectorAll('meta[name="robots"]')

describe('AuthProvider — refresh gộp & phiên', () => {
  function Probe() {
    const { authedApi } = useAuth()
    const [out, setOut] = useState(null)
    async function go() {
      const r = await Promise.all([authedApi('/me'), authedApi('/me'), authedApi('/me')])
      setOut(r.map((x) => x.profile.fullName).join(','))
    }
    return (
      <>
        <button onClick={go}>go</button>
        {out && <p>{out}</p>}
      </>
    )
  }

  it('nhiều request 401 đồng thời chỉ gọi refresh một lần, rồi gọi lại bằng token mới', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ ...session, accessToken: 'het-han' }))
    const fetchMock = mockApi({
      'POST /auth/refresh': async () => {
        await new Promise((r) => setTimeout(r, 20))
        return { body: session }
      },
      'GET /me': (url, init) => (init.headers.Authorization === 'Bearer a1' ? { body: { profile } } : { status: 401, body: {} }),
    })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    expect(await screen.findByText('Nguyễn An,Nguyễn An,Nguyễn An')).toBeInTheDocument()
    expect(calls(fetchMock, '/auth/refresh')).toHaveLength(1)
    expect(JSON.parse(calls(fetchMock, '/auth/refresh')[0][1].body)).toEqual({ refreshToken: 'r1' })
    expect(JSON.parse(localStorage.getItem('moc.session')).accessToken).toBe('a1')
  })

  it('lỗi khác 401 (vd 500) không kích hoạt refresh', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const fetchMock = mockApi({ ...base, 'GET /me': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/account')
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra')
    expect(calls(fetchMock, '/auth/refresh')).toHaveLength(0)
    expect(localStorage.getItem('moc.session')).not.toBeNull()
  })

  it('refresh gặp lỗi mạng tạm thời → không xoá phiên, không đẩy về trang đăng nhập', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ ...session, accessToken: 'het-han' }))
    mockApi({
      ...base,
      'GET /me': () => ({ status: 401, body: {} }),
      'POST /auth/refresh': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    renderAt('/account')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được máy chủ')
    expect(screen.queryByRole('heading', { name: 'Đăng nhập' })).toBeNull()
    expect(JSON.parse(localStorage.getItem('moc.session'))?.refreshToken).toBe('r1')
  })

  it.each(['{hỏng', 'undefined', '"chuoi"', '123', '[]', 'null'])('localStorage hỏng (%s) không làm vỡ app → coi như chưa đăng nhập', async (raw) => {
    localStorage.setItem('moc.session', raw)
    mockApi(base)
    renderAt('/account')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('localStorage bị chặn (getItem ném lỗi) → vẫn render trang đăng nhập', async () => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError')
    }
    try {
      mockApi(base)
      renderAt('/account')
      expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
    } finally {
      Storage.prototype.getItem = orig
    }
  })
})

describe('Form — trạng thái gửi', () => {
  it('nút đăng nhập disabled + "Đang xử lý…" khi đang gửi; không gửi 2 lần', async () => {
    let release
    const fetchMock = mockApi({
      ...base,
      'POST /auth/login': () => new Promise((r) => (release = () => r({ status: 401, body: { error: { code: 'INVALID_CREDENTIALS' } } }))),
    })
    renderAt('/login')
    type('Email', 'an@example.com')
    type('Mật khẩu', 'matkhau123')
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    const btn = await screen.findByRole('button', { name: 'Đang xử lý…' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    await waitFor(() => expect(calls(fetchMock, '/auth/login')).toHaveLength(1))
    await act(async () => release())
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeEnabled()
    expect(calls(fetchMock, '/auth/login')).toHaveLength(1)
  })

  it('nút đăng ký, quên mật khẩu, lưu hồ sơ cũng disabled khi đang gửi', async () => {
    const pending = () => new Promise(() => {})
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base, 'POST /auth/register': pending, 'POST /auth/forgot-password': pending, 'GET /me': () => ({ body: { profile } }), 'PATCH /me': pending })

    const r1 = renderAt('/register')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await screen.findByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    r1.unmount()

    const r2 = renderAt('/forgot-password')
    type('Email', 'an@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Gửi email đặt lại' }))
    expect(await screen.findByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    r2.unmount()

    renderAt('/account?tab=profile')
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
  })
})

describe('SEO — noindex (BR-SEO-001)', () => {
  it.each(['/login', '/register', '/forgot-password', '/reset-password', '/en/login', '/zh/register'])(
    '%s đặt đúng một meta robots noindex',
    async (path) => {
      mockApi(base)
      renderAt(path)
      await screen.findByRole('heading', { level: 1 })
      expect(robots()).toHaveLength(1)
      expect(robots()[0].content).toBe('noindex')
    },
  )

  it('/account đặt noindex; rời trang (sang trang chủ) → gỡ meta', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base, 'GET /me': () => ({ body: { profile } }) })
    renderAt('/account?tab=profile')
    await screen.findByDisplayValue('Nguyễn An')
    expect(robots()).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: 'LAMVI' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Tài khoản của tôi' })).toBeNull())
    expect(robots()).toHaveLength(0)
  })

  it('chuyển login → register → forgot không để lại meta trùng', async () => {
    mockApi(base)
    renderAt('/login')
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    fireEvent.click(screen.getByRole('link', { name: 'Chưa có tài khoản? Tạo tài khoản' }))
    await screen.findByRole('heading', { name: 'Tạo tài khoản' })
    expect(robots()).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: 'Đã có tài khoản? Đăng nhập' }))
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    fireEvent.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }))
    await screen.findByRole('heading', { name: 'Quên mật khẩu' })
    expect(robots()).toHaveLength(1)
  })
})

describe('Header & URL ngôn ngữ (D-37)', () => {
  it.each([
    ['/', 'Tài khoản', '/account'],
    ['/en', 'Account', '/en/account'],
    ['/zh', '账户', '/zh/account'],
  ])('trên %s link header "%s" trỏ tới %s', async (path, name, href) => {
    mockApi(base)
    renderAt(path)
    const link = await screen.findByRole('link', { name })
    expect(link).toHaveAttribute('href', href)
  })

  // D-80: trang auth có header riêng — không link tới các phần của landing
  it.each([
    ['/login', '/', '/register'],
    ['/en/login', '/en', '/en/register'],
    ['/register', '/', '/login'],
    ['/zh/forgot-password', '/zh', '/zh/login'],
  ])('trên %s header riêng: logo → %s, nút chuyển → %s, không có link neo landing', async (path, home, cta) => {
    mockApi(base)
    const { container } = renderAt(path)
    await screen.findByRole('heading', { level: 1 })
    const header = container.querySelector('header.nav-auth')
    expect(header).not.toBeNull()
    expect(header.querySelector('a.nav-mark')).toHaveAttribute('href', home)
    expect(header.querySelector('a.nav-cta')).toHaveAttribute('href', cta)
    expect(header.querySelector('.nav-links')).toBeNull()
    expect(header.querySelector('a[href*="#"]')).toBeNull()
    expect(container.querySelector('footer.footer')).toBeNull()
    expect(container.querySelector('footer.auth-foot')).not.toBeNull()
  })

  it('chưa đăng nhập vào /zh/account → /zh/login?next=/zh/account', async () => {
    const fetchMock = mockApi({ ...base, 'POST /auth/login': () => ({ body: session }), 'GET /me': () => ({ body: { profile } }) })
    renderAt('/zh/account')
    expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument()
    type('邮箱', 'an@example.com')
    type('密码', 'matkhau123')
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('heading', { name: '我的账户' })).toBeInTheDocument()
    expect(calls(fetchMock, '/auth/login')).toHaveLength(1)
  })

  it('đăng xuất ở /en/account → về /en', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base, 'GET /me': () => ({ body: { profile } }), 'POST /auth/logout': () => ({ status: 204 }) })
    renderAt('/en/account')
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'My account' })).toBeNull())
    // Trong lúc chờ API đăng xuất, trang tài khoản có thể chuyển qua /login trước khi về /en — chờ tới khi về trang chủ
    expect(await screen.findByRole('link', { name: 'Account' })).toHaveAttribute('href', '/en/account')
    expect(localStorage.getItem('moc.session')).toBeNull()
  })

  it('đăng xuất khi API lỗi mạng vẫn xoá phiên cục bộ', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile } }),
      'POST /auth/logout': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    renderAt('/account')
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }))
    await waitFor(() => expect(localStorage.getItem('moc.session')).toBeNull())
  })
})

describe('Đăng ký thành công', () => {
  it('không cần xác nhận → tự đăng nhập bằng email/mật khẩu vừa nhập rồi vào /en/account', async () => {
    const fetchMock = mockApi({
      ...base,
      'POST /auth/register': () => ({ status: 201, body: { user: session.user, needsConfirmation: false } }),
      'POST /auth/login': () => ({ body: session }),
      'GET /me': () => ({ body: { profile } }),
    })
    renderAt('/en/register')
    type('Full name', 'Nguyễn An')
    type('Email', 'an@example.com')
    type('Password', 'matkhau123')
    type('Phone number (optional)', '0901234567')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    const reg = JSON.parse(calls(fetchMock, '/auth/register')[0][1].body)
    expect(reg).toEqual({ fullName: 'Nguyễn An', email: 'an@example.com', password: 'matkhau123', phone: '0901234567', preferredLocale: 'en' })
    expect(JSON.parse(calls(fetchMock, '/auth/login')[0][1].body)).toEqual({ email: 'an@example.com', password: 'matkhau123' })
    expect(JSON.parse(localStorage.getItem('moc.session')).accessToken).toBe('a1')
  })

  it('next đi qua register: login?next=… → link đăng ký → sau khi đăng ký quay về next', async () => {
    mockApi({
      ...base,
      'POST /auth/register': () => ({ status: 201, body: { user: session.user, needsConfirmation: false } }),
      'POST /auth/login': () => ({ body: session }),
    })
    renderAt('/login?next=%2Fproducts%2Fden-nguyet')
    const link = await screen.findByRole('link', { name: 'Chưa có tài khoản? Tạo tài khoản' })
    expect(link.getAttribute('href')).toBe('/register?next=%2Fproducts%2Fden-nguyet')
    fireEvent.click(link)
    await screen.findByRole('heading', { name: 'Tạo tài khoản' })
    type('Họ và tên', 'Nguyễn An')
    type('Email', 'an@example.com')
    type('Mật khẩu', 'matkhau123')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Đèn Nguyệt' })).toBeInTheDocument()
  })

  it('register?next=//evil.com → bỏ qua, vào /account', async () => {
    mockApi({
      ...base,
      'POST /auth/register': () => ({ status: 201, body: { user: session.user, needsConfirmation: false } }),
      'POST /auth/login': () => ({ body: session }),
      'GET /me': () => ({ body: { profile } }),
    })
    renderAt('/register?next=%2F%2Fevil.com')
    type('Họ và tên', 'Nguyễn An')
    type('Email', 'an@example.com')
    type('Mật khẩu', 'matkhau123')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument()
  })

  it('email đã đăng ký → thông báo EMAIL_TAKEN', async () => {
    mockApi({ ...base, 'POST /auth/register': () => ({ status: 409, body: { error: { code: 'EMAIL_TAKEN' } } }) })
    renderAt('/register')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email này đã được đăng ký.')
  })
})

describe('Lỗi mạng hiển thị đúng ngôn ngữ', () => {
  const offline = () => {
    throw new TypeError('Failed to fetch')
  }

  it.each([
    ['/login', 'Mật khẩu', 'Đăng nhập', 'Không kết nối được máy chủ. Vui lòng thử lại.'],
    ['/en/login', 'Password', 'Sign in', 'Could not reach the server. Please try again.'],
    ['/zh/login', '密码', '登录', '无法连接服务器，请重试。'],
  ])('%s', async (path, pwLabel, submit, message) => {
    mockApi({ ...base, 'POST /auth/login': offline })
    renderAt(path)
    type(pwLabel, 'matkhau123')
    fireEvent.click(screen.getByRole('button', { name: submit }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('quên mật khẩu (en): lỗi mạng → NETWORK_ERROR tiếng Anh; thành công → thông báo chung, gửi lang=en', async () => {
    let fail = true
    const fetchMock = mockApi({
      ...base,
      'POST /auth/forgot-password': () => {
        if (fail) throw new TypeError('Failed to fetch')
        return { status: 202, body: { ok: true } }
      },
    })
    renderAt('/en/forgot-password')
    type('Email', 'an@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If this email is registered')
    expect(String(calls(fetchMock, '/auth/forgot-password')[1][0])).toContain('lang=en')
  })
})

describe('Hồ sơ — PATCH /me', () => {
  it('lưu thành công → "Đã lưu.", gửi đúng dữ liệu kèm token', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const fetchMock = mockApi({
      ...base,
      'GET /me': () => ({ body: { profile } }),
      'PATCH /me': (url, init) => ({ body: { profile: { ...profile, ...JSON.parse(init.body), phone: '0901234567' } } }),
    })
    renderAt('/account?tab=profile')
    await screen.findByDisplayValue('Nguyễn An')
    type('Họ và tên', 'An Nguyễn')
    type('Số điện thoại (không bắt buộc)', '+84 901 234 567')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu.')
    const patch = calls(fetchMock, '/me').find(([, init]) => init.method === 'PATCH')
    expect(patch[1].headers.Authorization).toBe('Bearer a1')
    expect(JSON.parse(patch[1].body)).toEqual({ fullName: 'An Nguyễn', phone: '+84 901 234 567', preferredLocale: 'vi' })
    // Sửa tiếp → ẩn "Đã lưu."
    type('Họ và tên', 'An')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('sau khi lưu, form hiển thị giá trị đã chuẩn hoá mà server trả về (SĐT 0xxxxxxxxx)', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile } }),
      'PATCH /me': () => ({ body: { profile: { ...profile, phone: '0901234567' } } }),
    })
    renderAt('/account?tab=profile')
    await screen.findByDisplayValue('Nguyễn An')
    type('Số điện thoại (không bắt buộc)', '+84 901 234 567')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu.')
    expect(screen.getByLabelText('Số điện thoại (không bắt buộc)')).toHaveValue('0901234567')
  })

  it('lỗi theo trường hiển thị cạnh trường, không hiện "Đã lưu."', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile } }),
      'PATCH /me': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { phone: 'INVALID_PHONE', fullName: 'TOO_LONG' } } } }),
    })
    renderAt('/account?tab=profile')
    await screen.findByDisplayValue('Nguyễn An')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Số điện thoại Việt Nam không hợp lệ.')).toBeInTheDocument()
    expect(screen.getByText('Nội dung quá dài.')).toBeInTheDocument()
    expect(screen.getByLabelText('Số điện thoại (không bắt buộc)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('email hiển thị chỉ đọc; không có ô sửa role', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const fetchMock = mockApi({ ...base, 'GET /me': () => ({ body: { profile } }), 'PATCH /me': () => ({ body: { profile } }) })
    renderAt('/account?tab=profile')
    const email = await screen.findByDisplayValue('an@example.com')
    expect(email).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await screen.findByRole('status')
    const body = JSON.parse(calls(fetchMock, '/me').find(([, i]) => i.method === 'PATCH')[1].body)
    expect(body).not.toHaveProperty('role')
    expect(body).not.toHaveProperty('email')
  })

  it('PATCH gặp 401 → refresh rồi lưu lại thành công', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    let expired = false
    const fetchMock = mockApi({
      ...base,
      'GET /me': () => ({ body: { profile } }),
      'POST /auth/refresh': () => ({ body: { ...session, accessToken: 'a2', refreshToken: 'r2' } }),
      'PATCH /me': (url, init) => (expired && init.headers.Authorization === 'Bearer a1' ? { status: 401, body: {} } : { body: { profile } }),
    })
    renderAt('/account?tab=profile')
    await screen.findByDisplayValue('Nguyễn An')
    expired = true
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu.')
    expect(calls(fetchMock, '/auth/refresh')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('moc.session')).refreshToken).toBe('r2')
  })
})

describe('Đặt lại mật khẩu — giao diện', () => {
  it('hash có access_token nhưng type khác recovery → báo không hợp lệ và vẫn xoá token khỏi URL', async () => {
    window.history.replaceState(null, '', '/reset-password#access_token=tok&type=signup')
    mockApi(base)
    renderAt('/reset-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('không hợp lệ')
    expect(window.location.hash).toBe('')
  })

  it('token khôi phục hết hạn (401) → báo liên kết không hợp lệ', async () => {
    window.history.replaceState(null, '', '/en/reset-password#access_token=old&type=recovery')
    mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }) })
    renderAt('/en/reset-password')
    type('New password', 'matkhaumoi1')
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The reset link is invalid or has expired.')
  })

  it('mật khẩu mới quá ngắn → lỗi cạnh trường', async () => {
    window.history.replaceState(null, '', '/reset-password#access_token=rec&type=recovery')
    mockApi({
      ...base,
      'POST /auth/reset-password': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { password: 'PASSWORD_TOO_SHORT' } } } }),
    })
    renderAt('/reset-password')
    type('Mật khẩu mới', 'ngan')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
    expect(await screen.findByText('Mật khẩu tối thiểu 8 ký tự.', { selector: '.field-error' })).toBeInTheDocument()
  })
})
