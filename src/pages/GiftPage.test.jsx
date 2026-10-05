// @vitest-environment jsdom
// Trang QR lời chúc cho người nhận (FR-QR-002…005, US-004, §21.4)
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const TOKEN = 'a'.repeat(64)
const base = { 'GET /products': () => ({ body: { items: [] } }) }
const active = (over = {}) => ({
  state: 'active',
  lang: 'vi',
  orderKind: 'gift',
  text: 'Chúc mừng sinh nhật!',
  textLang: 'vi',
  translations: {},
  media: {},
  mediaExpired: false,
  mediaExpiresAt: null,
  mediaDaysLeft: null,
  ...over,
})

beforeEach(() => {
  window.gtag = undefined
})

describe('Trang QR lời chúc', () => {
  it('AC-001: mới quét → chỉ có lời chào + nút xác nhận, chưa thấy nội dung', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'greeting', lang: 'vi', orderKind: 'gift' } } }) })
    renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByRole('button', { name: 'Tôi đã nhận được quà' })).toBeInTheDocument()
    expect(screen.queryByText('Chúc mừng sinh nhật!')).toBeNull()
  })

  it('noindex (BR-SEO-001) và không chứa token trong tiêu đề', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'greeting', lang: 'vi', orderKind: 'gift' } } }) })
    renderAt(`/qr/${TOKEN}`)
    await screen.findByRole('button', { name: 'Tôi đã nhận được quà' })
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
    expect(document.title).not.toContain(TOKEN)
  })

  it('AC-002: bấm xác nhận → POST rồi hiện chữ, media và đếm ngược', async () => {
    const fetchMock = mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'greeting', lang: 'vi', orderKind: 'gift' } } }),
      [`POST /qr/${TOKEN}/confirm`]: () => ({
        body: {
          item: active({
            media: {
              voice: { type: 'audio/mpeg', url: '/v.mp3', downloadUrl: '/v.mp3?download=1' },
              video: { type: 'video/mp4', url: '/v.mp4', downloadUrl: '/v.mp4?download=1' },
            },
            mediaDaysLeft: 30,
          }),
        },
      }),
    })
    const { container } = renderAt(`/qr/${TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Tôi đã nhận được quà' }))
    expect(await screen.findByText('Chúc mừng sinh nhật!')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u, i]) => String(u) === `/api/qr/${TOKEN}/confirm` && i.method === 'POST')).toBe(true)
    expect(container.querySelector('audio').getAttribute('src')).toBe('/v.mp3')
    expect(container.querySelector('video').getAttribute('src')).toBe('/v.mp4')
    expect(screen.getAllByRole('link', { name: 'Tải về' })).toHaveLength(2)
    expect(screen.getByText(/xoá sau 30 ngày/)).toBeInTheDocument()
  })

  it('AC-003: hết hạn → còn chữ + thông báo, không có trình phát', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ mediaExpired: true }) } }) })
    const { container } = renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByText('Chúc mừng sinh nhật!')).toBeInTheDocument()
    expect(screen.getByText(/đã hết thời hạn lưu/)).toBeInTheDocument()
    expect(container.querySelector('audio, video')).toBeNull()
  })

  it('AC-004: token không có → trang không tìm thấy chung', async () => {
    mockApi(base)
    renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument()
  })

  it('§21.4(7): đơn chưa gửi → "đang chuẩn bị", không có nút xác nhận', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'preparing', lang: 'vi' } } }) })
    renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByRole('heading', { name: 'Món quà đang được chuẩn bị' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tôi đã nhận được quà' })).toBeNull()
  })

  it('AC-005: "Dịch tự động" hiện bản dịch dưới bản gốc có nhãn; bấm lại thì ẩn; chỉ hiện khi khác ngôn ngữ', async () => {
    const fetchMock = mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: 'Happy birthday!', textLang: 'en' }) } }),
      [`POST /qr/${TOKEN}/translate`]: () => ({ body: { item: { lang: 'vi', text: 'Chúc mừng sinh nhật!', cached: false } } }),
    })
    renderAt(`/qr/${TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Dịch tự động' }))
    const region = await screen.findByRole('region', { name: 'Dịch tự động' })
    expect(region).toHaveTextContent('Chúc mừng sinh nhật!')
    expect(screen.getByText('Happy birthday!')).toBeInTheDocument() // bản gốc vẫn còn
    const body = JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).endsWith('/translate'))[1].body)
    expect(body).toEqual({ lang: 'vi' })
    fireEvent.click(screen.getByRole('button', { name: 'Dịch tự động' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Dịch tự động' })).toBeNull())
    // lần bật lại dùng bản đã có, không gọi API lần hai
    fireEvent.click(screen.getByRole('button', { name: 'Dịch tự động' }))
    await screen.findByRole('region', { name: 'Dịch tự động' })
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/translate'))).toHaveLength(1)
  })

  it('cùng ngôn ngữ với lời chúc → không có nút dịch', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active() } }) })
    renderAt(`/qr/${TOKEN}`)
    await screen.findByText('Chúc mừng sinh nhật!')
    expect(screen.queryByRole('button', { name: 'Dịch tự động' })).toBeNull()
  })

  it('dịch lỗi → báo lỗi, bản gốc vẫn xem được', async () => {
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: 'Hello', textLang: 'en' }) } }),
      [`POST /qr/${TOKEN}/translate`]: () => ({ status: 503, body: { error: { code: 'TRANSLATE_UNAVAILABLE' } } }),
    })
    renderAt(`/qr/${TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Dịch tự động' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('chưa dịch được')
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('đơn không có lời chúc → trang cảm ơn kèm link video mẻ đèn', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: null, textLang: null, batch: { code: 'L-01', title: 'Lô 1' } }) } }) })
    renderAt(`/qr/${TOKEN}`)
    const link = await screen.findByRole('link', { name: 'Xem video mẻ đèn' })
    expect(link.getAttribute('href')).toBe('/lo/L-01')
  })

  it('bản en/zh có chữ riêng', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'greeting', lang: 'en', orderKind: 'gift' } } }) })
    renderAt(`/en/qr/${TOKEN}`)
    expect(await screen.findByRole('button', { name: 'I have received the gift' })).toBeInTheDocument()
  })
})

describe('GA (§23.3)', () => {
  it('open_qr_gift khi mở trang, confirm_gift_received khi xác nhận — không có token trong tham số', async () => {
    const gtag = vi.fn()
    window.gtag = gtag
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'greeting', lang: 'vi', orderKind: 'gift' } } }),
      [`POST /qr/${TOKEN}/confirm`]: () => ({ body: { item: active() } }),
    })
    renderAt(`/qr/${TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Tôi đã nhận được quà' }))
    await screen.findByText('Chúc mừng sinh nhật!')
    const events = gtag.mock.calls.filter(([c]) => c === 'event').map(([, name]) => name)
    expect(events).toContain('open_qr_gift')
    expect(events).toContain('confirm_gift_received')
    expect(events.filter((e) => e === 'open_qr_gift')).toHaveLength(1)
    expect(JSON.stringify(gtag.mock.calls)).not.toContain(TOKEN)
  })
})

describe('Phân loại SSR và GA', () => {
  it('/qr/:token là trang riêng tư ở mọi ngôn ngữ (không SSR nội dung)', async () => {
    const { classifyPath } = await import('../seo/routes.js')
    for (const p of [`/qr/${TOKEN}`, `/en/qr/${TOKEN}`, `/zh/QR/${TOKEN}`]) expect(classifyPath(p).kind).toBe('private')
  })

  it('đường dẫn gửi sang GA không chứa token', async () => {
    const { sanitizePath } = await import('../analytics/ga.js')
    expect(sanitizePath(`/qr/${TOKEN}`)).toBe('/qr/:token')
    expect(sanitizePath(`/en/qr/${TOKEN}`)).not.toContain(TOKEN)
  })
})
