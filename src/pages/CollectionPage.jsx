import { Link, useParams } from 'react-router-dom'
import { Lotus } from '../components/Motifs'
import Price from '../components/Price'
import ProductImage from '../components/ProductImage'
import AddToCart from '../cart/AddToCart.jsx'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import Seo from '../seo/Seo.jsx'
import { breadcrumbJsonLd } from '../seo/head.js'
import { useSiteUrl } from '../seo/context.js'

// D-96: trang một bộ sưu tập — mua cả bộ hoặc chọn mua từng đèn lẻ trong bộ
export default function CollectionPage() {
  const { slug } = useParams()
  const { t, lang, path } = useI18n()
  const siteUrl = useSiteUrl()
  const res = useApi(`/collections/${encodeURIComponent(slug)}`, lang)
  const back = (
    <Link to={path('/shop')} className="back-link">
      ← {t('nav.shop')}
    </Link>
  )

  if (res.status === 'loading') {
    return (
      <section className="page-section">
        {back}
        <p className="products-status">{t('products.loading')}</p>
      </section>
    )
  }
  if (res.status === 'error') {
    const nf = res.error.status === 404
    return (
      <section className="page-section">
        <Seo title={nf ? t('collection.notFound') : t('products.error')} noindex status={nf ? 404 : res.error.status >= 500 ? res.error.status : 500} />
        {back}
        <h1 className="page-title">{nf ? t('collection.notFound') : t('products.error')}</h1>
      </section>
    )
  }

  const c = res.data.item
  const lowest = c.lamps.length ? Math.min(...c.lamps.map((l) => l.price)) : null
  const pagePath = `/collections/${c.slug}`
  return (
    <section className={`page-section collection-page tone-${c.tone ?? 'amber'}`}>
      <Seo
        title={t('collection.metaTitle', { name: c.name })}
        description={c.description ?? t('meta.description')}
        path={pagePath}
        jsonLd={[
          breadcrumbJsonLd(siteUrl, lang, [
            { name: t('nav.home'), path: '/' },
            { name: t('nav.shop'), path: '/shop' },
            { name: c.name, path: pagePath },
          ]),
        ]}
      />
      {back}
      {/* Sân khấu: tên bộ + hàng đèn đã tách nền đứng trên kệ gỗ, mỗi đèn một quầng sáng (D-108) */}
      <header className="cp-stage">
        <div className="cp-stage-copy">
          <p className="eyebrow">
            <Lotus /> {t('collection.eyebrow')}
          </p>
          <h1 className="page-title">{c.name}</h1>
          <p className="shop-lead">{c.description}</p>
          <ul className="cp-chips">
            <li>{t('collection.count', { n: c.lamps.length })}</li>
            {lowest != null && (
              <li>
                {t('collection.from')} <Price amount={lowest} />
              </li>
            )}
          </ul>
          <a href="#chon-den" className="btn btn-primary">
            {t('collection.choose')}
          </a>
        </div>
        <ul className="cp-lineup" aria-hidden="true">
          {c.lamps.map((l, i) => (
            <li key={l.slug} style={{ '--i': i }}>
              <Link to={path(`/products/${l.slug}`)} tabIndex={-1} className="cp-lamp">
                <span className="cp-halo" />
                <ProductImage image={l.image} size={150} tone={l.tone} name="" cutout />
                <span className="cp-lamp-name">{l.name.replace(/^Đèn\s+/, '')}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="cp-shelf" aria-hidden="true" />
      </header>

      {c.set && (
        <div className="collection-set">
          <div className="collection-set-art">
            <ProductImage image={c.set.image} size={96} tone={c.set.tone} name={c.set.name} />
          </div>
          <div className="collection-set-body">
            <h2>{c.set.name}</h2>
            <p>{c.set.description}</p>
            <p className="collection-set-note">{t('collection.setNote')}</p>
          </div>
          <div className="collection-set-buy">
            <Price amount={c.set.price} className="product-price large" />
            <AddToCart slug={c.set.slug} className="btn btn-primary" label={t('collection.addSet')} soldOut={c.set.inStock === false} />
          </div>
        </div>
      )}

      <h2 className="collection-sub" id="chon-den">
        {t('collection.pickSingle', { n: c.lamps.length })}
      </h2>
      <div className="cp-rows">
        {c.lamps.map((l, i) => (
          <article key={l.slug} className={`cp-row tone-${l.tone ?? 'amber'}${i % 2 ? ' is-flip' : ''}`}>
            {/* Ảnh phủ kín khung; tên đèn đã có ở tiêu đề nên liên kết ảnh bị ẩn khỏi trình đọc màn hình */}
            <Link to={path(`/products/${l.slug}`)} className="cp-photo" tabIndex={-1} aria-hidden="true">
              <ProductImage image={l.image} size={300} tone={l.tone} name="" fill />
            </Link>
            <div className="cp-info">
              <span className="cp-index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>
                <Link to={path(`/products/${l.slug}`)} className="product-link">
                  {l.name}
                </Link>
              </h3>
              <p className="cp-desc">{l.description}</p>
              {l.specs?.size && <p className="cp-spec">{l.specs.size}</p>}
              {l.stockLeft != null && <p className="stock-left">{t('cart.lowStock', { n: l.stockLeft })}</p>}
              <div className="cp-buy">
                <Price amount={l.price} className="product-price large" />
                <AddToCart slug={l.slug} className="btn btn-primary" soldOut={l.inStock === false} />
                <Link to={path(`/products/${l.slug}`)} className="btn btn-ghost">
                  {t('collection.readStory')}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
