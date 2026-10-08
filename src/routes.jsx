import { lazy } from 'react'
import RouteLoader from './components/RouteLoader.jsx'
const ReturnsPage = lazy(() => import('./admin/ReturnsPage'))
import { Navigate, Route, Routes } from 'react-router-dom'
import LocaleLayout from './components/LocaleLayout'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import NotFoundPage from './pages/NotFoundPage'
const AccountPage = lazy(() => import('./pages/AccountPage'))
import BatchPage from './pages/BatchPage'
const GiftPage = lazy(() => import('./pages/GiftPage'))
import PolicyPage from './pages/PolicyPage'
import ContactPage from './pages/ContactPage'
import CollectionPage from './pages/CollectionPage'
import ShopPage from './pages/ShopPage'
const CartPage = lazy(() => import('./pages/CartPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const OrderPage = lazy(() => import('./pages/OrderPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const AuthCallbackPage = lazy(() => import('./pages/auth/AuthCallbackPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const AdminOrdersPage = lazy(() => import('./admin/OrdersPage'))
const CouponsPage = lazy(() => import('./admin/CouponsPage'))
const UsersPage = lazy(() => import('./admin/UsersPage'))
const CollectionsPage = lazy(() => import('./admin/CollectionsPage'))
const ProductsPage = lazy(() => import('./admin/ProductsPage'))
const FaqPage = lazy(() => import('./admin/FaqPage'))
const BatchesPage = lazy(() => import('./admin/BatchesPage'))
const ItDashboard = lazy(() => import('./it/ItDashboard'))
const AnalyticsPage = lazy(() => import('./admin/AnalyticsPage'))
const MayConfigPage = lazy(() => import('./admin/MayConfigPage'))

// Các trang con dùng chung cho mọi ngôn ngữ
function localeChildren() {
  return (
    <>
      <Route index element={<HomePage />} />
      <Route path="products/:slug" element={<ProductPage />} />
      <Route path="lo/:code" element={<BatchPage />} />
      <Route path="qr/:token" element={<RouteLoader><GiftPage /></RouteLoader>} />
      <Route path="shop" element={<ShopPage />} />
      <Route path="privacy" element={<PolicyPage kind="privacy" />} />
      <Route path="returns" element={<PolicyPage kind="returns" />} />
      <Route path="terms" element={<PolicyPage kind="terms" />} />
      <Route path="shipping" element={<PolicyPage kind="shipping" />} />
      <Route path="payment" element={<PolicyPage kind="payment" />} />
      <Route path="contact" element={<ContactPage />} />
      <Route path="collections/:slug" element={<CollectionPage />} />
      <Route path="cart" element={<RouteLoader><CartPage /></RouteLoader>} />
      <Route path="checkout" element={<RouteLoader><CheckoutPage /></RouteLoader>} />
      <Route path="don-hang/:code" element={<RouteLoader><OrderPage /></RouteLoader>} />
      <Route path="login" element={<RouteLoader><LoginPage /></RouteLoader>} />
      <Route path="auth/callback" element={<RouteLoader><AuthCallbackPage /></RouteLoader>} />
      <Route path="register" element={<RouteLoader><RegisterPage /></RouteLoader>} />
      <Route path="forgot-password" element={<RouteLoader><ForgotPasswordPage /></RouteLoader>} />
      <Route path="reset-password" element={<RouteLoader><ResetPasswordPage /></RouteLoader>} />
      <Route path="account" element={<RouteLoader><AccountPage /></RouteLoader>} />
      <Route path="*" element={<NotFoundPage />} />
    </>
  )
}

// D-37: / (vi), /en/…, /zh/…
export default function AppRoutes() {
  return (
    <Routes>
      {/* D-51: dashboard IT */}
      <Route path="/it" element={<RouteLoader><ItDashboard /></RouteLoader>} />
      {/* D-48: admin chỉ tiếng Việt */}
      <Route path="/admin" element={<RouteLoader><AdminLayout /></RouteLoader>}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<RouteLoader><AdminOrdersPage /></RouteLoader>} />
        <Route path="orders/:code" element={<RouteLoader><AdminOrdersPage /></RouteLoader>} />
        <Route path="users" element={<RouteLoader><UsersPage /></RouteLoader>} />
        <Route path="users/:id" element={<RouteLoader><UsersPage /></RouteLoader>} />
        <Route path="coupons" element={<RouteLoader><CouponsPage /></RouteLoader>} />
        <Route path="products" element={<RouteLoader><ProductsPage /></RouteLoader>} />
        <Route path="returns" element={<RouteLoader><ReturnsPage /></RouteLoader>} />
        <Route path="collections" element={<RouteLoader><CollectionsPage /></RouteLoader>} />
        <Route path="faq" element={<RouteLoader><FaqPage /></RouteLoader>} />
        <Route path="batches" element={<RouteLoader><BatchesPage /></RouteLoader>} />
        <Route path="analytics" element={<RouteLoader><AnalyticsPage /></RouteLoader>} />
        <Route path="may" element={<RouteLoader><MayConfigPage /></RouteLoader>} />
      </Route>
      <Route path="/en" element={<LocaleLayout lang="en" />}>
        {localeChildren()}
      </Route>
      <Route path="/zh" element={<LocaleLayout lang="zh" />}>
        {localeChildren()}
      </Route>
      <Route path="/" element={<LocaleLayout lang="vi" />}>
        {localeChildren()}
      </Route>
    </Routes>
  )
}
