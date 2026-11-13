// Kiểm thử độc lập (T-11) cho phong thư riêng của đơn (D-134) + QR subdomain (D-135).
// Bổ sung cho server/letters.test.js: quyền admin từng endpoint, rò token, chuỗi rotate/unpublish,
// thư viện QR, kiểm tra nội dung, giả mạo Host/đường dẫn dưới subdomain, SSR /thu riêng tư.
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { SLUG_RE, TOKEN_RE, generateSlug, generateToken, letterUrl, tokenMatches, validateLetterContent, LIMITS } from './domain/letter.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'

const base = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } }
let app, repo, auth, customer, admin, it_

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}

// web giả: ghi lại đường dẫn nào lọt tới tầng trang web (SSR) để biết subdomain có chặn đúng không
const webHits = []
function fakeWeb() {
  const r = express.Router()
  r.get(/.*/, (req, res) => {
    webHits.push({ host: req.hostname, path: req.path })
    res.type('text/plain').send(`WEB ${req.path}`)
  })
  return r
}

function build(config = base) {
  return createApp({ repo, auth, storage: createMemoryStorage(), config, orders: createOrderService({ repo, payos: null }), web: fakeWeb() })
}

beforeEach(async () => {
  webHits.length = 0
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = build()
  customer = await login('khach@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
  it_ = await login('it@lamvi.test', 'it')
})
afterEach(() => vi.useRealTimers())

const CHECKOUT = {
  orderKind: 'self', hasMessage: true, qrLang: 'vi', recipientIsSelf: true, recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678', addressLine: '12 Hàng Bông', provinceCode: '1', wardCode: '4', paymentMethod: 'cod',
}
async function makeOrder() {
  await request(app).put('/api/cart/items/den-nguyet').set('Authorization', customer.token).send({ quantity: 1 })
  const r = await request(app).post('/api/orders').set('Authorization', customer.token).send(CHECKOUT)
  expect(r.status).toBe(201)
  return r.body.order.code
}

const CONTENT = {
  recipientName: 'Linh',
  senderName: 'An',
  occasion: 'birthday',
  kind: 'text',
  message: 'Đoạn một.\n\nĐoạn hai.',
  postscript: 'Nhớ bật đèn nhé',
  occasionData: { message: 'Tuổi mới rực rỡ' },
}
const adminApi = (method, path, who = admin) => request(app)[method](`/api${path}`).set('Authorization', who.token)
const partsOf = (url) => {
  const u = new URL(url)
  const slug = u.pathname.startsWith('/thu/') ? u.pathname.slice(5) : u.hostname.split('.')[0]
  return { slug, token: u.hash.slice(1) }
}
const open = (body, host) => {
  const r = request(app).post('/api/letters/open')
  if (host) r.set('Host', host)
  return r.send(body)
}
async function publishedOrder(content = CONTENT) {
  const code = await makeOrder()
  expect((await adminApi('put', `/admin/orders/${code}/letter`).send({ content })).status).toBe(200)
  const pub = await adminApi('post', `/admin/orders/${code}/letter/publish`)
  expect(pub.status).toBe(200)
  return { code, url: pub.body.item.url, ...partsOf(pub.body.item.url) }
}

describe('Quyền admin trên mọi endpoint phong thư', () => {
  const endpoints = (code) => [
    ['get', `/admin/orders/${code}/letter`],
    ['put', `/admin/orders/${code}/letter`],
    ['post', `/admin/orders/${code}/letter/publish`],
    ['post', `/admin/orders/${code}/letter/unpublish`],
    ['post', `/admin/orders/${code}/letter/rotate`],
    ['get', '/admin/letters'],
  ]

  it('không đăng nhập → 401, khách thường → 403 (kể cả biến thể hoa/thường, dấu / cuối)', async () => {
    const code = await makeOrder()
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    for (const [m, p] of endpoints(code)) {
      for (const path of [p, `${p}/`, p.replace('/letter', '/LETTER').replace('/letters', '/LETTERS')]) {
        const anon = await request(app)[m](`/api${path}`).send({ content: CONTENT })
        expect([401, 404], `${m} ${path} (ẩn danh)`).toContain(anon.status)
        expect(anon.status === 404 && path === p, `${m} ${path} không được 404 khi đúng đường dẫn`).toBe(false)
        const cus = await adminApi(m, path, customer).send({ content: CONTENT })
        expect([403, 404], `${m} ${path} (khách)`).toContain(cus.status)
        expect(JSON.stringify(cus.body)).not.toMatch(/[A-Za-z0-9_-]{43}/)
      }
    }
    // Khách không làm thay đổi được thư
    const after = await adminApi('get', `/admin/orders/${code}/letter`)
    expect(after.body.item.status).toBe('draft')
    expect(after.body.item.slug).toBeNull()
  })

  it('mã đơn không tồn tại → 404 ở mọi endpoint của đơn', async () => {
    for (const [m, p] of endpoints('LV-KHONGCO').slice(0, 5)) {
      const r = await adminApi(m, p).send({ content: CONTENT })
      expect(r.status, `${m} ${p}`).toBe(404)
    }
  })

  it('gỡ xuất bản / tạo QR mới khi đơn chưa có thư → 404, không tạo dòng thư rỗng', async () => {
    const code = await makeOrder()
    expect((await adminApi('post', `/admin/orders/${code}/letter/unpublish`)).status).toBe(404)
    expect((await adminApi('post', `/admin/orders/${code}/letter/rotate`)).status).toBe(404)
    expect((await adminApi('get', `/admin/orders/${code}/letter`)).body.item).toBeNull()
    expect((await adminApi('get', '/admin/letters')).body.items).toEqual([])
  })
})

describe('Không rò token', () => {
  it('PUT không cho chèn slug/token/status/openedAt qua body', async () => {
    const code = await makeOrder()
    const evilToken = 'A'.repeat(43)
    const r = await adminApi('put', `/admin/orders/${code}/letter`).send({
      content: { ...CONTENT, slug: 'aaaaaaaaaa', token: evilToken, status: 'published' },
      slug: 'aaaaaaaaaa',
      token: evilToken,
      status: 'published',
      openedAt: '2020-01-01T00:00:00Z',
    })
    expect(r.status).toBe(200)
    expect(r.body.item).toMatchObject({ status: 'draft', slug: null, url: null, openedAt: null })
    expect(r.body.item.content).not.toHaveProperty('token')
    expect(r.body.item.content).not.toHaveProperty('slug')
    expect((await open({ slug: 'aaaaaaaaaa', token: evilToken })).status).toBe(404)
  })

  it('phản hồi admin, thư viện, người nhận và nhật ký kiểm toán không có trường token rời', async () => {
    const { code, token, slug } = await publishedOrder()
    await adminApi('post', `/admin/orders/${code}/letter/unpublish`)
    await adminApi('post', `/admin/orders/${code}/letter/publish`)
    const rot = await adminApi('post', `/admin/orders/${code}/letter/rotate`)
    const fresh = partsOf(rot.body.item.url)

    const item = (await adminApi('get', `/admin/orders/${code}/letter`)).body.item
    expect(item).not.toHaveProperty('token')
    const g = (await adminApi('get', '/admin/letters')).body.items[0]
    expect(g).not.toHaveProperty('token')
    const o = await open(fresh)
    expect(o.status).toBe(200)
    expect(JSON.stringify(o.body)).not.toContain(fresh.token)
    expect(JSON.stringify(o.body)).not.toContain(fresh.slug)
    expect(o.headers['referrer-policy']).toBe('no-referrer')
    expect(o.headers['cache-control']).toBe('no-store')

    const audits = (await repo.listAuditLog?.({ limit: 100 })) ?? []
    const log = JSON.stringify(audits)
    for (const secret of [token, fresh.token]) expect(log).not.toContain(secret)
    expect(log).not.toContain(slug)
    expect(log).not.toContain('Đoạn một')
  })

  it('404 giống hệt nhau cho mọi lý do (không dò được)', async () => {
    const a = await publishedOrder()
    const b = await publishedOrder()
    await adminApi('post', `/admin/orders/${b.code}/letter/unpublish`)
    const c = await publishedOrder()
    await repo.updateOrder((await repo.getOrderByCode(c.code)).id, { status: 'cancelled' })

    const bodies = []
    for (const body of [
      { slug: a.slug, token: 'B'.repeat(43) }, // sai token
      { slug: 'qqqqqqqqqq', token: a.token }, // slug không tồn tại
      b, // gỡ xuất bản
      c, // đơn huỷ
      { slug: a.slug, token: b.token }, // token của thư khác
      { slug: a.slug.toUpperCase(), token: a.token }, // hoa/thường
      { slug: a.slug, token: `${a.token}=` }, // token dài hơn
      { slug: a.slug, token: a.token.slice(0, 42) }, // token ngắn hơn
      { slug: a.slug, token: 12345 },
      { slug: [a.slug], token: [a.token] },
      { slug: { $ne: null }, token: { $ne: null } },
    ]) {
      const r = await open(body)
      expect(r.status, JSON.stringify(body)).toBe(404)
      bodies.push(JSON.stringify(r.body))
    }
    expect(new Set(bodies).size).toBe(1)
  })

  it('body không phải object (mảng, chuỗi, rỗng) → 4xx, không mở thư, không 500', async () => {
    const { slug, token } = await publishedOrder()
    expect((await request(app).post('/api/letters/open').send([{ slug, token }])).status).toBe(404)
    // express.json strict từ chối JSON không phải object/mảng → 400 (chấp nhận được, không lộ gì)
    expect((await request(app).post('/api/letters/open').set('Content-Type', 'application/json').send('"x"')).status).toBe(400)
    expect((await request(app).post('/api/letters/open').set('Content-Type', 'text/plain').send(`slug=${slug}`)).status).toBe(404)
    expect((await request(app).post('/api/letters/open')).status).toBe(404)
  })

  it('token chỉ nhận qua body POST: GET hoặc query string không mở được thư', async () => {
    const { slug, token } = await publishedOrder()
    expect((await request(app).get(`/api/letters/open?slug=${slug}&token=${token}`)).status).toBe(404)
    expect((await request(app).post(`/api/letters/open?slug=${slug}&token=${token}`).send({})).status).toBe(404)
  })

  it('tokenMatches: kiểu sai / độ dài sai / expected rỗng → false', () => {
    const t = generateToken()
    expect(TOKEN_RE.test(t)).toBe(true)
    expect(tokenMatches(t, t)).toBe(true)
    expect(tokenMatches(t, null)).toBe(false)
    expect(tokenMatches(null, t)).toBe(false)
    expect(tokenMatches(`${t} `, t)).toBe(false)
    expect(tokenMatches(t.slice(1), t.slice(1))).toBe(false) // sai định dạng thì không bao giờ khớp
  })

  it('generateSlug luôn khớp SLUG_RE và không lặp trong 2000 lần', () => {
    const seen = new Set()
    for (let i = 0; i < 2000; i++) {
      const s = generateSlug()
      expect(SLUG_RE.test(s), s).toBe(true)
      seen.add(s)
    }
    expect(seen.size).toBe(2000)
  })
})

describe('Chuỗi xuất bản / gỡ / tạo QR mới', () => {
  it('lần mở đầu tiên chỉ ghi một lần', async () => {
    // Lùi giờ (không tiến quá 1 giờ: phiên đăng nhập bộ nhớ hết hạn sau 1 giờ)
    vi.useFakeTimers({ toFake: ['Date'] })
    const t0 = Date.now() - 30 * 60_000
    vi.setSystemTime(t0)
    const { code, slug, token } = await publishedOrder()
    expect((await open({ slug, token })).status).toBe(200)
    vi.setSystemTime(t0 + 20 * 60_000)
    expect((await open({ slug, token })).status).toBe(200)
    expect((await adminApi('get', `/admin/orders/${code}/letter`)).body.item.openedAt).toBe(new Date(t0).toISOString())
  })

  it('mở sai token không đánh dấu đã mở', async () => {
    const { code, slug } = await publishedOrder()
    await open({ slug, token: 'C'.repeat(43) })
    expect((await adminApi('get', `/admin/orders/${code}/letter`)).body.item.openedAt).toBeNull()
  })

  it('tạo QR mới khi đang gỡ xuất bản: vẫn 404 tới khi xuất bản lại, rồi chỉ QR mới mở được', async () => {
    const first = await publishedOrder()
    await adminApi('post', `/admin/orders/${first.code}/letter/unpublish`)
    const rot = await adminApi('post', `/admin/orders/${first.code}/letter/rotate`)
    expect(rot.status).toBe(200)
    expect(rot.body.item).toMatchObject({ status: 'draft', url: null })
    const newSlug = rot.body.item.slug
    expect(newSlug).not.toBe(first.slug)

    const pub = await adminApi('post', `/admin/orders/${first.code}/letter/publish`)
    const fresh = partsOf(pub.body.item.url)
    expect(fresh.slug).toBe(newSlug)
    expect((await open(first)).status).toBe(404)
    expect((await open({ slug: first.slug, token: fresh.token })).status).toBe(404)
    expect((await open({ slug: fresh.slug, token: first.token })).status).toBe(404)
    expect((await open(fresh)).status).toBe(200)
  })

  it('xuất bản lại giữ publishedAt lần đầu; sửa nội dung không đổi slug/token', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t0 = Date.now() - 30 * 60_000
    vi.setSystemTime(t0)
    const { code, url } = await publishedOrder()
    vi.setSystemTime(t0 + 20 * 60_000)
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: { ...CONTENT, occasion: 'milestone', occasionData: { label: 'Tốt nghiệp' } } })
    await adminApi('post', `/admin/orders/${code}/letter/unpublish`)
    const re = await adminApi('post', `/admin/orders/${code}/letter/publish`)
    expect(re.body.item.url).toBe(url)
    expect(re.body.item.publishedAt).toBe(new Date(t0).toISOString())
    const o = await open(partsOf(url))
    expect(o.body.item).toMatchObject({ occasion: 'milestone', occasionData: { label: 'Tốt nghiệp' } })
  })

  it('PUT nội dung lỗi khi thư đang xuất bản → 400 và người nhận vẫn thấy bản cũ', async () => {
    const { code, slug, token } = await publishedOrder()
    const bad = await adminApi('put', `/admin/orders/${code}/letter`).send({ content: { ...CONTENT, message: '' } })
    expect(bad.status).toBe(400)
    expect((await open({ slug, token })).body.item.message).toEqual(['Đoạn một.', 'Đoạn hai.'])
  })

  it('đơn huỷ sau khi xuất bản rồi khôi phục: mở lại được với cùng QR', async () => {
    const { code, slug, token } = await publishedOrder()
    const o = await repo.getOrderByCode(code)
    await repo.updateOrder(o.id, { status: 'cancelled' })
    expect((await open({ slug, token })).status).toBe(404)
    await repo.updateOrder(o.id, { status: 'confirmed' })
    expect((await open({ slug, token })).status).toBe(200)
  })

  it('role IT (thuộc ADMIN_ROLES) thao tác được như admin', async () => {
    const code = await makeOrder()
    expect((await adminApi('put', `/admin/orders/${code}/letter`, it_).send({ content: CONTENT })).status).toBe(200)
    expect((await adminApi('get', '/admin/letters', it_)).status).toBe(200)
  })
})

describe('Thư viện QR', () => {
  it('chỉ liệt kê thư đã có QR, mới nhất trước, kèm trạng thái đơn; QR in lại khớp QR đang chạy', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T00:00:00Z'))
    const older = await publishedOrder()
    vi.setSystemTime(new Date('2026-11-12T00:00:00Z'))
    const newer = await publishedOrder({ ...CONTENT, recipientName: 'Minh' })
    vi.setSystemTime(new Date('2026-11-13T00:00:00Z'))
    const draftOnly = await makeOrder()
    await adminApi('put', `/admin/orders/${draftOnly}/letter`).send({ content: CONTENT })
    await repo.updateOrder((await repo.getOrderByCode(older.code)).id, { status: 'cancelled' })

    const items = (await adminApi('get', '/admin/letters')).body.items
    expect(items.map((i) => i.orderCode)).toEqual([newer.code, older.code])
    expect(items[0]).toMatchObject({ recipientName: 'Minh', senderName: 'An', occasion: 'birthday', status: 'published', url: newer.url })
    expect(items[1].orderStatus).toBe('cancelled')
    for (const i of items) expect(Object.keys(i).sort()).toEqual(
      ['occasion', 'openedAt', 'orderCode', 'orderStatus', 'publishedAt', 'recipientName', 'senderName', 'slug', 'status', 'updatedAt', 'url'].sort(),
    )
  })

  it('thư đã gỡ xuất bản vẫn ở thư viện với cùng URL (để in lại khi xuất bản lại)', async () => {
    const { code, url } = await publishedOrder()
    await adminApi('post', `/admin/orders/${code}/letter/unpublish`)
    const items = (await adminApi('get', '/admin/letters')).body.items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ status: 'draft', url })
  })

  it('sau khi tạo QR mới, thư viện chỉ còn QR mới (QR cũ không in lại được nữa)', async () => {
    const { code, url } = await publishedOrder()
    const fresh = (await adminApi('post', `/admin/orders/${code}/letter/rotate`)).body.item.url
    const items = (await adminApi('get', '/admin/letters')).body.items
    expect(items.map((i) => i.url)).toEqual([fresh])
    expect(fresh).not.toBe(url)
  })
})

describe('validateLetterContent — biên và dữ liệu xấu', () => {
  const v = (patch) => validateLetterContent({ ...CONTENT, ...patch })

  it('content không phải object → lỗi bắt buộc, không ném', () => {
    for (const bad of [null, undefined, 'chuỗi', 42, [CONTENT], true]) {
      const r = validateLetterContent(bad)
      expect(r.errors).toMatchObject({ recipientName: 'REQUIRED', senderName: 'REQUIRED', occasion: 'INVALID', kind: 'INVALID' })
    }
  })

  it('PUT content là mảng / chuỗi / thiếu → 400 VALIDATION_ERROR', async () => {
    const code = await makeOrder()
    for (const body of [{ content: [CONTENT] }, { content: 'x' }, {}, [CONTENT]]) {
      const r = await adminApi('put', `/admin/orders/${code}/letter`).send(body)
      expect(r.status, JSON.stringify(body).slice(0, 40)).toBe(400)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('tên quá dài, nhiều đoạn, tái bút dài → TOO_LONG', () => {
    expect(v({ recipientName: 'a'.repeat(LIMITS.name + 1) }).errors.recipientName).toBe('TOO_LONG')
    expect(v({ senderName: 'a'.repeat(LIMITS.name + 1) }).errors.senderName).toBe('TOO_LONG')
    expect(v({ recipientName: `  ${'a'.repeat(LIMITS.name)}  ` }).errors).toEqual({}) // trim trước khi đo
    expect(v({ message: Array.from({ length: LIMITS.paragraphs + 1 }, () => 'x').join('\n\n') }).errors.message).toBe('TOO_LONG')
    expect(v({ message: Array.from({ length: 6 }, () => 'x'.repeat(1100)) }).errors.message).toBe('TOO_LONG') // tổng > 6000
    expect(v({ postscript: 'p'.repeat(LIMITS.postscript + 1) }).errors.postscript).toBe('TOO_LONG')
    expect(v({ occasionData: { message: 'm'.repeat(LIMITS.short + 1) } }).errors['occasionData.message']).toBe('TOO_LONG')
  })

  it('body PUT rất lớn (> 100kb) → 413, không lưu', async () => {
    const code = await makeOrder()
    const r = await adminApi('put', `/admin/orders/${code}/letter`).send({ content: { ...CONTENT, message: 'x'.repeat(200_000) } })
    expect(r.status).toBe(413)
    expect((await adminApi('get', `/admin/orders/${code}/letter`)).body.item).toBeNull()
  })

  it('mảng đoạn chứa phần tử không phải chuỗi → INVALID (không âm thầm bỏ)', () => {
    const r = v({ message: ['Đoạn thật', { evil: 1 }, 42, ['lồng']] })
    expect(r.errors.message).toBe('INVALID')
  })

  it('URL media: chặn javascript:, data:, http:, //, \\, dấu nháy, khoảng trắng, quá 500 ký tự', () => {
    const video = (patch) => v({ kind: 'video', videoUrl: '/videos/a.mp4', ...patch }).errors
    for (const bad of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:video/mp4;base64,AAAA',
      'http://evil.test/a.mp4',
      '//evil.test/a.mp4',
      '/\\evil.test/a.mp4',
      'https://evil.test/a.mp4" onerror="x',
      "https://evil.test/a'.mp4",
      'https://evil.test/<script>',
      'https://evil.test/a b.mp4',
      '/videos/a.mp4\njavascript:alert(1)',
      ' /videos/a.mp4',
      `https://e.test/${'a'.repeat(500)}`,
      'vbscript:msgbox',
      'https:/evil.test',
    ]) {
      expect(video({ videoUrl: bad }).videoUrl, bad).toBe('INVALID')
      expect(video({ posterUrl: bad }).posterUrl, bad).toBe('INVALID')
      expect(video({ captionsUrl: bad }).captionsUrl, bad).toBe('INVALID')
      expect(v({ occasion: 'anniversary', occasionData: { photos: [bad] } }).errors['occasionData.photos'], bad).toBe('INVALID')
    }
    expect(video({ videoUrl: 'https://cdn.lamvi.test/v.mp4', posterUrl: '/images/p.jpg', captionsUrl: '/videos/v.vtt' })).toEqual({})
    expect(v({ kind: 'video' }).errors.videoUrl).toBe('REQUIRED')
  })

  it('thư chữ không mang theo trường video dù body có gửi', () => {
    const r = v({ kind: 'text', videoUrl: '/videos/a.mp4', posterUrl: 'javascript:x' })
    expect(r.errors).toEqual({})
    expect(r.value).not.toHaveProperty('videoUrl')
    expect(r.value).not.toHaveProperty('posterUrl')
  })

  it('dữ liệu bất ngờ của dịp khác bị bỏ; mỗi dịp chỉ giữ trường của mình', () => {
    const od = { message: 'm', date: '1/1', photos: ['/images/a.jpg'], label: 'L', places: ['Hà Nội', 'Huế'], icon: '🌸', evil: '<x>' }
    const keys = (occasion) => Object.keys(v({ occasion, occasionData: od }).value.occasionData ?? {}).sort()
    expect(keys('birthday')).toEqual(['message'])
    expect(keys('thankYou')).toEqual(['message'])
    expect(keys('encouragement')).toEqual(['message'])
    expect(keys('anniversary')).toEqual(['date', 'message', 'photos'])
    expect(keys('milestone')).toEqual(['label', 'message'])
    expect(keys('longDistance')).toEqual(['message', 'places'])
    expect(keys('justBecause')).toEqual(['icon', 'message'])
    // occasionData không phải object
    for (const bad of ['chuỗi', ['a'], 5, null]) expect(v({ occasionData: bad }).value.occasionData).toBeNull()
  })

  it('giới hạn ảnh, nơi chốn, biểu tượng', () => {
    expect(v({ occasion: 'anniversary', occasionData: { photos: ['/a.jpg', '/b.jpg', '/c.jpg'] } }).errors['occasionData.photos']).toBe('INVALID')
    expect(v({ occasion: 'longDistance', occasionData: { places: ['a', 'b', 'c', 'd', 'e'] } }).errors['occasionData.places']).toBe('INVALID')
    expect(v({ occasion: 'longDistance', occasionData: { places: ['x'.repeat(61)] } }).errors['occasionData.places']).toBe('INVALID')
    expect(v({ occasion: 'justBecause', occasionData: { icon: 'abc' } }).errors['occasionData.icon']).toBe('TOO_LONG')
    expect(v({ occasion: 'justBecause', occasionData: { icon: '🇻🇳' } }).errors).toEqual({})
  })

  it('dịp / loại thư ngoài danh sách (kể cả tên thuộc Object.prototype) → INVALID', () => {
    for (const occasion of ['toString', '__proto__', 'Birthday', '', 'constructor']) expect(v({ occasion }).errors.occasion).toBe('INVALID')
    for (const kind of ['audio', 'TEXT', 'toString']) expect(v({ kind }).errors.kind).toBe('INVALID')
  })
})

describe('letterUrl', () => {
  it('D-138: không subdomain — bỏ qua letterBaseDomain/letterProtocol', () => {
    expect(letterUrl({ publicSiteUrl: 'https://x.test', letterBaseDomain: 'thu.x.test', letterProtocol: 'http' }, 'abcdefghij', 'T')).toBe('https://x.test/thu/abcdefghij#T')
  })
})

describe('Giới hạn tần suất mở thư', () => {
  it('vượt hạn mức → 429 (kể cả khi token đúng)', async () => {
    app = build({ ...base, rateLimit: { enabled: true, letters: { 'letter-open': { max: 2 } } } })
    const { slug, token } = await publishedOrder()
    expect((await open({ slug, token: 'D'.repeat(43) })).status).toBe(404)
    expect((await open({ slug, token })).status).toBe(200)
    const r = await open({ slug, token })
    expect(r.status).toBe(429)
    expect(JSON.stringify(r.body)).not.toContain('Đoạn một')
  })
})


describe('SSR /thu/<slug>: riêng tư, noindex, không GA', () => {
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const page = (url) =>
    renderPage({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://lamvi.test', gaMeasurementId: 'G-TEST12345' }, template, render, url, pathname: url.split('?')[0] })

  it.each(['/thu/abcdefghij', '/thu/abcdefghij/', '/THU/abcdefghij', '/Thu/zzzzzzzzzz'])('%s', async (url) => {
    const r = await page(url)
    expect(r.private).toBe(true)
    expect(r.noindex).toBe(true)
    expect(r.html).not.toContain('googletagmanager')
    expect(r.html).toContain('noindex')
    expect(r.html).not.toContain('__INITIAL_DATA__')
  })

  it('/thu và /thu/a/b cũng không nhúng GA', async () => {
    for (const url of ['/thu', '/thu/a/b']) expect((await page(url)).html, url).not.toContain('googletagmanager')
  })

  it('trang thường vẫn có GA (đối chứng)', async () => {
    expect((await page('/')).html).toContain('googletagmanager')
  })
})
