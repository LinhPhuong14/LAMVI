// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { LocaleContext } from '../i18n/index.js'
import CraftFilms, { CraftVideo } from './CraftFilms.jsx'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'

const renderFilms = (lang = 'vi') =>
  render(
    <LocaleContext.Provider value={lang}>
      <LazyMotion features={domAnimation} strict>
        <CraftFilms />
      </LazyMotion>
    </LocaleContext.Provider>,
  )

describe('CraftFilms — video làng nghề tự host (D-118)', () => {
  it('video tự host, không tải trước (preload="none"), có poster và nhãn', () => {
    const { container } = render(<CraftVideo film={CRAFT_FILMS.dongho} title="Đông Hồ" />)
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('preload', 'none')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('poster', CRAFT_FILMS.dongho.poster)
    expect(video).toHaveAttribute('aria-label', 'Đông Hồ')
    expect(container.querySelector('source')).toHaveAttribute('src', CRAFT_FILMS.dongho.src)
  })

  it('mọi video nằm cùng origin (/videos/…) — CSP media-src \'self\' đã đủ, không mở host ngoài', () => {
    for (const f of Object.values(CRAFT_FILMS)) {
      expect(f.src).toMatch(/^\/videos\/[a-z0-9-]+\.mp4$/)
      expect(f.poster).toMatch(/^\/videos\/[a-z0-9-]+\.webp$/)
    }
  })

  it('mục #films hiện video làng giấy dó với chú thích theo ngôn ngữ', () => {
    for (const [lang, msg] of [['vi', viMsg], ['en', enMsg], ['zh', zhMsg]]) {
      const { container, getAllByText, unmount } = renderFilms(lang)
      expect(container.querySelector('source')).toHaveAttribute('src', CRAFT_FILMS.paper.src)
      expect(getAllByText(msg.films.paperTitle).length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('vi/en/zh có đủ chữ cho video nghệ nhân', () => {
    for (const msg of [viMsg, enMsg, zhMsg]) {
      expect(msg.artisan.videoTitle).toBeTruthy()
      expect(msg.artisan.videoCaption).toBeTruthy()
    }
  })
})

describe('CraftVideo — tự phát khi cuộn tới', () => {
  let observers = []
  const realIO = window.IntersectionObserver
  const setup = () => {
    observers = []
    window.IntersectionObserver = class {
      constructor(cb, opts) {
        this.cb = cb
        this.opts = opts
        observers.push(this)
      }
      observe() {}
      disconnect() {}
    }
    const { container } = render(<CraftVideo film={CRAFT_FILMS.paper} title="Giấy dó" />)
    const video = container.querySelector('video')
    let paused = true
    Object.defineProperty(video, 'paused', { get: () => paused })
    video.play = vi.fn(() => {
      paused = false
      fireEvent.play(video)
      return Promise.resolve()
    })
    video.pause = vi.fn(() => {
      paused = true
      fireEvent.pause(video)
    })
    const see = (isIntersecting) => act(() => observers[0].cb([{ isIntersecting }]))
    return { video, see }
  }
  afterEach(() => {
    window.IntersectionObserver = realIO
  })

  it('vào khung nhìn ≥ 50% → tự phát không tiếng; ra khỏi → dừng; vào lại → phát tiếp', () => {
    const { video, see } = setup()
    expect(observers[0].opts.threshold).toBe(0.5)
    see(true)
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(video.muted).toBe(true)
    see(false)
    expect(video.pause).toHaveBeenCalledTimes(1)
    see(true)
    expect(video.play).toHaveBeenCalledTimes(2)
  })

  it('người xem bấm dừng thì cuộn ra vào không tự phát lại', () => {
    const { video, see } = setup()
    see(true)
    act(() => video.pause()) // người xem bấm dừng (không phải do cuộn)
    see(false)
    see(true)
    expect(video.play).toHaveBeenCalledTimes(1)
  })

  it('không gắn thuộc tính autoplay (chỉ phát khi thấy, SSR không tự tải video)', () => {
    const { video } = setup()
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video).toHaveAttribute('preload', 'none')
  })
})
