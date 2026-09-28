import { useI18n } from '../i18n/index.js'

export default function Marquee() {
  const { t } = useI18n()
  const line = t('marquee').join('  ✦  ') + '  ✦  '
  return (
    <div className="marquee">
      <div className="marquee-track">
        <span>{line}</span>
        <span aria-hidden="true">{line}</span>
      </div>
    </div>
  )
}
