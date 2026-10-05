// Kiểm thử độc lập (T-11) — G-28 / NFR-PRV-002: nhật ký lỗi 5xx mà IT xem được không được
// chứa dữ liệu cá nhân. Kiểm redactSecrets (che email/SĐT/chuỗi giống token) và sanitizePath.
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMetrics, redactSecrets } from './monitoring/metrics.js'
import { sanitizePath } from '../src/analytics/ga.js'

describe('G-28 — redactSecrets: email', () => {
  it('email trong câu, trong query string và trong dấu ngoặc đều bị che', () => {
    for (const text of [
      'Không gửi được cho an.nguyen@example.com',
      'GET /api/x?email=an.nguyen@example.com thất bại',
      'duplicate key (email)=(an.nguyen@example.com)',
      'to=<an.nguyen@example.com>',
      'AN.NGUYEN@EXAMPLE.COM không tồn tại',
    ]) {
      expect(redactSecrets(text), text).not.toMatch(/an\.nguyen@example\.com/i)
    }
  })

  it('nhiều email trong một thông điệp → che hết', () => {
    const out = redactSecrets('gửi a@b.vn và c@d.com.vn rồi e@f.org')
    expect(out).not.toMatch(/@/)
    expect(out.match(/\[email\]/g)).toHaveLength(3)
  })
})

describe('G-28 — redactSecrets: số điện thoại Việt Nam', () => {
  it.each([
    '0912345678',
    '0912 345 678',
    '0912.345.678',
    '0912-345-678',
    '+84912345678',
    '+84 912 345 678',
    '(+84) 912 345 678',
    '84912345678',
  ])('che %s', (phone) => {
    const out = redactSecrets(`Giao hàng lỗi cho số ${phone} tại Hà Nội`)
    expect(out).toContain('[phone]')
    expect(out).not.toContain(phone)
  })
})

describe('G-28 — redactSecrets: chuỗi giống token (biên 24 ký tự)', () => {
  it('23 ký tự vẫn giữ nguyên, 24 ký tự bị che', () => {
    const s23 = 'a'.repeat(23)
    const s24 = 'a'.repeat(24)
    expect(redactSecrets(`ma ${s23} loi`)).toContain(s23)
    expect(redactSecrets(`ma ${s24} loi`)).not.toContain(s24)
    expect(redactSecrets(`ma ${s24} loi`)).toContain('[token]')
  })

  it('chuỗi dài có gạch ngang / gạch dưới (UUID, JWT, khoá API) bị che', () => {
    for (const secret of [
      '3f2b9c1e-7a4d-4e5f-9b8a-1c2d3e4f5a6b',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      // Không dùng tiền tố khoá thật của bất kỳ nhà cung cấp nào: GitHub secret scanning sẽ chặn
      // push dù đây chỉ là chuỗi bịa trong test.
      'apikey_abcdefghijklmnopqrstuvwxyz',
      'a_b-c_d-e_f-g_h-i_j-k_l-m_n-o_p',
    ]) {
      expect(redactSecrets(`token ${secret} sai`), secret).not.toContain(secret)
    }
  })

  it('mã đơn và mã lô (ngắn) vẫn giữ để IT lần được lỗi', () => {
    expect(redactSecrets('Không lưu được đơn LV2610-ACDEFGH')).toContain('LV2610-ACDEFGH')
    expect(redactSecrets('Lô LO-2026-09 lỗi')).toContain('LO-2026-09')
  })

  it('câu tiếng Việt bình thường không bị che nhầm', () => {
    const msg = 'Không kết nối được cơ sở dữ liệu sau 3 lần thử'
    expect(redactSecrets(msg)).toBe(msg)
  })

  it('đầu vào không phải chuỗi không làm ném lỗi', () => {
    for (const v of [null, undefined, 123, { a: 1 }]) {
      expect(() => redactSecrets(v), String(v)).not.toThrow()
    }
  })
})

describe('G-28 — sanitizePath cho nhật ký lỗi', () => {
  it('undefined / null / rỗng → "/"', () => {
    for (const v of [undefined, null, '', 0, {}]) expect(sanitizePath(v)).toBe('/')
  })

  it('token trang QR và token đặt lại mật khẩu bị thay bằng nhãn cố định', () => {
    expect(sanitizePath('/qr/bimat')).toBe('/qr/:token')
    expect(sanitizePath('//qr/bimat')).toBe('/qr/:token')
    expect(sanitizePath('/EN/QR/bimat')).toBe('/en/qr/:token')
    expect(sanitizePath('/zh/reset-password/eyJhbGci')).toBe('/zh/reset-password/:token')
    expect(sanitizePath('/qr/bimat?x=1#y')).toBe('/qr/:token')
  })

  // sanitizePath KHÔNG cắt độ dài — việc cắt do middleware số liệu làm (slice 200)
  it('đường dẫn rất dài được trả nguyên vẹn (cắt là việc của middleware)', () => {
    const long = `/api/${'a'.repeat(5000)}`
    expect(sanitizePath(long)).toBe(long)
  })
})

describe('G-28 — nhật ký lỗi 5xx từ endpoint đơn hàng', () => {
  let app, repo, metrics, token

  beforeEach(async () => {
    repo = createMemoryRepo()
    const auth = createMemoryAuth()
    metrics = createMetrics({ repo, classify: () => ({ kind: 'other' }) })
    app = createApp({
      repo,
      auth,
      storage: createMemoryStorage(),
      config: { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } },
      metrics,
    })
    const { user } = await auth.signUp({ email: 'khach@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'A' })
    const s = await auth.signIn({ email: 'khach@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    token = `Bearer ${s.accessToken}`
  })

  it('lỗi DB có kèm email/SĐT khách → nhật ký chỉ còn [email]/[phone], không có query string', async () => {
    repo.getOrderByCode = async () => {
      throw new Error('insert failed: recipient (khach@lamvi.test, 0912345678) row 3f2b9c1e-7a4d-4e5f-9b8a-1c2d3e4f5a6b')
    }
    const res = await request(app)
      .get('/api/orders/LV2610-ACDEFGH?email=khach@lamvi.test')
      .set('Authorization', token)
    expect(res.status).toBe(500)
    const [e] = await metrics.recentErrors('1h')
    expect(e.message).not.toContain('khach@lamvi.test')
    expect(e.message).not.toContain('0912345678')
    expect(e.message).not.toContain('3f2b9c1e-7a4d-4e5f-9b8a-1c2d3e4f5a6b')
    expect(e.message).toContain('[email]')
    expect(e.message).toContain('[phone]')
    // Query string không được lưu (có thể chứa dữ liệu cá nhân)
    expect(e.path).toBe('/api/orders/LV2610-ACDEFGH')
    // Thân phản hồi cho khách cũng không lộ chi tiết nội bộ
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' })
  })

  it('nhật ký không chứa nội dung body gửi lên (địa chỉ, lời chúc)', async () => {
    repo.getCart = async () => {
      throw new Error('cart hong')
    }
    await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', token)
      .send({ couponCode: 'BIMAT', note: '12 Hàng Bông, gọi 0912345678' })
    const [e] = await metrics.recentErrors('1h')
    expect(JSON.stringify(e)).not.toContain('Hàng Bông')
    expect(JSON.stringify(e)).not.toContain('0912345678')
  })
})
