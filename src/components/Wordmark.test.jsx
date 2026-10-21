// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Wordmark, { WORDMARK_SRC } from './Wordmark.jsx'

describe('Wordmark (logotype vector chuẩn)', () => {
  it('giữ tỉ lệ 180,75:49,5, alt LAMVI hoặc rỗng khi nằm trong liên kết đã có nhãn', () => {
    const { container, rerender } = render(<Wordmark height={34} />)
    const img = container.querySelector('img')
    expect(img.getAttribute('src')).toBe(WORDMARK_SRC)
    expect(img.getAttribute('alt')).toBe('LAMVI')
    expect(img.getAttribute('height')).toBe('34')
    expect(img.getAttribute('width')).toBe('124')
    rerender(<Wordmark height={34} decorative />)
    expect(container.querySelector('img').getAttribute('alt')).toBe('')
  })
  it('tệp SVG là vector thật (đường nét, không nhúng ảnh raster)', () => {
    const svg = readFileSync('public/images/brand/logotype.svg', 'utf8')
    expect(svg).toMatch(/<svg[^>]*viewBox="0 0 180\.75 49\.5"/)
    expect(svg).toContain('<path')
    expect(svg).not.toMatch(/<image|data:image/)
    expect(svg.length).toBeLessThan(200_000)
  })
})
