import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'

export default function NotFoundPage() {
  const { t, path } = useI18n()
  return (
    <section className="page-section narrow">
      <h1 className="page-title">{t('notFound.title')}</h1>
      <Link to={path('/')} className="btn btn-primary">
        {t('notFound.back')}
      </Link>
    </section>
  )
}
