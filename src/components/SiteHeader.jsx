import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useMotionValueEvent, useScroll } from 'framer-motion'
import { LOCALES, localePath, splitLocale, useI18n } from '../i18n/index.js'
import { AuthContext } from '../auth/context.js'
import { useApi } from '../api/useApi.js'
import { useCart } from '../cart/context.js'
import CartBubble from '../cart/CartBubble.jsx'
import { Seal } from './Motifs'

// 'shop' dẫn tới trang Cửa hàng riêng (D-86); các mục còn lại là phần trên trang chủ
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

// Thanh điều hướng luôn nằm ở đầu trang. Cuộn xuống thì thu nhỏ 20% và bo tròn thành viên thuốc nổi (D-86)
function useHeaderScrolled() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 12
    if (next !== scrolled) setScrolled(next)
  })
  return scrolled
}

const FOCUSABLE = 'a[href], button:not([disabled])'

// Menu di động (feedback 08/10, mục 2): ngăn kéo toàn màn hình. Vẽ qua portal vào <body> vì .nav có
// backdrop-filter/transform — phần tử `fixed` bên trong sẽ bị kẹt trong khung của header thay vì phủ màn hình.
// Đóng bằng Esc, bấm nền, hoặc khi chuyển trang; khoá cuộn nền; giữ Tab trong ngăn kéo; trả focus về nút mở.
function MobileMenu({ open, onClose, triggerRef }) {
  const { t, lang, path } = useI18n()
  const auth = useContext(AuthContext)
  const site = useApi('/site', lang)
  const business = site.status === 'ok' ? site.data : null
  const panel = useRef(null)
  const location = useLocation()
  const first = useRef(true)

  // Chuyển trang thì đóng (bỏ qua lần render đầu)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    onClose()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    if (!open) return undefined
    const trigger = triggerRef.current
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector(FOCUSABLE)?.focus()
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...panel.current.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [open, onClose, triggerRef])

  if (!open) return null
  return createPortal(
    // Bấm vào nền (ngoài ngăn kéo) thì đóng
    <div className="mobile-menu-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div id="mobile-menu" className="mobile-menu" role="dialog" aria-modal="true" aria-label={t('nav.menuLabel')} ref={panel}>
        <div className="mobile-menu-head">
          <Link to={path('/')} className="nav-mark" aria-label="LAMVI">
            <Seal>LAMVI</Seal>
          </Link>
          <button type="button" className="mobile-menu-close" onClick={onClose} aria-label={t('nav.menuClose')}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <nav className="mobile-menu-links" aria-label={t('nav.menuLabel')}>
          {SECTIONS.map((s) => (
            <Link key={s} to={s === 'shop' ? path('/shop') : { pathname: path('/'), hash: `#${s}` }}>
              {t(`nav.${s}`)}
            </Link>
          ))}
          <Link to={path('/account')}>{t('nav.account')}</Link>
          <Link to={path('/account?tab=orders')}>{t('nav.track')}</Link>
          <Link to={path('/contact')}>{t('nav.contact')}</Link>
        </nav>
        <div className="mobile-menu-foot">
          <LanguageSwitcher />
          {business?.phone && (
            <a className="mobile-menu-hotline" href={`tel:${business.phone.replace(/[^0-9+]/g, '')}`}>
              {t('nav.hotline')}: {business.phone}
            </a>
          )}
          {auth?.user && (
            <button type="button" className="mobile-menu-logout" onClick={() => auth.logout()}>
              {t('nav.logout')}
            </button>
          )}
          <Link to={path('/shop')} className="btn btn-primary mobile-menu-cta">
            {t('nav.cta')}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function SiteHeader() {
  const { t, path } = useI18n()
  const scrolled = useHeaderScrolled()
  const auth = useContext(AuthContext)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtn = useRef(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
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
        <button
          type="button"
          ref={menuBtn}
          className="nav-menu-btn"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? t('nav.menuClose') : t('nav.menu')}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="nav-menu-bars" aria-hidden="true" />
        </button>
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
      <MobileMenu open={menuOpen} onClose={closeMenu} triggerRef={menuBtn} />
    </header>
  )
}
