import { useHydratedReducedMotion } from '../lib/hydration.js'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  m,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import Lantern from '../components/Lantern'
import ScrollProgress from '../components/ScrollProgress'
import Faq from '../components/Faq'
import FolkGallery from '../components/FolkGallery'
import CraftFilms, { CraftVideo, IntroFilm, PhoneVideo } from '../components/CraftFilms'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import Scene from '../components/Scene'
import { CountUp, Reveal } from '../components/Reveal'
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
import { organizationJsonLd, webSiteJsonLd } from '../seo/head.js'
import { useSiteUrl } from '../seo/context.js'
import ProductCards from '../components/ProductCards'
import Carousel from '../components/Carousel.jsx'
import { usePreview } from '../components/HoverPreview.jsx'
import MayAvatar from '../may/MayAvatar.jsx'

const TONES = ['amber', 'dusk', 'dawn', 'moss', 'dusk']
// Ảnh 5 đèn từ fanpage chính thức (public/images/lamps/CREDITS.md) — cùng thứ tự với lookbook.items
const LOOKBOOK_PHOTOS = ['thu-hoach', 'tu-linh', 'phuc-loc-song-toan', 'tam-duong-khai-thai', 'lon-dan']
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
    transition: { duration: 2.1, times: [0, 0.2, 0.35, 0.6, 1], ease: 'easeOut' },
  },
  above: { opacity: 0, scale: 0.8, transition: { duration: 0.6, ease: EASE_IN } },
}
const lampBody = {
  below: { filter: 'brightness(0.45) saturate(0.3)', transition: { duration: 0.5 } },
  in: { filter: 'brightness(1) saturate(1)', transition: { duration: 1.8, delay: 0.2, ease: EASE_OUT } },
  above: { filter: 'brightness(0.45) saturate(0.3)', transition: { duration: 0.6 } },
}

const phone = {
  below: { opacity: 0, y: 70, rotate: -7, transition: { duration: 0.45, ease: EASE_IN } },
  in: { opacity: 1, y: 0, rotate: -2, transition: { type: 'spring', stiffness: 38, damping: 14, mass: 1.2 } },
  above: { opacity: 0, y: -50, rotate: 3, transition: { duration: 0.45, ease: EASE_IN } },
}
const sun = {
  below: { opacity: 0, scale: 0.4, transition: { duration: 0.4 } },
  in: { opacity: 1, scale: 1, transition: { duration: 1.8, ease: EASE_OUT } },
  above: { opacity: 0, scale: 0.6, transition: { duration: 0.4 } },
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
      {children}
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
  const reduce = useHydratedReducedMotion()
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
  const { t, path } = useI18n()
  const reduce = useHydratedReducedMotion()
  const ref = useRef(null)
  // Tính theo chính khối hero (không theo đầu trang: phía trên nó có video giới thiệu)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const copyOpacity = useTransform(scrollYProgress, [0.3, 1], [1, 0])
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -50])
  const lanternY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -90])
  const lanternOpacity = useTransform(scrollYProgress, [0.4, 1], [1, 0])

  return (
    <section id="hero" className="hero" ref={ref}>
      <m.div className="hero-copy" style={{ opacity: copyOpacity, y: copyY }}>
        <div>
          <span className="eyebrow intro" style={introDelay(0)}>
            {t('hero.eyebrow')}
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
            <Link to={path('/shop')} className="btn btn-primary thread">
              {t('hero.explore')}
            </Link>
            <a href="#story" className="btn btn-ghost">
              {t('hero.story')}
            </a>
          </div>
        </div>
      </m.div>

      <div className="hero-art">
        <m.div className="hero-lantern" style={{ y: lanternY, opacity: lanternOpacity }}>
          {/* Đèn thật (mẫu Tứ Linh) đã tách nền từ ảnh fanpage (D-107, public/images/lamps/CREDITS.md) */}
          <img className="lamp-cutout hero-lamp" src="/images/lamps/tu-linh-cutout.webp" alt={t('lookbook.items')[1]} width={172} height={402} fetchPriority="high" decoding="async" />
        </m.div>
        <figure className="hero-polaroid hp-a" aria-hidden="true">
          <img src="/images/folk/chuot-ruoc-den-480.webp" alt="" width={150} height={170} loading="lazy" decoding="async" />
        </figure>
        <figure className="hero-polaroid hp-b" aria-hidden="true">
          <img src="/images/lamps/thu-hoach.jpg" alt="" width={130} height={160} loading="lazy" decoding="async" />
        </figure>
      </div>

    </section>
  )
}

// Thẻ đèn ở lookbook: rê chuột/focus hiện khung phóng to ảnh thật của đèn (D-124)
function LookbookCard({ label, i }) {
  const slug = LOOKBOOK_PHOTOS[i]
  const { bind, node } = usePreview({ src: slug ? `/images/lamps/${slug}.jpg` : '', title: label, subtitle: 'LAMVI' })
  return (
    <m.div className={`lookbook-card size-${SIZES[i]} tone-${TONES[i]}`} variants={rise} tabIndex={0} {...(slug ? bind : {})}>
      <m.span className="lookbook-halo" aria-hidden="true" variants={lampHalo} />
      <m.div className="lookbook-lamp" variants={lampBody}>
        {slug ? (
          <img className="lamp-cutout lookbook-lamp-img" src={`/images/lamps/${slug}-cutout.webp`} alt="" width={74} height={170} loading="lazy" decoding="async" />
        ) : (
          <Lantern size={SIZES[i] === 'tall' ? 140 : 104} tone={TONES[i]} swing />
        )}
      </m.div>
      <span className="lookbook-caption">{label}</span>
      {slug && node}
    </m.div>
  )
}

function ProductGrid() {
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
    <>
      <ProductCards items={res.data.items} carousel label={t('products.title')} />
      {/* D-86: đi tới trang Cửa hàng để xem toàn bộ đèn */}
      <div className="products-more">
        <Link to={path('/shop')} className="btn btn-ghost">
          {t('products.viewAll')} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  )
}

export default function HomePage() {
  const { t, lang } = useI18n()
  const siteUrl = useSiteUrl()
  useScrollToHash()

  return (
    <>
      <Seo
        title={t('meta.title')}
        description={t('meta.description')}
        path="/"
        jsonLd={[
          organizationJsonLd(siteUrl),
          webSiteJsonLd(siteUrl, { lang, name: t('meta.title'), description: t('meta.description') }),
        ]}
      />
      <ScrollProgress />

      <IntroFilm ctaHref="#hero" />

      <Hero />

      <Reveal as="section" id="story" className="story has-motifs" variants={group}>
        <Scene name="story" />
        <SectionHead eyebrow={t('story.eyebrow')} title={t('story.title')} />
        <m.p className="story-text drop-cap" variants={rise}>
          {t('story.text')}
        </m.p>
        <m.div className="story-stats" variants={group}>
          {[
            ['5', 'story.statLamps'],
            ['3', 'story.statStages'],
            ['1', 'story.statStory'],
          ].map(([value, key], i) => (
            <m.div key={key} variants={stamp} custom={i}>
              <CountUp value={value} />
              <span>{t(key)}</span>
            </m.div>
          ))}
        </m.div>
        {/* Ảnh bìa fanpage chính thức (đã cắt bỏ dải thông tin liên hệ chưa xác nhận — G-115) */}
        <m.figure className="story-cover" variants={rise}>
          <img src="/images/brand/cover-1672x800.jpg" alt={t('story.coverAlt')} width={1672} height={800} loading="lazy" decoding="async" />
        </m.figure>
        <FolkGallery />
      </Reveal>

      <Reveal as="section" id="artisan" className="artisan has-motifs" variants={group}>
        <Scene name="artisan" />
        {/* D-118: video thật ở làng tranh Đông Hồ thay chân dung minh hoạ */}
        <m.figure className="artisan-film film-card" variants={stamp} custom={1}>
          <CraftVideo film={CRAFT_FILMS.dongho} title={t('artisan.videoTitle')} />
          <figcaption>
            <span>{t('artisan.videoCaption')}</span>
          </figcaption>
        </m.figure>
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
          </m.div>
        </m.div>
      </Reveal>

      <section id="products" className="products has-motifs">
        <Scene name="products" />
        <Reveal variants={group}>
          <SectionHead eyebrow={t('products.eyebrow')} title={t('products.title')}>
            <m.p className="intent-copy" variants={rise}>
              {t('products.collectionCopy')}
            </m.p>
          </SectionHead>
        </Reveal>

        <ProductGrid />
      </section>

      <section id="lookbook" className="lookbook has-motifs">
        <Scene name="lookbook" />
        <SkyLanterns />
        <div className="lookbook-inner">
          <LampHead eyebrow={t('lookbook.eyebrow')} title={t('lookbook.title')} />
          <Carousel label={t('lookbook.title')}>
          <Reveal className="lookbook-grid" variants={group} margin="-10% 0px -10% 0px">
            {t('lookbook.items').map((label, i) => (
              <LookbookCard key={`${TONES[i]}-${i}`} label={label} i={i} />
            ))}
          </Reveal>
          </Carousel>
        </div>
      </section>

      <section id="process" className="process has-motifs">
        <Scene name="process" />
        <Reveal variants={group}>
          <SectionHead eyebrow={t('process.eyebrow')} title={t('process.title')} />
        </Reveal>
        <ProcessTimeline steps={t('process.steps')} />
      </section>

      {/* D-118: video làng giấy dó (cách làm đèn) — src/data/craftFilms.js */}
      <section id="films" className="films">
        <CraftFilms />
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
              <PhoneVideo title={t('qr.phoneCaption')} playLabel={t('qr.videoPlay')} pauseLabel={t('qr.videoPause')} />
              <p className="phone-caption">{t('qr.phoneCaption')}</p>
              <div className="phone-message">
                <span className="phone-message-label">{t('qr.phoneFrom')}</span>
                <p>{t('qr.phoneMessage')}</p>
              </div>
            </div>
          </m.div>
          {/* Mây chỉ đường quét QR (trang trí, không cần đọc cho trình đọc màn hình) */}
          <span className="phone-may" aria-hidden="true">
            <MayAvatar pose="qr" size={150} />
          </span>
        </Reveal>
      </section>

      {/* Feedback 08/10 mục 14: gỡ đánh giá khi chưa có khách thật; sẽ lấy từ đơn đã giao ('Đã mua hàng') */}

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
