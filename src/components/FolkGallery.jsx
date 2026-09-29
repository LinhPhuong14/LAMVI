import { m } from 'framer-motion'
import { useI18n } from '../i18n/index.js'
import { FOLK_ART, folkSrc } from '../data/folkArt.js'
import { Reveal } from './Reveal'
import { group, stamp } from '../lib/motion.js'

/**
 * Phòng tranh: tranh Đông Hồ và tranh giấy dó thật (ảnh tư liệu, phạm vi công cộng/CC0).
 * Mỗi tranh treo trong khung tranh bồi, có tên và nguồn ngay dưới — không trình bày như ảnh sản phẩm.
 */
// Tranh hiển thị theo chiều cao cố định (CSS .folk-print img) → bề rộng thật = cao × tỉ lệ khung
const displaySizes = (art) => {
  const w = (h) => `${Math.ceil((h * art.width) / art.height)}px`
  return `(max-width: 640px) ${w(200)}, ${w(250)}`
}

export default function FolkGallery() {
  const { t } = useI18n()
  return (
    <div className="folk-gallery">
      <Reveal className="folk-gallery-track" variants={group} margin="-6% 0px -6% 0px" role="list" aria-label={t('gallery.label')} tabIndex={0}>
        {FOLK_ART.map((art, i) => (
          <m.figure className="folk-print" key={art.id} role="listitem" variants={stamp} custom={i}>
            <div className="folk-print-frame">
              <img
                src={folkSrc(art.id, art.widths[0])}
                srcSet={art.widths.map((w) => `${folkSrc(art.id, w)} ${w}w`).join(', ')}
                sizes={displaySizes(art)}
                width={art.width}
                height={art.height}
                alt={t(`gallery.items.${art.id}.alt`)}
                loading="lazy"
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
          </m.figure>
        ))}
      </Reveal>
      <p className="folk-gallery-note">{t('gallery.note')}</p>
    </div>
  )
}
