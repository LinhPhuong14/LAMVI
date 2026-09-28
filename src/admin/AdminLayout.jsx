import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import { useAuth } from '../auth/context.js'
import { useNoIndex } from '../hooks/useNoIndex.js'
import { S } from './strings.js'

function Gate() {
  useNoIndex() // BR-SEO-001
  const { user, authedApi } = useAuth()
  const location = useLocation()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    if (!user) return
    let alive = true
    // Chỉ để hiển thị; quyền thật do server kiểm tra ở mọi API /admin (D-38)
    authedApi('/me')
      .then((res) => alive && setState({ status: res.profile.role === 'admin' ? 'ok' : 'forbidden' }))
      .catch((error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [user, authedApi])

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (state.status === 'loading') return <p className="admin-main">{S.common.loading}</p>
  if (state.status !== 'ok') {
    return (
      <section className="admin-main">
        <h1>{S.common.forbiddenTitle}</h1>
        <p>{S.common.forbiddenText}</p>
      </section>
    )
  }

  return (
    <div className="admin">
      <aside className="admin-nav">
        <span className="nav-mark">MỘC</span>
        <strong>{S.title}</strong>
        <nav>
          <NavLink to="/admin/products">{S.nav.products}</NavLink>
          <NavLink to="/admin/faq">{S.nav.faq}</NavLink>
          <NavLink to="/admin/batches">{S.nav.batches}</NavLink>
        </nav>
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
