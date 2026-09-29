import { useEffect, useId, useRef } from 'react'
import {
  m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotionConfig,
  useSpring,
} from 'framer-motion'
import { useFinePointer } from '../lib/motion.js'

// Hiệu ứng theo con trỏ (ý tưởng từ Aceternity UI, viết lại cho MỘC).
// Chỉ bật khi có chuột/bút chính xác và người dùng không bật giảm chuyển động.
// Mọi cập nhật đi qua motion value → không re-render React khi di chuột.

function usePointerEffects() {
  const fine = useFinePointer()
  const reduce = useReducedMotionConfig()
  return fine && !reduce
}

/**
 * Thẻ nghiêng 3D theo con trỏ, có vệt sáng đèn đi theo tay ("3D Card" + "Card Spotlight").
 * Con có class `.lift` nổi lên phía trước (translateZ trong CSS).
 */
export function TiltCard({ children, className = '', variants, custom, max = 10, ...rest }) {
  const active = usePointerEffects()
  const rx = useSpring(0, { stiffness: 180, damping: 18 })
  const ry = useSpring(0, { stiffness: 180, damping: 18 })
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  const glow = useSpring(0, { stiffness: 120, damping: 20 })
  const spot = useMotionTemplate`radial-gradient(280px circle at ${gx}% ${gy}%, rgba(255, 236, 190, 0.5), transparent 65%)`

  const handlers = active
    ? {
        onPointerEnter: () => glow.set(1),
        onPointerMove: (e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width
          const py = (e.clientY - r.top) / r.height
          ry.set((px - 0.5) * max * 2)
          rx.set((0.5 - py) * max * 1.6)
          gx.set(px * 100)
          gy.set(py * 100)
        },
        onPointerLeave: () => {
          rx.set(0)
          ry.set(0)
          glow.set(0)
        },
      }
    : {}

  return (
    <m.article
      className={`${className}${active ? ' is-tilt' : ''}`}
      variants={variants}
      custom={custom}
      style={active ? { rotateX: rx, rotateY: ry, transformPerspective: 1100 } : undefined}
      {...handlers}
      {...rest}
    >
      {active && <m.span className="card-spotlight" aria-hidden="true" style={{ background: spot, opacity: glow }} />}
      {children}
    </m.article>
  )
}

/** Quầng đèn ấm đi theo con trỏ trong khối cha ("Spotlight" / "Following Pointer"). */
export function PointerGlow({ className = '' }) {
  const ref = useRef(null)
  const active = usePointerEffects()
  const x = useSpring(0, { stiffness: 90, damping: 20, mass: 0.6 })
  const y = useSpring(0, { stiffness: 90, damping: 20, mass: 0.6 })
  const opacity = useSpring(0, { stiffness: 80, damping: 20 })

  useEffect(() => {
    const host = ref.current?.parentElement
    if (!active || !host) return undefined
    const move = (e) => {
      const r = host.getBoundingClientRect()
      x.set(e.clientX - r.left)
      y.set(e.clientY - r.top)
    }
    const enter = (e) => {
      const r = host.getBoundingClientRect()
      x.jump(e.clientX - r.left)
      y.jump(e.clientY - r.top)
      opacity.set(1)
    }
    const leave = () => opacity.set(0)
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerenter', enter)
    host.addEventListener('pointerleave', leave)
    return () => {
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerenter', enter)
      host.removeEventListener('pointerleave', leave)
    }
  }, [active, x, y, opacity])

  return (
    <m.span
      ref={ref}
      className={`pointer-glow ${className}`}
      aria-hidden="true"
      style={active ? { x, y, opacity } : { opacity: 0 }}
    />
  )
}

const draw = {
  below: { strokeDashoffset: 900, transition: { duration: 0.6 } },
  in: { strokeDashoffset: 0, transition: { duration: 2.6, ease: [0.22, 1, 0.36, 1] } },
  above: { strokeDashoffset: 900, transition: { duration: 0.6 } },
}

/**
 * Chữ thương hiệu cỡ lớn: nét viền tự vẽ ra khi cuộn tới; rê chuột thì màu son loang theo tay
 * ("Text Hover Effect"). Đặt trong một Reveal để nhận trạng thái below/in/above.
 */
export function BrandHover({ text }) {
  // id riêng cho mỗi lần dùng (lọc ký tự đặc biệt để `url(#…)` và selector luôn hợp lệ)
  const gradId = `brandInk-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const active = usePointerEffects()
  const reduce = useReducedMotionConfig()
  const cx = useSpring(50, { stiffness: 120, damping: 20 })
  const cy = useSpring(50, { stiffness: 120, damping: 20 })
  const r = useSpring(0, { stiffness: 120, damping: 20 })
  const cxp = useMotionTemplate`${cx}%`
  const cyp = useMotionTemplate`${cy}%`
  const rp = useMotionTemplate`${r}%`

  const handlers = active
    ? {
        onPointerMove: (e) => {
          const b = e.currentTarget.getBoundingClientRect()
          cx.set(((e.clientX - b.left) / b.width) * 100)
          cy.set(((e.clientY - b.top) / b.height) * 100)
        },
        onPointerEnter: () => r.set(28),
        onPointerLeave: () => r.set(0),
      }
    : {}

  return (
    <svg viewBox="0 0 600 170" className="brand-hover" aria-hidden="true" {...handlers}>
      <defs>
        <m.radialGradient id={gradId} gradientUnits="userSpaceOnUse" cx={cxp} cy={cyp} r={rp}>
          <stop offset="0%" stopColor="#e6a623" />
          <stop offset="45%" stopColor="#a83a2a" />
          <stop offset="100%" stopColor="#a83a2a" stopOpacity="0" />
        </m.radialGradient>
      </defs>
      <m.text
        x="50%"
        y="52%"
        className="brand-hover-stroke"
        strokeDasharray="900"
        variants={reduce ? undefined : draw}
      >
        {text}
      </m.text>
      <text x="50%" y="52%" className="brand-hover-fill" fill={`url(#${gradId})`}>
        {text}
      </text>
    </svg>
  )
}
