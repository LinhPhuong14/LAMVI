// Cảnh nền bằng ảnh thật CC0 (public/images/scene/CREDITS.md) cho trang chủ và các trang công khai (D-66).
// Thay các hoạ tiết SVG tự vẽ (FloatingMotifs) — người dùng muốn nền là ảnh thật.
// Chỉ trang trí → aria-hidden, alt rỗng; ảnh tải chậm; chuyển động bằng CSS, tắt khi giảm chuyển động.
const DIR = '/images/scene/'

// eager: ảnh ở đầu trang = ứng viên LCP → tải sớm, ưu tiên cao (feedback 08/10, mục 21)
// photo: ảnh nền (có bản 640 và 1280) · smoke: lớp khói tách nền · rise: số đèn trời bay lên một lượt khi vào
const SCENES = {
  hero: { photo: 'mist-terraces', eager: true, smoke: [{ src: 'smoke-ink', x: '58%', y: '-10%', w: '46%' }], rise: 7 },
  story: { photo: 'bay-green', dark: true, smoke: [{ src: 'incense-smoke', x: '84%', y: '4%', w: '14%' }] },
  artisan: { smoke: [{ src: 'smoke-ink', x: '-6%', y: '-6%', w: '42%' }] },
  products: { photo: 'golden-sky' },
  lookbook: { photo: 'hills-gold', dark: true, smoke: [{ src: 'smoke-ember', x: '-8%', y: '52%', w: '50%' }] },
  process: { photo: 'valley-light' },
  qr: { photo: 'golden-clouds' },
  testimonials: { photo: 'dawn-lake' },
  faq: { photo: 'cloud-sea' },
  // Trang khác (PageScene)
  auth: {}, // nền trơn có quầng màu (CSS), không dùng ảnh — để thẻ kính có thứ để làm mờ
  product: { photo: 'golden-sky', eager: true },
  shop: { photo: 'golden-sky', eager: true },
  cart: { photo: 'lake-village', eager: true },
  checkout: { photo: 'mist-terraces', eager: true },
  order: { photo: 'golden-clouds', eager: true, rise: 3 },
  batch: { photo: 'valley-light', eager: true },
  notFound: { photo: 'starry', dark: true, rise: 5 },
}

// Đèn trời bay lên: vị trí ngang, bề rộng, trễ, thời gian (lấy lần lượt theo số `rise`)
const RISE = [
  { left: '62%', size: 34, delay: 0.2, dur: 7.5 },
  { left: '78%', size: 22, delay: 0.9, dur: 8.5 },
  { left: '48%', size: 26, delay: 1.5, dur: 8 },
  { left: '88%', size: 30, delay: 0.5, dur: 7.2 },
  { left: '70%', size: 18, delay: 1.9, dur: 9.2 },
  { left: '35%', size: 20, delay: 1.1, dur: 8.8 },
  { left: '94%', size: 16, delay: 2.4, dur: 9.6 },
]

export default function Scene({ name, className = '' }) {
  const s = SCENES[name]
  if (!s) return null
  return (
    <div className={`scene scene-${name}${s.dark ? ' scene-dark' : ''} ${className}`} aria-hidden="true">
      {s.photo && (
        <img
          className="scene-photo"
          src={`${DIR}${s.photo}-1280.webp`}
          srcSet={`${DIR}${s.photo}-640.webp 640w, ${DIR}${s.photo}-1280.webp 1280w`}
          sizes="100vw"
          alt=""
          decoding="async"
          loading={s.eager ? 'eager' : 'lazy'}
          fetchPriority={s.eager ? 'high' : undefined}
        />
      )}
      {s.smoke?.map((m, i) => (
        <img
          key={i}
          className={`scene-smoke scene-smoke-${m.src}`}
          src={`${DIR}${m.src}.webp`}
          alt=""
          decoding="async"
          loading="lazy"
          style={{ left: m.x, top: m.y, width: m.w, animationDelay: `${-i * 9}s` }}
        />
      ))}
      {s.rise > 0 && (
        <div className="scene-rise">
          {RISE.slice(0, s.rise).map((l, i) => (
            <span
              key={i}
              className="scene-rise-lantern"
              style={{ left: l.left, width: l.size, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}
            >
              <img src={`${DIR}sky-lantern-glow.webp`} alt="" decoding="async" width="176" height="180" />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
