import { Outlet } from 'react-router-dom'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

export default function LocaleLayout({ lang }) {
  return (
    <LocaleProvider lang={lang}>
      <div className="page">
        <div className="grain" aria-hidden="true" />
        <SiteHeader />
        <main>
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </LocaleProvider>
  )
}
