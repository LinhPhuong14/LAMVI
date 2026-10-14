import { Link, useLocation } from 'react-router-dom'
import { splitLocale, useI18n } from '../i18n/index.js'
import Logo from './Logo.jsx'
import { LanguageSwitcher } from './SiteHeader'

// Header riêng cho đăng nhập / đăng ký / quên / đặt lại mật khẩu (D-80): không có link tới các phần
// của landing. Chỉ còn logo (về trang chủ), ngôn ngữ và nút chuyển qua lại giữa đăng nhập và đăng ký.
export default function AuthHeader() {
  const { t, path } = useI18n()
  const { rest } = splitLocale(useLocation().pathname)
  const onLogin = rest.replace(/\/+$/, '') === '/login'
  return (
    <header className="nav nav-auth">
      <Link to={path('/')} className="nav-mark" aria-label="LAMVI">
        <Logo size={42} decorative />
      </Link>
      <div className="nav-actions">
        <LanguageSwitcher />
        <Link to={path(onLogin ? '/register' : '/login')} className="nav-cta thread">
          {onLogin ? t('auth.registerTitle') : t('auth.loginTitle')}
        </Link>
      </div>
    </header>
  )
}
