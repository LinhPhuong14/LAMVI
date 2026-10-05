import { randomBytes } from 'node:crypto'
import { HttpError, notFound } from '../errors.js'
import { GIFT_MEDIA_BUCKET } from '../adapters/supabase/storage.js'
import {
  MESSAGE_LANGS,
  MESSAGE_MAX_CHARS,
  VIDEO_MAX_BYTES,
  VOICE_MAX_BYTES,
  editRights,
  isMediaType,
  isQrToken,
  mediaDaysLeft,
  mediaDeadline,
  mediaExpired,
  mediaExtension,
  mediaMaxBytes,
  messageState,
  orderAllowsMessage,
  qrAvailability,
  validateMediaUpload,
  validateMessageText,
} from '../domain/message.js'

const COLS = { voice: ['voicePath', 'voiceType'], video: ['videoPath', 'videoType'] }
const DOWNLOAD_NAME = { voice: 'loi-chuc-giong-noi', video: 'loi-chuc-video' }

const validation = (errors) => new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)

/**
 * Lời chúc của đơn (FR-MSG-001, FR-ACC-003) và trang QR lời chúc (FR-QR-002…005).
 * deps: repo, storage (bucket riêng tư gift-media), may (dịch dùng chung ngân sách), now.
 */
export function createMessageService({ repo, storage, may = null, now = () => new Date() }) {
  const nowIso = () => now().toISOString()

  const hasMedia = (m) => Boolean(m?.voicePath || m?.videoPath)

  // Xoá file thật khỏi Storage rồi mới đánh dấu đã xoá — lỗi Storage thì để dòng nguyên để lần sau thử lại
  async function purgeMedia(order, message) {
    for (const path of [message.voicePath, message.videoPath]) {
      if (path) await storage.removeObject(path, GIFT_MEDIA_BUCKET)
    }
    return repo.upsertGiftMessage(order.id, {
      voicePath: null,
      voiceType: null,
      videoPath: null,
      videoType: null,
      mediaDeletedAt: nowIso(),
    })
  }

  // ---------- Người mua (đã đăng nhập) ----------

  function presentOwner(order, message) {
    const rights = editRights(order, message)
    return {
      allowed: orderAllowsMessage(order),
      state: messageState(order, message, now()),
      canEditText: rights.text,
      canEditMedia: rights.media,
      text: message?.text ?? '',
      textLang: message?.textLang ?? order.qrLang ?? 'vi',
      hasVoice: Boolean(message?.voicePath),
      hasVideo: Boolean(message?.videoPath),
      mediaDeleted: Boolean(message?.mediaDeletedAt),
      // Q-27: người mua không xem trang QR → chỉ cho biết người nhận đã xác nhận hay chưa
      confirmed: Boolean(message?.confirmedAt),
      limits: { maxChars: MESSAGE_MAX_CHARS, voiceBytes: VOICE_MAX_BYTES, videoBytes: VIDEO_MAX_BYTES },
    }
  }

  async function ownerView(order) {
    return presentOwner(order, await repo.getGiftMessage(order.id))
  }

  function assertAllowed(order) {
    if (!orderAllowsMessage(order)) throw new HttpError(409, 'NO_MESSAGE', 'Đơn này không có lời chúc')
  }

  async function saveText(order, body) {
    assertAllowed(order)
    const message = await repo.getGiftMessage(order.id)
    // BR-MSG-008 / BR-MSG-001
    if (!editRights(order, message).text) throw new HttpError(409, 'MESSAGE_TEXT_LOCKED', 'Lời chúc chữ đã khoá')
    const { errors, values } = validateMessageText(body, { defaultLang: order.qrLang ?? 'vi' })
    if (Object.keys(errors).length) throw validation(errors)
    // Chữ đổi → bản dịch cũ hết giá trị
    const saved = await repo.upsertGiftMessage(order.id, { ...values, translations: {} })
    return presentOwner(order, saved)
  }

  async function createMediaUpload(order, body) {
    assertAllowed(order)
    const errors = validateMediaUpload(body)
    if (Object.keys(errors).length) throw validation(errors)
    const message = await repo.getGiftMessage(order.id)
    if (!editRights(order, message).media) throw new HttpError(409, 'MESSAGE_LOCKED', 'Lời chúc đã khoá')
    // Đường dẫn mới mỗi lần, không ghi đè file cũ
    const path = `${order.id}/${body.kind}-${Date.now()}-${randomBytes(4).toString('hex')}.${mediaExtension(body.kind, body.contentType)}`
    const upload = await storage.createUpload({ path, contentType: body.contentType, bucket: GIFT_MEDIA_BUCKET })
    return { path, ...upload }
  }

  async function attachMedia(order, { kind, path }) {
    assertAllowed(order)
    if (!COLS[kind]) throw validation({ kind: 'INVALID' })
    const message = await repo.getGiftMessage(order.id)
    if (!editRights(order, message).media) throw new HttpError(409, 'MESSAGE_LOCKED', 'Lời chúc đã khoá')
    // Chỉ nhận đường dẫn do chính server cấp cho đơn này (chống gắn file của đơn khác)
    if (typeof path !== 'string' || !path.startsWith(`${order.id}/${kind}-`) || path.includes('..')) {
      throw validation({ path: 'INVALID' })
    }
    const obj = await storage.statObject(path, GIFT_MEDIA_BUCKET)
    if (!obj) throw validation({ path: 'MEDIA_NOT_UPLOADED' })
    if (obj.size > mediaMaxBytes(kind)) throw validation({ size: 'MEDIA_TOO_LARGE' })
    // Kiểm lại kiểu file thật (lúc PUT người tải có thể gửi Content-Type khác)
    if (!isMediaType(kind, obj.contentType)) throw validation({ contentType: 'INVALID_MEDIA_TYPE' })
    const [pathCol, typeCol] = COLS[kind]
    const oldPath = message?.[pathCol]
    const saved = await repo.upsertGiftMessage(order.id, { [pathCol]: path, [typeCol]: obj.contentType })
    if (oldPath && oldPath !== path) await storage.removeObject(oldPath, GIFT_MEDIA_BUCKET).catch(() => {})
    return presentOwner(order, saved)
  }

  async function removeMedia(order, kind) {
    assertAllowed(order)
    if (!COLS[kind]) throw validation({ kind: 'INVALID' })
    const message = await repo.getGiftMessage(order.id)
    if (!editRights(order, message).media) throw new HttpError(409, 'MESSAGE_LOCKED', 'Lời chúc đã khoá')
    const [pathCol, typeCol] = COLS[kind]
    if (!message?.[pathCol]) return presentOwner(order, message)
    const saved = await repo.upsertGiftMessage(order.id, { [pathCol]: null, [typeCol]: null })
    await storage.removeObject(message[pathCol], GIFT_MEDIA_BUCKET).catch(() => {})
    return presentOwner(order, saved)
  }

  // ---------- Người nhận (không tài khoản, token QR) ----------

  // AC-004: token không tồn tại / đơn đã huỷ → cùng một 404, không lộ đơn có tồn tại hay không
  async function openOrder(token) {
    if (!isQrToken(token)) throw notFound()
    const order = await repo.getOrderByQrToken(token)
    if (!order || qrAvailability(order.status) === 'hidden') throw notFound()
    return order
  }

  async function latestBatch() {
    const list = await repo.listBatches()
    const published = list.filter((b) => b.status === 'video_published' && b.videoUrl)
    published.sort((a, b) => String(b.producedOn ?? '').localeCompare(String(a.producedOn ?? '')))
    return published[0] ? { code: published[0].code, title: published[0].title } : null
  }

  async function mediaUrls(message) {
    const out = {}
    for (const [kind, [pathCol, typeCol]] of Object.entries(COLS)) {
      if (!message[pathCol]) continue
      const ext = message[pathCol].split('.').pop()
      out[kind] = {
        type: message[typeCol],
        url: await storage.signedUrl(message[pathCol], GIFT_MEDIA_BUCKET, { expiresIn: 3600 }),
        // FR-QR-004: tải về trước khi bị xoá
        downloadUrl: await storage.signedUrl(message[pathCol], GIFT_MEDIA_BUCKET, {
          expiresIn: 3600,
          download: `${DOWNLOAD_NAME[kind]}.${ext}`,
        }),
      }
    }
    return out
  }

  async function view(token) {
    const order = await openOrder(token)
    const lang = order.qrLang ?? 'vi'
    // §21.4(7): chưa SHIPPED → "đang chuẩn bị", không cho xác nhận
    if (qrAvailability(order.status) === 'preparing') return { state: 'preparing', lang }
    let message = await repo.getGiftMessage(order.id)
    // Hết hạn thì xoá thật ngay khi có người mở (NFR-PRV-003), không chờ cron
    if (message && hasMedia(message) && mediaExpired(order, message, now())) {
      message = await purgeMedia(order, message).catch(() => message)
    }
    // AC-001, BR-MSG-007: chưa xác nhận → chỉ lời chào, không lộ nội dung, không đếm ngược
    if (!message?.confirmedAt) return { state: 'greeting', lang, orderKind: order.orderKind }

    const expired = mediaExpired(order, message, now())
    const deadline = mediaDeadline(order, message)
    const item = {
      state: 'active',
      lang,
      orderKind: order.orderKind,
      text: message.text,
      textLang: message.textLang,
      translations: message.translations ?? {},
      media: expired || !hasMedia(message) ? {} : await mediaUrls(message),
      mediaExpired: expired && (hasMedia(message) || Boolean(message.mediaDeletedAt)),
      mediaExpiresAt: !expired && hasMedia(message) && deadline ? deadline.toISOString() : null,
      mediaDaysLeft: !expired && hasMedia(message) ? mediaDaysLeft(order, message, now()) : null,
    }
    // D-76: đơn không có lời chúc → QR dẫn tới video mẻ đèn
    if (!message.text && !hasMedia(message) && !message.mediaDeletedAt) item.batch = await latestBatch()
    return item
  }

  async function confirm(token) {
    const order = await openOrder(token)
    if (qrAvailability(order.status) !== 'open') throw new HttpError(409, 'GIFT_NOT_READY', 'Món quà đang được chuẩn bị')
    // US-004 AC-002: chỉ lần đầu; Q-18: không đổi trạng thái đơn
    await repo.confirmGiftMessage(order.id, nowIso())
    return view(token)
  }

  async function translate(token, to) {
    if (!MESSAGE_LANGS.includes(to)) throw validation({ lang: 'INVALID' })
    const order = await openOrder(token)
    const message = await repo.getGiftMessage(order.id)
    if (qrAvailability(order.status) !== 'open' || !message?.confirmedAt) throw notFound()
    if (!message.text) throw validation({ text: 'EMPTY' })
    // Cùng ngôn ngữ → không gọi AI (không tốn ngân sách)
    if (to === message.textLang) return { lang: to, text: message.text, cached: true }
    const cached = message.translations?.[to]
    if (cached) return { lang: to, text: cached, cached: true }
    if (!may) throw new HttpError(503, 'TRANSLATE_UNAVAILABLE', 'Chưa dịch được')
    const text = await may.translate({ text: message.text, from: message.textLang, to })
    // BR-MSG-005: bản dịch được cache. Ghi lại từ bản mới nhất để không đè bản dịch của ngôn ngữ khác.
    const fresh = (await repo.getGiftMessage(order.id)) ?? message
    await repo.upsertGiftMessage(order.id, { translations: { ...(fresh.translations ?? {}), [to]: text } })
    return { lang: to, text, cached: false }
  }

  /** D-26, D-75: xoá media quá hạn. Gọi từ cron (chung endpoint expire-orders). */
  async function purgeExpiredMedia() {
    const candidates = await repo.listGiftMediaCandidates()
    let purged = 0
    for (const { message, order } of candidates) {
      if (!mediaExpired(order, message, now())) continue
      try {
        await purgeMedia(order, message)
        purged += 1
      } catch (err) {
        console.error('[messages] không xoá được media', order.id, err?.message)
      }
    }
    return purged
  }

  return { ownerView, saveText, createMediaUpload, attachMedia, removeMedia, view, confirm, translate, purgeExpiredMedia, presentOwner }
}
