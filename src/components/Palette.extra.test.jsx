// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho bảng màu mới (T-26): tương phản WCAG tính từ hex thật trong :root, màu viết cứng cũ, biến CSS.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (f) => readFileSync(join(process.cwd(), f), 'utf8')
const indexCss = read('src/index.css')
const appCss = read('src/styles/App.css')
const pagesCss = read('src/styles/pages.css')
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')

// Lấy token hex trong khối :root đầu tiên của index.css
const rootBlock = stripComments(indexCss).match(/:root\s*\{([\s\S]*?)\n\}/)[1]
const TOKENS = Object.fromEntries(
  [...rootBlock.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, k, v]) => [k, v.toLowerCase()]),
)

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lum = (hex) => {
  const [r, g, b] = rgb(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
// Trộn màu rgba lên nền đặc
const blend = ([r, g, b], alpha, bg) =>
  '#' +
  [r, g, b]
    .map((v, i) => Math.round(v * alpha + rgb(bg)[i] * (1 - alpha)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')

describe('T-26 — token màu trong :root', () => {
  it('có đủ token nêu ở design-rules §2.1', () => {
    for (const k of ['diep', 'diep-deep', 'diep-light', 'than', 'than-2', 'than-soft', 'son', 'son-deep', 'hoe', 'hoe-light', 'cham', 'cham-deep', 'la', 'hong', 'sepia', 'line']) {
      expect(TOKENS[k], `--${k}`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('hex trong :root khớp bảng design-rules §2.1', () => {
    const rules = read('docs/knowledge/design-rules.md')
    for (const [, k, hex] of rules.matchAll(/\| `--([\w-]+)` \| `(#[0-9a-f]{6})`/g)) {
      expect(TOKENS[k], `--${k}`).toBe(hex)
    }
  })
})

describe('T-26 — tương phản WCAG (tự tính từ hex, ngưỡng AA 4,5:1 chữ thường)', () => {
  // [chữ, nền, tỉ lệ ghi ở design-rules §2.3]
  const PAIRS = [
    ['than', 'diep', 13.5],
    ['than-soft', 'diep', 7.2],
    ['than-soft', 'diep-deep', 6.3],
    ['son', 'diep', 6.0],
    ['diep-light', 'son', 6.5],
    ['hoe-light', 'cham', 7.4],
    ['diep', 'cham', 10.4],
    ['sepia', 'diep', 5.2],
    // eyebrow trên nền tối
    ['hoe-light', 'cham-deep', null],
  ]
  it.each(PAIRS)('--%s trên --%s ≥ 4,5 và khớp số đã ghi', (fg, bg, doc) => {
    const r = ratio(TOKENS[fg], TOKENS[bg])
    expect(r, `${fg}/${bg} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    if (doc) expect(Math.abs(r - doc), `${fg}/${bg} = ${r.toFixed(2)} (ghi ${doc})`).toBeLessThan(0.1)
  })

  it('--hoe trên --cham < 4,5 (đúng như design-rules nói, không được dùng cho chữ)', () => {
    expect(ratio(TOKENS.hoe, TOKENS.cham)).toBeLessThan(4.5)
  })

  it('.story .eyebrow và .lookbook .eyebrow dùng --hoe-light (không dùng --hoe/--son trên nền tối)', () => {
    const css = stripComments(appCss)
    for (const sel of ['.story .eyebrow', '.lookbook .eyebrow']) {
      const esc = sel.replace(/\./g, '\\.')
      const blocks = [...css.matchAll(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1])
      expect(blocks.length, sel).toBeGreaterThan(0)
      const colors = blocks.flatMap((b) => [...b.matchAll(/(?:^|;|\s)color:\s*([^;]+);/g)].map((m) => m[1].trim()))
      expect(colors.at(-1), sel).toBe('var(--hoe-light)')
    }
  })

  it('nền .story là --cham, nền .lookbook là --cham-deep', () => {
    expect(appCss).toMatch(/\.story \{[^}]*background:[^;]*var\(--cham\)/)
    expect(appCss).toMatch(/\.lookbook \{[^}]*background: var\(--cham-deep\)/)
  })

  // Chữ phụ trong phòng tranh & phần Di sản: rgba(245, 236, 215, a) trên --cham
  it('chữ rgba(245,236,215,a) trong App.css đạt ≥ 4,5 trên --cham (nền tối sáng nhất)', () => {
    const alphas = [...new Set([...stripComments(appCss).matchAll(/(?:^|[\s;{])color:\s*rgba\(245, 236, 215, ([\d.]+)\)/g)].map((m) => Number(m[1])))]
    expect(alphas.length).toBeGreaterThan(0)
    const low = alphas.filter((a) => ratio(blend([245, 236, 215], a, TOKENS.cham), TOKENS.cham) < 4.5)
    expect(low, 'alpha quá thấp').toEqual([])
  })
})

describe('T-26 — không còn màu viết cứng cũ trong App.css', () => {
  it.each(['#3a2a1e', '#e9876b', 'rgba(214, 156, 52', 'rgba(168, 58, 42', 'rgba(236, 202, 134'])('%s', (s) => {
    const hits = appCss
      .split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => l.toLowerCase().includes(s))
      .map(([n, l]) => `App.css:${n}: ${l.trim()}`)
    expect(hits).toEqual([])
  })
})

describe('T-26 — biến CSS', () => {
  it('mọi var(--x) trong App.css/pages.css đều được định nghĩa (CSS hoặc style inline trong JSX)', () => {
    const defined = new Set()
    const jsx = []
    const walk = (dir) => {
      for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const p = `${dir}/${e.name}`
        if (e.isDirectory()) walk(p)
        else if (/\.jsx?$/.test(e.name) && !/\.test\./.test(e.name)) jsx.push(read(p))
      }
    }
    walk('src')
    for (const src of [indexCss, appCss, pagesCss]) for (const m of stripComments(src).matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
    for (const src of jsx) for (const m of src.matchAll(/['"](--[\w-]+)['"]\s*:/g)) defined.add(m[1])
    const missing = new Set()
    for (const src of [appCss, pagesCss]) {
      for (const m of stripComments(src).matchAll(/var\((--[\w-]+)(\s*,)?/g)) if (!defined.has(m[1]) && !m[2]) missing.add(m[1])
    }
    expect([...missing]).toEqual([])
  })
})
