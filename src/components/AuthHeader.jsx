import { useCallback, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { splitLocale, useI18n } from '../i18n/index.js'
import Logo from './Logo.jsx'
import { LanguageSwitcher, MobileMenu } from './SiteHeader'

// Header riêng cho đăng nhập / đăng ký / quên / đặt lại mật khẩu (D-80): không có link tới các phần
// của landing. Chỉ còn logo (về trang chủ), ngôn ngữ và nút chuyển qua lại giữa đăng nhập và đăng ký.
// Dưới 960px ngôn ngữ chuyển vào ngăn kéo (cùng quy tắc SiteHeader) nên có nút menu riêng.
export default function AuthHeader() {
  const { t, path } = useI18n()
  const { rest } = splitLocale(useLocation().pathname)
  const onLogin = rest.replace(/\/+$/, '') === '/login'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtn = useRef(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const cta = { to: path(onLogin ? '/register' : '/login'), label: onLogin ? t('auth.registerTitle') : t('auth.loginTitle') }
  return (
    <header className="nav nav-auth">
      <Link to={path('/')} className="nav-mark" aria-label="LAMVI">
        <Logo size={42} decorative />
      </Link>
      <div className="nav-actions">
        <LanguageSwitcher />
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
        <Link to={cta.to} className="nav-cta thread">
          {cta.label}
        </Link>
      </div>
      <MobileMenu open={menuOpen} onClose={closeMenu} triggerRef={menuBtn} variant="auth" cta={cta} />
    </header>
  )
}
