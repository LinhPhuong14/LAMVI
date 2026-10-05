import { Link } from 'react-router-dom'
import Lantern from '../components/Lantern'
import ProductImage from '../components/ProductImage'
import { useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import Quilt from './Quilt.jsx'

const fmtDate = (iso, lang) =>
  iso ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-Hans' : lang, { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso)) : ''

// D-97: tab Gallery — đèn của tôi (đơn đã giao) + chăn Đông Hồ
export default function GalleryPanel({ state }) {
  const { t, lang, path } = useI18n()
  const { user } = useAuth()

  if (state.status === 'loading') return <p>{t('account.gallery.loading')}</p>
  if (state.status === 'error') {
    return (
      <p className="notice error" role="alert">
        {t(`errors.${state.error}`)}
      </p>
    )
  }
  const g = state.data
  const colName = new Map(g.collections.map((c) => [c.slug, c.name]))
  return (
    <div className="gallery">
      {g.collections.length > 0 && <Quilt gallery={g} userId={user?.id} />}

      <section aria-labelledby="gallery-lamps-title" className="gallery-lamps">
        <h3 id="gallery-lamps-title">{t('account.gallery.lampsTitle')}</h3>
        {g.lamps.length === 0 ? (
          <div className="gallery-empty">
            <Lantern size={88} tone="dusk" swing />
            <div>
              <p>{t('account.gallery.empty')}</p>
              <Link to={path('/shop')} className="btn btn-ghost btn-compact">
                {t('cart.continue')}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="gallery-grid">
            {g.lamps.map((l) => (
              <li key={l.slug} className={`gallery-card tone-${l.tone ?? 'amber'}`}>
                <div className="gallery-art">
                  <ProductImage image={l.image} size={88} tone={l.tone} name={l.name} swing />
                </div>
                <h4>{l.name}</h4>
                {l.collection && colName.get(l.collection) && <p className="gallery-col">{colName.get(l.collection)}</p>}
                <p className="gallery-date">{t('account.gallery.received', { date: fmtDate(l.receivedAt, lang) })}</p>
                <div className="gallery-actions">
                  {l.batch && (
                    <Link to={l.batch.path} className="btn btn-ghost btn-small">
                      {t('account.gallery.batchVideo')}
                    </Link>
                  )}
                  {l.greeting?.path && (
                    <Link to={l.greeting.path} className="btn btn-ghost btn-small">
                      {t('account.gallery.greeting')}
                    </Link>
                  )}
                  {l.greeting && !l.greeting.path && <span className="gallery-tag">{t('account.gallery.greetingSent')}</span>}
                  <Link to={path(`/don-hang/${l.orderCode}`)} className="btn btn-ghost btn-small">
                    {t('account.gallery.order')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
