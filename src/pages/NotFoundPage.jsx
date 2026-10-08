import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import Seo from '../seo/Seo.jsx'
import Scene from '../components/Scene'
import { useApi } from '../api/useApi.js'

export default function NotFoundPage() {
  const { t, path, lang } = useI18n()
  const site = useApi('/site', lang)
  const phone = site.status === 'ok' ? site.data.phone : ''
  return (
    // Khung trời đêm đầy sao, đèn trời bay lên (ảnh thật CC0)
    <section className="page-section notfound-night has-motifs">
      <Scene name="notFound" />
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
