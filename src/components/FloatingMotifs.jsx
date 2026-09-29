// Bộ hoạ tiết dân gian lơ lửng: mây, đường vân, nét khói — tự vẽ, nét mảnh, cùng tông với nền.
// Chuyển động bằng CSS (transform/opacity; khói dùng stroke-dashoffset trên vài nét nhỏ), tắt khi giảm chuyển động.
import { MOTIFS, SECTION_MOTIFS } from '../data/motifs.js'

function Motif({ m, x, y, w, dur = 24, delay = 0, flip = false, tone = 'paper' }) {
  const motif = MOTIFS[m]
  if (!motif) return null
  const [, , vw, vh] = motif.viewBox.split(' ').map(Number)
  return (
    <span
      className={`motif motif-${tone}${motif.smoke ? ' motif-smoke' : ' motif-drift'}`}
      style={{ left: x, top: y, width: w, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
    >
      <svg
        viewBox={motif.viewBox}
        width={w}
        height={Math.round((w * vh) / vw)}
        style={flip ? { transform: 'scaleX(-1)' } : undefined}
      >
        {motif.paths.map((d, i) => (
          <path
            key={i}
            d={d}
            pathLength={motif.smoke ? 1 : undefined}
            vectorEffect="non-scaling-stroke"
            style={motif.smoke ? { animationDuration: `${dur}s`, animationDelay: `${delay - i * 1.4}s` } : undefined}
          />
        ))}
      </svg>
    </span>
  )
}

/** Lớp hoạ tiết lơ lửng phía sau nội dung của một phần. Chỉ trang trí → aria-hidden. */
export default function FloatingMotifs({ preset }) {
  const items = SECTION_MOTIFS[preset]
  if (!items) return null
  return (
    <div className="motif-layer" aria-hidden="true">
      {items.map((it, i) => (
        <Motif key={i} {...it} />
      ))}
    </div>
  )
}
