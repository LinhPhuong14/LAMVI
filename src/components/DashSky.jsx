// Nền dashboard tài khoản: dải khói màu lơ lửng, hoạ tiết mây/khói nét mảnh, và đèn trời bay lên
// một lượt mỗi khi vào trang. Chỉ trang trí → aria-hidden; chuyển động bằng CSS (transform/opacity),
// tắt khi giảm chuyển động (design-rules §8).
import FloatingMotifs from './FloatingMotifs'

// Dải khói: vị trí, cỡ, màu (biến CSS), thời gian trôi
const SMOKE = [
  { top: '4%', left: '-10%', w: '70%', h: 180, tone: 'hoe', dur: 46, delay: -6 },
  { top: '28%', left: '40%', w: '75%', h: 150, tone: 'hong', dur: 58, delay: -20 },
  { top: '58%', left: '-6%', w: '64%', h: 170, tone: 'cham', dur: 52, delay: -12 },
  { top: '80%', left: '36%', w: '70%', h: 150, tone: 'la', dur: 62, delay: -30 },
]

// Đèn trời bay lên khi vào trang: vị trí ngang, cỡ, trễ, thời gian
const RISE = [
  { left: '14%', size: 16, delay: 0.1, dur: 7.5 },
  { left: '26%', size: 11, delay: 0.9, dur: 8.5 },
  { left: '38%', size: 20, delay: 0.4, dur: 7 },
  { left: '51%', size: 13, delay: 1.6, dur: 9 },
  { left: '62%', size: 18, delay: 0.2, dur: 7.8 },
  { left: '71%', size: 10, delay: 1.2, dur: 9.5 },
  { left: '80%', size: 15, delay: 0.7, dur: 8.2 },
  { left: '90%', size: 12, delay: 2, dur: 8.8 },
]

export default function DashSky() {
  return (
    <div className="dash-sky" aria-hidden="true">
      {SMOKE.map((b, i) => (
        <span
          key={i}
          className={`dash-smoke dash-smoke-${b.tone}`}
          style={{ top: b.top, left: b.left, width: b.w, height: b.h, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        />
      ))}
      <FloatingMotifs preset="dash" />
      <div className="dash-rise">
        {RISE.map((l, i) => (
          <span
            key={i}
            className="dash-rise-lantern"
            style={{ left: l.left, width: l.size, height: Math.round(l.size * 1.3), animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}
          />
        ))}
      </div>
    </div>
  )
}
