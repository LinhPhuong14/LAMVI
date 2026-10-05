import { Link } from 'react-router-dom'
import { Seal } from './Motifs'
import Price from './Price'
import ProductImage from './ProductImage'
import { useI18n } from '../i18n/index.js'

// Thẻ bộ sưu tập (D-96): lớn, hàng đèn xếp cạnh nhau, khác với thẻ đèn lẻ (ProductCards).
export default function CollectionCard({ collection: c, index = 0 }) {
  const { t, path } = useI18n()
  return (
    <article className={`collection-card tone-${c.tone ?? 'amber'}`} data-index={index}>
      <div className="collection-lamps" aria-hidden="true">
        {c.lamps.slice(0, 5).map((l, i) => (
          <span key={l.slug} className="collection-lamp" style={{ '--i': i }}>
            <ProductImage image={l.image} size={72} tone={l.tone} name="" />
          </span>
        ))}
      </div>
      <div className="collection-body">
        <Seal className="collection-count">{t('collection.count', { n: c.lamps.length })}</Seal>
        <h3>
          <Link to={path(`/collections/${c.slug}`)} className="product-link">
            {c.name}
          </Link>
        </h3>
        <p className="product-desc">{c.description}</p>
        <ul className="collection-names">
          {c.lamps.map((l) => (
            <li key={l.slug}>{l.name}</li>
          ))}
        </ul>
        <div className="collection-foot">
          {c.set && (
            <span className="collection-setprice">
              {t('collection.wholeSet')} <Price amount={c.set.price} />
            </span>
          )}
          <Link to={path(`/collections/${c.slug}`)} className="btn btn-primary btn-small">
            {t('collection.view')}
          </Link>
        </div>
      </div>
    </article>
  )
}
