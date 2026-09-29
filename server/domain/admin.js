import { LOCALES } from '../i18n.js'

// Quy tắc nhập liệu của admin (FR-CAT-004, FR-QR-007, G-07). Trả { errors, values } như account.js.

export const PRODUCT_KINDS = ['single', 'set']
export const PRODUCT_STATUSES = ['draft', 'published', 'hidden'] // D-39
export const TONES = ['amber', 'dusk', 'dawn', 'moss'] // màu minh hoạ đèn (src/components/Lantern.jsx)
export const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
// Chỉ khoá riêng của VIDEO_TYPES (tránh '__proto__', 'toString'…)
export const isVideoType = (t) => typeof t === 'string' && Object.hasOwn(VIDEO_TYPES, t)

// Ảnh sản phẩm (G-23). Chỉ định dạng web phổ biến; không nhận SVG vì SVG có thể chứa script.
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const isImageType = (t) => typeof t === 'string' && Object.hasOwn(IMAGE_TYPES, t)

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Mã lô in trên QR khắc đèn: chữ in hoa, số, gạch nối [ASSUMPTION]
const BATCH_CODE_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Văn bản đa ngôn ngữ {vi, en, zh} (T-06). Chuỗi rỗng bị bỏ; vi bắt buộc nếu required.
export function parseI18n(value, { required = false, max }) {
  if (value === null || value === undefined) return required ? { error: 'REQUIRED' } : { value: null }
  if (typeof value !== 'object' || Array.isArray(value)) return { error: 'INVALID' }
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    if (!LOCALES.includes(k)) return { error: 'INVALID' }
    if (v === null || v === undefined) continue
    if (typeof v !== 'string') return { error: 'INVALID' }
    const t = v.trim()
    if (!t) continue
    if (t.length > max) return { error: 'TOO_LONG' }
    out[k] = t
  }
  if (!out.vi) {
    if (required) return { error: 'REQUIRED' }
    if (Object.keys(out).length) return { error: 'VI_REQUIRED' } // D-40: tiếng Việt là bản dự phòng
    return { value: null }
  }
  return { value: out }
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

function field(body, key, partial, errors, values, check) {
  if (partial && body[key] === undefined) return
  const r = check(body[key])
  if (r.error) errors[key] = r.error
  else values[key] = r.value
}

const oneOf = (list) => (v) => (list.includes(v) ? { value: v } : { error: v === undefined ? 'REQUIRED' : 'INVALID' })
const optionalOneOf = (list) => (v) => (v === null || v === undefined ? { value: null } : list.includes(v) ? { value: v } : { error: 'INVALID' })
const sortOrder = (v) => (v === undefined ? { value: 0 } : isInt(v, -100000, 100000) ? { value: v } : { error: 'INVALID' })

export function validateProduct(body, { partial = false } = {}) {
  const errors = {}
  const values = {}
  field(body, 'slug', partial, errors, values, (v) => {
    if (typeof v !== 'string' || !v) return { error: 'REQUIRED' }
    if (v.length > 80 || !SLUG_RE.test(v)) return { error: 'INVALID_SLUG' }
    return { value: v }
  })
  field(body, 'kind', partial, errors, values, oneOf(PRODUCT_KINDS))
  field(body, 'status', partial, errors, values, (v) => (v === undefined && !partial ? { value: 'draft' } : oneOf(PRODUCT_STATUSES)(v)))
  field(body, 'price', partial, errors, values, (v) =>
    // T-09: số nguyên VND
    v === undefined ? { error: 'REQUIRED' } : isInt(v, 0, 1_000_000_000) ? { value: v } : { error: 'INVALID_PRICE' },
  )
  field(body, 'tone', partial, errors, values, optionalOneOf(TONES))
  field(body, 'sortOrder', partial, errors, values, sortOrder)
  field(body, 'name', partial, errors, values, (v) => parseI18n(v, { required: true, max: 120 }))
  field(body, 'description', partial, errors, values, (v) => parseI18n(v, { max: 1000 }))
  field(body, 'badge', partial, errors, values, (v) => parseI18n(v, { max: 40 }))
  // Chú thích ảnh (alt) — a11y + SEO; ảnh và đường dẫn đặt qua endpoint tải ảnh, không qua form
  field(body, 'imageAlt', partial, errors, values, (v) => parseI18n(v, { max: 160 }))
  return { errors, values }
}

export function validateFaq(body, { partial = false } = {}) {
  const errors = {}
  const values = {}
  field(body, 'question', partial, errors, values, (v) => parseI18n(v, { required: true, max: 300 }))
  field(body, 'answer', partial, errors, values, (v) => parseI18n(v, { required: true, max: 2000 }))
  field(body, 'isPublished', partial, errors, values, (v) =>
    v === undefined ? { value: false } : typeof v === 'boolean' ? { value: v } : { error: 'INVALID' },
  )
  field(body, 'sortOrder', partial, errors, values, sortOrder)
  return { errors, values }
}

export function validateBatch(body, { partial = false } = {}) {
  const errors = {}
  const values = {}
  field(body, 'code', partial, errors, values, (v) => {
    if (typeof v !== 'string' || !v.trim()) return { error: 'REQUIRED' }
    const code = v.trim()
    if (code.length > 40 || !BATCH_CODE_RE.test(code)) return { error: 'INVALID_BATCH_CODE' }
    return { value: code }
  })
  field(body, 'producedOn', partial, errors, values, (v) => {
    if (v === null || v === undefined || v === '') return { value: null }
    if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return { error: 'INVALID_DATE' }
    // Date.parse chấp nhận 2026-02-31 → kiểm tra lại
    if (new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) return { error: 'INVALID_DATE' }
    return { value: v }
  })
  field(body, 'title', partial, errors, values, (v) => parseI18n(v, { max: 120 }))
  field(body, 'story', partial, errors, values, (v) => parseI18n(v, { max: 2000 }))
  return { errors, values }
}

export function validateVideoUpload(body, maxBytes) {
  const errors = {}
  if (!isVideoType(body.contentType)) errors.contentType = 'INVALID_VIDEO_TYPE'
  if (!Number.isInteger(body.size) || body.size <= 0) errors.size = 'INVALID'
  else if (body.size > maxBytes) errors.size = 'VIDEO_TOO_LARGE'
  return errors
}

export function validateImageUpload(body, maxBytes) {
  const errors = {}
  if (!isImageType(body.contentType)) errors.contentType = 'INVALID_IMAGE_TYPE'
  if (!Number.isInteger(body.size) || body.size <= 0) errors.size = 'INVALID'
  else if (body.size > maxBytes) errors.size = 'IMAGE_TOO_LARGE'
  return errors
}
