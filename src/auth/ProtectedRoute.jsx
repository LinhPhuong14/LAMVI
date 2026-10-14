import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { safeNext, useAuth } from './context.js'
import Seo from '../seo/Seo.jsx'

// Phần tử chờ khi chưa biết khách đã đăng nhập hay chưa (SSR / hydrate): không chuyển hướng, không lộ nội dung riêng
function PendingAuth() {
  const { t } = useI18n()
  return (
    <p className="page-section" role="status" aria-busy="true">
      <Seo title={t('account.loading')} noindex />
      {t('account.loading')}
    </p>
  )
}

/**
 * Bảo vệ route cần đăng nhập (tài khoản, checkout, đơn hàng, admin, IT).
 * - Chưa biết phiên (SSR/hydrate) → hiện "đang tải", KHÔNG chuyển hướng.
 * - Chưa đăng nhập → /login?next=<đường dẫn hiện tại + query> (giữ tiền tố ngôn ngữ), thay thế lịch sử.
 * - Đã đăng nhập → render con. Quyền theo vai trò vẫn do server kiểm ở mọi API (D-38); trang admin/IT
 *   tự hiện "không có quyền" bằng /me.
 */
export function ProtectedRoute({ children }) {
  const { user, ready = true } = useAuth()
  const { path } = useI18n()
  const location = useLocation()
  if (!ready) return <PendingAuth />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${path('/login')}?next=${next}`} replace />
  }
  return children
}

/**
 * Trang chỉ dành cho khách (đăng nhập/đăng ký/quên mật khẩu): ai MỞ trang khi đã có phiên thì được đưa
 * tới `next` (chỉ đường dẫn nội bộ — chống open redirect) hoặc /account. Chỉ xét phiên có sẵn lúc vào trang:
 * đăng nhập ngay trên trang này vẫn do chính form xử lý (admin/IT về thẳng /admin — D-93).
 */
export function GuestRoute({ children }) {
  const { user, ready = true } = useAuth()
  const { path } = useI18n()
  const location = useLocation()
  const [hadSession, setHadSession] = useState(null)
  if (!ready) return <PendingAuth />
  if (hadSession === null) {
    setHadSession(Boolean(user)) // ghi nhận một lần, ngay khi biết phiên
    return <PendingAuth />
  }
  if (hadSession && user) {
    const next = safeNext(new URLSearchParams(location.search).get('next'), path('/account'))
    return <Navigate to={next} replace />
  }
  return children
}
