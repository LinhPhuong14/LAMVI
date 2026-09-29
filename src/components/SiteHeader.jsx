import { Link, useLocation } from 'react-router-dom'
import { LOCALES, localePath, splitLocale, useI18n } from '../i18n/index.js'
import { useCart } from '../cart/context.js'

const SECTIONS = ['story', 'artisan', 'products', 'lookbook', 'qr', 'faq']

export function LanguageSwitcher() {
  const { lang, t } = useI18n()
  const location = useLocation()
  const { rest } = splitLocale(location.pathname)
  return (
    <nav className="lang-switch" aria-label={t('nav.language')}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          to={{ pathname: localePath(l, rest), search: location.search, hash: location.hash }}
          aria-current={l === lang ? 'true' : undefined}
          lang={l === 'zh' ? 'zh-Hans' : l}
          className={l === lang ? 'active' : ''}
          title={t(`locales.${l}`)}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  )
}

function CartLink() {
  const { t, path } = useI18n()
  const { cart } = useCart()
  const n = cart?.itemCount ?? 0
  return (
    <Link to={path('/cart')} className="nav-cart">
      {n > 0 ? t('cart.navCount', { n }) : t('cart.nav')}
    </Link>
  )
}

export default function SiteHeader() {
  const { t, path } = useI18n()
  return (
    <header className="nav">
      <Link to={path('/')} className="nav-mark">
        MỘC
      </Link>
      <nav className="nav-links">
        {SECTIONS.map((s) => (
          <Link key={s} to={{ pathname: path('/'), hash: `#${s}` }}>
            {t(`nav.${s}`)}
          </Link>
        ))}
      </nav>
      <div className="nav-actions">
        <LanguageSwitcher />
        <CartLink />
        <Link to={path('/account')} className="nav-account">
          {t('nav.account')}
        </Link>
        <Link to={{ pathname: path('/'), hash: '#products' }} className="nav-cta">
          {t('nav.cta')}
        </Link>
      </div>
    </header>
  )
}
