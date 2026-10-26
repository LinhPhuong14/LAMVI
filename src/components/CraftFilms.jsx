import { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { useAutoplayInView } from '../lib/useAutoplayInView.js'
import { useHydratedReducedMotion } from '../lib/hydration.js'
import { useI18n } from '../i18n/index.js'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { rise, group } from '../lib/motion.js'
import { Reveal } from './Reveal'

// Video tự host, `preload="none"`: lúc vào trang chỉ tải poster; tự phát khi cuộn tới (useAutoplayInView)
export function CraftVideo({ film, title, className = '' }) {
  const ref = useRef(null)
  useAutoplayInView(ref)

  return (
    <div className={`film-frame ${className}`.trim()}>
      <video ref={ref} controls preload="none" playsInline loop poster={film.poster} aria-label={title}>
        <source src={film.src} type="video/mp4" />
      </video>
    </div>
  )
}

// Khung điện thoại ở mục QR: clip ngắn "hành trình mẻ đèn" ghép từ hai video làng nghề, không tiếng, phát lặp.
// Không có thanh điều khiển của trình duyệt (khung quá nhỏ) → nút phát/dừng riêng (WCAG 2.2.2: dừng được chuyển động).
export function PhoneVideo({ title, playLabel, pauseLabel }) {
  const ref = useRef(null)
  const [paused, setPaused] = useState(true)
  useAutoplayInView(ref)
  // Không dùng prop `muted`: React render thuộc tính khác nhau ở SSR và client → lệch hydrate
  useEffect(() => {
    if (ref.current) ref.current.muted = true
  }, [])

  const toggle = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) {
      video.muted = true
      // Tệp tải lỗi: trình duyệt có thể đã bắn `play` trước khi promise bị từ chối → dừng để nút về "Phát"
      video.play()?.catch(() => video.pause())
    } else video.pause()
  }

  return (
    <div className={`phone-video${paused ? '' : ' is-playing'}`}>
      <video
        ref={ref}
        playsInline
        loop
        preload="none"
        poster={CRAFT_FILMS.journey.poster}
        aria-label={title}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      >
        <source src={CRAFT_FILMS.journey.src} type="video/mp4" />
      </video>
      <button type="button" className="phone-video-toggle" onClick={toggle} aria-label={paused ? playLabel : pauseLabel}>
        {paused && <span className="play-glow" aria-hidden="true" />}
        <span className="play-icon" aria-hidden="true">
          {paused ? '▶' : '❚❚'}
        </span>
      </button>
    </div>
  )
}

// Mục #films: video làng giấy dó — công đoạn đầu của chiếc đèn
export default function CraftFilms() {
  const { t } = useI18n()

  return (
    <Reveal className="films-inner" variants={group}>
      <m.div className="section-head" variants={group}>
        <m.span className="eyebrow" variants={rise}>
          {t('films.eyebrow')}
        </m.span>
        <m.h2 variants={rise}>{t('films.title')}</m.h2>
        <m.p className="intent-copy" variants={rise}>
          {t('films.intro')}
        </m.p>
      </m.div>
      <m.figure className="film-card" variants={rise}>
        <CraftVideo film={CRAFT_FILMS.paper} title={t('films.paperTitle')} />
        <figcaption>
          <strong>{t('films.paperTitle')}</strong>
          <span>{t('films.paperNote')}</span>
        </figcaption>
      </m.figure>
    </Reveal>
  )
}

// Màn hình đầu trang chủ: video giới thiệu toàn khung hình (khách quét QR vào thấy ngay).
// Tự phát không tiếng, lặp; poster hiện ngay từ HTML server. Giảm chuyển động → không tự phát (WCAG 2.2.2), có nút phát/dừng và bật/tắt tiếng.
export function IntroFilm({ ctaHref }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const reduce = useHydratedReducedMotion()
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const film = CRAFT_FILMS.paper

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true // React không phản ánh thuộc tính muted khi SSR → đặt lại để trình duyệt cho tự phát
    if (reduce) video.pause()
    else video.play()?.catch(() => setPaused(true))
  }, [reduce])

  const togglePlay = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) video.play()?.catch(() => {})
    else video.pause()
  }
  const toggleSound = () => {
    const video = ref.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
    if (!video.muted && video.paused) togglePlay()
  }

  return (
    <section className="intro-film" aria-label={t('intro.label')}>
      <video
        ref={ref}
        className="intro-film-video"
        autoPlay
        muted
        suppressHydrationWarning
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        loop
        playsInline
        preload="metadata"
        poster={film.poster}
        aria-label={t('intro.label')}
      >
        <source src={film.src} type="video/mp4" />
      </video>
      <div className="intro-film-shade" aria-hidden="true" />
      <div className="intro-film-copy">
        <p className="intro-film-brand">LAMVI</p>
        <p className="intro-film-slogan">
          {t('intro.slogan1')} <em>{t('intro.slogan2')}</em>
        </p>
        <a className="btn btn-primary" href={ctaHref}>
          {t('intro.cta')} <span aria-hidden="true">↓</span>
        </a>
      </div>
      <div className="intro-film-controls">
        <button type="button" onClick={togglePlay} aria-label={paused ? t('intro.play') : t('intro.pause')}>
          {paused ? '▶' : '❚❚'}
        </button>
        <button type="button" onClick={toggleSound} aria-label={muted ? t('intro.soundOn') : t('intro.soundOff')}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </section>
  )
}
