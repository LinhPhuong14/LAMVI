import { useId } from 'react'

const TONES = {
  amber: ['#fff3d6', '#f0be6f', '#c47f3a'],
  dawn: ['#ffe9dd', '#f2a68f', '#c15a3a'],
  dusk: ['#ffe6b8', '#e8935a', '#8a3d2a'],
  moss: ['#f6f1d8', '#c9a75a', '#6b5a2a'],
}

export default function Lantern({ size = 220, lit = true, tone = 'amber', className = '' }) {
  const uid = useId()
  const glowId = `lanternGlow-${uid}`
  const capId = `capGrad-${uid}`
  const [c1, c2, c3] = TONES[tone] || TONES.amber

  return (
    <svg
      viewBox="0 0 200 260"
      width={size}
      height={(size * 260) / 200}
      className={`lantern-svg ${lit ? 'is-lit' : ''} ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="46%" r="60%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="55%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </radialGradient>
        <linearGradient id={capId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4226" />
          <stop offset="100%" stopColor="#4a2c18" />
        </linearGradient>
      </defs>

      <line x1="100" y1="6" x2="100" y2="34" stroke="#6b4226" strokeWidth="2" />

      <path d="M78 34 L122 34 L128 50 L72 50 Z" fill={`url(#${capId})`} />

      <path
        d="M72 50 C48 90 48 170 72 210 C84 232 116 232 128 210 C152 170 152 90 128 50 Z"
        fill={`url(#${glowId})`}
        stroke="#8a5a34"
        strokeWidth="1.5"
      />

      {[70, 90, 110, 130, 150, 170, 190].map((y) => (
        <path
          key={y}
          d={`M${52 + Math.sin((y / 260) * Math.PI) * -2} ${y} Q100 ${y + 4} ${148 - Math.sin((y / 260) * Math.PI) * -2} ${y}`}
          fill="none"
          stroke="rgba(107,66,38,0.28)"
          strokeWidth="1"
        />
      ))}
      {[62, 100, 138].map((x) => (
        <path
          key={x}
          d={`M${x} 50 C${x - 20} 100 ${x - 20} 160 ${x} 210`}
          fill="none"
          stroke="rgba(107,66,38,0.35)"
          strokeWidth="1.4"
        />
      ))}

      <path d="M72 210 L128 210 L122 226 L78 226 Z" fill={`url(#${capId})`} />
      <ellipse cx="100" cy="230" rx="14" ry="5" fill="#4a2c18" />
    </svg>
  )
}
