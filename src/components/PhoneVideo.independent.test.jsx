// @vitest-environment jsdom
// T-11: kiểm thử độc lập PhoneVideo (D-120) — hydrate, đồng bộ nút với useAutoplayInView, play() bị từ chối
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { PhoneVideo } from './CraftFilms.jsx'

const el = <PhoneVideo title="Hành trình" playLabel="Phát" pauseLabel="Dừng" />

let observers = []
const realIO = window.IntersectionObserver
beforeEach(() => {
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
})
afterEach(() => {
  window.IntersectionObserver = realIO
  vi.restoreAllMocks()
})

const wire = (video, { reject = false } = {}) => {
  let paused = true
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused })
  video.play = vi.fn(() => {
    if (reject) return Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    paused = false
    fireEvent.play(video)
    return Promise.resolve()
  })
  video.pause = vi.fn(() => {
    paused = true
    fireEvent.pause(video)
  })
}

describe('PhoneVideo — độc lập (T-11)', () => {
  it('SSR → hydrate không lệch, không lỗi console; sau hydrate muted=true', async () => {
    const html = renderToString(el)
    expect(html).not.toMatch(/muted/)
    expect(html).not.toMatch(/autoplay/i)
    const root = document.createElement('div')
    root.innerHTML = html
    document.body.appendChild(root)
    const recoverable = []
    const errors = []
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')))
    let r
    await act(async () => {
      r = hydrateRoot(root, el, { onRecoverableError: (e) => recoverable.push(String(e?.message ?? e)) })
    })
    expect(recoverable).toEqual([])
    expect(errors.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([])
    expect(root.querySelector('video').muted).toBe(true)
    expect(root.querySelector('button')).toHaveAttribute('aria-label', 'Phát')
    act(() => r.unmount())
    root.remove()
  })

  it('bấm Dừng qua nút → cuộn ra/vào không tự phát; bấm Phát → tự động trở lại', () => {
    const { container, getByRole } = render(el)
    const video = container.querySelector('video')
    wire(video)
    const see = (v) => act(() => observers[0].cb([{ isIntersecting: v }]))
    see(true)
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(getByRole('button', { name: 'Dừng' })).toBeInTheDocument()
    fireEvent.click(getByRole('button', { name: 'Dừng' }))
    see(false)
    see(true)
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(getByRole('button', { name: 'Phát' })).toBeInTheDocument()
    fireEvent.click(getByRole('button', { name: 'Phát' }))
    expect(video.play).toHaveBeenCalledTimes(2)
    see(false) // tự dừng do cuộn → nhãn về Phát nhưng không đánh dấu người dùng dừng
    expect(video.pause).toHaveBeenCalledTimes(2)
    expect(getByRole('button', { name: 'Phát' })).toBeInTheDocument()
    see(true)
    expect(video.play).toHaveBeenCalledTimes(3)
    expect(getByRole('button', { name: 'Dừng' })).toBeInTheDocument()
  })

  it('play() bị từ chối → nút vẫn là Phát, không ném lỗi chưa bắt', async () => {
    const { container, getByRole } = render(el)
    const video = container.querySelector('video')
    wire(video, { reject: true })
    fireEvent.click(getByRole('button', { name: 'Phát' }))
    await act(async () => {})
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(getByRole('button', { name: 'Phát' })).toBeInTheDocument()
    expect(container.querySelector('.phone-video')).not.toHaveClass('is-playing')
  })

  it('nút là <button type=button>, glow/icon ẩn với trình đọc màn hình', () => {
    const { getByRole } = render(el)
    const btn = getByRole('button', { name: 'Phát' })
    expect(btn).toHaveAttribute('type', 'button')
    for (const s of btn.querySelectorAll('span')) expect(s).toHaveAttribute('aria-hidden', 'true')
  })
})
