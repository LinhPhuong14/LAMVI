// Kiểm thử độc lập (T-11) cho D-138 phía server: không còn xử lý subdomain phong thư.
// Host dạng <slug>.thu.<domain> được đối xử như trang thường; QR luôn là {PUBLIC_SITE_URL}/thu/<slug>#<token>.
import { beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import { existsSync } from 'node:fs'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { loadConfig } from './config.js'

const SUB = 'abcdefghij.thu.lamvi.test'
const webHits = []
const fakeWeb = () => {
  const r = express.Router()
  r.get(/.*/, (req, res) => {
    webHits.push({ host: req.hostname, path: req.path })
    res.type('text/plain').send(`WEB ${req.path}`)
  })
  return r
}

let repo, auth, admin, customer
const build = (config) =>
  createApp({ repo, auth, storage: createMemoryStorage(), config, orders: createOrderService({ repo, payos: null }), web: fakeWeb() })

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return `Bearer ${s.accessToken}`
}

beforeEach(async () => {
  webHits.length = 0
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  customer = await login('khach@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
})

// Cấu hình cũ còn sót LETTER_BASE_DOMAIN/LETTER_PROTOCOL trên Vercel cũng không được kích hoạt subdomain
const configs = {
  'cấu hình thường': { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } },
  'cấu hình còn sót trường subdomain cũ': {
    publicSiteUrl: 'https://lamvi.test',
    rateLimit: { enabled: false },
    letterBaseDomain: 'thu.lamvi.test',
    letterProtocol: 'http',
  },
}

const CHECKOUT = {
  orderKind: 'self', hasMessage: true, qrLang: 'vi', recipientIsSelf: true, recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678', addressLine: '12 Hàng Bông', provinceCode: '1', wardCode: '4', paymentMethod: 'cod',
}
const CONTENT = { recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: 'Đoạn một.', occasionData: {} }

describe('D-138: không subdomain', () => {
  it('middleware letterHost đã bị xoá', () => {
    expect(existsSync(new URL('./middleware/letterHost.js', import.meta.url))).toBe(false)
  })

  it('loadConfig bỏ qua LETTER_BASE_DOMAIN / LETTER_PROTOCOL', () => {
    const c = loadConfig({ LETTER_BASE_DOMAIN: 'thu.lamvi.com.vn', LETTER_PROTOCOL: 'http', PUBLIC_SITE_URL: 'https://lamvi.com.vn/' })
    expect(c).not.toHaveProperty('letterBaseDomain')
    expect(c).not.toHaveProperty('letterProtocol')
    expect(c.publicSiteUrl).toBe('https://lamvi.com.vn')
  })

  for (const [name, config] of Object.entries(configs)) {
    it(`${name}: Host subdomain được phục vụ như trang thường (/, /products, /thu/<slug>)`, async () => {
      const app = build(config)
      for (const path of ['/', '/products', '/welcome', '/thu/abcdefghij']) {
        const r = await request(app).get(path).set('Host', SUB)
        expect(r.status).toBe(200)
        expect(r.text).toBe(`WEB ${path}`)
      }
      // "/" dưới subdomain KHÔNG bị viết lại thành /thu/<slug>
      expect(webHits.map((h) => h.path)).toEqual(['/', '/products', '/welcome', '/thu/abcdefghij'])
      // API thường vẫn chạy dưới Host đó
      expect((await request(app).get('/api/health').set('Host', SUB)).status).not.toBe(404)
    })

    it(`${name}: xuất bản → URL luôn {PUBLIC_SITE_URL}/thu/<slug>#<token>; mở được bằng Host chính lẫn Host lạ`, async () => {
      const app = build(config)
      await request(app).put('/api/cart/items/den-nguyet').set('Authorization', customer).send({ quantity: 1 })
      const o = await request(app).post('/api/orders').set('Authorization', customer).send(CHECKOUT)
      expect(o.status).toBe(201)
      const code = o.body.order.code
      expect((await request(app).put(`/api/admin/orders/${code}/letter`).set('Authorization', admin).send({ content: CONTENT })).status).toBe(200)
      const pub = await request(app).post(`/api/admin/orders/${code}/letter/publish`).set('Authorization', admin)
      expect(pub.status).toBe(200)
      const url = pub.body.item.url
      expect(url).toMatch(/^https:\/\/lamvi\.test\/thu\/[a-z][a-z0-9]{9}#[A-Za-z0-9_-]{43}$/)
      const u = new URL(url)
      const body = { slug: u.pathname.slice(5), token: u.hash.slice(1) }
      expect((await request(app).post('/api/letters/open').set('Host', 'lamvi.test').send(body)).status).toBe(200)
      // Host subdomain không có ý nghĩa gì đặc biệt: slug phải nằm trong body
      expect((await request(app).post('/api/letters/open').set('Host', `${body.slug}.thu.lamvi.test`).send({ token: body.token })).status).toBe(404)
      // Thư viện QR cũng in đúng URL đó
      const lib = await request(app).get('/api/admin/letters').set('Authorization', admin)
      expect(lib.status).toBe(200)
      expect(JSON.stringify(lib.body)).toContain(url)
    })
  }
})
