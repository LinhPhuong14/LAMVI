import { useCallback, useEffect, useRef, useState } from 'react'
import { useHydratedReducedMotion } from '../lib/hydration.js'
import { useI18n } from '../i18n/index.js'

// Băng chuyền cho dải thẻ cuộn ngang (D-123). Bọc quanh MỘT phần tử "đường chạy" (lưới thẻ); khi hydrate, đường chạy
// được thêm lớp `is-carousel` (CSS biến lưới thành dải cuộn có snap). Không có JS → vẫn là lưới thường.
// Tự chạy mỗi `interval` ms khi đang trong màn hình; dừng khi rê chuột, focus, chạm, tab ẩn hoặc bật giảm chuyển động.
export default function Carousel({ children, label, interval = 2000 }) {
  const { t } = useI18n()
  const wrap = useRef(null)
  const reduce = useHydratedReducedMotion()
  const [count, setCount] = useState(0)
  const [index, setIndex] = useState(0)
  const hold = useRef(false)
  const visible = useRef(false)

  const track = () => wrap.current?.firstElementChild ?? null
  const step = () => {
    const el = track()
    const first = el?.children[0]
    if (!el || !first) return 0
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    return first.getBoundingClientRect().width + gap
  }

  useEffect(() => {
    const el = track()
    if (!el) return undefined
    el.classList.add('is-carousel')
    const measure = () => setCount(el.children.length)
    measure()
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const s = step()
        if (s) setIndex(Math.min(el.children.length - 1, Math.round(el.scrollLeft / s)))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      mo.disconnect()
      el.classList.remove('is-carousel')
    }
  }, [])

  const go = useCallback((dir) => {
    const el = wrap.current?.firstElementChild
    const first = el?.children[0]
    if (!el || !first) return
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    const s = first.getBoundingClientRect().width + gap
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    if (dir > 0 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' })
    else if (dir < 0 && el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    else el.scrollBy({ left: dir * s, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const root = wrap.current
    if (!root || reduce || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.4 })
    io.observe(root)
    const timer = setInterval(() => {
      if (!hold.current && visible.current && !document.hidden) go(1)
    }, interval)
    return () => {
      io.disconnect()
      clearInterval(timer)
    }
  }, [reduce, interval, go])

  const pause = (on) => () => {
    hold.current = on
  }
  const touch = () => {
    hold.current = true
    clearTimeout(touch.t)
    touch.t = setTimeout(() => (hold.current = false), 9000)
  }

  return (
    <div
      className="carousel"
      ref={wrap}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={pause(true)}
      onMouseLeave={pause(false)}
      onFocus={pause(true)}
      onBlur={pause(false)}
      onTouchStart={touch}
    >
      {children}
      {count > 1 && (
        <div className="carousel-ui">
          <button type="button" className="carousel-btn" onClick={() => go(-1)} aria-label={t('carousel.prev')}>
            ←
          </button>
          <div className="carousel-dots" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className={i === index ? 'is-on' : ''} />
            ))}
          </div>
          <button type="button" className="carousel-btn" onClick={() => go(1)} aria-label={t('carousel.next')}>
            →
          </button>
        </div>
      )}
    </div>
  )
}
