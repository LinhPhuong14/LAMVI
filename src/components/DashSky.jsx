// Nền dashboard tài khoản bằng ảnh thật CC0 (public/images/dash/CREDITS.md): trời sương (sáng) hoặc trời đêm
// đầy đèn trời (tối), vài lớp khói trôi lơ lửng, và đèn trời bay lên một lượt mỗi khi vào trang.
// Chỉ trang trí → aria-hidden, alt rỗng; chuyển động bằng CSS (transform/opacity), tắt khi giảm chuyển động.
const IMG = '/images/dash/'

// Lớp khói: ảnh, vị trí, cỡ, thời gian trôi
const SMOKE = [
  { src: 'smoke-gold.webp', top: '-4%', left: '-8%', w: '62%', dur: 48, delay: -6 },
  { src: 'smoke-thin.webp', top: '30%', left: '58%', w: '46%', dur: 56, delay: -18 },
  { src: 'smoke-gold.webp', top: '62%', left: '30%', w: '54%', dur: 60, delay: -30, flip: true },
]

// Đèn trời bay lên khi vào trang: vị trí ngang, bề rộng, trễ, thời gian
const RISE = [
  { left: '14%', size: 30, delay: 0.1, dur: 7.5 },
  { left: '26%', size: 20, delay: 0.9, dur: 8.5 },
  { left: '38%', size: 38, delay: 0.4, dur: 7 },
  { left: '51%', size: 24, delay: 1.6, dur: 9 },
  { left: '62%', size: 34, delay: 0.2, dur: 7.8 },
  { left: '71%', size: 18, delay: 1.2, dur: 9.5 },
  { left: '80%', size: 28, delay: 0.7, dur: 8.2 },
  { left: '90%', size: 22, delay: 2, dur: 8.8 },
]

export default function DashSky() {
  return (
    <div className="dash-sky" aria-hidden="true">
      <div className="dash-photo" />
      {SMOKE.map((s, i) => (
        <img
          key={i}
          src={IMG + s.src}
          alt=""
          decoding="async"
          loading="lazy"
          className={`dash-smoke${s.flip ? ' is-flip' : ''}${s.src.includes('thin') ? ' is-thin' : ''}`}
          style={{ top: s.top, left: s.left, width: s.w, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
        />
      ))}
      <div className="dash-rise">
        {RISE.map((l, i) => (
          <span
            key={i}
            className="dash-rise-lantern"
            style={{ left: l.left, width: l.size, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}
          >
            <img src={IMG + 'sky-lantern.webp'} alt="" decoding="async" width="132" height="157" />
          </span>
        ))}
      </div>
    </div>
  )
}
