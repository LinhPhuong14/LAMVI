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
  'login_view',
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
  // API trang QR lời chúc: token nằm ở đoạn thứ ba, không được lọt vào nhật ký lỗi 5xx của IT (G-28)
  { re: /^\/api\/qr\/[^/]+/i, label: '/api/qr/:token' },
  { re: /^(\/(?:en|zh))?\/qr\/[^/]+/i, label: '/qr/:token' },
  { re: /^(\/(?:en|zh))?\/reset-password\/[^/]+/i, label: '/reset-password/:token' },
]

/**
 * Làm sạch đường dẫn trước khi gửi GA: bỏ query + hash (có thể chứa token), thay đoạn bí mật.
 * @param {string} pathname đường dẫn, có thể kèm ?query#hash
 */
export function sanitizePath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return '/'
  // Gộp dấu "/" lặp trước khi so mẫu: `//qr/token` mở cùng trang nhưng lách được mẫu bên dưới
  let path = pathname.split('?')[0].split('#')[0]
  // Encoded route names and delimiters must not bypass QR/reset token matching.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const decoded = decodeURIComponent(path)
      if (decoded === path) break
      path = decoded
    } catch {
      const decoded = path.replace(/(?:%[0-9a-f]{2})+/gi, encoded => {
        try { return decodeURIComponent(encoded) } catch { return '[encoded]' }
      })
      if (decoded === path) break
      path = decoded
    }
  }
  path = path.split('?')[0].split('#')[0].replace(/\/{2,}/g, '/') || '/'
  for (const { re, label } of SECRET_SEGMENT) {
    const m = path.match(re)
    // Tiền tố ngôn ngữ về chữ thường để GA gộp đúng một trang (URL in trên đèn có thể viết HOA)
    if (m) return `${(m[1] ?? '').toLowerCase()}${label}`
  }
  // Unknown/public URIs can still contain user-supplied PII or opaque tokens.
  // Keep normal product slugs/order codes, never collect these segments verbatim.
  return path.split('/').map(segment => (segment.includes('@')
    ? segment.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]') : segment)
    .replace(/\(?\+?84\)?(?:[\s.()-]*\d){9,10}\b|\b0(?:[\s.-]*\d){9,10}\b/g, '[phone]')
    .replace(/\+\d(?:[\s.()-]*\d){7,14}\b|\b\d{10,15}\b/g, '[phone]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[token]')
    .replace(/[^/]*%[^/]*/g, '[encoded]')
    .split('').filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('')
  ).join('/').slice(0, 200)
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
