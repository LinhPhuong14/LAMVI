import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Lantern from '../components/Lantern'
import ScrollProgress from '../components/ScrollProgress'
import Marquee from '../components/Marquee'
import Particles from '../components/Particles'
import Faq from '../components/Faq'
import Price from '../components/Price'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import Seo from '../seo/Seo.jsx'

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
}

const TONES = ['amber', 'dusk', 'dawn', 'moss', 'dusk']
const SIZES = ['tall', 'short', 'short', 'tall', 'short']

function Initials({ name }) {
  const letters = name
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
  return <span className="avatar-initials">{letters}</span>
}

// Cuộn tới mục theo #hash khi vào trang chủ từ trang khác
function useScrollToHash() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView?.()
  }, [hash])
}

function ProductGrid({ intent }) {
  const { t, lang, path } = useI18n()
  const res = useApi('/products', lang)

  if (res.status === 'loading') return <p className="products-status">{t('products.loading')}</p>
  if (res.status === 'error')
    return (
      <p className="products-status" role="alert">
        {t('products.error')}
      </p>
    )
  if (res.data.items.length === 0) return <p className="products-status">{t('products.empty')}</p>

  return (
    <motion.div
      className="product-grid"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={stagger}
    >
      {res.data.items.map((p) => (
        <motion.article className="product-card" key={p.slug} variants={fadeUp}>
          {p.badge && <span className="product-badge">{p.badge}</span>}
          <div className="product-art">
            <Lantern size={120} tone={p.tone} />
          </div>
          <h3>
            <Link to={path(`/products/${p.slug}`)} className="product-link">
              {p.name}
            </Link>
          </h3>
          <p className="product-desc">{p.description}</p>
          <div className="product-foot">
            <Price amount={p.priceExclVat} />
            {/* G-02: chưa có giỏ hàng (Q-13) — dẫn tới trang chi tiết */}
            <Link
              to={{ pathname: path(`/products/${p.slug}`), search: `?intent=${intent}` }}
              className="btn btn-small"
            >
              {t('products.viewDetail')}
            </Link>
          </div>
        </motion.article>
      ))}
    </motion.div>
  )
}

export default function HomePage() {
  const [intent, setIntent] = useState('gift')
  const { t } = useI18n()
  useScrollToHash()

  return (
    <>
      <Seo title={t('meta.title')} description={t('meta.description')} path="/" />
      <ScrollProgress />


      <section className="hero">
        <Particles />
        <motion.div
          className="hero-copy"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.span className="eyebrow" variants={fadeUp}>
            {t('hero.eyebrow')}
          </motion.span>
          <motion.h1 variants={fadeUp}>
            {t('hero.title1')}
            <br />
            {t('hero.title2')}
          </motion.h1>
          <motion.p className="hero-sub" variants={fadeUp}>
            {t('hero.sub')}
          </motion.p>
          <motion.div className="hero-actions" variants={fadeUp}>
            <motion.a
              href="#products"
              className="btn btn-primary"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              {t('hero.explore')}
            </motion.a>
            <motion.a
              href="#story"
              className="btn btn-ghost"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              {t('hero.story')}
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
          <span>{t('hero.scroll')}</span>
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
          {t('story.eyebrow')}
        </motion.span>
        <motion.h2 variants={fadeUp}>{t('story.title')}</motion.h2>
        <motion.p className="story-text drop-cap" variants={fadeUp}>
          {t('story.text')}
        </motion.p>
        <motion.div className="story-stats" variants={fadeUp}>
          <div>
            <strong>100+</strong>
            <span>{t('story.statYears')}</span>
          </div>
          <div>
            <strong>12</strong>
            <span>{t('story.statArtisans')}</span>
          </div>
          <div>
            <strong>1</strong>
            <span>{t('story.statStory')}</span>
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
          <span className="eyebrow">{t('artisan.eyebrow')}</span>
          <h2>{t('artisan.title')}</h2>
          <p className="artisan-quote">
            {t('artisan.quote')}
          </p>
          <div className="artisan-meta">
            <div>
              <strong>{t('artisan.name')}</strong>
              <span>{t('artisan.place')}</span>
            </div>
            <div className="artisan-stats">
              <div>
                <strong>32</strong>
                <span>{t('artisan.years')}</span>
              </div>
              <div>
                <strong>4.000+</strong>
                <span>{t('artisan.made')}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      <section id="products" className="products">
        <div className="section-head">
          <span className="eyebrow">{t('products.eyebrow')}</span>
          <h2>{t('products.title')}</h2>
          <div className="intent-toggle">
            <button
              className={intent === 'gift' ? 'active' : ''}
              onClick={() => setIntent('gift')}
            >
              {t('products.gift')}
            </button>
            <button
              className={intent === 'self' ? 'active' : ''}
              onClick={() => setIntent('self')}
            >
              {t('products.self')}
            </button>
          </div>
          <motion.p
            key={intent}
            className="intent-copy"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {intent === 'gift' ? t('products.giftCopy') : t('products.selfCopy')}
          </motion.p>
        </div>

        <ProductGrid intent={intent} />
      </section>

      <section id="lookbook" className="lookbook">
        <div className="section-head">
          <span className="eyebrow">{t('lookbook.eyebrow')}</span>
          <h2>{t('lookbook.title')}</h2>
        </div>
        <motion.div
          className="lookbook-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
        >
          {t('lookbook.items').map((label, i) => (
            <motion.div
              className={`lookbook-card size-${SIZES[i]}`}
              key={`${TONES[i]}-${i}`}
              variants={fadeUp}
              whileHover={{ y: -6 }}
            >
              <Lantern size={SIZES[i] === 'tall' ? 150 : 110} tone={TONES[i]} />
              <span className="lookbook-caption">{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section id="process" className="process">
        <div className="section-head">
          <span className="eyebrow">{t('process.eyebrow')}</span>
          <h2>{t('process.title')}</h2>
        </div>
        <motion.ol
          className="timeline"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
        >
          {t('process.steps').map((s, i) => (
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
            {t('qr.eyebrow')}
          </motion.span>
          <motion.h2 variants={fadeUp}>
            {t('qr.title')}
          </motion.h2>
          <motion.p className="story-text" variants={fadeUp}>
            {t('qr.text')}
          </motion.p>
          <motion.ul className="qr-points" variants={fadeUp}>
            {t('qr.points').map((point) => (
              <li key={point}>{point}</li>
            ))}
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
              <p className="phone-caption">{t('qr.phoneCaption')}</p>
              <div className="phone-message">
                <span className="phone-message-label">{t('qr.phoneFrom')}</span>
                <p>{t('qr.phoneMessage')}</p>
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
          <span className="eyebrow">{t('testimonials.eyebrow')}</span>
          <h2>{t('testimonials.title')}</h2>
        </div>
        <div className="testimonial-grid">
          {t('testimonials.items').map((item) => (
            <motion.figure className="testimonial-card" key={item.name} variants={fadeUp}>
              <div className="stars">★★★★★</div>
              <blockquote>{item.quote}</blockquote>
              <figcaption>
                <span className="avatar">
                  <Initials name={item.name} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <span className="testimonial-context">{item.context}</span>
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
          <span className="eyebrow">{t('faq.eyebrow')}</span>
          <h2>{t('faq.title')}</h2>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Faq />
        </motion.div>
      </motion.section>

    </>
  )
}
