import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createSupabaseAuth } from './auth.js'
import { AuthError } from '../authErrors.js'
import { createApp } from '../../app.js'
import { createMemoryRepo } from '../memory/repo.js'
import { createMemoryMailer } from '../../mail/mailer.js'

// Client Supabase giả: mỗi hàm trả { data, error } theo cấu hình test
function fakePublic(overrides = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: {
          user: { id: 'u1', email: 'an@example.com', role: 'authenticated', app_metadata: {} },
          session: { access_token: 'a1', refresh_token: 'r1', expires_at: 123, provider_token: 'x' },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: { user: { id: 'u1', email: 'an@example.com' }, session: { access_token: 'a2', refresh_token: 'r2', expires_at: 456 } },
        error: null,
      })),
      verifyOtp: vi.fn(async () => ({
        data: { user: { id: 'u1', email: 'an@example.com' }, session: { access_token: 'rec-a', refresh_token: 'rec-r', expires_at: 1 } },
        error: null,
      })),
      ...overrides,
    },
  }
}

function fakeAdmin(overrides = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'an@example.com' } }, error: null })),
      admin: {
        signOut: vi.fn(async () => ({ data: null, error: null })),
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
        generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: 'hash123' } }, error: null })),
        createUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'an@example.com' } }, error: null })),
        ...overrides.admin,
      },
      ...overrides.auth,
    },
  }
}

const err = (code, status = 400, message = `Lỗi gốc Supabase: ${code}`) => ({ name: 'AuthApiError', code, status, message })

function make({ pub = {}, admin = {} } = {}) {
  const clients = []
  const makePublicClient = vi.fn(() => {
    const c = fakePublic(pub)
    clients.push(c)
    return c
  })
  const adminClient = fakeAdmin(admin)
  return { auth: createSupabaseAuth({ admin: adminClient, makePublicClient }), makePublicClient, clients, admin: adminClient }
}

let consoleError
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => consoleError.mockRestore())

const rejectsCode = async (p, code) => {
  const e = await p.then(
    () => null,
    (x) => x,
  )
  expect(e).toBeInstanceOf(AuthError)
  expect(e.code).toBe(code)
}

describe('createSupabaseAuth — map lỗi Supabase → AuthError', () => {
  it('invalid_credentials → INVALID_CREDENTIALS', async () => {
    const { auth } = make({ pub: { signInWithPassword: async () => ({ data: {}, error: err('invalid_credentials') }) } })
    await rejectsCode(auth.signIn({ email: 'a@b.cd', password: 'x' }), 'INVALID_CREDENTIALS')
  })

  it('email_not_confirmed → EMAIL_NOT_CONFIRMED', async () => {
    const { auth } = make({ pub: { signInWithPassword: async () => ({ data: {}, error: err('email_not_confirmed') }) } })
    await rejectsCode(auth.signIn({ email: 'a@b.cd', password: 'x' }), 'EMAIL_NOT_CONFIRMED')
  })

  it.each(['user_already_exists', 'email_exists'])('%s → EMAIL_TAKEN', async (code) => {
    const { auth } = make({ admin: { admin: { createUser: async () => ({ data: { user: null }, error: err(code, 422) }) } } })
    await rejectsCode(auth.signUp({ email: 'a@b.cd', password: 'Gio-Hoa#Sen2026' }), 'EMAIL_TAKEN')
  })

  it('signUp (D-63): tạo user đã xác nhận qua admin API, không gửi email, không cần xác nhận', async () => {
    const a = make()
    expect(await a.auth.signUp({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026', redirectTo: 'https://lamvi.test/en/login' })).toEqual({
      user: { id: 'u1', email: 'an@example.com' },
      needsConfirmation: false,
    })
    expect(a.admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'an@example.com',
      password: 'Gio-Hoa#Sen2026',
      email_confirm: true,
    })
    expect(a.makePublicClient).not.toHaveBeenCalled()
  })

  it('signUp: mật khẩu yếu theo Supabase → PASSWORD_TOO_SHORT', async () => {
    const { auth } = make({ admin: { admin: { createUser: async () => ({ data: { user: null }, error: err('weak_password', 422) }) } } })
    await rejectsCode(auth.signUp({ email: 'a@b.cd', password: 'Gio-Hoa#Sen2026' }), 'PASSWORD_TOO_SHORT')
  })

  it.each([
    [{ status: 429, code: 'over_request_rate_limit' }],
    [{ status: 429, code: 'over_email_send_rate_limit' }],
    [{ status: 429, code: undefined }],
    [{ status: 400, code: 'over_request_rate_limit' }],
  ])('rate limit %o → RATE_LIMITED', async (e) => {
    const { auth } = make({ pub: { signInWithPassword: async () => ({ data: {}, error: { message: 'rate', ...e } }) } })
    await rejectsCode(auth.signIn({ email: 'a@b.cd', password: 'x' }), 'RATE_LIMITED')
  })

  it.each(['refresh_token_already_used', 'refresh_token_not_found', 'session_not_found'])('refresh %s → UNAUTHORIZED', async (code) => {
    const { auth } = make({ pub: { refreshSession: async () => ({ data: { session: null, user: null }, error: err(code) }) } })
    await rejectsCode(auth.refresh('r0'), 'UNAUTHORIZED')
  })

  it('refresh không lỗi nhưng không có session → UNAUTHORIZED', async () => {
    const { auth } = make({ pub: { refreshSession: async () => ({ data: { session: null, user: null }, error: null }) } })
    await rejectsCode(auth.refresh('r0'), 'UNAUTHORIZED')
  })

  it('lỗi không nhận diện được → Error thường (không phải AuthError, không có status), giữ lỗi gốc ở cause', async () => {
    const original = err('unexpected_failure', 500)
    const { auth } = make({ pub: { signInWithPassword: async () => ({ data: {}, error: original }) } })
    const e = await auth.signIn({ email: 'a@b.cd', password: 'x' }).catch((x) => x)
    expect(e).not.toBeInstanceOf(AuthError)
    expect(e.status).toBeUndefined()
    expect(e.cause).toBe(original)
  })
})

describe('createSupabaseAuth — phiên & client', () => {
  it('signIn chỉ trả các trường phiên cần thiết (không lộ provider_token, metadata)', async () => {
    const { auth } = make()
    expect(await auth.signIn({ email: 'an@example.com', password: 'x' })).toEqual({
      accessToken: 'a1',
      refreshToken: 'r1',
      expiresAt: 123,
      user: { id: 'u1', email: 'an@example.com' },
    })
  })

  it('refresh gửi đúng refresh_token và trả phiên mới', async () => {
    const { auth, clients } = make()
    expect(await auth.refresh('r1')).toMatchObject({ accessToken: 'a2', refreshToken: 'r2', expiresAt: 456 })
    expect(clients[0].auth.refreshSession).toHaveBeenCalledWith({ refresh_token: 'r1' })
  })

  it('mỗi lần gọi signIn/refresh/resetPassword dùng một client public mới (signUp dùng admin, D-63)', async () => {
    const { auth, makePublicClient, clients } = make()
    await auth.signUp({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026' })
    expect(makePublicClient).not.toHaveBeenCalled()
    await auth.signIn({ email: 'an@example.com', password: 'x' })
    await auth.signIn({ email: 'an@example.com', password: 'x' })
    await auth.refresh('r1')
    await auth.resetPassword({ token: 'hash123', password: 'Moi-Nang#Xuan71' })
    expect(makePublicClient).toHaveBeenCalledTimes(4)
    expect(new Set(clients).size).toBe(4)
    clients.forEach((c) => {
      const used = Object.values(c.auth).filter((fn) => fn.mock.calls.length)
      expect(used).toHaveLength(1)
    })
  })

  it('getUser/signOut/updatePassword dùng client admin, không tạo client public', async () => {
    const { auth, makePublicClient, admin } = make()
    expect(await auth.getUser('tok')).toEqual({ id: 'u1', email: 'an@example.com' })
    await auth.signOut('tok')
    await auth.updatePassword('u1', 'Moi-Nang#Xuan71')
    expect(makePublicClient).not.toHaveBeenCalled()
    expect(admin.auth.getUser).toHaveBeenCalledWith('tok')
    expect(admin.auth.admin.signOut).toHaveBeenCalledWith('tok', expect.any(String))
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('u1', { password: 'Moi-Nang#Xuan71' })
  })

  it('getUser lỗi / không có user → null', async () => {
    const a = make({ admin: { auth: { getUser: async () => ({ data: { user: null }, error: err('bad_jwt', 401) }) } } })
    expect(await a.auth.getUser('x')).toBeNull()
    const b = make({ admin: { auth: { getUser: async () => ({ data: null, error: null }) } } })
    expect(await b.auth.getUser('x')).toBeNull()
  })

  it('signOut bỏ qua lỗi 401/404 (phiên đã hết), ném lỗi khác', async () => {
    for (const status of [401, 404]) {
      const { auth } = make({ admin: { admin: { signOut: async () => ({ error: err('session_not_found', status) }) } } })
      await expect(auth.signOut('x')).resolves.toBeUndefined()
    }
    const { auth } = make({ admin: { admin: { signOut: async () => ({ error: err('unexpected_failure', 500) }) } } })
    await expect(auth.signOut('x')).rejects.toBeTruthy()
  })

  it('updatePassword lỗi → ném', async () => {
    const { auth } = make({ admin: { admin: { updateUserById: async () => ({ error: err('weak_password', 422) }) } } })
    await rejectsCode(auth.updatePassword('u1', 'x'), 'PASSWORD_TOO_SHORT')
  })
})

describe('createSupabaseAuth — đặt lại mật khẩu không qua SMTP của Supabase (T-49)', () => {
  it('createRecoveryToken: generateLink type recovery (không gửi thư), trả hashed_token', async () => {
    const { auth, admin, makePublicClient } = make()
    expect(await auth.createRecoveryToken('an@example.com')).toBe('hash123')
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'an@example.com' })
    expect(makePublicClient).not.toHaveBeenCalled()
  })

  it('createRecoveryToken: user_not_found → null; lỗi khác → ném', async () => {
    const a = make({ admin: { admin: { generateLink: async () => ({ data: null, error: err('user_not_found', 404) }) } } })
    expect(await a.auth.createRecoveryToken('khong@co.vn')).toBeNull()
    const b = make({ admin: { admin: { generateLink: async () => ({ data: null, error: err('unexpected_failure', 500) }) } } })
    await expect(b.auth.createRecoveryToken('a@b.cd')).rejects.toBeTruthy()
  })

  it('resetPassword: verifyOtp → đặt mật khẩu → thu hồi mọi phiên (kể cả phiên verifyOtp tạo ra)', async () => {
    const { auth, admin, clients } = make()
    const out = await auth.resetPassword({ token: 'hash123', password: 'Moi-Nang#Xuan71' })
    expect(out).toEqual({ user: { id: 'u1', email: 'an@example.com' } })
    expect(clients[0].auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash123', type: 'recovery' })
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('u1', { password: 'Moi-Nang#Xuan71' })
    expect(admin.auth.admin.signOut).toHaveBeenCalledWith('rec-a', 'global')
  })

  it.each([err('otp_expired', 403), err('otp_disabled', 400), err('validation_failed', 422)])(
    'resetPassword: token hết hạn/sai (%o) → INVALID_RESET_TOKEN, không đổi mật khẩu',
    async (e) => {
      const { auth, admin } = make({ pub: { verifyOtp: async () => ({ data: { user: null, session: null }, error: e }) } })
      await rejectsCode(auth.resetPassword({ token: 'x', password: 'Moi-Nang#Xuan71' }), 'INVALID_RESET_TOKEN')
      expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
    },
  )

  it('resetPassword: verifyOtp lỗi 5xx → ném lỗi hệ thống (không báo link hỏng)', async () => {
    const { auth } = make({ pub: { verifyOtp: async () => ({ data: {}, error: err('unexpected_failure', 500) }) } })
    const e = await auth.resetPassword({ token: 'x', password: 'Moi-Nang#Xuan71' }).catch((x) => x)
    expect(e).not.toBeInstanceOf(AuthError)
  })

  it('resetPassword: thu hồi phiên lỗi sau khi đã đổi mật khẩu → vẫn thành công, ghi log', async () => {
    const { auth } = make({ admin: { admin: { signOut: async () => ({ error: err('unexpected_failure', 500) }) } } })
    await expect(auth.resetPassword({ token: 'x', password: 'Moi-Nang#Xuan71' })).resolves.toMatchObject({ user: { id: 'u1' } })
    expect(consoleError).toHaveBeenCalled()
  })

  it('updateUserById lỗi (weak_password) → PASSWORD_TOO_SHORT', async () => {
    const { auth } = make({ admin: { admin: { updateUserById: async () => ({ error: err('weak_password', 422) }) } } })
    await rejectsCode(auth.resetPassword({ token: 'x', password: 'x' }), 'PASSWORD_TOO_SHORT')
  })
})

describe('Route + adapter Supabase: không lộ thông điệp lỗi gốc', () => {
  const config = { publicSiteUrl: 'https://moc.test' }
  const secret = 'Database error querying schema: relation auth.users password_hash'

  it('lỗi Supabase không nhận diện khi đăng nhập / đăng ký → 500 thông điệp chung', async () => {
    const { auth } = make({
      pub: {
        signInWithPassword: async () => ({ data: {}, error: err('unexpected_failure', 500, secret) }),
      },
      admin: { admin: { createUser: async () => ({ data: { user: null }, error: err('unexpected_failure', 500, secret) }) } },
    })
    const app = createApp({ repo: createMemoryRepo(), auth, config })
    const a = await request(app).post('/api/auth/login').send({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026' })
    const b = await request(app).post('/api/auth/register').send({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026', fullName: 'An' })
    for (const res of [a, b]) {
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } })
      expect(res.text).not.toContain('Database')
    }
  })

  it('lỗi đã map → thông điệp là mã lỗi, không chứa message gốc', async () => {
    const { auth } = make({ pub: { signInWithPassword: async () => ({ data: {}, error: err('invalid_credentials', 400, secret) }) } })
    const app = createApp({ repo: createMemoryRepo(), auth, config })
    const res = await request(app).post('/api/auth/login').send({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(res.text).not.toContain('Database')
  })

  it('forgot-password (D-92): user_not_found của Supabase → 404 EMAIL_NOT_REGISTERED (không lộ lỗi gốc), thư chỉ gửi khi có user', async () => {
    let fail = false
    const { auth } = make({
      admin: { admin: { generateLink: async () => ({ data: fail ? null : { properties: { hashed_token: 'h' } }, error: fail ? err('user_not_found', 404, secret) : null }) } },
    })
    const mailer = createMemoryMailer()
    const app = createApp({ repo: createMemoryRepo(), auth, config, mailer })
    const ok = await request(app).post('/api/auth/forgot-password').send({ email: 'an@example.com' })
    fail = true
    const ko = await request(app).post('/api/auth/forgot-password').send({ email: 'khong@example.com' })
    expect(ok.status).toBe(202)
    expect(ko.status).toBe(404)
    expect(ko.body.error.code).toBe('EMAIL_NOT_REGISTERED')
    expect(ko.text).not.toContain(secret)
    expect(mailer.outbox).toHaveLength(1)
    expect(mailer.outbox[0].text).toContain('/reset-password#t=h')
  })

  it('refresh_token_already_used → 401 UNAUTHORIZED qua API', async () => {
    const { auth } = make({ pub: { refreshSession: async () => ({ data: { session: null }, error: err('refresh_token_already_used', 400, secret) }) } })
    const app = createApp({ repo: createMemoryRepo(), auth, config })
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'lamvi_rt=r0')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
    expect(res.text).not.toContain('Database')
  })

  it('RATE_LIMITED → 429 qua API', async () => {
    const { auth } = make({ pub: { signInWithPassword: async () => ({ data: {}, error: err('over_request_rate_limit', 429) }) } })
    const app = createApp({ repo: createMemoryRepo(), auth, config })
    const res = await request(app).post('/api/auth/login').send({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
  })

  it('weak_password từ Supabase khi đăng ký → 400 VALIDATION_ERROR, fields.password', async () => {
    const { auth } = make({ admin: { admin: { createUser: async () => ({ data: { user: null }, error: err('weak_password', 422, secret) }) } } })
    const app = createApp({ repo: createMemoryRepo(), auth, config })
    const res = await request(app).post('/api/auth/register').send({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026', fullName: 'An' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', fields: { password: 'PASSWORD_TOO_SHORT' } })
    expect(res.text).not.toContain('Database')
  })
})
