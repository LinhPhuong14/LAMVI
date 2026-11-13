// @vitest-environment jsdom
// Bản video nhẹ cho điện thoại (T-103)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { statSync, readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { CraftVideo } from '../components/CraftFilms.jsx'
import { pickFilmSrc, wantsLiteFilm } from './filmSrc.js'

const media = (matches) => vi.stubGlobal('matchMedia', () => ({ matches, addEventListener() {}, removeEventListener() {} }))
const connection = (c) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true })

afterEach(() => {
  vi.unstubAllGlobals()
  delete navigator.connection
})

describe('pickFilmSrc', () => {
  const film = CRAFT_FILMS.paper

  it('màn rộng, mạng thường: bản 720p', () => {
    media(false)
    expect(wantsLiteFilm()).toBe(false)
    expect(pickFilmSrc(film)).toBe(film.src)
  })

  it('màn hẹp (≤ 800px): bản 360p', () => {
    media(true)
    expect(pickFilmSrc(film)).toBe(film.srcLite)
  })

  it.each([{ saveData: true }, { effectiveType: '2g' }, { effectiveType: '3g' }])('màn rộng nhưng %o: bản 360p', (c) => {
    media(false)
    connection(c)
    expect(pickFilmSrc(film)).toBe(film.srcLite)
  })

  it('mạng 4g không bật tiết kiệm dữ liệu: bản 720p', () => {
    media(false)
    connection({ effectiveType: '4g', saveData: false })
    expect(pickFilmSrc(film)).toBe(film.src)
  })

  it('phim không có srcLite (clip hành trình) luôn dùng src', () => {
    media(true)
    expect(pickFilmSrc(CRAFT_FILMS.journey)).toBe(CRAFT_FILMS.journey.src)
  })
})

describe('tệp bản nhẹ', () => {
  it.each(['paper', 'dongho'])('%s: srcLite tồn tại, là mp4 và nhẹ hơn ít nhất 60% bản 720p', (k) => {
    const f = CRAFT_FILMS[k]
    const lite = statSync(`public${f.srcLite}`).size
    const full = statSync(`public${f.src}`).size
    expect(lite).toBeLessThan(full * 0.4)
    expect(lite).toBeLessThan(8 * 1024 * 1024)
    expect(readFileSync(`public${f.srcLite}`).subarray(4, 8).toString()).toBe('ftyp')
  })
})

describe('CraftVideo', () => {
  it('trên màn hẹp đổi sang bản nhẹ sau khi mount', () => {
    media(true)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const { container } = render(<CraftVideo film={CRAFT_FILMS.paper} title="t" />)
    expect(container.querySelector('source').getAttribute('src')).toBe(CRAFT_FILMS.paper.srcLite)
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled()
  })

  it('trên màn rộng giữ bản 720p và không gọi load()', () => {
    media(false)
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const { container } = render(<CraftVideo film={CRAFT_FILMS.paper} title="t" />)
    expect(container.querySelector('source').getAttribute('src')).toBe(CRAFT_FILMS.paper.src)
    expect(load).not.toHaveBeenCalled()
  })
})
