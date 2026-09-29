import { useId } from 'react'

// [sáng, giữa, tối, màu dải hoa văn]
const TONES = {
  amber: ['#fff6d4', '#f2c04e', '#c27f17', '#b8322a'],
  dawn: ['#fff0e2', '#f19c80', '#b64a37', '#1e3553'],
  dusk: ['#ffe4ad', '#e8683a', '#98281d', '#e6a623'],
  moss: ['#f6f2d2', '#c0b560', '#56703b', '#b8322a'],
}

const INK = '#3a2a1e'

/**
 * Đèn giấy vẽ theo lối tranh khắc gỗ: nét mực đậm, màu phẳng, dải răng cưa, tua rua.
 * `swing` treo đèn đung đưa quanh móc; `flicker` cho ánh lửa bên trong chập chờn.
 * Hiệu ứng chạy bằng CSS (transform/opacity) để không tốn luồng JS.
 */
export default function Lantern({
  size = 220,
  tone = 'amber',
  swing = false,
  flicker = false,
  className = '',
}) {
  const uid = useId()
  const bodyId = `lanternBody-${uid}`
  const flameId = `lanternFlame-${uid}`
  const clipId = `lanternClip-${uid}`
  const [c1, c2, c3, band] = TONES[tone] || TONES.amber
  const body =
    'M70 52 C44 94 44 176 70 218 C84 240 116 240 130 218 C156 176 156 94 130 52 Z'

  return (
    <svg
      viewBox="0 0 200 290"
      width={size}
      height={(size * 290) / 200}
      className={`lantern-svg ${swing ? 'is-swing' : ''} ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={bodyId} cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="55%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </radialGradient>
        <radialGradient id={flameId} cx="50%" cy="52%" r="40%">
          <stop offset="0%" stopColor="#fffbe8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fffbe8" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={body} />
        </clipPath>
      </defs>

      <line x1="100" y1="0" x2="100" y2="36" stroke={INK} strokeWidth="2.4" />
      <circle cx="100" cy="8" r="4" fill="none" stroke={INK} strokeWidth="2.4" />

      <path d="M76 34 H124 L132 52 H68 Z" fill="#1e3553" stroke={INK} strokeWidth="2" strokeLinejoin="round" />

      <path d={body} fill={`url(#${bodyId})`} />

      <g clipPath={`url(#${clipId})`}>
        <ellipse
          className={flicker ? 'lantern-flame' : undefined}
          cx="100"
          cy="138"
          rx="46"
          ry="62"
          fill={`url(#${flameId})`}
        />
        {/* Dải răng cưa trên & dưới — như mép cờ đuôi nheo ngày hội */}
        <rect x="40" y="62" width="120" height="12" fill={band} />
        <path
          d="M40 74 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9"
          fill={band}
        />
        <rect x="40" y="196" width="120" height="12" fill={band} />
        <path
          d="M40 196 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9"
          fill={band}
        />
        {[62, 100, 138].map((x) => (
          <path
            key={x}
            d={`M${x} 52 C${x - (x - 100) * 0.9} 110 ${x - (x - 100) * 0.9} 160 ${x} 218`}
            fill="none"
            stroke={INK}
            strokeOpacity="0.28"
            strokeWidth="1.6"
          />
        ))}
      </g>

      {/* Hoa thị bốn cánh ở giữa thân đèn */}
      <g transform="translate(100 136)" fill={c3} fillOpacity="0.55">
        <ellipse rx="6" ry="15" />
        <ellipse rx="6" ry="15" transform="rotate(90)" />
        <circle r="4.5" fill={band} fillOpacity="1" />
      </g>

      <path d={body} fill="none" stroke={INK} strokeWidth="2.2" />

      <path d="M70 218 H130 L123 234 H77 Z" fill="#1e3553" stroke={INK} strokeWidth="2" strokeLinejoin="round" />

      <g className="lantern-tassel">
        <line x1="100" y1="234" x2="100" y2="248" stroke={INK} strokeWidth="2.2" />
        <circle cx="100" cy="251" r="5" fill="#e6a623" stroke={INK} strokeWidth="2" />
        <path d="M94 256 L90 286 H110 L106 256 Z" fill="#b8322a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M97 260 V284 M100 260 V285 M103 260 V284" stroke={INK} strokeOpacity="0.35" strokeWidth="1" />
      </g>
    </svg>
  )
}
