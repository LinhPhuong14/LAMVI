import { useState } from 'react'
import { motion } from 'framer-motion'
import Lantern from './components/Lantern'
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
  },
  {
    name: 'Đèn Vọng',
    desc: 'Thân thon cao, gợi nhớ mái đình làng cổ',
    price: '1.050.000₫',
  },
  {
    name: 'Đèn Sum Vầy',
    desc: 'Bộ ba kích cỡ, dành tặng cả gia đình',
    price: '1.680.000₫',
  },
]

const steps = [
  { label: 'Chọn giấy dó', note: 'Lọc từng tấm giấy dệt tay không tì vết' },
  { label: 'Lên khung tre', note: 'Vót nan, uốn khung theo dáng cổ truyền' },
  { label: 'Phơi nắng', note: 'Đợi nắng tự nhiên làm săn từng lớp giấy' },
  { label: 'Đóng gói & khắc QR', note: 'Gắn mã riêng lưu câu chuyện của bạn' },
]

function App() {
  const [intent, setIntent] = useState('gift')

  return (
    <div className="page">
      <header className="nav">
        <span className="nav-mark">MỘC</span>
        <nav className="nav-links">
          <a href="#story">Câu chuyện</a>
          <a href="#products">Sản phẩm</a>
          <a href="#process">Quy trình</a>
          <a href="#qr">Trải nghiệm QR</a>
        </nav>
        <a href="#products" className="nav-cta">
          Đặt đèn
        </a>
      </header>

      <section className="hero">
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
          <Lantern size={260} />
        </motion.div>
      </section>

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
        <motion.p className="story-text" variants={fadeUp}>
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
              <div className="product-art">
                <Lantern size={120} />
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

      <footer className="footer">
        <span className="nav-mark">MỘC</span>
        <p>Đèn giấy dó thủ công — giữ lửa ký ức, thắp sáng yêu thương.</p>
      </footer>
    </div>
  )
}

export default App
