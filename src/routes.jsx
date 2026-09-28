import { Route, Routes } from 'react-router-dom'
import LocaleLayout from './components/LocaleLayout'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import NotFoundPage from './pages/NotFoundPage'

// Các trang con dùng chung cho mọi ngôn ngữ
function localeChildren() {
  return (
    <>
      <Route index element={<HomePage />} />
      <Route path="products/:slug" element={<ProductPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </>
  )
}

// D-37: / (vi), /en/…, /zh/…
export default function AppRoutes() {
  return (
    <Routes>
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
