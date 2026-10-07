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
export function createMessageService({ repo, storage, may = null, now = () => new Date(), cleanupTimeoutMs = 5000 }) {
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

  // Xoá media quá hạn nếu có; trả dòng lời chúc mới nhất. Lỗi Storage → giữ nguyên để thử lại sau.
  async function purgeIfExpired(order, message) {
    if (message && hasMedia(message) && mediaExpired(order, message, now())) {
      return purgeMedia(order, message).catch(() => message)
    }
    return message
  }

  // Đơn có thể đã đổi trạng thái giữa lúc kiểm quyền và lúc ghi (admin bấm "Đã đóng gói"/"Đã gửi"):
  // đọc lại SAU khi ghi, nếu đã khoá thì hoàn tác. Không có giao dịch nhiều bảng nên đây là cách thu hẹp
  // cửa sổ đua xuống một lần ghi (BR-MSG-001, BR-MSG-008).
  async function stillEditable(order, right) {
    const fresh = await repo.getOrderById(order.id)
    return Boolean(fresh) && editRights(fresh, null)[right]
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
    if (!(await stillEditable(order, 'text'))) {
      await repo.upsertGiftMessage(order.id, {
        text: message?.text ?? null,
        textLang: message?.textLang ?? null,
        translations: message?.translations ?? {},
      })
      throw new HttpError(409, 'MESSAGE_TEXT_LOCKED', 'Lời chúc chữ đã khoá')
    }
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
    if (!Object.hasOwn(COLS, kind)) throw validation({ kind: 'INVALID' })
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
    if (!(await stillEditable(order, 'media'))) {
      await repo.upsertGiftMessage(order.id, { [pathCol]: oldPath ?? null, [typeCol]: message?.[typeCol] ?? null })
      await storage.removeObject(path, GIFT_MEDIA_BUCKET).catch(() => {})
      throw new HttpError(409, 'MESSAGE_LOCKED', 'Lời chúc đã khoá')
    }
    if (oldPath && oldPath !== path) await storage.removeObject(oldPath, GIFT_MEDIA_BUCKET).catch(() => {})
    return presentOwner(order, saved)
  }

  async function removeMedia(order, kind) {
    assertAllowed(order)
    if (!Object.hasOwn(COLS, kind)) throw validation({ kind: 'INVALID' })
    const message = await repo.getGiftMessage(order.id)
    if (!editRights(order, message).media) throw new HttpError(409, 'MESSAGE_LOCKED', 'Lời chúc đã khoá')
    const [pathCol, typeCol] = COLS[kind]
    if (!message?.[pathCol]) return presentOwner(order, message)
    const saved = await repo.upsertGiftMessage(order.id, { [pathCol]: null, [typeCol]: null })
    if (!(await stillEditable(order, 'media'))) {
      await repo.upsertGiftMessage(order.id, { [pathCol]: message[pathCol], [typeCol]: message[typeCol] })
      throw new HttpError(409, 'MESSAGE_LOCKED', 'Lời chúc đã khoá')
    }
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

  async function mediaUrls(message, deadline) {
    const out = {}
    const remaining = () => deadline ? Math.min(3600, Math.floor((deadline.getTime() - now().getTime()) / 1000)) : 3600
    for (const [kind, [pathCol, typeCol]] of Object.entries(COLS)) {
      if (!message[pathCol]) continue
      const expiresIn = remaining()
      if (expiresIn <= 0) break
      const ext = message[pathCol].split('.').pop()
      const url = await storage.signedUrl(message[pathCol], GIFT_MEDIA_BUCKET, { expiresIn })
      const downloadTtl = remaining()
      out[kind] = {
        type: message[typeCol],
        url,
        ...(downloadTtl > 0 ? { downloadUrl: await storage.signedUrl(message[pathCol], GIFT_MEDIA_BUCKET, {
          expiresIn: downloadTtl,
          download: `${DOWNLOAD_NAME[kind]}.${ext}`,
        }) } : {}),
      }
    }
    return out
  }

  async function view(token) {
    const order = await openOrder(token)
    const lang = order.qrLang ?? 'vi'
    // §21.4(7): chưa SHIPPED → "đang chuẩn bị", không cho xác nhận
    if (qrAvailability(order.status) === 'preparing') return { state: 'preparing', lang }
    // Hết hạn thì xoá thật ngay khi có người mở (NFR-PRV-003), không chờ cron
    const message = await purgeIfExpired(order, await repo.getGiftMessage(order.id))
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
      media: expired || !hasMedia(message) ? {} : await mediaUrls(message, deadline),
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
    // BR-MSG-006: media đã quá hạn 90 ngày phải bị xoá TRƯỚC khi xác nhận, nếu không bấm xác nhận
    // (không qua GET) sẽ "hồi sinh" thêm 30 ngày đếm ngược
    await purgeIfExpired(order, await repo.getGiftMessage(order.id))
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
    const cursorKey = 'gift_media_cleanup_cursor'
    const previous = await repo.getSetting(cursorKey)
    const after = previous?.value?.after ?? null
    const before = nowIso()
    let candidates = await repo.listGiftMediaCandidates({ before, after, limit: 10 })
    // Wrap only after reaching the end; failed files will be retried next cycle.
    if (!candidates.length && after) candidates = await repo.listGiftMediaCandidates({ before, after: null, limit: 10 })
    let purged = 0
    let next = 0
    const worker = async () => {
      while (next < candidates.length) {
        const { message, order } = candidates[next++]
        if (!mediaExpired(order, message, now())) continue
        let timeout
        let timedOut = false
        try {
          // Storage acknowledgement is still required before media_deleted_at is
          // written. A timeout advances the cursor; uncertain work retries later.
          await Promise.race([
            purgeMedia(order, message),
            new Promise((_, reject) => { timeout = setTimeout(() => { timedOut = true; reject(new Error('MEDIA_CLEANUP_TIMEOUT')) }, cleanupTimeoutMs) }),
          ])
          purged += 1
        } catch {
          console.error('[messages] media cleanup failed; candidate retained for retry')
          // An uncertain Storage request still occupies this worker's slot.
          // Stop that worker rather than accumulating additional hung requests.
          if (timedOut) break
        } finally { clearTimeout(timeout) }
      }
    }
    await Promise.all(Array.from({ length: Math.min(5, candidates.length) }, worker))
    await repo.setSetting(cursorKey, { after: candidates[next - 1]?.message.id ?? null }, null)
    return purged
  }

  return { ownerView, saveText, createMediaUpload, attachMedia, removeMedia, view, confirm, translate, purgeExpiredMedia, presentOwner }
}
