import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AnimatePresence,
  m,
  useMotionValueEvent,
  useReducedMotionConfig,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import Lantern from '../components/Lantern'
import ScrollProgress from '../components/ScrollProgress'
import Marquee from '../components/Marquee'
import Particles from '../components/Particles'
import Faq from '../components/Faq'
import FolkGallery from '../components/FolkGallery'
import Scene from '../components/Scene'
import Price from '../components/Price'
import { CountUp, Reveal } from '../components/Reveal'
import { PointerGlow, TiltCard } from '../components/Effects'
import { Cloud, DrumSun, Lotus, OldPhoto, Seal, VerticalSeal } from '../components/Motifs'
import {
  EASE_IN,
  EASE_OUT,
  group,
  ink,
  inkWord,
  lampBeam,
  lampOrb,
  rise,
  stamp,
  wordGroup,
} from '../lib/motion.js'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import Seo from '../seo/Seo.jsx'
import AddToCart from '../cart/AddToCart.jsx'

const TONES = ['amber', 'dusk', 'dawn', 'moss', 'dusk']
const SIZES = ['tall', 'short', 'short', 'tall', 'short']

// Màn hình đầu chạy bằng CSS (class `intro`, `word`): hiện ngay khi HTML server tới trình duyệt,
// không chờ JS hydrate → chữ tiêu đề (LCP) không bị ẩn khi JS chậm hoặc lỗi (G-34)
const introDelay = (i) => ({ animationDelay: `${0.1 + i * 0.1}s` })

// Đèn lookbook: tắt khi chưa tới, bập bùng rồi sáng hẳn khi cuộn tới, lịm dần khi cuộn qua
const lampHalo = {
  below: { opacity: 0, scale: 0.6, transition: { duration: 0.5, ease: EASE_IN } },
  in: {
    opacity: [0, 0.85, 0.3, 1, 0.8],
    scale: 1,
    transition: { duration: 1.3, times: [0, 0.2, 0.35, 0.6, 1], ease: 'easeOut' },
  },
  above: { opacity: 0, scale: 0.8, transition: { duration: 0.6, ease: EASE_IN } },
}
const lampBody = {
  below: { filter: 'brightness(0.45) saturate(0.3)', transition: { duration: 0.5 } },
  in: { filter: 'brightness(1) saturate(1)', transition: { duration: 1.1, delay: 0.1, ease: EASE_OUT } },
  above: { filter: 'brightness(0.45) saturate(0.3)', transition: { duration: 0.6 } },
}

const phone = {
  below: { opacity: 0, y: 70, rotate: -7, transition: { duration: 0.45, ease: EASE_IN } },
  in: { opacity: 1, y: 0, rotate: -2, transition: { type: 'spring', stiffness: 90, damping: 16 } },
  above: { opacity: 0, y: -50, rotate: 3, transition: { duration: 0.45, ease: EASE_IN } },
}
const sun = {
  below: { opacity: 0, scale: 0.4, transition: { duration: 0.4 } },
  in: { opacity: 1, scale: 1, transition: { duration: 1, ease: EASE_OUT } },
  above: { opacity: 0, scale: 0.6, transition: { duration: 0.4 } },
}

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

function Eyebrow({ children, variants = rise }) {
  return (
    <m.span className="eyebrow" variants={variants}>
      <Lotus />
      {children}
      <Lotus />
    </m.span>
  )
}

// Đặt trong một Reveal: nhận trạng thái below/in/above từ cha
function SectionHead({ eyebrow, title, children }) {
  return (
    <m.div className="section-head" variants={group}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <m.h2 variants={ink}>{title}</m.h2>
      {children}
    </m.div>
  )
}

// Tách từ để chữ hiện lần lượt như mực thấm; khoảng trắng nằm ngoài span để không bị nuốt
function Words({ text, start = 0 }) {
  const words = text.split(' ')
  return words.map((w, i) => (
    <Fragment key={i}>
      <span className="word" style={{ animationDelay: `${0.25 + (start + i) * 0.06}s` }}>
        {w}
      </span>
      {i < words.length - 1 ? ' ' : null}
    </Fragment>
  ))
}

// Lời trích hiện từng từ như mực thấm; đặt trong Reveal
function InkWords({ text }) {
  const words = text.split(' ')
  return words.map((w, i) => (
    <Fragment key={i}>
      <m.span className="word" variants={inkWord}>
        {w}
      </m.span>
      {i < words.length - 1 ? ' ' : null}
    </Fragment>
  ))
}

// Đèn trời (ảnh thật CC0 tách nền — public/images/scene/CREDITS.md) bay lên trên nền đêm của lookbook — chỉ trang trí, chạy bằng CSS
const SKY_LANTERNS = [
  { left: '6%', delay: 0, duration: 22, size: 12 },
  { left: '17%', delay: 7, duration: 26, size: 9 },
  { left: '31%', delay: 3, duration: 24, size: 7 },
  { left: '48%', delay: 11, duration: 28, size: 10 },
  { left: '63%', delay: 5, duration: 23, size: 8 },
  { left: '76%', delay: 14, duration: 27, size: 12 },
  { left: '88%', delay: 9, duration: 25, size: 9 },
  { left: '95%', delay: 2, duration: 30, size: 7 },
]

function SkyLanterns() {
  return (
    <div className="sky-lanterns" aria-hidden="true">
      {SKY_LANTERNS.map((l, i) => (
        <span
          key={i}
          className="sky-lantern"
          style={{
            left: l.left,
            width: l.size * 2.6,
            animationDuration: `${l.duration}s`,
            animationDelay: `-${l.delay}s`,
          }}
        >
          <img src="/images/scene/sky-lantern-glow.webp" alt="" width="176" height="180" loading="lazy" decoding="async" />
        </span>
      ))}
    </div>
  )
}

// Đèn treo rọi luồng sáng xuống tiêu đề; mở khi cuộn tới, thu lại khi rời đi (ý tưởng "Lamp Effect")
function LampHead({ eyebrow, title }) {
  return (
    <Reveal className="lamp" variants={group}>
      <div className="lamp-light" aria-hidden="true">
        <m.span className="lamp-beam" variants={lampBeam} />
        <m.span className="lamp-orb" variants={lampOrb} />
        <div className="lamp-lantern">
          <Lantern size={46} tone="amber" swing flicker />
        </div>
      </div>
      <SectionHead eyebrow={eyebrow} title={title} />
    </Reveal>
  )
}

// Sợi chỉ đỏ chạy theo tiến độ cuộn; qua bước nào thì bước đó "thắp" lên (ý tưởng "Tracing Beam")
function ProcessTimeline({ steps }) {
  const ref = useRef(null)
  const reduce = useReducedMotionConfig()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 50%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, restDelta: 0.001 })
  const sparkX = useTransform(progress, (v) => `${v * 100}%`)
  const [lit, setLit] = useState(0)
  useMotionValueEvent(progress, 'change', (v) => {
    const next = v <= 0.02 ? 0 : Math.min(steps.length, 1 + Math.floor(v * (steps.length - 1) + 0.02))
    if (next !== lit) setLit(next)
  })
  const litCount = reduce ? steps.length : lit

  return (
    <div className="timeline-wrap" ref={ref}>
      <div className="timeline-track" aria-hidden="true">
        <m.span className="timeline-beam" style={{ scaleX: reduce ? 1 : progress }} />
        {!reduce && (
          <m.span className="timeline-spark-rail" style={{ x: sparkX }}>
            <span className="timeline-spark" />
          </m.span>
        )}
      </div>
      <Reveal as="ol" className="timeline" variants={group}>
        {steps.map((s, i) => (
          <m.li key={s.label} variants={stamp} custom={i} className={i < litCount ? 'is-lit' : undefined}>
            <span className="timeline-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="timeline-label">{s.label}</span>
            <span className="timeline-note">{s.note}</span>
          </m.li>
        ))}
      </Reveal>
    </div>
  )
}

function Hero() {
  const { t } = useI18n()
  const reduce = useReducedMotionConfig()
  const { scrollY } = useScroll()
  // Rời màn hình đầu: chữ mờ dần và lui lên; đèn bay lên như thả đèn trời; trống đồng chìm xuống
  const copyOpacity = useTransform(scrollY, [0, 520], [1, 0])
  const copyY = useTransform(scrollY, [0, 520], [0, reduce ? 0 : -70])
  const lanternY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : -180])
  const lanternOpacity = useTransform(scrollY, [250, 700], [1, 0])
  const drumY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 140])
  const cueOpacity = useTransform(scrollY, [0, 140], [1, 0])

  return (
    <section className="hero aged has-motifs">
      <Scene name="hero" />
      <PointerGlow />
      <Particles />
      <Cloud className="hero-cloud cloud-a" />
      <Cloud className="hero-cloud cloud-b" />

      <m.div className="hero-copy" style={{ opacity: copyOpacity, y: copyY }}>
        <div>
          <span className="eyebrow intro" style={introDelay(0)}>
            <Lotus />
            {t('hero.eyebrow')}
            <Lotus />
          </span>
          <h1>
            <Words text={t('hero.title1')} />
            <br />
            <span className="h1-accent">
              <Words text={t('hero.title2')} start={t('hero.title1').split(' ').length} />
            </span>
          </h1>
          <p className="hero-sub intro" style={introDelay(5)}>
            {t('hero.sub')}
          </p>
          <div className="hero-actions intro" style={introDelay(6)}>
            <a href="#products" className="btn btn-primary thread">
              {t('hero.explore')}
            </a>
            <a href="#story" className="btn btn-ghost">
              {t('hero.story')}
            </a>
          </div>
        </div>
      </m.div>

      <div className="hero-art">
        <m.div className="hero-drum" style={{ y: drumY }}>
          <m.div
            initial={{ opacity: 0, scale: 0.7, rotate: -40 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.6, ease: EASE_OUT }}
          >
            <DrumSun />
          </m.div>
        </m.div>
        <div className="hero-glow" />
        <m.div className="hero-lantern" style={{ y: lanternY, opacity: lanternOpacity }}>
          <m.div
            initial={{ y: -140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 55, damping: 11, delay: 0.3 }}
          >
            <Lantern size={250} tone="dusk" swing flicker />
          </m.div>
        </m.div>
        <m.div
          className="hero-art-satellite satellite-a"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.6 }}
        >
          <Lantern size={78} tone="amber" swing />
        </m.div>
        <m.div
          className="hero-art-satellite satellite-b"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.8 }}
        >
          <Lantern size={58} tone="moss" swing />
        </m.div>
        {/* Ấn triện dọc đóng lên sau cùng, như lạc khoản bên mép tranh */}
        <m.div
          className="hero-seal"
          initial={{ opacity: 0, scale: 1.6, rotate: -18 }}
          animate={{ opacity: 1, scale: 1, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 1.3 }}
        >
          <VerticalSeal label="LAMVI" />
        </m.div>
      </div>

      <m.a href="#story" className="scroll-cue" style={{ opacity: cueOpacity }}>
        <span>{t('hero.scroll')}</span>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" aria-hidden="true">
          <path d="M1 1L7 19L13 1" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </m.a>
    </section>
  )
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
    <Reveal className="product-grid" variants={group} margin="-8% 0px -8% 0px">
      {res.data.items.map((p, i) => (
        <TiltCard className={`product-card tone-${p.tone}`} key={p.slug} variants={stamp} custom={i}>
          {p.badge && <Seal className="product-badge lift">{p.badge}</Seal>}
          <div className="product-art worn">
            <div className="lift">
              <Lantern size={112} tone={p.tone} swing />
            </div>
          </div>
          <div className="product-body">
            <h3>
              <Link to={path(`/products/${p.slug}`)} className="product-link">
                {p.name}
              </Link>
            </h3>
            <p className="product-desc">{p.description}</p>
            <div className="product-foot">
              <Price amount={p.priceExclVat} />
              {/* FR-CART-001; "Mua tặng/Mua cho mình" chọn ở bước thanh toán (FR-CHK-002) */}
              <AddToCart slug={p.slug} label={intent === 'gift' ? t('cart.giftAdd') : t('cart.add')} />
            </div>
          </div>
        </TiltCard>
      ))}
    </Reveal>
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

      <Hero />

      <Marquee />

      <Reveal as="section" id="story" className="story has-motifs" variants={group}>
        <Scene name="story" />
        <SectionHead eyebrow={t('story.eyebrow')} title={t('story.title')} />
        <m.p className="story-text drop-cap" variants={rise}>
          {t('story.text')}
        </m.p>
        <m.div className="story-stats" variants={group}>
          {[
            ['100+', 'story.statYears'],
            ['12', 'story.statArtisans'],
            ['1', 'story.statStory'],
          ].map(([value, key], i) => (
            <m.div key={key} variants={stamp} custom={i}>
              <CountUp value={value} />
              <span>{t(key)}</span>
            </m.div>
          ))}
        </m.div>
        <FolkGallery />
      </Reveal>

      <Reveal as="section" id="artisan" className="artisan has-motifs" variants={group}>
        <Scene name="artisan" />
        <m.div className="artisan-portrait" variants={stamp} custom={1}>
          {/* Ảnh cũ ngả sepia: chỉ là minh hoạ, không phải ảnh thật của nghệ nhân */}
          <OldPhoto>
            <rect width="200" height="248" fill="#c9a877" />
            <circle cx="100" cy="104" r="80" fill="#e2c592" />
            <path
              d="M34 248 C34 170 66 144 100 144 C134 144 166 170 166 248 Z"
              fill="#5b4330"
              stroke="#2b2119"
              strokeWidth="3"
            />
            <path d="M84 144 L100 176 L116 144" fill="none" stroke="#2b2119" strokeWidth="3" />
            <circle cx="100" cy="100" r="34" fill="#b08660" stroke="#2b2119" strokeWidth="3" />
            <path d="M58 80 C60 52 140 52 142 80 C122 72 78 72 58 80 Z" fill="#2b2119" />
            <path
              d="M86 106 q5 3 9 0 M105 106 q5 3 9 0 M92 120 q8 6 16 0"
              stroke="#2b2119"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
          </OldPhoto>
          <span className="portrait-quote-mark" aria-hidden="true">
            ”
          </span>
        </m.div>
        <m.div className="artisan-copy" variants={group}>
          <Eyebrow>{t('artisan.eyebrow')}</Eyebrow>
          <m.h2 variants={ink}>{t('artisan.title')}</m.h2>
          <m.p className="artisan-quote" variants={wordGroup}>
            <InkWords text={t('artisan.quote')} />
          </m.p>
          <m.div className="artisan-meta" variants={rise}>
            <div>
              <strong>{t('artisan.name')}</strong>
              <span>{t('artisan.place')}</span>
            </div>
            <div className="artisan-stats">
              <div>
                <CountUp value="32" />
                <span>{t('artisan.years')}</span>
              </div>
              <div>
                <CountUp value="4.000+" />
                <span>{t('artisan.made')}</span>
              </div>
            </div>
          </m.div>
        </m.div>
      </Reveal>

      <section id="products" className="products has-motifs">
        <Scene name="products" />
        <Reveal variants={group}>
          <SectionHead eyebrow={t('products.eyebrow')} title={t('products.title')}>
            <m.div className={`intent-toggle is-${intent}`} role="group" variants={rise}>
              <span className="intent-pill" aria-hidden="true" />
              {['gift', 'self'].map((key) => (
                <button
                  key={key}
                  className={intent === key ? 'active' : ''}
                  aria-pressed={intent === key}
                  onClick={() => setIntent(key)}
                >
                  {t(`products.${key}`)}
                </button>
              ))}
            </m.div>
            <div className="intent-copy-wrap">
              <AnimatePresence mode="wait" initial={false}>
                <m.p
                  key={intent}
                  className="intent-copy"
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  {intent === 'gift' ? t('products.giftCopy') : t('products.selfCopy')}
                </m.p>
              </AnimatePresence>
            </div>
          </SectionHead>
        </Reveal>

        <ProductGrid intent={intent} />
      </section>

      <section id="lookbook" className="lookbook has-motifs">
        <Scene name="lookbook" />
        <SkyLanterns />
        <div className="lookbook-inner">
          <LampHead eyebrow={t('lookbook.eyebrow')} title={t('lookbook.title')} />
          <Reveal className="lookbook-grid" variants={group} margin="-10% 0px -10% 0px">
            {t('lookbook.items').map((label, i) => (
              <m.div
                className={`lookbook-card size-${SIZES[i]} tone-${TONES[i]}`}
                key={`${TONES[i]}-${i}`}
                variants={rise}
              >
                <m.span className="lookbook-halo" aria-hidden="true" variants={lampHalo} />
                <m.div className="lookbook-lamp" variants={lampBody}>
                  <Lantern size={SIZES[i] === 'tall' ? 140 : 104} tone={TONES[i]} swing />
                </m.div>
                <span className="lookbook-caption">{label}</span>
              </m.div>
            ))}
          </Reveal>
        </div>
      </section>

      <section id="process" className="process has-motifs">
        <Scene name="process" />
        <Reveal variants={group}>
          <SectionHead eyebrow={t('process.eyebrow')} title={t('process.title')} />
        </Reveal>
        <ProcessTimeline steps={t('process.steps')} />
      </section>

      <section id="qr" className="qr-experience has-motifs">
        <Scene name="qr" />
        <Reveal className="qr-copy" variants={group}>
          <Eyebrow>{t('qr.eyebrow')}</Eyebrow>
          <m.h2 variants={ink}>{t('qr.title')}</m.h2>
          <m.p className="story-text" variants={rise}>
            {t('qr.text')}
          </m.p>
          <m.ul className="qr-points" variants={group}>
            {t('qr.points').map((point) => (
              <m.li key={point} variants={rise}>
                {point}
              </m.li>
            ))}
          </m.ul>
        </Reveal>

        <Reveal className="phone-mock" variants={group}>
          <m.span className="phone-sun" aria-hidden="true" variants={sun} />
          <m.div className="phone-frame" variants={phone}>
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="phone-video">
                <span className="play-glow" />
                <span className="play-icon">▶</span>
              </div>
              <p className="phone-caption">{t('qr.phoneCaption')}</p>
              <div className="phone-message">
                <span className="phone-message-label">{t('qr.phoneFrom')}</span>
                <p>{t('qr.phoneMessage')}</p>
              </div>
            </div>
          </m.div>
        </Reveal>
      </section>

      <section className="testimonials has-motifs">
        <Scene name="testimonials" />
        <Reveal variants={group}>
          <SectionHead eyebrow={t('testimonials.eyebrow')} title={t('testimonials.title')} />
        </Reveal>
        <Reveal className="testimonial-grid" variants={group}>
          {t('testimonials.items').map((item, i) => (
            <m.figure className="testimonial-card" key={item.name} variants={stamp} custom={i}>
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
            </m.figure>
          ))}
        </Reveal>
      </section>

      <section id="faq" className="faq has-motifs">
        <Scene name="faq" />
        <Reveal variants={group}>
          <SectionHead eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
        </Reveal>
        <Reveal variants={rise}>
          <Faq />
        </Reveal>
      </section>
    </>
  )
}
