// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

// Feature 4 — Trang QR khắc trên đèn (FR-QR-006, BR-QR-002, US-005, D-01, D-10, D-40, D-43, D-44)

const base = {
  'GET /products': () => ({ body: { items: [] } }),
  'GET /faq': () => ({ body: { items: [] } }),
}
const batch = {
  code: 'L-01',
  title: 'Lô tháng 9',
  story: 'Làm ở Yên Thái',
  videoUrl: 'https://cdn.test/l01.mp4',
  producedOn: '2026-09-01',
}
const withBatch = (item = batch, extra = {}) => ({
  ...base,
  [`GET /batches/${item.code}`]: () => ({ body: { item } }),
  ...extra,
})
const robots = () => document.head.querySelectorAll('meta[name="robots"]')
const calledPaths = (fetchMock) => fetchMock.mock.calls.map(([u]) => new URL(u, 'http://localhost').pathname)

const LOCALES = {
  vi: { prefix: '', heading: 'Lô tháng 9', note: /cả lô đèn/, date: 'Ngày làm: 1 tháng 9, 2026' },
  en: { prefix: '/en', heading: 'Lô tháng 9', note: /whole batch/, date: 'Made on: September 1, 2026' },
  zh: { prefix: '/zh', heading: 'Lô tháng 9', note: /整批灯/, date: '制作日期：2026年9月1日' },
}

describe('Trang lô — truy cập công khai (US-005 AC-001)', () => {
  it('không gọi /api/me hay /auth/*, chỉ gọi /api/batches/:code', async () => {
    const fetchMock = mockApi(withBatch())
    renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1, name: 'Lô tháng 9' })
    const paths = calledPaths(fetchMock)
    expect(paths).toContain('/api/batches/L-01')
    expect(paths.some((p) => p === '/api/me' || p.startsWith('/api/auth'))).toBe(false)
    for (const [, init = {}] of fetchMock.mock.calls) {
      expect(init.headers?.Authorization).toBeUndefined()
    }
  })

  it('localStorage có phiên hỏng/hết hạn → vẫn xem được video, không chuyển sang đăng nhập', async () => {
    localStorage.setItem('moc.session', '{hỏng')
    const fetchMock = mockApi(withBatch())
    const { container } = renderAt('/lo/L-01')
    expect(await screen.findByRole('heading', { level: 1, name: 'Lô tháng 9' })).toBeInTheDocument()
    expect(container.querySelector('video')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Đăng nhập' })).toBeNull()
    expect(calledPaths(fetchMock).some((p) => p.startsWith('/api/auth') || p === '/api/me')).toBe(false)
  })

  it('phiên hợp lệ về cú pháp nhưng token hết hạn → không refresh, không gửi token', async () => {
    localStorage.setItem(
      'moc.session',
      JSON.stringify({ accessToken: 'het-han', refreshToken: 'r', expiresAt: 1, user: { email: 'a@b.vn' } }),
    )
    const fetchMock = mockApi(withBatch())
    renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1, name: 'Lô tháng 9' })
    expect(calledPaths(fetchMock).some((p) => p.startsWith('/api/me'))).toBe(false)
    // Chỉ giỏ hàng trên header (FR-CART-001) dùng phiên; API trang lô không gửi token
    for (const [u, init = {}] of fetchMock.mock.calls) {
      if (!String(u).startsWith('/api/cart') && !String(u).startsWith('/api/auth/refresh')) {
        expect(init.headers?.Authorization, String(u)).toBeUndefined()
      }
    }
  })
})

describe('Video lô (FR-QR-006, D-01, NFR-A11Y-001)', () => {
  it('video có controls, playsInline, không autoplay, có nội dung dự phòng', async () => {
    mockApi(withBatch())
    const { container } = renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    const video = container.querySelector('video')
    expect(video.hasAttribute('controls')).toBe(true)
    expect(video.playsInline || video.hasAttribute('playsinline')).toBe(true)
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video.autoplay).toBe(false)
    expect(video.textContent.trim()).toBe('Trình duyệt không phát được video.')
    expect(video.getAttribute('src')).toBe(batch.videoUrl)
  })

  for (const [lang, cfg] of Object.entries(LOCALES)) {
    it(`[${lang}] D-01: giải thích video là của cả lô, không hứa "video của chính chiếc đèn này"`, async () => {
      mockApi(withBatch())
      const { container } = renderAt(`${cfg.prefix}/lo/L-01`)
      await screen.findByRole('heading', { level: 1, name: cfg.heading })
      const main = container.querySelector('main')
      expect(within(main).getByText(cfg.note)).toBeInTheDocument()
      const text = main.textContent
      expect(text).not.toMatch(/chính chiếc đèn này|video (riêng )?của (chiếc )?đèn này|riêng từng đèn/i)
      expect(text).not.toMatch(/this (very |exact )?lantern'?s? (own )?video|video of (this|your) (very |exact )?lantern\b/i)
      expect(text).not.toMatch(/这盏灯(自己)?的视频|您这盏灯的视频/)
    })
  }
})

describe('Thông tin lô theo ngôn ngữ', () => {
  for (const [lang, cfg] of Object.entries(LOCALES)) {
    it(`[${lang}] ngày làm định dạng theo ngôn ngữ`, async () => {
      mockApi(withBatch())
      renderAt(`${cfg.prefix}/lo/L-01`)
      expect(await screen.findByText(cfg.date)).toBeInTheDocument()
    })
  }

  it('producedOn là ngày thuần → không bị lệch ngày theo múi giờ trình duyệt (UTC-7)', async () => {
    const old = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      mockApi(withBatch())
      renderAt('/en/lo/L-01')
      expect(await screen.findByText('Made on: September 1, 2026')).toBeInTheDocument()
    } finally {
      if (old === undefined) delete process.env.TZ
      else process.env.TZ = old
    }
  })

  it('producedOn null → không hiện dòng "Ngày làm"', async () => {
    mockApi(withBatch({ ...batch, producedOn: null }))
    renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(/Ngày làm/)).toBeNull()
    expect(screen.queryByText(/Invalid Date/)).toBeNull()
  })

  it('title null → dùng tiêu đề mặc định theo ngôn ngữ', async () => {
    mockApi(withBatch({ ...batch, title: null }))
    renderAt('/en/lo/L-01')
    expect(await screen.findByRole('heading', { level: 1, name: 'How your lantern was made' })).toBeInTheDocument()
  })

  it('story null → không render đoạn story trống', async () => {
    mockApi(withBatch({ ...batch, story: null }))
    const { container } = renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    expect(container.querySelector('.story-text')).toBeNull()
    for (const p of container.querySelectorAll('main p')) expect(p.textContent.trim()).not.toBe('')
  })

  it('story rỗng "" → không render đoạn trống', async () => {
    mockApi(withBatch({ ...batch, story: '' }))
    const { container } = renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    expect(container.querySelector('.story-text')).toBeNull()
  })

  it('hiển thị mã lô đúng như API trả về (cả khi có ký tự đặc biệt)', async () => {
    const item = { ...batch, code: 'A B' }
    mockApi({ ...base, 'GET /batches/A%20B': () => ({ body: { item } }) })
    renderAt('/lo/A%20B')
    expect(await screen.findByText('Mã lô: A B')).toBeInTheDocument()
  })
})

describe('Trang lỗi (404 vs 500)', () => {
  it('404 → báo không tìm thấy lô, có link về trang chủ', async () => {
    mockApi(base)
    renderAt('/lo/KHONG-CO')
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy lô đèn' })).toBeInTheDocument()
    expect(screen.getByText(/chưa có video hoặc không tồn tại/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Khám phá MỘC' })).toHaveAttribute('href', '/')
  })

  it('500 → thông điệp lỗi chung, KHÔNG nói lô "không tồn tại"/"không tìm thấy"', async () => {
    mockApi({
      ...base,
      'GET /batches/L-01': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }),
    })
    const { container } = renderAt('/lo/L-01')
    expect(await screen.findByText('Có lỗi xảy ra. Vui lòng thử lại sau.')).toBeInTheDocument()
    const main = container.querySelector('main').textContent
    expect(main).not.toMatch(/không tồn tại|Không tìm thấy/i)
  })

  it('[en] 500 → không hiển thị "not found"', async () => {
    mockApi({
      ...base,
      'GET /batches/L-01': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }),
    })
    const { container } = renderAt('/en/lo/L-01')
    await waitFor(() => expect(container.querySelector('main h1')).not.toBeNull())
    expect(container.querySelector('main').textContent).not.toMatch(/not found|does not exist/i)
  })

  it('mất mạng → thông điệp kết nối, không nói "không tồn tại"', async () => {
    mockApi(base)
    const realFetch = globalThis.fetch
    globalThis.fetch = (u, init) =>
      String(u).startsWith('/api/batches') ? Promise.reject(new TypeError('offline')) : realFetch(u, init)
    const { container } = renderAt('/lo/L-01')
    expect(await screen.findByText('Không kết nối được máy chủ. Vui lòng thử lại.')).toBeInTheDocument()
    expect(container.querySelector('main').textContent).not.toMatch(/không tồn tại/)
  })

  it('D-44: trang lỗi 404 và 500 vẫn noindex', async () => {
    mockApi(base)
    const a = renderAt('/lo/KHONG-CO')
    await screen.findByRole('heading', { level: 1 })
    expect(robots()).toHaveLength(1)
    expect(robots()[0].content).toBe('noindex')
    a.unmount()

    mockApi({ ...base, 'GET /batches/L-01': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    expect(robots()).toHaveLength(1)
    expect(robots()[0].content).toBe('noindex')
  })

  it('noindex có ngay khi đang tải (trước khi API trả)', async () => {
    let release
    mockApi({
      ...base,
      'GET /batches/L-01': () => new Promise((r) => (release = () => r({ body: { item: batch } }))),
    })
    renderAt('/lo/L-01')
    expect(screen.getByText('Đang tải video…')).toBeInTheDocument()
    expect(robots()[0]?.content).toBe('noindex')
    await waitFor(() => expect(release).toBeTypeOf('function'))
    release()
    await screen.findByRole('heading', { level: 1 })
  })
})

describe('noindex chỉ ở trang lô (D-44)', () => {
  afterEach(() => {
    document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove())
  })

  it('trang chủ không bị noindex', async () => {
    mockApi(base)
    renderAt('/')
    await waitFor(() => expect(document.querySelector('header')).not.toBeNull())
    expect(robots()).toHaveLength(0)
  })

  it('bấm "Khám phá MỘC" từ trang lô → sang trang chủ, gỡ noindex', async () => {
    mockApi(withBatch())
    renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1, name: 'Lô tháng 9' })
    expect(robots()).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: 'Khám phá MỘC' }))
    await waitFor(() => expect(robots()).toHaveLength(0))
    expect(document.querySelector('.batch')).toBeNull()
  })

  it('bấm logo MỘC trên header từ trang lô lỗi → gỡ noindex', async () => {
    mockApi(base)
    renderAt('/en/lo/KHONG-CO')
    await screen.findByRole('heading', { level: 1 })
    fireEvent.click(screen.getByRole('link', { name: 'MỘC' }))
    await waitFor(() => expect(robots()).toHaveLength(0))
  })

  it('unmount trang lô không để sót thẻ robots', async () => {
    mockApi(withBatch())
    const { unmount } = renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    unmount()
    expect(robots()).toHaveLength(0)
  })
})

describe('Đổi ngôn ngữ trên trang lô (D-37)', () => {
  it('bấm EN → URL /en/lo/L-01, gọi lại API với lang=en, noindex vẫn chỉ 1 thẻ', async () => {
    const fetchMock = mockApi(withBatch())
    renderAt('/lo/L-01')
    await screen.findByText('Mã lô: L-01')
    const sw = screen.getByRole('navigation', { name: /ngôn ngữ|language/i })
    const en = within(sw).getByText('EN')
    expect(en).toHaveAttribute('href', '/en/lo/L-01')
    fireEvent.click(en)
    expect(await screen.findByText('Batch code: L-01')).toBeInTheDocument()
    const urls = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/batches/'))
    expect(urls).toContain('/api/batches/L-01?lang=vi')
    expect(urls).toContain('/api/batches/L-01?lang=en')
    expect(robots()).toHaveLength(1)
  })

  it('từ /zh/lo/L-01 bấm VI → /lo/L-01 (giữ mã lô)', async () => {
    const fetchMock = mockApi(withBatch())
    renderAt('/zh/lo/L-01')
    await screen.findByText('批次编号：L-01')
    const sw = screen.getByRole('navigation', { name: /语言|language/i })
    const viLink = within(sw).getByText('VI')
    expect(viLink).toHaveAttribute('href', '/lo/L-01')
    fireEvent.click(viLink)
    expect(await screen.findByText('Mã lô: L-01')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u) === '/api/batches/L-01?lang=vi')).toBe(true)
  })

  it('mã lô có ký tự đã mã hoá vẫn được giữ khi đổi ngôn ngữ', async () => {
    const item = { ...batch, code: 'a?b' }
    mockApi({ ...base, 'GET /batches/a%3Fb': () => ({ body: { item } }) })
    renderAt('/lo/a%3Fb')
    await screen.findByText('Mã lô: a?b')
    const en = within(screen.getByRole('navigation', { name: /ngôn ngữ|language/i })).getByText('EN')
    expect(en.getAttribute('href')).toBe('/en/lo/a%3Fb')
  })
})
