import Lantern from './Lantern'
import { DrumSun } from './Motifs'

// Lớp họa tiết dân gian Việt cho trang chủ (D-131). Mọi thứ thuần SVG/CSS, aria-hidden, chuyển động chậm bằng CSS
// (tắt khi giảm chuyển động). Màu theo bảng thương hiệu (caramel, nâu); không thêm màu đỏ hay xanh.

/** Đường diềm (diềm tranh Đông Hồ): dải tam giác xen chấm tròn kiểu hoa văn trống đồng, ngăn hai phần. */
export function Diem({ tone = 'light', className = '' }) {
  return <div className={`diem diem-${tone} ${className}`.trim()} aria-hidden="true" />
}

/** Mái đình: mép nền chuyển từ giấy sang nâu đậm (design-rules §4). Đặt làm phần tử đầu tiên của khối tối. */
export function RoofEdge({ from = 'diep' }) {
  return <div className={`roof-edge roof-from-${from}`} aria-hidden="true" />
}

/** Mặt trống đồng lớn, mờ, xoay rất chậm phía sau tiêu đề. */
export function DrumWatermark({ side = 'right', className = '' }) {
  return (
    <div className={`drum-watermark drum-${side} ${className}`.trim()} aria-hidden="true">
      <DrumSun />
    </div>
  )
}

/** Dây đèn lồng treo ngang khối: sợi dây võng và các đèn đung đưa lệch pha. */
const STRING = [
  { x: 8, y: 22, size: 48, tone: 'amber', delay: 0 },
  { x: 24, y: 40, size: 62, tone: 'dusk', delay: -1.2 },
  { x: 42, y: 50, size: 50, tone: 'amber', delay: -2.1 },
  { x: 60, y: 46, size: 67, tone: 'dawn', delay: -0.6 },
  { x: 78, y: 34, size: 53, tone: 'amber', delay: -1.7 },
  { x: 93, y: 18, size: 45, tone: 'dusk', delay: -2.6 },
]
export function LanternString({ className = '' }) {
  return (
    <div className={`lantern-string ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none">
        <path d="M0 6 Q 50 62 100 6" fill="none" stroke="currentColor" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {STRING.map((l) => (
        <span key={l.x} className="lantern-string-item" style={{ left: `${l.x}%`, top: `${l.y}%`, width: l.size, animationDelay: `${l.delay}s` }}>
          <Lantern size={l.size} tone={l.tone} swing />
        </span>
      ))}
    </div>
  )
}

/** Lạc khoản: dòng chữ dọc ở mép khối, kết bằng một ấn vuông (như dòng đề tên và ấn trên tranh). */
export function Colophon({ children, seal = 'LV' }) {
  return (
    <p className="colophon" aria-hidden="true">
      <span className="colophon-text">{children}</span>
      <span className="colophon-seal">{seal}</span>
    </p>
  )
}
