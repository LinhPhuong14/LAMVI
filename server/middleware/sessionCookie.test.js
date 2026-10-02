import { describe, expect, it } from 'vitest'
import { clearRefreshCookie, issueSession, readRefreshCookie, sameOriginOnly, setRefreshCookie } from './sessionCookie.js'

const fakeRes = () => ({ headers: [], append(k, v) { this.headers.push([k, v]) } })
const run = (mw, headers) => {
  let called = false
  let error = null
  try {
    mw({ get: (h) => headers[h.toLowerCase()] }, {}, () => { called = true })
  } catch (e) {
    error = e
  }
  return { called, error }
}

describe('cookie phiên (T-49)', () => {
  it('https → HttpOnly; SameSite=Lax; Secure; Path hẹp; token được encode', () => {
    const res = fakeRes()
    setRefreshCookie(res, { publicSiteUrl: 'https://lamvi.vn' }, 'a b;c')
    expect(res.headers[0][0]).toBe('Set-Cookie')
    expect(res.headers[0][1]).toBe('lamvi_rt=a%20b%3Bc; Max-Age=2592000; Path=/api/auth; HttpOnly; SameSite=Lax; Secure')
  })

  it('http (dev) → không Secure để localhost dùng được', () => {
    const res = fakeRes()
    setRefreshCookie(res, { publicSiteUrl: 'http://localhost:5173' }, 't')
    expect(res.headers[0][1]).not.toContain('Secure')
  })

  it('clear: Max-Age=0 cùng Path (nếu khác Path trình duyệt không xoá)', () => {
    const res = fakeRes()
    clearRefreshCookie(res, { publicSiteUrl: 'https://lamvi.vn' })
    expect(res.headers[0][1]).toMatch(/^lamvi_rt=; Max-Age=0; Path=\/api\/auth; HttpOnly/)
  })

  it('issueSession: đặt cookie và bỏ refreshToken khỏi phiên trả về, không sửa đối tượng gốc', () => {
    const res = fakeRes()
    const session = { accessToken: 'a', refreshToken: 'r', expiresAt: 1, user: { id: 'u' } }
    expect(issueSession(res, { publicSiteUrl: 'https://x.vn' }, session)).toEqual({ accessToken: 'a', expiresAt: 1, user: { id: 'u' } })
    expect(session.refreshToken).toBe('r')
    expect(res.headers[0][1]).toContain('lamvi_rt=r;')
  })

  it('readRefreshCookie đọc đúng cookie giữa nhiều cookie, giải mã', () => {
    expect(readRefreshCookie({ headers: { cookie: 'a=1; lamvi_rt=a%20b; b=2' } })).toBe('a b')
    expect(readRefreshCookie({ headers: {} })).toBeNull()
  })
})

describe('sameOriginOnly — chống CSRF cho endpoint dùng cookie', () => {
  const mw = sameOriginOnly({ publicSiteUrl: 'https://lamvi.vn' })
  it.each([
    ['không có Origin, không có Sec-Fetch-Site (curl/cùng origin GET)', {}],
    ['Origin = PUBLIC_SITE_URL', { origin: 'https://lamvi.vn' }],
    ['Origin cùng Host với request (domain Preview)', { origin: 'https://pr-1.vercel.app', host: 'pr-1.vercel.app' }],
    ['Sec-Fetch-Site same-origin', { 'sec-fetch-site': 'same-origin' }],
  ])('cho qua: %s', (_n, headers) => {
    expect(run(mw, headers)).toEqual({ called: true, error: null })
  })

  it.each([
    ['Origin lạ', { origin: 'https://evil.test', host: 'lamvi.vn' }],
    ['Origin "null" (sandbox iframe)', { origin: 'null', host: 'lamvi.vn' }],
    ['Origin hỏng', { origin: '%%%', host: 'lamvi.vn' }],
    ['subdomain giả', { origin: 'https://lamvi.vn.evil.test', host: 'lamvi.vn' }],
    ['cross-site không Origin', { 'sec-fetch-site': 'cross-site' }],
  ])('chặn 403: %s', (_n, headers) => {
    const r = run(mw, headers)
    expect(r.called).toBe(false)
    expect(r.error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})
