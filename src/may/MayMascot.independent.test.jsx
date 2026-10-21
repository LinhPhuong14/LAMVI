// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import MayAvatar from './MayAvatar.jsx'
import { MAY_POSES } from './poses.js'

const dir = 'public/images/may'
const webp = (f) => readFileSync(`${dir}/${f}.webp`)

describe('mascot Mây — tệp WebP', () => {
  it.each(MAY_POSES)('%s: WebP hợp lệ, có alpha, <=120KB, <=600px', (p) => {
    const b = webp(p)
    expect(b.toString('latin1', 0, 4)).toBe('RIFF')
    expect(b.toString('latin1', 8, 12)).toBe('WEBP')
    expect(statSync(`${dir}/${p}.webp`).size).toBeLessThanOrEqual(120 * 1024)
    const fmt = b.toString('latin1', 12, 16)
    let w, h, alpha
    if (fmt === 'VP8X') {
      alpha = (b[20] & 0x10) !== 0
      w = 1 + b.readUIntLE(24, 3)
      h = 1 + b.readUIntLE(27, 3)
    } else if (fmt === 'VP8L') {
      const v = b.readUInt32LE(21)
      w = (v & 0x3fff) + 1
      h = ((v >> 14) & 0x3fff) + 1
      alpha = ((v >> 28) & 1) === 1
    } else {
      throw new Error(`không có alpha: ${fmt}`)
    }
    expect(alpha).toBe(true)
    expect(w).toBeLessThanOrEqual(600)
    expect(h).toBeLessThanOrEqual(600)
  })
  it('không có tệp webp thừa/thiếu so với poses.js', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.replace('.webp', ''))
    expect(files.sort()).toEqual([...MAY_POSES].sort())
  })
})

describe('MayAvatar — a11y & CLS', () => {
  it.each(MAY_POSES)('%s: alt rỗng, width/height, không focus được', (p) => {
    const { container } = render(<MayAvatar pose={p} size={44} />)
    const img = container.querySelector('img')
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('width')).toBe('44')
    expect(img.getAttribute('height')).toBe('44')
    expect(img.hasAttribute('tabindex')).toBe(false)
  })
  it('nút nổi vẫn giữ tên truy cập từ aria-label', () => {
    const { container } = render(
      <button type="button" aria-label="Mở Mây"><MayAvatar size={60} /></button>,
    )
    const btn = container.querySelector('button')
    expect(btn.getAttribute('aria-label')).toBe('Mở Mây')
    expect(btn.querySelectorAll('img[alt=""]').length).toBe(1)
    expect(container.querySelectorAll('img:not([alt])').length).toBe(0)
  })
  it('SVG dự phòng (sleepy) vẫn aria-hidden', () => {
    const { container } = render(<MayAvatar mood="sleepy" />)
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  })
})

