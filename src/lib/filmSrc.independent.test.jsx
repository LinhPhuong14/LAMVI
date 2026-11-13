// @vitest-environment jsdom
// Test độc lập cho bản video nhẹ (T-103): edge case ngoài filmSrc.test.jsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { renderToString } from 'react-dom/server'
import { render } from '@testing-library/react'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { CraftVideo } from '../components/CraftFilms.jsx'
import { pickFilmSrc, wantsLiteFilm } from './filmSrc.js'

const media = (matches) => vi.stubGlobal('matchMedia', () => ({ matches, addEventListener() {}, removeEventListener() {} }))
const connection = (c) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete navigator.connection
})

describe('wantsLiteFilm: navigator.connection', () => {
  const film = CRAFT_FILMS.paper

  it.each([undefined, null, {}, { effectiveType: undefined }, { effectiveType: '' }, { saveData: false }])(
    'connection = %o trên màn rộng: bản 720p, không crash',
    (c) => {
      media(false)
      connection(c)
      expect(wantsLiteFilm()).toBe(false)
      expect(pickFilmSrc(film)).toBe(film.src)
    },
  )

  it('connection rỗng nhưng màn hẹp: vẫn bản 360p', () => {
    media(true)
    connection({})
    expect(pickFilmSrc(film)).toBe(film.srcLite)
  })

  it("effectiveType 'slow-2g' trên màn rộng: bản 360p", () => {
    media(false)
    connection({ effectiveType: 'slow-2g' })
    expect(pickFilmSrc(film)).toBe(film.srcLite)
  })

  it('effectiveType viết hoa hoặc lạ ("5g") không bị coi là mạng chậm', () => {
    media(false)
    connection({ effectiveType: '5g' })
    expect(wantsLiteFilm()).toBe(false)
  })
})

describe('wantsLiteFilm: môi trường thiếu API', () => {
  it('matchMedia = undefined không crash, trả false', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => wantsLiteFilm()).not.toThrow()
    expect(wantsLiteFilm()).toBe(false)
    expect(pickFilmSrc(CRAFT_FILMS.paper)).toBe(CRAFT_FILMS.paper.src)
  })

  it('matchMedia undefined nhưng saveData bật: vẫn bản 360p', () => {
    vi.stubGlobal('matchMedia', undefined)
    connection({ saveData: true })
    expect(pickFilmSrc(CRAFT_FILMS.paper)).toBe(CRAFT_FILMS.paper.srcLite)
  })

  it('không có window (SSR thật): false, kể cả khi film có srcLite', () => {
    vi.stubGlobal('window', undefined)
    expect(wantsLiteFilm()).toBe(false)
    expect(pickFilmSrc(CRAFT_FILMS.dongho)).toBe(CRAFT_FILMS.dongho.src)
  })
})

describe('CraftVideo', () => {
  it('SSR (renderToString) luôn ra bản 720p dù màn hẹp và mạng chậm', () => {
    media(true)
    connection({ saveData: true, effectiveType: 'slow-2g' })
    const html = renderToString(<CraftVideo film={CRAFT_FILMS.paper} title="t" />)
    expect(html).toContain(`src="${CRAFT_FILMS.paper.src}"`)
    expect(html).not.toContain('-360.mp4')
  })

  it('đổi prop film thì đổi nguồn đúng (màn hẹp)', () => {
    media(true)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const { container, rerender } = render(<CraftVideo film={CRAFT_FILMS.paper} title="t" />)
    const src = () => container.querySelector('source').getAttribute('src')
    expect(src()).toBe(CRAFT_FILMS.paper.srcLite)
    rerender(<CraftVideo film={CRAFT_FILMS.dongho} title="t" />)
    expect(src()).toBe(CRAFT_FILMS.dongho.srcLite)
  })

  it('đổi từ film có srcLite sang film không có srcLite (màn hẹp): về đúng src của film mới', () => {
    media(true)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const { container, rerender } = render(<CraftVideo film={CRAFT_FILMS.paper} title="t" />)
    rerender(<CraftVideo film={CRAFT_FILMS.journey} title="t" />)
    expect(container.querySelector('source').getAttribute('src')).toBe(CRAFT_FILMS.journey.src)
  })

  it('đổi prop film trên màn rộng: theo src của film mới', () => {
    media(false)
    const { container, rerender } = render(<CraftVideo film={CRAFT_FILMS.paper} title="t" />)
    rerender(<CraftVideo film={CRAFT_FILMS.dongho} title="t" />)
    expect(container.querySelector('source').getAttribute('src')).toBe(CRAFT_FILMS.dongho.src)
  })
})

describe('vercel.json', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'))

  it('/videos/ vẫn cache dài (>= 7 ngày) và có stale-while-revalidate', () => {
    const h = cfg.headers.find((x) => x.source === '/videos/(.*)')
    expect(h).toBeTruthy()
    const cc = h.headers.find((x) => x.key === 'Cache-Control').value
    expect(Number(/max-age=(\d+)/.exec(cc)[1])).toBeGreaterThanOrEqual(604800)
    expect(cc).toContain('public')
    expect(cc).toContain('stale-while-revalidate')
  })

  it('function vẫn loại video khỏi gói (excludeFiles), includeFiles không kéo video vào', () => {
    const fn = cfg.functions['api/index.js']
    expect(fn.excludeFiles).toContain('videos')
    expect(fn.includeFiles).not.toMatch(/videos/)
  })
})

describe('mọi tệp *-360.mp4', () => {
  const files = readdirSync('public/videos').filter((f) => f.endsWith('-360.mp4'))
  const hasFfprobe = spawnSync('ffprobe', ['-version']).status === 0

  it('có ít nhất một bản 360p và mỗi film có srcLite đều trỏ tới tệp tồn tại', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const f of Object.values(CRAFT_FILMS).filter((x) => x.srcLite)) {
      expect(files).toContain(f.srcLite.replace('/videos/', ''))
    }
  })

  it.each(files)('%s: header ftyp và < 8MB', (f) => {
    const p = `public/videos/${f}`
    expect(statSync(p).size).toBeLessThan(8 * 1024 * 1024)
    expect(readFileSync(p).subarray(4, 8).toString()).toBe('ftyp')
  })

  it.skipIf(!hasFfprobe).each(files)('%s: ffprobe đọc được, H.264, cao <= 360', (f) => {
    const r = spawnSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,height',
      '-of', 'json', `public/videos/${f}`,
    ])
    expect(r.status).toBe(0)
    const s = JSON.parse(r.stdout.toString()).streams[0]
    expect(s.codec_name).toBe('h264')
    expect(s.height).toBeLessThanOrEqual(360)
  })
})
