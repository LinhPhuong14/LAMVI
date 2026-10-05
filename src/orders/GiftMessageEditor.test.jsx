// @vitest-environment jsdom
// Người mua soạn lời chúc (FR-ACC-003, US-003, BR-MSG-001/008) trên trang chi tiết đơn.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

// XHR không chạy trong jsdom: thay bằng bản giả ghi lại lời gọi
vi.mock('../admin/uploadFile.js', () => ({
  uploadFile: vi.fn(async (url, file, headers, onProgress) => {
    onProgress(100)
  }),
}))

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'khach@lamvi.test' } }
const CODE = 'LV2610-ACDEFGH'
const order = (over = {}) => ({
  code: CODE, status: 'confirmed', orderKind: 'gift', hasMessage: true, qrLang: 'vi', recipientIsSelf: false,
  recipientName: 'B', recipientPhone: '0912345678', addressLine: 'x', province: 'Hà Nội', paymentMethod: 'payos',
  paymentStatus: 'paid', subtotal: 890000, discount: 0, shippingFee: 30000, total: 920000, vatAmount: 83636, vatRate: 0.1,
  createdAt: '2026-10-01T03:00:00.000Z', currency: 'VND',
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', unitPrice: 890000, quantity: 1, lineTotal: 890000 }], ...over,
})
const msg = (over = {}) => ({
  allowed: true, state: 'EMPTY', canEditText: true, canEditMedia: true, text: '', textLang: 'vi',
  hasVoice: false, hasVideo: false, mediaDeleted: false, confirmed: false,
  limits: { maxChars: 300, voiceBytes: 20 * 1024 * 1024, videoBytes: 100 * 1024 * 1024 }, ...over,
})

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
})

const handlers = (o, m, extra = {}) => ({
  [`GET /orders/${CODE}`]: () => ({ body: { item: o } }),
  [`GET /orders/${CODE}/message`]: () => ({ body: { item: m } }),
  ...extra,
})

describe('Khung soạn lời chúc', () => {
  it('đơn có lời chúc: hiện khung, đếm ký tự, lưu bằng PUT', async () => {
    const fetchMock = mockApi(
      handlers(order(), msg(), {
        [`PUT /orders/${CODE}/message`]: (url, init) => {
          const b = JSON.parse(init.body)
          return { body: { item: msg({ text: b.text, state: 'DRAFT' }) } }
        },
      }),
    )
    renderAt(`/don-hang/${CODE}`)
    const box = await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(box, { target: { value: 'Chúc mừng' } })
    expect(screen.getByText('9/300 ký tự')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lời chúc' }))
    expect(await screen.findByText('Đã lưu lời chúc.')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(([u, i]) => String(u) === `/api/orders/${CODE}/message` && i?.method === 'PUT')
    expect(JSON.parse(put[1].body)).toEqual({ text: 'Chúc mừng', textLang: 'vi' })
    expect(screen.getByText('Bản nháp — sửa được')).toBeInTheDocument()
  })

  it('đơn không có lời chúc → không có khung (D-14)', async () => {
    mockApi({ [`GET /orders/${CODE}`]: () => ({ body: { item: order({ hasMessage: false }) } }) })
    renderAt(`/don-hang/${CODE}`)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByLabelText('Lời chúc bằng chữ')).toBeNull()
  })

  it('BR-MSG-008: PACKED → ô chữ bị khoá nhưng vẫn tải media được', async () => {
    mockApi(handlers(order({ status: 'packed' }), msg({ canEditText: false, state: 'TEXT_LOCKED', text: 'Đã viết' })))
    renderAt(`/don-hang/${CODE}`)
    const box = await screen.findByLabelText('Lời chúc bằng chữ')
    expect(box).toBeDisabled()
    expect(box).toHaveValue('Đã viết')
    expect(screen.getByText(/Phần chữ đã khoá/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu lời chúc' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Chọn tệp…' })[0]).toBeEnabled()
  })

  it('BR-MSG-001: SHIPPED → khoá hết', async () => {
    mockApi(handlers(order({ status: 'shipped' }), msg({ canEditText: false, canEditMedia: false, state: 'LOCKED', hasVoice: true })))
    renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    expect(screen.getByText('Lời chúc đã khoá vì đơn đã được gửi đi.')).toBeInTheDocument()
    for (const b of screen.getAllByRole('button', { name: /Chọn tệp|Đổi tệp|Gỡ/ })) expect(b).toBeDisabled()
  })

  it('đơn huỷ → không hiện khung', async () => {
    mockApi(handlers(order({ status: 'cancelled' }), msg()))
    renderAt(`/don-hang/${CODE}`)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByLabelText('Lời chúc bằng chữ')).toBeNull()
  })

  it('lỗi server (quá dài) hiện ngay dưới ô', async () => {
    mockApi(
      handlers(order(), msg(), {
        [`PUT /orders/${CODE}/message`]: () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { text: 'TOO_LONG' } } } }),
      }),
    )
    renderAt(`/don-hang/${CODE}`)
    fireEvent.change(await screen.findByLabelText('Lời chúc bằng chữ'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lời chúc' }))
    await waitFor(() => expect(screen.getAllByText('Nội dung quá dài.').length).toBeGreaterThan(0))
  })

  it('tệp quá giới hạn bị chặn ở trình duyệt, không gọi API tải lên', async () => {
    const fetchMock = mockApi(handlers(order(), msg()))
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    const input = container.querySelector('input[type="file"]')
    const big = new File(['x'], 'a.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [big] } })
    expect(await screen.findByText('Tệp vượt quá dung lượng cho phép.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('media-upload'))).toBe(false)
  })

  it('tải giọng nói: xin URL → tải lên → gắn; hiện "Đã tải lên"; gỡ được', async () => {
    const { uploadFile } = await import('../admin/uploadFile.js')
    const fetchMock = mockApi(
      handlers(order(), msg(), {
        [`POST /orders/${CODE}/message/media-upload`]: () => ({ status: 201, body: { path: 'o/voice-1.mp3', uploadUrl: '/up/1', headers: { 'Content-Type': 'audio/mpeg' } } }),
        [`POST /orders/${CODE}/message/media`]: () => ({ body: { item: msg({ hasVoice: true, state: 'DRAFT' }) } }),
        [`DELETE /orders/${CODE}/message/media/voice`]: () => ({ body: { item: msg() } }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    const file = new File(['abc'], 'a.mp3', { type: 'audio/mpeg' })
    fireEvent.change(container.querySelector('input[type="file"][accept^="audio"]'), { target: { files: [file] } })
    expect(await screen.findByText('Đã tải lên')).toBeInTheDocument()
    const reqUp = JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).endsWith('/media-upload'))[1].body)
    expect(reqUp).toEqual({ kind: 'voice', contentType: 'audio/mpeg', size: 3 })
    expect(uploadFile).toHaveBeenCalledWith('/up/1', file, { 'Content-Type': 'audio/mpeg' }, expect.any(Function))
    const attach = JSON.parse(fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/message/media') && i.method === 'POST')[1].body)
    expect(attach).toEqual({ kind: 'voice', path: 'o/voice-1.mp3' })
    fireEvent.click(screen.getByRole('button', { name: 'Gỡ' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Gỡ' })).toBeNull())
  })

  it('Q-27: người mua chỉ thấy đã xác nhận hay chưa, không có link xem trang QR', async () => {
    mockApi(handlers(order({ status: 'shipped' }), msg({ confirmed: true, state: 'ACTIVE', canEditText: false, canEditMedia: false })))
    const { container } = renderAt(`/don-hang/${CODE}`)
    expect(await screen.findByText('Người nhận đã xác nhận nhận quà.')).toBeInTheDocument()
    expect(container.querySelector('a[href*="/qr/"]')).toBeNull()
  })

  it('bản en dùng chữ en', async () => {
    mockApi(handlers(order(), msg()))
    renderAt(`/en/don-hang/${CODE}`)
    expect(await screen.findByLabelText('Written message')).toBeInTheDocument()
  })
})
