import { useContext, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMotionValueEvent, useScroll } from 'framer-motion'
import { LOCALES, localePath, splitLocale, useI18n } from '../i18n/index.js'
import { AuthContext } from '../auth/context.js'
import { useCart } from '../cart/context.js'
import CartBubble from '../cart/CartBubble.jsx'
import { Seal } from './Motifs'

// 'shop' dẫn tới trang Cửa hàng riêng (D-85); các mục còn lại là phần trên trang chủ
const SECTIONS = ['story', 'artisan', 'shop', 'lookbook', 'qr', 'faq']

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

// Thanh điều hướng luôn nằm ở đầu trang. Cuộn xuống thì thu nhỏ 20% và bo tròn thành viên thuốc nổi (D-85)
function useHeaderScrolled() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 12
    if (next !== scrolled) setScrolled(next)
  })
  return scrolled
}

export default function SiteHeader() {
  const { t, path } = useI18n()
  const scrolled = useHeaderScrolled()
  const auth = useContext(AuthContext)
  return (
    <header className={`nav${scrolled ? ' is-scrolled' : ''}`}>
      <Link to={path('/')} className="nav-mark" aria-label="LAMVI">
        <Seal>LAMVI</Seal>
      </Link>
      <nav className="nav-links">
        {SECTIONS.map((s) => (
          <Link key={s} to={s === 'shop' ? path('/shop') : { pathname: path('/'), hash: `#${s}` }}>
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
        <Link to={path('/shop')} className="nav-cta thread">
          {t('nav.cta')}
        </Link>
      </div>
    </header>
  )
}
