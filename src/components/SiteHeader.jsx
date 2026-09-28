import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMotionValueEvent, useScroll } from 'framer-motion'
import { LOCALES, localePath, splitLocale, useI18n } from '../i18n/index.js'
import { Seal } from './Motifs'

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

// Thanh điều hướng lui đi khi cuộn xuống đọc, hiện lại ngay khi cuộn lên
function useHeaderState() {
  const { scrollY } = useScroll()
  const [state, setState] = useState({ hidden: false, scrolled: false })
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    const hidden = y > 240 && y > prev + 2 ? true : y < prev - 2 ? false : state.hidden
    const scrolled = y > 12
    if (hidden !== state.hidden || scrolled !== state.scrolled) setState({ hidden, scrolled })
  })
  return state
}

export default function SiteHeader() {
  const { t, path } = useI18n()
  const { hidden, scrolled } = useHeaderState()
  return (
    <header className={`nav${hidden ? ' is-hidden' : ''}${scrolled ? ' is-scrolled' : ''}`}>
      <Link to={path('/')} className="nav-mark" aria-label="MỘC">
        <Seal>MỘC</Seal>
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
        <Link to={{ pathname: path('/'), hash: '#products' }} className="nav-cta thread">
          {t('nav.cta')}
        </Link>
      </div>
    </header>
  )
}
