// Phong thư riêng của đơn (D-134) + QR subdomain (D-135)
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { SLUG_RE, TOKEN_RE, letterUrl, validateLetterContent } from './domain/letter.js'
import { loadConfig } from './config.js'

const base = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } }
let app, repo, auth, customer, admin

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}

function build(config = base) {
  return createApp({ repo, auth, storage: createMemoryStorage(), config, orders: createOrderService({ repo, payos: null }) })
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = build()
  customer = await login('khach@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
})

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
  occasionData: { message: 'Tuổi mới rực rỡ', label: 'bỏ qua vì không phải cột mốc' },
}
const adminApi = (method, path) => request(app)[method](`/api${path}`).set('Authorization', admin.token)
const split = (url) => {
  const u = new URL(url)
  return { slug: u.hostname.split('.')[0], token: u.hash.slice(1), u }
}

describe('validateLetterContent', () => {
  it('chuẩn hoá đoạn, bỏ trường lạ và trường bất ngờ không thuộc dịp', () => {
    const { value, errors } = validateLetterContent({ ...CONTENT, evil: '<script>' })
    expect(errors).toEqual({})
    expect(value.message).toEqual(['Đoạn một.', 'Đoạn hai.'])
    expect(value.occasionData).toEqual({ message: 'Tuổi mới rực rỡ' })
    expect(value).not.toHaveProperty('evil')
  })
  it('báo lỗi trường bắt buộc, dịp sai, video thiếu đường dẫn hợp lệ', () => {
    expect(validateLetterContent({}).errors).toMatchObject({ recipientName: 'REQUIRED', senderName: 'REQUIRED', occasion: 'INVALID', kind: 'INVALID' })
    const v = validateLetterContent({ ...CONTENT, kind: 'video', videoUrl: 'javascript:alert(1)' })
    expect(v.errors.videoUrl).toBe('INVALID')
    expect(validateLetterContent({ ...CONTENT, kind: 'video', videoUrl: '//evil.test/x.mp4' }).errors.videoUrl).toBe('INVALID')
    expect(validateLetterContent({ ...CONTENT, kind: 'video', videoUrl: '/letter-room/message.webm' }).errors).toEqual({})
  })
  it('thư chữ phải có nội dung; quá dài bị từ chối', () => {
    expect(validateLetterContent({ ...CONTENT, message: '  ' }).errors.message).toBe('REQUIRED')
    expect(validateLetterContent({ ...CONTENT, message: 'a'.repeat(1300) }).errors.message).toBe('TOO_LONG')
  })
})

describe('letterUrl & cấu hình', () => {
  it('có LETTER_BASE_DOMAIN → subdomain + token sau #; không có → /thu/<slug>', () => {
    expect(letterUrl({ ...base, letterBaseDomain: 'thu.lamvi.com.vn' }, 'abcdefghij', 'T')).toBe('https://abcdefghij.thu.lamvi.com.vn/#T')
    expect(letterUrl(base, 'abcdefghij', 'T')).toBe('https://lamvi.test/thu/abcdefghij#T')
    expect(letterUrl({ publicSiteUrl: 'http://localhost:5173', letterBaseDomain: 'localhost' }, 'abcdefghij', 'T')).toBe('http://abcdefghij.localhost:5173/#T')
  })
  it('loadConfig chỉ nhận tên miền thuần', () => {
    expect(loadConfig({ LETTER_BASE_DOMAIN: 'Thu.Lamvi.com.vn' }).letterBaseDomain).toBe('thu.lamvi.com.vn')
    expect(loadConfig({ LETTER_BASE_DOMAIN: 'https://x.vn/a' }).letterBaseDomain).toBeNull()
    expect(loadConfig({}).letterBaseDomain).toBeNull()
  })
})

describe('Admin soạn, xuất bản, thư viện QR', () => {
  it('chỉ admin; khách thường bị 403', async () => {
    const code = await makeOrder()
    const r = await request(app).get(`/api/admin/orders/${code}/letter`).set('Authorization', customer.token)
    expect(r.status).toBe(403)
    expect((await request(app).get('/api/admin/letters').set('Authorization', customer.token)).status).toBe(403)
  })

  it('lưu nháp → xuất bản sinh slug/token → người nhận mở được; xuất bản lại giữ nguyên QR', async () => {
    const code = await makeOrder()
    expect((await adminApi('get', `/admin/orders/${code}/letter`)).body.item).toBeNull()
    expect((await adminApi('post', `/admin/orders/${code}/letter/publish`)).body.error.code).toBe('LETTER_EMPTY')

    const saved = await adminApi('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    expect(saved.status).toBe(200)
    expect(saved.body.item).toMatchObject({ status: 'draft', url: null })

    const pub = await adminApi('post', `/admin/orders/${code}/letter/publish`)
    expect(pub.status).toBe(200)
    const { url } = pub.body.item
    expect(url).toMatch(/^https:\/\/lamvi\.test\/thu\/[a-z][a-z0-9]{9}#[A-Za-z0-9_-]{43}$/)
    const slug = url.split('/thu/')[1].split('#')[0]
    const token = url.split('#')[1]
    expect(SLUG_RE.test(slug) && TOKEN_RE.test(token)).toBe(true)

    const open = await request(app).post('/api/letters/open').send({ slug, token })
    expect(open.status).toBe(200)
    expect(open.body.item).toMatchObject({ recipientName: 'Linh', message: ['Đoạn một.', 'Đoạn hai.'] })
    expect(open.body.item).not.toHaveProperty('token')

    // Sửa thư đã xuất bản: QR giữ nguyên, người nhận thấy bản mới
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: { ...CONTENT, postscript: 'Mới' } })
    const again = await adminApi('post', `/admin/orders/${code}/letter/publish`)
    expect(again.body.item.url).toBe(url)
    expect((await request(app).post('/api/letters/open').send({ slug, token })).body.item.postscript).toBe('Mới')

    // Thư viện QR trả đúng QR cũ + đã mở
    const gallery = await adminApi('get', '/admin/letters')
    expect(gallery.body.items).toHaveLength(1)
    expect(gallery.body.items[0]).toMatchObject({ orderCode: code, url, recipientName: 'Linh', status: 'published' })
    expect(gallery.body.items[0].openedAt).toBeTruthy()
  })

  it('token sai, slug sai, thiếu token, chưa xuất bản, gỡ xuất bản → cùng 404', async () => {
    const code = await makeOrder()
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    const { url } = (await adminApi('post', `/admin/orders/${code}/letter/publish`)).body.item
    const slug = url.split('/thu/')[1].split('#')[0]
    const token = url.split('#')[1]
    const open = (body) => request(app).post('/api/letters/open').send(body)
    expect((await open({ slug, token: token.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) })).status).toBe(404)
    expect((await open({ slug: 'zzzzzzzzzz', token })).status).toBe(404)
    expect((await open({ slug })).status).toBe(404)
    expect((await open({ slug: '../admin', token })).status).toBe(404)

    await adminApi('post', `/admin/orders/${code}/letter/unpublish`)
    expect((await open({ slug, token })).status).toBe(404)
    const re = await adminApi('post', `/admin/orders/${code}/letter/publish`)
    expect(re.body.item.url).toBe(url) // xuất bản lại → cùng QR
    expect((await open({ slug, token })).status).toBe(200)
  })

  it('tạo QR mới làm QR cũ hết hiệu lực', async () => {
    const code = await makeOrder()
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    const old = (await adminApi('post', `/admin/orders/${code}/letter/publish`)).body.item.url
    const fresh = (await adminApi('post', `/admin/orders/${code}/letter/rotate`)).body.item.url
    expect(fresh).not.toBe(old)
    const parts = (u) => ({ slug: u.split('/thu/')[1].split('#')[0], token: u.split('#')[1] })
    expect((await request(app).post('/api/letters/open').send(parts(old))).status).toBe(404)
    expect((await request(app).post('/api/letters/open').send(parts(fresh))).status).toBe(200)
  })

  it('đơn đã huỷ: không mở được, không xuất bản được', async () => {
    const code = await makeOrder()
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    const { url } = (await adminApi('post', `/admin/orders/${code}/letter/publish`)).body.item
    const o = await repo.getOrderByCode(code)
    await repo.updateOrder(o.id, { status: 'cancelled' })
    const slug = url.split('/thu/')[1].split('#')[0]
    expect((await request(app).post('/api/letters/open').send({ slug, token: url.split('#')[1] })).status).toBe(404)
    expect((await adminApi('post', `/admin/orders/${code}/letter/publish`)).status).toBe(409)
  })

  it('nội dung không hợp lệ → 400 kèm trường', async () => {
    const code = await makeOrder()
    const r = await adminApi('put', `/admin/orders/${code}/letter`).send({ content: { ...CONTENT, recipientName: '' } })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.recipientName).toBe('REQUIRED')
  })
})

describe('Subdomain phong thư (D-135)', () => {
  const host = (slug) => `${slug}.thu.lamvi.test`
  beforeEach(() => {
    app = build({ ...base, letterBaseDomain: 'thu.lamvi.test' })
  })

  it('URL QR dùng subdomain; trang gốc redirect về /thu/<slug>; API mở thư chạy dưới subdomain', async () => {
    const code = await makeOrder()
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    const { url } = (await adminApi('post', `/admin/orders/${code}/letter/publish`)).body.item
    const { slug, token, u } = split(url)
    expect(u.origin).toBe(`https://${host(slug)}`)
    expect(u.pathname).toBe('/')

    const root = await request(app).get('/').set('Host', host(slug))
    expect(root.status).toBe(302)
    expect(root.headers.location).toBe(`/thu/${slug}`)
    // Đường dẫn khác của site chính cũng bị đưa về trang thư
    expect((await request(app).get('/admin').set('Host', host(slug))).headers.location).toBe(`/thu/${slug}`)

    const open = await request(app).post('/api/letters/open').set('Host', host(slug)).send({ slug, token })
    expect(open.status).toBe(200)
  })

  it('API khác (admin, giỏ hàng, đăng nhập) bị chặn dưới subdomain', async () => {
    const r = await request(app).get('/api/admin/letters').set('Host', host('abcdefghij')).set('Authorization', admin.token)
    expect(r.status).toBe(404)
    expect((await request(app).post('/api/auth/login').set('Host', host('abcdefghij')).send({})).status).toBe(404)
  })

  it('subdomain không đúng định dạng → 404; robots chặn index', async () => {
    expect((await request(app).get('/').set('Host', 'www.thu.lamvi.test')).status).toBe(404)
    const robots = await request(app).get('/robots.txt').set('Host', host('abcdefghij'))
    expect(robots.text).toContain('Disallow: /')
  })

  it('domain gốc của thư và host có dấu chấm cuối không lọt site chính', async () => {
    expect((await request(app).get('/login').set('Host', 'thu.lamvi.test')).status).toBe(404)
    const r = await request(app).get('/api/admin/letters').set('Host', `${host('abcdefghij')}.`).set('Authorization', admin.token)
    expect(r.status).toBe(404)
  })

  it('dưới subdomain chỉ mở đúng thư của subdomain đó', async () => {
    const code = await makeOrder()
    await adminApi('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    const { slug, token } = split((await adminApi('post', `/admin/orders/${code}/letter/publish`)).body.item.url)
    const r = await request(app).post('/api/letters/open').set('Host', host('zzzzzzzzzz')).send({ slug, token })
    expect(r.status).toBe(404)
  })

  it('domain chính không bị ảnh hưởng', async () => {
    expect((await request(app).get('/api/health').set('Host', 'lamvi.test')).status).toBe(200)
    expect((await request(app).get('/api/admin/letters').set('Host', 'lamvi.test').set('Authorization', admin.token)).status).toBe(200)
  })
})
