// Kiểm thử độc lập (T-11) — G-18: chỉ token khôi phục mới đặt lại được mật khẩu,
// đổi mật khẩu khi đang đăng nhập phải nhập lại mật khẩu hiện tại.
// Tập trung vào adapter Supabase: isRecoveryToken (token dị dạng) và verifyPassword (Supabase trục trặc).
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuth, isRecoveryToken } from './auth.js'

// Tạo token giống JWT: header.payload.signature (payload là base64url của `obj`)
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url')
const jwt = (payload) => `${b64('{"alg":"HS256"}')}.${b64(JSON.stringify(payload))}.chuky`
const rawJwt = (payloadPart) => `${b64('{"alg":"HS256"}')}.${payloadPart}.chuky`

describe('G-18 — isRecoveryToken: chỉ token từ link email mới là recovery', () => {
  it('amr có method "recovery" → true (kể cả khi còn phương thức khác)', () => {
    expect(isRecoveryToken(jwt({ amr: [{ method: 'recovery', timestamp: 1 }] }))).toBe(true)
    expect(isRecoveryToken(jwt({ amr: [{ method: 'otp' }, { method: 'recovery' }] }))).toBe(true)
  })

  it('token đăng nhập thường (amr = password/otp) → false', () => {
    expect(isRecoveryToken(jwt({ amr: [{ method: 'password', timestamp: 1 }] }))).toBe(false)
    expect(isRecoveryToken(jwt({ amr: [{ method: 'otp' }] }))).toBe(false)
  })

  // Token dị dạng phải trả false, KHÔNG được ném lỗi (nếu ném, getUser() vỡ → mọi API 500)
  it.each([
    ['chuỗi rỗng', ''],
    ['không phải JWT', 'khong-phai-jwt'],
    ['chỉ có một đoạn', b64('{"amr":[{"method":"recovery"}]}')],
    ['payload rỗng', `${b64('{}')}..chuky`],
    ['payload không phải JSON', rawJwt(b64('day khong phai json'))],
    ['payload là JSON null', rawJwt(b64('null'))],
    ['payload là JSON số', rawJwt(b64('123'))],
    ['payload là JSON chuỗi', rawJwt(b64('"recovery"'))],
    ['payload là mảng', rawJwt(b64('[{"method":"recovery"}]'))],
    ['amr là chuỗi', jwt({ amr: 'recovery' })],
    ['amr là object', jwt({ amr: { method: 'recovery' } })],
    ['amr là mảng chuỗi', jwt({ amr: ['recovery'] })],
    ['amr chứa null', jwt({ amr: [null, undefined] })],
    ['amr chứa số', jwt({ amr: [1, 2] })],
    ['amr rỗng', jwt({ amr: [] })],
    ['không có claim amr', jwt({ sub: 'u1' })],
    ['base64 sai định dạng', rawJwt('!!!khong-phai-base64!!!')],
    ['recovery nằm ở header chứ không ở payload', `${b64('{"amr":[{"method":"recovery"}]}')}.${b64('{}')}.chuky`],
    ['chuỗi rất dài không có dấu chấm', 'x'.repeat(200_000)],
    ['null', null],
    ['undefined', undefined],
    ['số', 12345],
    ['object', { amr: [{ method: 'recovery' }] }],
  ])('%s → false, không ném lỗi', (_name, token) => {
    expect(() => isRecoveryToken(token)).not.toThrow()
    expect(isRecoveryToken(token)).toBe(false)
  })

  // Buffer.from(..., 'base64url') bỏ qua padding thừa → token recovery có '=' ở cuối vẫn đọc được.
  // An toàn: chữ ký đã được Supabase xác minh trước đó, đây chỉ là bước đọc claim.
  it('padding base64 thừa không làm mất claim recovery', () => {
    expect(isRecoveryToken(rawJwt(`${b64('{"amr":[{"method":"recovery"}]}')}====`))).toBe(true)
  })

  it('getUser gắn isRecovery đúng theo token (token đã được Supabase xác minh trước đó)', async () => {
    const admin = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'an@example.com' } }, error: null })),
        admin: {},
      },
    }
    const auth = createSupabaseAuth({ admin, makePublicClient: () => ({ auth: {} }) })
    expect(await auth.getUser(jwt({ amr: [{ method: 'recovery' }] }))).toEqual({
      id: 'u1',
      email: 'an@example.com',
      isRecovery: true,
    })
    expect(await auth.getUser(jwt({ amr: [{ method: 'password' }] }))).toMatchObject({ isRecovery: false })
    // Token rác vẫn không làm vỡ getUser
    expect(await auth.getUser('rac')).toMatchObject({ isRecovery: false })
  })
})

describe('G-18 — verifyPassword (adapter Supabase)', () => {
  function make({ getUserById, signIn, signOut = vi.fn(async () => ({ error: null })) } = {}) {
    const clients = []
    const admin = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'an@example.com' } }, error: null })),
        admin: {
          getUserById:
            getUserById ?? vi.fn(async () => ({ data: { user: { id: 'u1', email: 'an@example.com' } }, error: null })),
        },
      },
    }
    const makePublicClient = vi.fn(() => {
      const c = {
        auth: {
          signInWithPassword: signIn ?? vi.fn(async () => ({ data: {}, error: null })),
          signOut,
        },
      }
      clients.push(c)
      return c
    })
    return { auth: createSupabaseAuth({ admin, makePublicClient }), admin, clients, signOut }
  }

  it('mật khẩu đúng → true', async () => {
    const { auth, clients } = make()
    expect(await auth.verifyPassword('u1', 'matkhau123')).toBe(true)
    expect(clients[0].auth.signInWithPassword).toHaveBeenCalledWith({ email: 'an@example.com', password: 'matkhau123' })
  })

  it('mật khẩu sai → false, không ném lỗi', async () => {
    const { auth } = make({ signIn: vi.fn(async () => ({ data: null, error: { code: 'invalid_credentials', status: 400 } })) })
    expect(await auth.verifyPassword('u1', 'sai')).toBe(false)
  })

  it('getUserById lỗi → false (không coi như đúng mật khẩu)', async () => {
    const { auth, clients } = make({ getUserById: vi.fn(async () => ({ data: null, error: { code: 'not_admin' } })) })
    expect(await auth.verifyPassword('u1', 'x')).toBe(false)
    expect(clients).toHaveLength(0) // không thử đăng nhập khi chưa biết email
  })

  it('user không có email (đăng nhập bằng SĐT/OAuth) → false', async () => {
    const { auth } = make({ getUserById: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })) })
    expect(await auth.verifyPassword('u1', 'x')).toBe(false)
  })

  it('getUserById trả data rỗng → false', async () => {
    const { auth } = make({ getUserById: vi.fn(async () => ({ data: null, error: null })) })
    expect(await auth.verifyPassword('u1', 'x')).toBe(false)
  })

  it('signInWithPassword NÉM lỗi (mạng/cổng hỏng) → lỗi lan ra ngoài, KHÔNG trả true/false', async () => {
    const { auth } = make({
      signIn: vi.fn(async () => {
        throw new Error('fetch failed')
      }),
    })
    await expect(auth.verifyPassword('u1', 'x')).rejects.toThrow('fetch failed')
  })

  it('signOut của phiên tạm lỗi → vẫn trả true (không chặn luồng đổi mật khẩu)', async () => {
    const { auth } = make({
      signOut: vi.fn(async () => {
        throw new Error('signOut hỏng')
      }),
    })
    expect(await auth.verifyPassword('u1', 'dung')).toBe(true)
  })

  // Mặc định của supabase-js là scope 'global' — dùng mặc định sẽ đăng xuất khách khỏi MỌI thiết
  // bị chỉ vì vừa xác minh mật khẩu, và nếu bước updatePassword sau đó thất bại thì khách mất
  // phiên mà mật khẩu không đổi. Phải là 'local'.
  it("mật khẩu đúng → signOut phiên tạm với scope 'local', không đụng phiên khác của khách", async () => {
    const signOut = vi.fn(async () => ({ error: null }))
    const { auth, clients } = make({ signOut })
    await auth.verifyPassword('u1', 'dung')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    // Phiên tạm dùng client riêng, không đụng tới phiên đang đăng nhập của khách
    expect(clients).toHaveLength(1)
  })
})
