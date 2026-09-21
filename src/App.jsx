import { useState } from 'react'
import { motion } from 'framer-motion'
import Lantern from './components/Lantern'
import ScrollProgress from './components/ScrollProgress'
import Marquee from './components/Marquee'
import Particles from './components/Particles'
import Faq from './components/Faq'
import './App.css'

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
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
  { label: 'Đóng gói & khắc QR', note: 'Gắn mã riêng lưu câu chuyện của bạn' },
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

function App() {
  const [intent, setIntent] = useState('gift')

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />
      <ScrollProgress />

      <header className="nav">
        <span className="nav-mark">MỘC</span>
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

      <section className="hero">
        <Particles />
        <motion.div
          className="hero-copy"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.span className="eyebrow" variants={fadeUp}>
            Giấy dó thủ công · Làng nghề trăm năm
          </motion.span>
          <motion.h1 variants={fadeUp}>
            Mỗi chiếc đèn,
            <br />
            một câu chuyện được thắp lên
          </motion.h1>
          <motion.p className="hero-sub" variants={fadeUp}>
            Đèn giấy dó thủ công dành tặng người thân — kèm theo hành trình
            đèn được làm ra và lời chúc của riêng bạn, mở ra chỉ bằng một lần
            quét mã.
          </motion.p>
          <motion.div className="hero-actions" variants={fadeUp}>
            <motion.a
              href="#products"
              className="btn btn-primary"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Khám phá bộ sưu tập
            </motion.a>
            <motion.a
              href="#story"
              className="btn btn-ghost"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Nghe câu chuyện làng nghề
            </motion.a>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-art"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          <div className="hero-glow" />
          <motion.div
            className="hero-art-satellite satellite-a"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lantern size={70} tone="dusk" />
          </motion.div>
          <motion.div
            className="hero-art-satellite satellite-b"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            <Lantern size={54} tone="dawn" />
          </motion.div>
          <Lantern size={260} />
        </motion.div>

        <motion.div
          className="scroll-cue"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span>Cuộn xuống</span>
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
            <path d="M1 1L7 19L13 1" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </motion.div>
      </section>

      <Marquee />

      <motion.section
        id="story"
        className="story"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        variants={stagger}
      >
        <motion.span className="eyebrow" variants={fadeUp}>
          Di sản
        </motion.span>
        <motion.h2 variants={fadeUp}>Từ làng nghề giấy dó trăm năm</motion.h2>
        <motion.p className="story-text drop-cap" variants={fadeUp}>
          Giấy dó từng dùng để chép sử, vẽ tranh Đông Hồ, lưu giữ ký ức của
          bao thế hệ. Chúng tôi mang chất liệu ấy trở lại trong hình hài một
          chiếc đèn — để câu chuyện của gia đình bạn cũng được lưu giữ theo
          cách bền bỉ như vậy.
        </motion.p>
        <motion.div className="story-stats" variants={fadeUp}>
          <div>
            <strong>100+</strong>
            <span>năm nghề giấy dó</span>
          </div>
          <div>
            <strong>12</strong>
            <span>nghệ nhân đồng hành</span>
          </div>
          <div>
            <strong>1</strong>
            <span>câu chuyện riêng mỗi đèn</span>
          </div>
        </motion.div>
      </motion.section>

      <motion.section
        id="artisan"
        className="artisan"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        variants={stagger}
      >
        <motion.div className="artisan-portrait" variants={fadeUp}>
          <div className="portrait-frame">
            <div className="portrait-ring" />
            <svg viewBox="0 0 200 200" className="portrait-figure" aria-hidden="true">
              <circle cx="100" cy="76" r="38" fill="#8a5a34" opacity="0.9" />
              <path
                d="M40 190 C40 130 70 108 100 108 C130 108 160 130 160 190 Z"
                fill="#6b4226"
                opacity="0.9"
              />
            </svg>
            <span className="portrait-quote-mark">”</span>
          </div>
        </motion.div>
        <motion.div className="artisan-copy" variants={fadeUp}>
          <span className="eyebrow">Người giữ lửa nghề</span>
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
        </motion.div>
      </motion.section>

      <section id="products" className="products">
        <div className="section-head">
          <span className="eyebrow">Bộ sưu tập</span>
          <h2>Chọn lý do bạn thắp lên chiếc đèn này</h2>
          <div className="intent-toggle">
            <button
              className={intent === 'gift' ? 'active' : ''}
              onClick={() => setIntent('gift')}
            >
              Mua tặng
            </button>
            <button
              className={intent === 'self' ? 'active' : ''}
              onClick={() => setIntent('self')}
            >
              Mua cho mình
            </button>
          </div>
          <motion.p
            key={intent}
            className="intent-copy"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {intent === 'gift'
              ? 'Kèm thiệp viết tay, hộp quà vải bố và mã QR để người nhận xem lời chúc riêng của bạn.'
              : 'Một góc ánh sáng ấm cho không gian sống — vẫn lưu lại câu chuyện làm ra đèn cho riêng bạn.'}
          </motion.p>
        </div>

        <motion.div
          className="product-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          {products.map((p) => (
            <motion.article className="product-card" key={p.name} variants={fadeUp}>
              {p.badge && <span className="product-badge">{p.badge}</span>}
              <div className="product-art">
                <Lantern size={120} tone={p.tone} />
              </div>
              <h3>{p.name}</h3>
              <p className="product-desc">{p.desc}</p>
              <div className="product-foot">
                <span className="product-price">{p.price}</span>
                <button className="btn btn-small">
                  {intent === 'gift' ? 'Tặng ngay' : 'Thêm vào giỏ'}
                </button>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </section>

      <section id="lookbook" className="lookbook">
        <div className="section-head">
          <span className="eyebrow">Lookbook</span>
          <h2>Sắc màu của ánh sáng thủ công</h2>
        </div>
        <motion.div
          className="lookbook-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
        >
          {lookbook.map((item, i) => (
            <motion.div
              className={`lookbook-card size-${item.size}`}
              key={`${item.tone}-${i}`}
              variants={fadeUp}
              whileHover={{ y: -6 }}
            >
              <Lantern size={item.size === 'tall' ? 150 : 110} tone={item.tone} />
              <span className="lookbook-caption">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section id="process" className="process">
        <div className="section-head">
          <span className="eyebrow">Hành trình thủ công</span>
          <h2>Theo dõi đèn của bạn từng bước</h2>
        </div>
        <motion.ol
          className="timeline"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
        >
          {steps.map((s, i) => (
            <motion.li key={s.label} variants={fadeUp}>
              <span className="timeline-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="timeline-label">{s.label}</span>
              <span className="timeline-note">{s.note}</span>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      <section id="qr" className="qr-experience">
        <motion.div
          className="qr-copy"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={stagger}
        >
          <motion.span className="eyebrow" variants={fadeUp}>
            Khoảnh khắc mở quà
          </motion.span>
          <motion.h2 variants={fadeUp}>
            Quét mã, thấy cả một câu chuyện
          </motion.h2>
          <motion.p className="story-text" variants={fadeUp}>
            Mỗi chiếc đèn mang một mã QR riêng. Người nhận chỉ cần đưa điện
            thoại lên — video hành trình đèn được làm ra và lời chúc của bạn
            sẽ hiện lên, được lưu giữ lâu dài.
          </motion.p>
          <motion.ul className="qr-points" variants={fadeUp}>
            <li>Video quá trình làm đèn của chính chiếc đèn này</li>
            <li>Lời chúc bằng giọng nói hoặc video của người tặng</li>
            <li>Lưu lại vĩnh viễn trong “sổ lưu niệm” cá nhân</li>
          </motion.ul>
        </motion.div>

        <motion.div
          className="phone-mock"
          initial={{ opacity: 0, y: 40, rotate: -2 }}
          whileInView={{ opacity: 1, y: 0, rotate: -2 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="phone-video">
                <motion.div
                  className="play-glow"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
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
        </motion.div>
      </section>

      <motion.section
        className="testimonials"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
      >
        <div className="section-head">
          <span className="eyebrow">Người đã thắp đèn</span>
          <h2>Những câu chuyện được kể lại</h2>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((t) => (
            <motion.figure className="testimonial-card" key={t.name} variants={fadeUp}>
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
            </motion.figure>
          ))}
        </div>
      </motion.section>

      <motion.section
        id="faq"
        className="faq"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
      >
        <motion.div className="section-head" variants={fadeUp}>
          <span className="eyebrow">Giải đáp</span>
          <h2>Những điều bạn có thể thắc mắc</h2>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Faq />
        </motion.div>
      </motion.section>

      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="nav-mark">MỘC</span>
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
              <input type="email" placeholder="Email của bạn" required />
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
  )
}

export default App
