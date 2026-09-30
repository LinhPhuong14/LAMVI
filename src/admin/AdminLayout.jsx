import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import { useAuth } from '../auth/context.js'
import Seo from '../seo/Seo.jsx'
import { S } from './strings.js'

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
      <aside className="admin-nav">
        <span className="nav-mark">LAMVI</span>
        <strong>{S.title}</strong>
        <nav>
          <NavLink to="/admin/orders">{S.nav.orders}</NavLink>
          <NavLink to="/admin/products">{S.nav.products}</NavLink>
          <NavLink to="/admin/faq">{S.nav.faq}</NavLink>
          <NavLink to="/admin/batches">{S.nav.batches}</NavLink>
          <NavLink to="/admin/coupons">{S.nav.coupons}</NavLink>
          <NavLink to="/admin/may">{S.nav.may}</NavLink>
        </nav>
        {state.role === 'it' && <NavLink to="/it">{S.nav.it}</NavLink>}
        <a href="/" className="admin-back">
          {S.nav.site}
        </a>
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
