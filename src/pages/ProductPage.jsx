import { Link, useParams } from 'react-router-dom'
import Lantern from '../components/Lantern'
import Price from '../components/Price'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'

// FR-CAT-001: chi tiết sản phẩm
export default function ProductPage() {
  const { slug } = useParams()
  const { t, lang, path } = useI18n()
  const res = useApi(`/products/${encodeURIComponent(slug)}`, lang)
  const back = (
    <Link to={{ pathname: path('/'), hash: '#products' }} className="back-link">
      {t('products.backToCollection')}
    </Link>
  )

  if (res.status === 'loading') return <section className="page-section">{t('products.loading')}</section>
  if (res.status === 'error') {
    return (
      <section className="page-section">
        {back}
        <h1 className="page-title">
          {res.error.status === 404 ? t('products.notFound') : t('products.error')}
        </h1>
      </section>
    )
  }

  const p = res.data.item
  return (
    <section className="page-section product-detail">
      {back}
      <div className="product-detail-grid">
        <div className="product-detail-art">
          <Lantern size={220} tone={p.tone} />
        </div>
        <div className="product-detail-copy">
          {p.kind === 'set' && <span className="eyebrow">{t('products.setBadge')}</span>}
          {p.badge && <span className="product-badge static">{p.badge}</span>}
          <h1 className="page-title">{p.name}</h1>
          <p className="product-detail-desc">{p.description}</p>
          <Price amount={p.priceExclVat} className="product-price large" />
          {/* G-02/G-03: giỏ hàng và checkout chưa có (Q-13) */}
          <p className="notice">{t('products.orderingSoon')}</p>
        </div>
      </div>
    </section>
  )
}
