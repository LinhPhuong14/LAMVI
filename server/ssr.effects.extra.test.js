// Kiểm thử độc lập (T-11): SSR trang chủ sau khi hero chuyển sang animation CSS và thêm hiệu ứng con trỏ.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import viMsg from '../src/i18n/messages/vi.js'
import enMsg from '../src/i18n/messages/en.js'
import zhMsg from '../src/i18n/messages/zh.js'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '/', en: '/en', zh: '/zh' }
const root = new URL('..', import.meta.url).pathname
const template = readFileSync(`${root}index.html`, 'utf8')
const page = (url) =>
  renderPage({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://moc.test' }, template, render, url, pathname: url })
const docOf = (html) => new JSDOM(html).window.document
const hidden = /opacity\s*:\s*0(?![.\d])/

describe.each(['vi', 'en', 'zh'])('SSR %s — hero hiện ngay, không chờ JS', (lang) => {
  it('h1, .word, .intro trong hero không có opacity:0; chữ h1 đầy đủ', async () => {
    const r = await page(PREFIX[lang])
    expect(r.status).toBe(200)
    const doc = docOf(r.html)
    const m = MESSAGES[lang]
    const hero = doc.querySelector('.hero')
    const h1 = hero.querySelector('h1')
    expect(h1.textContent.replace(/\s+/g, '')).toBe(`${m.hero.title1}${m.hero.title2}`.replace(/\s+/g, ''))
    expect(h1.getAttribute('style') ?? '').not.toMatch(hidden)
    const words = hero.querySelectorAll('h1 .word')
    expect(words.length).toBeGreaterThan(0)
    for (const w of words) expect(w.getAttribute('style') ?? '', w.textContent).not.toMatch(hidden)
    for (const el of hero.querySelectorAll('.intro')) expect(el.getAttribute('style') ?? '').not.toMatch(hidden)
    // Tổ tiên của h1 cũng không bị ẩn
    for (let p = h1.parentElement; p && p !== hero; p = p.parentElement) {
      expect(p.getAttribute('style') ?? '', p.className).not.toMatch(hidden)
    }
  })

  it('HTML chứa đủ chữ lookbook, process, lời nghệ nhân; không có hiệu ứng con trỏ lúc SSR', async () => {
    const r = await page(PREFIX[lang])
    const doc = docOf(r.html)
    const m = MESSAGES[lang]
    const text = doc.body.textContent
    expect(text).toContain(m.lookbook.title)
    for (const label of m.lookbook.items) expect(text).toContain(label)
    expect(text).toContain(m.process.title)
    const lis = doc.querySelectorAll('ol.timeline > li')
    expect(lis).toHaveLength(m.process.steps.length)
    m.process.steps.forEach((s, i) => {
      expect(lis[i].textContent).toContain(s.label)
      expect(lis[i].textContent).toContain(s.note)
    })
    expect(doc.querySelector('.artisan-quote').textContent).toBe(m.artisan.quote)
    // useFinePointer server snapshot = false
    expect(doc.querySelector('.card-spotlight')).toBeNull()
    expect(doc.querySelector('.is-tilt')).toBeNull()
    expect(doc.querySelectorAll('[id^="brandInk"]')).toHaveLength(1)
    expect(doc.querySelector('.nav-cta').classList.contains('thread')).toBe(true)
  })
})
