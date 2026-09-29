// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho đợt đổi giao diện "cổ điển": CSS token, data-URI SVG, VerticalSeal, trang chủ, Lantern.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'
import Lantern from './Lantern.jsx'
import { VerticalSeal } from './Motifs.jsx'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '/', en: '/en', zh: '/zh' }
const handlers = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({
    body: { items: [...faqVi.items, { id: 'f2', question: 'Câu hỏi hai?', answer: 'Trả lời hai.' }] },
  }),
}

const read = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const INDEX = strip(read('src/index.css'))
const APP = strip(read('src/styles/App.css'))
const PAGES = strip(read('src/styles/pages.css'))
const FILES = { 'src/index.css': INDEX, 'src/styles/App.css': APP, 'src/styles/pages.css': PAGES }

const lineHits = (src, re) =>
  src.split('\n').flatMap((l, i) => (re.test(l) ? [`${i + 1}: ${l.trim().slice(0, 120)}`] : []))

describe('CSS — bỏ phong cách viền đen dày + bóng đổ cứng', () => {
  it.each(['src/index.css', 'src/styles/App.css'])('%s: không còn border 2px solid var(--than)', (f) => {
    expect(lineHits(FILES[f], /border[\w-]*\s*:[^;]*\b2px\s+solid\s+var\(--than\)/)).toEqual([])
  })

  it.each(['src/index.css', 'src/styles/App.css'])('%s: không còn bóng lệch cứng "Npx Npx 0 <màu>"', (f) => {
    const hard = /-?\d+(\.\d+)?px\s+-?\d+(\.\d+)?px\s+0(px)?\s+(var\(--|#|rgba?\()/
    const decls = [...FILES[f].matchAll(/((?:box|text)-shadow|--print(?:-lg)?|--shadow-soft)\s*:([^;]*);/g)]
    const bad = decls.filter((d) => d[2].split(/,(?![^(]*\))/).some((part) => hard.test(part.trim())))
    expect(bad.map((d) => d[0].trim())).toEqual([])
  })

  it('h1/h2 không còn text-shadow lệch khuôn', () => {
    expect(INDEX).not.toMatch(/text-shadow:\s*2px 2px 0/)
  })

  it('không còn tham chiếu .postmark / hero-postmark trong CSS và mã nguồn', () => {
    for (const [f, s] of Object.entries(FILES)) expect(s, f).not.toMatch(/postmark/i)
    expect(read('src/pages/HomePage.jsx')).not.toMatch(/postmark/i)
    expect(read('src/components/Motifs.jsx')).not.toMatch(/Postmark/)
  })

  it('mọi var(--x) trong App.css/pages.css đều được định nghĩa (index.css hoặc chính file)', () => {
    const missing = {}
    for (const f of ['src/styles/App.css', 'src/styles/pages.css']) {
      const s = FILES[f]
      const defined = new Set([...(INDEX + s).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
      const used = new Set([...s.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))
      const miss = [...used].filter((v) => !defined.has(v))
      if (miss.length) missing[f] = miss
    }
    expect(missing).toEqual({})
  })

  it('token mới có trong index.css', () => {
    for (const t of ['--hair', '--hair-soft', '--print', '--print-lg', '--corner-tl', '--corner-tr', '--corner-bl', '--corner-br', '--pat-cloud'])
      expect(INDEX).toMatch(new RegExp(`${t}\\s*:`))
  })
})

describe('CSS hợp lệ cơ bản', () => {
  it.each(Object.keys(FILES))('%s: số { bằng số }, không bao giờ âm', (f) => {
    const s = FILES[f].replace(/url\("[^"]*"\)/g, 'url()')
    let depth = 0
    for (const ch of s) {
      if (ch === '{') depth++
      if (ch === '}') depth--
      expect(depth).toBeGreaterThanOrEqual(0)
    }
    expect(depth).toBe(0)
  })

  it.each(Object.keys(FILES))('%s: không có khối rule trùng y hệt (cùng ngữ cảnh @media)', (f) => {
    const s = FILES[f].replace(/url\("[^"]*"\)/g, (m) => m.replace(/[{}]/g, ''))
    const seen = new Map()
    const dups = []
    const stack = []
    let buf = ''
    for (const ch of s) {
      if (ch === '{') {
        stack.push(buf.trim().replace(/\s+/g, ' '))
        buf = ''
      } else if (ch === '}') {
        const sel = stack.pop()
        const body = buf.trim().replace(/\s+/g, ' ')
        if (body && !/^@/.test(sel)) {
          const key = `${stack.join(' > ')} | ${sel} { ${body} }`
          if (seen.has(key)) dups.push(key.slice(0, 160))
          seen.set(key, true)
        }
        buf = ''
      } else buf += ch
    }
    expect(dups).toEqual([])
  })

  const svgUris = () => {
    const out = []
    for (const [f, s] of Object.entries({ 'src/index.css': INDEX, 'src/styles/App.css': APP })) {
      for (const m of s.matchAll(/url\("data:image\/svg\+xml,([^"]*)"\)/g)) out.push([f, m[1]])
    }
    return out
  }

  it('có đủ data-URI của góc triện, mây chìm và mask mái đình', () => {
    const all = svgUris().map(([, u]) => decodeURIComponent(u))
    expect(all.filter((u) => /M1\.5 26 V1\.5 H26/.test(u))).toHaveLength(4)
    expect(all.some((u) => /viewBox='0 0 \d+ 64'/.test(u))).toBe(true)
    expect(all.some((u) => /width='300' height='170'/.test(u))).toBe(true)
  })

  it('mọi data-URI SVG trong index.css/App.css decode và parse thành SVG hợp lệ', () => {
    const bad = []
    for (const [f, u] of svgUris()) {
      let xml
      try {
        xml = decodeURIComponent(u)
      } catch (e) {
        bad.push(`${f}: decode lỗi ${e.message}`)
        continue
      }
      const doc = new DOMParser().parseFromString(xml, 'image/svg+xml')
      if (doc.getElementsByTagName('parsererror').length || doc.documentElement.nodeName !== 'svg')
        bad.push(`${f}: ${xml.slice(0, 80)}`)
      else if (doc.documentElement.getAttribute('xmlns') !== 'http://www.w3.org/2000/svg')
        bad.push(`${f}: thiếu xmlns`)
    }
    expect(bad).toEqual([])
  })

  it('mask mái đình: -webkit-mask và mask cùng giá trị, áp cho .story/.lookbook/.footer ::before; URL tham chiếu là SVG', () => {
    const block = APP.match(/\.story::before,\s*\.lookbook::before,\s*\.footer::before\s*\{([^}]*)\}/)
    expect(block).not.toBeNull()
    const wk = block[1].match(/-webkit-mask:\s*([^;]+);/)
    const std = block[1].match(/(?:^|[;\s])mask:\s*([^;]+);/)
    expect(wk && std).toBeTruthy()
    expect(wk[1].trim()).toBe(std[1].trim())
    // Nếu dùng biến (vd --roof-mask) thì mọi định nghĩa biến đó phải là data-URI SVG 1440 hoặc tương đương
    const v = wk[1].match(/var\((--[\w-]+)\)/)
    if (v) {
      const defs = [...APP.matchAll(new RegExp(`${v[1]}\\s*:\\s*url\\("data:image/svg\\+xml,([^"]*)"\\)`, 'g'))]
      expect(defs.length).toBeGreaterThan(0)
      for (const d of defs) {
        const doc = new DOMParser().parseFromString(decodeURIComponent(d[1]), 'image/svg+xml')
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
        expect(doc.documentElement.getAttribute('viewBox')).toMatch(/^0 0 \d+ 64$/)
      }
    }
  })
})

describe('VerticalSeal', () => {
  const chars = (c) => [...c.querySelectorAll('.vseal > span')].map((s) => s.textContent)

  it('aria-hidden, tách "MỘC" thành M/Ộ/C', () => {
    const { container } = render(<VerticalSeal label="MỘC" />)
    const root = container.querySelector('.vseal')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(chars(container)).toEqual(['M', 'Ộ', 'C'])
  })

  it('chuỗi NFD vẫn ra 3 ký tự NFC', () => {
    const nfd = 'MỘC'.normalize('NFD')
    expect([...nfd].length).toBeGreaterThan(3)
    const { container } = render(<VerticalSeal label={nfd} />)
    const out = chars(container)
    expect(out).toEqual(['M', 'Ộ', 'C'])
    expect(out[1]).toBe('Ộ')
  })

  it('nhãn rỗng không lỗi, không có span con', () => {
    const { container } = render(<VerticalSeal label="" />)
    expect(container.querySelector('.vseal')).not.toBeNull()
    expect(chars(container)).toEqual([])
  })

  it('giữ className truyền vào', () => {
    const { container } = render(<VerticalSeal label="A" className="x" />)
    expect(container.querySelector('.vseal.x')).not.toBeNull()
  })
})

describe('Trang chủ sau đổi giao diện', () => {
  it.each(['vi', 'en', 'zh'])('%s: .hero-seal chứa VerticalSeal LAMVI, không còn .story-cloud / postmark', async (lang) => {
    mockApi(handlers)
    const { container } = renderAt(PREFIX[lang])
    const seal = container.querySelector('.hero-seal .vseal')
    expect(seal).not.toBeNull()
    expect(seal).toHaveAttribute('aria-hidden', 'true')
    expect([...seal.children].map((c) => c.textContent)).toEqual(['L', 'A', 'M', 'V', 'I'])
    expect(container.querySelector('.story-cloud')).toBeNull()
    expect(container.querySelector('#story .folk-cloud')).toBeNull()
    expect(container.querySelector('[class*="postmark"]')).toBeNull()
  })

  it.each(['vi', 'en', 'zh'])('%s: Mua tặng / Mua cho mình aria-pressed + .intent-pill', async (lang) => {
    mockApi(handlers)
    const { container } = renderAt(PREFIX[lang])
    const p = MESSAGES[lang].products
    const pill = container.querySelector('.intent-toggle .intent-pill')
    expect(pill).toHaveAttribute('aria-hidden', 'true')
    const gift = screen.getByRole('button', { name: p.gift })
    const self = screen.getByRole('button', { name: p.self })
    expect(gift).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(self)
    expect(self).toHaveAttribute('aria-pressed', 'true')
    expect(gift).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('.intent-toggle.is-self')).not.toBeNull()
  })

  it('FAQ vẫn đúng aria-expanded', async () => {
    mockApi(handlers)
    renderAt('/')
    const q1 = await screen.findByRole('button', { name: 'Lưu bao lâu?' })
    const q2 = screen.getByRole('button', { name: 'Câu hỏi hai?' })
    expect(q1).toHaveAttribute('aria-expanded', 'true')
    expect(q2).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(q2)
    expect(q2).toHaveAttribute('aria-expanded', 'true')
    expect(q1).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Lantern — nét mực mới', () => {
  it.each(['amber', 'dawn', 'dusk', 'moss'])('%s: mọi stroke dùng INK #3a2a1e, không còn #1d1712', (tone) => {
    const { container } = render(<Lantern tone={tone} />)
    const strokes = [...container.querySelectorAll('[stroke]')].map((e) => e.getAttribute('stroke').toLowerCase())
    expect(strokes.length).toBeGreaterThan(5)
    expect(new Set(strokes)).toEqual(new Set(['#3a2a1e']))
    expect(container.innerHTML.toLowerCase()).not.toContain('#1d1712')
  })

  it('mã nguồn Lantern không còn #1d1712', () => {
    expect(read('src/components/Lantern.jsx').toLowerCase()).not.toContain('#1d1712')
  })
})
