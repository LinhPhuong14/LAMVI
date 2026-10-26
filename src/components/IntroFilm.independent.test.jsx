// @vitest-environment jsdom
// T-11: kiểm thử độc lập IntroFilm (video giới thiệu đầu trang chủ) và việc HomePage render nó trước #hero
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { IntroFilm } from './CraftFilms.jsx'
import { CRAFT_FILMS } from '../data/craftFilms.js'

const state = vi.hoisted(() => ({ reduce: false }))
vi.mock('../lib/hydration.js', () => ({
  useHydratedReducedMotion: () => state.reduce,
  useHydrated: () => true,
}))

const proto = HTMLMediaElement.prototype
const orig = { play: proto.play, pause: proto.pause, paused: Object.getOwnPropertyDescriptor(proto, 'paused') }
const pausedMap = new WeakMap()
let playImpl
let playSpy
let pauseSpy

beforeEach(() => {
  state.reduce = false
  playImpl = function () {
    pausedMap.set(this, false)
    fireEvent.play(this)
    return Promise.resolve()
  }
  playSpy = vi.fn(function () {
    return playImpl.call(this)
  })
  pauseSpy = vi.fn(function () {
    pausedMap.set(this, true)
    fireEvent.pause(this)
  })
  proto.play = playSpy
  proto.pause = pauseSpy
  Object.defineProperty(proto, 'paused', { configurable: true, get() { return pausedMap.get(this) ?? true } })
})
afterEach(() => {
  proto.play = orig.play
  proto.pause = orig.pause
  Object.defineProperty(proto, 'paused', orig.paused)
})

const setup = async (props = { ctaHref: '#hero' }) => {
  let r
  await act(async () => {
    r = render(<IntroFilm {...props} />)
  })
  return { ...r, video: r.container.querySelector('video') }
}

describe('IntroFilm — độc lập (T-11)', () => {
  it('render <video> autoplay/muted/loop/playsinline + poster + source đúng', async () => {
    const { video, container } = await setup()
    expect(video.autoplay).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.muted).toBe(true)
    expect(video).toHaveAttribute('playsinline')
    expect(video.getAttribute('poster')).toBe(CRAFT_FILMS.paper.poster)
    const src = video.querySelector('source')
    expect(src.getAttribute('src')).toBe(CRAFT_FILMS.paper.src)
    expect(src.getAttribute('type')).toBe('video/mp4')
    expect(video.getAttribute('aria-label')).toBeTruthy()
    expect(container.querySelector('section.intro-film')).toBeInTheDocument()
  })

  it('tự phát khi mount; bấm nút khi đang phát → pause, khi đang dừng → play; aria-label đổi', async () => {
    const { getByRole, video } = await setup()
    expect(playSpy).toHaveBeenCalledTimes(1)
    const pauseBtn = getByRole('button', { name: 'Dừng video' })
    fireEvent.click(pauseBtn)
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(video.paused).toBe(true)
    const playBtn = getByRole('button', { name: 'Phát video' })
    expect(playBtn).toHaveTextContent('▶')
    fireEvent.click(playBtn)
    expect(playSpy).toHaveBeenCalledTimes(2)
    expect(getByRole('button', { name: 'Dừng video' })).toHaveTextContent('❚❚')
  })

  it('nút tiếng đổi muted và aria-label (Bật tiếng ↔ Tắt tiếng)', async () => {
    const { getByRole, video } = await setup()
    expect(video.muted).toBe(true)
    fireEvent.click(getByRole('button', { name: 'Bật tiếng' }))
    expect(video.muted).toBe(false)
    expect(getByRole('button', { name: 'Tắt tiếng' })).toHaveTextContent('🔊')
    fireEvent.click(getByRole('button', { name: 'Tắt tiếng' }))
    expect(video.muted).toBe(true)
    expect(getByRole('button', { name: 'Bật tiếng' })).toHaveTextContent('🔇')
  })

  it('bật tiếng khi đang dừng → tự phát lại', async () => {
    const { getByRole, video } = await setup()
    fireEvent.click(getByRole('button', { name: 'Dừng video' }))
    expect(video.paused).toBe(true)
    playSpy.mockClear()
    fireEvent.click(getByRole('button', { name: 'Bật tiếng' }))
    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(video.muted).toBe(false)
    expect(getByRole('button', { name: 'Dừng video' })).toBeInTheDocument()
  })

  it('giảm chuyển động → không gọi play() tự động, nút hiện "Phát video"', async () => {
    state.reduce = true
    const { getByRole, video } = await setup()
    expect(playSpy).not.toHaveBeenCalled()
    expect(pauseSpy).toHaveBeenCalled()
    expect(getByRole('button', { name: 'Phát video' })).toBeInTheDocument()
    // người dùng vẫn phát được thủ công
    fireEvent.click(getByRole('button', { name: 'Phát video' }))
    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(video.paused).toBe(false)
  })

  it('play() reject → nút hiện trạng thái đang dừng, không lỗi chưa bắt', async () => {
    playImpl = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    const { getByRole } = await setup()
    await act(async () => {})
    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(getByRole('button', { name: 'Phát video' })).toHaveTextContent('▶')
  })

  it('bấm Phát thủ công mà play() reject → không ném lỗi chưa bắt', async () => {
    playImpl = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    const { getByRole } = await setup()
    await act(async () => {})
    fireEvent.click(getByRole('button', { name: 'Phát video' }))
    await act(async () => {})
    expect(playSpy).toHaveBeenCalledTimes(2)
    expect(getByRole('button', { name: 'Phát video' })).toBeInTheDocument()
  })

  it('CTA có href="#hero" (theo prop ctaHref) và là liên kết', async () => {
    const { container } = await setup({ ctaHref: '#hero' })
    const cta = container.querySelector('a.btn')
    expect(cta).toHaveAttribute('href', '#hero')
    expect(cta).toHaveTextContent('Xem bộ sưu tập')
    for (const b of container.querySelectorAll('button')) expect(b).toHaveAttribute('type', 'button')
  })

  it('HomePage render <IntroFilm ctaHref="#hero" /> trước <Hero /> (#hero)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/HomePage.jsx'), 'utf8')
    const i = src.indexOf('<IntroFilm ctaHref="#hero" />')
    const h = src.indexOf('<Hero />')
    expect(i).toBeGreaterThan(-1)
    expect(h).toBeGreaterThan(i)
    expect(src).toMatch(/<section id="hero"/)
  })
})
