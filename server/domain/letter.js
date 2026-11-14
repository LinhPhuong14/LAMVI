import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// D-134, D-138: phong thư riêng của từng đơn — admin soạn toàn bộ, xuất QR dẫn tới trang riêng trên domain chính.

/** Bảy dịp của Phòng thư (khớp `occasions` ở src/letter-room/data.js). */
export const OCCASIONS = ['birthday', 'anniversary', 'thankYou', 'milestone', 'encouragement', 'longDistance', 'justBecause']
export const LETTER_KINDS = ['text', 'video']
export const LETTER_STATUSES = ['draft', 'published']
// D-140: hai kiểu trải nghiệm — Phòng thư 3D (`room`, mặc định) hoặc web 2D (`web`)
export const LETTER_TEMPLATES = ['room', 'web']
// Ảnh đèn trong bản web 2D: 5 mẫu đèn LAMVI (public/images/lamps/<slug>-cutout.webp)
export const LETTER_LAMPS = ['tu-linh', 'thu-hoach', 'phuc-loc-song-toan', 'tam-duong-khai-thai', 'lon-dan']

// Giới hạn độ dài [ASSUMPTION] — đủ cho một lá thư tay, chặn dữ liệu rác làm nặng trang
export const LIMITS = { name: 60, paragraph: 1200, paragraphs: 12, message: 6000, postscript: 400, short: 300, label: 60, places: 4, photos: 2 }

// Mã thư ngẫu nhiên trên đường dẫn /thu/<slug>: 10 ký tự a-z0-9 bắt đầu bằng chữ — không lộ mã đơn.
// Không phải bí mật: quyền xem nằm ở token (D-138).
export const SLUG_RE = /^[a-z][a-z0-9]{9}$/
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
export function generateSlug() {
  const bytes = randomBytes(10)
  let s = SLUG_ALPHABET[bytes[0] % 26]
  for (let i = 1; i < 10; i++) s += SLUG_ALPHABET[bytes[i] % 36]
  return s
}

// Token 256 bit, base64url (43 ký tự) — đặt sau dấu # nên không vào log server/proxy/Referer
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
export const generateToken = () => randomBytes(32).toString('base64url')

/** So khớp token không rò thời gian (so hash cố định độ dài). */
export function tokenMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || !TOKEN_RE.test(given)) return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/** URL in lên QR (D-138): {PUBLIC_SITE_URL}/thu/<slug>#<token> — không dùng subdomain. */
export function letterUrl(config, slug, token) {
  return `${config.publicSiteUrl}/thu/${slug}#${token}`
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const isMediaUrl = (v) => typeof v === 'string' && v.length <= 500 && /^(\/[^/\\]|https:\/\/[^\s"'<>]+$)/.test(v) && !/[\s"'<>]/.test(v)

/**
 * Kiểm tra và chuẩn hoá nội dung phong thư do admin soạn. Trả { value, errors }.
 * Chỉ giữ các trường biết trước (không lưu JSON tuỳ ý).
 */
export function validateLetterContent(input) {
  const errors = {}
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const value = {}

  for (const key of ['recipientName', 'senderName']) {
    const v = str(src[key])
    if (!v) errors[key] = 'REQUIRED'
    else if (v.length > LIMITS.name) errors[key] = 'TOO_LONG'
    value[key] = v.slice(0, LIMITS.name)
  }

  value.occasion = OCCASIONS.includes(src.occasion) ? src.occasion : null
  if (!value.occasion) errors.occasion = 'INVALID'
  // Thiếu/lạ → mặc định (thư soạn trước D-140 vẫn mở bằng Phòng thư 3D)
  value.template = LETTER_TEMPLATES.includes(src.template) ? src.template : 'room'
  value.lamp = LETTER_LAMPS.includes(src.lamp) ? src.lamp : null
  value.kind = LETTER_KINDS.includes(src.kind) ? src.kind : null
  if (!value.kind) errors.kind = 'INVALID'

  // Nội dung: chuỗi (tách đoạn theo dòng trống) hoặc mảng đoạn
  const raw = Array.isArray(src.message) ? src.message : typeof src.message === 'string' ? src.message.split(/\n\s*\n/) : []
  if (raw.some((p) => typeof p !== 'string') || (src.message != null && !Array.isArray(src.message) && typeof src.message !== 'string')) errors.message = 'INVALID'
  const paragraphs = raw.map(str).filter(Boolean)
  if (paragraphs.length > LIMITS.paragraphs || paragraphs.some((p) => p.length > LIMITS.paragraph) || paragraphs.join('').length > LIMITS.message) errors.message = 'TOO_LONG'
  if (value.kind === 'text' && !paragraphs.length) errors.message = 'REQUIRED'
  value.message = paragraphs.slice(0, LIMITS.paragraphs)

  if (value.kind === 'video') {
    if (!isMediaUrl(src.videoUrl)) errors.videoUrl = src.videoUrl ? 'INVALID' : 'REQUIRED'
    value.videoUrl = isMediaUrl(src.videoUrl) ? src.videoUrl : null
    for (const k of ['posterUrl', 'captionsUrl']) {
      if (src[k] && !isMediaUrl(src[k])) errors[k] = 'INVALID'
      value[k] = isMediaUrl(src[k]) ? src[k] : null
    }
  }

  const ps = str(src.postscript)
  if (ps.length > LIMITS.postscript) errors.postscript = 'TOO_LONG'
  value.postscript = ps.slice(0, LIMITS.postscript) || null

  // Dữ liệu bất ngờ theo dịp — chỉ các trường của đúng dịp đã chọn
  const od = src.occasionData && typeof src.occasionData === 'object' && !Array.isArray(src.occasionData) ? src.occasionData : {}
  const data = {}
  const msg = str(od.message)
  if (msg.length > LIMITS.short) errors['occasionData.message'] = 'TOO_LONG'
  if (msg) data.message = msg.slice(0, LIMITS.short)
  if (value.occasion === 'anniversary') {
    const date = str(od.date)
    if (date.length > LIMITS.label) errors['occasionData.date'] = 'TOO_LONG'
    if (date) data.date = date.slice(0, LIMITS.label)
    const photos = Array.isArray(od.photos) ? od.photos : []
    if (photos.length > LIMITS.photos || photos.some((p) => !isMediaUrl(p))) errors['occasionData.photos'] = 'INVALID'
    data.photos = photos.filter(isMediaUrl).slice(0, LIMITS.photos)
  }
  if (value.occasion === 'milestone') {
    const label = str(od.label)
    if (label.length > LIMITS.label) errors['occasionData.label'] = 'TOO_LONG'
    if (label) data.label = label.slice(0, LIMITS.label)
  }
  if (value.occasion === 'longDistance') {
    const places = (Array.isArray(od.places) ? od.places : []).map(str).filter(Boolean)
    if (places.length > LIMITS.places || places.some((p) => p.length > LIMITS.label)) errors['occasionData.places'] = 'INVALID'
    if (places.length) data.places = places.slice(0, LIMITS.places).map((p) => p.slice(0, LIMITS.label))
  }
  if (value.occasion === 'justBecause') {
    // Đếm theo ký tự hiển thị (emoji ghép như 👨‍👩‍👧 là một)
    const icon = str(od.icon)
    const glyphs = [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(icon)].map((g) => g.segment)
    if (glyphs.length > 2 || icon.length > 32) errors['occasionData.icon'] = 'TOO_LONG'
    if (icon) data.icon = glyphs.slice(0, 2).join('').slice(0, 32)
  }
  value.occasionData = Object.keys(data).length ? data : null

  return { value, errors }
}

/** Dữ liệu trả cho người nhận — đúng hình dạng `letter` mà LetterRoom nhận. */
export const presentLetterForRecipient = (letter) => ({ ...letter.content })

/** Dữ liệu cho admin (gồm URL QR khi đã xuất bản). */
export function presentLetterForAdmin(letter, config) {
  if (!letter) return null
  return {
    status: letter.status,
    content: letter.content,
    slug: letter.slug,
    publishedAt: letter.publishedAt ?? null,
    openedAt: letter.openedAt ?? null,
    updatedAt: letter.updatedAt ?? null,
    url: letter.status === 'published' && letter.slug && letter.token ? letterUrl(config, letter.slug, letter.token) : null,
  }
}
