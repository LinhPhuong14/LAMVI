import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import Seo from '../seo/Seo.jsx'
import { useApi } from '../api/useApi.js'

export default function NotFoundPage() {
  const { t, path, lang } = useI18n()
  const site = useApi('/site', lang)
  const phone = site.status === 'ok' ? site.data.phone : ''
  return (
    // Khung nâu đậm với chữ số 404 cỡ lớn (D-122)
    <section className="page-section notfound-night">
      <Seo title={t('notFound.title')} noindex status={404} />
      <h1 className="page-title">{t('notFound.title')}</h1>
      <Link to={path('/')} className="btn btn-primary">
        {t('notFound.back')}
      </Link>
      <p className="notfound-contact">
        <Link to={path('/contact')}>{t('notFound.contact')}</Link>
        {phone && (
          <>
            {' · '}
            <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>{phone}</a>
          </>
        )}
      </p>
    </section>
  )
}
