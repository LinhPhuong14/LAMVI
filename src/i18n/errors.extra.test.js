// Kiểm thử độc lập (T-11): mọi mã lỗi mà API lời chúc/QR/người dùng có thể trả đều có chữ dịch ở cả 3 ngôn ngữ.
// Tên test có tiền tố [BUG] là test đang ĐỎ vì code nguồn thiếu khoá (giữ nguyên, không hạ kỳ vọng).
import { describe, expect, it } from 'vitest'
import vi from './messages/vi.js'
import en from './messages/en.js'
import zh from './messages/zh.js'

// Mã lỗi (code hoặc fields[...]) có thể tới giao diện từ: server/routes/qr.js, orders.js (message*),
// adminUsers.js, messages/service.js, domain/message.js, middleware (rate limit, auth, khoá tài khoản)
const FROM_SERVER = [
  'NO_MESSAGE',
  'MESSAGE_TEXT_LOCKED',
  'MESSAGE_LOCKED',
  'GIFT_NOT_READY',
  'TRANSLATE_UNAVAILABLE',
  'VALIDATION_ERROR',
  'MEDIA_NOT_UPLOADED',
  'MEDIA_TOO_LARGE',
  'INVALID_MEDIA_TYPE',
  'TOO_LONG',
  'INVALID',
  'REQUIRED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'FORBIDDEN',
  'UNAUTHORIZED',
  'ACCOUNT_LOCKED',
  'INTERNAL_ERROR',
  'NETWORK_ERROR',
]

describe('Khoá errors.* cho tính năng lời chúc / QR / quản lý người dùng', () => {
  for (const [name, dict] of [['vi', vi], ['en', en], ['zh', zh]]) {
    it(`${name}: có chữ cho mọi mã lỗi server trả về`, () => {
      const missing = FROM_SERVER.filter((c) => typeof dict.errors?.[c] !== 'string' || !dict.errors[c].trim())
      expect(missing).toEqual([])
    })
  }

  it('[BUG] CANNOT_MANAGE_SELF (409 của /api/admin/users) có chữ dịch ở cả vi/en/zh', () => {
    for (const dict of [vi, en, zh]) expect(dict.errors?.CANNOT_MANAGE_SELF).toBeTruthy()
  })

  it('giao diện lời chúc/QR có đủ khoá ở en và zh như vi (D-40)', () => {
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]))
    for (const group of ['gift', 'giftEditor']) {
      for (const dict of [en, zh]) {
        const have = new Set(flat(dict[group] ?? {}))
        const missing = flat(vi[group]).filter((k) => !have.has(k))
        expect(missing, group).toEqual([])
      }
    }
  })
})
