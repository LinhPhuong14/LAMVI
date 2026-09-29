// Minh hoạ cho dashboard tài khoản — SVG tự vẽ theo lối khắc gỗ nét mảnh, cùng bảng màu (design-rules §2).
// Chỉ trang trí → aria-hidden. Không dùng ảnh tư liệu (§7.2) để không gây hiểu lầm là ảnh thật.
import Lantern from './Lantern'
import { Cloud, DrumSun } from './Motifs'

const INK = '#3a2a1e'
const PAPER = '#f4ede0'
const PAPER_DEEP = '#e9dfcb'
const HOE = '#e2c68f'
const SON = '#a3321f'

function Svg({ children, className = '', size = 64 }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`dash-art ${className}`}
      aria-hidden="true"
      fill="none"
      stroke={INK}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

/** Cảnh đầu trang: dây đèn treo trước mặt trống đồng, mây trôi. */
export function HeroScene() {
  return (
    <div className="dash-scene" aria-hidden="true">
      <DrumSun className="dash-scene-drum" />
      <Cloud className="dash-scene-cloud dash-scene-cloud-a" />
      <Cloud className="dash-scene-cloud dash-scene-cloud-b" />
      <svg className="dash-scene-string" viewBox="0 0 300 60" preserveAspectRatio="none">
        <path d="M0 6 Q150 58 300 6" fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="1.2" />
      </svg>
      <span className="dash-scene-lantern l1">
        <Lantern size={58} tone="dawn" swing />
      </span>
      <span className="dash-scene-lantern l2">
        <Lantern size={78} tone="amber" swing flicker />
      </span>
      <span className="dash-scene-lantern l3">
        <Lantern size={58} tone="moss" swing />
      </span>
    </div>
  )
}

/** Hộp quà buộc nơ — ô số liệu đơn hàng. */
export function GiftArt({ size = 64 }) {
  return (
    <Svg size={size}>
      <rect x="12" y="28" width="40" height="26" rx="3" fill={PAPER_DEEP} />
      <rect x="9" y="20" width="46" height="10" rx="2.5" fill={PAPER} />
      <path d="M32 20v34" stroke={SON} strokeWidth="3" />
      <path d="M32 20c-4-9-15-10-15-4 0 4 8 4 15 4zM32 20c4-9 15-10 15-4 0 4-8 4-15 4z" fill={HOE} />
      <path d="M18 38c3 2 6 2 9 0M37 44c3 2 6 2 9 0" strokeOpacity="0.45" />
    </Svg>
  )
}

/** Phong thư đóng ấn son — hồ sơ. */
export function LetterArt({ size = 96 }) {
  return (
    <Svg size={size}>
      <rect x="8" y="16" width="48" height="34" rx="4" fill={PAPER} />
      <path d="M8 20l24 17 24-17" fill={PAPER_DEEP} />
      <path d="M10 48l16-13M54 48L38 35" strokeOpacity="0.5" />
      <circle cx="32" cy="37" r="6.5" fill={SON} stroke="none" />
      <circle cx="32" cy="37" r="4.2" stroke={PAPER} strokeWidth="0.9" />
      <path d="M44 10c3 1 5 3 6 6M48 7c2 1 4 3 5 5" stroke={HOE} strokeWidth="1.3" />
    </Svg>
  )
}

/** Bốn công đoạn làm đèn (C-11) — minh hoạ cho tab đơn hàng. */
export function StepArt({ step, size = 64 }) {
  if (step === 0)
    // Chọn giấy dó: hai tấm giấy chồng, sợi dó
    return (
      <Svg size={size}>
        <rect x="14" y="12" width="32" height="40" rx="3" fill={PAPER_DEEP} transform="rotate(-8 30 32)" />
        <rect x="18" y="12" width="32" height="40" rx="3" fill={PAPER} transform="rotate(5 34 32)" />
        <path d="M25 22c4 2 9 1 13 3M24 30c5 1 10 0 15 2M26 38c4 1 7 1 11 2" strokeOpacity="0.45" />
      </Svg>
    )
  if (step === 1)
    // Lên khung tre: khung đèn, nan uốn
    return (
      <Svg size={size}>
        <path d="M32 6v6M32 52v6" />
        <ellipse cx="32" cy="14" rx="10" ry="3" fill={HOE} />
        <ellipse cx="32" cy="50" rx="10" ry="3" fill={HOE} />
        <path d="M22 14C14 24 14 40 22 50M42 14c8 10 8 26 0 36M27 14c-4 10-4 26 0 36M37 14c4 10 4 26 0 36" />
        <path d="M17 32h30" strokeOpacity="0.5" />
      </Svg>
    )
  if (step === 2)
    // Phơi nắng: mặt trời trên dây phơi giấy
    return (
      <Svg size={size}>
        <circle cx="46" cy="16" r="7" fill={HOE} />
        <path d="M46 4v3M46 25v3M34 16h3M55 16h3M38 8l2 2M52 22l2 2M54 8l-2 2" stroke={HOE} strokeWidth="1.6" />
        <path d="M4 30q28 8 56 0" strokeOpacity="0.6" />
        <rect x="12" y="32" width="14" height="20" rx="1.5" fill={PAPER} transform="rotate(-3 19 42)" />
        <rect x="34" y="33" width="14" height="20" rx="1.5" fill={PAPER_DEEP} transform="rotate(4 41 43)" />
      </Svg>
    )
  // Đóng gói & khắc QR: hộp có ô mã
  return (
    <Svg size={size}>
      <path d="M10 22l22-10 22 10v26L32 58 10 48z" fill={PAPER} />
      <path d="M10 22l22 10 22-10M32 32v26" />
      <g fill={INK} stroke="none">
        <rect x="16" y="33" width="4" height="4" />
        <rect x="22" y="35" width="3" height="3" />
        <rect x="16" y="39" width="3" height="3" />
        <rect x="21" y="41" width="4" height="4" />
      </g>
      <path d="M40 38l8-4" stroke={SON} strokeWidth="2.2" />
    </Svg>
  )
}
