// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useRef } from 'react'
import { MotionConfig } from 'framer-motion'
import { group3, parseStat, useViewState } from '../lib/motion.js'
import { CountUp } from './Reveal.jsx'
import { Postmark } from './Motifs.jsx'

// IntersectionObserver giả: giữ callback để test tự bắn sự kiện vào/ra khung nhìn
function stubObserver() {
  const observers = []
  class IO {
    constructor(cb, opts) {
      this.cb = cb
      this.opts = opts
      observers.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.disconnected = true
    }
  }
  vi.stubGlobal('IntersectionObserver', IO)
  const fire = (isIntersecting, top) =>
    act(() => observers.forEach((o) => o.cb([{ isIntersecting, boundingClientRect: { top } }])))
  return { observers, fire }
}

function Probe({ margin }) {
  const ref = useRef(null)
  const state = useViewState(ref, margin)
  return (
    <div ref={ref} data-testid="probe">
      {state}
    </div>
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('useViewState — hiện khi cuộn tới, biến mất theo hướng cuộn', () => {
  it('bắt đầu ở "below", vào khung nhìn → "in"', () => {
    const { fire } = stubObserver()
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('below')
    fire(true, 100)
    expect(screen.getByTestId('probe')).toHaveTextContent('in')
  })

  it('rời khung nhìn phía trên → "above"; rời phía dưới → "below"', () => {
    const { fire } = stubObserver()
    render(<Probe />)
    fire(true, 100)
    fire(false, -500)
    expect(screen.getByTestId('probe')).toHaveTextContent('above')
    fire(true, 100)
    fire(false, 1200)
    expect(screen.getByTestId('probe')).toHaveTextContent('below')
  })

  it('dùng rootMargin được truyền vào và ngắt observer khi unmount', () => {
    const { observers } = stubObserver()
    const { unmount } = render(<Probe margin="0px" />)
    expect(observers[0].opts.rootMargin).toBe('0px')
    unmount()
    expect(observers[0].disconnected).toBe(true)
  })

  it('không có IntersectionObserver → luôn "in" để nội dung không bị ẩn', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('in')
  })
})

describe('CountUp', () => {
  it('SSR render giá trị thật (máy tìm kiếm và hydrate không lệch)', () => {
    const html = renderToString(<CountUp value="4.000+" />)
    expect(html).toContain('4.000+')
  })

  it('trình đọc màn hình luôn đọc giá trị thật; số chạy bị ẩn khỏi trình đọc', () => {
    stubObserver()
    const { container } = render(<CountUp value="100+" />)
    expect(container.querySelector('.sr-only')).toHaveTextContent('100+')
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('chưa tới khung nhìn → về 0 để lần sau đếm lại', () => {
    stubObserver()
    const { container } = render(<CountUp value="100+" />)
    expect(container.querySelector('[aria-hidden="true"]').textContent).toBe('0+')
  })

  it('NFR-A11Y-001: giảm chuyển động → giữ nguyên giá trị thật, không đếm', () => {
    stubObserver()
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <CountUp value="32" />
      </MotionConfig>,
    )
    expect(container.querySelector('[aria-hidden="true"]').textContent).toBe('32')
  })
})

describe('parseStat / group3', () => {
  it('tách số và hậu tố, bỏ dấu chấm hàng nghìn', () => {
    expect(parseStat('4.000+')).toEqual({ target: 4000, suffix: '+' })
    expect(parseStat('12')).toEqual({ target: 12, suffix: '' })
    expect(parseStat('abc')).toBeNull()
  })

  it('nhóm hàng nghìn bằng dấu chấm', () => {
    expect(group3(4000)).toBe('4.000')
    expect(group3(1234567)).toBe('1.234.567')
    expect(group3(99)).toBe('99')
  })
})

describe('Hoạ tiết trang trí', () => {
  it('dấu bưu điện ẩn với trình đọc màn hình', () => {
    const { container } = render(<Postmark label="MỘC" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
