import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuth } from './auth.js'

// T-49 (kiểm thử độc lập): các nhánh lỗi của adapter Supabase quanh đặt lại mật khẩu và refresh
const session = { access_token: 'rec-a', refresh_token: 'rec-r', expires_at: 1 }
const user = { id: 'u1', email: 'an@example.com' }
const err = (code, status = 400) => ({ name: 'AuthApiError', code, status, message: `gốc: ${code}` })

function make({ verifyOtp, updateUserById, signOut, refreshSession, generateLink } = {}) {
  const admin = {
    auth: {
      getUser: vi.fn(),
      admin: {
        signOut: signOut ?? vi.fn(async () => ({ error: null })),
        updateUserById: updateUserById ?? vi.fn(async () => ({ data: {}, error: null })),
        generateLink: generateLink ?? vi.fn(async () => ({ data: { properties: { hashed_token: 'h' } }, error: null })),
      },
    },
  }
  const pub = {
    auth: {
      verifyOtp: verifyOtp ?? vi.fn(async () => ({ data: { user, session }, error: null })),
      refreshSession: refreshSession ?? vi.fn(),
    },
  }
  return { auth: createSupabaseAuth({ admin, makePublicClient: () => pub }), admin, pub }
}

describe('resetPassword (adapter Supabase)', () => {
  it('verifyOtp trả data không có session (user có, session null) → INVALID_RESET_TOKEN', async () => {
    const { auth, admin } = make({ verifyOtp: vi.fn(async () => ({ data: { user, session: null }, error: null })) })
    await expect(auth.resetPassword({ token: 't', password: 'matkhau-moi-1' })).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' })
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  it('verifyOtp lỗi 429 (Supabase giới hạn tốc độ) → INVALID_RESET_TOKEN theo mã 4xx hiện tại (ghi nhận)', async () => {
    const { auth } = make({ verifyOtp: vi.fn(async () => ({ data: {}, error: err('over_request_rate_limit', 429) })) })
    const e = await auth.resetPassword({ token: 't', password: 'matkhau-moi-1' }).catch((x) => x)
    expect(e.code).toBe('INVALID_RESET_TOKEN')
  })

  it('verifyOtp ném (mạng) → lỗi lan ra để errorHandler trả 500, không nuốt thành "link hỏng"', async () => {
    const { auth } = make({ verifyOtp: vi.fn(async () => { throw new Error('ECONNRESET') }) })
    const e = await auth.resetPassword({ token: 't', password: 'matkhau-moi-1' }).catch((x) => x)
    expect(e.code).toBeUndefined()
    expect(e.message).toBe('ECONNRESET')
  })

  it('đặt mật khẩu lỗi weak_password → PASSWORD_TOO_SHORT', async () => {
    const { auth } = make({ updateUserById: vi.fn(async () => ({ data: null, error: err('weak_password', 422) })) })
    await expect(auth.resetPassword({ token: 't', password: 'abc12345' })).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT' })
  })

  // RỦI RO: verifyOtp đã tiêu thụ token và tạo phiên; nếu updateUserById lỗi thì phiên khôi phục
  // vẫn sống (chỉ server giữ) và không được thu hồi
  it('đặt mật khẩu lỗi → vẫn thu hồi phiên khôi phục do verifyOtp tạo ra', async () => {
    const { auth, admin } = make({ updateUserById: vi.fn(async () => ({ data: null, error: err('weak_password', 422) })) })
    await auth.resetPassword({ token: 't', password: 'abc12345' }).catch(() => {})
    expect(admin.auth.admin.signOut).toHaveBeenCalledWith('rec-a', 'global')
  })

  it('thu hồi phiên lỗi 500 → vẫn thành công và không lộ token vào log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { auth } = make({ signOut: vi.fn(async () => ({ error: err('unexpected_failure', 500) })) })
    await expect(auth.resetPassword({ token: 'SECRET-T', password: 'matkhau-moi-1' })).resolves.toMatchObject({ user })
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET-T')
    expect(JSON.stringify(log.mock.calls)).not.toContain('matkhau-moi-1')
    log.mockRestore()
  })

  it('không trả access/refresh token của phiên khôi phục cho caller', async () => {
    const { auth } = make()
    const out = await auth.resetPassword({ token: 't', password: 'matkhau-moi-1' })
    expect(JSON.stringify(out)).not.toContain('rec-a')
    expect(JSON.stringify(out)).not.toContain('rec-r')
  })

  it('gọi verifyOtp với token_hash và type recovery (không type khác)', async () => {
    const { auth, pub } = make()
    await auth.resetPassword({ token: 'abc', password: 'matkhau-moi-1' })
    expect(pub.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' })
  })
})

describe('createRecoveryToken (adapter Supabase)', () => {
  it('chỉ trả hashed_token, không trả action_link/email_otp (không rò OTP ra ngoài)', async () => {
    const { auth } = make({
      generateLink: vi.fn(async () => ({
        data: { properties: { hashed_token: 'HASH', email_otp: '123456', action_link: 'https://x/verify?token=y' } },
        error: null,
      })),
    })
    expect(await auth.createRecoveryToken('an@example.com')).toBe('HASH')
  })

  it('lỗi giới hạn tốc độ → AuthError RATE_LIMITED (route nuốt và vẫn trả 202)', async () => {
    const { auth } = make({ generateLink: vi.fn(async () => ({ data: null, error: err('over_email_send_rate_limit', 429) })) })
    await expect(auth.createRecoveryToken('an@example.com')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('refresh (adapter Supabase)', () => {
  it('refresh_token_already_used / not_found / session_not_found → UNAUTHORIZED (401, route xoá cookie)', async () => {
    for (const code of ['refresh_token_already_used', 'refresh_token_not_found', 'session_not_found']) {
      const { auth } = make({ refreshSession: vi.fn(async () => ({ data: {}, error: err(code, 400) })) })
      await expect(auth.refresh('r')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    }
  })

  it('lỗi 5xx / mạng → KHÔNG phải AuthError UNAUTHORIZED (route giữ cookie)', async () => {
    const { auth } = make({ refreshSession: vi.fn(async () => ({ data: {}, error: err('unexpected_failure', 500) })) })
    const e = await auth.refresh('r').catch((x) => x)
    expect(e.code).toBeUndefined()
    expect(e.status).toBeUndefined()
  })

  // RỦI RO: Supabase trả session_expired khi phiên hết hạn (timebox/inactivity). Không map →
  // 500 và cookie hỏng không bao giờ bị xoá, khách kẹt ở trạng thái lỗi.
  it('session_expired → UNAUTHORIZED', async () => {
    const { auth } = make({ refreshSession: vi.fn(async () => ({ data: {}, error: err('session_expired', 401) })) })
    await expect(auth.refresh('r')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('refresh thành công nhưng không có session → UNAUTHORIZED', async () => {
    const { auth } = make({ refreshSession: vi.fn(async () => ({ data: { session: null, user: null }, error: null })) })
    await expect(auth.refresh('r')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
