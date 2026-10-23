import { useEffect, useRef } from 'react'
import { m } from 'framer-motion'
import { useHydratedReducedMotion } from '../lib/hydration.js'
import { useI18n } from '../i18n/index.js'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { rise, group } from '../lib/motion.js'
import { Reveal } from './Reveal'
import { Lotus } from './Motifs'

// Video tự host, `preload="none"`: lúc vào trang chỉ tải poster. Cuộn tới (≥ 50% khung trong màn hình) thì
// tự phát **không tiếng** (trình duyệt chỉ cho tự phát khi tắt tiếng), cuộn qua thì dừng. Người xem bấm dừng
// thì không tự phát lại cho tới khi họ bấm phát; bật tiếng thì giữ nguyên. Giảm chuyển động → không tự phát.
export function CraftVideo({ film, title, className = '' }) {
  const ref = useRef(null)
  const reduce = useHydratedReducedMotion()

  useEffect(() => {
    const video = ref.current
    if (!video || reduce || typeof IntersectionObserver === 'undefined') return
    let userPaused = false
    let autoPausing = false
    let userUnmuted = false
    const onPause = () => {
      if (autoPausing) autoPausing = false
      else userPaused = true
    }
    const onPlay = () => {
      userPaused = false
    }
    const onVolume = () => {
      if (!video.muted) userUnmuted = true
    }
    video.addEventListener('pause', onPause)
    video.addEventListener('play', onPlay)
    video.addEventListener('volumechange', onVolume)
    const io = new IntersectionObserver(
      (entries) => {
        // Cuộn nhanh có thể dồn nhiều entry (vào rồi ra) trong một lần gọi → lấy entry mới nhất
        const entry = entries[entries.length - 1]
        if (entry.isIntersecting) {
          if (userPaused || !video.paused) return
          // Người xem đã bật tiếng thì giữ tiếng (họ đã tương tác nên trình duyệt cho phát có tiếng)
          if (!userUnmuted) video.muted = true
          video.play()?.catch(() => {})
        } else if (!video.paused) {
          autoPausing = true
          video.pause()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(video)
    return () => {
      io.disconnect()
      video.removeEventListener('pause', onPause)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('volumechange', onVolume)
    }
  }, [reduce])

  return (
    <div className={`film-frame ${className}`.trim()}>
      <video ref={ref} controls preload="none" playsInline loop poster={film.poster} aria-label={title}>
        <source src={film.src} type="video/mp4" />
      </video>
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
