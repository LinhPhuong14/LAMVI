import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createSupabaseAuth } from './auth.js'
import { createApp } from '../../app.js'
import { createMemoryRepo } from '../memory/repo.js'

// Kiểm thử độc lập D-63: đăng ký qua admin.createUser (không xác nhận email), đi qua route thật
const secret = 'Database error saving new user: duplicate key auth.users_email_key'
const err = (code, status = 400, message = secret) => ({ name: 'AuthApiError', code, status, message })
const config = { publicSiteUrl: 'https://lamvi.test' }

function setup(createUser) {
  const admin = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: err('bad_jwt', 401) })),
      admin: {
        createUser: vi.fn(createUser ?? (async ({ email }) => ({ data: { user: { id: 'u-new', email } }, error: null }))),
        signOut: vi.fn(async () => ({ data: null, error: null })),
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
      },
    },
  }
  const makePublicClient = vi.fn(() => {
    throw new Error('signUp không được dùng client public (D-63)')
  })
  const repo = createMemoryRepo()
  const auth = createSupabaseAuth({ admin, makePublicClient })
  const app = createApp({ repo, auth, config })
  return { app, repo, admin, makePublicClient }
}

const register = (app, body = {}) =>
  request(app)
    .post('/api/auth/register')
    .send({ email: 'an@example.com', password: 'matkhau123', fullName: 'Nguyễn An', ...body })

let consoleError
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => consoleError.mockRestore())

describe('POST /api/auth/register — Supabase admin.createUser (D-63)', () => {
  it('thành công → 201, needsConfirmation:false, tạo hồ sơ; createUser nhận email chuẩn hoá + email_confirm, không có redirectTo', async () => {
    const { app, repo, admin, makePublicClient } = setup()
    const res = await register(app, { email: '  An@Example.COM ', phone: '0912345678', preferredLocale: 'en' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ user: { id: 'u-new', email: 'an@example.com' }, needsConfirmation: false })
    expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(1)
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({ email: 'an@example.com', password: 'matkhau123', email_confirm: true })
    expect(makePublicClient).not.toHaveBeenCalled()
    expect(await repo.getProfile('u-new')).toMatchObject({
      id: 'u-new',
      fullName: 'Nguyễn An',
      phone: '0912345678',
      preferredLocale: 'en',
      role: 'customer',
    })
  })

  it('mật khẩu gửi nguyên văn (không trim) tới createUser', async () => {
    const { app, admin } = setup()
    await register(app, { password: '  matkhau123  ' })
    expect(admin.auth.admin.createUser.mock.calls[0][0].password).toBe('  matkhau123  ')
  })

  it('dữ liệu không hợp lệ → 400, không gọi createUser (không tạo user mồ côi)', async () => {
    const { app, admin } = setup()
    const res = await register(app, { fullName: '', password: 'ngan' })
    expect(res.status).toBe(400)
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it.each(['email_exists', 'user_already_exists'])(
    'email đã có (%s) → 409 EMAIL_TAKEN, không ghi đè hồ sơ cũ, không lộ thông điệp gốc',
    async (code) => {
      const { app, repo } = setup(async () => ({ data: { user: null }, error: err(code, 422) }))
      await repo.upsertProfile({ id: 'u-old', fullName: 'Chủ cũ', phone: '0987654321', preferredLocale: 'zh' })
      const before = await repo.getProfile('u-old')
      const res = await register(app, { fullName: 'Kẻ chiếm', phone: '0911111111' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('EMAIL_TAKEN')
      expect(res.text).not.toContain('Database')
      expect(await repo.getProfile('u-old')).toEqual(before)
    },
  )

  it('đăng ký trùng lần hai (sau khi lần một thành công) → 409, hồ sơ lần một giữ nguyên', async () => {
    let n = 0
    const { app, repo } = setup(async ({ email }) =>
      n++ === 0 ? { data: { user: { id: 'u1', email } }, error: null } : { data: { user: null }, error: err('email_exists', 422) },
    )
    expect((await register(app, { fullName: 'Lần một' })).status).toBe(201)
    const res = await register(app, { fullName: 'Lần hai' })
    expect(res.status).toBe(409)
    expect((await repo.getProfile('u1')).fullName).toBe('Lần một')
  })

  it.each([
    ['status 429 không có code', err(undefined, 429)],
    ['over_request_rate_limit', err('over_request_rate_limit', 429)],
    ['over_email_send_rate_limit', err('over_email_send_rate_limit', 429)],
  ])('giới hạn tần suất (%s) → 429 RATE_LIMITED, không tạo hồ sơ', async (_name, e) => {
    const { app, repo } = setup(async () => ({ data: { user: null }, error: e }))
    const res = await register(app)
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(res.text).not.toContain('Database')
    expect(await repo.getProfile('u-new')).toBeNull()
  })

  it('weak_password → 400 VALIDATION_ERROR fields.password', async () => {
    const { app } = setup(async () => ({ data: { user: null }, error: err('weak_password', 422) }))
    const res = await register(app)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', fields: { password: 'PASSWORD_TOO_SHORT' } })
  })

  it('email_address_invalid → 400 VALIDATION_ERROR fields.email', async () => {
    const { app } = setup(async () => ({ data: { user: null }, error: err('email_address_invalid', 400) }))
    const res = await register(app)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', fields: { email: 'INVALID_EMAIL' } })
  })

  it('lỗi không nhận diện (unexpected_failure 500) → 500 thông điệp chung, không lộ message', async () => {
    const { app, repo } = setup(async () => ({ data: { user: null }, error: err('unexpected_failure', 500) }))
    const res = await register(app)
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } })
    expect(res.text).not.toContain('Database')
    expect(await repo.getProfile('u-new')).toBeNull()
  })

  // Lỗi Supabase 4xx chưa map (vd not_admin khi sai SUPABASE_SECRET_KEY) là lỗi cấu hình server
  // → mapError bỏ status gốc để errorHandler trả 500 và ghi log.
  it.each([
    ['validation_failed', 400],
    ['not_admin', 403],
  ])('lỗi 4xx chưa map (%s) → 500 INTERNAL_ERROR (lỗi cấu hình server), không lộ message, không tạo hồ sơ', async (code, status) => {
    const { app, repo } = setup(async () => ({ data: { user: null }, error: err(code, status) }))
    const res = await register(app)
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } })
    expect(res.text).not.toContain('Database')
    expect(await repo.getProfile('u-new')).toBeNull()
  })

  it('createUser ném lỗi mạng (auth-js ném lại lỗi không phải AuthError) → 500 chung', async () => {
    const { app } = setup(async () => {
      throw new TypeError(`fetch failed: ${secret}`)
    })
    const res = await register(app)
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL_ERROR')
    expect(res.text).not.toContain('Database')
  })
})
