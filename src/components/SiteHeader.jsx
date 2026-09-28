import { Link, useLocation } from 'react-router-dom'
import { LOCALES, localePath, splitLocale, useI18n } from '../i18n/index.js'

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
