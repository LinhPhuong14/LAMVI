import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Lantern from '../components/Lantern'
import Price from '../components/Price'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import Seo from '../seo/Seo.jsx'
import AddToCart from '../cart/AddToCart.jsx'
import QuantityInput from '../cart/QuantityInput.jsx'
import { breadcrumbJsonLd, productJsonLd } from '../seo/head.js'
import { useSiteUrl } from '../seo/context.js'
import { track } from '../analytics/index.js'

// FR-GA-001 §23.3: view_item. Component riêng để hook không nằm sau nhánh return sớm ở trên.
function TrackViewItem({ slug, name, price }) {
  useEffect(() => {
    track('view_item', { item_id: slug, item_name: name, value: price, currency: 'VND' })
  }, [slug, name, price])
  return null
}

// FR-CAT-001: chi tiết sản phẩm
export default function ProductPage() {
  const { slug } = useParams()
  const { t, lang, path } = useI18n()
  const res = useApi(`/products/${encodeURIComponent(slug)}`, lang)
  const siteUrl = useSiteUrl()
  const pagePath = `/products/${encodeURIComponent(slug)}`
  const [qty, setQty] = useState(1)
  const back = (
    <Link to={{ pathname: path('/'), hash: '#products' }} className="back-link">
      {t('products.backToCollection')}
    </Link>
  )

  if (res.status === 'loading') return <section className="page-section">{t('products.loading')}</section>
  if (res.status === 'error') {
    const notFound = res.error.status === 404
    return (
      <section className="page-section">
        <Seo
          title={notFound ? t('products.notFound') : t('products.error')}
          noindex
          status={notFound ? 404 : 500}
        />
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
      <Seo
        title={t('meta.productTitle', { name: p.name })}
        description={p.description ?? t('meta.description')}
        path={pagePath}
        type="product"
        jsonLd={[
          productJsonLd(p, `${siteUrl}${path(pagePath)}`),
          breadcrumbJsonLd(siteUrl, lang, [
            { name: t('nav.home'), path: '/' },
            { name: p.name, path: pagePath },
          ]),
        ]}
      />
      <TrackViewItem slug={p.slug} name={p.name} price={p.price} />
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
          <Price amount={p.price} className="product-price large" />
          {/* FR-CART-001 */}
          <div className="product-buy">
            <QuantityInput value={qty} onChange={setQty} />
            <AddToCart slug={p.slug} quantity={qty} className="btn btn-primary" />
          </div>
        </div>
      </div>
    </section>
  )
}
