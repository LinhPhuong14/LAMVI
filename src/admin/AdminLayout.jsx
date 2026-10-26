import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import { useAuth } from '../auth/context.js'
import { Seal } from '../components/Motifs'
import AdminAtmosphere from './AdminAtmosphere.jsx'
import Seo from '../seo/Seo.jsx'
import { AnalyticsIcon, BatchesIcon, CouponsIcon, FaqIcon, ItIcon, MayIcon, OrdersIcon, ProductsIcon, SiteIcon, UsersIcon } from './NavIcons.jsx'
import { S } from './strings.js'
import { useAdminCounts } from './useAdminCounts.js'

// Nhóm theo công việc, không theo bảng dữ liệu (docs/knowledge/dashboard-ux.md). [đường dẫn, khoá, biểu tượng, huy hiệu?]
const NAV = [
  [null, [['/admin', 'overview', OrdersIcon, null, true]]],
  ['groupSales', [
    ['/admin/orders', 'orders', OrdersIcon, 'orders'],
    ['/admin/returns', 'returns', OrdersIcon, 'returns'],
    ['/admin/coupons', 'coupons', CouponsIcon],
  ]],
  ['groupCatalog', [
    ['/admin/products', 'products', ProductsIcon],
    ['/admin/collections', 'collections', ProductsIcon],
    ['/admin/batches', 'batches', BatchesIcon],
  ]],
  ['groupContent', [
    ['/admin/faq', 'faq', FaqIcon],
    ['/admin/may', 'may', MayIcon],
  ]],
  ['groupPeople', [['/admin/users', 'users', UsersIcon]]],
  ['groupInsight', [['/admin/analytics', 'analytics', AnalyticsIcon]]],
]

// Chỉ dựng sau khi đã xác nhận vai trò: huy hiệu gọi API admin nên không được gọi với tài khoản thường
function AdminNav() {
  const counts = useAdminCounts()
  return (
    <nav aria-label={S.title}>
          {NAV.map(([group, items]) => (
            <div key={group ?? 'top'} className="admin-nav-group">
              {group && <span className="admin-nav-title">{S.nav[group]}</span>}
              {items.map(([to, key, Icon, badge, end]) => (
                <NavLink key={to} to={to} end={end}>
                  <Icon />
                  {S.nav[key]}
                  {badge && counts[badge] > 0 && (
                    <span className="admin-badge" aria-label={`${counts[badge]}`}>
                      {counts[badge]}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
    </nav>
  )
}

// BR-SEO-001: admin noindex
function Gate() {
  const { user, authedApi } = useAuth()
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
  // Chưa đăng nhập → <ProtectedRoute> (routes.jsx) chuyển hướng; ở đây chỉ kiểm quyền hiển thị
  if (!user) return null
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
        <AdminNav />
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
