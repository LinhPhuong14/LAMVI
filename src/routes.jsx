import { Navigate, Route, Routes } from 'react-router-dom'
import LocaleLayout from './components/LocaleLayout'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import NotFoundPage from './pages/NotFoundPage'
import AccountPage from './pages/AccountPage'
import BatchPage from './pages/BatchPage'
import GiftPage from './pages/GiftPage'
import ShopPage from './pages/ShopPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderPage from './pages/OrderPage'
import LoginPage from './pages/auth/LoginPage'
import AuthCallbackPage from './pages/auth/AuthCallbackPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import AdminLayout from './admin/AdminLayout'
import AdminOrdersPage from './admin/OrdersPage'
import CouponsPage from './admin/CouponsPage'
import UsersPage from './admin/UsersPage'
import ProductsPage from './admin/ProductsPage'
import FaqPage from './admin/FaqPage'
import BatchesPage from './admin/BatchesPage'
import ItDashboard from './it/ItDashboard'
import AnalyticsPage from './admin/AnalyticsPage'
import MayConfigPage from './admin/MayConfigPage'

// Các trang con dùng chung cho mọi ngôn ngữ
function localeChildren() {
  return (
    <>
      <Route index element={<HomePage />} />
      <Route path="products/:slug" element={<ProductPage />} />
      <Route path="lo/:code" element={<BatchPage />} />
      <Route path="qr/:token" element={<GiftPage />} />
      <Route path="shop" element={<ShopPage />} />
      <Route path="cart" element={<CartPage />} />
      <Route path="checkout" element={<CheckoutPage />} />
      <Route path="don-hang/:code" element={<OrderPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="auth/callback" element={<AuthCallbackPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="account" element={<AccountPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </>
  )
}

// D-37: / (vi), /en/…, /zh/…
export default function AppRoutes() {
  return (
    <Routes>
      {/* D-51: dashboard IT */}
      <Route path="/it" element={<ItDashboard />} />
      {/* D-48: admin chỉ tiếng Việt */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:code" element={<AdminOrdersPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UsersPage />} />
        <Route path="coupons" element={<CouponsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="may" element={<MayConfigPage />} />
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
