// Kiểm thử độc lập (T-11) cho D-142: admin tạo phong thư lẻ không gắn đơn.
// POST /admin/letters, /admin/letters/:id (GET/PUT/publish/unpublish/rotate), thư viện QR, người nhận mở thư lẻ.
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { presentLetterForRecipient } from './domain/letter.js'

const base = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } }
let app, repo, auth, customer, admin, it_

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}
const build = () => createApp({ repo, auth, storage: createMemoryStorage(), config: base, orders: createOrderService({ repo, payos: null }) })

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = build()
  customer = await login('khach@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
  it_ = await login('it@lamvi.test', 'it')
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
const CONTENT = { recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: 'Đoạn một.\n\nĐoạn hai.', postscript: 'Nhớ bật đèn' }
const api = (method, path, who = admin) => {
  const r = request(app)[method](`/api${path}`)
  return who ? r.set('Authorization', who.token) : r
}
const partsOf = (url) => {
  const u = new URL(url)
  return { slug: u.pathname.slice(5), token: u.hash.slice(1) }
}
const open = (p) => request(app).post('/api/letters/open').send(p)
async function created(body = { content: CONTENT, label: 'Khách quen Hà' }) {
  const r = await api('post', '/admin/letters').send(body)
  expect(r.status).toBe(201)
  return r.body.item
}

describe('Quyền trên endpoint thư lẻ', () => {
  it('401 khi không đăng nhập, 403 cho khách ở mọi endpoint; IT (ADMIN_ROLES) được phép', async () => {
    const item = await created()
    const eps = [
      ['post', '/admin/letters'],
      ['get', `/admin/letters/${item.id}`],
      ['put', `/admin/letters/${item.id}`],
      ['post', `/admin/letters/${item.id}/publish`],
      ['post', `/admin/letters/${item.id}/unpublish`],
      ['post', `/admin/letters/${item.id}/rotate`],
    ]
    for (const [m, p] of eps) {
      expect((await api(m, p, null).send({ content: CONTENT })).status, `${m} ${p}`).toBe(401)
      expect((await api(m, p, customer).send({ content: CONTENT })).status, `${m} ${p}`).toBe(403)
    }
    // Không tạo thêm thư nào ngoài thư admin vừa tạo
    expect((await api('get', '/admin/letters')).body.items).toHaveLength(1)
    // IT thuộc ADMIN_ROLES (server/middleware/auth.js) → được tạo như admin
    expect((await api('post', '/admin/letters', it_).send({})).status).toBe(201)
  })
})

describe('Tạo thư lẻ', () => {
  it('không nội dung: nháp rỗng, label null; có nội dung: lưu nội dung đã chuẩn hoá', async () => {
    const empty = await created({})
    expect(empty).toMatchObject({ status: 'draft', content: null, orderId: null, label: null, url: null })
    expect(empty.id).toMatch(/^[0-9a-f-]{36}$/)
    const full = await created({ content: CONTENT, label: '  Sự kiện  ' })
    expect(full.label).toBe('Sự kiện')
    expect(full.content).toMatchObject({ recipientName: 'Linh', senderName: 'An' })
    expect(full.id).not.toBe(empty.id)
    expect(full).not.toHaveProperty('token')
    const audits = await repo.listAuditLog({ entity: 'letter', entityId: full.id })
    expect(audits.map((a) => a.action)).toEqual(['letter_create'])
    expect(JSON.stringify(audits)).not.toContain('Đoạn một')
  })

  it('label rỗng/chỉ khoảng trắng → null', async () => {
    expect((await created({ label: '   ' })).label).toBeNull()
  })

  it.each([
    [{ label: 123 }, 'label', 'INVALID'],
    [{ label: ['a'] }, 'label', 'INVALID'],
    [{ label: 'x'.repeat(121) }, 'label', 'TOO_LONG'],
    [{ content: { recipientName: '', senderName: 'An', message: 'x' } }, 'occasion', 'INVALID'],
    [{ content: 'chuỗi' }, 'kind', 'INVALID'],
    [{ content: { ...CONTENT, recipientName: 'x'.repeat(500) } }, 'recipientName', 'TOO_LONG'],
  ])('400 với dữ liệu sai %j', async (body, field, code) => {
    const r = await api('post', '/admin/letters').send(body)
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('VALIDATION_ERROR')
    expect(r.body.error.fields?.[field] ?? r.body.error.details?.[field] ?? JSON.stringify(r.body)).toContain(code)
    expect((await api('get', '/admin/letters')).body.items).toHaveLength(0)
  })

  it('label đúng 120 ký tự được chấp nhận', async () => {
    expect((await created({ label: 'é'.repeat(120) })).label).toHaveLength(120)
  })
})

describe('/admin/letters/:id — id sai', () => {
  it.each(['new', 'abc', '123', `${randomUUID()}x`, "' or 1=1 --"])('id không phải UUID (%s) → 404', async (id) => {
    for (const [m, p] of [['get', ''], ['put', ''], ['post', '/publish'], ['post', '/unpublish'], ['post', '/rotate']]) {
      const r = await api(m, `/admin/letters/${encodeURIComponent(id)}${p}`).send({ content: CONTENT })
      expect(r.status, `${m} ${p}`).toBe(404)
    }
  })
  it('UUID không tồn tại → 404 ở mọi thao tác, không tạo thư', async () => {
    const id = randomUUID()
    for (const [m, p] of [['get', ''], ['put', ''], ['post', '/publish'], ['post', '/unpublish'], ['post', '/rotate']]) {
      expect((await api(m, `/admin/letters/${id}${p}`).send({ content: CONTENT })).status, `${m} ${p}`).toBe(404)
    }
    expect((await api('get', '/admin/letters')).body.items).toHaveLength(0)
  })
})

describe('Vòng đời thư lẻ', () => {
  it('tạo → lưu → xuất bản → người nhận mở → gỡ → 404 → xuất bản lại cùng QR → tạo QR mới → link cũ 404', async () => {
    const item = await created({ label: 'Tặng cô giáo' })
    expect((await api('post', `/admin/letters/${item.id}/publish`)).body.error.code).toBe('LETTER_EMPTY')

    const saved = await api('put', `/admin/letters/${item.id}`).send({ content: CONTENT })
    expect(saved.status).toBe(200)
    // PUT không gửi label → giữ label cũ
    expect(saved.body.item.label).toBe('Tặng cô giáo')
    const relabel = await api('put', `/admin/letters/${item.id}`).send({ content: CONTENT, label: 'Cô Mai' })
    expect(relabel.body.item.label).toBe('Cô Mai')
    expect((await api('get', `/admin/letters/${item.id}`)).body.item.label).toBe('Cô Mai')

    const pub = await api('post', `/admin/letters/${item.id}/publish`)
    expect(pub.status).toBe(200)
    expect(pub.body.item.status).toBe('published')
    const first = partsOf(pub.body.item.url)

    const o = await open(first)
    expect(o.status).toBe(200)
    expect(o.body.item).toMatchObject({ recipientName: 'Linh', senderName: 'An' })
    const raw = JSON.stringify(o.body)
    expect(raw).not.toContain('Cô Mai')
    expect(o.body.item).not.toHaveProperty('label')
    expect(o.body.item).not.toHaveProperty('orderId')
    expect(o.body.item).not.toHaveProperty('id')
    expect((await api('get', `/admin/letters/${item.id}`)).body.item.openedAt).toBeTruthy()
    expect((await open({ ...first, token: 'B'.repeat(43) })).status).toBe(404)

    expect((await api('post', `/admin/letters/${item.id}/unpublish`)).body.item.status).toBe('draft')
    expect((await open(first)).status).toBe(404)
    const again = await api('post', `/admin/letters/${item.id}/publish`)
    expect(again.body.item.url).toBe(pub.body.item.url)
    expect((await open(first)).status).toBe(200)

    const rot = await api('post', `/admin/letters/${item.id}/rotate`)
    expect(rot.status).toBe(200)
    const fresh = partsOf(rot.body.item.url)
    expect(fresh.slug).not.toBe(first.slug)
    expect((await open(first)).status).toBe(404)
    expect((await open(fresh)).status).toBe(200)

    const audits = await repo.listAuditLog({ entity: 'letter', entityId: item.id, limit: 50 })
    expect(audits.map((a) => a.action).reverse()).toEqual([
      'letter_create', 'letter_update', 'letter_update', 'letter_publish', 'letter_unpublish', 'letter_publish', 'letter_rotate',
    ])
    const log = JSON.stringify(audits)
    for (const s of [first.token, fresh.token, first.slug, 'Đoạn một', 'Cô Mai']) expect(log).not.toContain(s)
  })

  it('presentLetterForRecipient không bao giờ chứa label/orderId/token', () => {
    const p = presentLetterForRecipient({ id: 'x', orderId: null, label: 'bí mật', token: 'T', slug: 's', content: { recipientName: 'A' } })
    expect(p).toEqual({ recipientName: 'A' })
  })
})

describe('Thư lẻ và thư của đơn không chạm nhau', () => {
  it('PUT/publish theo đơn không đụng thư lẻ và ngược lại; GET đơn chưa có thư vẫn null', async () => {
    const lone = await created({ content: { ...CONTENT, recipientName: 'Lẻ' }, label: 'L' })
    const code = await makeOrder()
    expect((await api('get', `/admin/orders/${code}/letter`)).body.item).toBeNull()
    const orderPut = await api('put', `/admin/orders/${code}/letter`).send({ content: { ...CONTENT, recipientName: 'Đơn' }, label: 'không được lưu' })
    expect(orderPut.status).toBe(200)
    expect(orderPut.body.item.id).not.toBe(lone.id)
    expect(orderPut.body.item.label).toBeNull()
    expect((await api('get', `/admin/letters/${lone.id}`)).body.item.content.recipientName).toBe('Lẻ')

    // Sửa thư lẻ không đổi thư của đơn
    await api('put', `/admin/letters/${lone.id}`).send({ content: { ...CONTENT, recipientName: 'Lẻ 2' } })
    expect((await api('get', `/admin/orders/${code}/letter`)).body.item.content.recipientName).toBe('Đơn')

    // Xuất bản cả hai: QR khác nhau, mở ra đúng thư
    const p1 = await api('post', `/admin/letters/${lone.id}/publish`)
    const p2 = await api('post', `/admin/orders/${code}/letter/publish`)
    expect(p1.body.item.url).not.toBe(p2.body.item.url)
    expect((await open(partsOf(p1.body.item.url))).body.item.recipientName).toBe('Lẻ 2')
    expect((await open(partsOf(p2.body.item.url))).body.item.recipientName).toBe('Đơn')
    // Gỡ thư lẻ không gỡ thư của đơn
    await api('post', `/admin/letters/${lone.id}/unpublish`)
    expect((await open(partsOf(p2.body.item.url))).status).toBe(200)

    const items = (await api('get', '/admin/letters')).body.items
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.id === lone.id)).toMatchObject({ orderCode: null, label: 'L' })
    expect(items.find((i) => i.id === orderPut.body.item.id)).toMatchObject({ orderCode: code })
  })

  it('id route trên thư của đơn đã huỷ: xuất bản bị chặn ORDER_CANCELLED; audit ghi entity letter', async () => {
    const code = await makeOrder()
    const put = await api('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    const id = put.body.item.id
    expect(id).toBeTruthy()
    expect((await api('get', `/admin/letters/${id}`)).body.item.orderId).toBeTruthy()
    const o = await repo.getOrderByCode(code)
    await repo.updateOrder(o.id, { status: 'cancelled' })
    const pub = await api('post', `/admin/letters/${id}/publish`)
    expect(pub.status).toBe(409)
    expect(pub.body.error.code).toBe('ORDER_CANCELLED')
    expect((await api('post', `/admin/orders/${code}/letter/publish`)).status).toBe(409)
  })

  it('đã xuất bản rồi huỷ đơn → người nhận 404 (cả khi xuất bản qua id route)', async () => {
    const code = await makeOrder()
    const id = (await api('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })).body.item.id
    const pub = await api('post', `/admin/letters/${id}/publish`)
    expect(pub.status).toBe(200)
    const parts = partsOf(pub.body.item.url)
    expect((await open(parts)).status).toBe(200)
    await repo.updateOrder((await repo.getOrderByCode(code)).id, { status: 'cancelled' })
    expect((await open(parts)).status).toBe(404)
  })
})

describe('Thư viện QR có thư lẻ', () => {
  it('liệt kê thư lẻ nháp (chưa slug) nhưng ẩn nháp của đơn chưa có QR', async () => {
    const a = await created({ label: 'Nháp lẻ' })
    const b = await created({})
    const code = await makeOrder()
    await api('put', `/admin/orders/${code}/letter`).send({ content: CONTENT })
    const items = (await api('get', '/admin/letters')).body.items
    expect(items.map((i) => i.id).sort()).toEqual([a.id, b.id].sort())
    for (const i of items) expect(i).toMatchObject({ orderCode: null, orderStatus: null, slug: null, url: null, status: 'draft', recipientName: null })
    expect(items.find((i) => i.id === a.id).label).toBe('Nháp lẻ')
    expect(JSON.stringify(items)).not.toContain('"token"')
  })
})

describe('Người nhận mở thư lẻ khi repo thật (Supabase) không nhận id null', () => {
  // supabase-js gửi `.eq('id', null)` thành `id=eq.null` → Postgres lỗi 22P02 (uuid không hợp lệ) → unwrap ném lỗi.
  // Mô phỏng hành vi đó trên memory repo.
  // BUG (T-11): server/routes/letters.js:47 gọi repo.getOrderById(letter.orderId) cả khi orderId null
  // (thư lẻ) → trên Supabase người nhận mở thư lẻ bị 500 thay vì 200.
  it('getOrderById(null) không được gọi cho thư lẻ', async () => {
    const orig = repo.getOrderById
    repo.getOrderById = async (id) => {
      if (id == null) throw Object.assign(new Error('invalid input syntax for type uuid: "null"'), { code: '22P02' })
      return orig(id)
    }
    const item = await created()
    const pub = await api('post', `/admin/letters/${item.id}/publish`)
    expect(pub.status).toBe(200)
    expect((await open(partsOf(pub.body.item.url))).status).toBe(200)
  })
})
