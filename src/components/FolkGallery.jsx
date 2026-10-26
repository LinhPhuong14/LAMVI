import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { useHydratedReducedMotion } from '../lib/hydration.js'
import { FOLK_ART, folkSrc } from '../data/folkArt.js'

/**
 * Phòng tranh: tranh Đông Hồ và tranh giấy dó thật (ảnh tư liệu, phạm vi công cộng/CC0).
 * D-124: không còn dải cuộn ngang. Một tranh lớn ở sân khấu, hàng ảnh nhỏ bên dưới; tự chuyển tranh mỗi ~4,5 giây,
 * dừng khi rê chuột/focus vào khu vực này; rê vào ảnh nhỏ thì tranh đó lên sân khấu. Giảm chuyển động → không tự chuyển.
 */
const INTERVAL = 4500

function Stage({ art, t }) {
  const widest = art.widths[art.widths.length - 1]
  return (
    <figure className="folk-feature" key={art.id}>
      <div className="folk-print-frame">
        <img
          src={folkSrc(art.id, widest)}
          width={art.width}
          height={art.height}
          alt={t(`gallery.items.${art.id}.alt`)}
          decoding="async"
        />
      </div>
      <figcaption>
        <span className="folk-print-name">{t(`gallery.items.${art.id}.name`)}</span>
        <span className="folk-print-meta">{t(`gallery.items.${art.id}.meta`)}</span>
        <a className="folk-print-source" href={art.source} target="_blank" rel="noopener noreferrer">
          {art.license} · {t('gallery.source')}
        </a>
      </figcaption>
    </figure>
  )
}

export default function FolkGallery() {
  const { t } = useI18n()
  const reduce = useHydratedReducedMotion()
  const [active, setActive] = useState(0)
  const [hold, setHold] = useState(false)
  const root = useRef(null)
  const visible = useRef(false)

  useEffect(() => {
    const el = root.current
    if (!el || reduce || hold || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    const timer = setInterval(() => {
      if (visible.current && !document.hidden) setActive((i) => (i + 1) % FOLK_ART.length)
    }, INTERVAL)
    return () => {
      io.disconnect()
      clearInterval(timer)
    }
  }, [reduce, hold, active])

  const art = FOLK_ART[active]
  return (
    <div
      className="folk-gallery"
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label={t('gallery.label')}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div className="folk-stage" aria-live="off">
        <Stage art={art} t={t} />
      </div>
      <ul className="folk-thumbs">
        {FOLK_ART.map((a, i) => (
          <li key={a.id}>
            <button
              type="button"
              className={`folk-thumb${i === active ? ' is-on' : ''}${i === active && !hold && !reduce ? ' is-running' : ''}`}
              aria-label={t(`gallery.items.${a.id}.name`)}
              aria-current={i === active}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              style={{ '--dur': `${INTERVAL}ms` }}
            >
              <img src={folkSrc(a.id, a.widths[0])} alt="" width={a.width} height={a.height} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      <p className="folk-gallery-note">{t('gallery.note')}</p>
    </div>
  )
}
