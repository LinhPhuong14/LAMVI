// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho phòng tranh ảnh tư liệu (T-27) và cảnh nền ảnh thật (D-66, thay hoạ tiết T-28).
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { LocaleContext } from '../i18n/index.js'
import FolkGallery from './FolkGallery.jsx'
import Scene from './Scene.jsx'
import { FOLK_ART, folkSrc } from '../data/folkArt.js'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const read = (f) => readFileSync(join(process.cwd(), f), 'utf8')
const appCss = read('src/styles/App.css')

// Cùng danh sách với src/components/Components.extra.test.jsx (§31.3)
const BANNED = [
  'lưu giữ lâu dài',
  'của chính chiếc đèn này',
  'gắn mã riêng',
  'theo dõi đèn của bạn từng bước',
  'lưu giữ ký ức vĩnh viễn',
  'câu chuyện riêng mỗi đèn',
  'sổ lưu niệm',
]
const strings = (v) =>
  typeof v === 'string' ? [v] : Array.isArray(v) || (v && typeof v === 'object') ? Object.values(v).flatMap(strings) : []

// Đọc width/height từ header WebP (RIFF … WEBP + VP8 / VP8L / VP8X)
function webpSize(buf) {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF')
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP')
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    expect([buf[23], buf[24], buf[25]]).toEqual([0x9d, 0x01, 0x2a])
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    expect(buf[20]).toBe(0x2f)
    const b = buf.readUInt32LE(21)
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  }
  throw new Error(`chunk WebP lạ: ${chunk}`)
}

const renderGallery = (lang) =>
  render(
    <LocaleContext.Provider value={lang}>
      <LazyMotion features={domAnimation} strict>
        <FolkGallery />
      </LazyMotion>
    </LocaleContext.Provider>,
  )

describe('T-27 — file ảnh tư liệu', () => {
  // Chỉ xuất độ rộng ≤ ảnh nguồn (không phóng to); bản lớn nhất khớp width/height khai báo
  it.each(FOLK_ART.map((a) => [a.id, a]))('%s: WebP theo từng độ rộng khai báo, bản lớn nhất khớp kích thước', (id, art) => {
    expect(art.widths.length).toBeGreaterThan(0)
    expect([...art.widths].sort((a, b) => a - b)).toEqual(art.widths)
    for (const w of art.widths) {
      const f = join(process.cwd(), 'public', folkSrc(id, w))
      expect(existsSync(f), f).toBe(true)
      const size = webpSize(readFileSync(f))
      expect(size.width, `${id}-${w} width`).toBe(w)
      if (w === art.widths.at(-1)) {
        expect(size).toEqual({ width: art.width, height: art.height })
      } else {
        // Bản nhỏ cùng tỉ lệ với bản lớn nhất (sai số làm tròn 1px)
        expect(Math.abs(size.height - Math.round((art.height * w) / art.width))).toBeLessThanOrEqual(1)
      }
    }
  })

  it('license chỉ Public domain | CC0; id không trùng', () => {
    for (const art of FOLK_ART) expect(['Public domain', 'CC0']).toContain(art.license)
    expect(new Set(FOLK_ART.map((a) => a.id)).size).toBe(FOLK_ART.length)
  })

  it('không có file ảnh mồ côi trong public/images/folk (mọi webp đều thuộc FOLK_ART)', () => {
    const ids = new Set(FOLK_ART.map((a) => a.id))
    const orphans = readdirSync(join(process.cwd(), 'public/images/folk'))
      .filter((f) => f.endsWith('.webp'))
      .filter((f) => !ids.has(f.replace(/-\d+\.webp$/, '')))
    expect(orphans).toEqual([])
  })

  it('CREDITS.md ghi giấy phép đúng cho từng ảnh', () => {
    const credits = read('public/images/folk/CREDITS.md')
    for (const art of FOLK_ART) {
      const row = credits.split('\n').find((l) => l.includes(`${art.id}-${art.widths[0]}.webp`))
      expect(row, art.id).toBeTruthy()
      expect(row).toContain(art.license)
      expect(row).toContain(art.source)
    }
  })
})

describe('T-27 — i18n gallery', () => {
  const ids = Object.keys(viMsg.gallery.items)

  it('vi/en/zh có cùng tập ảnh, và mọi ảnh trong FOLK_ART đều có khoá', () => {
    expect(Object.keys(enMsg.gallery.items).sort()).toEqual([...ids].sort())
    expect(Object.keys(zhMsg.gallery.items).sort()).toEqual([...ids].sort())
    for (const art of FOLK_ART) expect(ids).toContain(art.id)
  })

  it.each(['vi', 'en', 'zh'])('%s: label/source/note và name/meta/alt không rỗng; name, alt khác nhau giữa các ảnh', (lang) => {
    const g = MESSAGES[lang].gallery
    for (const k of ['label', 'source', 'note']) expect(g[k]?.trim(), k).toBeTruthy()
    for (const [id, item] of Object.entries(g.items)) {
      for (const k of ['name', 'meta', 'alt']) expect(item[k]?.trim(), `${lang}.${id}.${k}`).toBeTruthy()
      expect(item.alt).not.toBe(item.name)
    }
    const names = Object.values(g.items).map((i) => i.name)
    const alts = Object.values(g.items).map((i) => i.alt)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(alts).size).toBe(alts.length)
  })

  it.each(['vi', 'en', 'zh'])('%s: văn bản gallery không có cụm cam kết sai (§31.3)', (lang) => {
    const low = strings(MESSAGES[lang].gallery).join('\n').toLowerCase()
    expect(BANNED.filter((b) => low.includes(b))).toEqual([])
  })

  it.each(['vi', 'en', 'zh'])('%s: bản render không lộ khoá i18n thô', (lang) => {
    const { container } = renderGallery(lang)
    expect(container.textContent).not.toMatch(/gallery\./)
    for (const img of container.querySelectorAll('img')) expect(img.getAttribute('alt')).not.toMatch(/^gallery\./)
  })
})

describe('D-66 — cảnh nền ảnh thật (thay hoạ tiết SVG)', () => {
  const NAMES = ['hero', 'story', 'artisan', 'products', 'lookbook', 'process', 'qr', 'testimonials', 'faq', 'auth', 'product', 'cart', 'batch', 'notFound']
  const credits = read('public/images/scene/CREDITS.md')

  it('mọi cảnh: lớp aria-hidden, không phần tử focus được, không SVG; ảnh có alt rỗng, có trong public và có dòng nguồn CC0', () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<Scene name={name} />)
      const layer = container.querySelector('.scene')
      expect(layer, name).toHaveAttribute('aria-hidden', 'true')
      expect(layer.querySelectorAll('a, button, input, select, textarea, [tabindex], [href], svg')).toHaveLength(0)
      for (const img of layer.querySelectorAll('img')) {
        expect(img.getAttribute('alt')).toBe('')
        const files = [img.getAttribute('src'), ...(img.getAttribute('srcset') ?? '').split(',').map((x) => x.trim().split(' ')[0])].filter(Boolean)
        for (const f of files) {
          expect(f).toMatch(/^\/images\/scene\/[\w-]+\.webp$/)
          expect(existsSync(join(process.cwd(), 'public', f)), f).toBe(true)
          const row = credits.split('\n').find((l) => l.includes('`' + f.split('/').pop() + '`'))
          expect(row, f).toMatch(/CC0 1\.0/)
        }
      }
      unmount()
    }
  })

  it('cảnh không tồn tại → không render gì', () => {
    const { container } = render(<Scene name="khong-co" />)
    expect(container.innerHTML).toBe('')
  })

  it('HomePage: 8 phần gắn Scene khác nhau, mỗi phần có class has-motifs; không còn FloatingMotifs', () => {
    const src = read('src/pages/HomePage.jsx')
    expect(src).not.toMatch(/FloatingMotifs/)
    const uses = [...src.matchAll(/<Scene name="([\w-]+)" \/>/g)]
    expect(uses).toHaveLength(8)
    for (const u of uses) {
      const prevLine = src.slice(0, u.index).trimEnd().split('\n').at(-1)
      expect(prevLine, u[1]).toMatch(/<(section|Reveal as="section")[^>]*className="[^"]*\bhas-motifs\b/)
    }
    expect(new Set(uses.map((u) => u[1])).size).toBe(8)
  })

  it('CSS: .has-motifs tạo stacking context; .scene nằm dưới nội dung; giảm chuyển động tắt khói và đèn bay', () => {
    expect(appCss).toMatch(/\.has-motifs \{[^}]*position: relative[^}]*isolation: isolate/)
    expect(appCss).toMatch(/\.scene \{[^}]*z-index: -1/)
    const reduce = [...appCss.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n')
    expect(reduce).toMatch(/\.scene-smoke \{\s*animation: none/)
    expect(reduce).toMatch(/\.scene-rise \{\s*display: none/)
  })
})

describe('Quy ước mã nguồn', () => {
  const files = (dir) =>
    readdirSync(join(process.cwd(), dir))
      .filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f))
      .map((f) => `${dir}/${f}`)

  it('không dùng motion.* dưới src/components, src/pages (LazyMotion strict)', () => {
    const hits = [...files('src/components'), ...files('src/pages')].filter((f) => /(?<![\w/.'"-])motion\.(?!js\b)[a-z]/.test(read(f)))
    expect(hits).toEqual([])
  })

  it.each(['src/components/FolkGallery.jsx', 'src/components/Scene.jsx'])('%s: không có chuỗi tiếng Việt viết cứng (ngoài comment)', (f) => {
    const code = read(f)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    // Chữ cái tiếng Việt có dấu (ký tự phân cách như · không tính)
    expect(code.match(/[À-ỹĐđ]+/g)).toBeNull()
  })

  it('data/folkArt.js không chứa chuỗi hiển thị tiếng Việt (tên/alt nằm ở i18n)', () => {
    for (const f of ['src/data/folkArt.js']) {
      const code = read(f).replace(/\/\/.*$/gm, '')
      expect(code.match(/['"`][^'"`]*[À-ỹ][^'"`]*['"`]/g), f).toBeNull()
    }
  })
})
