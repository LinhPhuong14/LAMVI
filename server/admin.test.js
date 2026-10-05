import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'

let app, repo, auth, storage, admin, customer

async function login(email, role) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return `Bearer ${s.accessToken}`
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  storage = createMemoryStorage({ maxBytes: 1024 * 1024 })
  app = createApp({ repo, auth, storage, config: { publicSiteUrl: 'https://moc.test', maxVideoMb: 1 } })
  admin = await login('admin@moc.test', 'admin')
  customer = await login('khach@moc.test', 'customer')
})

const product = {
  slug: 'den-moi',
  kind: 'single',
  price: 750000,
  name: { vi: 'Đèn Mới', en: 'New Lantern', zh: '' },
  description: { vi: 'Mô tả' },
}

describe('Phân quyền admin (D-38)', () => {
  it('chưa đăng nhập → 401; khách → 403; admin → 200', async () => {
    expect((await request(app).get('/api/admin/products')).status).toBe(401)
    const forbidden = await request(app).get('/api/admin/products').set('Authorization', customer)
    expect(forbidden.status).toBe(403)
    expect(forbidden.body.error.code).toBe('FORBIDDEN')
    expect((await request(app).get('/api/admin/products').set('Authorization', admin)).status).toBe(200)
  })

  it('khách không ghi được bất kỳ tài nguyên admin nào', async () => {
    for (const [method, url] of [
      ['post', '/api/admin/products'],
      ['post', '/api/admin/faq'],
      ['post', '/api/admin/batches'],
      ['delete', '/api/admin/products/x'],
    ]) {
      expect((await request(app)[method](url).set('Authorization', customer).send({})).status).toBe(403)
    }
  })
})

describe('Sản phẩm (FR-CAT-004)', () => {
  it('tạo mặc định draft → không hiện với khách; publish → hiện; ẩn → mất (D-39)', async () => {
    const created = await request(app).post('/api/admin/products').set('Authorization', admin).send(product)
    expect(created.status).toBe(201)
    expect(created.body.item).toMatchObject({ status: 'draft', name: { vi: 'Đèn Mới', en: 'New Lantern' } })
    expect(created.body.item.name).not.toHaveProperty('zh')
    const id = created.body.item.id
    expect((await request(app).get('/api/products/den-moi')).status).toBe(404)

    await request(app).patch(`/api/admin/products/${id}`).set('Authorization', admin).send({ status: 'published' }).expect(200)
    expect((await request(app).get('/api/products/den-moi?lang=zh')).body.item.name).toBe('Đèn Mới')

    await request(app).patch(`/api/admin/products/${id}`).set('Authorization', admin).send({ status: 'hidden' }).expect(200)
    expect((await request(app).get('/api/products/den-moi')).status).toBe(404)
    const all = await request(app).get('/api/admin/products').set('Authorization', admin)
    expect(all.body.items.find((p) => p.id === id).status).toBe('hidden')
  })

  it('kiểm tra dữ liệu: slug, giá nguyên VND, tên tiếng Việt bắt buộc', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', admin)
      .send({ slug: 'Đèn Mới', kind: 'lamp', price: 1.5, name: { en: 'x' }, status: 'sold' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({
      slug: 'INVALID_SLUG',
      kind: 'INVALID',
      price: 'INVALID_PRICE',
      name: 'REQUIRED',
      status: 'INVALID',
    })
  })

  it('slug trùng → 409 SLUG_TAKEN', async () => {
    const res = await request(app).post('/api/admin/products').set('Authorization', admin).send({ ...product, slug: 'den-nguyet' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'SLUG_TAKEN', fields: { slug: 'SLUG_TAKEN' } })
  })

  it('xoá sản phẩm; id không tồn tại → 404', async () => {
    const { body } = await request(app).post('/api/admin/products').set('Authorization', admin).send(product)
    await request(app).delete(`/api/admin/products/${body.item.id}`).set('Authorization', admin).expect(204)
    await request(app).delete(`/api/admin/products/${body.item.id}`).set('Authorization', admin).expect(404)
  })
})

describe('FAQ (G-07)', () => {
  it('tạo, sửa, ẩn, xoá — trang công khai chỉ thấy FAQ đã xuất bản', async () => {
    const created = await request(app)
      .post('/api/admin/faq')
      .set('Authorization', admin)
      .send({ question: { vi: 'Câu hỏi mới?' }, answer: { vi: 'Trả lời.' }, isPublished: true, sortOrder: 99 })
    expect(created.status).toBe(201)
    const id = created.body.item.id
    expect((await request(app).get('/api/faq')).body.items.at(-1).question).toBe('Câu hỏi mới?')

    await request(app).patch(`/api/admin/faq/${id}`).set('Authorization', admin).send({ isPublished: false }).expect(200)
    expect((await request(app).get('/api/faq')).body.items.some((f) => f.id === id)).toBe(false)
    expect((await request(app).get('/api/admin/faq').set('Authorization', admin)).body.items.some((f) => f.id === id)).toBe(true)

    await request(app).delete(`/api/admin/faq/${id}`).set('Authorization', admin).expect(204)
  })

  it('thiếu câu hỏi/trả lời tiếng Việt → 400', async () => {
    const res = await request(app).post('/api/admin/faq').set('Authorization', admin).send({ question: { en: 'Q?' }, answer: {} })
    expect(res.body.error.fields).toEqual({ question: 'REQUIRED', answer: 'REQUIRED' })
  })
})

describe('Lô & video lô (FR-QR-007, D-46, D-47)', () => {
  async function createBatch(code = 'L-2026-10') {
    const res = await request(app)
      .post('/api/admin/batches')
      .set('Authorization', admin)
      .send({ code, producedOn: '2026-10-01', title: { vi: 'Lô tháng 10' } })
    expect(res.status).toBe(201)
    return res.body.item
  }

  async function uploadVideo(batchId, bytes = Buffer.from('video'), contentType = 'video/mp4') {
    const up = await request(app)
      .post(`/api/admin/batches/${batchId}/video-upload`)
      .set('Authorization', admin)
      .send({ contentType, size: bytes.length })
    expect(up.status).toBe(201)
    await request(app).put(up.body.uploadUrl).set('Content-Type', contentType).send(bytes).expect(200)
    return request(app).post(`/api/admin/batches/${batchId}/video`).set('Authorization', admin).send({ path: up.body.path })
  }

  it('luồng đầy đủ: tạo → tải video → xuất bản → trang QR lô công khai', async () => {
    const batch = await createBatch()
    expect(batch.status).toBe('created')
    expect((await request(app).get('/api/batches/L-2026-10')).status).toBe(404)

    const noVideo = await request(app).post(`/api/admin/batches/${batch.id}/publish`).set('Authorization', admin)
    expect(noVideo.status).toBe(409)
    expect(noVideo.body.error.code).toBe('VIDEO_REQUIRED')

    const attached = await uploadVideo(batch.id)
    expect(attached.status).toBe(200)
    expect(attached.body.item.videoUrl).toMatch(/^\/api\/dev-storage\/o\//)

    await request(app).post(`/api/admin/batches/${batch.id}/publish`).set('Authorization', admin).expect(200)
    const pub = await request(app).get('/api/batches/L-2026-10')
    expect(pub.status).toBe(200)
    expect(pub.body.item.videoUrl).toBe(attached.body.item.videoUrl)
    expect((await request(app).get(pub.body.item.videoUrl)).status).toBe(200)
  })

  it('D-47: lô đã xuất bản được thay video, không xoá được, không đổi mã được', async () => {
    const batch = await createBatch()
    const first = await uploadVideo(batch.id)
    await request(app).post(`/api/admin/batches/${batch.id}/publish`).set('Authorization', admin).expect(200)

    const second = await uploadVideo(batch.id, Buffer.from('video-2'))
    expect(second.status).toBe(200)
    expect(second.body.item.videoUrl).not.toBe(first.body.item.videoUrl)
    // Video cũ không bị xoá (D-10)
    expect((await request(app).get(first.body.item.videoUrl)).status).toBe(200)

    const del = await request(app).delete(`/api/admin/batches/${batch.id}`).set('Authorization', admin)
    expect(del.status).toBe(409)
    expect(del.body.error.code).toBe('BATCH_PUBLISHED')

    const recode = await request(app).patch(`/api/admin/batches/${batch.id}`).set('Authorization', admin).send({ code: 'L-KHAC' })
    expect(recode.status).toBe(409)
    expect(recode.body.error.code).toBe('BATCH_CODE_LOCKED')

    // Không có đường gỡ xuất bản: status không nhận qua PATCH
    await request(app).patch(`/api/admin/batches/${batch.id}`).set('Authorization', admin).send({ status: 'created' }).expect(200)
    expect((await request(app).get('/api/batches/L-2026-10')).status).toBe(200)
  })

  it('lô chưa xuất bản xoá được, đổi mã được', async () => {
    const batch = await createBatch()
    await request(app).patch(`/api/admin/batches/${batch.id}`).set('Authorization', admin).send({ code: 'L-MOI' }).expect(200)
    await request(app).delete(`/api/admin/batches/${batch.id}`).set('Authorization', admin).expect(204)
  })

  it('mã lô sai định dạng / trùng; ngày không hợp lệ', async () => {
    const bad = await request(app).post('/api/admin/batches').set('Authorization', admin).send({ code: 'lô 1', producedOn: '2026-02-31' })
    expect(bad.body.error.fields).toEqual({ code: 'INVALID_BATCH_CODE', producedOn: 'INVALID_DATE' })
    const dup = await request(app).post('/api/admin/batches').set('Authorization', admin).send({ code: 'DEMO-2026-01' })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('BATCH_CODE_TAKEN')
  })

  it('video: sai định dạng, quá dung lượng, đường dẫn của lô khác, chưa tải lên', async () => {
    const batch = await createBatch()
    const other = await createBatch('L-KHAC')
    const wrong = await request(app)
      .post(`/api/admin/batches/${batch.id}/video-upload`)
      .set('Authorization', admin)
      .send({ contentType: 'image/png', size: 2 * 1024 * 1024 })
    expect(wrong.body.error.fields).toEqual({ contentType: 'INVALID_VIDEO_TYPE', size: 'VIDEO_TOO_LARGE' })

    const up = await request(app)
      .post(`/api/admin/batches/${other.id}/video-upload`)
      .set('Authorization', admin)
      .send({ contentType: 'video/mp4', size: 10 })
    const cross = await request(app).post(`/api/admin/batches/${batch.id}/video`).set('Authorization', admin).send({ path: up.body.path })
    expect(cross.body.error.fields).toEqual({ path: 'INVALID' })
    const missing = await request(app).post(`/api/admin/batches/${other.id}/video`).set('Authorization', admin).send({ path: up.body.path })
    expect(missing.body.error.fields).toEqual({ path: 'VIDEO_NOT_UPLOADED' })
  })

  it('URL tải lên chỉ dùng một lần', async () => {
    const batch = await createBatch()
    const up = await request(app)
      .post(`/api/admin/batches/${batch.id}/video-upload`)
      .set('Authorization', admin)
      .send({ contentType: 'video/mp4', size: 5 })
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'video/mp4').send(Buffer.from('abcde')).expect(200)
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'video/mp4').send(Buffer.from('xxxxx')).expect(403)
  })
})

describe('Hồi quy sau kiểm thử độc lập (admin)', () => {
  it('gắn video: file thật không phải video (Content-Type khác lúc PUT) → 400', async () => {
    const b = (await request(app).post('/api/admin/batches').set('Authorization', admin).send({ code: 'L-X' })).body.item
    const up = await request(app)
      .post(`/api/admin/batches/${b.id}/video-upload`)
      .set('Authorization', admin)
      .send({ contentType: 'video/mp4', size: 5 })
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'text/html').send('<b>x</b>').expect(200)
    const res = await request(app).post(`/api/admin/batches/${b.id}/video`).set('Authorization', admin).send({ path: up.body.path })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ contentType: 'INVALID_VIDEO_TYPE' })
  })

  it('PATCH không có trường hợp lệ → trả bản ghi hiện có, không ghi', async () => {
    const { body } = await request(app).get('/api/admin/products').set('Authorization', admin)
    const p = body.items[0]
    const res = await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', admin).send({ id: 'x' })
    expect(res.status).toBe(200)
    expect(res.body.item).toEqual(p)
  })
})
