import ShippingNote from '../components/ShippingNote.jsx'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProductCards from '../components/ProductCards'
import ProductImage from '../components/ProductImage.jsx'
import { Lotus, Seal } from '../components/Motifs'
import Price from '../components/Price'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import Seo from '../seo/Seo.jsx'
import AddToCart from '../cart/AddToCart.jsx'
import QuantityInput from '../cart/QuantityInput.jsx'
import { breadcrumbJsonLd, productJsonLd } from '../seo/head.js'
import { useSiteUrl } from '../seo/context.js'
import { track } from '../analytics/index.js'

// Feedback 08/10, mục 9: thanh mua cố định ở đáy (chỉ mobile qua CSS), hiện khi nút chính ra khỏi màn hình
function StickyBuy({ product, quantity }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const target = document.querySelector('.pdp-buy .product-buy')
    if (!target || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting))
    io.observe(target)
    return () => io.disconnect()
  }, [])
  if (!show) return null
  return (
    <div className="sticky-buy" role="region" aria-label={product.name}>
      <span>
        <strong>{product.name}</strong>
        <Price amount={product.price} className="product-price" />
      </span>
      <AddToCart slug={product.slug} quantity={quantity} className="btn btn-primary" soldOut={product.inStock === false} />
    </div>
  )
}

// FR-GA-001 §23.3: view_item. Component riêng để hook không nằm sau nhánh return sớm ở trên.
function TrackViewItem({ slug, name, price }) {
  useEffect(() => {
    track('view_item', { item_id: slug, item_name: name, value: price, currency: 'VND' })
  }, [slug, name, price])
  return null
}

// Các đèn khác để khách xem tiếp, cùng thẻ với trang Cửa hàng (D-87)
function Related({ slug }) {
  const { t, lang, path } = useI18n()
  const res = useApi('/products', lang)
  const items = res.status === 'ok' ? res.data.items.filter((p) => p.slug !== slug) : []
  if (items.length === 0) return null
  return (
    <section className="pdp-related" aria-labelledby="pdp-related-title">
      <div className="pdp-related-head">
        <h2 id="pdp-related-title">{t('pdp.related')}</h2>
        <Link to={path('/shop')} className="btn btn-ghost btn-small">
          {t('pdp.viewAll')} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ProductCards items={items} />
    </section>
  )
}

// FR-CAT-001: chi tiết sản phẩm — cùng phong cách với trang Cửa hàng (D-87)
export default function ProductPage() {
  const { slug } = useParams()
  const { t, lang, path } = useI18n()
  const res = useApi(`/products/${encodeURIComponent(slug)}`, lang)
  const siteUrl = useSiteUrl()
  const pagePath = `/products/${encodeURIComponent(slug)}`
  const [qty, setQty] = useState(1)
  const back = (
    <Link to={path('/shop')} className="back-link">
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
    <section className="page-section product-detail pdp">
      <Seo
        title={t('meta.productTitle', { name: p.name })}
        description={p.description ?? t('meta.description')}
        path={pagePath}
        type="product"
        image={p.image?.url}
        jsonLd={[
          productJsonLd(p, `${siteUrl}${path(pagePath)}`, siteUrl),
          breadcrumbJsonLd(siteUrl, lang, [
            { name: t('nav.home'), path: '/' },
            { name: t('nav.shop'), path: '/shop' },
            { name: p.name, path: pagePath },
          ]),
        ]}
      />
      <TrackViewItem slug={p.slug} name={p.name} price={p.price} />
      {back}
      <div className="pdp-grid">
        <div className={`pdp-art tone-${p.tone}`}>
          {p.badge && <Seal className="product-badge">{p.badge}</Seal>}
          <div className="pdp-art-stage">
            <ProductImage image={p.image} size={300} tone={p.tone} name={p.name} priority swing />
          </div>
        </div>
        <div className="pdp-buy">
          <p className="eyebrow">
            <Lotus /> {p.kind === 'set' ? t('products.setBadge') : t('shop.filters.single')}
          </p>
          <h1 className="page-title">{p.name}</h1>
          <Price amount={p.price} className="product-price large" />
          <p className="pdp-desc">{p.description}</p>
          {p.stockLeft != null && <p className="stock-left">{t('cart.lowStock', { n: p.stockLeft })}</p>}
          {/* FR-CART-001 */}
          <div className="product-buy">
            <QuantityInput value={qty} onChange={setQty} />
            <AddToCart slug={p.slug} quantity={qty} className="btn btn-primary" soldOut={p.inStock === false} />
          </div>
          <ShippingNote className="pdp-note" />
          <p className="pdp-note">{t('pdp.checkoutNote')}</p>
          <ul className="shop-perks pdp-perks">
            {t('shop.perks').map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
      <StickyBuy product={p} quantity={qty} />
      <Related slug={p.slug} />
    </section>
  )
}
