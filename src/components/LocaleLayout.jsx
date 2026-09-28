import { Outlet } from 'react-router-dom'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

export default function LocaleLayout({ lang }) {
  return (
    <LocaleProvider lang={lang}>
      {/* NFR-A11Y-001: tắt hiệu ứng framer-motion khi người dùng bật giảm chuyển động */}
      {/* LazyMotion: chỉ nạp phần animation cần dùng → bundle nhỏ hơn; mọi component dùng `m.*` */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <div className="page">
            <SiteHeader />
            <main>
              <Outlet />
            </main>
            <SiteFooter />
          </div>
        </MotionConfig>
      </LazyMotion>
    </LocaleProvider>
  )
}
