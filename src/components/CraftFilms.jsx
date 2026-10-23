import { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { useAutoplayInView } from '../lib/useAutoplayInView.js'
import { useI18n } from '../i18n/index.js'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { rise, group } from '../lib/motion.js'
import { Reveal } from './Reveal'
import { Lotus } from './Motifs'

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
          <Lotus />
          {t('films.eyebrow')}
          <Lotus />
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
