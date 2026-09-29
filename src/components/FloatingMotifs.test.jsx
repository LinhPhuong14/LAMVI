// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import FloatingMotifs from './FloatingMotifs.jsx'
import { MOTIFS, SECTION_MOTIFS } from '../data/motifs.js'

const css = readFileSync(join(process.cwd(), 'src/styles/App.css'), 'utf8')

describe('FloatingMotifs — hoạ tiết lơ lửng', () => {
  it('mọi bố cục chỉ dùng hoạ tiết có thật, tone hợp lệ, vị trí dạng %', () => {
    for (const [section, items] of Object.entries(SECTION_MOTIFS)) {
      for (const it of items) {
        expect(MOTIFS[it.m], `${section}: ${it.m}`).toBeTruthy()
        expect(['paper', 'dark', undefined]).toContain(it.tone)
        expect(it.x).toMatch(/^-?\d+%$/)
        expect(it.y).toMatch(/^-?\d+%$/)
        expect(it.w).toBeGreaterThan(0)
      }
    }
  })

  it('mọi nét là path SVG hợp lệ (DOMParser không báo lỗi)', () => {
    for (const [name, motif] of Object.entries(MOTIFS)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${motif.viewBox}">${motif.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
      expect(doc.querySelector('parsererror'), name).toBeNull()
      expect(motif.viewBox.split(' ').map(Number).every(Number.isFinite), name).toBe(true)
    }
  })

  it('lớp hoạ tiết ẩn với trình đọc màn hình và không bắt chuột', () => {
    const { container } = render(<FloatingMotifs preset="story" />)
    const layer = container.querySelector('.motif-layer')
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer.querySelectorAll('.motif')).toHaveLength(SECTION_MOTIFS.story.length)
    expect(css).toMatch(/\.motif-layer \{[^}]*pointer-events: none/)
  })

  it('khói dùng pathLength=1 để vẽ dần; mây/đường vân thì không', () => {
    const { container } = render(<FloatingMotifs preset="artisan" />)
    for (const el of container.querySelectorAll('.motif-smoke path')) expect(el).toHaveAttribute('pathLength', '1')
    for (const el of container.querySelectorAll('.motif-drift path')) expect(el).not.toHaveAttribute('pathLength')
  })

  it('preset không tồn tại → không render gì', () => {
    const { container } = render(<FloatingMotifs preset="khong-co" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('NFR-A11Y-001: CSS tắt chuyển động hoạ tiết khi giảm chuyển động', () => {
    const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduce).toMatch(/\.motif-drift/)
    expect(reduce).toMatch(/\.motif-smoke path/)
    expect(reduce).toMatch(/animation: none !important/)
  })
})
