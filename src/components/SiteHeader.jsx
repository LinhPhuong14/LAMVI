import { useContext, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMotionValueEvent, useScroll } from 'framer-motion'
import { LOCALES, localePath, splitLocale, useI18n } from '../i18n/index.js'
import { AuthContext } from '../auth/context.js'
import { useCart } from '../cart/context.js'
import CartBubble from '../cart/CartBubble.jsx'
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

// Giỏ hàng trên navbar: huy hiệu số lượng (nảy lên khi thêm món) + tooltip xác nhận gắn dưới nút (D-83)
function CartLink() {
  const { t, path } = useI18n()
  const { cart, lastAdded } = useCart()
  const n = cart?.itemCount ?? 0
  return (
    <span className="nav-cart-wrap">
      <Link to={path('/cart')} className="nav-cart" aria-label={n > 0 ? t('cart.navCount', { n }) : t('cart.nav')}>
        <span aria-hidden="true">{t('cart.nav')}</span>
        {n > 0 && (
          <span key={lastAdded?.id ?? 0} className="nav-cart-badge" aria-hidden="true">
            {n}
          </span>
        )}
      </Link>
      <CartBubble />
    </span>
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
  const { hidden: scrolledAway, scrolled } = useHeaderState()
  const { lastAdded } = useCart()
  // Đang hiện tooltip giỏ hàng thì không để header lui đi, nếu không tooltip biến mất cùng header
  const hidden = scrolledAway && !lastAdded
  const auth = useContext(AuthContext)
  return (
    <header className={`nav${hidden ? ' is-hidden' : ''}${scrolled ? ' is-scrolled' : ''}`}>
      <Link to={path('/')} className="nav-mark" aria-label="LAMVI">
        <Seal>LAMVI</Seal>
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
        {auth?.user && (
          <button type="button" className="nav-logout" onClick={() => auth.logout()}>
            {t('nav.logout')}
          </button>
        )}
        <Link to={{ pathname: path('/'), hash: '#products' }} className="nav-cta thread">
          {t('nav.cta')}
        </Link>
      </div>
    </header>
  )
}
