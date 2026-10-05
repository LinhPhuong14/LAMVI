import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import { useAuth } from '../auth/context.js'
import { Seal } from '../components/Motifs'
import AdminAtmosphere from './AdminAtmosphere.jsx'
import Seo from '../seo/Seo.jsx'
import { AnalyticsIcon, BatchesIcon, CouponsIcon, FaqIcon, ItIcon, MayIcon, OrdersIcon, ProductsIcon, SiteIcon, UsersIcon } from './NavIcons.jsx'
import { S } from './strings.js'

// Thứ tự theo tần suất dùng hằng ngày: đơn hàng trước, cấu hình sau
const NAV = [
  ['/admin/orders', 'orders', OrdersIcon],
  ['/admin/users', 'users', UsersIcon],
  ['/admin/products', 'products', ProductsIcon],
  ['/admin/faq', 'faq', FaqIcon],
  ['/admin/batches', 'batches', BatchesIcon],
  ['/admin/coupons', 'coupons', CouponsIcon],
  ['/admin/analytics', 'analytics', AnalyticsIcon],
  ['/admin/may', 'may', MayIcon],
]

// BR-SEO-001: admin noindex
function Gate() {
  const { user, authedApi } = useAuth()
  const location = useLocation()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    if (!user) return
    let alive = true
    // Chỉ để hiển thị; quyền thật do server kiểm tra ở mọi API /admin (D-38)
    authedApi('/me')
      // D-51: IT có cả quyền admin
      .then((res) => alive && setState({ status: ['admin', 'it'].includes(res.profile.role) ? 'ok' : 'forbidden', role: res.profile.role }))
      .catch((error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [user, authedApi])

  const seo = <Seo title={S.title} noindex />
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (state.status === 'loading') {
    return (
      <p className="admin-main">
        {seo}
        {S.common.loading}
      </p>
    )
  }
  if (state.status !== 'ok') {
    return (
      <section className="admin-main">
        {seo}
        <h1>{S.common.forbiddenTitle}</h1>
        <p>{S.common.forbiddenText}</p>
      </section>
    )
  }

  return (
    <div className="admin">
      {seo}
      <AdminAtmosphere />
      <aside className="admin-nav">
        <div className="admin-brand">
          <Seal>LAMVI</Seal>
          <strong>{S.title}</strong>
        </div>
        <nav aria-label={S.title}>
          {NAV.map(([to, key, Icon]) => (
            <NavLink key={to} to={to}>
              <Icon />
              {S.nav[key]}
            </NavLink>
          ))}
        </nav>
        <div className="admin-side-foot">
          {/* D-51: chỉ IT mới vào được /it */}
          {state.role === 'it' && (
            <NavLink to="/it" className="admin-back">
              <ItIcon />
              {S.nav.it}
            </NavLink>
          )}
          <a href="/" className="admin-back">
            <SiteIcon />
            {S.nav.site}
          </a>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

// D-48: admin chỉ tiếng Việt, không có tiền tố /en, /zh
export default function AdminLayout() {
  return (
    <LocaleProvider lang="vi">
      <Gate />
    </LocaleProvider>
  )
}
