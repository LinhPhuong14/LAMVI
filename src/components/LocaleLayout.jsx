import { Outlet, useLocation } from 'react-router-dom'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import { splitLocale } from '../i18n/index.js'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import May from '../may/May.jsx'
import CartProvider from '../cart/CartProvider.jsx'

// Trang dạng ứng dụng (dashboard tài khoản) tự có thanh bên, không dùng header/footer của trang giới thiệu
const APP_PAGES = new Set(['/account'])

export default function LocaleLayout({ lang }) {
  const { rest } = splitLocale(useLocation().pathname)
  const app = APP_PAGES.has(rest.replace(/\/+$/, '') || '/')
  return (
    <LocaleProvider lang={lang}>
      {/* NFR-A11Y-001: tắt hiệu ứng framer-motion khi người dùng bật giảm chuyển động */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <CartProvider>
            <div className={app ? 'page page-app' : 'page'}>
              {!app && <SiteHeader />}
              <main>
                <Outlet />
              </main>
              {!app && <SiteFooter />}
              <May />
            </div>
          </CartProvider>
        </MotionConfig>
      </LazyMotion>
    </LocaleProvider>
  )
}
