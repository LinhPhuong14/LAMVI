import { Outlet } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import May from '../may/May.jsx'

export default function LocaleLayout({ lang }) {
  return (
    <LocaleProvider lang={lang}>
      {/* NFR-A11Y-001: tắt hiệu ứng framer-motion khi người dùng bật giảm chuyển động */}
      <MotionConfig reducedMotion="user">
        <div className="page">
          <div className="grain" aria-hidden="true" />
          <SiteHeader />
          <main>
            <Outlet />
          </main>
          <SiteFooter />
          <May />
        </div>
      </MotionConfig>
    </LocaleProvider>
  )
}
