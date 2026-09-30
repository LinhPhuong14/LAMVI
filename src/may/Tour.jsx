import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import MayAvatar from './MayAvatar.jsx'

// FR-AI-002, §22.3: tour trên trang chủ — chỉ cuộn, làm nổi bật; không thao tác dữ liệu
const TOUR_TARGETS = ['.hero', '#products', '#qr', '#faq', '.may-fab']

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Tour({ onClose }) {
  const { t } = useI18n()
  const steps = t('may.tour.steps')
  const [i, setI] = useState(0)

  useEffect(() => {
    const el = document.querySelector(TOUR_TARGETS[i])
    if (!el) return
    el.classList.add('tour-highlight')
    // NFR-A11Y-001
    el.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
    return () => el.classList.remove('tour-highlight')
  }, [i])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const last = i === steps.length - 1
  return (
    <div className="tour-pop" role="dialog" aria-label={t('may.tour.label')}>
      <MayAvatar size={44} />
      <div className="tour-body">
        <small>{t('may.tour.step', { n: i + 1, total: steps.length })}</small>
        <p>{steps[i]}</p>
        <div className="tour-actions">
          <button type="button" className="btn btn-small btn-ghost" onClick={() => onClose(false)}>
            {t('may.tour.skip')}
          </button>
          {i > 0 && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setI(i - 1)}>
              {t('may.tour.prev')}
            </button>
          )}
          <button type="button" className="btn btn-small" onClick={() => (last ? onClose(true) : setI(i + 1))}>
            {last ? t('may.tour.done') : t('may.tour.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
