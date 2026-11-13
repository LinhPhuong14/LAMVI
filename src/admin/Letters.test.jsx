// @vitest-environment jsdom
// D-134, D-135: soạn phong thư, thư viện QR, trang người nhận
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const URL_QR = 'https://abcdefghij.thu.lamvi.test/#' + 'A'.repeat(43)
const content = { recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: { message: 'Tuổi mới' } }

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.location.hash = ''
})

describe('Soạn phong thư', () => {
  it('lưu nháp gửi nội dung; xuất bản hiện QR + link', async () => {
    const calls = []
    mockApi({
      'GET /me': me,
      'GET /admin/orders/LV-AAA/letter': () => ({ body: { item: null } }),
      'PUT /admin/orders/LV-AAA/letter': (_u, init) => {
        calls.push(JSON.parse(init.body))
        return { body: { item: { status: 'draft', content: JSON.parse(init.body).content, url: null } } }
      },
      'POST /admin/orders/LV-AAA/letter/publish': () => ({ body: { item: { status: 'published', content, url: URL_QR } } }),
    })
    renderAt('/admin/orders/LV-AAA/letter')
    fireEvent.change(await screen.findByLabelText('Tên người nhận'), { target: { value: 'Linh' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'An' } })
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Đoạn một.\n\nĐoạn hai.' } })
    // Xem trước cập nhật theo form
    expect(await screen.findByText('Đoạn hai.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].content).toMatchObject({ recipientName: 'Linh', senderName: 'An', message: 'Đoạn một.\n\nĐoạn hai.' })
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }))
    expect(await screen.findByDisplayValue(URL_QR)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tạo QR mới' })).toBeTruthy()
  })
})

describe('Thư viện QR', () => {
  it('liệt kê QR cũ, lọc theo mã đơn/tên', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/letters': () => ({
        body: {
          items: [
            { orderCode: 'LV-AAA', status: 'published', recipientName: 'Linh', occasion: 'birthday', slug: 'abcdefghij', url: URL_QR, publishedAt: '2026-11-13T00:00:00Z', openedAt: null },
            { orderCode: 'LV-BBB', status: 'draft', recipientName: 'Minh', occasion: 'anniversary', slug: 'bbcdefghij', url: URL_QR.replace('abc', 'bbc'), publishedAt: null, openedAt: '2026-11-13T00:00:00Z' },
          ],
        },
      }),
    })
    renderAt('/admin/letters')
    expect(await screen.findByText('LV-AAA')).toBeTruthy()
    expect(screen.getByText('LV-BBB')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tìm theo mã đơn hoặc tên người nhận'), { target: { value: 'minh' } })
    expect(screen.queryByText('LV-AAA')).toBeNull()
    expect(screen.getByRole('link', { name: 'Sửa thư' }).getAttribute('href')).toBe('/admin/orders/LV-BBB/letter')
  })
})

describe('Trang người nhận /thu/:slug', () => {
  it('gửi slug + token (từ #) trong body; mở phong bì thấy thư', async () => {
    let sent
    mockApi({
      'POST /letters/open': (_u, init) => {
        sent = JSON.parse(init.body)
        return { body: { item: content } }
      },
    })
    window.location.hash = '#' + 'A'.repeat(43)
    renderAt('/thu/abcdefghij')
    fireEvent.click(await screen.findByRole('button', { name: 'Mở thư gửi Linh' }))
    expect(screen.getByText('Đoạn một.')).toBeTruthy()
    expect(sent).toEqual({ slug: 'abcdefghij', token: 'A'.repeat(43) })
    fireEvent.click(screen.getByRole('button', { name: 'Thổi nến' }))
    expect(screen.getByText('Tuổi mới')).toBeTruthy()
  })

  it('không có token → "không tìm thấy", không gọi API', async () => {
    const f = mockApi({})
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(f.mock.calls.filter(([u]) => String(u).includes('/letters/open'))).toHaveLength(0)
  })
})
