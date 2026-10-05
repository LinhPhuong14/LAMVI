// Kiểm thử độc lập (T-11): mailer.ping với phản hồi lạ và health không lộ khoá (T-49, D-52).
// Tên test có tiền tố [BUG]/[HARDENING] là test đang ĐỎ vì code nguồn chưa chặt (giữ nguyên).
import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createMailer } from './mailer.js'
import { runHealthChecks } from '../monitoring/health.js'
import { createApp } from '../app.js'
import { createMemoryRepo } from '../adapters/memory/repo.js'
import { createMemoryAuth } from '../adapters/memory/auth.js'
import { createMemoryStorage } from '../adapters/memory/storage.js'

const KEY = 're_khoa-bi-mat-12345'
const reply = (status, data, { badJson = false } = {}) =>
  vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (badJson) throw new SyntaxError('Unexpected token < in JSON')
      return data
    },
  }))
const resend = (f, from = 'LAMVI <no-reply@lamvi.com.vn>') => createMailer({ resendApiKey: KEY, from }, f)
const SHORT_CODE = /^[a-z0-9_]+$/

describe('mailer.ping — phản hồi lạ của nhà cung cấp', () => {
  it('JSON hỏng: 200 → không xác minh được tên miền; 401/429/5xx vẫn ra đúng mã', async () => {
    await expect(resend(reply(200, null, { badJson: true })).ping()).rejects.toThrow('domain_not_verified')
    await expect(resend(reply(401, null, { badJson: true })).ping()).rejects.toThrow('invalid_api_key')
    await expect(resend(reply(403, null, { badJson: true })).ping()).rejects.toThrow('invalid_api_key')
    await expect(resend(reply(429, null, { badJson: true })).ping()).rejects.toThrow('rate_limited')
    await expect(resend(reply(502, null, { badJson: true })).ping()).rejects.toThrow('http_502')
  })

  it('thiếu data / data=null / mảng rỗng → domain_not_verified (không ném lỗi lạ)', async () => {
    for (const body of [{}, { data: null }, { data: [] }, null, undefined]) {
      await expect(resend(reply(200, body)).ping(), JSON.stringify(body)).rejects.toThrow('domain_not_verified')
    }
  })

  it('status 0, 204, 3xx → http_<mã>, không bao giờ coi là ok', async () => {
    for (const s of [0, 204, 301, 404]) {
      await expect(resend(reply(s, {})).ping(), String(s)).rejects.toThrow(`http_${s}`)
    }
  })

  it('so khớp tên miền không phân biệt hoa/thường và không bị lừa bởi miền có hậu tố giống', async () => {
    const ok = reply(200, { data: [{ name: 'LAMVI.com.vn', status: 'verified' }] })
    expect(await resend(ok, 'X <No-Reply@LAMVI.COM.VN>').ping()).toEqual({})
    for (const from of ['a@evil-lamvi.com.vn', 'a@lamvi.com.vn.evil.com', 'a@xlamvi.com.vn', 'khong-co-at']) {
      await expect(resend(reply(200, { data: [{ name: 'lamvi.com.vn', status: 'verified' }] }), from).ping(), from).rejects.toThrow('domain_not_verified')
    }
    // chỉ trạng thái "verified" mới tính
    for (const status of ['pending', 'failed', 'temporary_failure', 'not_started', undefined]) {
      await expect(resend(reply(200, { data: [{ name: 'lamvi.com.vn', status }] })).ping(), String(status)).rejects.toThrow('domain_not_verified')
    }
  })

  it('mục trong danh sách thiếu tên → bỏ qua, không làm hỏng việc so khớp mục khác', async () => {
    const f = reply(200, { data: [{ status: 'verified' }, { name: 'lamvi.com.vn', status: 'verified' }] })
    expect(await resend(f).ping()).toEqual({})
  })

  it('[BUG] data.data không phải mảng, hoặc có phần tử null → lỗi là mã ngắn (không phải TypeError thô)', async () => {
    for (const body of [{ data: { name: 'lamvi.com.vn' } }, { data: 'chuoi' }, { data: [null] }, { data: [5] }]) {
      const err = await resend(reply(200, body)).ping().then(
        () => null,
        (e) => e,
      )
      expect(err, JSON.stringify(body)).toBeInstanceOf(Error)
      expect(err.message, JSON.stringify(body)).toMatch(SHORT_CODE)
    }
  })

  it('fetch ném lỗi mạng/timeout → ping từ chối; chỉ gọi một lần, chỉ tới api.resend.com, khoá chỉ ở header Authorization', async () => {
    const net = vi.fn(async () => {
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } })
    })
    await expect(resend(net).ping()).rejects.toThrow('fetch failed')
    const timeout = vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    await expect(resend(timeout).ping()).rejects.toThrow(/timeout/)
    for (const f of [net, timeout]) {
      expect(f).toHaveBeenCalledTimes(1)
      const [url, init] = f.mock.calls[0]
      expect(new URL(url).host).toBe('api.resend.com')
      expect(url).not.toContain(KEY)
      expect(init.headers.Authorization).toBe(`Bearer ${KEY}`)
      expect(init.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('Brevo: 200 với thân lạ vẫn ok; 429 → http_429; JSON hỏng không ném SyntaxError', async () => {
    const m = (f) => createMailer({ brevoApiKey: KEY, from: 'a@b.vn' }, f)
    expect(await m(reply(200, null, { badJson: true })).ping()).toEqual({})
    await expect(m(reply(429, {})).ping()).rejects.toThrow('http_429')
    await expect(m(reply(403, null, { badJson: true })).ping()).rejects.toThrow('invalid_api_key')
  })
})

describe('Health thư giao dịch — không lộ khoá, không treo', () => {
  const ok = { ping: async () => {} }
  const cfg = { useSupabase: true, mail: { from: 'LAMVI <a@lamvi.com.vn>', resendApiKey: KEY } }
  const run = (mailer, config = cfg, extra = {}) => runHealthChecks({ repo: ok, auth: ok, storage: ok, config, mailer, env: {}, ...extra })
  const mail = (h) => h.checks.find((c) => c.name === 'mail')

  it('mọi kết quả ping (ok, từ chối, mã lạ) đều không có khoá trong JSON health', async () => {
    const cases = [
      resend(reply(200, { data: [{ name: 'lamvi.com.vn', status: 'verified' }] })),
      resend(reply(401, { name: 'invalid_api_key' })),
      resend(reply(401, { name: 'restricted_api_key' })),
      resend(reply(500, {})),
      resend(reply(200, {})),
    ]
    for (const mailer of cases) {
      const h = await run(mailer)
      expect(JSON.stringify(h)).not.toContain(KEY)
      expect(JSON.stringify(h)).not.toMatch(/Bearer/)
    }
  })

  it('ping trả giá trị lạ (undefined, chuỗi, null) → không làm hỏng health', async () => {
    for (const value of [undefined, null, 'x', 5, []]) {
      const h = await run({ provider: 'resend', ping: async () => value })
      expect(mail(h), String(value)).toMatchObject({ status: 'ok', provider: 'resend' })
    }
  })

  it('ping ném giá trị không phải Error (chuỗi, undefined, null) → status error, có message cắt gọn', async () => {
    for (const thrown of ['loi chuoi', undefined, null]) {
      const h = await run({ provider: 'resend', ping: async () => Promise.reject(thrown) })
      expect(mail(h).status).toBe('error')
      expect(typeof mail(h).message).toBe('string')
    }
  })

  it('[HARDENING] message lỗi của ping chứa khoá (vd lỗi lạ có kèm tiêu đề) → bị che trước khi trả về dashboard IT', async () => {
    const h = await run({
      provider: 'resend',
      ping: async () => {
        throw new Error(`request failed: Authorization: Bearer ${KEY}`)
      },
    })
    expect(JSON.stringify(h)).not.toContain(KEY)
  })

  it('Brevo/Resend cùng cấu hình: Resend được chọn, không gọi Brevo', async () => {
    const f = reply(200, { data: [{ name: 'lamvi.com.vn', status: 'verified' }] })
    const mailer = createMailer({ resendApiKey: KEY, brevoApiKey: 'brevo-key', from: 'a@lamvi.com.vn' }, f)
    const h = await run(mailer, { useSupabase: true, mail: { from: 'a@lamvi.com.vn', resendApiKey: KEY, brevoApiKey: 'brevo-key' } })
    expect(mail(h)).toMatchObject({ status: 'ok', provider: 'resend' })
    expect(JSON.stringify(h)).not.toContain('brevo-key')
    expect(new URL(f.mock.calls[0][0]).host).toBe('api.resend.com')
  })
})

describe('GET /api/it/health end-to-end', () => {
  async function setup(mailer) {
    const repo = createMemoryRepo()
    const auth = createMemoryAuth()
    const config = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false }, mail: { from: 'a@lamvi.com.vn', resendApiKey: KEY } }
    const app = createApp({ repo, auth, storage: createMemoryStorage(), config, mailer })
    const tokens = {}
    for (const [k, role] of [['it', 'it'], ['admin', 'admin'], ['customer', 'customer']]) {
      const { user } = await auth.signUp({ email: `${k}@lamvi.test`, password: 'Gio-Hoa#Sen2026' })
      await repo.upsertProfile({ id: user.id, fullName: k, role, email: `${k}@lamvi.test` })
      tokens[k] = `Bearer ${(await auth.signIn({ email: `${k}@lamvi.test`, password: 'Gio-Hoa#Sen2026' })).accessToken}`
    }
    return { app, tokens }
  }

  it('IT thấy trạng thái mail; admin/khách/ẩn danh không thấy; không ai thấy khoá', async () => {
    const mailer = resend(reply(401, { name: 'invalid_api_key' }))
    const { app, tokens } = await setup(mailer)
    const it = await request(app).get('/api/it/health').set('Authorization', tokens.it)
    expect(it.status).toBe(200)
    expect(it.body.checks.find((c) => c.name === 'mail')).toMatchObject({ status: 'error', message: 'invalid_api_key', provider: 'resend' })
    expect(JSON.stringify(it.body)).not.toContain(KEY)
    for (const who of ['admin', 'customer']) {
      const r = await request(app).get('/api/it/health').set('Authorization', tokens[who])
      expect(r.status).toBe(403)
      expect(JSON.stringify(r.body)).not.toContain(KEY)
    }
    expect((await request(app).get('/api/it/health')).status).toBe(401)
  })

  it('mỗi lần tải dashboard gọi nhà cung cấp đúng một lần (GET, không gửi thư)', async () => {
    const f = reply(200, { data: [{ name: 'lamvi.com.vn', status: 'verified' }] })
    const { app, tokens } = await setup(resend(f))
    await request(app).get('/api/it/health').set('Authorization', tokens.it)
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][1].method ?? 'GET').toBe('GET')
    expect(String(f.mock.calls[0][0])).not.toContain('/emails')
  })
})
