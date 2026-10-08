import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { loadConfig } from './config.js'

// Kiểm thử độc lập bổ sung: admin sản phẩm/FAQ/lô/video (FR-CAT-004, FR-QR-007, D-38..D-48)
let app, repo, auth, storage, clock, admin, customer, adminId

async function login(email, role) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { header: `Bearer ${s.accessToken}`, id: user.id }
}

function build(repoImpl) {
  clock = { t: Date.UTC(2026, 8, 28) }
  repo = repoImpl ?? createMemoryRepo()
  auth = createMemoryAuth({ now: () => clock.t, accessTtlMs: 3600_000 })
  storage = createMemoryStorage({ maxBytes: 1024 * 1024 })
  app = createApp({ repo, auth, storage, config: { publicSiteUrl: 'https://moc.test', maxVideoMb: 1 } })
}

beforeEach(async () => {
  build()
  const a = await login('admin@moc.test', 'admin')
  admin = a.header
  adminId = a.id
  customer = (await login('khach@moc.test', 'customer')).header
})

afterEach(() => vi.restoreAllMocks())

const product = { slug: 'den-thu', kind: 'single', price: 750000, name: { vi: 'Đèn Thử' } }
const as = (method, url, who = admin) => request(app)[method](url).set('Authorization', who)

async function createProduct(over = {}) {
  const res = await as('post', '/api/admin/products').send({ ...product, ...over })
  expect(res.status).toBe(201)
  return res.body.item
}

async function createBatch(code = 'L-TEST-01') {
  const res = await as('post', '/api/admin/batches').send({ code, producedOn: '2026-10-01', title: { vi: 'Lô thử' } })
  expect(res.status).toBe(201)
  return res.body.item
}

async function uploadVideo(batchId, bytes = Buffer.from('video'), contentType = 'video/mp4') {
  const up = await as('post', `/api/admin/batches/${batchId}/video-upload`).send({ contentType, size: bytes.length })
  expect(up.status).toBe(201)
  await request(app).put(up.body.uploadUrl).set('Content-Type', contentType).send(bytes).expect(200)
  return as('post', `/api/admin/batches/${batchId}/video`).send({ path: up.body.path })
}

// Mọi endpoint admin, với id thật để không bị 404 sớm
async function allEndpoints() {
  const p = await createProduct({ slug: 'den-bao-mat' })
  const b = await createBatch('L-BAO-MAT')
  const f = (await as('post', '/api/admin/faq').send({ question: { vi: 'Q?' }, answer: { vi: 'A' } })).body.item
  return [
    ['get', '/api/admin/products'],
    ['get', `/api/admin/products/${p.id}`],
    ['post', '/api/admin/products'],
    ['patch', `/api/admin/products/${p.id}`],
    ['delete', `/api/admin/products/${p.id}`],
    ['get', '/api/admin/faq'],
    ['post', '/api/admin/faq'],
    ['patch', `/api/admin/faq/${f.id}`],
    ['delete', `/api/admin/faq/${f.id}`],
    ['get', '/api/admin/batches'],
    ['get', `/api/admin/batches/${b.id}`],
    ['post', '/api/admin/batches'],
    ['patch', `/api/admin/batches/${b.id}`],
    ['delete', `/api/admin/batches/${b.id}`],
    ['post', `/api/admin/batches/${b.id}/video-upload`],
    ['post', `/api/admin/batches/${b.id}/video`],
    ['post', `/api/admin/batches/${b.id}/publish`],
  ]
}

describe('Bảo mật — mọi endpoint /api/admin/* (D-38, §3.2)', () => {
  it('chưa đăng nhập → 401, khách → 403 FORBIDDEN, token rác → 401; không có tác dụng phụ', async () => {
    const endpoints = await allEndpoints()
    const before = {
      p: (await as('get', '/api/admin/products')).body.items.length,
      b: (await as('get', '/api/admin/batches')).body.items.length,
      f: (await as('get', '/api/admin/faq')).body.items.length,
    }
    const payload = { ...product, slug: 'hack', code: 'HACK', contentType: 'video/mp4', size: 5, question: { vi: 'x' }, answer: { vi: 'y' } }
    for (const [m, url] of endpoints) {
      const anon = await request(app)[m](url).send(payload)
      expect(anon.status, `anon ${m} ${url}`).toBe(401)
      expect(anon.body.error.code).toBe('UNAUTHORIZED')
      const bad = await request(app)[m](url).set('Authorization', 'Bearer khong-hop-le').send(payload)
      expect(bad.status, `bad ${m} ${url}`).toBe(401)
      const basic = await request(app)[m](url).set('Authorization', 'Basic YWRtaW46YWRtaW4=').send(payload)
      expect(basic.status, `basic ${m} ${url}`).toBe(401)
      const cus = await as(m, url, customer).send(payload)
      expect(cus.status, `customer ${m} ${url}`).toBe(403)
      expect(cus.body.error).toEqual({ code: 'FORBIDDEN', message: expect.any(String) })
    }
    expect((await as('get', '/api/admin/products')).body.items.length).toBe(before.p)
    expect((await as('get', '/api/admin/batches')).body.items.length).toBe(before.b)
    expect((await as('get', '/api/admin/faq')).body.items.length).toBe(before.f)
    expect(storage.objects.size).toBe(0)
  })

  it('đường dẫn biến thể hoa/thường hoặc route không tồn tại vẫn qua cổng admin', async () => {
    expect((await request(app).get('/api/ADMIN/products')).status).toBe(401)
    expect((await as('get', '/api/Admin/Products', customer)).status).toBe(403)
    expect((await request(app).get('/api/admin/khong-co')).status).toBe(401)
    expect((await as('get', '/api/admin/khong-co')).status).toBe(404)
  })

  it('token admin hết hạn → 401', async () => {
    expect((await as('get', '/api/admin/products')).status).toBe(200)
    clock.t += 3600_000 + 1
    const res = await as('get', '/api/admin/products')
    expect(res.status).toBe(401)
    expect((await as('post', '/api/admin/products').send(product)).status).toBe(401)
  })

  it('admin bị hạ role giữa chừng mất quyền ngay với cùng token; nâng lại thì có quyền', async () => {
    expect((await as('get', '/api/admin/batches')).status).toBe(200)
    await repo.upsertProfile({ id: adminId, role: 'customer' })
    expect((await as('get', '/api/admin/batches')).status).toBe(403)
    expect((await as('post', '/api/admin/products').send(product)).status).toBe(403)
    await repo.upsertProfile({ id: adminId, role: 'admin' })
    expect((await as('get', '/api/admin/batches')).status).toBe(200)
  })

  it('người dùng không có hồ sơ (profile) → 403', async () => {
    const { user } = await auth.signUp({ email: 'noprofile@moc.test', password: 'Gio-Hoa#Sen2026' })
    expect(user.id).toBeTruthy()
    const s = await auth.signIn({ email: 'noprofile@moc.test', password: 'Gio-Hoa#Sen2026' })
    expect((await as('get', '/api/admin/products', `Bearer ${s.accessToken}`)).status).toBe(403)
  })

  it('khách không tự nâng role qua PATCH /me', async () => {
    const res = await as('patch', '/api/me', customer).send({ role: 'admin', fullName: 'Khách' })
    expect(res.status).toBe(200)
    expect(res.body.profile.role).toBe('customer')
    expect((await as('get', '/api/admin/products', customer)).status).toBe(403)
  })

  it('upload token của dev-storage: sai → 403, dùng một lần, không ghi được object', async () => {
    const b = await createBatch()
    const bad = await request(app).put('/api/dev-storage/upload/abc').set('Content-Type', 'video/mp4').send(Buffer.from('x'))
    expect(bad.status).toBe(403)
    expect(bad.body.error.code).toBe('FORBIDDEN')
    const up = await as('post', `/api/admin/batches/${b.id}/video-upload`).send({ contentType: 'video/mp4', size: 3 })
    expect(up.body.path.startsWith(`${b.id}/`)).toBe(true)
    expect(up.body.path).toMatch(/\.mp4$/)
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'video/mp4').send(Buffer.from('abc')).expect(200)
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'video/mp4').send(Buffer.from('zzz')).expect(403)
    expect(storage.getObject(up.body.path).bytes.toString()).toBe('abc')
    expect(storage.objects.size).toBe(1)
  })

  it('mỗi lần xin URL tải lên → đường dẫn/ token khác nhau', async () => {
    const b = await createBatch()
    const a1 = await as('post', `/api/admin/batches/${b.id}/video-upload`).send({ contentType: 'video/webm', size: 3 })
    const a2 = await as('post', `/api/admin/batches/${b.id}/video-upload`).send({ contentType: 'video/quicktime', size: 3 })
    expect(a1.body.path).not.toBe(a2.body.path)
    expect(a1.body.uploadUrl).not.toBe(a2.body.uploadUrl)
    expect(a1.body.path).toMatch(/\.webm$/)
    expect(a2.body.path).toMatch(/\.mov$/)
    expect(a1.body.headers).toEqual({ 'Content-Type': 'video/webm' })
  })

  it('gắn video: chặn path traversal, path lô khác, path tuyệt đối, kiểu sai', async () => {
    const b = await createBatch()
    const other = await createBatch('L-KHAC-02')
    // Có sẵn object thật ở lô khác để chắc lỗi là do path, không phải do thiếu file
    const otherUp = await as('post', `/api/admin/batches/${other.id}/video-upload`).send({ contentType: 'video/mp4', size: 3 })
    await request(app).put(otherUp.body.uploadUrl).set('Content-Type', 'video/mp4').send(Buffer.from('abc')).expect(200)
    const suffix = otherUp.body.path.slice(other.id.length + 1)
    for (const path of [
      `${b.id}/../${otherUp.body.path}`,
      `${b.id}/../../etc/passwd`,
      `${b.id}/..`,
      `/${otherUp.body.path}`,
      `/etc/passwd`,
      otherUp.body.path,
      `${b.id}`,
      `${b.id.toUpperCase()}/${suffix}`,
      `x${b.id}/${suffix}`,
      ['a'],
      { p: 1 },
      123,
      null,
      '',
    ]) {
      const res = await as('post', `/api/admin/batches/${b.id}/video`).send({ path })
      expect(res.status, JSON.stringify(path)).toBe(400)
      expect(res.body.error.fields, JSON.stringify(path)).toEqual({ path: 'INVALID' })
    }
    expect((await as('get', `/api/admin/batches/${b.id}`)).body.item.videoUrl).toBeNull()
  })

  it('lỗi hệ thống không lộ thông điệp gốc (500 INTERNAL_ERROR)', async () => {
    const inner = createMemoryRepo()
    const leaky = {
      ...inner,
      createProduct: async () => {
        throw new Error('duplicate key value violates unique constraint "secret_internal" password=abc')
      },
      listBatches: async () => {
        throw Object.assign(new Error('relation "public.batches" does not exist'), { code: '42P01' })
      },
    }
    build(leaky)
    admin = (await login('admin2@moc.test', 'admin')).header
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const generic = await as('post', '/api/admin/products').send(product)
    expect(generic.status).toBe(500)
    expect(generic.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } })
    // Thiếu bảng (42P01) → 503 SCHEMA_OUTDATED (feedback 08/10, mục 31), vẫn không lộ chi tiết DB
    const schema = await as('get', '/api/admin/batches')
    expect(schema.status).toBe(503)
    expect(schema.body.error.code).toBe('SCHEMA_OUTDATED')
    for (const res of [generic, schema]) expect(JSON.stringify(res.body)).not.toMatch(/secret|password|relation|constraint/)
  })

  it('lỗi 409 trùng slug/mã lô không chứa chi tiết DB', async () => {
    await createProduct()
    const dup = await as('post', '/api/admin/products').send(product)
    expect(dup.status).toBe(409)
    expect(JSON.stringify(dup.body)).not.toMatch(/constraint|duplicate|products_/)
  })
})

describe('Toàn vẹn — sản phẩm', () => {
  it('PATCH không đổi được id/createdAt; bỏ qua trường lạ', async () => {
    const p = await createProduct()
    const res = await as('patch', `/api/admin/products/${p.id}`).send({
      id: 'hack-id',
      createdAt: '1999-01-01T00:00:00.000Z',
      role: 'admin',
      price: 800000,
    })
    expect(res.status).toBe(200)
    expect(res.body.item.id).toBe(p.id)
    expect(res.body.item.createdAt).toBe(p.createdAt)
    expect(res.body.item).not.toHaveProperty('role')
    expect(res.body.item.price).toBe(800000)
    expect((await as('get', '/api/admin/products/hack-id')).status).toBe(404)
  })

  it('POST không đặt được id/createdAt tuỳ ý', async () => {
    const res = await as('post', '/api/admin/products').send({ ...product, id: 'fixed-id', createdAt: '1999-01-01' })
    expect(res.status).toBe(201)
    expect(res.body.item.id).not.toBe('fixed-id')
    expect(res.body.item.createdAt).not.toBe('1999-01-01')
  })

  it('PATCH slug sang slug của sản phẩm khác → 409 SLUG_TAKEN; giữ slug của chính nó → 200', async () => {
    const a = await createProduct({ slug: 'den-a' })
    await createProduct({ slug: 'den-b' })
    const res = await as('patch', `/api/admin/products/${a.id}`).send({ slug: 'den-b' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'SLUG_TAKEN', fields: { slug: 'SLUG_TAKEN' } })
    expect((await as('get', `/api/admin/products/${a.id}`)).body.item.slug).toBe('den-a')
    expect((await as('patch', `/api/admin/products/${a.id}`).send({ slug: 'den-a' })).status).toBe(200)
  })

  it('PATCH/GET/DELETE id không tồn tại → 404', async () => {
    expect((await as('patch', '/api/admin/products/khong-co').send({ price: 1 })).status).toBe(404)
    expect((await as('get', '/api/admin/products/khong-co')).status).toBe(404)
    expect((await as('patch', '/api/admin/faq/khong-co').send({ isPublished: true })).status).toBe(404)
    expect((await as('delete', '/api/admin/faq/khong-co')).status).toBe(404)
    expect((await as('get', '/api/admin/batches/khong-co')).status).toBe(404)
    expect((await as('patch', '/api/admin/batches/khong-co').send({ title: { vi: 'x' } })).status).toBe(404)
    expect((await as('delete', '/api/admin/batches/khong-co')).status).toBe(404)
    expect((await as('post', '/api/admin/batches/khong-co/video-upload').send({ contentType: 'video/mp4', size: 1 })).status).toBe(404)
    expect((await as('post', '/api/admin/batches/khong-co/video').send({ path: 'khong-co/a.mp4' })).status).toBe(404)
    expect((await as('post', '/api/admin/batches/khong-co/publish')).status).toBe(404)
  })

  it('PATCH lỗi validate không ghi một phần dữ liệu', async () => {
    const p = await createProduct()
    const res = await as('patch', `/api/admin/products/${p.id}`).send({ price: 1, slug: 'SAI SLUG' })
    expect(res.status).toBe(400)
    expect((await as('get', `/api/admin/products/${p.id}`)).body.item.price).toBe(750000)
  })
})

describe('Toàn vẹn — lô & video (D-43, D-46, D-47)', () => {
  it('PATCH lô không đổi được status/videoUrl/videoPath/id trực tiếp', async () => {
    const b = await createBatch()
    const res = await as('patch', `/api/admin/batches/${b.id}`).send({
      status: 'video_published',
      videoUrl: 'https://evil.test/x.mp4',
      videoPath: `${b.id}/x.mp4`,
      id: 'hack',
    })
    expect(res.status).toBe(200)
    expect(res.body.item).toMatchObject({ id: b.id, status: 'created', videoUrl: null, videoPath: null })
    expect((await request(app).get('/api/batches/L-TEST-01')).status).toBe(404)
  })

  it('POST lô không đặt được status/videoUrl ngay khi tạo', async () => {
    const res = await as('post', '/api/admin/batches').send({ code: 'L-X', status: 'video_published', videoUrl: 'https://evil.test/v.mp4' })
    expect(res.status).toBe(201)
    expect(res.body.item).toMatchObject({ status: 'created', videoUrl: null })
    expect((await request(app).get('/api/batches/L-X')).status).toBe(404)
  })

  it('publish lặp lại là idempotent', async () => {
    const b = await createBatch()
    await uploadVideo(b.id)
    const p1 = await as('post', `/api/admin/batches/${b.id}/publish`)
    const p2 = await as('post', `/api/admin/batches/${b.id}/publish`)
    expect(p1.status).toBe(200)
    expect(p2.status).toBe(200)
    expect(p2.body.item.status).toBe('video_published')
    expect(p2.body.item.videoUrl).toBe(p1.body.item.videoUrl)
  })

  it('lô đã xuất bản: PATCH cùng mã (kể cả có khoảng trắng) + sửa tiêu đề → 200; đổi mã → 409, mã giữ nguyên', async () => {
    const b = await createBatch()
    await uploadVideo(b.id)
    await as('post', `/api/admin/batches/${b.id}/publish`).expect(200)
    const same = await as('patch', `/api/admin/batches/${b.id}`).send({ code: ' L-TEST-01 ', title: { vi: 'Tiêu đề mới', en: 'New title' } })
    expect(same.status).toBe(200)
    expect(same.body.item.title).toEqual({ vi: 'Tiêu đề mới', en: 'New title' })
    const recode = await as('patch', `/api/admin/batches/${b.id}`).send({ code: 'L-TEST-02', title: { vi: 'Không được lưu' } })
    expect(recode.status).toBe(409)
    expect(recode.body.error).toMatchObject({ code: 'BATCH_CODE_LOCKED', fields: { code: 'BATCH_CODE_LOCKED' } })
    const now = (await as('get', `/api/admin/batches/${b.id}`)).body.item
    expect(now.code).toBe('L-TEST-01')
    expect(now.title.vi).toBe('Tiêu đề mới')
    const pub = await request(app).get('/api/batches/L-TEST-01?lang=en')
    expect(pub.body.item.title).toBe('New title')
  })

  it('xoá lô đã xuất bản → 409 và lô vẫn còn công khai', async () => {
    const b = await createBatch()
    await uploadVideo(b.id)
    await as('post', `/api/admin/batches/${b.id}/publish`).expect(200)
    const del = await as('delete', `/api/admin/batches/${b.id}`)
    expect(del.status).toBe(409)
    expect(del.body.error.code).toBe('BATCH_PUBLISHED')
    expect((await request(app).get('/api/batches/L-TEST-01')).status).toBe(200)
  })

  it('thay video khi đã xuất bản → trang công khai trả video mới, video cũ vẫn đọc được', async () => {
    const b = await createBatch()
    const first = await uploadVideo(b.id, Buffer.from('v1'))
    await as('post', `/api/admin/batches/${b.id}/publish`).expect(200)
    const second = await uploadVideo(b.id, Buffer.from('v2'), 'video/webm')
    expect(second.status).toBe(200)
    expect(second.body.item.status).toBe('video_published')
    expect(second.body.item.videoPath).toMatch(/\.webm$/)
    const pub = await request(app).get('/api/batches/L-TEST-01')
    expect(pub.body.item.videoUrl).toBe(second.body.item.videoUrl)
    expect((await request(app).get(pub.body.item.videoUrl)).body.toString()).toBe('v2')
    expect((await request(app).get(first.body.item.videoUrl)).status).toBe(200)
  })

  it('đổi mã lô chưa xuất bản sang mã đã tồn tại → 409 BATCH_CODE_TAKEN', async () => {
    const b = await createBatch()
    await createBatch('L-TEST-02')
    const res = await as('patch', `/api/admin/batches/${b.id}`).send({ code: 'L-TEST-02' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'BATCH_CODE_TAKEN', fields: { code: 'BATCH_CODE_TAKEN' } })
  })

  it('file tải lên vượt MAX_VIDEO_MB (dù khai báo nhỏ) → không gắn được', async () => {
    const b = await createBatch()
    const up = await as('post', `/api/admin/batches/${b.id}/video-upload`).send({ contentType: 'video/mp4', size: 10 })
    await request(app)
      .put(up.body.uploadUrl)
      .set('Content-Type', 'video/mp4')
      .send(Buffer.alloc(1024 * 1024 + 1))
      .expect((r) => expect([200, 413]).toContain(r.status))
    const res = await as('post', `/api/admin/batches/${b.id}/video`).send({ path: up.body.path })
    expect(res.status).toBe(400)
    expect(Object.values(res.body.error.fields)[0]).toMatch(/VIDEO_TOO_LARGE|VIDEO_NOT_UPLOADED/)
    expect((await as('get', `/api/admin/batches/${b.id}`)).body.item.videoUrl).toBeNull()
  })

  it('đúng giới hạn MAX_VIDEO_MB (1 MB) → chấp nhận; +1 byte → VIDEO_TOO_LARGE', async () => {
    const b = await createBatch()
    const ok = await as('post', `/api/admin/batches/${b.id}/video-upload`).send({ contentType: 'video/mp4', size: 1024 * 1024 })
    expect(ok.status).toBe(201)
    const big = await as('post', `/api/admin/batches/${b.id}/video-upload`).send({ contentType: 'video/mp4', size: 1024 * 1024 + 1 })
    expect(big.body.error.fields).toEqual({ size: 'VIDEO_TOO_LARGE' })
  })
})

describe('Dữ liệu — validate', () => {
  const post = (body) => as('post', '/api/admin/products').send(body)

  it.each([
    [{}, 'REQUIRED'],
    [{ vi: '   ', en: 'x' }, 'REQUIRED'],
    [{ en: 'Only English' }, 'REQUIRED'],
    [{ vi: 'ok', fr: 'bonjour' }, 'INVALID'],
    [{ vi: 5 }, 'INVALID'],
    [{ vi: ['a'] }, 'INVALID'],
    ['Đèn', 'INVALID'],
    [['Đèn'], 'INVALID'],
    [42, 'INVALID'],
    [{ vi: 'a'.repeat(121) }, 'TOO_LONG'],
    [{ vi: 'ok', zh: '字'.repeat(121) }, 'TOO_LONG'],
  ])('tên sản phẩm %j → %s', async (name, code) => {
    const res = await post({ ...product, name })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ name: code })
  })

  it('tên 120 ký tự (sau trim) hợp lệ; en/zh rỗng bị bỏ', async () => {
    const res = await post({ ...product, name: { vi: ` ${'a'.repeat(120)} `, en: '  ', zh: null } })
    expect(res.status).toBe(201)
    expect(res.body.item.name).toEqual({ vi: 'a'.repeat(120) })
  })

  it('mô tả chỉ có en → VI_REQUIRED; mô tả {} → null', async () => {
    expect((await post({ ...product, description: { en: 'x' } })).body.error.fields).toEqual({ description: 'VI_REQUIRED' })
    const ok = await post({ ...product, description: {} })
    expect(ok.status).toBe(201)
    expect(ok.body.item.description).toBeNull()
  })

  it.each([[-1], [1.5], ['750000'], [1_000_000_001], [null], [Number.MAX_SAFE_INTEGER], [true], [[1]]])('giá %j → INVALID_PRICE', async (price) => {
    const res = await post({ ...product, price })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ price: 'INVALID_PRICE' })
  })

  it('giá 0 và 1 tỷ hợp lệ (biên)', async () => {
    expect((await post({ ...product, slug: 'gia-0', price: 0 })).status).toBe(201)
    expect((await post({ ...product, slug: 'gia-max', price: 1_000_000_000 })).status).toBe(201)
  })

  it('PATCH giá âm → 400', async () => {
    const p = await createProduct()
    const res = await as('patch', `/api/admin/products/${p.id}`).send({ price: -5 })
    expect(res.body.error.fields).toEqual({ price: 'INVALID_PRICE' })
  })

  it.each([['Den'], ['den_moi'], ['-den'], ['den-'], ['den--moi'], ['a'.repeat(81)], [' den '], ['đèn']])('slug %j → INVALID_SLUG', async (slug) => {
    const res = await post({ ...product, slug })
    expect(res.body.error.fields).toEqual({ slug: 'INVALID_SLUG' })
  })

  it('tone/sortOrder/kind sai → 400', async () => {
    const res = await post({ ...product, tone: 'red', sortOrder: 1.5, kind: 'SINGLE' })
    expect(res.body.error.fields).toEqual({ tone: 'INVALID', sortOrder: 'INVALID', kind: 'INVALID' })
  })

  it('body là mảng / null / chuỗi → 400, không 500', async () => {
    const arr = await as('post', '/api/admin/products').set('Content-Type', 'application/json').send('[1,2]')
    expect(arr.status).toBe(400)
    const nul = await as('post', '/api/admin/batches').set('Content-Type', 'application/json').send('null')
    expect(nul.status).toBe(400)
    const str = await as('post', '/api/admin/faq').set('Content-Type', 'application/json').send('"x"')
    expect(str.status).toBe(400)
    const broken = await as('post', '/api/admin/products').set('Content-Type', 'application/json').send('{"slug":')
    expect(broken.status).toBe(400)
    expect(broken.body.error.code).toBe('INVALID_JSON')
    const vu = await as('post', '/api/admin/batches/x/video-upload').set('Content-Type', 'application/json').send('[]')
    expect(vu.status).toBe(404)
  })

  it('FAQ: isPublished không phải boolean, câu hỏi quá dài', async () => {
    const res = await as('post', '/api/admin/faq').send({ question: { vi: 'q'.repeat(301) }, answer: { vi: 'a' }, isPublished: 'true' })
    expect(res.body.error.fields).toEqual({ question: 'TOO_LONG', isPublished: 'INVALID' })
    const long = await as('post', '/api/admin/faq').send({ question: { vi: 'q' }, answer: { vi: 'a'.repeat(2001) } })
    expect(long.body.error.fields).toEqual({ answer: 'TOO_LONG' })
  })

  it('FAQ PATCH answer = null → REQUIRED (không xoá được câu trả lời)', async () => {
    const f = (await as('post', '/api/admin/faq').send({ question: { vi: 'Q?' }, answer: { vi: 'A' } })).body.item
    const res = await as('patch', `/api/admin/faq/${f.id}`).send({ answer: null })
    expect(res.body.error.fields).toEqual({ answer: 'REQUIRED' })
  })

  it.each([['2026-02-30'], ['2026-02-29'], ['2026-13-01'], ['2026-1-01'], ['01/10/2026'], ['2026-10-01T00:00:00Z'], [20261001], ['abcd-ef-gh']])(
    'ngày %j → INVALID_DATE',
    async (producedOn) => {
      const res = await as('post', '/api/admin/batches').send({ code: 'L-D', producedOn })
      expect(res.status).toBe(400)
      expect(res.body.error.fields).toEqual({ producedOn: 'INVALID_DATE' })
    },
  )

  it('ngày 2028-02-29 (năm nhuận) và rỗng hợp lệ', async () => {
    expect((await as('post', '/api/admin/batches').send({ code: 'L-NHUAN', producedOn: '2028-02-29' })).status).toBe(201)
    const empty = await as('post', '/api/admin/batches').send({ code: 'L-RONG', producedOn: '' })
    expect(empty.status).toBe(201)
    expect(empty.body.item.producedOn).toBeNull()
  })

  it.each([['l-01'], ['L 01'], ['L_01'], ['-L'], ['L-'], ['LÔ-1'], ['A'.repeat(41)], ['L--1']])('mã lô %j → INVALID_BATCH_CODE', async (code) => {
    const res = await as('post', '/api/admin/batches').send({ code })
    expect(res.body.error.fields).toEqual({ code: 'INVALID_BATCH_CODE' })
  })

  it('mã lô thiếu / không phải chuỗi → REQUIRED', async () => {
    for (const code of [undefined, '', '   ', 123, ['L-1']]) {
      const res = await as('post', '/api/admin/batches').send({ code })
      expect(res.body.error.fields, JSON.stringify(code)).toEqual({ code: 'REQUIRED' })
    }
  })

  it.each([
    [{ contentType: 'video/x-matroska', size: 10 }, { contentType: 'INVALID_VIDEO_TYPE' }],
    [{ contentType: 'text/html', size: 10 }, { contentType: 'INVALID_VIDEO_TYPE' }],
    [{ contentType: 'VIDEO/MP4', size: 10 }, { contentType: 'INVALID_VIDEO_TYPE' }],
    [{ contentType: 'toString', size: 10 }, { contentType: 'INVALID_VIDEO_TYPE' }],
    [{ contentType: '__proto__', size: 10 }, { contentType: 'INVALID_VIDEO_TYPE' }],
    [{ contentType: 'video/mp4', size: 0 }, { size: 'INVALID' }],
    [{ contentType: 'video/mp4', size: -1 }, { size: 'INVALID' }],
    [{ contentType: 'video/mp4', size: 1.5 }, { size: 'INVALID' }],
    [{ contentType: 'video/mp4', size: '10' }, { size: 'INVALID' }],
    [{ contentType: 'video/mp4' }, { size: 'INVALID' }],
    [{}, { contentType: 'INVALID_VIDEO_TYPE', size: 'INVALID' }],
  ])('video-upload %j → %j', async (payload, fields) => {
    const b = await createBatch()
    const res = await as('post', `/api/admin/batches/${b.id}/video-upload`).send(payload)
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual(fields)
  })
})

describe('D-39/D-40 — sản phẩm admin tạo hiện ở /api/products', () => {
  it('chỉ trạng thái published xuất hiện; en/zh thiếu → dự phòng vi; có en → dùng en', async () => {
    await createProduct({ slug: 'den-pub', status: 'published', sortOrder: 1000, name: { vi: 'Đèn Công Khai', en: 'Public Lantern' }, description: { vi: 'Mô tả VI' } })
    await createProduct({ slug: 'den-draft', status: 'draft', name: { vi: 'Nháp' } })
    await createProduct({ slug: 'den-hidden', status: 'hidden', name: { vi: 'Ẩn' } })

    const en = await request(app).get('/api/products?lang=en')
    const slugs = en.body.items.map((p) => p.slug)
    expect(slugs).toContain('den-pub')
    expect(slugs).not.toContain('den-draft')
    expect(slugs).not.toContain('den-hidden')
    const pubEn = en.body.items.find((p) => p.slug === 'den-pub')
    expect(pubEn).toMatchObject({ name: 'Public Lantern', description: 'Mô tả VI', price: 750000, currency: 'VND' })
    expect(pubEn).not.toHaveProperty('status')
    expect(pubEn).not.toHaveProperty('id')

    const zh = await request(app).get('/api/products/den-pub?lang=zh')
    expect(zh.body.item.name).toBe('Đèn Công Khai')
    expect((await request(app).get('/api/products/den-draft')).status).toBe(404)
    expect((await request(app).get('/api/products/den-hidden')).status).toBe(404)
  })

  it('xoá sản phẩm đã bán → biến khỏi /api/products', async () => {
    const p = await createProduct({ slug: 'den-xoa', status: 'published' })
    expect((await request(app).get('/api/products/den-xoa')).status).toBe(200)
    await as('delete', `/api/admin/products/${p.id}`).expect(204)
    expect((await request(app).get('/api/products/den-xoa')).status).toBe(404)
  })

  it('FAQ công khai dùng dự phòng vi cho zh', async () => {
    await as('post', '/api/admin/faq').send({ question: { vi: 'Hỏi?', en: 'Ask?' }, answer: { vi: 'Đáp' }, isPublished: true, sortOrder: 9999 })
    const zh = await request(app).get('/api/faq?lang=zh')
    expect(zh.body.items.at(-1)).toMatchObject({ question: 'Hỏi?', answer: 'Đáp' })
    const en = await request(app).get('/api/faq?lang=en')
    expect(en.body.items.at(-1)).toMatchObject({ question: 'Ask?', answer: 'Đáp' })
  })
})

describe('Cấu hình MAX_VIDEO_MB', () => {
  it('mặc định 500; đọc từ env; giá trị rác → 500', () => {
    expect(loadConfig({}).maxVideoMb).toBe(500)
    expect(loadConfig({ MAX_VIDEO_MB: '200' }).maxVideoMb).toBe(200)
    expect(loadConfig({ MAX_VIDEO_MB: 'abc' }).maxVideoMb).toBe(500)
  })
})

describe('Migration SQL admin (D-46, D-47)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260928000002_admin.sql', import.meta.url), 'utf8').toLowerCase()

  it('thêm cột video_path', () => {
    expect(sql).toMatch(/alter table public\.batches add column (if not exists )?video_path text/)
  })

  it('trigger before update or delete chặn gỡ xuất bản, xoá, đổi mã', () => {
    expect(sql).toMatch(/before update or delete on public\.batches/)
    expect(sql).toMatch(/for each row execute function public\.batches_guard_published\(\)/)
    expect(sql).toMatch(/tg_op = 'delete'[\s\S]*old\.status = 'video_published'[\s\S]*raise exception/)
    expect(sql).toMatch(/old\.status = 'video_published' and new\.status <> 'video_published'[\s\S]*raise exception/)
    expect(sql).toMatch(/old\.status = 'video_published' and new\.code <> old\.code[\s\S]*raise exception/)
  })

  it('bucket batch-videos công khai', () => {
    expect(sql).toMatch(/insert into storage\.buckets \(id, name, public[^)]*\)\s*values \('batch-videos', 'batch-videos', true/)
  })
})

describe('Slug khoá khi đang bán, không xoá sản phẩm đã có đơn (feedback 08/10, 33.6/33.7)', () => {
  async function setup() {
    const repo = createMemoryRepo()
    const auth = createMemoryAuth()
    const { user } = await auth.signUp({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'Ad', role: 'admin' })
    const token = `Bearer ${(await auth.signIn({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
    const app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test' } })
    return { repo, app, token }
  }

  it('PATCH đổi slug của sản phẩm published → 409 SLUG_LOCKED; draft đổi được', async () => {
    const { repo, app, token } = await setup()
    const pub = (await repo.listProducts({ publishedOnly: true }))[0]
    const res = await request(app).patch(`/api/admin/products/${pub.id}`).set('Authorization', token).send({ slug: 'slug-moi' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLUG_LOCKED')
    const same = await request(app).patch(`/api/admin/products/${pub.id}`).set('Authorization', token).send({ slug: pub.slug, sortOrder: 7 })
    expect(same.status).toBe(200)
    const hidden = await request(app).patch(`/api/admin/products/${pub.id}`).set('Authorization', token).send({ status: 'hidden' })
    expect(hidden.status).toBe(200)
    const renamed = await request(app).patch(`/api/admin/products/${pub.id}`).set('Authorization', token).send({ slug: 'slug-moi' })
    expect(renamed.status).toBe(200)
  })

  it('DELETE sản phẩm đã có trong đơn → 409 PRODUCT_HAS_ORDERS', async () => {
    const { repo, app, token } = await setup()
    const p = (await repo.listProducts({ publishedOnly: false }))[0]
    repo.productHasOrders = async (id) => id === p.id
    const res = await request(app).delete(`/api/admin/products/${p.id}`).set('Authorization', token)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PRODUCT_HAS_ORDERS')
  })
})
