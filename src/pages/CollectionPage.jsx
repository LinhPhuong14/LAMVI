import { Link, useParams } from 'react-router-dom'
import { Lotus } from '../components/Motifs'
import ProductCards from '../components/ProductCards'
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
        <Seo title={nf ? t('collection.notFound') : t('products.error')} noindex status={nf ? 404 : 500} />
        {back}
        <h1 className="page-title">{nf ? t('collection.notFound') : t('products.error')}</h1>
      </section>
    )
  }

  const c = res.data.item
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
      <header className="collection-hero">
        <p className="eyebrow">
          <Lotus /> {t('collection.eyebrow')}
        </p>
        <h1 className="page-title">{c.name}</h1>
        <p className="shop-lead">{c.description}</p>
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

      <h2 className="collection-sub">{t('collection.pickSingle', { n: c.lamps.length })}</h2>
      <ProductCards items={c.lamps} className="shop-grid" />
    </section>
  )
}
