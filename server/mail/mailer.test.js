import { describe, expect, it, vi } from 'vitest'
import { createConsoleMailer, createMailer, createMemoryMailer } from './mailer.js'
import { passwordChangedMail, recoveryMail } from './templates.js'

const ok = () => vi.fn(async () => ({ ok: true, status: 200 }))
const msg = { to: 'an@example.com', subject: 'S', text: 'T', html: '<p>H</p>' }

describe('createMailer (T-49)', () => {
  it('thiếu MAIL_FROM hoặc khoá → null', () => {
    expect(createMailer({})).toBeNull()
    expect(createMailer({ from: 'LAMVI <no-reply@lamvi.vn>' })).toBeNull()
    expect(createMailer({ resendApiKey: 'k' })).toBeNull()
  })

  it('Resend: POST /emails với Bearer, from/to/subject/text/html', async () => {
    const fetchImpl = ok()
    const m = createMailer({ from: 'LAMVI <no-reply@lamvi.vn>', resendApiKey: 're_x' }, fetchImpl)
    expect(m.provider).toBe('resend')
    await m.send(msg)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_x')
    expect(JSON.parse(init.body)).toEqual({ from: 'LAMVI <no-reply@lamvi.vn>', to: ['an@example.com'], subject: 'S', text: 'T', html: '<p>H</p>' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('Brevo: tách tên + địa chỉ người gửi, khoá ở header api-key', async () => {
    const fetchImpl = ok()
    const m = createMailer({ from: '"LAMVI" <no-reply@lamvi.vn>', brevoApiKey: 'xkeysib' }, fetchImpl)
    expect(m.provider).toBe('brevo')
    await m.send(msg)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.headers['api-key']).toBe('xkeysib')
    expect(JSON.parse(init.body)).toMatchObject({
      sender: { name: 'LAMVI', email: 'no-reply@lamvi.vn' },
      to: [{ email: 'an@example.com' }],
      textContent: 'T',
      htmlContent: '<p>H</p>',
    })
  })

  it('Brevo: from chỉ có địa chỉ', async () => {
    const fetchImpl = ok()
    await createMailer({ from: 'no-reply@lamvi.vn', brevoApiKey: 'k' }, fetchImpl).send(msg)
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).sender).toEqual({ email: 'no-reply@lamvi.vn' })
  })

  it('Resend ưu tiên khi có cả hai khoá', () => {
    expect(createMailer({ from: 'a@b.cd', resendApiKey: 'r', brevoApiKey: 'b' }, ok()).provider).toBe('resend')
  })

  it('nhà cung cấp trả lỗi → ném (không lộ nội dung thư/khoá trong thông điệp)', async () => {
    const m = createMailer({ from: 'a@b.cd', resendApiKey: 'secret-key' }, async () => ({ ok: false, status: 422 }))
    const e = await m.send(msg).catch((x) => x)
    expect(e.message).toBe('mail 422')
  })

  it('mailer bộ nhớ ghi hộp thư; mailer console in ra', async () => {
    const mem = createMemoryMailer()
    await mem.send(msg)
    expect(mem.outbox).toEqual([msg])
    const log = vi.fn()
    await createConsoleMailer(log).send(msg)
    expect(log.mock.calls[0][0]).toContain('an@example.com')
  })
})

describe('mẫu thư', () => {
  const url = 'https://lamvi.vn/en/reset-password#t=abc'
  it.each(['vi', 'en', 'zh'])('recovery %s: có link, tiêu đề, không lộ gì khác', (lang) => {
    const m = recoveryMail({ lang, url })
    expect(m.text).toContain(url)
    expect(m.html).toContain(`href="${url}"`)
    expect(m.subject).toBeTruthy()
  })

  it('ngôn ngữ lạ → tiếng Việt; html được escape', () => {
    expect(recoveryMail({ lang: 'fr', url }).subject).toMatch(/Đặt lại/)
    const m = recoveryMail({ lang: 'en', url: 'https://x.vn/?a=1&b="2"<script>' })
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&amp;b=&quot;2&quot;&lt;script&gt;')
  })

  it('thư báo đổi mật khẩu có cảnh báo, không có link', () => {
    const m = passwordChangedMail({ lang: 'en' })
    expect(m.text).toMatch(/Forgot password/)
    expect(m.html).not.toContain('href=')
  })
})
