import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lotus } from '../components/Motifs'
import ProductCards from '../components/ProductCards'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import Seo from '../seo/Seo.jsx'
import { breadcrumbJsonLd } from '../seo/head.js'
import { useSiteUrl } from '../seo/context.js'

const FILTERS = ['all', 'single', 'set']
const SORTS = ['featured', 'priceAsc', 'priceDesc', 'name']

// Trang Cửa hàng riêng (D-85): xem toàn bộ đèn, lọc theo loại, sắp xếp. Landing chỉ giới thiệu
// bộ sưu tập và dẫn về đây; mọi nút "xem đèn" trong web đều đi tới trang này.
export default function ShopPage() {
  const { t, lang, path } = useI18n()
  const siteUrl = useSiteUrl()
  const res = useApi('/products', lang)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('featured')

  const items = res.status === 'ok' ? res.data.items : null
  const shown = useMemo(() => {
    if (!items) return []
    const list = filter === 'all' ? items : items.filter((p) => p.kind === filter)
    const by = {
      featured: null,
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
      name: (a, b) => a.name.localeCompare(b.name, lang),
    }[sort]
    return by ? [...list].sort(by) : list
  }, [items, filter, sort, lang])

  const kinds = useMemo(() => new Set((items ?? []).map((p) => p.kind)), [items])

  return (
    <section className="page-section shop">
      <Seo
        title={t('meta.shopTitle')}
        description={t('meta.shopDescription')}
        path="/shop"
        jsonLd={[
          breadcrumbJsonLd(siteUrl, lang, [
            { name: t('nav.home'), path: '/' },
            { name: t('nav.shop'), path: '/shop' },
          ]),
        ]}
      />
      <header className="shop-head">
        <p className="eyebrow">
          <Lotus /> {t('shop.eyebrow')}
        </p>
        <h1 className="page-title">{t('shop.title')}</h1>
        <p className="shop-lead">{t('shop.lead')}</p>
        <ul className="shop-perks">
          {t('shop.perks').map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </header>

      <div className="shop-bar">
        <div className="shop-filters" role="group" aria-label={t('shop.filterLabel')}>
          {FILTERS.filter((f) => f === 'all' || kinds.has(f)).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {t(`shop.filters.${f}`)}
            </button>
          ))}
        </div>
        <label className="shop-sort">
          <span>{t('shop.sortLabel')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`shop.sorts.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {items && (
          <p className="shop-count" role="status">
            {t('shop.count', { n: shown.length })}
          </p>
        )}
      </div>

      {res.status === 'loading' && <p className="products-status">{t('products.loading')}</p>}
      {res.status === 'error' && (
        <p className="products-status" role="alert">
          {t('products.error')}
        </p>
      )}
      {items && shown.length === 0 && <p className="products-status">{t('products.empty')}</p>}
      {shown.length > 0 && <ProductCards items={shown} className="shop-grid" key={`${filter}-${sort}`} />}

      <aside className="shop-foot">
        <p>{t('shop.help')}</p>
        <Link to={{ pathname: path('/'), hash: '#faq' }} className="btn btn-ghost btn-small">
          {t('shop.helpLink')}
        </Link>
      </aside>
    </section>
  )
}
