import { useOutlet, useLocation } from 'react-router-dom'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import { splitLocale } from '../i18n/index.js'
import AuthHeader from './AuthHeader'
import AuthFooter from './AuthFooter'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import PageTransition from './PageTransition'
import Scene from './Scene'
import May from '../may/May.jsx'
import ConsentBanner from './ConsentBanner'
import CartProvider from '../cart/CartProvider.jsx'

// Trang dạng ứng dụng (dashboard tài khoản) tự có thanh bên, không dùng header/footer của trang giới thiệu
const APP_PAGES = new Set(['/account'])

// Cảnh nền ảnh thật ở đầu các trang công khai (D-66); trang chủ có cảnh riêng từng phần, 404 tự vẽ khung đêm
const AUTH_PAGES = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback'])
function pageScene(rest) {
  if (AUTH_PAGES.has(rest)) return 'auth'
  if (rest.startsWith('/products/')) return 'product'
  if (rest === '/shop') return 'shop'
  if (rest === '/cart') return 'cart'
  if (rest === '/checkout') return 'checkout'
  if (rest.startsWith('/don-hang/')) return 'order'
  if (rest.startsWith('/lo/')) return 'batch'
  return null
}

export default function LocaleLayout({ lang }) {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const { rest } = splitLocale(pathname)
  const clean = rest.replace(/\/+$/, '') || '/'
  const app = APP_PAGES.has(clean)
  const auth = AUTH_PAGES.has(clean)
  const scene = app ? null : pageScene(clean)
  return (
    <LocaleProvider lang={lang}>
      {/* NFR-A11Y-001: tắt hiệu ứng framer-motion khi người dùng bật giảm chuyển động */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <CartProvider>
            <div className={app ? 'page page-app' : auth ? 'page page-auth' : 'page'}>
              {!app && (auth ? <AuthHeader /> : <SiteHeader />)}
              <PageTransition
                pageKey={`${lang}${clean}`}
                className={scene ? `has-motifs page-scene-main page-scene-${scene}` : undefined}
              >
                {scene && <Scene name={scene} className="page-scene" />}
                {outlet}
              </PageTransition>
              {!app && (auth ? <AuthFooter /> : <SiteFooter />)}
              <May />
              {!app && <ConsentBanner />}
            </div>
          </CartProvider>
        </MotionConfig>
      </LazyMotion>
    </LocaleProvider>
  )
}
