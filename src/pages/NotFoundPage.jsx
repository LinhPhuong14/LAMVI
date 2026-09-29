import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import Seo from '../seo/Seo.jsx'
import Scene from '../components/Scene'

export default function NotFoundPage() {
  const { t, path } = useI18n()
  return (
    // Khung trời đêm đầy sao, đèn trời bay lên (ảnh thật CC0)
    <section className="page-section notfound-night has-motifs">
      <Scene name="notFound" />
      <Seo title={t('notFound.title')} noindex status={404} />
      <h1 className="page-title">{t('notFound.title')}</h1>
      <Link to={path('/')} className="btn btn-primary">
        {t('notFound.back')}
      </Link>
    </section>
  )
}
