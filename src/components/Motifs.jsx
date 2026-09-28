// Hoạ tiết trang trí thuần SVG — không tải ảnh ngoài.

/** Mặt trống đồng: ngôi sao 14 cánh giữa các vành hoa văn. */
export function DrumSun({ className = '' }) {
  const rays = 14
  const star = Array.from({ length: rays * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 96 : 34
    const a = (Math.PI * i) / rays - Math.PI / 2
    return `${(200 + r * Math.cos(a)).toFixed(1)},${(200 + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  const dots = Array.from({ length: 36 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 36
    return [200 + 150 * Math.cos(a), 200 + 150 * Math.sin(a)]
  })
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 72
    const c = Math.cos(a)
    const s = Math.sin(a)
    return `M${200 + 176 * c} ${200 + 176 * s} L${200 + 188 * c} ${200 + 188 * s}`
  }).join(' ')

  return (
    <svg viewBox="0 0 400 400" className={`drum-sun ${className}`} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx="200" cy="200" r="196" strokeWidth="2" />
        <circle cx="200" cy="200" r="170" strokeWidth="1.5" />
        <path d={ticks} strokeWidth="2" />
        <circle cx="200" cy="200" r="162" strokeWidth="1" strokeDasharray="2 6" />
        {dots.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="6.5" strokeWidth="1.5" />
            <circle cx={x} cy={y} r="1.6" fill="currentColor" stroke="none" />
          </g>
        ))}
        <circle cx="200" cy="200" r="138" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="112" strokeWidth="1" strokeDasharray="10 5" />
      </g>
      <polygon points={star} fill="currentColor" />
    </svg>
  )
}

/** Mây cuộn dùng làm hoạ tiết góc. */
export function Cloud({ className = '' }) {
  return (
    <svg viewBox="0 0 160 70" className={`folk-cloud ${className}`} aria-hidden="true">
      <path
        d="M10 58 H150 C150 44 138 36 126 40 C124 22 104 14 92 26 C86 10 62 8 54 26 C44 18 28 24 30 38 C18 36 10 46 10 58 Z"
        fill="currentColor"
        stroke="#1d1712"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <g fill="none" stroke="#1d1712" strokeWidth="2" strokeLinecap="round">
        <path d="M62 44 C62 34 76 32 78 42 C79 48 70 49 70 44" />
        <path d="M100 46 C100 38 112 37 113 45" />
        <path d="M36 50 C36 44 45 43 46 49" />
      </g>
    </svg>
  )
}

/** Con dấu son — dùng cho logo và nhãn. */
export function Seal({ children, className = '' }) {
  return (
    <span className={`seal ${className}`}>
      <span className="seal-inner">{children}</span>
    </span>
  )
}

/** Bông sen nhỏ làm dấu ngăn cách. */
export function Lotus({ className = '' }) {
  return (
    <svg viewBox="0 0 28 18" className={`lotus ${className}`} aria-hidden="true">
      <path
        d="M14 2 C18 6 18 12 14 16 C10 12 10 6 14 2 Z M14 16 C9 16 4 13 2 8 C7 8 11 11 14 16 Z M14 16 C19 16 24 13 26 8 C21 8 17 11 14 16 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Dấu bưu điện cũ: vòng tròn đôi, chữ thương hiệu, vạch sóng huỷ tem. Chỉ trang trí. */
export function Postmark({ label, className = '' }) {
  const waves = [0, 1, 2, 3].map((i) => {
    const y = 58 + i * 12
    return `M112 ${y} q9 -6 18 0 t18 0 t18 0 t18 0 t18 0 t18 0`
  })
  return (
    <svg viewBox="0 0 230 140" className={`postmark ${className}`} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx="64" cy="70" r="56" strokeWidth="3" />
        <circle cx="64" cy="70" r="46" strokeWidth="1.5" strokeDasharray="3 4" />
        {waves.map((d) => (
          <path key={d} d={d} strokeWidth="3" strokeLinecap="round" />
        ))}
      </g>
      <g fill="currentColor">
        <circle cx="30" cy="70" r="3" />
        <circle cx="98" cy="70" r="3" />
        <text
          x="64"
          y="79"
          textAnchor="middle"
          fontFamily="Fraunces Variable, Georgia, serif"
          fontWeight="800"
          fontSize="26"
          letterSpacing="1"
        >
          {label}
        </text>
      </g>
    </svg>
  )
}

// Đường viền răng cưa như mép ảnh chụp ngày xưa
function zigzagRect(w, h, step = 8, depth = 4) {
  const pts = []
  for (let x = 0; x <= w; x += step) pts.push([x, (x / step) % 2 ? depth : 0])
  for (let y = step; y <= h; y += step) pts.push([w - ((y / step) % 2 ? depth : 0), y])
  for (let x = w - step; x >= 0; x -= step) pts.push([x, h - ((x / step) % 2 ? depth : 0)])
  for (let y = h - step; y > 0; y -= step) pts.push([(y / step) % 2 ? depth : 0, y])
  return pts.map(([x, y]) => `${x},${y}`).join(' ')
}

/** Ảnh cũ viền răng cưa, có bốn góc dán album; nội dung truyền qua children (toạ độ 0..200 × 0..240). */
export function OldPhoto({ children, className = '' }) {
  const edge = zigzagRect(232, 280)
  return (
    <svg viewBox="-8 -8 248 296" className={`old-photo ${className}`} aria-hidden="true">
      <polygon points={edge} fill="#f6ecd4" stroke="#2b2119" strokeOpacity="0.25" />
      <g transform="translate(16 16)">{children}</g>
      <g fill="#2b2119" opacity="0.82">
        <path d="M-8 -8 H34 L-8 34 Z" />
        <path d="M240 -8 H198 L240 34 Z" />
        <path d="M-8 288 H34 L-8 246 Z" />
        <path d="M240 288 H198 L240 246 Z" />
      </g>
    </svg>
  )
}
