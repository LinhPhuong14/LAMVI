// Lời chúc và trang QR lời chúc (FR-MSG-001, FR-ACC-003, FR-QR-002…005, US-003, US-004, §21).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMessageService } from './messages/service.js'
import { createOrderService } from './orders/service.js'
import { HttpError } from './errors.js'
import { GIFT_MEDIA_BUCKET } from './adapters/supabase/storage.js'
import { MESSAGE_MAX_CHARS } from './domain/message.js'

const config = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'bimat-cron', rateLimit: { enabled: false } }
const DAY = 86_400_000

let app, repo, auth, storage, may, clock, customer, other, admin

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'matkhau123' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'matkhau123' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  storage = createMemoryStorage()
  clock = new Date('2026-10-01T03:00:00.000Z')
  may = { translate: vi.fn(async ({ text, to }) => `[${to}] ${text}`) }
  app = createApp({
    repo,
    auth,
    storage,
    config,
    may,
    orders: createOrderService({ repo, payos: null, now: () => clock }),
    messages: createMessageService({ repo, storage, may, now: () => clock }),
  })
  customer = await login('khach@lamvi.test')
  other = await login('khac@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
})

const CHECKOUT = {
  orderKind: 'self',
  hasMessage: true,
  qrLang: 'en',
  recipientIsSelf: true,
  recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678',
  addressLine: '12 Hàng Bông',
  province: 'Hà Nội',
  paymentMethod: 'cod',
}

async function makeOrder(over = {}, who = customer) {
  await request(app).put('/api/cart/items/den-nguyet').set('Authorization', who.token).send({ quantity: 1 })
  const r = await request(app).post('/api/orders').set('Authorization', who.token).send({ ...CHECKOUT, ...over })
  expect(r.status).toBe(201)
  return r.body.order.code
}
const setStatus = async (code, status) => {
  const o = await repo.getOrderByCode(code)
  await repo.updateOrder(o.id, { status })
}
const adminMove = (code, status) =>
  request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin.token).send({ status })
const tokenOf = async (code) => (await repo.getOrderByCode(code)).qrToken
const put = (code, body, who = customer) =>
  request(app).put(`/api/orders/${code}/message`).set('Authorization', who.token).send(body)

// Tải file lên Storage bộ nhớ qua signed URL rồi gắn vào lời chúc
async function uploadMedia(code, kind, contentType, bytes = 'x') {
  const up = await request(app)
    .post(`/api/orders/${code}/message/media-upload`)
    .set('Authorization', customer.token)
    .send({ kind, contentType, size: bytes.length })
  expect(up.status).toBe(201)
  await request(app).put(up.body.uploadUrl).set('Content-Type', contentType).send(Buffer.from(bytes))
  const at = await request(app)
    .post(`/api/orders/${code}/message/media`)
    .set('Authorization', customer.token)
    .send({ kind, path: up.body.path })
  return { up: up.body, attach: at }
}

describe('Token QR (BR-QR-001)', () => {
  it('mỗi đơn có token ngẫu nhiên 64 hex, khác nhau, không lộ ra API khách', async () => {
    const a = await makeOrder()
    const b = await makeOrder()
    const ta = await tokenOf(a)
    expect(ta).toMatch(/^[a-f0-9]{64}$/)
    expect(ta).not.toBe(await tokenOf(b))
    const mine = await request(app).get(`/api/orders/${a}`).set('Authorization', customer.token)
    expect(JSON.stringify(mine.body)).not.toContain(ta)
  })
})

describe('Soạn lời chúc (US-003, FR-ACC-003)', () => {
  it('đơn có lời chúc: lưu chữ, đọc lại; ngôn ngữ mặc định theo ngôn ngữ QR', async () => {
    const code = await makeOrder()
    const before = await request(app).get(`/api/orders/${code}/message`).set('Authorization', customer.token)
    expect(before.body.item).toMatchObject({ allowed: true, state: 'EMPTY', canEditText: true, textLang: 'en' })
    expect(before.body.item.limits.maxChars).toBe(MESSAGE_MAX_CHARS)
    const r = await put(code, { text: '  Chúc mừng  ' })
    expect(r.status).toBe(200)
    expect(r.body.item).toMatchObject({ text: 'Chúc mừng', state: 'DRAFT', textLang: 'en' })
  })

  it('đơn tự mua không tích "Thêm lời chúc" → 409 NO_MESSAGE (D-14, BR-MSG-002)', async () => {
    const code = await makeOrder({ hasMessage: false })
    const r = await put(code, { text: 'xin chào' })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('NO_MESSAGE')
  })

  it('giới hạn ký tự đếm theo ký tự hiển thị; ký tự điều khiển bị từ chối', async () => {
    const code = await makeOrder()
    expect((await put(code, { text: '😀'.repeat(MESSAGE_MAX_CHARS) })).status).toBe(200)
    const long = await put(code, { text: 'a'.repeat(MESSAGE_MAX_CHARS + 1) })
    expect(long.status).toBe(400)
    expect(long.body.error.fields.text).toBe('TOO_LONG')
    expect((await put(code, { text: 'a\u0000b' })).body.error.fields.text).toBe('INVALID')
    expect((await put(code, { text: 5 })).status).toBe(400)
    expect((await put(code, { text: 'ok', textLang: 'fr' })).body.error.fields.textLang).toBe('INVALID')
  })

  it('đơn của người khác → 404; chưa đăng nhập → 401', async () => {
    const code = await makeOrder()
    expect((await put(code, { text: 'x' }, other)).status).toBe(404)
    expect((await request(app).get(`/api/orders/${code}/message`).set('Authorization', other.token)).status).toBe(404)
    expect((await request(app).put(`/api/orders/${code}/message`).send({ text: 'x' })).status).toBe(401)
  })

  it('AC-002 BR-MSG-008: PACKED khoá chữ nhưng vẫn sửa được media; AC-003 BR-MSG-001: SHIPPED khoá hết', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng' })
    await setStatus(code, 'packed')
    const locked = await put(code, { text: 'sửa' })
    expect(locked.status).toBe(409)
    expect(locked.body.error.code).toBe('MESSAGE_TEXT_LOCKED')
    expect((await uploadMedia(code, 'voice', 'audio/mpeg')).attach.status).toBe(200)
    await setStatus(code, 'shipped')
    const up = await request(app)
      .post(`/api/orders/${code}/message/media-upload`)
      .set('Authorization', customer.token)
      .send({ kind: 'voice', contentType: 'audio/mpeg', size: 10 })
    expect(up.status).toBe(409)
    expect(up.body.error.code).toBe('MESSAGE_LOCKED')
    const view = await request(app).get(`/api/orders/${code}/message`).set('Authorization', customer.token)
    expect(view.body.item).toMatchObject({ canEditText: false, canEditMedia: false, state: 'LOCKED' })
  })

  it('đơn đã huỷ không sửa được', async () => {
    const code = await makeOrder()
    await setStatus(code, 'cancelled')
    expect((await put(code, { text: 'x' })).status).toBe(409)
  })
})

describe('Tải media (FR-MSG-001)', () => {
  it('giọng nói + video: tải lên, gắn, xoá; file nằm trong bucket riêng tư', async () => {
    const code = await makeOrder()
    const v = await uploadMedia(code, 'voice', 'audio/mpeg')
    expect(v.attach.body.item).toMatchObject({ hasVoice: true, hasVideo: false })
    expect(storage.getObject(v.up.path, GIFT_MEDIA_BUCKET)).toBeTruthy()
    const vid = await uploadMedia(code, 'video', 'video/mp4')
    expect(vid.attach.body.item).toMatchObject({ hasVoice: true, hasVideo: true })
    const del = await request(app).delete(`/api/orders/${code}/message/media/voice`).set('Authorization', customer.token)
    expect(del.body.item).toMatchObject({ hasVoice: false, hasVideo: true })
    expect(storage.getObject(v.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
  })

  it('thay media cũ → file cũ bị xoá khỏi Storage', async () => {
    const code = await makeOrder()
    const first = await uploadMedia(code, 'video', 'video/mp4')
    const second = await uploadMedia(code, 'video', 'video/webm')
    expect(second.attach.status).toBe(200)
    expect(storage.getObject(first.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
    expect(storage.getObject(second.up.path, GIFT_MEDIA_BUCKET)).toBeTruthy()
  })

  it('từ chối kiểu file sai, quá cỡ, kind lạ', async () => {
    const code = await makeOrder()
    const call = (b) =>
      request(app).post(`/api/orders/${code}/message/media-upload`).set('Authorization', customer.token).send(b)
    expect((await call({ kind: 'voice', contentType: 'video/mp4', size: 10 })).body.error.fields.contentType).toBe('INVALID_MEDIA_TYPE')
    expect((await call({ kind: 'video', contentType: 'video/mp4', size: 101 * 1024 * 1024 })).body.error.fields.size).toBe('MEDIA_TOO_LARGE')
    expect((await call({ kind: 'voice', contentType: 'audio/mpeg', size: 21 * 1024 * 1024 })).body.error.fields.size).toBe('MEDIA_TOO_LARGE')
    expect((await call({ kind: 'gif', contentType: 'audio/mpeg', size: 10 })).body.error.fields.kind).toBe('INVALID')
    expect((await call({ kind: '__proto__', contentType: 'toString', size: 10 })).status).toBe(400)
  })

  it('gắn đường dẫn chưa tải / của đơn khác / có ".." → 400; kiểu thật khác khai báo → 400', async () => {
    const a = await makeOrder()
    const b = await makeOrder()
    const attach = (code, path, kind = 'voice') =>
      request(app).post(`/api/orders/${code}/message/media`).set('Authorization', customer.token).send({ kind, path })
    const orderB = await repo.getOrderByCode(b)
    expect((await attach(a, `${(await repo.getOrderByCode(a)).id}/voice-1-aa.mp3`)).body.error.fields.path).toBe('MEDIA_NOT_UPLOADED')
    expect((await attach(a, `${orderB.id}/voice-1-aa.mp3`)).body.error.fields.path).toBe('INVALID')
    expect((await attach(a, `${(await repo.getOrderByCode(a)).id}/voice-../x`)).status).toBe(400)
    // PUT với Content-Type video nhưng đã xin upload là audio
    const up = await request(app)
      .post(`/api/orders/${a}/message/media-upload`)
      .set('Authorization', customer.token)
      .send({ kind: 'voice', contentType: 'audio/mpeg', size: 3 })
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'text/html').send(Buffer.from('abc'))
    expect((await attach(a, up.body.path)).body.error.fields.contentType).toBe('INVALID_MEDIA_TYPE')
  })
})

describe('Trang QR cho người nhận (US-004, §21.4)', () => {
  it('AC-004: token sai hình, không tồn tại, hay đơn đã huỷ → cùng một 404', async () => {
    const code = await makeOrder()
    const t = await tokenOf(code)
    const bad = await request(app).get('/api/qr/abc')
    const none = await request(app).get(`/api/qr/${'0'.repeat(64)}`)
    expect(bad.status).toBe(404)
    expect(none.status).toBe(404)
    expect(none.body).toEqual(bad.body)
    await setStatus(code, 'cancelled')
    const cancelled = await request(app).get(`/api/qr/${t}`)
    expect(cancelled.status).toBe(404)
    expect(cancelled.body).toEqual(bad.body)
    expect((await request(app).post(`/api/qr/${t}/confirm`)).status).toBe(404)
  })

  it('§21.4(7): trước SHIPPED hiện "đang chuẩn bị", không cho xác nhận, không lộ chữ', async () => {
    const code = await makeOrder()
    await put(code, { text: 'bí mật' })
    const t = await tokenOf(code)
    for (const s of ['confirmed', 'in_production', 'packed']) {
      await setStatus(code, s)
      const r = await request(app).get(`/api/qr/${t}`)
      expect(r.body.item).toEqual({ state: 'preparing', lang: 'en' })
      const c = await request(app).post(`/api/qr/${t}/confirm`)
      expect(c.status).toBe(409)
      expect(c.body.error.code).toBe('GIFT_NOT_READY')
    }
    expect(await repo.getGiftMessage((await repo.getOrderByCode(code)).id)).toMatchObject({ confirmedAt: null })
  })

  it('AC-001: SHIPPED, chưa xác nhận → chỉ lời chào, không có chữ/media/token trả về', async () => {
    const code = await makeOrder()
    await put(code, { text: 'bí mật' })
    await uploadMedia(code, 'voice', 'audio/mpeg')
    await setStatus(code, 'shipped')
    const r = await request(app).get(`/api/qr/${await tokenOf(code)}`)
    expect(r.body.item).toEqual({ state: 'greeting', lang: 'en', orderKind: 'self' })
    expect(JSON.stringify(r.body)).not.toContain('bí mật')
  })

  it('AC-002: bấm xác nhận → hiện chữ + media + đếm ngược 30 ngày; chỉ ghi confirmedAt lần đầu; đơn không đổi trạng thái (Q-18)', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng sinh nhật', textLang: 'vi' })
    await uploadMedia(code, 'voice', 'audio/mpeg')
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    // BR-MSG-007: mở nhiều lần trước khi xác nhận không bắt đầu đếm ngược
    await request(app).get(`/api/qr/${t}`)
    await request(app).get(`/api/qr/${t}`)
    const c1 = await request(app).post(`/api/qr/${t}/confirm`)
    expect(c1.body.item).toMatchObject({ state: 'active', text: 'Chúc mừng sinh nhật', textLang: 'vi', mediaDaysLeft: 30, mediaExpired: false })
    expect(c1.body.item.media.voice.url).toMatch(/dev-storage/)
    expect(c1.body.item.media.voice.downloadUrl).toMatch(/download=/)
    const first = (await repo.getGiftMessage((await repo.getOrderByCode(code)).id)).confirmedAt
    clock = new Date(clock.getTime() + 5 * DAY)
    const c2 = await request(app).post(`/api/qr/${t}/confirm`)
    expect((await repo.getGiftMessage((await repo.getOrderByCode(code)).id)).confirmedAt).toBe(first)
    expect(c2.body.item.mediaDaysLeft).toBe(25)
    expect((await repo.getOrderByCode(code)).status).toBe('shipped')
    // các lần sau: vào thẳng nội dung
    expect((await request(app).get(`/api/qr/${t}`)).body.item.state).toBe('active')
  })

  it('AC-003 BR-MSG-004: quá 30 ngày từ xác nhận → media bị xoá thật, còn lại chữ + thông báo', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Giữ mãi' })
    const m = await uploadMedia(code, 'video', 'video/mp4')
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    await request(app).post(`/api/qr/${t}/confirm`)
    clock = new Date(clock.getTime() + 30 * DAY - 1000)
    expect((await request(app).get(`/api/qr/${t}`)).body.item.media.video).toBeTruthy()
    clock = new Date(clock.getTime() + 2000)
    const r = await request(app).get(`/api/qr/${t}`)
    expect(r.body.item).toMatchObject({ state: 'active', text: 'Giữ mãi', media: {}, mediaExpired: true, mediaDaysLeft: null })
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
    // BR-MSG-003: chữ còn mãi
    clock = new Date(clock.getTime() + 400 * DAY)
    expect((await request(app).get(`/api/qr/${t}`)).body.item.text).toBe('Giữ mãi')
  })

  it('BR-MSG-006 D-75: không ai xác nhận → cron xoá media 90 ngày sau khi giao thành công', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chữ ở lại' })
    const m = await uploadMedia(code, 'voice', 'audio/mpeg')
    for (const s of ['in_production', 'packed', 'shipped', 'delivered']) expect((await adminMove(code, s)).status).toBe(200)
    expect((await repo.getOrderByCode(code)).deliveredAt).toBe(clock.toISOString())
    const purge = () => request(app).get('/api/internal/expire-orders').set('Authorization', 'Bearer bimat-cron')
    clock = new Date(clock.getTime() + 89 * DAY)
    expect((await purge()).body.mediaPurged).toBe(0)
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeTruthy()
    clock = new Date(clock.getTime() + 1 * DAY + 1000)
    expect((await purge()).body.mediaPurged).toBe(1)
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
    expect((await purge()).body.mediaPurged).toBe(0)
    const gm = await repo.getGiftMessage((await repo.getOrderByCode(code)).id)
    expect(gm).toMatchObject({ text: 'Chữ ở lại', voicePath: null })
    expect(gm.mediaDeletedAt).toBeTruthy()
  })

  it('đơn có lời chúc nhưng người mua chưa soạn gì (D-76) → QR dẫn tới video mẻ đèn', async () => {
    const code = await makeOrder()
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    const r = await request(app).post(`/api/qr/${t}/confirm`)
    expect(r.status).toBe(200)
    expect(r.body.item).toMatchObject({ state: 'active', text: null })
    expect(r.body.item.batch === null || typeof r.body.item.batch.code === 'string').toBe(true)
  })

  it('media đã xoá: người mua không tải thêm được (đơn đã SHIPPED)', async () => {
    const code = await makeOrder()
    await uploadMedia(code, 'voice', 'audio/mpeg')
    await setStatus(code, 'shipped')
    const up = await request(app)
      .post(`/api/orders/${code}/message/media-upload`)
      .set('Authorization', customer.token)
      .send({ kind: 'voice', contentType: 'audio/mpeg', size: 5 })
    expect(up.status).toBe(409)
  })
})

describe('Dịch tự động (FR-QR-005, BR-MSG-005, G-31)', () => {
  async function shippedConfirmed(text = 'Chúc mừng') {
    const code = await makeOrder()
    await put(code, { text, textLang: 'vi' })
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    await request(app).post(`/api/qr/${t}/confirm`)
    return { code, t }
  }
  const tr = (t, lang) => request(app).post(`/api/qr/${t}/translate`).send({ lang })

  it('dịch sang ngôn ngữ đích, cache lại: lần hai không gọi AI; bản gốc không đổi', async () => {
    const { t } = await shippedConfirmed()
    const a = await tr(t, 'en')
    expect(a.body.item).toEqual({ lang: 'en', text: '[en] Chúc mừng', cached: false })
    const b = await tr(t, 'en')
    expect(b.body.item.cached).toBe(true)
    expect(may.translate).toHaveBeenCalledTimes(1)
    expect(may.translate).toHaveBeenCalledWith({ text: 'Chúc mừng', from: 'vi', to: 'en' })
    const view = await request(app).get(`/api/qr/${t}`)
    expect(view.body.item.text).toBe('Chúc mừng')
    expect(view.body.item.translations).toEqual({ en: '[en] Chúc mừng' })
  })

  it('cùng ngôn ngữ gốc → không gọi AI; ngôn ngữ lạ → 400', async () => {
    const { t } = await shippedConfirmed()
    expect((await tr(t, 'vi')).body.item).toMatchObject({ text: 'Chúc mừng', cached: true })
    expect(may.translate).not.toHaveBeenCalled()
    expect((await tr(t, 'fr')).status).toBe(400)
  })

  it('chưa xác nhận hoặc token sai → 404 (không dịch được nội dung chưa được mở)', async () => {
    const code = await makeOrder()
    await put(code, { text: 'riêng tư' })
    await setStatus(code, 'shipped')
    expect((await tr(await tokenOf(code), 'en')).status).toBe(404)
    expect((await tr('0'.repeat(64), 'en')).status).toBe(404)
    expect(may.translate).not.toHaveBeenCalled()
  })

  it('AI hết ngân sách/lỗi → 503 TRANSLATE_UNAVAILABLE, trang vẫn xem được bản gốc, không cache lỗi', async () => {
    const { t } = await shippedConfirmed('bản gốc')
    may.translate.mockRejectedValueOnce(new HttpError(503, 'TRANSLATE_UNAVAILABLE', 'Chưa dịch được'))
    const fail = await tr(t, 'zh')
    expect(fail.status).toBe(503)
    expect(fail.body.error.code).toBe('TRANSLATE_UNAVAILABLE')
    const view = await request(app).get(`/api/qr/${t}`)
    expect(view.body.item).toMatchObject({ text: 'bản gốc', translations: {} })
    expect((await tr(t, 'zh')).body.item.text).toBe('[zh] bản gốc')
  })
})

describe('Admin thấy gì về lời chúc (Q-14 mặc định an toàn)', () => {
  it('chi tiết đơn có cờ + URL QR theo ngôn ngữ người mua, KHÔNG có nội dung chữ', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Lời riêng tư của khách', textLang: 'zh' })
    await uploadMedia(code, 'video', 'video/mp4')
    const t = await tokenOf(code)
    const r = await request(app).get(`/api/admin/orders/${code}`).set('Authorization', admin.token)
    expect(r.body.item.message).toMatchObject({ state: 'DRAFT', hasText: true, textLang: 'zh', hasVideo: true, hasVoice: false })
    expect(r.body.item.qrUrl).toBe(`https://lamvi.test/en/qr/${t}`)
    expect(JSON.stringify(r.body)).not.toContain('Lời riêng tư')
  })

  it('đơn không có lời chúc → message null', async () => {
    const code = await makeOrder({ hasMessage: false })
    const r = await request(app).get(`/api/admin/orders/${code}`).set('Authorization', admin.token)
    expect(r.body.item.message).toBeNull()
  })

  it('khách không đọc được qrUrl/token qua danh sách đơn của mình', async () => {
    const code = await makeOrder()
    const t = await tokenOf(code)
    const list = await request(app).get('/api/orders').set('Authorization', customer.token)
    expect(JSON.stringify(list.body)).not.toContain(t)
    expect((await request(app).get(`/api/admin/orders/${code}`).set('Authorization', customer.token)).status).toBe(403)
  })
})
