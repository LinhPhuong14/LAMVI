// @vitest-environment jsdom
// Feedback 08/10/2026 — mục 2 (menu di động), 3 (login từ checkout), 4 (liên hệ), 5 (pháp lý)
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const site = {
  name: 'LAMVI', legalName: 'Công ty TNHH Mẫu', registration: 'MST 0123456789 · cấp 01/01/2025 tại Sở KH&ĐT',
  address: '1 Đường Mẫu', workshopAddress: 'Xưởng Mẫu', moitUrl: 'https://online.gov.vn/mau', zalo: 'https://zalo.me/mau',
  contactForm: true, supportEmail: 'hotro@lamvi.example', phone: '0901 234 567', hours: '8:00–17:00', social: [{ label: 'Facebook', url: 'https://facebook.com/mau' }],
}
const base = { 'GET /products': () => ({ body: { items: [] } }), 'GET /site': () => ({ body: site }) }

describe('Menu di động', () => {
  it('nút menu mở ngăn kéo có đủ liên kết, đóng bằng Esc và trả focus', async () => {
    mockApi(base)
    renderAt('/')
    const btn = await screen.findByRole('button', { name: 'Menu' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.getAttribute('aria-controls')).toBe('mobile-menu')
    fireEvent.click(btn)
    const dialog = await screen.findByRole('dialog', { name: 'Điều hướng' })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    for (const name of ['Cửa hàng', 'Tài khoản', 'Theo dõi đơn', 'Liên hệ', 'Hỏi đáp']) expect(within(dialog).getByRole('link', { name })).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'EN' })).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    await waitFor(() => expect(within(dialog).getByText(/0901 234 567/)).toBeTruthy())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Điều hướng' })).toBeNull())
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(document.activeElement).toBe(btn)
  })

  it('bấm nền đóng ngăn kéo', async () => {
    mockApi(base)
    renderAt('/')
    fireEvent.click(await screen.findByRole('button', { name: 'Menu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Điều hướng' })
    fireEvent.click(dialog.parentElement)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Điều hướng' })).toBeNull())
  })
})

describe('Trang Liên hệ', () => {
  it('hiện kênh liên hệ thật và form; gửi form gọi API', async () => {
    let sent
    mockApi({ ...base, 'POST /contact': (url, init) => { sent = JSON.parse(init.body); return { status: 202, body: { ok: true } } } })
    renderAt('/contact')
    expect(await screen.findByRole('heading', { level: 1, name: 'Liên hệ LAMVI' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '0901 234 567' })[0].getAttribute('href')).toBe('tel:0901234567')
    expect(screen.getByRole('link', { name: 'Nhắn Zalo' })).toBeTruthy()
    // Footer cũng có ô "Email của bạn" (bản tin) → chỉ tìm trong form liên hệ
    const form = within(screen.getByRole('heading', { name: 'Gửi tin nhắn cho chúng tôi' }).closest('form'))
    fireEvent.change(form.getByLabelText(/Họ tên/), { target: { value: 'Lan' } })
    fireEvent.change(form.getByLabelText('Email của bạn'), { target: { value: 'lan@example.com' } })
    fireEvent.change(form.getByLabelText(/Mã đơn/), { target: { value: 'LV-1' } })
    fireEvent.change(form.getByLabelText(/Nội dung/), { target: { value: 'Đèn bị móp khi nhận hàng' } })
    fireEvent.click(form.getByRole('button', { name: 'Gửi' }))
    expect(await screen.findByText(/Đã nhận tin nhắn của bạn/)).toBeTruthy()
    expect(sent).toMatchObject({ name: 'Lan', email: 'lan@example.com', orderCode: 'LV-1' })
  })

  it('không hiện form khi server chưa bật, không bịa kênh liên hệ', async () => {
    mockApi({ ...base, 'GET /site': () => ({ body: { name: 'LAMVI', social: [], contactForm: false } }) })
    renderAt('/contact')
    expect(await screen.findByText(/đang được cập nhật/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  })
})

describe('Pháp lý', () => {
  it.each([['/terms', 'Điều khoản sử dụng'], ['/shipping', 'Chính sách vận chuyển'], ['/payment', 'Chính sách thanh toán']])('%s có trang', async (path, title) => {
    mockApi(base)
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy()
  })

  it('footer hiện thông tin người bán, dấu Bộ Công Thương và link chính sách', async () => {
    mockApi(base)
    renderAt('/terms')
    await screen.findByRole('heading', { level: 1, name: 'Điều khoản sử dụng' })
    await screen.findByText('Công ty TNHH Mẫu')
    expect(screen.getByText(/MST 0123456789/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Đã thông báo Bộ Công Thương' }).getAttribute('href')).toBe('https://online.gov.vn/mau')
    for (const [name, href] of [['Chính sách vận chuyển', '/shipping'], ['Chính sách thanh toán', '/payment'], ['Điều khoản sử dụng', '/terms'], ['Liên hệ', '/contact']]) {
      expect(screen.getAllByRole('link', { name }).some((a) => a.getAttribute('href') === href)).toBe(true)
    }
  })
})

describe('Đăng nhập từ checkout', () => {
  it('giải thích lý do khi bị chuyển từ /checkout', async () => {
    mockApi(base)
    renderAt('/login?next=%2Fcheckout')
    expect(await screen.findByText('Đăng nhập để lưu lời chúc và theo dõi đơn hàng của bạn.')).toBeTruthy()
  })

  it('đăng nhập thường không hiện chú thích', async () => {
    mockApi(base)
    renderAt('/login')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(/Đăng nhập để lưu lời chúc/)).toBeNull()
  })
})
