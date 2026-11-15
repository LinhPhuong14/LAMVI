// D-152: tải logo doanh nghiệp cho phong thư
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { validateLetterContent } from './domain/letter.js'

let app, repo, auth, admin, customer
async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return `Bearer ${s.accessToken}`
}
beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } }, orders: createOrderService({ repo, payos: null }) })
  admin = await login('admin@lamvi.test', 'admin')
  customer = await login('khach@lamvi.test')
})

async function upload(type = 'image/png', size = 64, putType = type) {
  const up = await request(app).post('/api/admin/letters/logo-upload').set('Authorization', admin).send({ contentType: type, size })
  if (up.status !== 201) return { up }
  await request(app).put(up.body.uploadUrl).set('Content-Type', putType).send(Buffer.alloc(size, 1))
  const done = await request(app).post('/api/admin/letters/logo').set('Authorization', admin).send({ path: up.body.path })
  return { up, done }
}

describe('D-152: logo doanh nghiệp', () => {
  it('tải PNG → URL công khai dùng được trong nội dung thư', async () => {
    const { up, done } = await upload()
    expect(up.status).toBe(201)
    expect(up.body.path).toMatch(/^letter-logos\/\d+-[0-9a-f]{12}\.png$/)
    expect(done.status).toBe(200)
    expect(typeof done.body.url).toBe('string')
    expect(validateLetterContent({ occasion: 'thankYou', kind: 'text', message: 'x', business: { logoUrl: done.body.url } }).errors).toEqual({})
  })
  it('chặn SVG/GIF, quá 2 MB, kiểu thật khác lúc xin URL', async () => {
    expect((await upload('image/svg+xml')).up.status).toBe(400)
    expect((await upload('image/gif')).up.status).toBe(400)
    expect((await upload('image/png', 2 * 1024 * 1024 + 1)).up.status).toBe(400)
    const { done } = await upload('image/png', 64, 'text/html')
    expect(done.status).toBe(400)
  })
  it('đường dẫn ngoài thư mục logo / có ".." / chưa tải → 400', async () => {
    for (const path of ['abc/x.png', 'letter-logos/../x.png', 'letter-logos/none.png', 42]) {
      const r = await request(app).post('/api/admin/letters/logo').set('Authorization', admin).send({ path })
      expect(r.status, String(path)).toBe(400)
    }
  })
  it('chỉ admin', async () => {
    expect((await request(app).post('/api/admin/letters/logo-upload').send({ contentType: 'image/png', size: 1 })).status).toBe(401)
    expect((await request(app).post('/api/admin/letters/logo-upload').set('Authorization', customer).send({ contentType: 'image/png', size: 1 })).status).toBe(403)
  })
})
