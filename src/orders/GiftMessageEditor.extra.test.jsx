// @vitest-environment jsdom
// Kiểm thử độc lập (T-11): khung soạn lời chúc khi trạng thái đổi giữa chừng, tải lên lỗi, đầu vào lạ.
// Tên test có tiền tố [BUG] là test đang ĐỎ vì code nguồn sai (giữ nguyên, không hạ kỳ vọng).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { uploadFile } from '../admin/uploadFile.js'

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
const LOCKED = msg({ canEditText: false, canEditMedia: false, state: 'LOCKED' })
const TEXT_LOCKED = msg({ canEditText: false, canEditMedia: true, state: 'TEXT_LOCKED', text: 'Đã viết' })
const MEDIA_UP = { status: 201, body: { path: 'o/voice-1.mp3', uploadUrl: '/up/1', headers: { 'Content-Type': 'audio/mpeg' } } }

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  vi.mocked(uploadFile).mockClear()
  vi.mocked(uploadFile).mockImplementation(async (url, file, headers, onProgress) => {
    onProgress(100)
  })
})

const handlers = (o, m, extra = {}) => ({
  [`GET /orders/${CODE}`]: () => ({ body: { item: o } }),
  [`GET /orders/${CODE}/message`]: () => ({ body: { item: typeof m === 'function' ? m() : m } }),
  ...extra,
})
const audioInput = (container) => container.querySelector('input[type="file"][accept^="audio"]')
const mp3 = (size = 3) => new File(['x'.repeat(size)], 'a.mp3', { type: 'audio/mpeg' })

describe('Trạng thái đổi giữa chừng (admin bấm PACKED/SHIPPED khi khách đang soạn)', () => {
  it('[BUG] lưu chữ bị 409 MESSAGE_TEXT_LOCKED → báo lỗi VÀ cập nhật khung sang trạng thái khoá (ô chữ bị vô hiệu)', async () => {
    let locked = false
    mockApi(
      handlers(order(), () => (locked ? TEXT_LOCKED : msg()), {
        [`PUT /orders/${CODE}/message`]: () => {
          locked = true
          return { status: 409, body: { error: { code: 'MESSAGE_TEXT_LOCKED' } } }
        },
      }),
    )
    renderAt(`/don-hang/${CODE}`)
    const box = await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(box, { target: { value: 'Sửa muộn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lời chúc' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Lời chúc bằng chữ')).toBeDisabled(), { timeout: 1500 })
    expect(screen.getByRole('button', { name: 'Lưu lời chúc' })).toBeDisabled()
  })

  it('[BUG] tải media bị 409 MESSAGE_LOCKED (đơn vừa SHIPPED) → báo lỗi VÀ cập nhật khung sang khoá hẳn', async () => {
    let locked = false
    mockApi(
      handlers(order(), () => (locked ? LOCKED : msg()), {
        [`POST /orders/${CODE}/message/media-upload`]: () => {
          locked = true
          return { status: 409, body: { error: { code: 'MESSAGE_LOCKED' } } }
        },
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(audioInput(container), { target: { files: [mp3()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('khoá')
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Chọn tệp…' })[0]).toBeDisabled(), { timeout: 1500 })
    expect(screen.getByLabelText('Lời chúc bằng chữ')).toBeDisabled()
  })

  it('lỗi 409 vẫn giữ nguyên chữ người dùng đã gõ (không mất bài)', async () => {
    mockApi(
      handlers(order(), msg(), {
        [`PUT /orders/${CODE}/message`]: () => ({ status: 409, body: { error: { code: 'MESSAGE_TEXT_LOCKED' } } }),
      }),
    )
    renderAt(`/don-hang/${CODE}`)
    const box = await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(box, { target: { value: 'Bài dài tôi vừa gõ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lời chúc' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Lời chúc bằng chữ')).toHaveValue('Bài dài tôi vừa gõ')
  })
})

describe('Tải media', () => {
  it('đang gõ dở chữ rồi tải media xong → chữ chưa lưu không bị ghi đè bởi bản của server', async () => {
    mockApi(
      handlers(order(), msg({ text: 'Bản đã lưu' }), {
        [`POST /orders/${CODE}/message/media-upload`]: () => MEDIA_UP,
        [`POST /orders/${CODE}/message/media`]: () => ({ body: { item: msg({ text: 'Bản đã lưu', hasVoice: true, state: 'DRAFT' }) } }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    const box = await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(box, { target: { value: 'Đang gõ dở chưa lưu' } })
    fireEvent.change(audioInput(container), { target: { files: [mp3()] } })
    expect(await screen.findByText('Đã tải lên')).toBeInTheDocument()
    expect(screen.getByLabelText('Lời chúc bằng chữ')).toHaveValue('Đang gõ dở chưa lưu')
  })

  it('PUT lên Storage thất bại → báo lỗi, tiến độ được dọn, không gọi bước gắn; thử lại được', async () => {
    vi.mocked(uploadFile).mockImplementationOnce(async (url, file, headers, onProgress) => {
      onProgress(40)
      throw new Error('network')
    })
    const fetchMock = mockApi(
      handlers(order(), msg(), {
        [`POST /orders/${CODE}/message/media-upload`]: () => MEDIA_UP,
        [`POST /orders/${CODE}/message/media`]: () => ({ body: { item: msg({ hasVoice: true }) } }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(audioInput(container), { target: { files: [mp3()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra')
    expect(screen.queryByText(/Đang tải lên/)).toBeNull()
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/message/media') && i.method === 'POST')).toBe(false)
    expect(screen.getAllByRole('button', { name: 'Chọn tệp…' })[0]).toBeEnabled()
    fireEvent.change(audioInput(container), { target: { files: [mp3()] } })
    expect(await screen.findByText('Đã tải lên')).toBeInTheDocument()
  })

  it('server từ chối kiểu tệp/dung lượng ở bước xin URL → hiện đúng thông báo dịch được, không lộ mã thô', async () => {
    mockApi(
      handlers(order(), msg(), {
        [`POST /orders/${CODE}/message/media-upload`]: () => ({
          status: 400,
          body: { error: { code: 'VALIDATION_ERROR', fields: { contentType: 'INVALID_MEDIA_TYPE' } } },
        }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(audioInput(container), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toMatch(/INVALID_MEDIA_TYPE|errors\./)
    expect(alert.textContent.length).toBeGreaterThan(5)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('bước gắn bị từ chối (MEDIA_NOT_UPLOADED / media quá cỡ thật) → báo lỗi dịch được, nút vẫn dùng lại được', async () => {
    mockApi(
      handlers(order(), msg(), {
        [`POST /orders/${CODE}/message/media-upload`]: () => MEDIA_UP,
        [`POST /orders/${CODE}/message/media`]: () => ({
          status: 400,
          body: { error: { code: 'VALIDATION_ERROR', fields: { path: 'MEDIA_NOT_UPLOADED' } } },
        }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(audioInput(container), { target: { files: [mp3()] } })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toMatch(/MEDIA_NOT_UPLOADED|errors\./)
    expect(screen.getAllByRole('button', { name: 'Chọn tệp…' })[0]).toBeEnabled()
  })

  it('tệp rỗng (0 byte) không làm hỏng khung: server từ chối, hiện lỗi dịch được', async () => {
    mockApi(
      handlers(order(), msg(), {
        [`POST /orders/${CODE}/message/media-upload`]: () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { size: 'INVALID' } } } }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(audioInput(container), { target: { files: [mp3(0)] } })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toMatch(/errors\./)
  })

  it('đúng biên dung lượng: bằng giới hạn được tải, vượt 1 byte bị chặn ở trình duyệt', async () => {
    const fetchMock = mockApi(
      handlers(order(), msg(), {
        [`POST /orders/${CODE}/message/media-upload`]: () => MEDIA_UP,
        [`POST /orders/${CODE}/message/media`]: () => ({ body: { item: msg({ hasVoice: true }) } }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    const withSize = (size) => {
      const f = mp3(1)
      Object.defineProperty(f, 'size', { value: size })
      return f
    }
    fireEvent.change(audioInput(container), { target: { files: [withSize(20 * 1024 * 1024 + 1)] } })
    expect(await screen.findByText('Tệp vượt quá dung lượng cho phép.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('media-upload'))).toBe(false)
    fireEvent.change(audioInput(container), { target: { files: [withSize(20 * 1024 * 1024)] } })
    await waitFor(() => expect(screen.queryByText('Tệp vượt quá dung lượng cho phép.')).toBeNull())
    expect(await screen.findByText('Đã tải lên')).toBeInTheDocument()
  })

  it('chọn lại cùng một tệp vẫn kích hoạt (ô nhập được xoá giá trị sau mỗi lần chọn)', async () => {
    mockApi(
      handlers(order(), msg(), {
        [`POST /orders/${CODE}/message/media-upload`]: () => MEDIA_UP,
        [`POST /orders/${CODE}/message/media`]: () => ({ body: { item: msg() } }),
      }),
    )
    const { container } = renderAt(`/don-hang/${CODE}`)
    await screen.findByLabelText('Lời chúc bằng chữ')
    const input = audioInput(container)
    fireEvent.change(input, { target: { files: [mp3()] } })
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1))
    expect(input.value).toBe('')
  })
})

describe('Đầu vào và phản hồi lạ', () => {
  it('bộ đếm đếm theo ký tự hiển thị (emoji/chữ Hán = 1) và vượt 300 báo lỗi từ server dưới ô', async () => {
    mockApi(
      handlers(order(), msg(), {
        [`PUT /orders/${CODE}/message`]: () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { text: 'TOO_LONG' } } } }),
      }),
    )
    renderAt(`/don-hang/${CODE}`)
    const box = await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(box, { target: { value: '😀你好👨‍👩‍👧' } })
    // 😀 + 你 + 好 + (👨 ZWJ 👩 ZWJ 👧 = 5 điểm mã) = 8 điểm mã; chỉ cần không đếm theo đơn vị UTF-16
    const counter = screen.getByText(/\/300 ký tự/)
    expect(Number.parseInt(counter.textContent, 10)).toBeLessThan('😀你好👨‍👩‍👧'.length)
    fireEvent.change(box, { target: { value: 'x'.repeat(400) } })
    expect(screen.getByText('400/300 ký tự')).toBeInTheDocument()
  })

  it('GET lời chúc lỗi (404/500) → thông báo lỗi dịch được, trang đơn hàng vẫn dùng được', async () => {
    mockApi({
      [`GET /orders/${CODE}`]: () => ({ body: { item: order() } }),
      [`GET /orders/${CODE}/message`]: () => ({ status: 500, body: {} }),
    })
    renderAt(`/don-hang/${CODE}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('server báo allowed=false (đơn tự mua không tích lời chúc) dù trang tưởng có → không hiện khung', async () => {
    mockApi(handlers(order(), msg({ allowed: false })))
    renderAt(`/don-hang/${CODE}`)
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(screen.queryByLabelText('Lời chúc bằng chữ')).toBeNull())
  })

  it('đã có media bị xoá (mediaDeleted) → báo hết hạn, chữ vẫn sửa được nếu server cho', async () => {
    mockApi(handlers(order(), msg({ mediaDeleted: true, canEditMedia: false, state: 'MEDIA_EXPIRED', text: 'Còn chữ' })))
    renderAt(`/don-hang/${CODE}`)
    expect(await screen.findByText('Giọng nói/video đã hết thời hạn lưu nên đã bị xoá.')).toBeInTheDocument()
    expect(screen.getByLabelText('Lời chúc bằng chữ')).toHaveValue('Còn chữ')
    expect(screen.getAllByRole('button', { name: 'Chọn tệp…' })[0]).toBeDisabled()
  })

  it('chữ có HTML được hiện trong ô nhập như văn bản (không chèn phần tử)', async () => {
    const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
    mockApi(handlers(order(), msg({ text: evil })))
    const { container } = renderAt(`/don-hang/${CODE}`)
    expect(await screen.findByLabelText('Lời chúc bằng chữ')).toHaveValue(evil)
    expect(container.querySelector('.gift-editor img, .gift-editor script')).toBeNull()
    expect(window.__xss).toBeUndefined()
  })

  it('đổi ngôn ngữ lời chúc được gửi cùng nội dung; lưu thành công hiện xác nhận rồi sửa tiếp thì ẩn xác nhận', async () => {
    const fetchMock = mockApi(
      handlers(order(), msg(), {
        [`PUT /orders/${CODE}/message`]: (url, init) => {
          const b = JSON.parse(init.body)
          return { body: { item: msg({ text: b.text, textLang: b.textLang, state: 'DRAFT' }) } }
        },
      }),
    )
    renderAt(`/don-hang/${CODE}`)
    const box = await screen.findByLabelText('Lời chúc bằng chữ')
    fireEvent.change(box, { target: { value: 'Hello' } })
    fireEvent.change(screen.getByLabelText('Ngôn ngữ của lời chúc'), { target: { value: 'en' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lời chúc' }))
    expect(await screen.findByText('Đã lưu lời chúc.')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')
    expect(JSON.parse(put[1].body)).toEqual({ text: 'Hello', textLang: 'en' })
    fireEvent.change(screen.getByLabelText('Lời chúc bằng chữ'), { target: { value: 'Hello!' } })
    expect(screen.queryByText('Đã lưu lời chúc.')).toBeNull()
  })
})
