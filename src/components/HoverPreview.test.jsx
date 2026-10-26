// @vitest-environment jsdom
// usePreview (D-124): khung xem trước phóng to khi rê chuột/focus, chỉ ở thiết bị có chuột
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { usePreview } from './HoverPreview.jsx'

function Demo() {
  const { bind, node } = usePreview({ src: '/a.jpg', title: 'Tứ Linh', subtitle: 'LAMVI' })
  return (
    <div>
      <button type="button" {...bind}>
        thẻ
      </button>
      {node}
    </div>
  )
}

const media = (hover) =>
  vi.stubGlobal('matchMedia', (query) => ({ matches: hover && query === '(hover: hover)', media: query, addEventListener() {}, removeEventListener() {} }))

afterEach(() => vi.unstubAllGlobals())

describe('usePreview', () => {
  it('(hover: hover) → rê chuột hiện tooltip trong document.body; rời chuột thì ẩn', () => {
    media(true)
    const { container } = render(<Demo />)
    expect(document.querySelector('.hover-preview')).toBeNull()
    fireEvent.mouseEnter(screen.getByRole('button'))
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveClass('hover-preview')
    expect(container.contains(tip)).toBe(false) // portal
    expect(document.body.contains(tip)).toBe(true)
    expect(tip.querySelector('img')).toHaveAttribute('src', '/a.jpg')
    expect(tip).toHaveTextContent('Tứ Linh')
    expect(tip).toHaveTextContent('LAMVI')
    fireEvent.mouseLeave(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('focus hiện, blur ẩn', () => {
    media(true)
    render(<Demo />)
    fireEvent.focus(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.blur(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('không có (hover: hover) (màn hình cảm ứng) → không hiện', () => {
    media(false)
    render(<Demo />)
    fireEvent.mouseEnter(screen.getByRole('button'))
    fireEvent.focus(screen.getByRole('button'))
    expect(document.querySelector('.hover-preview')).toBeNull()
  })

  it('không có matchMedia → không lỗi, không hiện', () => {
    vi.stubGlobal('matchMedia', undefined)
    render(<Demo />)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(document.querySelector('.hover-preview')).toBeNull()
  })
})
