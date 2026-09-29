// Google Analytics 4 (FR-GA-001, §23.3). Dùng chung server (sinh thẻ <script>) và client (gửi sự kiện).
//
// D-72 (chốt [LEGAL] Q-32): KHÔNG có banner xin đồng ý cookie — GA chạy ngay khi vào web; việc
// dùng GA được nêu trong Chính sách riêng tư.
// NFR-PRV-002: không gửi token QR và không gửi dữ liệu cá nhân sang GA. Mọi đường dẫn đều đi qua
// sanitizePath() và mọi tham số sự kiện đi qua sanitizeParams() trước khi gửi.

// §23.3 — danh sách sự kiện được phép gửi. Gửi tên ngoài danh sách này bị bỏ qua (tránh vô tình
// tạo sự kiện chứa dữ liệu nhạy cảm).
export const GA_EVENTS = Object.freeze([
  'view_item',
  'add_to_cart',
  'begin_checkout',
  'purchase',
  'cancel_order',
  'open_qr_gift',
  'confirm_gift_received',
  'open_qr_batch',
  'mascot_open',
  'mascot_tour_complete',
  'mascot_error',
])

// GA4 Measurement ID: G- + chữ/số. Kiểm chặt vì giá trị này được nhúng vào <script> nội tuyến.
const MEASUREMENT_ID_RE = /^G-[A-Z0-9]{4,24}$/i

export function isValidMeasurementId(id) {
  return typeof id === 'string' && MEASUREMENT_ID_RE.test(id)
}

// Đường dẫn có đoạn bí mật: đoạn cuối bị thay bằng nhãn cố định trước khi gửi (NFR-PRV-002).
// Trang QR lời chúc dùng token trong URL; trang lô dùng mã lô (mã chung, không bí mật — D-43).
const SECRET_SEGMENT = [
  { re: /^(\/(?:en|zh))?\/qr\/[^/]+/, label: '/qr/:token' },
  { re: /^(\/(?:en|zh))?\/reset-password\/[^/]+/, label: '/reset-password/:token' },
]

/**
 * Làm sạch đường dẫn trước khi gửi GA: bỏ query + hash (có thể chứa token), thay đoạn bí mật.
 * @param {string} pathname đường dẫn, có thể kèm ?query#hash
 */
export function sanitizePath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return '/'
  const path = pathname.split('?')[0].split('#')[0] || '/'
  for (const { re, label } of SECRET_SEGMENT) {
    const m = path.match(re)
    if (m) return `${m[1] ?? ''}${label}`
  }
  return path
}

// Chỉ cho qua giá trị nguyên thuỷ và tên tham số an toàn; chuỗi bị cắt để không lọt nội dung dài
// (lời chúc, địa chỉ…). Không nhận object/array lồng nhau.
const MAX_PARAM_LEN = 100

export function sanitizeParams(params) {
  const out = {}
  if (!params || typeof params !== 'object') return out
  for (const [k, v] of Object.entries(params)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string') out[k] = v.slice(0, MAX_PARAM_LEN)
  }
  return out
}

/** URL thư viện gtag.js — dùng ở thẻ <script src> và trong CSP. */
export const GTAG_ORIGIN = 'https://www.googletagmanager.com'
export const gaScriptSrc = (id) => `${GTAG_ORIGIN}/gtag/js?id=${encodeURIComponent(id)}`

/**
 * Mã nội tuyến khởi tạo gtag. send_page_view: false vì đây là SPA — page_view do client gửi tay
 * với đường dẫn đã làm sạch (sanitizePath) ở mỗi lần điều hướng.
 */
export function gaInlineScript(id) {
  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    'gtag("js",new Date());',
    `gtag("config",${JSON.stringify(id)},{send_page_view:false});`,
  ].join('')
}
