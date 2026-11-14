import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import '@fontsource/itim/400.css'
import './letters.css'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * Hiệu ứng viết tay cho tiêu đề phong thư (yêu cầu người dùng, v0.82): nét mực chạy theo đường viền
 * từng chữ (stroke-dashoffset) trong khi một vệt ngòi bút quét trái → phải, rồi mực đổ đầy chữ.
 * Tên người nhận là dữ liệu động nên không có sẵn nét vẽ SVG — vẽ theo đường viền glyph của font
 * viết tay Itim (có bộ tiếng Việt). Xong gọi onDone để phần nội dung fade in.
 * Giảm chuyển động: hiện ngay, gọi onDone ngay.
 *
 * @param {object} p
 * @param {string} p.text
 * @param {() => void} [p.onDone]
 * @param {boolean} [p.instant] hiện ngay (khung xem trước admin)
 * @param {string} [p.as] thẻ tiêu đề (mặc định h1; trong Phòng thư là h2)
 * @param {string} [p.className] lớp thêm cho thẻ tiêu đề
 * @param {import('react').ReactNode} [p.children] phần trang trí sau chữ (vd. nét gạch chân)
 */
export default function HandwrittenTitle({ text, onDone, instant: forceInstant = false, as: Tag = 'h1', className = 'lt-greeting', children }) {
  const textRef = useRef(null)
  const [box, setBox] = useState(null)
  const [reduced] = useState(reducedMotion)
  const instant = forceInstant || reduced
  const done = useRef(false)
  // ~85 ms mỗi ký tự, trong khoảng 1,4–4 giây
  const duration = Math.min(4, Math.max(1.4, [...text].length * 0.085))

  const finish = () => {
    if (done.current) return
    done.current = true
    onDone?.()
  }

  // Đo khung chữ thật để viewBox ôm vừa (tên dài/ngắn khác nhau); đo lại khi font Itim tải xong
  useIsoLayoutEffect(() => {
    let alive = true
    const measure = () => {
      const el = textRef.current
      if (!alive || !el?.getBBox) return
      try {
        const b = el.getBBox()
        if (b.width > 0) setBox({ x: b.x - 6, y: b.y - 6, w: b.width + 12, h: b.height + 12 })
      } catch {
        /* jsdom / chưa có layout: dùng viewBox mặc định */
      }
    }
    measure()
    document.fonts?.ready?.then(measure).catch(() => {})
    return () => {
      alive = false
    }
  }, [text])

  useEffect(() => {
    if (instant) {
      finish()
      return
    }
    // Nghe trực tiếp sự kiện DOM (React chỉ gắn onAnimationEnd khi nhận ra AnimationEvent)
    const el = textRef.current
    const onEnd = (e) => e.animationName === 'lt-hw-fill' && finish()
    el?.addEventListener('animationend', onEnd)
    // Phòng khi animationend không bắn (tab ẩn, trình duyệt cũ)
    const id = setTimeout(finish, (duration + 0.8) * 1000)
    return () => {
      clearTimeout(id)
      el?.removeEventListener('animationend', onEnd)
    }
  }, [instant, duration]) // oxlint-disable-line react-hooks/exhaustive-deps

  const vb = box ?? { x: 0, y: -48, w: Math.max(200, [...text].length * 26), h: 64 }
  return (
    <Tag className={`${className} lt-hw-wrap`}>
      <svg
        className={`lt-hw${instant ? ' is-instant' : ''}`}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ '--hw-dur': `${duration}s`, aspectRatio: `${vb.w} / ${vb.h}` }}
        role="img"
        aria-label={text}
        focusable="false"
      >
        <defs>
          <linearGradient id="lt-hw-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0.9" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="lt-hw-mask" maskUnits="userSpaceOnUse" x={vb.x} y={vb.y} width={vb.w} height={vb.h}>
            {/* Vệt ngòi bút: dải mask lớn dần trái → phải */}
            <rect className="lt-hw-sweep" x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#lt-hw-fade)" style={{ transformOrigin: `${vb.x}px 0` }} />
          </mask>
        </defs>
        <text
          ref={textRef}
          className="lt-hw-text"
          x="0"
          y="0"
          mask={instant ? undefined : 'url(#lt-hw-mask)'}
          aria-hidden="true"
        >
          {text}
        </text>
      </svg>
      {children}
    </Tag>
  )
}
