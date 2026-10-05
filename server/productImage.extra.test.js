// Ảnh sản phẩm (G-23, G-33): tải lên bằng signed URL, gắn vào sản phẩm, gỡ, và hiển thị cho khách.
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { PRODUCT_IMAGE_BUCKET, BATCH_VIDEO_BUCKET } from './adapters/supabase/storage.js'

let app, repo, auth, storage, admin, customer, productId

const config = { publicSiteUrl: 'https://lamvi.test', maxVideoMb: 1, maxImageMb: 1 }

async function login(email, role) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return `Bearer ${s.accessToken}`
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  storage = createMemoryStorage({ maxBytes: 2 * 1024 * 1024 })
  app = createApp({ repo, auth, storage, config })
  admin = await login('admin@lamvi.test', 'admin')
  customer = await login('khach@lamvi.test', 'customer')
  const list = await request(app).get('/api/admin/products').set('Authorization', admin)
  productId = list.body.items[0].id
})

// Tải một "ảnh" lên qua đúng hai bước như frontend làm
async function uploadImage({ contentType = 'image/webp', size = 1024, putType = contentType, id = productId } = {}) {
  const up = await request(app)
    .post(`/api/admin/products/${id}/image-upload`)
    .set('Authorization', admin)
    .send({ contentType, size })
  if (up.status !== 201) return { up }
  await request(app).put(up.body.uploadUrl).set('Content-Type', putType).send(Buffer.alloc(size, 1))
  const attach = await request(app)
    .post(`/api/admin/products/${id}/image`)
    .set('Authorization', admin)
    .send({ path: up.body.path })
  return { up, attach }
}

describe('Cấp URL tải ảnh (bước 1)', () => {
  it('admin: trả đường dẫn trong thư mục của sản phẩm + đuôi theo kiểu file', async () => {
    const up = await request(app)
      .post(`/api/admin/products/${productId}/image-upload`)
      .set('Authorization', admin)
      .send({ contentType: 'image/jpeg', size: 2048 })
    expect(up.status).toBe(201)
    expect(up.body.path).toMatch(new RegExp(`^${productId}/\\d+-[0-9a-f]{8}\\.jpg$`))
    expect(up.body.uploadUrl).toBeTruthy()
  })

  it('từ chối kiểu file không phải ảnh — kể cả SVG (có thể chứa script)', async () => {
    for (const contentType of ['image/svg+xml', 'text/html', 'video/mp4', 'image/gif', '', null]) {
      const r = await request(app)
        .post(`/api/admin/products/${productId}/image-upload`)
        .set('Authorization', admin)
        .send({ contentType, size: 1024 })
      expect(r.status).toBe(400)
      expect(r.body.error.fields.contentType).toBe('INVALID_IMAGE_TYPE')
    }
  })

  it('không nhận khoá kế thừa của IMAGE_TYPES (__proto__, toString)', async () => {
    for (const contentType of ['__proto__', 'toString', 'constructor']) {
      const r = await request(app)
        .post(`/api/admin/products/${productId}/image-upload`)
        .set('Authorization', admin)
        .send({ contentType, size: 1024 })
      expect(r.status).toBe(400)
    }
  })

  it('từ chối kích thước sai hoặc vượt MAX_IMAGE_MB', async () => {
    const bad = async (size) =>
      (
        await request(app)
          .post(`/api/admin/products/${productId}/image-upload`)
          .set('Authorization', admin)
          .send({ contentType: 'image/png', size })
      ).body.error.fields.size
    expect(await bad(0)).toBe('INVALID')
    expect(await bad(-1)).toBe('INVALID')
    expect(await bad(1.5)).toBe('INVALID')
    expect(await bad(2 * 1024 * 1024)).toBe('IMAGE_TOO_LARGE')
  })

  it('sản phẩm không tồn tại → 404', async () => {
    const r = await request(app)
      .post('/api/admin/products/11111111-1111-4111-8111-999999999999/image-upload')
      .set('Authorization', admin)
      .send({ contentType: 'image/png', size: 1024 })
    expect(r.status).toBe(404)
  })

  it('khách không gọi được (D-38)', async () => {
    const r = await request(app)
      .post(`/api/admin/products/${productId}/image-upload`)
      .set('Authorization', customer)
      .send({ contentType: 'image/png', size: 1024 })
    expect(r.status).toBe(403)
  })
})

describe('Gắn ảnh vào sản phẩm (bước 2)', () => {
  it('gắn thành công → sản phẩm có imageUrl và imagePath', async () => {
    const { up, attach } = await uploadImage()
    expect(attach.status).toBe(200)
    expect(attach.body.item.imagePath).toBe(up.body.path)
    expect(attach.body.item.imageUrl).toContain(PRODUCT_IMAGE_BUCKET)
  })

  it('chưa tải file lên mà gắn → 400', async () => {
    const up = await request(app)
      .post(`/api/admin/products/${productId}/image-upload`)
      .set('Authorization', admin)
      .send({ contentType: 'image/png', size: 1024 })
    const r = await request(app)
      .post(`/api/admin/products/${productId}/image`)
      .set('Authorization', admin)
      .send({ path: up.body.path })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.path).toBe('IMAGE_NOT_UPLOADED')
  })

  it('đường dẫn ngoài thư mục sản phẩm hoặc có ".." → 400 (không đọc được file của sản phẩm khác)', async () => {
    for (const path of ['khac/anh.png', `${productId}/../khac/anh.png`, '/etc/passwd', '', null, 123]) {
      const r = await request(app)
        .post(`/api/admin/products/${productId}/image`)
        .set('Authorization', admin)
        .send({ path })
      expect(r.status).toBe(400)
      expect(r.body.error.fields.path).toBe('INVALID')
    }
  })

  it('xin URL cho ảnh nhưng PUT lên file kiểu khác → bị chặn ở bước gắn', async () => {
    const { attach } = await uploadImage({ contentType: 'image/png', putType: 'text/html' })
    expect(attach.status).toBe(400)
    expect(attach.body.error.fields.contentType).toBe('INVALID_IMAGE_TYPE')
  })

  it('đổi ảnh: sản phẩm trỏ ảnh mới, object cũ bị xoá khỏi Storage', async () => {
    const first = await uploadImage()
    const second = await uploadImage()
    expect(second.attach.body.item.imagePath).toBe(second.up.body.path)
    expect(storage.getObject(first.up.body.path, PRODUCT_IMAGE_BUCKET)).toBeUndefined()
    expect(storage.getObject(second.up.body.path, PRODUCT_IMAGE_BUCKET)).toBeTruthy()
  })
})

describe('Gỡ ảnh', () => {
  it('gỡ → imageUrl/imagePath về null, object bị xoá', async () => {
    const { up } = await uploadImage()
    const r = await request(app).delete(`/api/admin/products/${productId}/image`).set('Authorization', admin)
    expect(r.status).toBe(200)
    expect(r.body.item.imageUrl).toBeNull()
    expect(r.body.item.imagePath).toBeNull()
    expect(storage.getObject(up.body.path, PRODUCT_IMAGE_BUCKET)).toBeUndefined()
  })

  it('sản phẩm chưa có ảnh → 200, không đổi gì', async () => {
    const r = await request(app).delete(`/api/admin/products/${productId}/image`).set('Authorization', admin)
    expect(r.status).toBe(200)
    expect(r.body.item.imageUrl).toBeFalsy()
  })

  it('khách không gỡ được', async () => {
    expect((await request(app).delete(`/api/admin/products/${productId}/image`).set('Authorization', customer)).status).toBe(403)
  })
})

describe('Ảnh trong API công khai và SEO', () => {
  it('chưa có ảnh → image: null (frontend dùng hình minh hoạ, G-33)', async () => {
    const r = await request(app).get('/api/products')
    expect(r.body.items.every((p) => p.image === null)).toBe(true)
  })

  it('có ảnh → trả { url, alt } theo ngôn ngữ; không lộ imagePath cho khách', async () => {
    await uploadImage()
    await request(app)
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', admin)
      .send({ imageAlt: { vi: 'Đèn Nguyệt trên nền giấy dó', en: 'Nguyet lantern' } })

    const vi = await request(app).get('/api/products')
    const item = vi.body.items.find((p) => p.image)
    expect(item.image.alt).toBe('Đèn Nguyệt trên nền giấy dó')
    expect(item.image.url).toBeTruthy()
    expect(item).not.toHaveProperty('imagePath')

    const en = await request(app).get('/api/products?lang=en')
    expect(en.body.items.find((p) => p.image).image.alt).toBe('Nguyet lantern')
  })

  it('thiếu bản dịch alt → dùng tiếng Việt (D-40)', async () => {
    await uploadImage()
    await request(app)
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', admin)
      .send({ imageAlt: { vi: 'Chỉ có tiếng Việt' } })
    const zh = await request(app).get('/api/products?lang=zh')
    expect(zh.body.items.find((p) => p.image).image.alt).toBe('Chỉ có tiếng Việt')
  })

  it('chú thích alt quá dài → 400 theo trường', async () => {
    const r = await request(app)
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', admin)
      .send({ imageAlt: { vi: 'x'.repeat(200) } })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.imageAlt).toBeTruthy()
  })
})

describe('Hai bucket không đụng nhau', () => {
  it('cùng đường dẫn ở bucket ảnh và bucket video là hai object khác nhau', async () => {
    const up = await request(app)
      .post(`/api/admin/products/${productId}/image-upload`)
      .set('Authorization', admin)
      .send({ contentType: 'image/png', size: 16 })
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'image/png').send(Buffer.alloc(16, 7))
    expect(storage.getObject(up.body.path, PRODUCT_IMAGE_BUCKET)).toBeTruthy()
    expect(storage.getObject(up.body.path, BATCH_VIDEO_BUCKET)).toBeUndefined()
  })
})
