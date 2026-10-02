// Kiểm thử độc lập (T-11) — G-18: đổi mật khẩu khi đang đăng nhập phải nhập lại mật khẩu hiện tại.
// Tập trung vào adapter Supabase: verifyPassword (Supabase trục trặc).
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuth } from './auth.js'

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
