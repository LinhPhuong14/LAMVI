import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import Seo from '../seo/Seo.jsx'

// G-10: trang chính sách riêng tư / đổi trả. Nội dung nằm ở i18n (policy.<kind>.*)
export default function PolicyPage({ kind }) {
  const { t, path } = useI18n()
  const sections = t(`policy.${kind}.sections`)
  return (
    <section className="page-section medium policy-page">
      <Seo title={t(`policy.${kind}.title`)} description={t(`policy.${kind}.description`)} path={`/${kind}`} />
      <h1 className="page-title">{t(`policy.${kind}.title`)}</h1>
      <p className="policy-updated">{t('policy.updated')}</p>
      <p className="policy-intro">{t(`policy.${kind}.intro`)}</p>
      {Array.isArray(sections) &&
        sections.map((s) => (
          <section key={s.h} className="policy-block">
            <h2>{s.h}</h2>
            <ul>
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </section>
        ))}
      <Link to={path('/')} className="btn btn-primary">
        {t('policy.back')}
      </Link>
    </section>
  )
}
