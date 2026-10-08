// Đồng ý phân tích (GA4 Consent Mode v2) — feedback 08/10 mục 24. Mặc định "denied" ở mã nhúng
// (src/analytics/ga.js); chỉ chuyển sang "granted" sau khi khách bấm Đồng ý.
const KEY = 'moc.consent'
export const CONSENT_EVENT = 'moc.consent-open'

const safe = (fn, fallback) => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** 'granted' | 'denied' | null (chưa chọn) */
export const getConsent = () => safe(() => localStorage.getItem(KEY), null)

function applyToGtag(granted) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const v = granted ? 'granted' : 'denied'
  window.gtag('consent', 'update', { analytics_storage: v, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
}

export function setConsent(granted) {
  safe(() => localStorage.setItem(KEY, granted ? 'granted' : 'denied'))
  applyToGtag(granted)
}

/** Gọi khi tải trang: nạp lại lựa chọn đã lưu vào gtag. */
export function restoreConsent() {
  if (getConsent() === 'granted') applyToGtag(true)
}

export const openConsent = () => typeof window !== 'undefined' && window.dispatchEvent(new Event(CONSENT_EVENT))
