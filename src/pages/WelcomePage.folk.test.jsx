// @vitest-environment jsdom
// /welcome hướng dân gian (D-132): edge case bổ sung — đa ngôn ngữ, aria-hidden, ảnh tồn tại, giảm chuyển động, CSS không hex
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'

const motion = vi.hoisted(() => ({ reduce: false }))
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotionConfig: () => motion.reduce }))

const LANGS = { vi: viMsg, en: enMsg, zh: zhMsg }
const products = { items: [] }
const scene = () => document.querySelector('.welcome-scene:not(.is-leaving)')
const settle = async (ms = 20) => {
  for (let i = 0; i < 6; i++) await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
async function open(path) {
  mockApi({ 'GET /products': () => ({ body: products }) })
  renderAt(path)
  await settle(1)
  expect(document.querySelector('.welcome')).not.toBeNull()
}
const goTo = async (n) => {
  for (let i = 0; i < n; i++) {
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await settle(5)
  }
}

beforeEach(async () => {
  motion.reduce = false
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.stubGlobal('matchMedia', (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  mockApi({ 'GET /products': () => ({ body: products }) })
  renderAt('/welcome')
  await screen.findByRole('region', { name: viMsg.welcome.label })
  cleanup()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('welcome folk: i18n', () => {
  it.each(Object.entries(LANGS))('welcome.chapters (%s) đủ 6 mục, chuỗi không rỗng, không trùng', (_l, m) => {
    const c = m.welcome.chapters
    expect(Array.isArray(c)).toBe(true)
    expect(c).toHaveLength(6)
    for (const s of c) expect(typeof s === 'string' && s.trim().length > 0).toBe(true)
    expect(new Set(c).size).toBe(6)
  })

  it.each(['en', 'zh'])('/%s/welcome: tên chương, chú thích và alt tranh đúng ngôn ngữ ở cảnh đầu và cảnh cuối', async (l) => {
    const m = LANGS[l]
    await open(`/${l}/welcome`)
    expect(scene().querySelector('.welcome-chapter-name').textContent).toBe(m.welcome.chapters[0])
    expect(scene().querySelector('.welcome-seal').textContent).toBe('I')
    let fig = scene().querySelector('figure.welcome-print')
    expect(fig.querySelector('figcaption').textContent).toBe(m.gallery.items['chuot-ruoc-den'].name)
    expect(fig.querySelector('img').getAttribute('alt')).toBe(m.gallery.items['chuot-ruoc-den'].alt)
    expect(fig.querySelector('figcaption').textContent).not.toBe(viMsg.gallery.items['chuot-ruoc-den'].name)
    await goTo(13)
    expect(scene().classList.contains('scene-end')).toBe(true)
    expect(scene().querySelector('.welcome-chapter-name').textContent).toBe(m.welcome.chapters[5])
    fig = scene().querySelector('figure.welcome-print')
    expect(fig.querySelector('figcaption').textContent).toBe(m.gallery.items['dam-cuoi-chuot'].name)
    expect(fig.querySelector('img').getAttribute('alt')).toBe(m.gallery.items['dam-cuoi-chuot'].alt)
  })

  it('mỗi cảnh (14 cảnh) hiển thị đúng tên chương theo scene.chapter bằng tiếng Anh', async () => {
    await open('/en/welcome')
    const expected = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 5]
    for (const ch of expected) {
      expect(scene().querySelector('.welcome-chapter-name').textContent).toBe(enMsg.welcome.chapters[ch])
      await goTo(1)
    }
  })
})

describe('welcome folk: cảnh leaving', () => {
  it('cảnh đang rời aria-hidden=true và không còn aria-live; cảnh hiện tại thì ngược lại', async () => {
    await open('/welcome')
    await goTo(1)
    const old = document.querySelector('.welcome-scene.is-leaving')
    expect(old).not.toBeNull()
    expect(old.getAttribute('aria-hidden')).toBe('true')
    expect(old.hasAttribute('aria-live')).toBe(false)
    expect(scene().hasAttribute('aria-hidden')).toBe(false)
    expect(scene().getAttribute('aria-live')).toBe('polite')
  })

  it('bấm nhanh nhiều lần: chỉ có tối đa một cảnh leaving và nó luôn aria-hidden', async () => {
    await open('/welcome')
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    await settle(5)
    const leaving = document.querySelectorAll('.welcome-scene.is-leaving')
    expect(leaving.length).toBeLessThanOrEqual(1)
    for (const el of leaving) expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelectorAll('.welcome-scene:not(.is-leaving)')).toHaveLength(1)
  })
})

describe('welcome folk: tài nguyên và CSS', () => {
  it.each(['chuot-ruoc-den-480', 'chuot-ruoc-den-960', 'dam-cuoi-chuot-480', 'dam-cuoi-chuot-960'])('public/images/folk/%s.webp tồn tại và không rỗng', (f) => {
    const p = resolve(process.cwd(), `public/images/folk/${f}.webp`)
    expect(existsSync(p)).toBe(true)
    expect(readFileSync(p).length).toBeGreaterThan(1000)
  })

  it('srcSet và src của Print trỏ tới đúng các file 480/960', async () => {
    await open('/welcome')
    const img = scene().querySelector('figure.welcome-print img')
    expect(img.getAttribute('src')).toBe('/images/folk/chuot-ruoc-den-960.webp')
    expect(img.getAttribute('srcset')).toContain('/images/folk/chuot-ruoc-den-480.webp 480w')
    expect(img.getAttribute('srcset')).toContain('/images/folk/chuot-ruoc-den-960.webp 960w')
  })

  it('khối CSS D-132 không có hex literal ngoài data-URI', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/pages.css'), 'utf8')
    const start = css.indexOf('/* ===== /welcome theo hướng dân gian (D-132)')
    expect(start).toBeGreaterThan(-1)
    const next = css.indexOf('/* =====', start + 10)
    const block = css.slice(start, next === -1 ? undefined : next)
    expect(block.length).toBeGreaterThan(200)
    const noData = block.replace(/url\(\s*(['"]?)data:[\s\S]*?\1\s*\)/g, '')
    expect(noData.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })
})

describe('welcome folk: giảm chuyển động', () => {
  it('vẫn render đủ 6 chương I..VI qua 14 cảnh, không tự chuyển, không crash', async () => {
    motion.reduce = true
    await open('/welcome')
    await settle(5)
    expect(scene().classList.contains('scene-intro')).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
    expect(scene().classList.contains('scene-intro')).toBe(true)
    const seen = []
    for (let n = 0; n < 14; n++) {
      seen.push(scene().querySelector('.welcome-seal').textContent)
      expect(scene().querySelector('.welcome-chapter-name').textContent.length).toBeGreaterThan(0)
      expect(scene().querySelector('.drum-watermark')).not.toBeNull()
      if (n < 13) await goTo(1)
    }
    expect(seen).toEqual(['I', 'II', 'II', 'III', 'III', 'III', 'IV', 'IV', 'IV', 'IV', 'IV', 'IV', 'V', 'VI'])
    expect(scene().classList.contains('scene-end')).toBe(true)
  })
})
