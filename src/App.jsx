import { useState } from 'react'
import {
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  useScroll,
  useTransform,
} from 'framer-motion'
import Lantern from './components/Lantern'
import ScrollProgress from './components/ScrollProgress'
import Marquee from './components/Marquee'
import Particles from './components/Particles'
import Faq from './components/Faq'
import { Cloud, DrumSun, Lotus, Seal } from './components/Motifs'
import './App.css'

const EASE = [0.22, 1, 0.36, 1]

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

// Thẻ "đóng dấu": rơi nhẹ xuống và xoay về đúng khuôn như con dấu ấn lên giấy
const stamp = {
  hidden: { opacity: 0, y: 36, rotate: -2.5 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    rotate: i % 2 === 0 ? -0.6 : 0.6,
    transition: { type: 'spring', stiffness: 170, damping: 18, mass: 0.8 },
  }),
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

const products = [
  {
    name: 'Đèn Nguyệt',
    desc: 'Dáng tròn đầy, ánh sáng dịu như trăng rằm',
    price: '890.000₫',
    tone: 'amber',
    badge: null,
  },
  {
    name: 'Đèn Vọng',
    desc: 'Thân thon cao, gợi nhớ mái đình làng cổ',
    price: '1.050.000₫',
    tone: 'dusk',
    badge: 'Bán chạy',
  },
  {
    name: 'Đèn Sum Vầy',
    desc: 'Bộ ba kích cỡ, dành tặng cả gia đình',
    price: '1.680.000₫',
    tone: 'dawn',
    badge: null,
  },
]

const steps = [
  { label: 'Chọn giấy dó', note: 'Lọc từng tấm giấy dệt tay không tì vết' },
  { label: 'Lên khung tre', note: 'Vót nan, uốn khung theo dáng cổ truyền' },
  { label: 'Phơi nắng', note: 'Đợi nắng tự nhiên làm săn từng lớp giấy' },
  { label: 'Đóng gói & khắc QR', note: 'Khắc mã mở video hành trình của mẻ đèn' },
]

const lookbook = [
  { tone: 'amber', label: 'Hổ phách', size: 'tall' },
  { tone: 'dusk', label: 'Hoàng hôn', size: 'short' },
  { tone: 'dawn', label: 'Bình minh', size: 'short' },
  { tone: 'moss', label: 'Trầm mộc', size: 'tall' },
  { tone: 'dusk', label: 'Lửa ấm', size: 'short' },
]

const testimonials = [
  {
    name: 'Thu Hà',
    context: 'Tặng mẹ nhân ngày 20/10',
    quote:
      '“Mẹ mình xem video làm đèn xong thì khóc luôn. Chưa món quà nào làm mẹ xúc động đến vậy.”',
  },
  {
    name: 'Minh Quân',
    context: 'Mua cho phòng khách nhà mình',
    quote:
      '“Ánh sáng ấm mà không chói, để bàn trà nhìn sang trọng hẳn. Video quy trình làm cũng rất chill để xem.”',
  },
  {
    name: 'Bảo Trân',
    context: 'Tặng bạn thân dịp tân gia',
    quote:
      '“Bạn mình quét mã xong nhắn lại ngay, bảo cảm động vì thấy cả quá trình đèn được làm cho riêng mình.”',
  },
]

function Initials({ name }) {
  const letters = name
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
  return <span className="avatar-initials">{letters}</span>
}

function Eyebrow({ children, variants }) {
  return (
    <m.span className="eyebrow" variants={variants}>
      <Lotus />
      {children}
      <Lotus />
    </m.span>
  )
}

function Hero() {
  const { scrollY } = useScroll()
  // Parallax nhẹ: đèn trôi chậm hơn nội dung, trống đồng trôi chậm hơn nữa
  const lanternY = useTransform(scrollY, [0, 700], [0, 90])
  const drumY = useTransform(scrollY, [0, 700], [0, 160])

  return (
    <section className="hero">
      <Particles />
      <Cloud className="hero-cloud cloud-a" />
      <Cloud className="hero-cloud cloud-b" />

      <m.div className="hero-copy" initial="hidden" animate="show" variants={stagger}>
        <Eyebrow variants={fadeUp}>Giấy dó thủ công · Làng nghề trăm năm</Eyebrow>
        <m.h1 variants={fadeUp}>
          Mỗi chiếc đèn,
          <br />
          một câu chuyện <em className="h1-accent">được thắp lên</em>
        </m.h1>
        <m.p className="hero-sub" variants={fadeUp}>
          Đèn giấy dó thủ công dành tặng người thân — kèm theo hành trình
          đèn được làm ra và lời chúc của riêng bạn, mở ra chỉ bằng một lần
          quét mã.
        </m.p>
        <m.div className="hero-actions" variants={fadeUp}>
          <a href="#products" className="btn btn-primary">
            Khám phá bộ sưu tập
          </a>
          <a href="#story" className="btn btn-ghost">
            Nghe câu chuyện làng nghề
          </a>
        </m.div>
      </m.div>

      <div className="hero-art">
        <m.div
          className="hero-drum"
          style={{ y: drumY }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
        >
          <DrumSun />
        </m.div>
        <div className="hero-glow" />
        <m.div
          className="hero-lantern"
          style={{ y: lanternY }}
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.25 }}
        >
          <Lantern size={250} tone="dusk" swing flicker />
        </m.div>
        <div className="hero-art-satellite satellite-a">
          <Lantern size={78} tone="amber" swing />
        </div>
        <div className="hero-art-satellite satellite-b">
          <Lantern size={58} tone="moss" swing />
        </div>
      </div>

      <a href="#story" className="scroll-cue">
        <span>Cuộn xuống</span>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" aria-hidden="true">
          <path d="M1 1L7 19L13 1" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </a>
    </section>
  )
}

function App() {
  const [intent, setIntent] = useState('gift')

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="page">
          <ScrollProgress />

          <header className="nav">
            <a href="#" className="nav-brand" aria-label="MỘC">
              <Seal>MỘC</Seal>
            </a>
            <nav className="nav-links">
              <a href="#story">Câu chuyện</a>
              <a href="#artisan">Nghệ nhân</a>
              <a href="#products">Sản phẩm</a>
              <a href="#lookbook">Lookbook</a>
              <a href="#qr">Trải nghiệm QR</a>
              <a href="#faq">Hỏi đáp</a>
            </nav>
            <a href="#products" className="nav-cta">
              Đặt đèn
            </a>
          </header>

          <Hero />

          <Marquee />

          <m.section
            id="story"
            className="story"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            variants={stagger}
          >
            <Cloud className="story-cloud cloud-l" />
            <Cloud className="story-cloud cloud-r" />
            <Eyebrow variants={fadeUp}>Di sản</Eyebrow>
            <m.h2 variants={fadeUp}>Từ làng nghề giấy dó trăm năm</m.h2>
            <m.p className="story-text drop-cap" variants={fadeUp}>
              Giấy dó từng dùng để chép sử, vẽ tranh Đông Hồ, lưu giữ ký ức của
              bao thế hệ. Chúng tôi mang chất liệu ấy trở lại trong hình hài một
              chiếc đèn — để câu chuyện của gia đình bạn cũng được lưu giữ theo
              cách bền bỉ như vậy.
            </m.p>
            <m.div className="story-stats" variants={stagger}>
              <m.div variants={stamp} custom={0}>
                <strong>100+</strong>
                <span>năm nghề giấy dó</span>
              </m.div>
              <m.div variants={stamp} custom={1}>
                <strong>12</strong>
                <span>nghệ nhân đồng hành</span>
              </m.div>
              <m.div variants={stamp} custom={2}>
                <strong>1</strong>
                <span>câu chuyện riêng mỗi đèn</span>
              </m.div>
            </m.div>
          </m.section>

          <m.section
            id="artisan"
            className="artisan"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            variants={stagger}
          >
            <m.div className="artisan-portrait" variants={stamp}>
              <div className="portrait-frame">
                <svg viewBox="0 0 200 220" className="portrait-figure" aria-hidden="true">
                  <circle cx="100" cy="100" r="78" fill="#e6a623" />
                  <path
                    d="M40 220 C40 150 70 128 100 128 C130 128 160 150 160 220 Z"
                    fill="#1e3553"
                    stroke="#1d1712"
                    strokeWidth="3"
                  />
                  <path d="M84 128 L100 160 L116 128" fill="none" stroke="#1d1712" strokeWidth="3" />
                  <circle cx="100" cy="90" r="32" fill="#c98d5c" stroke="#1d1712" strokeWidth="3" />
                  <path
                    d="M60 70 C62 46 138 46 140 70 C120 64 80 64 60 70 Z"
                    fill="#1d1712"
                  />
                  <path d="M88 96 q4 3 8 0 M104 96 q4 3 8 0" stroke="#1d1712" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                  <path d="M92 108 q8 6 16 0" stroke="#1d1712" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                </svg>
                <span className="portrait-quote-mark">”</span>
              </div>
            </m.div>
            <m.div className="artisan-copy" variants={fadeUp}>
              <span className="eyebrow">
                <Lotus />
                Người giữ lửa nghề
              </span>
              <h2>Bàn tay tạo nên ánh sáng</h2>
              <p className="artisan-quote">
                “Mỗi tờ giấy dó đều có tính khí riêng — ẩm quá thì rách, khô quá
                thì giòn. Phải quen tay hàng chục năm mới lên khung được một
                chiếc đèn tròn đều.”
              </p>
              <div className="artisan-meta">
                <div>
                  <strong>Nghệ nhân Nguyễn Văn Tài</strong>
                  <span>Làng Yên Thái, Hà Nội</span>
                </div>
                <div className="artisan-stats">
                  <div>
                    <strong>32</strong>
                    <span>năm trong nghề</span>
                  </div>
                  <div>
                    <strong>4.000+</strong>
                    <span>chiếc đèn đã ra lò</span>
                  </div>
                </div>
              </div>
            </m.div>
          </m.section>

          <section id="products" className="products">
            <div className="section-head">
              <span className="eyebrow">
                <Lotus />
                Bộ sưu tập
                <Lotus />
              </span>
              <h2>Chọn lý do bạn thắp lên chiếc đèn này</h2>
              <div className={`intent-toggle is-${intent}`} role="group">
                <span className="intent-pill" aria-hidden="true" />
                {[
                  ['gift', 'Mua tặng'],
                  ['self', 'Mua cho mình'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={intent === key ? 'active' : ''}
                    aria-pressed={intent === key}
                    onClick={() => setIntent(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <m.p
                key={intent}
                className="intent-copy"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {intent === 'gift'
                  ? 'Kèm thiệp viết tay, hộp quà vải bố và thiệp cảm ơn có mã QR để người nhận xem lời chúc riêng của bạn.'
                  : 'Một góc ánh sáng ấm cho không gian sống — quét mã trên đèn để xem mẻ đèn được làm ra. Muốn gửi lời nhắn cho chính mình? Chỉ cần tích “Thêm lời chúc”.'}
              </m.p>
            </div>

            <m.div
              className="product-grid"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
            >
              {products.map((p, i) => (
                <m.article
                  className={`product-card tone-${p.tone}`}
                  key={p.name}
                  variants={stamp}
                  custom={i}
                >
                  {p.badge && <Seal className="product-badge">{p.badge}</Seal>}
                  <div className="product-art">
                    <Lantern size={112} tone={p.tone} swing />
                  </div>
                  <div className="product-body">
                    <h3>{p.name}</h3>
                    <p className="product-desc">{p.desc}</p>
                    <div className="product-foot">
                      <span className="product-price">
                        {p.price}
                        <small className="price-note">Chưa gồm VAT</small>
                      </span>
                      <button className="btn btn-small">
                        {intent === 'gift' ? 'Tặng ngay' : 'Thêm vào giỏ'}
                      </button>
                    </div>
                  </div>
                </m.article>
              ))}
            </m.div>
          </section>

          <section id="lookbook" className="lookbook">
            <div className="lookbook-inner">
              <div className="section-head">
                <span className="eyebrow">
                  <Lotus />
                  Lookbook
                  <Lotus />
                </span>
                <h2>Sắc màu của ánh sáng thủ công</h2>
              </div>
              <m.div
                className="lookbook-grid"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.15 }}
                variants={stagger}
              >
                {lookbook.map((item, i) => (
                  <m.div
                    className={`lookbook-card size-${item.size} tone-${item.tone}`}
                    key={`${item.tone}-${i}`}
                    variants={fadeUp}
                  >
                    <span className="lookbook-halo" aria-hidden="true" />
                    <Lantern size={item.size === 'tall' ? 140 : 104} tone={item.tone} swing />
                    <span className="lookbook-caption">{item.label}</span>
                  </m.div>
                ))}
              </m.div>
            </div>
          </section>

          <section id="process" className="process">
            <div className="section-head">
              <span className="eyebrow">
                <Lotus />
                Hành trình thủ công
                <Lotus />
              </span>
              <h2>Theo dõi đơn của bạn qua từng công đoạn</h2>
            </div>
            <m.ol
              className="timeline"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={stagger}
            >
              {steps.map((s, i) => (
                <m.li key={s.label} variants={stamp} custom={i}>
                  <span className="timeline-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="timeline-label">{s.label}</span>
                  <span className="timeline-note">{s.note}</span>
                </m.li>
              ))}
            </m.ol>
          </section>

          <section id="qr" className="qr-experience">
            <m.div
              className="qr-copy"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              variants={stagger}
            >
              <Eyebrow variants={fadeUp}>Khoảnh khắc mở quà</Eyebrow>
              <m.h2 variants={fadeUp}>Quét mã, thấy cả một câu chuyện</m.h2>
              <m.p className="story-text" variants={fadeUp}>
                Mã QR trên thiệp cảm ơn mở ra lời chúc của bạn, còn mã khắc trên
                đèn mở ra video hành trình mẻ đèn được làm ra. Người nhận chỉ cần
                đưa điện thoại lên, không cần cài ứng dụng.
              </m.p>
              <m.ul className="qr-points" variants={fadeUp}>
                <li>Video quá trình làm ra mẻ đèn, xem lại bất cứ lúc nào</li>
                <li>Lời chúc bằng giọng nói hoặc video của người tặng</li>
                <li>Lời chúc chữ được lưu mãi; giọng nói và video lưu 30 ngày kể từ khi người nhận xác nhận đã nhận quà, có thể tải về để giữ lâu dài</li>
              </m.ul>
            </m.div>

            <m.div
              className="phone-mock"
              initial={{ opacity: 0, y: 40, rotate: -4 }}
              whileInView={{ opacity: 1, y: 0, rotate: -2 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <div className="phone-frame">
                <div className="phone-notch" />
                <div className="phone-screen">
                  <div className="phone-video">
                    <span className="play-glow" />
                    <span className="play-icon">▶</span>
                  </div>
                  <p className="phone-caption">Hành trình chiếc đèn của bạn</p>
                  <div className="phone-message">
                    <span className="phone-message-label">Lời chúc từ Minh Anh</span>
                    <p>
                      “Chúc chị luôn ấm áp như ánh đèn này. Em thương chị rất
                      nhiều.”
                    </p>
                  </div>
                </div>
              </div>
            </m.div>
          </section>

          <m.section
            className="testimonials"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <div className="section-head">
              <span className="eyebrow">
                <Lotus />
                Người đã thắp đèn
                <Lotus />
              </span>
              <h2>Những câu chuyện được kể lại</h2>
            </div>
            <div className="testimonial-grid">
              {testimonials.map((t, i) => (
                <m.figure className="testimonial-card" key={t.name} variants={stamp} custom={i}>
                  <div className="stars">★★★★★</div>
                  <blockquote>{t.quote}</blockquote>
                  <figcaption>
                    <span className="avatar">
                      <Initials name={t.name} />
                    </span>
                    <span>
                      <strong>{t.name}</strong>
                      <span className="testimonial-context">{t.context}</span>
                    </span>
                  </figcaption>
                </m.figure>
              ))}
            </div>
          </m.section>

          <m.section
            id="faq"
            className="faq"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <m.div className="section-head" variants={fadeUp}>
              <span className="eyebrow">
                <Lotus />
                Giải đáp
                <Lotus />
              </span>
              <h2>Những điều bạn có thể thắc mắc</h2>
            </m.div>
            <m.div variants={fadeUp}>
              <Faq />
            </m.div>
          </m.section>

          <footer className="footer">
            <div className="footer-grid">
              <div className="footer-brand">
                <Seal className="seal-lg">MỘC</Seal>
                <p>Đèn giấy dó thủ công — giữ lửa ký ức, thắp sáng yêu thương.</p>
                <div className="social-links">
                  <a href="#" aria-label="Facebook">
                    Facebook
                  </a>
                  <a href="#" aria-label="Instagram">
                    Instagram
                  </a>
                  <a href="#" aria-label="TikTok">
                    TikTok
                  </a>
                </div>
              </div>
              <div className="footer-col">
                <h3>Sản phẩm</h3>
                <a href="#products">Đèn Nguyệt</a>
                <a href="#products">Đèn Vọng</a>
                <a href="#products">Đèn Sum Vầy</a>
              </div>
              <div className="footer-col">
                <h3>Hỗ trợ</h3>
                <a href="#faq">Câu hỏi thường gặp</a>
                <a href="#">Chính sách đổi trả</a>
                <a href="#">Theo dõi đơn hàng</a>
              </div>
              <div className="footer-col footer-news">
                <h3>Nhận tin tức</h3>
                <p>Câu chuyện làng nghề và ưu đãi mới, gửi mỗi tháng một lần.</p>
                <form className="news-form" onSubmit={(e) => e.preventDefault()}>
                  <input type="email" placeholder="Email của bạn" required aria-label="Email của bạn" />
                  <button type="submit" className="btn btn-small">
                    Đăng ký
                  </button>
                </form>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© 2026 Mộc — Đèn giấy dó thủ công.</span>
            </div>
          </footer>
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}

export default App
