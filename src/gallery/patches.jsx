// Mảnh ghép của chăn Đông Hồ (D-97). Hoạ tiết tự vẽ theo phong cách tranh dân gian — không phải
// ảnh tư liệu (G-33). Mỗi mảnh 100×100, màu theo tông của bộ sưu tập.

const TONES = {
  amber: { bg: '#f2c46b', fg: '#8a3b12', soft: '#fbe3ab' },
  dusk: { bg: '#b9a6dd', fg: '#3d2a6b', soft: '#e1d6f3' },
  dawn: { bg: '#f1a898', fg: '#8c2f26', soft: '#fad3c9' },
  moss: { bg: '#a8cf98', fg: '#2f5a2a', soft: '#d6ebcb' },
}
// oxlint-disable-next-line react/only-export-components
export const toneOf = (tone) => TONES[tone] ?? TONES.amber

// Sáu hoạ tiết xoay vòng theo thứ tự mảnh
const MOTIFS = [
  // đèn lồng
  (c) => (
    <g>
      <path d="M50 18v8" stroke={c.fg} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="52" rx="22" ry="26" fill={c.soft} stroke={c.fg} strokeWidth="3" />
      <path d="M50 26v52M36 30c-6 14-6 30 0 44M64 30c6 14 6 30 0 44" stroke={c.fg} strokeWidth="2" fill="none" />
      <path d="M44 82l-3 8M50 82v10M56 82l3 8" stroke={c.fg} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  // sen
  (c) => (
    <g stroke={c.fg} strokeWidth="2.5" fill={c.soft} strokeLinejoin="round">
      <path d="M50 24c-9 10-9 26 0 38 9-12 9-28 0-38z" />
      <path d="M50 62C36 60 26 50 24 36c14 0 24 10 26 26z" />
      <path d="M50 62c14-2 24-12 26-26-14 0-24 10-26 26z" />
      <path d="M30 70c14 8 26 8 40 0" fill="none" />
      <path d="M50 62v26" fill="none" />
    </g>
  ),
  // cá chép
  (c) => (
    <g stroke={c.fg} strokeWidth="2.5" strokeLinejoin="round">
      <path d="M22 50c14-18 40-18 52 0-12 18-38 18-52 0z" fill={c.soft} />
      <path d="M74 50l16-14v28z" fill={c.soft} />
      <circle cx="36" cy="46" r="3" fill={c.fg} />
      <path d="M46 40c4 6 4 14 0 20M56 40c4 6 4 14 0 20" fill="none" />
      <path d="M40 30c6-8 14-8 20-2" fill="none" />
    </g>
  ),
  // trăng
  (c) => (
    <g>
      <circle cx="50" cy="50" r="26" fill={c.soft} stroke={c.fg} strokeWidth="3" />
      <path d="M58 30a22 22 0 1 0 0 40 18 18 0 0 1 0-40z" fill={c.fg} opacity="0.25" />
      <path d="M26 78c8-4 14-4 24 0s16 4 24 0" stroke={c.fg} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  // mặt trời
  (c) => (
    <g stroke={c.fg} strokeWidth="2.5" strokeLinecap="round">
      <circle cx="50" cy="50" r="15" fill={c.soft} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6
        return <path key={i} d={`M${50 + Math.cos(a) * 22} ${50 + Math.sin(a) * 22}L${50 + Math.cos(a) * 34} ${50 + Math.sin(a) * 34}`} />
      })}
    </g>
  ),
  // tre
  (c) => (
    <g stroke={c.fg} strokeWidth="3" strokeLinecap="round" fill={c.soft}>
      <path d="M40 16v70M60 22v64" fill="none" />
      <path d="M36 40h8M36 62h8M56 44h8M56 66h8" fill="none" />
      <path d="M44 34c12-4 22 0 30 10-12 4-22 2-30-10zM60 54c-12-4-22 0-30 10 12 4 22 2 30-10z" />
    </g>
  ),
]

/** Một mảnh nhỏ: mở khoá = hoạ tiết màu; khoá = khung đứt nét + ổ khoá. */
export function Patch({ index, tone, unlocked, label }) {
  const c = toneOf(tone)
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className={`quilt-patch-art${unlocked ? ' is-on' : ' is-off'}`}>
      <rect x="2" y="2" width="96" height="96" rx="8" fill={unlocked ? c.bg : 'transparent'} />
      {unlocked ? (
        MOTIFS[index % MOTIFS.length](c)
      ) : (
        <g stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinecap="round" opacity="0.55">
          <rect x="4" y="4" width="92" height="92" rx="8" strokeDasharray="6 6" />
          <rect x="36" y="46" width="28" height="22" rx="4" />
          <path d="M42 46v-6a8 8 0 0 1 16 0v6" />
        </g>
      )}
      {/* đường khâu */}
      <rect className="quilt-stitch" x="6" y="6" width="88" height="88" rx="6" fill="none" stroke={unlocked ? c.fg : 'currentColor'} strokeWidth="1.4" strokeDasharray="4 4" opacity={unlocked ? 0.55 : 0.25} pathLength="1" />
    </svg>
  )
}

/** Mảnh lớn của cả bộ: băng hoạ tiết trải rộng, chỉ rõ khi hoàn thành bộ. */
export function Emblem({ tone, unlocked, label }) {
  const c = toneOf(tone)
  return (
    <svg viewBox="0 0 300 70" role="img" aria-label={label} className={`quilt-emblem-art${unlocked ? ' is-on' : ' is-off'}`}>
      <rect x="2" y="2" width="296" height="66" rx="10" fill={unlocked ? c.bg : 'transparent'} />
      {unlocked ? (
        <g stroke={c.fg} strokeWidth="2.5" fill={c.soft} strokeLinejoin="round">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${28 + i * 61} 35)`}>
              <path d="M0-20c-8 8-8 22 0 32 8-10 8-24 0-32z" />
              <path d="M0 12c-12-1-20-9-22-20 12 0 20 8 22 20z" />
              <path d="M0 12c12-1 20-9 22-20-12 0-20 8-22 20z" />
            </g>
          ))}
        </g>
      ) : (
        <g stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
          <rect x="4" y="4" width="292" height="62" rx="10" strokeDasharray="8 8" />
          <rect x="136" y="30" width="28" height="22" rx="4" />
          <path d="M142 30v-5a8 8 0 0 1 16 0v5" />
        </g>
      )}
    </svg>
  )
}
