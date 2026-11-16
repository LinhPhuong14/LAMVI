// @vitest-environment jsdom
// T-11 independent tests for D-157 (letter language) and D-159/D-161 (teaser + LAMVI outro).
// Ba lỗi tester tìm ra (video thư không dừng, unlock() lỗi chặn exitFullscreen, mất focus khi đóng thẻ mời) đã sửa.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import LetterWeb from './LetterWeb.jsx'
import LetterOutro from './LetterOutro.jsx'
import { letterText, letterLang } from './i18n.js'
import { validateLetterContent } from '../../server/domain/letter.js'

const mm = ({ reduce = true, coarse = false } = {}) =>
  vi.stubGlobal('matchMedia', (q) => ({ matches: (reduce && q.includes('reduce')) || (coarse && q.includes('coarse')), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete HTMLElement.prototype.requestFullscreen
  delete document.exitFullscreen
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn bạn rất nhiều.'], template: 'web', recipientName: 'Lan', senderName: 'An', occasionData: null, postscript: null, lamp: 'thu-hoach' }
const teaser = () => screen.queryByRole('complementary', { name: 'Xem tiếp câu chuyện của LAMVI' })
const stubPlay = () => vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())

function openLetter() {
  fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
  for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
}
function toOutro(letter = base) {
  vi.useFakeTimers()
  const play = stubPlay()
  const utils = render(<LetterWeb letter={letter} />)
  openLetter()
  act(() => vi.advanceTimersByTime(5000))
  fireEvent.click(screen.getByRole('button', { name: /Xem câu chuyện/ }))
  return { ...utils, play }
}
const bars = (c) => [...c.querySelectorAll('.lw-outro-progress b')].map((b) => b.style.transform)
function fsEnv({ unlockThrows = false } = {}) {
  const lock = vi.fn(() => Promise.resolve())
  const unlock = vi.fn(() => {
    if (unlockThrows) throw new Error('NotSupportedError')
  })
  vi.stubGlobal('screen', { orientation: { lock, unlock } })
  const exit = vi.fn(() => Promise.resolve())
  document.exitFullscreen = exit
  HTMLElement.prototype.requestFullscreen = vi.fn(function () {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this })
    return Promise.resolve()
  })
  return { lock, unlock, exit }
}

describe('i18n completeness (D-157)', () => {
  const shape = (o) =>
    Object.fromEntries(
      Object.entries(o)
        .filter(([k]) => k !== 'occasions')
        .map(([k, v]) => [k, v && typeof v === 'object' ? shape(v) : typeof v]),
    )
  it('en/zh have exactly the same nested keys and value types as vi (incl. films.*)', () => {
    for (const lang of ['en', 'zh']) expect(shape(letterText(lang))).toEqual(shape(letterText('vi')))
  })
  it('every films string is non-empty and translated (differs from vi) except brand-neutral ones', () => {
    for (const lang of ['en', 'zh']) {
      const t = letterText(lang).films
      for (const [k, v] of Object.entries(t)) {
        if (typeof v === 'string') {
          expect(v.trim(), `${lang}.films.${k}`).not.toBe('')
          expect(v, `${lang}.films.${k}`).not.toBe(letterText('vi').films[k])
        }
      }
      expect(t.part(2, 2)).toContain('2/2')
    }
  })
  it('letterLang rejects odd input', () => {
    for (const x of ['__proto__', 'constructor', ['en'], { toString: () => 'en' }, null, 'EN', ' en']) expect(letterLang(x)).toBe('vi')
  })
})

describe('server lang normalization (D-157)', () => {
  it('arrays, objects, padded strings, prototype keys → vi; always a string', () => {
    const msg = { occasion: 'birthday', kind: 'text', message: ['Hi'] }
    for (const lang of [['en'], { toString: () => 'en' }, 'en ', 'zh\u0000', 'constructor', 'toString', true, null]) {
      const { value } = validateLetterContent({ ...msg, lang })
      expect(value.lang).toBe('vi')
    }
    const polluted = JSON.parse('{"occasion":"birthday","kind":"text","message":["Hi"],"__proto__":{"lang":"en"}}')
    expect(validateLetterContent(polluted).value.lang).toBe('vi')
  })
})

describe('outro player (D-161)', () => {
  it('progress bar: timeupdate fraction, clamp to 1, ignores NaN duration, part 1 full after advancing', () => {
    mm()
    const { container } = toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    const v = container.querySelector('video')
    expect(bars(container)).toEqual(['scaleX(0)', 'scaleX(0)'])
    Object.defineProperty(v, 'duration', { configurable: true, value: NaN })
    fireEvent.timeUpdate(v)
    expect(bars(container)).toEqual(['scaleX(0)', 'scaleX(0)'])
    Object.defineProperty(v, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(v, 'currentTime', { configurable: true, value: 25 })
    fireEvent.timeUpdate(v)
    expect(bars(container)).toEqual(['scaleX(0.25)', 'scaleX(0)'])
    Object.defineProperty(v, 'currentTime', { configurable: true, value: 150 })
    fireEvent.timeUpdate(v)
    expect(bars(container)[0]).toBe('scaleX(1)')
    Object.defineProperty(v, 'currentTime', { configurable: true, value: 10 })
    fireEvent.ended(v)
    expect(bars(container)).toEqual(['scaleX(1)', 'scaleX(0)'])
  })
  it('replay from end screen restarts at part 1 with empty progress and plays', () => {
    mm()
    const { container, play } = toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    const v = container.querySelector('video')
    Object.defineProperty(v, 'duration', { configurable: true, value: 10 })
    Object.defineProperty(v, 'currentTime', { configurable: true, value: 5 })
    fireEvent.ended(v)
    fireEvent.timeUpdate(container.querySelector('video'))
    fireEvent.ended(container.querySelector('video'))
    expect(container.querySelector('.lw-outro-end')).toBeTruthy()
    play.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại' }))
    expect(container.querySelector('video').getAttribute('src')).toMatch(/tranh-dong-ho/)
    expect(container.textContent).toContain('Phần 1/2')
    expect(bars(container)).toEqual(['scaleX(0)', 'scaleX(0)'])
    expect(play).toHaveBeenCalledTimes(1)
  })
  it('error on part 2 → "Kết thúc" in alert goes to end screen', () => {
    mm()
    const { container } = toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    fireEvent.ended(container.querySelector('video'))
    fireEvent.error(container.querySelector('video'))
    const alert = screen.getByRole('alert')
    fireEvent.click(alert.querySelector('button'))
    expect(container.querySelector('.lw-outro-end')).toBeTruthy()
  })
  it('Esc closes from end screen; afterwards Esc listener is removed', () => {
    mm()
    vi.useFakeTimers()
    stubPlay()
    const onClose = vi.fn()
    render(<LetterOutro onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    fireEvent.click(screen.getByRole('button', { name: /Phần tiếp theo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Kết thúc/ }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('end link: zh letter → /zh/welcome, new tab, noopener', () => {
    mm()
    stubPlay()
    render(<LetterOutro T={letterText('zh')} lang="zh" lamp="nope" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /开始观看/ }))
    fireEvent.click(screen.getByRole('button', { name: /下一部分/ }))
    fireEvent.click(screen.getByRole('button', { name: /结束/ }))
    const a = screen.getByRole('link', { name: /了解更多/ })
    expect(a.getAttribute('href')).toBe('/zh/welcome')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
    expect(document.querySelector('.lw-outro-end-lamp img').getAttribute('src')).toBeTruthy()
  })
})

describe('focus handling', () => {
  it('outro opens with focus on "Bắt đầu xem"; play step focuses "Phần tiếp theo"; closing returns focus to the letter', () => {
    mm()
    toOutro()
    expect(document.activeElement.textContent).toContain('Bắt đầu xem')
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    expect(document.activeElement.textContent).toContain('Phần tiếp theo')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    act(() => vi.advanceTimersByTime(50))
    expect(document.activeElement.classList.contains('lw-letter')).toBe(true)
  })
  it('closing the teaser with × does not drop focus to <body>', () => {
    mm()
    vi.useFakeTimers()
    render(<LetterWeb letter={base} />)
    openLetter()
    act(() => vi.advanceTimersByTime(5000))
    const x = screen.getByRole('button', { name: 'Đóng' })
    x.focus()
    fireEvent.click(x)
    act(() => vi.advanceTimersByTime(50))
    expect(document.activeElement).not.toBe(document.body)
  })
})

describe('fullscreen / orientation robustness', () => {
  it('requestFullscreen throwing synchronously or rejecting does not break playback', async () => {
    for (const mode of ['throw', 'reject']) {
      mm({ coarse: true })
      const lock = vi.fn(() => Promise.resolve())
      vi.stubGlobal('screen', { orientation: { lock, unlock: vi.fn() } })
      HTMLElement.prototype.requestFullscreen = vi.fn(() => {
        if (mode === 'throw') throw new TypeError('nope')
        return Promise.reject(new Error('denied'))
      })
      const { container, play } = toOutro()
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
      await act(async () => {})
      expect(container.querySelector('video')).toBeTruthy()
      expect(play).toHaveBeenCalled()
      expect(lock).not.toHaveBeenCalled()
      cleanup()
      vi.useRealTimers()
    }
  })
  it('no Fullscreen API and no screen.orientation (iPhone-like) → no crash on start/close', async () => {
    mm({ coarse: true })
    vi.stubGlobal('screen', {})
    const { container } = toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    await act(async () => {})
    expect(container.querySelector('video')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('"Xem lại từ đầu" while outro plays fullscreen → outro unmounts, unlocks + exits fullscreen; teaser waits for a new read', async () => {
    mm({ coarse: true })
    const { unlock, exit } = fsEnv()
    toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(unlock).toHaveBeenCalled()
    expect(exit).toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(20000))
    expect(teaser()).toBeNull()
    expect(screen.getByRole('button', { name: 'Bật đèn' })).toBeTruthy()
  })
  it('reaching end screen exits fullscreen; system fullscreen exit unlocks orientation', async () => {
    mm({ coarse: true })
    const { unlock, exit } = fsEnv()
    toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    await act(async () => {})
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    fireEvent(document, new Event('fullscreenchange'))
    expect(unlock).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.body })
    fireEvent.click(screen.getByRole('button', { name: /Phần tiếp theo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Kết thúc/ }))
    expect(exit).toHaveBeenCalled()
  })
  it('orientation.unlock() throwing must not prevent exitFullscreen()', async () => {
    mm({ coarse: true })
    const { exit } = fsEnv({ unlockThrows: true })
    toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(exit).toHaveBeenCalled()
  })
})

describe('teaser timing', () => {
  it('teaser timer elapsing while Surprise open → hidden; shows after surprise closes', () => {
    mm()
    vi.useFakeTimers()
    render(<LetterWeb letter={{ ...base, postscript: 'P.S.' }} />)
    openLetter()
    fireEvent.click(screen.getByRole('button', { name: /Thêm một lời cảm ơn|cảm ơn/i }))
    act(() => vi.advanceTimersByTime(6000))
    expect(teaser()).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(teaser()).toBeTruthy()
  })
  it('video letter: teaser 5s after opening, without needing to play', () => {
    mm()
    vi.useFakeTimers()
    render(<LetterWeb letter={{ ...base, kind: 'video', message: null, videoUrl: '/v.mp4' }} />)
    openLetter()
    act(() => vi.advanceTimersByTime(4900))
    expect(teaser()).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(teaser()).toBeTruthy()
  })
  it('video letter: starting the outro pauses the letter video that is still playing', () => {
    mm()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.useFakeTimers()
    stubPlay()
    const { container } = render(<LetterWeb letter={{ ...base, kind: 'video', message: null, videoUrl: '/v.mp4' }} />)
    openLetter()
    fireEvent.click(screen.getByRole('button', { name: /Xem lời nhắn/ }))
    const letterVideo = container.querySelector('.lw-video video')
    expect(letterVideo).toBeTruthy()
    act(() => vi.advanceTimersByTime(5000))
    fireEvent.click(screen.getByRole('button', { name: /Xem câu chuyện/ }))
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    expect(pause.mock.contexts).toContain(letterVideo)
  })
  it('unknown occasion in an English letter → English surprise label (falls back to justBecause)', () => {
    mm()
    vi.useFakeTimers()
    render(<LetterWeb letter={{ ...base, occasion: 'weird', lang: 'en', postscript: 'P.S.' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turn on the lamp' }))
    for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
    expect(screen.getByRole('button', { name: /One more little thing/ })).toBeTruthy()
  })
})

describe('SSR safety', () => {
  it('renderToString works for LetterWeb (all langs) and LetterOutro', () => {
    for (const lang of ['vi', 'en', 'zh', '__proto__']) expect(renderToString(<LetterWeb letter={{ ...base, lang }} />)).toContain('lw-page')
    expect(renderToString(<LetterOutro onClose={() => {}} />)).toContain('Chiếc đèn của bạn bắt đầu từ một làng nghề')
  })
})

describe('outro: trang phía sau inert', () => {
  it('mở outro → đầu trang, đèn, tờ thư inert; đóng → hết inert', () => {
    mm()
    vi.useFakeTimers()
    stubPlay()
    const { container } = render(<LetterWeb letter={base} />)
    openLetter()
    act(() => vi.advanceTimersByTime(5000))
    fireEvent.click(screen.getByRole('button', { name: /Xem câu chuyện/ }))
    for (const sel of ['.lw-top', '.lw-stage', '.lw-letter-frame']) expect(container.querySelector(sel).hasAttribute('inert')).toBe(true)
    expect(container.querySelector('.lw-outro').closest('[inert]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }))
    for (const sel of ['.lw-top', '.lw-stage', '.lw-letter-frame']) expect(container.querySelector(sel).hasAttribute('inert')).toBe(false)
  })
})

