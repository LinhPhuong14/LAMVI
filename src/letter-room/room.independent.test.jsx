// @vitest-environment jsdom
// T-11: independent contract tests; no WebGL renderer is required for the fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterRoom from './LetterRoom'
import { demos, initialState, occasions, roomReducer, validateLetter } from './data'

const ready = { phase: 'ready', progress: 0 }
const step = (state, type, extra = {}) => roomReducer(state, { type, ...extra })

describe('independent room reducer contracts', () => {
  it('completes the ordered flow without mutating the initial state', () => {
    let state = Object.freeze({ ...initialState })
    for (const [action, phase] of [['LIGHT', 'lighting'], ['LIT', 'lit'], ['APPROACH', 'approaching'], ['READY', 'ready'], ['OPEN', 'extracting'], ['READ', 'reading']]) {
      state = step(state, action)
      expect(state.phase).toBe(phase)
    }
    expect(state.progress).toBe(1)
    expect(initialState).toEqual({ phase: 'dark', progress: 0 })
  })

  const validPhase = { LIGHT: 'dark', LIT: 'lighting', APPROACH: 'lit', READY: 'approaching', DRAG: 'ready', RELEASE: 'ready', RETURNED: 'returning', OPEN: 'ready', READ: 'extracting' }
  for (const phase of ['dark', 'lighting', 'lit', 'approaching', 'ready', 'returning', 'extracting', 'reading']) {
    it(`ignores stale, repeated and out-of-order events in ${phase}`, () => {
      const state = Object.freeze({ phase, progress: .25 })
      for (const [action, allowed] of Object.entries(validPhase)) {
        if (allowed !== phase) expect(step(state, action, { value: .8 })).toBe(state)
      }
      expect(step(state, 'UNKNOWN')).toBe(state)
    })
  }

  it.each([[-2, 0], [0, 0], [.399, .399], [1, 1], [3, 1]])('clamps finite drag %s to %s', (value, expected) => {
    expect(step(ready, 'DRAG', { value }).progress).toBe(expected)
  })
  it.each([[.399, 'returning', 0], [.4, 'extracting', 1], [.401, 'extracting', 1]])('settles a release at %s', (progress, phase, end) => {
    expect(step({ ...ready, progress }, 'RELEASE')).toEqual({ phase, progress: end })
  })
  it('cancel wins above the completion threshold and allows a fresh drag', () => {
    const cancelled = step({ ...ready, progress: .99 }, 'RELEASE', { cancel: true })
    expect(cancelled).toEqual({ phase: 'returning', progress: 0 })
    expect(step(cancelled, 'OPEN')).toBe(cancelled)
    expect(step(cancelled, 'RETURNED')).toEqual(ready)
  })
  it.each([NaN, undefined, 'invalid'])('rejects a nonnumeric drag value %s instead of poisoning scene coordinates', value => {
    const result = step(ready, 'DRAG', { value })
    expect(Number.isFinite(result.progress)).toBe(true)
  })
})

describe('independent letter validation contracts', () => {
  it('all seven Vietnamese demos validate, including a long letter and video', () => {
    expect(Object.keys(demos)).toHaveLength(7)
    for (const [occasion, letter] of Object.entries(demos)) {
      expect(validateLetter(letter).occasion).toBe(occasion)
      expect(occasions[occasion]).toBeTruthy()
    }
    expect(demos.birthday.message.join('\n').length).toBeGreaterThan(600)
    expect(demos.longDistance.kind).toBe('video')
  })
  it('normalizes absent occasion data without mutating the caller', () => {
    const letter = { ...demos.anniversary, occasionData: undefined }
    expect(validateLetter(letter).occasionData).toEqual({})
    expect(letter.occasionData).toBeUndefined()
  })
  it.each([null, {}, { ...demos.birthday, message: [42] }, { ...demos.birthday, kind: 'audio' }, { ...demos.birthday, occasion: 'other' }])('rejects missing or invalid required fields %#', value => {
    expect(() => validateLetter(value)).toThrow()
  })
  it.each(['javascript:alert(1)', '//untrusted.test/video', 'http://example.test/video', ''])('rejects unsupported video URL %s', videoUrl => {
    expect(() => validateLetter({ ...demos.longDistance, videoUrl })).toThrow()
  })
  it.each(['toString', 'constructor', '__proto__'])('rejects inherited object key as occasion: %s', occasion => {
    expect(() => validateLetter({ ...demos.birthday, occasion })).toThrow()
  })
  it.each([['anniversary', { photos: 'broken' }], ['anniversary', { photos: [42] }], ['longDistance', { places: {} }]])('rejects malformed %s optional content before render: %j', (occasion, occasionData) => {
    expect(() => validateLetter({ ...demos[occasion], occasionData })).toThrow()
  })
})

describe('independent DOM fallback interaction contracts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(query => ({ matches: query.includes('reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} })))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const tick = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(1500) }) }
  function mount(query = '') {
    return render(<MemoryRouter initialEntries={[`/phong-thu?fallback=1${query}`]}><LetterRoom /></MemoryRouter>)
  }
  async function reachPaper(query = '') {
    const view = mount(query)
    // Native keyboard activation of buttons dispatches click; Enter/Space handling
    // for the extraction control is tested separately below.
    const light = screen.getByRole('button', { name: /Chạm để bật đèn/ })
    light.focus()
    expect(light).toHaveFocus()
    fireEvent.click(light, { detail: 0 })
    await tick()
    const envelope = screen.getByRole('button', { name: /Chạm vào phong bì/ })
    expect(envelope).toHaveFocus()
    fireEvent.click(envelope, { detail: 0 })
    await tick()
    expect(screen.getByRole('button', { name: /Kéo mép giấy lên/ })).toHaveFocus()
    return view
  }
  async function openLetter(query = '') {
    const view = await reachPaper(query)
    fireEvent.keyDown(screen.getByRole('button', { name: /Kéo mép giấy lên/ }), { key: 'Enter' })
    await tick()
    await tick()
    expect(screen.getByRole('article', { name: /Lời chúc gửi Linh/ })).toHaveFocus()
    return view
  }
  it.each(['Enter', ' '])('opens the letter with %j and ignores duplicate extraction activation', async key => {
    await reachPaper()
    const paper = screen.getByRole('button', { name: /Kéo mép giấy lên/ })
    fireEvent.keyDown(paper, { key })
    fireEvent.keyDown(paper, { key })
    await tick()
    await tick()
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText(/Có những ngày mình chỉ muốn/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Kéo mép giấy/ })).not.toBeInTheDocument()
  })
  it('supports assistive-technology click activation without pointer events', async () => {
    await reachPaper()
    fireEvent.click(screen.getByRole('button', { name: /Kéo mép giấy lên/ }), { detail: 0 })
    await tick()
    expect(screen.getByRole('article', { name: /Lời chúc gửi Linh/ })).toBeInTheDocument()
  })
  it.each([['short', 30, false, false], ['threshold', 70, false, true], ['cancelled', 130, true, false], ['tap', 0, false, true]])('settles a %s captured pointer gesture', async (_name, distance, cancel, opens) => {
    await reachPaper()
    const paper = screen.getByRole('button', { name: /Kéo mép giấy lên/ })
    let captured = false
    paper.setPointerCapture = vi.fn(() => { captured = true })
    paper.hasPointerCapture = vi.fn(() => captured)
    paper.releasePointerCapture = vi.fn(() => { captured = false })
    const pointer = (type, y, id = 7) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: 100, clientY: y })
      Object.defineProperty(event, 'pointerId', { value: id })
      fireEvent(paper, event)
    }
    pointer('pointerdown', 200)
    pointer('pointermove', 0, 99) // unrelated pointer must not complete extraction
    if (distance) pointer('pointermove', 200 - distance)
    pointer(cancel ? 'pointercancel' : 'pointerup', 200 - distance)
    await tick()
    expect(paper.setPointerCapture).toHaveBeenCalledWith(7)
    expect(paper.releasePointerCapture).toHaveBeenCalledWith(7)
    if (opens) expect(screen.getByRole('article')).toBeInTheDocument()
    else expect(screen.getByRole('button', { name: /Kéo mép giấy lên/ })).toHaveFocus()
  })
  it('birthday reveal waits for candle activation before showing the wish', async () => {
    await openLetter('&occasion=birthday')
    fireEvent.click(screen.getByRole('button', { name: /Mở chiếc thiệp nhỏ/ }))
    expect(screen.getByText('Ước một điều đi.')).toBeVisible()
    expect(screen.queryByText(demos.birthday.occasionData.message)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tắt nến' }))
    expect(screen.getByText(demos.birthday.occasionData.message)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tắt nến' })).toBeDisabled()
  })
  it('anniversary without photos renders a readable date card', async () => {
    await openLetter('&occasion=anniversary')
    fireEvent.click(screen.getByRole('button', { name: /Kéo kỷ niệm ra ánh sáng/ }))
    expect(screen.getByText(demos.anniversary.occasionData.date)).toBeVisible()
    expect(screen.queryByRole('img', { name: /Kỷ niệm/ })).not.toBeInTheDocument()
  })
  it('missing occasion data and postscript leaves a complete letter without an empty gift', async () => {
    await openLetter('&empty=1')
    expect(screen.getByText('An', { selector: 'strong' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Bất ngờ dành cho bạn' })).not.toBeInTheDocument()
  })
  it('video is loaded only on request; error, retry, captions and surprise remain accessible', async () => {
    const { container } = await openLetter('&occasion=longDistance')
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Xem lời nhắn/ }))
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsinline')
    expect(video).not.toHaveAttribute('muted')
    expect(video.querySelector('track')).toHaveAttribute('src', demos.longDistance.captionsUrl)
    fireEvent.error(video)
    expect(screen.getByRole('status')).toHaveTextContent('Video chưa tải được')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Xem lời nhắn/ }))
    fireEvent.ended(container.querySelector('video'))
    expect(container.querySelector('.lr-ended')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mở hai ô cửa/ }))
    for (const place of demos.longDistance.occasionData.places) expect(screen.getByText(place)).toBeVisible()
  })
})
