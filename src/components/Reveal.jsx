import { useHydratedReducedMotion } from '../lib/hydration.js'
import { useEffect, useRef } from 'react'
import { animate, m } from 'framer-motion'
import { EASE_OUT, group3, parseStat, rise, useViewState } from '../lib/motion.js'

/** Khối tự theo dõi vị trí và truyền trạng thái xuống các con `m.*` dùng cùng tên biến thể. */
export function Reveal({ as = 'div', variants = rise, margin, children, ...props }) {
  const ref = useRef(null)
  const state = useViewState(ref, margin, 'in')
  // Giảm chuyển động: nội dung luôn hiện (framer chỉ bỏ phần dịch chuyển, vẫn giữ opacity)
  const reduce = useHydratedReducedMotion()
  const Tag = m[as]
  return (
    <Tag ref={ref} initial="in" animate={reduce ? 'in' : state} variants={variants} {...props}>
      {children}
    </Tag>
  )
}

/**
 * Số liệu đếm lên khi cuộn tới, về 0 khi rời đi để lần sau đếm lại.
 * Render ban đầu (kể cả SSR) là giá trị thật để không lệch khi hydrate và máy tìm kiếm đọc đúng;
 * trình đọc màn hình luôn đọc giá trị thật.
 */
export function CountUp({ value }) {
  const ref = useRef(null)
  // Đếm ngay khi số vừa lộ ra, để không ai kịp thấy số 0 đứng yên
  const state = useViewState(ref, '0px', 'in')
  // Theo MotionConfig của LocaleLayout (reducedMotion="user" → cài đặt của thiết bị) — NFR-A11Y-001
  const reduce = useHydratedReducedMotion()
  const stat = parseStat(value)
  const target = stat?.target
  const suffix = stat?.suffix

  // Chỉ đếm lại khi số đã từng ở ngoài màn hình; không bao giờ đặt về 0 khi chưa thấy
  // (ảnh chụp trang/Googlebot sẽ đọc "0+" — feedback 08/10, mục 12)
  const armed = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el || target === undefined || reduce) return undefined
    if (state !== 'in') {
      armed.current = true
      return undefined
    }
    if (!armed.current) return undefined
    const controls = animate(0, target, {
      duration: Math.min(1.8, 0.6 + target / 2500),
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = `${group3(Math.round(v))}${suffix}`
      },
    })
    return () => controls.stop()
  }, [state, reduce, target, suffix])

  return (
    <strong>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </strong>
  )
}
