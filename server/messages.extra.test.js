// Kiểm thử độc lập (T-11): lời chúc + trang QR lời chúc — tìm chỗ thiếu của messages.test.js.
// Tên test có tiền tố [BUG] là test đang ĐỎ vì code nguồn sai (giữ nguyên, không hạ kỳ vọng).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMessageService } from './messages/service.js'
import { createOrderService } from './orders/service.js'
import { createMetrics } from './monitoring/metrics.js'
import { GIFT_MEDIA_BUCKET } from './adapters/supabase/storage.js'
import { classifyPath } from '../src/seo/routes.js'
import { CONFIRMED_MEDIA_DAYS, UNCONFIRMED_MEDIA_DAYS, mediaDaysLeft, mediaExpired, messageState } from './domain/message.js'

const DAY = 86_400_000
const baseConfig = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'bimat-cron', rateLimit: { enabled: false } }

let app, repo, auth, storage, may, clock, metrics, customer, other, admin

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}

function build(config = baseConfig) {
  return createApp({
    repo,
    auth,
    storage,
    config,
    may,
    metrics,
    orders: createOrderService({ repo, payos: null, now: () => clock }),
    messages: createMessageService({ repo, storage, may, now: () => clock }),
  })
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  storage = createMemoryStorage()
  clock = new Date('2026-10-01T03:00:00.000Z')
  may = { translate: vi.fn(async ({ text, to }) => `[${to}] ${text}`) }
  metrics = createMetrics({ repo, classify: classifyPath })
  app = build()
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
  provinceCode: '1', wardCode: '4',
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
const toDelivered = async (code) => {
  for (const s of ['in_production', 'packed', 'shipped', 'delivered']) expect((await adminMove(code, s)).status).toBe(200)
}
const tokenOf = async (code) => (await repo.getOrderByCode(code)).qrToken
const idOf = async (code) => (await repo.getOrderByCode(code)).id
const put = (code, body, who = customer) => request(app).put(`/api/orders/${code}/message`).set('Authorization', who.token).send(body)
const confirm = (t) => request(app).post(`/api/qr/${t}/confirm`)

async function uploadMedia(code, kind, contentType, bytes = 'x', who = customer) {
  const up = await request(app)
    .post(`/api/orders/${code}/message/media-upload`)
    .set('Authorization', who.token)
    .send({ kind, contentType, size: bytes.length })
  expect(up.status).toBe(201)
  await request(app).put(up.body.uploadUrl).set('Content-Type', contentType).send(Buffer.from(bytes))
  const at = await request(app).post(`/api/orders/${code}/message/media`).set('Authorization', who.token).send({ kind, path: up.body.path })
  return { up: up.body, attach: at }
}

describe('Token QR sai hình dạng → luôn cùng một 404 (AC-004, BR-QR-001)', () => {
  it('hoa/thường, độ dài, ký tự lạ, nối đôi, __proto__ đều như token không tồn tại — ở cả 3 endpoint', async () => {
    const code = await makeOrder()
    await setStatus(code, 'shipped')
    const real = await tokenOf(code)
    const ghost = 'f'.repeat(64)
    const baseline = await request(app).get(`/api/qr/${ghost}`)
    expect(baseline.status).toBe(404)
    const bad = [
      real.toUpperCase(),
      real.slice(0, 63),
      `${real}a`,
      `${real}${real}`,
      `${real}%0A`,
      `${real}%00`,
      `%20${real}`,
      `${real.slice(0, 63)}g`,
      'ü'.repeat(64),
      '__proto__',
      'constructor',
      '%2e%2e',
      'x'.repeat(5000),
    ]
    for (const t of bad) {
      for (const [method, suffix, body] of [
        ['get', '', undefined],
        ['post', '/confirm', {}],
        ['post', '/translate', { lang: 'en' }],
      ]) {
        const r = await request(app)[method](`/api/qr/${t}${suffix}`).send(body)
        expect(r.status, `${method} ${suffix} ${t.slice(0, 20)}`).toBe(404)
        expect(r.body).toEqual(baseline.body)
      }
    }
    // token thật vẫn dùng được (bài kiểm không làm hỏng trạng thái)
    expect((await request(app).get(`/api/qr/${real}`)).body.item.state).toBe('greeting')
  })

  it('lang của translate là mảng/object/__proto__ → 400, không 500; thân là mảng/null → coi như rỗng', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng', textLang: 'vi' })
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    await confirm(t)
    for (const lang of [['en'], { a: 1 }, '__proto__', 'constructor', 5, null, '', 'EN']) {
      const r = await request(app).post(`/api/qr/${t}/translate`).send({ lang })
      expect(r.status, JSON.stringify(lang)).toBe(400)
    }
    for (const body of [[], null, 'chuoi']) {
      const r = await request(app).post(`/api/qr/${t}/translate`).set('Content-Type', 'application/json').send(JSON.stringify(body))
      expect([400, 415]).toContain(r.status)
    }
    expect(may.translate).not.toHaveBeenCalled()
  })
})

describe('Xác nhận đồng thời và hạn media biên (D-26, D-75)', () => {
  it('6 lượt xác nhận đồng thời → đều 200, confirmedAt chỉ một giá trị', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng' })
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    const rs = await Promise.all(Array.from({ length: 6 }, () => confirm(t)))
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200])
    const gm = await repo.getGiftMessage(await idOf(code))
    expect(gm.confirmedAt).toBe(clock.toISOString())
    // lượt xác nhận muộn không dời mốc
    clock = new Date(clock.getTime() + 5 * DAY)
    await confirm(t)
    expect((await repo.getGiftMessage(await idOf(code))).confirmedAt).toBe('2026-10-01T03:00:00.000Z')
  })

  it('BR-MSG-004: đúng biên 30 ngày từ xác nhận — trước 1ms còn media (còn 1 ngày), đúng 30 ngày thì bị xoá thật', async () => {
    const code = await makeOrder()
    const m = await uploadMedia(code, 'voice', 'audio/mpeg')
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    const t0 = clock.getTime()
    await confirm(t)
    clock = new Date(t0 + 30 * DAY - 1)
    const before = await request(app).get(`/api/qr/${t}`)
    expect(before.body.item.media.voice).toBeTruthy()
    expect(before.body.item).toMatchObject({ mediaDaysLeft: 1, mediaExpired: false })
    clock = new Date(t0 + 30 * DAY)
    const at = await request(app).get(`/api/qr/${t}`)
    expect(at.body.item.media).toEqual({})
    expect(at.body.item).toMatchObject({ mediaExpired: true, mediaDaysLeft: null })
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
  })

  it('BR-MSG-006: đúng biên 90 ngày từ lúc giao — trước 1ms giữ, đúng 90 ngày thì cron xoá', async () => {
    const code = await makeOrder()
    const m = await uploadMedia(code, 'video', 'video/mp4')
    await toDelivered(code)
    const t0 = clock.getTime()
    const purge = () => request(app).get('/api/internal/expire-orders').set('Authorization', 'Bearer bimat-cron')
    clock = new Date(t0 + 90 * DAY - 1)
    expect((await purge()).body.mediaPurged).toBe(0)
    clock = new Date(t0 + 90 * DAY)
    expect((await purge()).body.mediaPurged).toBe(1)
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
  })

  it('hàm thuần: biên expired/daysLeft đúng và không xác nhận + chưa giao → không đếm ngược', () => {
    const order = { deliveredAt: '2026-10-01T00:00:00.000Z' }
    const t0 = Date.parse(order.deliveredAt)
    expect(mediaExpired(order, null, new Date(t0 + UNCONFIRMED_MEDIA_DAYS * DAY - 1))).toBe(false)
    expect(mediaExpired(order, null, new Date(t0 + UNCONFIRMED_MEDIA_DAYS * DAY))).toBe(true)
    const msg = { confirmedAt: '2026-10-05T00:00:00.000Z' }
    const c0 = Date.parse(msg.confirmedAt)
    expect(mediaDaysLeft(order, msg, new Date(c0))).toBe(CONFIRMED_MEDIA_DAYS)
    expect(mediaDaysLeft(order, msg, new Date(c0 + CONFIRMED_MEDIA_DAYS * DAY))).toBe(0)
    expect(mediaDaysLeft(order, msg, new Date(c0 + 99 * DAY))).toBe(0)
    expect(mediaExpired({}, null, new Date('2999-01-01'))).toBe(false)
  })

  it('GET trang QR sau 90 ngày chưa ai xác nhận → xoá thật ngay, không chờ cron (NFR-PRV-003)', async () => {
    const code = await makeOrder()
    const m = await uploadMedia(code, 'voice', 'audio/mpeg')
    await toDelivered(code)
    const t = await tokenOf(code)
    clock = new Date(clock.getTime() + 91 * DAY)
    const v = await request(app).get(`/api/qr/${t}`)
    expect(v.body.item.state).toBe('greeting')
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
  })

  it('[BUG] BR-MSG-006: quá 90 ngày chưa ai xác nhận, POST confirm thẳng (không GET trước, cron chưa chạy) không được "hồi sinh" media thêm 30 ngày', async () => {
    const code = await makeOrder()
    const m = await uploadMedia(code, 'voice', 'audio/mpeg')
    await toDelivered(code)
    const t = await tokenOf(code)
    clock = new Date(clock.getTime() + 91 * DAY)
    const r = await confirm(t)
    expect(r.status).toBe(200)
    expect(r.body.item.media).toEqual({})
    expect(r.body.item.mediaExpired).toBe(true)
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeUndefined()
  })

  it('[BUG] §21.3: lời chúc chỉ có chữ, quá 30 ngày từ xác nhận → trạng thái vẫn ACTIVE (không có media nào để "hết hạn")', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chỉ có chữ' })
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    await confirm(t)
    clock = new Date(clock.getTime() + 31 * DAY)
    const order = await repo.getOrderByCode(code)
    const gm = await repo.getGiftMessage(order.id)
    expect(messageState(order, gm, clock)).toBe('ACTIVE')
    const detail = await request(app).get(`/api/admin/orders/${code}`).set('Authorization', admin.token)
    expect(detail.body.item.message.state).toBe('ACTIVE')
  })
})

describe('Trạng thái đơn đặc biệt', () => {
  it('delivery_failed: khoá hết như SHIPPED (BR-MSG-001), người mua không sửa/tải/gỡ được', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng' })
    await uploadMedia(code, 'voice', 'audio/mpeg')
    await setStatus(code, 'delivery_failed')
    expect((await put(code, { text: 'sửa' })).status).toBe(409)
    const up = await request(app)
      .post(`/api/orders/${code}/message/media-upload`)
      .set('Authorization', customer.token)
      .send({ kind: 'video', contentType: 'video/mp4', size: 5 })
    expect(up.status).toBe(409)
    const rm = await request(app).delete(`/api/orders/${code}/message/media/voice`).set('Authorization', customer.token)
    expect(rm.status).toBe(409)
    const v = await request(app).get(`/api/orders/${code}/message`).set('Authorization', customer.token)
    expect(v.body.item).toMatchObject({ canEditText: false, canEditMedia: false, state: 'LOCKED' })
  })

  it('đơn đã huỷ: mọi thao tác ghi đều 409; QR 404 ở cả view/confirm/translate, kể cả khi đã xác nhận trước khi huỷ', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng', textLang: 'vi' })
    await uploadMedia(code, 'voice', 'audio/mpeg')
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    await confirm(t)
    await setStatus(code, 'cancelled')
    expect((await put(code, { text: 'x' })).status).toBe(409)
    const rm = await request(app).delete(`/api/orders/${code}/message/media/voice`).set('Authorization', customer.token)
    expect(rm.status).toBe(409)
    const up = await request(app)
      .post(`/api/orders/${code}/message/media-upload`)
      .set('Authorization', customer.token)
      .send({ kind: 'voice', contentType: 'audio/mpeg', size: 5 })
    expect(up.status).toBe(409)
    expect((await request(app).get(`/api/qr/${t}`)).status).toBe(404)
    expect((await confirm(t)).status).toBe(404)
    expect((await request(app).post(`/api/qr/${t}/translate`).send({ lang: 'en' })).status).toBe(404)
  })

  it('đơn tự mua không tích lời chúc: mọi endpoint ghi → 409 NO_MESSAGE; QR vẫn mở được trang cảm ơn (D-76)', async () => {
    const code = await makeOrder({ hasMessage: false })
    const get = await request(app).get(`/api/orders/${code}/message`).set('Authorization', customer.token)
    expect(get.body.item).toMatchObject({ allowed: false })
    const up = await request(app)
      .post(`/api/orders/${code}/message/media-upload`)
      .set('Authorization', customer.token)
      .send({ kind: 'voice', contentType: 'audio/mpeg', size: 5 })
    expect(up.status).toBe(409)
    expect(up.body.error.code).toBe('NO_MESSAGE')
    const at = await request(app)
      .post(`/api/orders/${code}/message/media`)
      .set('Authorization', customer.token)
      .send({ kind: 'voice', path: `${await idOf(code)}/voice-1.mp3` })
    expect(at.body.error.code).toBe('NO_MESSAGE')
    const rm = await request(app).delete(`/api/orders/${code}/message/media/voice`).set('Authorization', customer.token)
    expect(rm.body.error.code).toBe('NO_MESSAGE')
    expect(await repo.getGiftMessage(await idOf(code))).toBeNull()
    await setStatus(code, 'shipped')
    const r = await confirm(await tokenOf(code))
    expect(r.status).toBe(200)
    expect(r.body.item.text).toBeFalsy()
  })

  it('đơn Mua tặng luôn có lời chúc dù client gửi hasMessage=false (D-76)', async () => {
    const code = await makeOrder({ orderKind: 'gift', hasMessage: false })
    expect((await put(code, { text: 'Tặng bạn' })).status).toBe(200)
  })
})

describe('Gắn/gỡ media: đầu vào độc hại', () => {
  it('path sai kiểu hoặc cố thoát thư mục → 400, không bao giờ 500', async () => {
    const code = await makeOrder()
    const id = await idOf(code)
    const paths = [
      ['x'],
      { a: 1 },
      5,
      null,
      '',
      `${id}/voice-/../../${id}/x`,
      `${id}/voice-..\\x`,
      `${id}/voice-%2e%2e/x`,
      `${id}/voice-\u0000.mp3`,
      `${id}voice-1.mp3`,
      `/${id}/voice-1.mp3`,
      `${id}/video-1.mp4`, // đường dẫn của kind khác
    ]
    for (const path of paths) {
      const r = await request(app).post(`/api/orders/${code}/message/media`).set('Authorization', customer.token).send({ kind: 'voice', path })
      expect(r.status, JSON.stringify(path)).toBe(400)
    }
  })

  it('đơn của người khác: upload/gắn/gỡ media đều 404 (không đụng media nạn nhân)', async () => {
    const code = await makeOrder()
    const m = await uploadMedia(code, 'voice', 'audio/mpeg')
    const hdr = { Authorization: other.token }
    const up = await request(app).post(`/api/orders/${code}/message/media-upload`).set(hdr).send({ kind: 'voice', contentType: 'audio/mpeg', size: 5 })
    expect(up.status).toBe(404)
    const at = await request(app).post(`/api/orders/${code}/message/media`).set(hdr).send({ kind: 'voice', path: m.up.path })
    expect(at.status).toBe(404)
    const rm = await request(app).delete(`/api/orders/${code}/message/media/voice`).set(hdr)
    expect(rm.status).toBe(404)
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeTruthy()
  })

  it('người khác không gắn được file của mình vào đơn của nạn nhân bằng cách lấy đường dẫn của nạn nhân', async () => {
    const victim = await makeOrder()
    const mine = await makeOrder({}, other)
    const vid = await idOf(victim)
    const up = await request(app)
      .post(`/api/orders/${mine}/message/media-upload`)
      .set('Authorization', other.token)
      .send({ kind: 'voice', contentType: 'audio/mpeg', size: 1 })
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'audio/mpeg').send(Buffer.from('x'))
    // gắn đường dẫn của đơn mình vào đơn của mình rồi thử vào đơn nạn nhân (404 vì không phải của mình)
    const r = await request(app).post(`/api/orders/${victim}/message/media`).set('Authorization', other.token).send({ kind: 'voice', path: up.body.path })
    expect(r.status).toBe(404)
    // chính chủ gắn đường dẫn đơn khác vào đơn mình → 400
    const own = await request(app).post(`/api/orders/${victim}/message/media`).set('Authorization', customer.token).send({ kind: 'voice', path: up.body.path })
    expect(own.status).toBe(400)
    expect((await repo.getGiftMessage(vid))?.voicePath ?? null).toBeNull()
  })

  it('gắn cùng một đường dẫn hai lần → idempotent, file không bị xoá nhầm', async () => {
    const code = await makeOrder()
    const m = await uploadMedia(code, 'voice', 'audio/mpeg')
    const again = await request(app).post(`/api/orders/${code}/message/media`).set('Authorization', customer.token).send({ kind: 'voice', path: m.up.path })
    expect(again.status).toBe(200)
    expect(storage.getObject(m.up.path, GIFT_MEDIA_BUCKET)).toBeTruthy()
    expect(again.body.item.hasVoice).toBe(true)
  })

  it('đổi Content-Type lúc PUT thành HTML → bị từ chối ở bước gắn, file độc không nằm lại trong lời chúc', async () => {
    const code = await makeOrder()
    const up = await request(app)
      .post(`/api/orders/${code}/message/media-upload`)
      .set('Authorization', customer.token)
      .send({ kind: 'video', contentType: 'video/mp4', size: 10 })
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'text/html').send(Buffer.from('<script>alert(1)</script>'))
    const at = await request(app).post(`/api/orders/${code}/message/media`).set('Authorization', customer.token).send({ kind: 'video', path: up.body.path })
    expect(at.status).toBe(400)
    expect((await repo.getGiftMessage(await idOf(code)))?.videoPath ?? null).toBeNull()
  })

  it('[BUG] kind trùng tên thuộc tính của Object ("__proto__", "constructor") khi gỡ media → 400, không phải 500', async () => {
    const code = await makeOrder()
    for (const kind of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const r = await request(app).delete(`/api/orders/${code}/message/media/${kind}`).set('Authorization', customer.token)
      expect(r.status, kind).toBe(400)
    }
  })

  it('[BUG] ký tự điều khiển C1 (U+0080–U+009F) trong lời chúc bị từ chối như ký tự điều khiển khác', async () => {
    const code = await makeOrder()
    for (const ch of ['\u0085', '\u009b', '\u0080', '\u009f']) {
      const r = await put(code, { text: `a${ch}b` })
      expect(r.status, JSON.stringify(ch)).toBe(400)
    }
  })

  it('chữ/ngôn ngữ đầu vào lạ: textLang mảng, body mảng, __proto__ → 400 không 500; chỉ khoảng trắng = xoá chữ', async () => {
    const code = await makeOrder()
    expect((await put(code, { text: 'x', textLang: ['vi'] })).status).toBe(400)
    expect((await put(code, [])).status).toBe(400)
    const proto = await request(app)
      .put(`/api/orders/${code}/message`)
      .set('Authorization', customer.token)
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"text":"x"}}')
    expect(proto.status).toBe(400)
    await put(code, { text: 'có chữ' })
    const cleared = await put(code, { text: '   \n\t ' })
    expect(cleared.body.item).toMatchObject({ text: '', state: 'EMPTY' })
  })

  it('[BUG] TOCTOU: admin chuyển PACKED đúng lúc đang lưu chữ → chữ mới không được ghi vào đơn đã khoá', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Bản đầu' })
    const id = await idOf(code)
    const realGet = repo.getGiftMessage.bind(repo)
    let flipped = false
    repo.getGiftMessage = async (orderId) => {
      const m = await realGet(orderId)
      if (!flipped) {
        flipped = true
        await repo.updateOrder(id, { status: 'packed' }) // admin bấm "Đã đóng gói" giữa lúc kiểm quyền và ghi
      }
      return m
    }
    await put(code, { text: 'Sửa muộn sau khi thiệp đã viết' })
    repo.getGiftMessage = realGet
    expect((await repo.getOrderByCode(code)).status).toBe('packed')
    expect((await repo.getGiftMessage(id)).text).toBe('Bản đầu')
  })
})

describe('Không lộ token/nội dung qua API khác (BR-QR-001, Q-14, Q-27)', () => {
  const HEX64 = /\b[a-f0-9]{64}\b/

  it('POST /orders, GET /orders, danh sách admin và nhật ký đơn không chứa token QR', async () => {
    await request(app).put('/api/cart/items/den-nguyet').set('Authorization', customer.token).send({ quantity: 1 })
    const created = await request(app).post('/api/orders').set('Authorization', customer.token).send(CHECKOUT)
    const code = created.body.order.code
    const token = await tokenOf(code)
    expect(JSON.stringify(created.body)).not.toContain(token)
    await put(code, { text: 'Bí mật lời chúc' })
    await toDelivered(code)
    const list = await request(app).get('/api/orders').set('Authorization', customer.token)
    const alist = await request(app).get('/api/admin/orders').set('Authorization', admin.token)
    const detail = await request(app).get(`/api/admin/orders/${code}`).set('Authorization', admin.token)
    const mine = await request(app).get(`/api/orders/${code}`).set('Authorization', customer.token)
    for (const r of [list, alist, mine]) {
      expect(JSON.stringify(r.body)).not.toContain(token)
      expect(JSON.stringify(r.body)).not.toContain('Bí mật lời chúc')
    }
    // chi tiết đơn của admin: token chỉ nằm trong qrUrl, không nằm trong nhật ký và không có chữ lời chúc
    expect(JSON.stringify(detail.body.audit)).not.toContain(token)
    expect(JSON.stringify(detail.body)).not.toContain('Bí mật lời chúc')
    expect(detail.body.item.qrUrl).toBe(`https://lamvi.test/en/qr/${token}`)
    // khách thường không đọc được chi tiết admin
    expect((await request(app).get(`/api/admin/orders/${code}`).set('Authorization', customer.token)).status).toBe(403)
  })

  it('người mua xem lời chúc của mình: không có đường dẫn Storage, URL ký, token', async () => {
    const code = await makeOrder()
    await uploadMedia(code, 'voice', 'audio/mpeg')
    const v = await request(app).get(`/api/orders/${code}/message`).set('Authorization', customer.token)
    const raw = JSON.stringify(v.body)
    expect(raw).not.toMatch(/voicePath|videoPath|gift-media|dev-storage|signed|\.mp3/i)
    expect(raw).not.toContain(await idOf(code))
    expect(raw).not.toMatch(HEX64)
  })

  it('trang QR chỉ trả đúng các trường công khai — không mã đơn, người nhận, địa chỉ, userId, email', async () => {
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng', textLang: 'vi' })
    await uploadMedia(code, 'voice', 'audio/mpeg')
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    const r = await confirm(t)
    const allowed = ['state', 'lang', 'orderKind', 'text', 'textLang', 'translations', 'media', 'mediaExpired', 'mediaExpiresAt', 'mediaDaysLeft', 'batch']
    expect(Object.keys(r.body.item).filter((k) => !allowed.includes(k))).toEqual([])
    const raw = JSON.stringify(r.body)
    for (const secret of [code, 'Nguyễn Văn A', '0912345678', 'Hàng Bông', customer.id, 'khach@lamvi.test', t]) {
      expect(raw).not.toContain(secret)
    }
  })

  it('lỗi 400/404/409 của QR không phản chiếu token trong thân trả lời', async () => {
    const code = await makeOrder()
    const t = await tokenOf(code)
    const rs = [
      await request(app).get(`/api/qr/${t}`),
      await confirm(t), // 409 chưa gửi
      await request(app).post(`/api/qr/${t}/translate`).send({ lang: 'xx' }),
      await request(app).get(`/api/qr/${'e'.repeat(64)}`),
    ]
    for (const r of rs) expect(JSON.stringify(r.body)).not.toContain(t)
  })

  it('[BUG] nhật ký lỗi 5xx cho IT không chứa token trong đường dẫn /api/qr/:token/…', async () => {
    const code = await makeOrder()
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    repo.getOrderByQrToken = async () => {
      throw new Error('db down')
    }
    for (const [m, suffix] of [
      ['get', ''],
      ['post', '/confirm'],
      ['post', '/translate'],
    ]) {
      const r = await request(app)[m](`/api/qr/${t}${suffix}`).send({ lang: 'en' })
      expect(r.status).toBe(500)
    }
    const errors = await metrics.recentErrors('1h')
    expect(errors.length).toBeGreaterThanOrEqual(3)
    expect(JSON.stringify(errors)).not.toContain(t)
  })
})

describe('Rate limit bật (G-20)', () => {
  const limited = (qr = {}, extra = {}) => ({
    ...baseConfig,
    trustProxy: 1,
    rateLimit: { enabled: true, qr, ...extra },
  })

  it('xác nhận quá hạn mức → 429 + Retry-After; IP khác không bị chặn oan; giá trị rác cũng tính vào IP gây ra', async () => {
    app = build(limited({ 'qr-confirm': { max: 2 } }))
    const code = await makeOrder()
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    const from = (ip, path = `/api/qr/${t}/confirm`) => request(app).post(path).set('X-Forwarded-For', ip).send({})
    expect((await from('10.0.0.1')).status).toBe(200)
    expect((await from('10.0.0.1')).status).toBe(200)
    const blocked = await from('10.0.0.1')
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    // kẻ dò token sai cũng bị đếm theo IP của nó…
    expect((await from('10.0.0.1', `/api/qr/${'a'.repeat(64)}/confirm`)).status).toBe(429)
    // …nhưng người nhận thật ở IP khác vẫn dùng được
    expect((await from('10.0.0.2')).status).toBe(200)
    // và trang xem (nhóm khác) của IP bị chặn xác nhận vẫn mở được
    expect((await request(app).get(`/api/qr/${t}`).set('X-Forwarded-For', '10.0.0.1')).status).toBe(200)
  })

  it('không bật TRUST_PROXY thì giả X-Forwarded-For không lách được hạn mức', async () => {
    app = build({ ...baseConfig, rateLimit: { enabled: true, qr: { 'qr-confirm': { max: 2 } } } })
    const code = await makeOrder()
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    const statuses = []
    for (let i = 0; i < 4; i++) statuses.push((await request(app).post(`/api/qr/${t}/confirm`).set('X-Forwarded-For', `1.2.3.${i}`).send({})).status)
    expect(statuses).toEqual([200, 200, 429, 429])
  })

  it('dịch: hạn mức riêng theo IP; bị chặn thì không gọi AI thêm', async () => {
    app = build(limited({ 'qr-translate': { max: 1 } }))
    const code = await makeOrder()
    await put(code, { text: 'Chúc mừng', textLang: 'vi' })
    await setStatus(code, 'shipped')
    const t = await tokenOf(code)
    await confirm(t)
    const tr = (lang) => request(app).post(`/api/qr/${t}/translate`).set('X-Forwarded-For', '9.9.9.9').send({ lang })
    expect((await tr('en')).status).toBe(200)
    expect((await tr('zh')).status).toBe(429)
    expect(may.translate).toHaveBeenCalledTimes(1)
  })

  it('tải media: hạn mức theo người dùng — người này chạm hạn mức không chặn người khác cùng IP', async () => {
    app = build(limited({}, { order: { max: 2, windowSec: 3600 } }))
    const a = await makeOrder()
    const b = await makeOrder({}, other)
    const upload = (code, who) =>
      request(app).post(`/api/orders/${code}/message/media-upload`).set('Authorization', who.token).send({ kind: 'voice', contentType: 'audio/mpeg', size: 5 })
    expect((await upload(a, customer)).status).toBe(201)
    expect((await upload(a, customer)).status).toBe(201)
    expect((await upload(a, customer)).status).toBe(429)
    expect((await upload(b, other)).status).toBe(201)
  })
})
