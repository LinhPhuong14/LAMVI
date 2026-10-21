// Logo chính thức của LAMVI (ảnh đại diện fanpage nâng cấp lên 400×400 — public/images/brand/CREDITS.md).
// alt="" khi nằm trong liên kết đã có aria-label "LAMVI" (tránh đọc đôi).
export const LOGO_SRC = '/images/brand/logo-round-400.jpg'

export default function Logo({ size = 44, className = '', decorative = false }) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src={LOGO_SRC}
      alt={decorative ? '' : 'LAMVI'}
      width={size}
      height={size}
      decoding="async"
    />
  )
}
