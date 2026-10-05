import { isMessageLocked, isMessageTextLocked } from './order.js'

// Quy tắc lời chúc (§21, FR-MSG-001, FR-QR-002…005). Hàm thuần, không đụng DB.

// D-41 I-10: giới hạn do PO chọn 300 ký tự [ASSUMPTION] — ảnh hưởng thiệp viết tay (§21.5)
export const MESSAGE_MAX_CHARS = 300
// Giới hạn media [ASSUMPTION] — giọng nói ≤ 20 MB, video ≤ 100 MB (~60 giây)
export const VOICE_MAX_BYTES = 20 * 1024 * 1024
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024
export const VOICE_TYPES = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
}
export const GIFT_VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
export const MEDIA_KINDS = ['voice', 'video']

// D-26: giọng nói/video bị xoá sau 30 ngày kể từ lúc người nhận xác nhận lần đầu
export const CONFIRMED_MEDIA_DAYS = 30
// D-75 (BR-MSG-006): không ai xác nhận → xoá 90 ngày kể từ khi đơn giao thành công
export const UNCONFIRMED_MEDIA_DAYS = 90
const DAY_MS = 86_400_000

export const MESSAGE_LANGS = ['vi', 'en', 'zh']

export const isMediaType = (kind, type) => {
  const table = kind === 'voice' ? VOICE_TYPES : kind === 'video' ? GIFT_VIDEO_TYPES : null
  return Boolean(table) && typeof type === 'string' && Object.hasOwn(table, type)
}
export const mediaExtension = (kind, type) => (kind === 'voice' ? VOICE_TYPES : GIFT_VIDEO_TYPES)[type]
export const mediaMaxBytes = (kind) => (kind === 'voice' ? VOICE_MAX_BYTES : VIDEO_MAX_BYTES)

// Token QR là 64 ký tự hex (BR-QR-001). Kiểm trước khi chạm DB để rác không tốn truy vấn.
export const QR_TOKEN_RE = /^[a-f0-9]{64}$/
export const isQrToken = (t) => typeof t === 'string' && QR_TOKEN_RE.test(t)

const isBadControl = (ch) => {
  const c = ch.codePointAt(0)
  return (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f
}

/** Kiểm chữ lời chúc. Chuỗi rỗng = xoá chữ. Trả { errors, values: { text, textLang } }. */
export function validateMessageText(body, { defaultLang = 'vi' } = {}) {
  const errors = {}
  const values = {}
  if (typeof body.text !== 'string') errors.text = 'REQUIRED'
  else {
    const text = body.text.trim()
    // Đếm theo ký tự hiển thị (không đếm đơn vị UTF-16) để emoji/chữ Hán tính đúng
    if ([...text].length > MESSAGE_MAX_CHARS) errors.text = 'TOO_LONG'
    // Ký tự điều khiển (trừ tab, xuống dòng) không có lý do hợp lệ trong lời chúc
    else if ([...text].some(isBadControl)) errors.text = 'INVALID'
    else values.text = text || null
  }
  const lang = body.textLang ?? defaultLang
  if (!MESSAGE_LANGS.includes(lang)) errors.textLang = 'INVALID'
  else values.textLang = lang
  return { errors, values }
}

export function validateMediaUpload(body) {
  const errors = {}
  if (!MEDIA_KINDS.includes(body.kind)) errors.kind = 'INVALID'
  if (!isMediaType(body.kind, body.contentType)) errors.contentType = 'INVALID_MEDIA_TYPE'
  if (!Number.isInteger(body.size) || body.size <= 0) errors.size = 'INVALID'
  else if (MEDIA_KINDS.includes(body.kind) && body.size > mediaMaxBytes(body.kind)) errors.size = 'MEDIA_TOO_LARGE'
  return errors
}

/**
 * Ai được sửa gì lúc này. BR-MSG-008: chữ khoá từ PACKED; BR-MSG-001: mọi thứ khoá từ SHIPPED.
 * Đơn đã huỷ hoặc đã hết media thì không sửa.
 */
export function editRights(order, message) {
  const cancelled = order.status === 'cancelled'
  const mediaGone = Boolean(message?.mediaDeletedAt)
  return {
    text: !cancelled && !isMessageTextLocked(order.status),
    media: !cancelled && !isMessageLocked(order.status) && !mediaGone,
  }
}

/** Đơn có được dùng lời chúc không: D-14 (đơn tự mua phải tích "Thêm lời chúc"), D-76. */
export const orderAllowsMessage = (order) => Boolean(order.hasMessage)

/**
 * Hạn xoá media: có xác nhận → confirmedAt + 30 ngày (D-26); chưa xác nhận → deliveredAt + 90 ngày
 * (D-75). Chưa có mốc nào → null (chưa đếm ngược — BR-MSG-007: lượt mở trước khi xác nhận không tính).
 */
export function mediaDeadline(order, message) {
  if (message?.confirmedAt) return new Date(Date.parse(message.confirmedAt) + CONFIRMED_MEDIA_DAYS * DAY_MS)
  if (order.deliveredAt) return new Date(Date.parse(order.deliveredAt) + UNCONFIRMED_MEDIA_DAYS * DAY_MS)
  return null
}

export function mediaExpired(order, message, now = new Date()) {
  if (message?.mediaDeletedAt) return true
  const d = mediaDeadline(order, message)
  return d !== null && now.getTime() >= d.getTime()
}

/** Số ngày còn lại (làm tròn lên) hoặc null nếu chưa đếm ngược. */
export function mediaDaysLeft(order, message, now = new Date()) {
  const d = mediaDeadline(order, message)
  if (!d) return null
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / DAY_MS))
}

// §21.4(7): trước khi SHIPPED hiện "đang chuẩn bị". Đơn đã huỷ → 404 chung (không lộ đơn).
const OPENABLE = new Set(['shipped', 'delivered'])
export const qrAvailability = (status) => (status === 'cancelled' ? 'hidden' : OPENABLE.has(status) ? 'open' : 'preparing')

/** Trạng thái lời chúc theo §21.3, để hiện cho khách/admin. */
export function messageState(order, message, now = new Date()) {
  if (!message || (!message.text && !message.voicePath && !message.videoPath && !message.mediaDeletedAt)) return 'EMPTY'
  if (message.mediaDeletedAt || (message.confirmedAt && mediaExpired(order, message, now))) return 'MEDIA_EXPIRED'
  if (message.confirmedAt) return 'ACTIVE'
  if (isMessageLocked(order.status)) return 'LOCKED'
  if (isMessageTextLocked(order.status)) return 'TEXT_LOCKED'
  return 'DRAFT'
}
