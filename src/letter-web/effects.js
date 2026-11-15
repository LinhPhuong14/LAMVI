// D-140: hiệu ứng theo dịp cho bản web 2D — dùng canvas-confetti (ISC, ~10 KB, tải động khi cần).
// Mỗi hàm trả về `stop()` để huỷ vòng lặp khi người nhận đóng/rời trang. Giảm chuyển động → không chạy.

let loader = null
const load = () => (loader ||= import('canvas-confetti').then((m) => m.default ?? m))

export const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// Bảng màu vintage của từng dịp (khớp OCCASION_THEMES trong themes.js)
const GOLD = ['#d8b26a', '#c48a3a', '#f3e3c3', '#8a5a3b']

/** Lặp `tick` mỗi khung hình tới khi hết `ms`. */
function loop(ms, tick) {
  const end = Date.now() + ms
  let id = 0
  let stopped = false
  const frame = () => {
    if (stopped) return
    tick()
    if (Date.now() < end) id = requestAnimationFrame(frame)
  }
  frame()
  return () => {
    stopped = true
    cancelAnimationFrame(id)
  }
}

/** Lặp `tick` theo khoảng `every` ms tới khi hết `ms`. */
function every(ms, gap, tick) {
  tick()
  const id = setInterval(tick, gap)
  const t = setTimeout(() => clearInterval(id), ms)
  return () => {
    clearInterval(id)
    clearTimeout(t)
  }
}

const heartPath =
  'M167 72c19,-38 37,-56 75,-56 42,0 76,33 76,75 0,76 -76,151 -151,227 -76,-76 -151,-151 -151,-227 0,-42 33,-75 75,-75 38,0 57,18 76,56z'

function textShape(confetti, text, scalar = 2) {
  try {
    return confetti.shapeFromText({ text, scalar })
  } catch {
    return 'circle'
  }
}

export const EFFECTS = {
  // Sinh nhật: hai pháo giấy hai bên + sao vàng
  birthday(confetti) {
    const colors = ['#c48a3a', '#f3e3c3', '#9c4a2f', '#d8b26a', '#7b4a2a']
    return loop(1600, () => {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true })
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true })
    })
  },
  // Kỷ niệm: tim hồng đất trôi chậm
  anniversary(confetti) {
    let heart = 'circle'
    try {
      heart = confetti.shapeFromPath({ path: heartPath })
    } catch {
      /* trình duyệt cũ: dùng chấm tròn */
    }
    return every(2600, 260, () =>
      confetti({
        particleCount: 6,
        spread: 100,
        startVelocity: 18,
        gravity: 0.45,
        ticks: 260,
        scalar: 1.4,
        shapes: [heart],
        colors: ['#b5655a', '#d99a8b', '#8e3b3b', '#f0d9cf'],
        origin: { x: 0.2 + Math.random() * 0.6, y: 0.65 },
        disableForReducedMotion: true,
      }),
    )
  },
  // Cảm ơn: cánh hoa rơi
  thankYou(confetti) {
    const petal = textShape(confetti, '🌸')
    const leaf = textShape(confetti, '🍃')
    return every(3000, 200, () =>
      confetti({
        particleCount: 3,
        angle: 270,
        spread: 40,
        startVelocity: 4,
        gravity: 0.35,
        drift: Math.random() - 0.5,
        ticks: 420,
        scalar: 2,
        flat: true,
        shapes: [petal, leaf],
        origin: { x: Math.random(), y: -0.05 },
        disableForReducedMotion: true,
      }),
    )
  },
  // Cột mốc: pháo hoa vàng
  milestone(confetti) {
    return every(2400, 380, () =>
      confetti({
        particleCount: 46,
        spread: 360,
        startVelocity: 26,
        ticks: 90,
        gravity: 0.7,
        shapes: ['star', 'circle'],
        colors: GOLD,
        origin: { x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.3 },
        disableForReducedMotion: true,
      }),
    )
  },
  // Động viên: tia sáng bay lên như nắng sớm
  encouragement(confetti) {
    return every(2600, 220, () =>
      confetti({
        particleCount: 5,
        angle: 90,
        spread: 70,
        startVelocity: 22,
        gravity: -0.15,
        ticks: 220,
        scalar: 0.9,
        shapes: ['star'],
        colors: ['#f3d27a', '#c26f43', '#f6efe2'],
        origin: { x: 0.1 + Math.random() * 0.8, y: 1.05 },
        disableForReducedMotion: true,
      }),
    )
  },
  // Gửi từ xa: hai luồng giấy từ hai phía gặp nhau giữa màn hình
  longDistance(confetti) {
    const plane = textShape(confetti, '✈', 1.6)
    const colors = ['#5d7c7a', '#8a5a3b', '#e3e1d4', '#c48a3a']
    return every(1800, 300, () => {
      confetti({ particleCount: 10, angle: 30, spread: 25, startVelocity: 45, origin: { x: 0, y: 0.8 }, colors, disableForReducedMotion: true })
      confetti({ particleCount: 10, angle: 150, spread: 25, startVelocity: 45, origin: { x: 1, y: 0.8 }, colors, disableForReducedMotion: true })
      confetti({ particleCount: 1, angle: 20, spread: 5, startVelocity: 35, gravity: 0.2, ticks: 200, shapes: [plane], scalar: 1.6, flat: true, origin: { x: 0, y: 0.55 }, disableForReducedMotion: true })
    })
  },
  // Tặng bất chợt: biểu tượng của người gửi rơi nhẹ + đom đóm
  justBecause(confetti, { icon } = {}) {
    const shape = textShape(confetti, icon || '☾', 2.2)
    return every(2800, 240, () => {
      confetti({ particleCount: 2, angle: 270, spread: 30, startVelocity: 3, gravity: 0.3, ticks: 400, scalar: 2.2, flat: true, shapes: [shape], origin: { x: Math.random(), y: -0.05 }, disableForReducedMotion: true })
      confetti({ particleCount: 3, spread: 360, startVelocity: 4, gravity: 0, ticks: 300, scalar: 0.5, colors: ['#f3d27a', '#fff3c4'], origin: { x: Math.random(), y: 0.3 + Math.random() * 0.5 }, disableForReducedMotion: true })
    })
  },
}

/**
 * Chạy hiệu ứng của dịp. Trả về hàm dừng (luôn gọi được, kể cả khi thư viện chưa tải xong hoặc lỗi).
 * @param {string} occasion
 * @param {{ icon?: string }} [opts]
 */
export function playOccasion(occasion, opts = {}) {
  let stop = () => {}
  let cancelled = false
  if (reducedMotion() || !EFFECTS[occasion]) return () => {}
  load()
    .then((confetti) => {
      if (cancelled) return
      const s = EFFECTS[occasion](confetti, opts)
      stop = () => {
        s?.()
        confetti.reset?.()
      }
    })
    .catch(() => {
      /* không có canvas (trình duyệt cũ/test): bỏ qua hiệu ứng, nội dung vẫn hiện */
    })
  return () => {
    cancelled = true
    stop()
  }
}
