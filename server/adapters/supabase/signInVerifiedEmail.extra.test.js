import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuth } from './auth.js'
import { AuthError } from '../authErrors.js'

const err = (code, status = 400) => ({ name: 'AuthApiError', code, status, message: `x ${code}` })

function make({ gen, verify } = {}) {
  const generateLink = vi.fn(gen ?? (async () => ({ data: { properties: { hashed_token: 'hash1' } }, error: null })))
  const verifyOtp = vi.fn(
    verify ??
      (async () => ({
        data: {
          user: { id: 'u1', email: 'gg@example.com', app_metadata: { x: 1 } },
          session: { access_token: 'a', refresh_token: 'r', expires_at: 77, provider_token: 'secret' },
        },
        error: null,
      })),
  )
  const makePublicClient = vi.fn(() => ({ auth: { verifyOtp } }))
  const auth = createSupabaseAuth({ admin: { auth: { admin: { generateLink } } }, makePublicClient })
  return { auth, generateLink, verifyOtp, makePublicClient }
}

describe('supabase signInVerifiedEmail (D-78)', () => {
  it('generateLink magiclink → verifyOtp bằng hashed_token → phiên gọn', async () => {
    const m = make()
    expect(await m.auth.signInVerifiedEmail('gg@example.com')).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 77,
      user: { id: 'u1', email: 'gg@example.com' },
    })
    expect(m.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'gg@example.com' })
    expect(m.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash1', type: 'magiclink' })
    expect(m.makePublicClient).toHaveBeenCalledTimes(1)
  })

  it('generateLink lỗi → ném, không gọi verifyOtp', async () => {
    const m = make({ gen: async () => ({ data: null, error: err('unexpected_failure', 500) }) })
    await expect(m.auth.signInVerifiedEmail('a@b.cd')).rejects.toBeTruthy()
    expect(m.verifyOtp).not.toHaveBeenCalled()
  })

  it('generateLink bị rate limit → RATE_LIMITED', async () => {
    const m = make({ gen: async () => ({ data: null, error: err('over_request_rate_limit', 429) }) })
    const e = await m.auth.signInVerifiedEmail('a@b.cd').catch((x) => x)
    expect(e).toBeInstanceOf(AuthError)
    expect(e.code).toBe('RATE_LIMITED')
  })

  it('verifyOtp lỗi → ném lỗi chung (không phải AuthError, giữ cause)', async () => {
    const original = err('otp_expired', 403)
    const m = make({ verify: async () => ({ data: {}, error: original }) })
    const e = await m.auth.signInVerifiedEmail('a@b.cd').catch((x) => x)
    expect(e).not.toBeInstanceOf(AuthError)
    expect(e.cause).toBe(original)
  })
})
