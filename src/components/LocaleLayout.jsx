import { Outlet } from 'react-router-dom'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import May from '../may/May.jsx'
import CartProvider from '../cart/CartProvider.jsx'

export default function LocaleLayout({ lang }) {
  return (
    <LocaleProvider lang={lang}>
      {/* NFR-A11Y-001: tắt hiệu ứng framer-motion khi người dùng bật giảm chuyển động */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <CartProvider>
            <div className="page">
              <SiteHeader />
              <main>
                <Outlet />
              </main>
              <SiteFooter />
              <May />
            </div>
          </CartProvider>
        </MotionConfig>
      </LazyMotion>
    </LocaleProvider>
  )
}
