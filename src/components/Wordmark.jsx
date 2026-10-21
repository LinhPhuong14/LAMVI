// Logotype vector chuẩn "LAMVI" (public/images/brand/logotype.svg, từ LAMVI_logotype_vector_chuan.pdf).
// Tỉ lệ 180,75 : 49,5. alt="" khi nằm trong liên kết đã có aria-label "LAMVI".
export const WORDMARK_SRC = '/images/brand/logotype.svg'
const RATIO = 180.75 / 49.5

export default function Wordmark({ height = 34, className = '', decorative = false }) {
  return (
    <img
      className={`brand-wordmark ${className}`.trim()}
      src={WORDMARK_SRC}
      alt={decorative ? '' : 'LAMVI'}
      width={Math.round(height * RATIO)}
      height={height}
      decoding="async"
    />
  )
}
