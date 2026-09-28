import { Link, useParams } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import Seo from '../seo/Seo.jsx'

// FR-QR-006, US-005: trang QR khắc trên đèn — public, video của lô (D-01, D-10, D-43), noindex (D-44)
export default function BatchPage() {
  const { code } = useParams()
  const { t, lang, path } = useI18n()
  const res = useApi(`/batches/${encodeURIComponent(code)}`, lang)

  if (res.status === 'loading') {
    return (
      <section className="page-section">
        <Seo title={t('batch.eyebrow')} noindex />
        {t('batch.loading')}
      </section>
    )
  }

  if (res.status === 'error') {
    const notFound = res.error.status === 404
    return (
      <section className="page-section narrow">
        <Seo title={notFound ? t('batch.notFoundTitle') : t('batch.errorTitle')} noindex status={notFound ? 404 : 500} />
        <h1 className="page-title">{notFound ? t('batch.notFoundTitle') : t('batch.errorTitle')}</h1>
        <p>{notFound ? t('batch.notFoundText') : t(`errors.${res.error.code}`)}</p>
        <Link to={path('/')} className="btn btn-primary" style={{ marginTop: 24 }}>
          {t('batch.toHome')}
        </Link>
      </section>
    )
  }

  const b = res.data.item
  const date = b.producedOn
    ? // producedOn là ngày (YYYY-MM-DD) — định dạng theo UTC để không lệch ngày theo múi giờ người xem
      new Intl.DateTimeFormat(lang === 'zh' ? 'zh-Hans' : lang, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(`${b.producedOn}T00:00:00Z`),
      )
    : null

  return (
    <section className="page-section batch">
      {/* D-44: trang lô noindex */}
      <Seo title={b.title ?? t('batch.eyebrow')} description={t('batch.note')} noindex />
      <span className="eyebrow">{t('batch.eyebrow')}</span>
      <h1 className="page-title">{b.title ?? t('batch.eyebrow')}</h1>
      <div className="batch-meta">
        <span>{t('batch.code', { code: b.code })}</span>
        {date && <span>{t('batch.producedOn', { date })}</span>}
      </div>
      <video className="batch-video" src={b.videoUrl} controls playsInline preload="metadata">
        {t('batch.videoFallback')}
      </video>
      {b.story && <p className="story-text">{b.story}</p>}
      <p className="notice">{t('batch.note')}</p>
      <Link to={path('/')} className="btn btn-ghost" style={{ marginTop: 24 }}>
        {t('batch.toHome')}
      </Link>
    </section>
  )
}
