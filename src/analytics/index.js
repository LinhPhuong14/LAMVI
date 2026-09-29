// API phía client của Google Analytics (FR-GA-001). Không import ở server.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { GA_EVENTS, sanitizeParams, sanitizePath } from './ga.js'

const EVENT_SET = new Set(GA_EVENTS)

const gtag = () => (typeof window !== 'undefined' ? window.gtag : undefined)

/** GA đã được nhúng chưa (chỉ khi cấu hình GA_MEASUREMENT_ID — xem server/ssr.js). */
export const isEnabled = () => typeof gtag() === 'function'

// Đường dẫn hiện tại đã làm sạch, kèm vào MỌI sự kiện vì hai lý do:
// 1) effect của component con chạy trước effect của PageViews (component cha), nên nếu chỉ dựa vào
//    gtag('set') ở trang trước thì sự kiện sẽ mang page_location của trang cũ;
// 2) không để GA tự đọc document.location — URL thật có thể chứa token QR (NFR-PRV-002).
function currentPageParams() {
  if (typeof window === 'undefined') return {}
  const path = sanitizePath(window.location.pathname)
  return { page_path: path, page_location: `${window.location.origin}${path}` }
}

/**
 * Gửi một sự kiện GA. Tên ngoài §23.3 bị bỏ qua; tham số đi qua sanitizeParams (NFR-PRV-002).
 * Không bao giờ ném lỗi — GA hỏng không được ảnh hưởng luồng mua hàng (NFR-AVL-001).
 */
export function track(event, params) {
  if (!EVENT_SET.has(event)) {
    if (import.meta.env?.DEV) console.warn('[ga] sự kiện không có trong §23.3, bỏ qua:', event)
    return false
  }
  const fn = gtag()
  if (typeof fn !== 'function') return false
  try {
    fn('event', event, { ...sanitizeParams(params), ...currentPageParams() })
    return true
  } catch {
    return false
  }
}

/** Gửi page_view với đường dẫn đã làm sạch. Gọi ở mỗi lần điều hướng SPA. */
export function trackPageView(pathname, title) {
  const fn = gtag()
  if (typeof fn !== 'function') return false
  const path = sanitizePath(pathname)
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    // page_title cũng đi qua bộ lọc: tiêu đề trang QR lời chúc có thể chứa tên người nhận
    fn('event', 'page_view', {
      ...sanitizeParams({ page_title: title ?? undefined }),
      page_path: path,
      page_location: `${origin}${path}`,
    })
    return true
  } catch {
    return false
  }
}

/** Gắn một lần ở gốc app: gửi page_view khi tải trang và mỗi lần đổi route. */
export function usePageViews() {
  const { pathname } = useLocation()
  useEffect(() => {
    trackPageView(pathname, typeof document !== 'undefined' ? document.title : undefined)
  }, [pathname])
}
