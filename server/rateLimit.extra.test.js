// G-20: chống dò/spam đăng nhập, đăng ký, quên mật khẩu, tạo đơn.
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { rateLimit } from './middleware/rateLimit.js'
import { loadConfig } from './config.js'

let repo, auth, app

// Ngưỡng nhỏ để test nhanh; cửa sổ dài để không hết hạn giữa chừng
const config = {
  publicSiteUrl: 'https://lamvi.test',
  mayHashSalt: 'muoi-test',
  rateLimit: {
    enabled: true,
    login: { max: 3, windowSec: 3600 },
    register: { max: 2, windowSec: 3600 },
    forgot: { max: 2, windowSec: 3600 },
    password: { max: 2, windowSec: 3600 },
    order: { max: 2, windowSec: 3600 },
  },
}

beforeEach(() => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = createApp({
    repo,
    auth,
    storage: createMemoryStorage(),
    config,
    orders: createOrderService({ repo }),
  })
})

const login = (email, password = 'saibetnhe') => request(app).post('/api/auth/login').send({ email, password })

const register = (email) =>
  request(app)
    .post('/api/auth/register')
    .send({ email, password: 'matkhau123', fullName: 'A', phone: '0912345678' })

describe('Đăng nhập (dò mật khẩu)', () => {
  it('quá số lần cho phép → 429 kèm Retry-After, không tiết lộ thêm gì', async () => {
    for (let i = 0; i < 3; i += 1) expect((await login('an@example.com')).status).toBe(401)
    const blocked = await login('an@example.com')
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
    expect(blocked.headers['retry-after']).toBe('3600')
  })

  it('chặn cả khi đổi IP nhưng cùng email (dò một tài khoản cụ thể)', async () => {
    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/api/auth/login').set('X-Forwarded-For', `10.0.0.${i}`).send({ email: 'an@example.com', password: 'sai' })
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.99')
      .send({ email: 'an@example.com', password: 'sai' })
    expect(blocked.status).toBe(429)
  })

  it('email khác vẫn đăng nhập được khi chưa chạm ngưỡng IP', async () => {
    await register('an@example.com')
    // Hai lần sai cho email khác (chưa tới ngưỡng IP là 3)
    await login('khac@example.com')
    await login('khac@example.com')
    expect((await request(app).post('/api/auth/login').send({ email: 'an@example.com', password: 'matkhau123' })).status).toBe(200)
  })
})

describe('Đăng ký (spam tài khoản)', () => {
  it('quá ngưỡng → 429, không tạo thêm tài khoản', async () => {
    expect((await register('a1@example.com')).status).toBe(201)
    expect((await register('a2@example.com')).status).toBe(201)
    const blocked = await register('a3@example.com')
    expect(blocked.status).toBe(429)
    // Tài khoản thứ ba không được tạo → đăng nhập báo sai thông tin, không phải 200
    expect((await request(app).post('/api/auth/login').send({ email: 'a3@example.com', password: 'matkhau123' })).status).toBe(401)
  })
})

describe('Quên mật khẩu (spam thư + dò email)', () => {
  it('quá ngưỡng → 429', async () => {
    await register('an@example.com')
    for (let i = 0; i < 2; i += 1) {
      expect((await request(app).post('/api/auth/forgot-password').send({ email: 'an@example.com' })).status).toBe(202)
    }
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'an@example.com' })).status).toBe(429)
  })
})

describe('Tạo đơn (spam đơn, giữ lượt coupon)', () => {
  const CHECKOUT = {
    orderKind: 'self',
    recipientIsSelf: true,
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0912345678',
    addressLine: '12 Hàng Bông',
    province: 'Hà Nội',
    paymentMethod: 'cod',
  }

  it('quá ngưỡng → 429', async () => {
    await register('an@example.com')
    const { body } = await request(app).post('/api/auth/login').send({ email: 'an@example.com', password: 'matkhau123' })
    const token = `Bearer ${body.accessToken}`
    const order = async () => {
      await request(app).put('/api/cart/items/den-nguyet').set('Authorization', token).send({ quantity: 1 })
      return request(app).post('/api/orders').set('Authorization', token).send(CHECKOUT)
    }
    expect((await order()).status).toBe(201)
    expect((await order()).status).toBe(201)
    expect((await order()).status).toBe(429)
  })
})

describe('Cấu hình và hành vi của bộ giới hạn', () => {
  it('tắt bằng cấu hình → không chặn (chỉ dùng cho test)', async () => {
    const off = createApp({
      repo: createMemoryRepo(),
      auth: createMemoryAuth(),
      config: { ...config, rateLimit: { ...config.rateLimit, enabled: false } },
    })
    for (let i = 0; i < 10; i += 1) {
      expect((await request(off).post('/api/auth/login').send({ email: 'x@y.vn', password: 'sai' })).status).toBe(401)
    }
  })

  it('mặc định BẬT: loadConfig không có RATE_LIMIT → enabled true', () => {
    expect(loadConfig({}).rateLimit.enabled).toBe(true)
    expect(loadConfig({ RATE_LIMIT: '0' }).rateLimit.enabled).toBe(false)
  })

  it('adapter không có bộ đếm → không chặn, không ném lỗi', async () => {
    const mw = rateLimit({ repo: {}, salt: 's', name: 'x', max: 1, windowSec: 60 })
    let called = 0
    await mw({ ip: '1.2.3.4', body: {} }, { set: () => {} }, () => (called += 1))
    await mw({ ip: '1.2.3.4', body: {} }, { set: () => {} }, () => (called += 1))
    expect(called).toBe(2)
  })

  it('không lưu IP hay email thô — khoá đếm là băm', async () => {
    const keys = []
    const fakeRepo = {
      incrementMayCounter: async (key) => {
        keys.push(key)
        return 1
      },
    }
    const mw = rateLimit({ repo: fakeRepo, salt: 'muoi', name: 'login', max: 5, windowSec: 60, keys: () => ['ip:1.2.3.4', 'em:an@example.com'] })
    await mw({}, { set: () => {} }, () => {})
    expect(keys).toHaveLength(2)
    for (const k of keys) {
      expect(k).not.toContain('1.2.3.4')
      expect(k).not.toContain('an@example.com')
      expect(k).toMatch(/^rl:login:[0-9a-f]{32}:\d+$/)
    }
  })

  it('cùng giá trị + muối khác nhau → khoá khác nhau (không đối chiếu được giữa môi trường)', async () => {
    const keysOf = async (salt) => {
      const out = []
      const mw = rateLimit({
        repo: { incrementMayCounter: async (k) => (out.push(k), 1) },
        salt,
        name: 'login',
        max: 5,
        windowSec: 60,
        keys: () => ['ip:1.2.3.4'],
      })
      await mw({}, { set: () => {} }, () => {})
      return out[0]
    }
    expect(await keysOf('muoi-a')).not.toBe(await keysOf('muoi-b'))
  })
})
