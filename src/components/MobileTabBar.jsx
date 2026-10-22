import { Link, useLocation } from 'react-router-dom'
import { splitLocale, useI18n } from '../i18n/index.js'
import { useCart } from '../cart/context.js'

// Thanh điều hướng đáy cho điện thoại (UX: vùng ngón cái). Chỉ hiện ≤640px qua CSS; các trang có thanh riêng
// ở đáy (chi tiết sản phẩm, giỏ, thanh toán, đơn hàng) và trang đăng nhập/dashboard không dùng thanh này.
const icon = {
  home: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  shop: (
    <>
      <path d="M8 3h8v3.5a4 4 0 0 1-8 0z" />
      <path d="M12 10.5V17" />
      <path d="M8.5 21h7" />
    </>
  ),
  cart: (
    <>
      <path d="M5 8h14l-1.2 11a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
}

export default function MobileTabBar() {
  const { t, path } = useI18n()
  const { rest } = splitLocale(useLocation().pathname)
  const clean = rest.replace(/\/+$/, '') || '/'
  const { cart } = useCart()
  const n = cart?.itemCount ?? 0
  const items = [
    { key: 'home', to: '/', label: t('nav.home'), active: clean === '/' },
    { key: 'shop', to: '/shop', label: t('nav.shop'), active: clean === '/shop' || clean.startsWith('/collections/') },
    { key: 'cart', to: '/cart', label: t('cart.nav'), active: false, badge: n },
    { key: 'account', to: '/account', label: t('nav.account'), active: false },
  ]
  return (
    <nav className="tabbar" aria-label={t('nav.menuLabel')}>
      {items.map((it) => (
        <Link key={it.key} to={path(it.to)} className={`tabbar-item${it.active ? ' is-active' : ''}`} aria-current={it.active ? 'page' : undefined}
          aria-label={it.badge > 0 ? t('cart.navCount', { n: it.badge }) : undefined}>
          <span className="tabbar-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              {icon[it.key]}
            </svg>
            {it.badge > 0 && <span className="tabbar-badge">{it.badge}</span>}
          </span>
          <span className="tabbar-label" aria-hidden={it.badge > 0 ? 'true' : undefined}>{it.label}</span>
        </Link>
      ))}
    </nav>
  )
}
