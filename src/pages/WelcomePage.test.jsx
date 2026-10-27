// @vitest-environment jsdom
// Trang /welcome (QR dán trên đèn, D-126): cảnh tự chạy nối nhau, dựng ở <body> bằng portal
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'

const W = viMsg.welcome
const names = ['Đèn Thu Hoạch', 'Đèn Tứ Linh', 'Đèn Phúc Lộc', 'Đèn Tam Dương', 'Đèn Lộn Dần']
// Trả về xáo thứ tự: trang phải sắp theo pieceOrder
const products = {
  items: [3, 1, 4, 0, 2].map((o) => ({ slug: `p${o}`, kind: 'single', name: names[o], description: `Mô tả ${o}`, price: 1000, currency: 'VND', pieceOrder: o })),
}
const PORTRAIT = '(orientation: portrait) and (max-width: 700px) and (pointer: coarse)'
const stubMedia = (matching = []) =>
  vi.stubGlobal('matchMedia', (query) => ({ matches: matching.includes(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))

const scene = () => document.querySelector('.welcome-scene:not(.is-leaving)')
const kind = () => [...scene().classList].find((c) => c.startsWith('scene-'))
const zone = (n) => document.querySelector(`.welcome-zone.zone-${n}`)
const tools = () => document.querySelector('.welcome-tools')
const settle = async (ms = 20) => {
  for (let i = 0; i < 6; i++) await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
async function open(path = '/welcome') {
  mockApi({ 'GET /products': () => ({ body: products }) })
  renderAt(path)
  await settle(1)
  expect(document.querySelector('.welcome')).not.toBeNull()
}
// Đi tới cảnh thứ n bằng phím mũi tên phải
const goTo = async (n) => {
  for (let i = 0; i < n; i++) {
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await settle(5)
  }
}

beforeEach(async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  stubMedia()
  // Làm nóng module lazy của route bằng timer thật, để phần còn lại dùng timer giả
  mockApi({ 'GET /products': () => ({ body: products }) })
  renderAt('/welcome')
  await screen.findByRole('region', { name: W.label })
  cleanup()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const k of ['fullscreenEnabled', 'fullscreenElement']) delete document[k]
})

describe('WelcomePage', () => {
  it('dựng ở <body> với vùng carousel có nhãn, noindex, 10 thanh tiến độ và cảnh giới thiệu', async () => {
    await open()
    const region = screen.getByRole('region', { name: W.label })
    expect(region.parentElement).toBe(document.body)
    expect(kind()).toBe('scene-intro')
    expect(screen.getByRole('heading', { level: 1, name: W.introTitle })).toBeInTheDocument()
    expect(document.querySelectorAll('.welcome-bars li')).toHaveLength(10)
    expect(document.querySelector('.welcome-bars li.is-now')).toBe(document.querySelectorAll('.welcome-bars li')[0])
    expect(document.querySelector('meta[name=robots][content*=noindex]')).not.toBeNull()
  })

  it('vùng chạm có nhãn prev/next; prev bị khoá ở đầu', async () => {
    await open()
    expect(zone('prev')).toHaveAttribute('aria-label', W.prev)
    expect(zone('next')).toHaveAttribute('aria-label', W.next)
    expect(zone('prev')).toBeDisabled()
    expect(zone('next')).toBeEnabled()
  })

  it('tự chuyển cảnh sau 7 giây; cảnh cũ giữ 900ms với is-leaving + aria-hidden', async () => {
    await open()
    await advance(6900)
    expect(kind()).toBe('scene-intro')
    await advance(200)
    expect(kind()).toBe('scene-video')
    const old = document.querySelector('.welcome-scene.is-leaving')
    expect(old).toHaveClass('scene-intro')
    expect(old).toHaveAttribute('aria-hidden', 'true')
    await advance(950)
    expect(document.querySelector('.welcome-scene.is-leaving')).toBeNull()
    expect(document.querySelector('.welcome-bars li.is-done')).toBe(document.querySelectorAll('.welcome-bars li')[0])
  })

  it('cảnh video không tự chuyển bằng đồng hồ: chỉ khi video kết thúc; rồi tới video thứ hai', async () => {
    await open()
    await goTo(1)
    expect(kind()).toBe('scene-video')
    const v1 = scene().querySelector('video.welcome-video')
    expect(v1).toHaveAttribute('aria-label', viMsg.films.paperTitle)
    await advance(15000)
    expect(kind()).toBe('scene-video')
    expect(scene().querySelector('video.welcome-video')).toBe(v1)
    fireEvent.ended(v1)
    await settle(5)
    const v2 = scene().querySelector('video.welcome-video')
    expect(v2).not.toBe(v1)
    expect(v2).toHaveAttribute('aria-label', viMsg.artisan.videoTitle)
    fireEvent.ended(v2)
    await settle(5)
    expect(kind()).toBe('scene-lamp')
  })

  it('video chạy quá 20 giây thì tự sang cảnh kế', async () => {
    await open()
    await goTo(1)
    const v = scene().querySelector('video.welcome-video')
    Object.defineProperty(v, 'duration', { value: 60, configurable: true })
    Object.defineProperty(v, 'currentTime', { value: 20.5, configurable: true })
    fireEvent.timeUpdate(v)
    await settle(5)
    expect(scene().querySelector('video.welcome-video')).not.toBe(v)
    expect(scene().querySelector('video.welcome-video')).toHaveAttribute('aria-label', viMsg.artisan.videoTitle)
  })

  it('năm đèn theo pieceOrder, 5,5 giây mỗi đèn, dùng tên và mô tả từ /products', async () => {
    await open()
    await goTo(3)
    for (let i = 0; i < 5; i++) {
      expect(kind()).toBe('scene-lamp')
      expect(scene().querySelector('h2')).toHaveTextContent(names[i])
      expect(scene()).toHaveTextContent(`Mô tả ${i}`)
      await advance(5400)
      expect(scene().querySelector('h2')).toHaveTextContent(names[i])
      await advance(200)
    }
    expect(kind()).toBe('scene-may')
  })

  it('giữ (pointerdown) để tạm dừng, thả ra thì chạy tiếp', async () => {
    await open()
    const stage = document.querySelector('.welcome-stage')
    await advance(3000)
    fireEvent.pointerDown(stage)
    await advance(30000)
    expect(kind()).toBe('scene-intro')
    fireEvent.pointerUp(stage)
    await advance(3900)
    expect(kind()).toBe('scene-intro')
    await advance(600)
    expect(kind()).toBe('scene-video')
  })

  it('nút tạm dừng đổi nhãn và chặn tự chuyển', async () => {
    await open()
    const btn = tools().querySelector('button')
    expect(btn).toHaveAttribute('aria-label', W.pause)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-label', W.play)
    await advance(30000)
    expect(kind()).toBe('scene-intro')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-label', W.pause)
    await advance(7100)
    expect(kind()).toBe('scene-video')
  })

  it('phím mũi tên phải/trái chuyển cảnh, Space tạm dừng', async () => {
    await open()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await settle(5)
    expect(kind()).toBe('scene-video')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await settle(5)
    expect(kind()).toBe('scene-intro')
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(tools().querySelector('button')).toHaveAttribute('aria-label', W.play)
    await advance(30000)
    expect(kind()).toBe('scene-intro')
  })

  it('bấm vùng next/prev chuyển cảnh và cập nhật thanh tiến độ', async () => {
    await open()
    fireEvent.click(zone('next'))
    await settle(5)
    expect(kind()).toBe('scene-video')
    expect(document.querySelectorAll('.welcome-bars li')[1]).toHaveClass('is-now')
    expect(zone('prev')).toBeEnabled()
    fireEvent.click(zone('prev'))
    await settle(5)
    expect(kind()).toBe('scene-intro')
  })

  it('nút tiếng chỉ hiện ở cảnh video', async () => {
    await open()
    const soundOn = () => tools().querySelector(`button[aria-label="${W.soundOn}"]`)
    expect(soundOn()).toBeNull()
    await goTo(1)
    expect(soundOn()).not.toBeNull()
    fireEvent.click(soundOn())
    expect(tools().querySelector(`button[aria-label="${W.soundOff}"]`)).not.toBeNull()
    await goTo(1)
    expect(kind()).toBe('scene-video')
    expect(tools().querySelector(`button[aria-label="${W.soundOff}"]`)).not.toBeNull()
    await goTo(1)
    expect(kind()).toBe('scene-lamp')
    expect(tools().querySelector(`button[aria-label="${W.soundOff}"]`)).toBeNull()
  })

  it('cảnh Mây (9 giây): bấm nút gửi sự kiện lamvi:may-open', async () => {
    await open()
    await goTo(8)
    expect(kind()).toBe('scene-may')
    const onOpen = vi.fn()
    window.addEventListener('lamvi:may-open', onOpen)
    fireEvent.click(screen.getByRole('button', { name: W.mayAsk }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    window.removeEventListener('lamvi:may-open', onOpen)
    await advance(9100)
    expect(kind()).toBe('scene-end')
  })

  it('cảnh cuối không tự chuyển; có Xem bộ sưu tập, Liên hệ; Xem lại về cảnh đầu', async () => {
    await open()
    await goTo(9)
    expect(kind()).toBe('scene-end')
    await advance(120000)
    expect(kind()).toBe('scene-end')
    expect(zone('next')).toBeDisabled()
    expect(screen.getByRole('link', { name: W.endShop })).toHaveAttribute('href', '/shop')
    expect(screen.getByRole('link', { name: W.endContact })).toHaveAttribute('href', '/contact')
    fireEvent.click(screen.getByRole('button', { name: W.replay }))
    await settle(5)
    expect(kind()).toBe('scene-intro')
    expect(document.querySelectorAll('.welcome-bars li')[0]).toHaveClass('is-now')
    expect(zone('prev')).toBeDisabled()
  })

  it('điện thoại dựng đứng (portrait + coarse): hiện nhắc xoay ngang; bấm thì ẩn khi không có toàn màn hình', async () => {
    stubMedia([PORTRAIT])
    await open()
    const hint = document.querySelector('.welcome-rotate')
    expect(hint).toHaveTextContent(W.rotate)
    fireEvent.click(hint)
    expect(document.querySelector('.welcome-rotate')).toBeNull()
  })

  it('màn hình ngang hoặc chuột: không nhắc xoay, không có nút toàn màn hình', async () => {
    stubMedia(['(pointer: coarse)'])
    await open()
    expect(document.querySelector('.welcome-rotate')).toBeNull()
    expect(tools().querySelector(`button[aria-label="${W.landscape}"]`)).toBeNull()
  })

  it('nút toàn màn hình ngang (coarse + fullscreenEnabled) gọi requestFullscreen rồi orientation.lock', async () => {
    stubMedia(['(pointer: coarse)'])
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    const req = vi.fn(() => Promise.resolve())
    const lock = vi.fn(() => Promise.resolve())
    document.documentElement.requestFullscreen = req
    Object.defineProperty(window.screen, 'orientation', { value: { lock, unlock: vi.fn() }, configurable: true })
    await open()
    fireEvent.click(tools().querySelector(`button[aria-label="${W.landscape}"]`))
    await settle(5)
    expect(req).toHaveBeenCalledTimes(1)
    expect(lock).toHaveBeenCalledWith('landscape')
    delete document.documentElement.requestFullscreen
    delete window.screen.orientation
  })

  it('/en/welcome dùng chuỗi tiếng Anh và link /en/shop', async () => {
    await open('/en/welcome')
    expect(screen.getByRole('region', { name: enMsg.welcome.label })).toBeInTheDocument()
    await goTo(9)
    expect(screen.getByRole('link', { name: enMsg.welcome.endShop })).toHaveAttribute('href', '/en/shop')
  })
})

describe('route /welcome', () => {
  it('không có header, footer, thanh tab di động và nút nổi của Mây', async () => {
    await open()
    expect(document.querySelector('header.nav')).toBeNull()
    expect(document.querySelector('footer.footer')).toBeNull()
    expect(document.querySelector('.tab-bar, .mobile-tabs, nav[aria-label*="tab" i]')).toBeNull()
    expect(document.querySelector('.may-fab')).toBeNull()
  })

  it('trang chủ vẫn có header, footer và nút Mây (đối chứng)', async () => {
    mockApi({ 'GET /products': () => ({ body: products }), 'GET /faq': () => ({ body: { items: [] } }) })
    renderAt('/')
    await settle()
    expect(document.querySelector('header.nav')).not.toBeNull()
    expect(document.querySelector('footer.footer')).not.toBeNull()
    expect(document.querySelector('.may-fab')).not.toBeNull()
  })

  it('May.jsx mở khung chat khi nhận sự kiện lamvi:may-open', async () => {
    await open()
    await goTo(8)
    fireEvent.click(screen.getByRole('button', { name: W.mayAsk }))
    await settle()
    expect(document.querySelector('.may-panel, .may-chat, [role=dialog]')).not.toBeNull()
  })
})
