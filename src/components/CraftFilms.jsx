import { m } from 'framer-motion'
import { useI18n } from '../i18n/index.js'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { rise, group } from '../lib/motion.js'
import { Reveal } from './Reveal'
import { Lotus } from './Motifs'

// Video tự host: `preload="none"` → trang chủ chỉ tải ảnh poster, video tải khi người xem bấm phát
export function CraftVideo({ film, title, className = '' }) {
  return (
    <div className={`film-frame ${className}`.trim()}>
      <video controls preload="none" playsInline poster={film.poster} aria-label={title}>
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
