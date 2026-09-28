// Kiểm thử độc lập (T-11) cho SSR sau đợt đổi giao diện: nội dung thật trong HTML, font tự host.
import { existsSync, readFileSync } from 'node:fs'
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
const config = { publicSiteUrl: 'https://moc.test' }
const root = new URL('..', import.meta.url).pathname
const devTemplate = readFileSync(`${root}index.html`, 'utf8')
const distIndex = `${root}dist/client/index.html`

const page = (url, template = devTemplate) =>
  renderPage({ repo: createMemoryRepo(), config, template, render, url, pathname: url })

const docOf = (html) => new JSDOM(html).window.document
const preloads = (doc) => [...doc.querySelectorAll('link[rel="preload"][as="font"]')]

describe('SSR trang chủ — nội dung chữ thật (không bị ẩn chờ animation)', () => {
  it.each(['vi', 'en', 'zh'])('%s: h1, câu chuyện, số liệu có trong HTML', async (lang) => {
    const r = await page(PREFIX[lang])
    expect(r.status).toBe(200)
    const doc = docOf(r.html)
    const m = MESSAGES[lang]
    const h1 = doc.querySelector('h1')
    expect(h1.textContent).toBe(`${m.hero.title1}${m.hero.title2}`)
    expect(doc.querySelector('#story').textContent).toContain(m.story.text)
    const sr = [...doc.querySelectorAll('strong > .sr-only')].map((s) => s.textContent)
    expect(sr).toEqual(expect.arrayContaining(['100+', '12', '1', '32', '4.000+']))
    // Số chạy (aria-hidden) cũng là giá trị thật lúc SSR — không phải 0
    const visible = [...doc.querySelectorAll('strong > [aria-hidden="true"]')].map((s) => s.textContent)
    expect(visible).toEqual(expect.arrayContaining(['100+', '4.000+']))
    expect(doc.querySelector('.nav-mark').getAttribute('href')).toBe(PREFIX[lang])
    expect(doc.body.textContent).toContain(m.products.giftCopy)
  })
})

describe('Font tự host', () => {
  it('index.html (template dev): không Google Fonts, preload 6 woff2 trỏ tới file có thật trong node_modules', () => {
    expect(devTemplate).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
    const links = preloads(docOf(devTemplate))
    expect(links).toHaveLength(6)
    for (const l of links) {
      const href = l.getAttribute('href')
      expect(href).toMatch(/^\/node_modules\/.+\.woff2$/)
      expect(l.getAttribute('type')).toBe('font/woff2')
      expect(l.hasAttribute('crossorigin')).toBe(true)
      expect(existsSync(`${root}${href.slice(1)}`), href).toBe(true)
    }
  })

  it('SSR với template dev: HTML trả về không có fonts.googleapis.com, vẫn giữ preload', async () => {
    const r = await page('/')
    expect(r.html).not.toContain('fonts.googleapis.com')
    expect(preloads(docOf(r.html))).toHaveLength(6)
  })

  it.skipIf(!existsSync(distIndex))('bản build (dist): preload trỏ tới /assets/*.woff2 có thật và được CSS dùng tới', async () => {
    const template = readFileSync(distIndex, 'utf8')
    const r = await page('/', template)
    const doc = docOf(r.html)
    expect(r.html).not.toContain('fonts.googleapis.com')
    expect(r.html).not.toContain('/node_modules/')
    const links = preloads(doc)
    expect(links).toHaveLength(6)
    const cssFiles = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'))
    const css = cssFiles.map((h) => readFileSync(`${root}dist/client${h}`, 'utf8')).join('\n')
    for (const l of links) {
      const href = l.getAttribute('href')
      expect(href).toMatch(/^\/assets\/[\w.-]+\.woff2$/)
      expect(existsSync(`${root}dist/client${href}`), href).toBe(true)
      // Preload phải trùng file CSS @font-face dùng, nếu không trình duyệt tải hai lần
      expect(css, href).toContain(href.split('/').pop())
    }
  })
})
