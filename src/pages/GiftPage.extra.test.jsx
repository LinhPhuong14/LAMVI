// @vitest-environment jsdom
// Kiểm thử độc lập (T-11): trang QR lời chúc — XSS, phản hồi thiếu trường, lỗi giữa chừng, bấm đúp.
// Tên test có tiền tố [BUG] là test đang ĐỎ vì code nguồn sai (giữ nguyên, không hạ kỳ vọng).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const TOKEN = 'b'.repeat(64)
const base = { 'GET /products': () => ({ body: { items: [] } }) }
const greeting = { state: 'greeting', lang: 'vi', orderKind: 'gift' }
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
const calls = (fetchMock, suffix, method = 'POST') => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith(suffix) && (i?.method ?? 'GET') === method)

beforeEach(() => {
  window.gtag = undefined
  delete window.__xss
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('XSS qua lời chúc: chỉ render văn bản thuần', () => {
  const EVIL = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script><b>đậm</b><a href="javascript:alert(1)">bấm</a>'

  it('chữ gốc và bản dịch chứa HTML được hiện nguyên văn, không sinh phần tử/thuộc tính nguy hiểm', async () => {
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: EVIL, textLang: 'en' }) } }),
      [`POST /qr/${TOKEN}/translate`]: () => ({ body: { item: { lang: 'vi', text: EVIL.replace('đậm', 'dịch'), cached: false } } }),
    })
    const { container } = renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByText(EVIL)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dịch tự động' }))
    await screen.findByRole('region', { name: 'Dịch tự động' })
    const page = container.querySelector('.gift-page')
    expect(page.querySelector('img, script, b, iframe, svg, style')).toBeNull()
    expect(page.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(page.querySelector('[onerror], [onclick], [onmouseover]')).toBeNull()
    expect(window.__xss).toBeUndefined()
  })

  it('mã lô chứa ký tự đặc biệt được mã hoá trong đường dẫn; trình phát không nhận javascript: từ chữ', async () => {
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: null, textLang: null, batch: { code: 'a/b?x=1#"><script>', title: 'T' } }) } }),
    })
    const { container } = renderAt(`/qr/${TOKEN}`)
    const link = await screen.findByRole('link', { name: 'Xem video mẻ đèn' })
    const href = link.getAttribute('href')
    expect(href).toBe('/lo/a%2Fb%3Fx%3D1%23%22%3E%3Cscript%3E')
    expect(container.querySelector('script')).toBeNull()
  })

  it('lang của khối chữ không bị chèn từ giá trị lạ làm hỏng thuộc tính', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ textLang: '" onmouseover="window.__xss=3' }) } }) })
    const { container } = renderAt(`/qr/${TOKEN}`)
    await screen.findByText('Chúc mừng sinh nhật!')
    expect(container.querySelector('[onmouseover]')).toBeNull()
  })
})

describe('API trả cấu trúc thiếu trường', () => {
  it('active chỉ có state → vẫn dựng được trang cảm ơn, không văng lỗi', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'active' } } }) })
    const { container } = renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByRole('heading', { name: 'Cảm ơn bạn đã đón nhận món quà' })).toBeInTheDocument()
    expect(container.querySelector('audio, video')).toBeNull()
  })

  it('media/translations là null, media.voice thiếu url → không văng lỗi', async () => {
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ media: { voice: {} }, translations: null, mediaDaysLeft: 3 }) } }),
    })
    const { container } = renderAt(`/qr/${TOKEN}`)
    await screen.findByText('Chúc mừng sinh nhật!')
    expect(container.querySelector('audio')).not.toBeNull()
    expect(container.querySelector('audio').getAttribute('src')).toBeNull()
    expect(screen.getByText(/xoá sau 3 ngày/)).toBeInTheDocument()
  })

  it('[BUG] phản hồi 200 nhưng thiếu `item` → hiện trang lỗi, không làm trắng cả trang', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Lỗi render không bắt được sẽ phát ra như sự kiện lỗi của window; nuốt để chỉ báo bằng assertion bên dưới
    const swallow = (e) => e.preventDefault()
    window.addEventListener('error', swallow)
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: {} }) })
    const { container } = renderAt(`/qr/${TOKEN}`)
    try {
      await waitFor(() => expect(container.querySelector('h1, [role="alert"]')).not.toBeNull(), { timeout: 800 })
      expect(screen.queryByRole('button', { name: 'Tôi đã nhận được quà' })).toBeNull()
    } finally {
      window.removeEventListener('error', swallow)
    }
  })

  it('[BUG] state lạ (server mới hơn client) → không hiện như đã mở lời chúc/cảm ơn', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'something-new', lang: 'vi' } } }) })
    renderAt(`/qr/${TOKEN}`)
    // Trạng thái lạ → trang lỗi chung, tuyệt đối không như đã mở lời chúc
    expect(await screen.findByRole('heading', { name: 'Chưa mở được lời chúc' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cảm ơn bạn đã đón nhận món quà' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tôi đã nhận được quà' })).toBeNull()
  })

  it('bản dịch trả về thiếu item → báo lỗi chung, bản gốc vẫn xem được', async () => {
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: 'Hello', textLang: 'en' }) } }),
      [`POST /qr/${TOKEN}/translate`]: () => ({ body: {} }),
    })
    renderAt(`/qr/${TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Dịch tự động' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra')
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('chỉ media đã xoá (không còn chữ) → báo hết hạn, không hiện "chưa có lời chúc"', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: null, textLang: null, mediaExpired: true }) } }) })
    renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByText(/đã hết thời hạn lưu/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cảm ơn bạn đã đón nhận món quà' })).toBeNull()
  })

  it('còn 0 ngày → "trong hôm nay"; có chữ lẫn media', async () => {
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ media: { video: { type: 'video/mp4', url: '/v.mp4', downloadUrl: '/v.mp4?d=1' } }, mediaDaysLeft: 0 }) } }),
    })
    renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByText(/xoá trong hôm nay/)).toBeInTheDocument()
  })
})

describe('Lỗi và thao tác giữa chừng', () => {
  it('mất mạng khi mở trang → trang lỗi (không phải "không tìm thấy"), không lộ token', async () => {
    mockApi({ ...base })
    const real = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input, init) => {
        if (String(input).includes('/qr/')) throw new TypeError('Failed to fetch')
        return real(input, init)
      }),
    )
    const { container } = renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByRole('heading', { name: 'Chưa mở được lời chúc' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Không tìm thấy trang' })).toBeNull()
    expect(container.textContent).not.toContain(TOKEN)
    expect(document.title).not.toContain(TOKEN)
  })

  it('429 khi mở trang → thông báo thao tác quá nhanh', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ status: 429, body: { error: { code: 'RATE_LIMITED' } } }) })
    renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByText(/thao tác quá nhanh/)).toBeInTheDocument()
  })

  it('bấm xác nhận hai lần liên tiếp → chỉ một POST', async () => {
    let release
    const gate = new Promise((r) => (release = r))
    const fetchMock = mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: greeting } }),
      [`POST /qr/${TOKEN}/confirm`]: async () => {
        await gate
        return { body: { item: active() } }
      },
    })
    renderAt(`/qr/${TOKEN}`)
    const btn = await screen.findByRole('button', { name: 'Tôi đã nhận được quà' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(btn)
    release()
    await screen.findByText('Chúc mừng sinh nhật!')
    expect(calls(fetchMock, '/confirm')).toHaveLength(1)
  })

  it('xác nhận bị 429/500/mất mạng → báo lỗi, nút bấm lại được, không hiện nội dung', async () => {
    let n = 0
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: greeting } }),
      [`POST /qr/${TOKEN}/confirm`]: () => {
        n += 1
        return n === 1
          ? { status: 429, body: { error: { code: 'RATE_LIMITED' } } }
          : n === 2
            ? { status: 500, body: {} }
            : { body: { item: active() } }
      },
    })
    renderAt(`/qr/${TOKEN}`)
    const click = async () => fireEvent.click(await screen.findByRole('button', { name: 'Tôi đã nhận được quà' }))
    await click()
    expect(await screen.findByRole('alert')).toHaveTextContent('thao tác quá nhanh')
    expect(screen.queryByText('Chúc mừng sinh nhật!')).toBeNull()
    await click()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Có lỗi xảy ra'))
    await click()
    expect(await screen.findByText('Chúc mừng sinh nhật!')).toBeInTheDocument()
  })

  it('đơn bị đổi trạng thái giữa chừng (xác nhận → 409 GIFT_NOT_READY) → tải lại và hiện "đang chuẩn bị"', async () => {
    let loads = 0
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => {
        loads += 1
        return { body: { item: loads === 1 ? greeting : { state: 'preparing', lang: 'vi' } } }
      },
      [`POST /qr/${TOKEN}/confirm`]: () => ({ status: 409, body: { error: { code: 'GIFT_NOT_READY' } } }),
    })
    renderAt(`/qr/${TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Tôi đã nhận được quà' }))
    expect(await screen.findByRole('heading', { name: 'Món quà đang được chuẩn bị' })).toBeInTheDocument()
  })

  it('xác nhận khi QR vừa bị vô hiệu (404) → thông báo lỗi, không lộ gì về đơn', async () => {
    mockApi({
      ...base,
      [`GET /qr/${TOKEN}`]: () => ({ body: { item: greeting } }),
      [`POST /qr/${TOKEN}/confirm`]: () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }),
    })
    const { container } = renderAt(`/qr/${TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Tôi đã nhận được quà' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(container.textContent).not.toContain(TOKEN)
  })

  it('token có ký tự lạ trên URL được mã hoá khi gọi API', async () => {
    const fetchMock = mockApi({ ...base })
    renderAt('/qr/a%20b%2F..%3Fx')
    await screen.findByRole('heading', { name: 'Không tìm thấy trang' })
    const url = fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/qr/'))
    expect(url).toBe('/api/qr/a%20b%2F..%3Fx')
  })

  it('noindex có cả ở trang 404/lỗi và không đặt tiêu đề chứa token', async () => {
    mockApi({ ...base })
    renderAt(`/qr/${TOKEN}`)
    await screen.findByRole('heading', { name: 'Không tìm thấy trang' })
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
    expect(document.title).not.toContain(TOKEN)
  })
})
