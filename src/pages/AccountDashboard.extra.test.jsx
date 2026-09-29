// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho dashboard tài khoản dạng ứng dụng (§5.2 "Dashboard tài khoản", FR-ACC-001..004)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: faqVi }),
}
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'Nguyễn An', phone: null, preferredLocale: 'vi', role: 'customer' }
const emptyCart = { items: [], subtotalExclVat: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10 }
const fullCart = {
  items: [{ slug: 'den-nguyet', quantity: 2 }],
  subtotalExclVat: 1780000,
  itemCount: 2,
  hasUnavailable: false,
  maxQuantity: 10,
}
const history = [
  { role: 'user', kind: 'question', content: 'Đèn nào hợp tặng mẹ?', createdAt: '2026-09-27T02:00:00Z' },
  { role: 'assistant', kind: 'answer', content: 'Đèn Nguyệt rất hợp.', createdAt: '2026-09-27T02:00:05Z' },
  { role: 'user', kind: 'question', content: 'Giao hàng mấy ngày?', createdAt: '2026-09-28T03:00:00Z' },
  { role: 'assistant', kind: 'answer', content: 'Khoảng 3–5 ngày.', createdAt: '2026-09-28T03:00:04Z' },
]

function login() {
  localStorage.setItem('moc.session', JSON.stringify(session))
}

function api({ me = { body: { profile } }, items = history, historyFails = false, cart = emptyCart, extra = {} } = {}) {
  return mockApi({
    ...base,
    'GET /me': () => me,
    'GET /may/history': () => (historyFails ? { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } } : { body: { items } }),
    'GET /cart': () => ({ body: cart }),
    'POST /auth/logout': () => ({ status: 204 }),
    ...extra,
  })
}

const tablist = () => screen.getByRole('tablist')
const tab = (name) => within(tablist()).getByRole('tab', { name: new RegExp(name) })
const panel = () => screen.getByRole('tabpanel')
const selected = () => within(tablist()).getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')
const header = () => document.querySelector('header.nav')
const footer = () => document.querySelector('footer.footer')

describe('Layout — không header/footer trang giới thiệu trên /account', () => {
  it.each(['/account', '/en/account', '/zh/account/', '/account/?tab=may'])('%s: không có SiteHeader/SiteFooter, có page-app', async (p) => {
    login()
    api()
    renderAt(p)
    await screen.findByRole('tablist')
    expect(header()).toBeNull()
    expect(footer()).toBeNull()
    expect(document.querySelector('.page.page-app')).not.toBeNull()
    // Logo về trang chủ nằm ở thanh bên
    expect(screen.getAllByRole('link', { name: 'LAMVI' })).toHaveLength(1)
  })

  it.each(['/', '/cart', '/login', '/en/login', '/accounts-x'])('%s: vẫn có header/footer, không có page-app', async (p) => {
    api()
    renderAt(p)
    await waitFor(() => expect(header()).not.toBeNull())
    expect(footer()).not.toBeNull()
    expect(document.querySelector('.page-app')).toBeNull()
  })
})

describe('Chưa đăng nhập', () => {
  it('/account?tab=may → login với next giữ query, đăng nhập xong về đúng tab', async () => {
    api({ extra: { 'POST /auth/login': () => ({ body: session }) } })
    renderAt('/account?tab=may')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
    // Link đăng ký giữ next đã mã hoá (kiểm next chứa ?tab=may)
    const reg = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('/register?next='))
    expect(decodeURIComponent(reg.getAttribute('href').split('next=')[1])).toBe('/account?tab=may')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('heading', { name: 'Lịch sử trò chuyện với Mây' })).toBeInTheDocument()
    expect(tab('Trò chuyện')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Tab — chuột, URL, ARIA', () => {
  it('tablist dọc, 4 tab, mặc định Tổng quan; tabpanel gắn nhãn theo tab', async () => {
    login()
    api()
    renderAt('/account')
    await screen.findByRole('tablist')
    expect(tablist()).toHaveAttribute('aria-orientation', 'vertical')
    const tabs = within(tablist()).getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(selected()).toHaveLength(1)
    expect(selected()[0]).toHaveAccessibleName(/Tổng quan/)
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1])
    expect(panel()).toHaveAttribute('aria-labelledby', selected()[0].id)
    expect(screen.getByRole('heading', { level: 1, name: 'Tài khoản của tôi' })).toBeInTheDocument()
  })

  it('bấm tab đổi aria-selected, panel, tiêu đề phụ; tab tổng quan bỏ ?tab', async () => {
    login()
    api()
    renderAt('/account')
    await screen.findByRole('tablist')
    fireEvent.click(tab('Đơn hàng'))
    expect(tab('Đơn hàng')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Đơn hàng').tabIndex).toBe(0)
    expect(panel()).toHaveAttribute('aria-labelledby', 'dash-tab-orders')
    expect(screen.getByText('Theo dõi đèn của bạn từ xưởng tới tay người nhận.')).toBeInTheDocument()
    // Link "LAMVI" giữ nguyên; link đổi ngôn ngữ phản ánh query hiện tại nếu LanguageSwitcher giữ search
    fireEvent.click(tab('Hồ sơ'))
    expect(await screen.findByDisplayValue('Nguyễn An')).toBeInTheDocument()
    fireEvent.click(tab('Tổng quan'))
    expect(selected()[0]).toHaveAccessibleName(/Tổng quan/)
    expect(screen.getByText('Mọi thứ của bạn ở LAMVI, gói gọn trong một trang.')).toBeInTheDocument()
  })

  it.each(['/account?tab=abc', '/account?tab=', '/account?tab=OVERVIEW', '/account?tab=constructor', '/account?tab=__proto__'])(
    '%s → Tổng quan',
    async (p) => {
      login()
      api()
      renderAt(p)
      await screen.findByRole('tablist')
      expect(selected()).toHaveLength(1)
      expect(selected()[0]).toHaveAccessibleName(/Tổng quan/)
      expect(screen.getByRole('heading', { name: 'Trò chuyện gần đây' })).toBeInTheDocument()
    },
  )

  it('?tab=orders: chỗ chờ, không có đơn giả; danh sách tính năng từ i18n', async () => {
    login()
    api()
    renderAt('/account?tab=orders')
    await screen.findByRole('heading', { name: 'Đơn hàng' })
    const items = within(panel()).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual([
      'Theo dõi đèn của bạn đang ở công đoạn nào',
      'Soạn và sửa lời chúc gửi kèm món quà',
      'Xem mã vận đơn khi đèn lên đường',
    ])
    expect(panel().textContent).not.toMatch(/#\d|Mã đơn|₫/)
  })
})

describe('Tab — bàn phím (WAI-ARIA)', () => {
  it('mũi tên xuống/phải/lên/trái, quay vòng, Home/End; focus theo tab', async () => {
    login()
    api()
    renderAt('/account')
    await screen.findByRole('tablist')
    const key = (k) => fireEvent.keyDown(document.activeElement === document.body ? tab('Tổng quan') : document.activeElement, { key: k })
    tab('Tổng quan').focus()

    key('ArrowDown')
    expect(tab('Đơn hàng')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tab('Đơn hàng'))

    key('ArrowRight')
    expect(tab('Trò chuyện')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tab('Trò chuyện'))

    key('ArrowDown')
    key('ArrowDown') // quay vòng từ Hồ sơ về Tổng quan
    expect(tab('Tổng quan')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tab('Tổng quan'))

    key('ArrowUp') // quay vòng từ Tổng quan lên Hồ sơ
    expect(tab('Hồ sơ')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tab('Hồ sơ'))

    key('ArrowLeft')
    expect(tab('Trò chuyện')).toHaveAttribute('aria-selected', 'true')

    key('Home')
    expect(tab('Tổng quan')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tab('Tổng quan'))

    key('End')
    expect(tab('Hồ sơ')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tab('Hồ sơ'))

    // Chỉ một tab trong vòng Tab của trình duyệt
    expect(within(tablist()).getAllByRole('tab').filter((t) => t.tabIndex === 0)).toEqual([tab('Hồ sơ')])
  })

  it('phím khác (Enter, a) không đổi tab', async () => {
    login()
    api()
    renderAt('/account?tab=orders')
    await screen.findByRole('tablist')
    fireEvent.keyDown(tab('Đơn hàng'), { key: 'a' })
    fireEvent.keyDown(tab('Đơn hàng'), { key: 'Tab' })
    expect(tab('Đơn hàng')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Badge', () => {
  it('orders "Sắp có"; may = số tin của khách', async () => {
    login()
    api()
    renderAt('/account')
    await waitFor(() => expect(tab('Trò chuyện').querySelector('.dash-tab-badge')?.textContent).toBe('2'))
    expect(tab('Đơn hàng').querySelector('.dash-tab-badge').textContent).toBe('Sắp có')
    expect(tab('Tổng quan').querySelector('.dash-tab-badge')).toBeNull()
    expect(tab('Hồ sơ').querySelector('.dash-tab-badge')).toBeNull()
  })

  it('không có tin của khách (chỉ tin Mây) → ẩn badge may', async () => {
    login()
    api({ items: [{ role: 'assistant', kind: 'answer', content: 'Chào bạn', createdAt: '2026-09-28T03:00:00Z' }] })
    renderAt('/account')
    await screen.findByText('Chào bạn')
    expect(tab('Trò chuyện').querySelector('.dash-tab-badge')).toBeNull()
  })
})

describe('Tổng quan — số liệu', () => {
  const stats = () => [...document.querySelectorAll('.dash-stat')]

  it('giỏ có hàng: số lượng + tạm tính kèm "chưa gồm VAT" (BR-PRC-003); chỉ đếm tin khách', async () => {
    login()
    api({ cart: fullCart })
    renderAt('/account')
    await waitFor(() => expect(stats()[0].querySelector('.dash-stat-value').textContent).toBe('2'))
    expect(stats()[0].textContent).toMatch(/1\.780\.000/)
    expect(within(stats()[0]).getByText('chưa gồm VAT')).toBeInTheDocument()
    expect(stats()[1].textContent).toContain('Sắp ra mắt')
    await waitFor(() => expect(stats()[2].querySelector('.dash-stat-value').textContent).toBe('2'))
    // Link giỏ ở thanh bên hiển thị số lượng
    expect(screen.getByRole('link', { name: 'Giỏ hàng (2)' })).toBeInTheDocument()
    // Mọi giá hiển thị trên trang đều có chú thích VAT
    for (const p of document.querySelectorAll('.dash-stat-price')) expect(p.parentElement.querySelector('.price-note')).not.toBeNull()
  })

  it('giỏ trống → "Giỏ hàng đang trống", không có giá', async () => {
    login()
    api()
    renderAt('/account')
    await waitFor(() => expect(stats()[0].querySelector('.dash-stat-value').textContent).toBe('0'))
    expect(stats()[0].textContent).toContain('Giỏ hàng đang trống')
    expect(stats()[0].textContent).not.toMatch(/₫/)
    expect(screen.getByRole('link', { name: 'Giỏ hàng' })).toBeInTheDocument()
  })

  it('nút trong ô số liệu chuyển tab', async () => {
    login()
    api()
    renderAt('/account')
    await screen.findByRole('tablist')
    fireEvent.click(within(stats()[1]).getByRole('button'))
    expect(tab('Đơn hàng')).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(tab('Tổng quan'))
    fireEvent.click(within(stats()[2]).getByRole('button'))
    expect(tab('Trò chuyện')).toHaveAttribute('aria-selected', 'true')
  })

  it('lịch sử Mây lỗi → trạng thái trống, không có alert; số câu = 0', async () => {
    login()
    api({ historyFails: true })
    renderAt('/account')
    expect(await screen.findByText('Bạn chưa trò chuyện với Mây.')).toBeInTheDocument()
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(stats()[2].querySelector('.dash-stat-value').textContent).toBe('0')
    expect(screen.queryByRole('button', { name: 'Xem tất cả' })).toBeNull()
    fireEvent.click(tab('Trò chuyện'))
    expect(screen.getByText('Bạn chưa trò chuyện với Mây.')).toBeInTheDocument()
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('trò chuyện gần đây: 2 tin cuối; "Xem tất cả" → tab may', async () => {
    login()
    api()
    renderAt('/account')
    await screen.findByText('Khoảng 3–5 ngày.')
    const recent = document.querySelector('.dash-recent')
    expect([...recent.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['Bạn: Giao hàng mấy ngày?', 'Khoảng 3–5 ngày.'])
    expect(screen.queryByText('Đèn nào hợp tặng mẹ?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }))
    expect(tab('Trò chuyện')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Đèn nào hợp tặng mẹ?')).toBeInTheDocument()
  })

  it('tóm tắt hồ sơ: tên, email, SĐT "Chưa có", ngôn ngữ; "Sửa" → tab hồ sơ', async () => {
    login()
    api()
    renderAt('/account')
    const dl = await waitFor(() => {
      const el = document.querySelector('.dash-facts')
      expect(el).not.toBeNull()
      return el
    })
    const dd = [...dl.querySelectorAll('dd')].map((d) => d.textContent)
    expect(dd).toEqual(['Nguyễn An', 'an@example.com', 'Chưa có', 'Tiếng Việt'])
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }))
    expect(tab('Hồ sơ')).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByDisplayValue('Nguyễn An')).toBeInTheDocument()
  })

  it('có SĐT → hiển thị SĐT', async () => {
    login()
    api({ me: { body: { profile: { ...profile, phone: '0901234567', preferredLocale: 'en' } } } })
    renderAt('/account')
    await screen.findByText('0901234567')
    expect(screen.getByText('English')).toBeInTheDocument()
  })
})

describe('Tab Mây — chia theo ngày giờ VN', () => {
  it('qua nửa đêm giờ VN tách 2 ngày; giờ HH:mm theo VN', async () => {
    login()
    api({
      items: [
        { role: 'user', kind: 'question', content: 'Tin A', createdAt: '2026-09-28T16:00:00Z' }, // 23:00 28/9 VN
        { role: 'assistant', kind: 'answer', content: 'Tin B', createdAt: '2026-09-28T16:30:00Z' }, // 23:30 28/9 VN
        { role: 'user', kind: 'question', content: 'Tin C', createdAt: '2026-09-28T17:30:00Z' }, // 00:30 29/9 VN
      ],
    })
    renderAt('/account?tab=may')
    await screen.findByText('Tin C')
    const day = new Intl.DateTimeFormat('vi', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' })
    const headings = [...document.querySelectorAll('.dash-chat-date')].map((h) => h.textContent)
    expect(headings).toEqual([day.format(new Date('2026-09-28T12:00:00Z')), day.format(new Date('2026-09-29T12:00:00Z'))])
    expect(headings[0]).toMatch(/28/)
    expect(headings[1]).toMatch(/29/)
    const times = [...document.querySelectorAll('.dash-chat-time')].map((t) => t.textContent)
    expect(times).toEqual(['23:00', '23:30', '00:30'])
    // Tin của khách có tiền tố cho trình đọc màn hình
    expect(screen.getByText('Tin A').closest('li').textContent).toContain('Bạn:')
  })

  it('createdAt thiếu/sai → nhóm không tiêu đề ngày, không giờ; không "Invalid Date"', async () => {
    login()
    api({
      items: [
        { role: 'user', kind: 'question', content: 'Không ngày' },
        { role: 'assistant', kind: 'answer', content: 'Ngày hỏng', createdAt: 'not-a-date' },
      ],
    })
    renderAt('/account?tab=may')
    await screen.findByText('Ngày hỏng')
    expect(document.querySelectorAll('.dash-chat-date')).toHaveLength(0)
    expect(document.querySelectorAll('.dash-chat-time')).toHaveLength(0)
    expect(document.querySelectorAll('.dash-chat-day')).toHaveLength(1)
    expect(document.body.textContent).not.toMatch(/Invalid|NaN/)
  })

  it('tin không ngày xen giữa cùng một ngày không lặp tiêu đề ngày', async () => {
    login()
    api({
      items: [
        { role: 'user', kind: 'question', content: 'M1', createdAt: '2026-09-28T03:00:00Z' },
        { role: 'assistant', kind: 'answer', content: 'M2' },
        { role: 'user', kind: 'question', content: 'M3', createdAt: '2026-09-28T04:00:00Z' },
      ],
    })
    renderAt('/account?tab=may')
    await screen.findByText('M3')
    const headings = [...document.querySelectorAll('.dash-chat-date')].map((h) => h.textContent)
    expect(new Set(headings).size).toBe(headings.length)
  })

  it('không có tin → trạng thái trống', async () => {
    login()
    api({ items: [] })
    renderAt('/account?tab=may')
    expect(await screen.findByText('Bạn chưa trò chuyện với Mây.')).toBeInTheDocument()
    expect(document.querySelector('.dash-chat')).toBeNull()
  })
})

describe('Avatar — chữ cái đầu', () => {
  const avatar = () => document.querySelector('.dash-avatar').textContent
  it.each([
    ['Nguyễn An', 'an@example.com', 'A'],
    ['  trần   thị   ánh  ', 'an@example.com', 'Á'],
    ['Lê đức', 'an@example.com', 'Đ'],
    ['Ông 李明', 'an@example.com', '李'],
    ['Nguyen Ánh', 'an@example.com', 'Á'], // tổ hợp NFD → NFC
    ['   ', 'zoe@example.com', 'Z'],
    [null, 'bao@example.com', 'B'],
    ['', 'élise@example.com', 'É'],
  ])('fullName=%j email=%s → %s', async (fullName, email, want) => {
    login()
    api({ me: { body: { profile: { ...profile, fullName, email } } } })
    renderAt('/account')
    await waitFor(() => expect(avatar()).toBe(want))
  })

  it('tên toàn khoảng trắng → lời chào không tên', async () => {
    login()
    api({ me: { body: { profile: { ...profile, fullName: '   ' } } } })
    renderAt('/account')
    await screen.findByText('an@example.com', { selector: '.dash-user-text span' })
    expect(document.querySelector('.dash-user-text strong').textContent).toBe('Xin chào')
    expect(document.querySelector('.dash-top .eyebrow').textContent).toBe('Xin chào')
  })

  it('/me lỗi → avatar lấy từ email trong phiên', async () => {
    login()
    api({ me: { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } } })
    renderAt('/account')
    await screen.findByRole('alert')
    expect(avatar()).toBe('A')
  })
})

describe('i18n — không lộ key thô', () => {
  const RAW = /\b(account|accountMay|errors|cart|auth|locales)\.[a-zA-Z]/
  it.each([
    ['/account', 'Tài khoản của tôi'],
    ['/en/account', 'My account'],
    ['/zh/account', '我的账户'],
  ])('%s: mọi tab không có key thô', async (p, h1) => {
    login()
    api({ cart: fullCart })
    renderAt(p)
    expect(await screen.findByRole('heading', { level: 1, name: h1 })).toBeInTheDocument()
    const tabs = within(tablist()).getAllByRole('tab')
    for (const t of tabs) {
      fireEvent.click(t)
      await waitFor(() => expect(document.body.textContent).not.toMatch(RAW))
      expect(t.textContent.trim()).not.toBe('')
      const sub = document.querySelector('.dash-top-sub').textContent
      expect(sub).not.toMatch(/subtitle/)
      // Không attribute nào chứa key thô (aria-label…)
      for (const el of document.querySelectorAll('[aria-label]')) expect(el.getAttribute('aria-label')).not.toMatch(RAW)
    }
  })

  it('/en/account?tab=may: giờ hiển thị kiểu 24h HH:mm', async () => {
    login()
    api({ items: [{ role: 'user', kind: 'question', content: 'Late', createdAt: '2026-09-28T16:30:00Z' }] })
    renderAt('/en/account?tab=may')
    await screen.findByText('Late')
    expect(document.querySelector('.dash-chat-time').textContent).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('Đăng xuất', () => {
  it('đúng một nút đăng xuất; bấm → gọi API, xoá phiên, về trang chủ (có header lại)', async () => {
    login()
    const fetchMock = api()
    renderAt('/account')
    await screen.findByRole('tablist')
    expect(screen.getAllByRole('button', { name: 'Đăng xuất' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await waitFor(() => expect(localStorage.getItem('moc.session')).toBeNull())
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/logout'))).toBe(true)
    await waitFor(() => expect(header()).not.toBeNull())
    expect(screen.queryByRole('tablist', { name: /tài khoản/ })).toBeNull()
  })

  it('/en/account: đăng xuất về /en', async () => {
    login()
    api()
    renderAt('/en/account')
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(header()).not.toBeNull())
    expect(document.documentElement.lang === 'en' || screen.getAllByRole('link', { name: 'LAMVI' })[0].getAttribute('href') === '/en').toBe(true)
  })
})

describe('SEO & lỗi', () => {
  it.each(['/account', '/account?tab=may', '/zh/account?tab=orders'])('%s: noindex', async (p) => {
    login()
    api()
    renderAt(p)
    await screen.findByRole('tablist')
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex')
  })

  it.each(['/account', '/account?tab=profile', '/account?tab=orders', '/account?tab=may'])('%s + /me 500 → đúng một alert trong panel', async (p) => {
    login()
    api({ me: { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } } })
    renderAt(p)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Có lỗi xảy ra')
    expect(panel()).toContainElement(alert)
    expect(within(panel()).getAllByRole('alert')).toHaveLength(1)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('/me 500 rồi đổi tab → vẫn đúng một alert', async () => {
    login()
    api({ me: { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } } })
    renderAt('/account')
    await screen.findByRole('alert')
    fireEvent.click(tab('Hồ sơ'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    fireEvent.click(tab('Tổng quan'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('CSS dashboard', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  const read = (p) => strip(readFileSync(join(process.cwd(), p), 'utf8'))
  const INDEX = read('src/index.css')
  const PAGES = read('src/styles/pages.css')

  it('mọi var(--x) trong pages.css được định nghĩa', () => {
    const defined = new Set([...(INDEX + PAGES).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const used = [...new Set([...PAGES.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))]
    expect(used.filter((v) => !defined.has(v))).toEqual([])
  })

  it('@keyframes dash-in tồn tại; reduced-motion tắt animation của .dash-panel và .dash-stat', () => {
    expect(PAGES).toMatch(/@keyframes\s+dash-in\b/)
    const blocks = [...PAGES.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1])
    const hit = blocks.find((b) => /\.dash-panel/.test(b) && /\.dash-stat\b/.test(b))
    expect(hit).toBeDefined()
    expect(hit).toMatch(/animation:\s*none/)
  })
})
