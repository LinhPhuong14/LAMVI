// Kiểm thử độc lập (T-11) cho SSR trang chủ sau T-27/T-28: phòng tranh và lớp hoạ tiết có trong HTML.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import { FOLK_ART } from '../src/data/folkArt.js'
import viMsg from '../src/i18n/messages/vi.js'
import enMsg from '../src/i18n/messages/en.js'
import zhMsg from '../src/i18n/messages/zh.js'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '/', en: '/en', zh: '/zh' }
const root = new URL('..', import.meta.url).pathname
const template = readFileSync(`${root}index.html`, 'utf8')

const doc = async (url) => {
  const r = await renderPage({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://moc.test' }, template, render, url, pathname: url })
  expect(r.status).toBe(200)
  return new JSDOM(r.html).window.document
}

describe.each(['vi', 'en', 'zh'])('SSR %s — phòng tranh và hoạ tiết', (lang) => {
  it('#story chứa .folk-gallery; mỗi ảnh lazy, có width/height, alt theo ngôn ngữ', async () => {
    const d = await doc(PREFIX[lang])
    const gallery = d.querySelector('#story .folk-gallery')
    expect(gallery).not.toBeNull()
    const imgs = gallery.querySelectorAll('img')
    expect(imgs).toHaveLength(FOLK_ART.length)
    FOLK_ART.forEach((art, i) => {
      const img = imgs[i]
      expect(img.getAttribute('loading')).toBe('lazy')
      expect(img.getAttribute('width')).toBe(String(art.width))
      expect(img.getAttribute('height')).toBe(String(art.height))
      expect(img.getAttribute('alt')).toBe(MESSAGES[lang].gallery.items[art.id].alt)
    })
    expect(gallery.querySelector('.folk-gallery-note').textContent).toBe(MESSAGES[lang].gallery.note)
    // Ghi chú: tranh trong Reveal có opacity:0 trong HTML SSR tới khi JS chạy — khoảng trống đã biết G-34 (decisions T-22), không kiểm ở đây
  })

  it('D-122: trang chủ không còn lớp cảnh .scene / .motif-layer (nền phẳng); phần has-motifs không có cảnh con', async () => {
    const d = await doc(PREFIX[lang])
    expect(d.querySelectorAll('.scene')).toHaveLength(0)
    expect(d.querySelectorAll('.motif-layer')).toHaveLength(0)
    for (const s of d.querySelectorAll('.has-motifs')) expect(s.querySelector(':scope > .scene')).toBeNull()
  })
})
