// @vitest-environment jsdom
// D-131: lớp họa tiết dân gian: mọi phần tử trang trí aria-hidden, không nhận focus
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Colophon, Diem, DrumWatermark, LanternString, RoofEdge } from './Folk.jsx'

describe('Folk', () => {
  it('Diem có biến thể sáng/tối và aria-hidden', () => {
    const { container } = render(
      <>
        <Diem tone="light" />
        <Diem tone="dark" />
      </>,
    )
    const els = container.querySelectorAll('.diem')
    expect(els[0].className).toContain('diem-light')
    expect(els[1].className).toContain('diem-dark')
    for (const e of els) expect(e.getAttribute('aria-hidden')).toBe('true')
  })

  it('RoofEdge nhận nền xuất phát', () => {
    const { container } = render(<RoofEdge from="deep" />)
    expect(container.querySelector('.roof-edge').className).toContain('roof-from-deep')
  })

  it('DrumWatermark vẽ mặt trống đồng, đặt bên trái hoặc phải, aria-hidden', () => {
    const { container } = render(<DrumWatermark side="left" />)
    const w = container.querySelector('.drum-watermark')
    expect(w.className).toContain('drum-left')
    expect(w.getAttribute('aria-hidden')).toBe('true')
    expect(w.querySelector('svg.drum-sun')).not.toBeNull()
  })

  it('LanternString có sợi dây và sáu đèn đung đưa lệch pha, không có phần tử focus được', () => {
    const { container } = render(<LanternString />)
    expect(container.querySelector('.lantern-string').getAttribute('aria-hidden')).toBe('true')
    const items = container.querySelectorAll('.lantern-string-item')
    expect(items).toHaveLength(6)
    expect(new Set([...items].map((i) => i.style.animationDelay)).size).toBe(6)
    expect(container.querySelectorAll('a,button,input,[tabindex]')).toHaveLength(0)
  })

  it('Colophon: chữ dọc kèm ấn, aria-hidden', () => {
    const { container } = render(<Colophon seal="LV">Giấy dó · Đông Hồ</Colophon>)
    expect(container.querySelector('.colophon').getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.colophon-text').textContent).toBe('Giấy dó · Đông Hồ')
    expect(container.querySelector('.colophon-seal').textContent).toBe('LV')
  })
})
