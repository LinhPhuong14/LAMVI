import { Navigate, Route, Routes } from 'react-router-dom'
import LocaleLayout from './components/LocaleLayout'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import NotFoundPage from './pages/NotFoundPage'
import AccountPage from './pages/AccountPage'
import BatchPage from './pages/BatchPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import AdminLayout from './admin/AdminLayout'
import ProductsPage from './admin/ProductsPage'
import FaqPage from './admin/FaqPage'
import BatchesPage from './admin/BatchesPage'
import ItDashboard from './it/ItDashboard'

// Các trang con dùng chung cho mọi ngôn ngữ
function localeChildren() {
  return (
    <>
      <Route index element={<HomePage />} />
      <Route path="products/:slug" element={<ProductPage />} />
      <Route path="lo/:code" element={<BatchPage />} />
      <Route path="login" element={<LoginPage />} />
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
        <Route index element={<Navigate to="products" replace />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="batches" element={<BatchesPage />} />
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
