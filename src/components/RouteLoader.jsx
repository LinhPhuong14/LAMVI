import { Component, Suspense } from 'react'
import { useI18n } from '../i18n/index.js'
import { useLocation } from 'react-router-dom'

class LoadBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// Only private routes are lazy. Public SEO pages remain synchronously SSR-renderable.
export default function RouteLoader({ children }) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const failure = <section className="page-section" role="alert">
    <p>{t('routeLoad.error')}</p>
    <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>{t('routeLoad.reload')}</button>
  </section>
  return <LoadBoundary key={pathname} fallback={failure}>
    <Suspense fallback={<p className="page-section" role="status" aria-busy="true">{t('account.loading')}</p>}>{children}</Suspense>
  </LoadBoundary>
}
