// G-20: chống dò/spam đăng nhập, đăng ký, quên mật khẩu, tạo đơn.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { byIpAndEmail, clientIp, rateLimit } from './middleware/rateLimit.js'
import { loadConfig } from './config.js'
import { createMetrics } from './monitoring/metrics.js'

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

// ---------------------------------------------------------------------------
// Kiểm thử độc lập (T-11) — G-20: biên ngưỡng, cửa sổ trượt, khoá đếm và tác dụng phụ
// ---------------------------------------------------------------------------

// Repo giả đếm theo khoá (giống incrementMayCounter của adapter bộ nhớ, bỏ TTL)
function countingRepo() {
  const counts = new Map()
  return {
    counts,
    async incrementMayCounter(key) {
      const n = (counts.get(key) ?? 0) + 1
      counts.set(key, n)
      return n
    },
  }
}

const run = async (mw, req = { ip: '1.2.3.4', body: {} }) => {
  const res = { set: () => {} }
  try {
    await new Promise((resolve, reject) => mw(req, res, resolve).catch(reject))
    return 200
  } catch (err) {
    return err.status
  }
}

describe('G-20 — biên ngưỡng và cửa sổ trượt', () => {
  it('lần thứ max vẫn qua, lần max+1 bị chặn', async () => {
    const mw = rateLimit({ repo: countingRepo(), salt: 's', name: 'login', max: 200, windowSec: 300 })
    for (let i = 1; i <= 200; i += 1) expect(await run(mw), `lần ${i}`).toBe(200)
    expect(await run(mw)).toBe(429)
  })

  it('hết khối cửa sổ → đếm lại từ đầu', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
      const repo2 = countingRepo()
      const mw = rateLimit({ repo: repo2, salt: 's', name: 'login', max: 2, windowSec: 300 })
      expect(await run(mw)).toBe(200)
      expect(await run(mw)).toBe(200)
      expect(await run(mw)).toBe(429)
      // Sang khối kế tiếp: khoá đổi → đếm lại
      vi.setSystemTime(new Date('2026-10-01T00:05:00Z'))
      expect(await run(mw)).toBe(200)
      expect([...repo2.counts.keys()].map((k) => k.split(':').pop())).toEqual(
        expect.arrayContaining([String(Math.floor(Date.parse('2026-10-01T00:00:00Z') / 300_000))]),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('TTL của bộ đếm gấp đôi cửa sổ (khối cũ tự hết hạn, không rò rỉ)', async () => {
    const ttls = []
    const mw = rateLimit({
      repo: { incrementMayCounter: async (k, ttl) => (ttls.push(ttl), 1) },
      salt: 's',
      name: 'login',
      max: 5,
      windowSec: 300,
    })
    await run(mw)
    expect(ttls).toEqual([600])
  })

  it('các nhóm giới hạn khác tên không dùng chung bộ đếm', async () => {
    const shared = countingRepo()
    const a = rateLimit({ repo: shared, salt: 's', name: 'login', max: 1, windowSec: 300 })
    const b = rateLimit({ repo: shared, salt: 's', name: 'register', max: 1, windowSec: 300 })
    expect(await run(a)).toBe(200)
    expect(await run(a)).toBe(429)
    expect(await run(b)).toBe(200)
  })
})

describe('G-20 — byIpAndEmail và clientIp với đầu vào lạ', () => {
  it('body không có email / email không phải chuỗi / body là mảng → chỉ tính theo IP', async () => {
    for (const body of [{}, undefined, null, [{ email: 'an@example.com' }], { email: 123 }, { email: null }, { email: { a: 1 } }]) {
      expect(byIpAndEmail({ ip: '1.2.3.4', body }).filter(Boolean), JSON.stringify(body)).toEqual(['ip:1.2.3.4'])
    }
  })

  it('email được chuẩn hoá (trim + chữ thường) → cùng một bộ đếm', () => {
    const a = byIpAndEmail({ ip: '1.2.3.4', body: { email: '  An@EXAMPLE.com ' } })
    const b = byIpAndEmail({ ip: '9.9.9.9', body: { email: 'an@example.com' } })
    expect(a[1]).toBe('em:an@example.com')
    expect(a[1]).toBe(b[1])
  })

  it('clientIp: không có req.ip → lấy socket.remoteAddress; không có gì → "unknown"', () => {
    expect(clientIp({ ip: '1.2.3.4' })).toBe('1.2.3.4')
    expect(clientIp({ socket: { remoteAddress: '5.6.7.8' } })).toBe('5.6.7.8')
    // KHÔNG trả chuỗi rỗng: chuỗi rỗng bị filter(Boolean) loại → request đó không bị giới hạn gì
    expect(clientIp({})).toBe('unknown')
  })

  it('không xác định được IP: vẫn bị giới hạn (không lách được bằng cách giấu IP)', async () => {
    const mw = rateLimit({ repo: countingRepo(), salt: 's', name: 'password', max: 1, windowSec: 300 })
    expect(await run(mw, { body: {} })).toBe(200)
    expect(await run(mw, { body: {} })).toBe(429)
  })

  it('không xác định được IP: byIpAndEmail cũng gom về một bộ đếm "unknown"', async () => {
    const repo2 = countingRepo()
    const mw = rateLimit({ repo: repo2, salt: 's', name: 'login', max: 1, windowSec: 300, keys: byIpAndEmail })
    expect(await run(mw, { body: {} })).toBe(200)
    expect(await run(mw, { body: {} })).toBe(429)
    expect([...repo2.counts.keys()]).toHaveLength(1)
  })
})

describe('G-20 — tác dụng phụ lên người dùng hợp lệ', () => {
  const CHECKOUT = {
    orderKind: 'self',
    recipientIsSelf: true,
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0912345678',
    addressLine: '12 Hàng Bông',
    province: 'Hà Nội',
    paymentMethod: 'cod',
  }

  async function customerToken() {
    await register('khach@example.com')
    const { body } = await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'matkhau123' })
    return `Bearer ${body.accessToken}`
  }

  it('cùng IP: chạm ngưỡng vì người khác dò mật khẩu → người dùng hợp lệ cũng bị chặn (rủi ro NAT/văn phòng)', async () => {
    await register('an@example.com')
    for (let i = 0; i < 3; i += 1) await login(`nanan${i}@example.com`, 'sai')
    const ok = await request(app).post('/api/auth/login').send({ email: 'an@example.com', password: 'matkhau123' })
    expect(ok.status).toBe(429)
  })

  // Giới hạn của endpoint cần đăng nhập chạy SAU requireAuth: request không token (401) không
  // được tiêu hạn mức, nếu không thì chỉ cần spam 401 là chặn được checkout của cả một dải IP.
  it('POST /orders: request chưa đăng nhập KHÔNG tiêu hạn mức của khách hợp lệ', async () => {
    const token = await customerToken()
    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).post('/api/orders').send(CHECKOUT)).status).toBe(401)
    }
    await request(app).put('/api/cart/items/den-nguyet').set('Authorization', token).send({ quantity: 1 })
    const res = await request(app).post('/api/orders').set('Authorization', token).send(CHECKOUT)
    expect(res.status).toBe(201)
  })

  // Trước T-49 bộ giới hạn đổi/đặt lại mật khẩu truyền keys `() => []` nên thực tế không đếm gì.
  it('reset-password: đoán token bị chặn theo IP sau ngưỡng (kể cả token sai)', async () => {
    const guess = () => request(app).post('/api/auth/reset-password').send({ token: 'doan-bua', password: 'matkhaumoi1' })
    expect((await guess()).status).toBe(400)
    expect((await guess()).status).toBe(400)
    const blocked = await guess()
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
  })

  it('change-password: đếm theo tài khoản — thử mật khẩu hiện tại liên tục bị chặn, không ảnh hưởng reset-password', async () => {
    const token = await customerToken()
    const change = (currentPassword) =>
      request(app).post('/api/auth/change-password').set('Authorization', token).send({ currentPassword, password: 'matkhaumoi9' })
    expect((await change('sai-1')).status).toBe(400)
    expect((await change('sai-2')).status).toBe(400)
    expect((await change('matkhau123')).status).toBe(429)
    // Luồng đặt lại mật khẩu có bộ đếm riêng nên vẫn dùng được
    const reset = await request(app).post('/api/auth/reset-password').send({ token: 'x', password: 'matkhaumoi1' })
    expect(reset.status).toBe(400)
  })
})

describe('G-20 — 429 không làm hỏng errorHandler và số liệu API', () => {
  it('thân lỗi đúng dạng chuẩn, có Retry-After, không lộ chi tiết', async () => {
    for (let i = 0; i < 3; i += 1) await login('an@example.com')
    const r = await login('an@example.com')
    expect(r.status).toBe(429)
    expect(Object.keys(r.body)).toEqual(['error'])
    expect(Object.keys(r.body.error).sort()).toEqual(['code', 'message'])
    expect(r.body.error.message).not.toMatch(/an@example\.com/)
  })

  it('429 được đếm là 4xx (không phải 5xx) và không vào nhật ký lỗi của IT', async () => {
    const metrics = createMetrics({ repo, classify: () => ({ kind: 'other' }) })
    const app2 = createApp({ repo, auth, storage: createMemoryStorage(), config, metrics })
    const hit = () => request(app2).post('/api/auth/login').send({ email: 'an@example.com', password: 'sai' })
    for (let i = 0; i < 3; i += 1) await hit()
    expect((await hit()).status).toBe(429)
    const sum = await metrics.summary('1h')
    expect(sum.totals.s5xx).toBe(0)
    expect(sum.totals.s4xx).toBeGreaterThanOrEqual(4)
    expect(await metrics.recentErrors('1h')).toEqual([])
  })
})

describe('G-20 — lấy lại liên kết thanh toán cũng bị giới hạn', () => {
  it('POST /orders/:code/payment quá ngưỡng → 429, không tạo thêm link payOS', async () => {
    const payos = {
      checksumKey: 'k',
      createPaymentLink: vi.fn(async (p) => ({ checkoutUrl: `https://pay.test/${p.orderCode}`, qrCode: 'QR' })),
      cancelPaymentLink: vi.fn(async () => {}),
      getPaymentLink: vi.fn(),
    }
    const repo2 = createMemoryRepo()
    const auth2 = createMemoryAuth()
    const app2 = createApp({
      repo: repo2,
      auth: auth2,
      storage: createMemoryStorage(),
      // Ngưỡng tạo đơn cao để không chặn bước chuẩn bị
      config: { ...config, rateLimit: { ...config.rateLimit, order: { max: 50, windowSec: 3600 } } },
      payos,
      orders: createOrderService({ repo: repo2, payos }),
    })
    const { user } = await auth2.signUp({ email: 'khach@example.com', password: 'matkhau123' })
    await repo2.upsertProfile({ id: user.id, fullName: 'A' })
    const s = await auth2.signIn({ email: 'khach@example.com', password: 'matkhau123' })
    const token = `Bearer ${s.accessToken}`
    await request(app2).put('/api/cart/items/den-nguyet').set('Authorization', token).send({ quantity: 1 })
    const created = await request(app2)
      .post('/api/orders')
      .set('Authorization', token)
      .send({
        orderKind: 'self',
        recipientIsSelf: true,
        recipientName: 'Nguyễn Văn A',
        recipientPhone: '0912345678',
        addressLine: '12 Hàng Bông',
        province: 'Hà Nội',
        paymentMethod: 'payos',
      })
    expect(created.status).toBe(201)
    const code = created.body.order.code
    // Ngưỡng của nhóm 'payment-link' lấy theo config.rateLimit.order (ở test là 50)
    let blocked = 0
    for (let i = 0; i < 60; i += 1) {
      const r = await request(app2).post(`/api/orders/${code}/payment`).set('Authorization', token).send({})
      if (r.status === 429) blocked += 1
    }
    expect(blocked).toBeGreaterThan(0)
    // Không tạo link cho các lần bị chặn: 1 lần lúc tạo đơn + tối đa 50 lần lấy lại
    expect(payos.createPaymentLink.mock.calls.length).toBeLessThanOrEqual(51)
  })
})
