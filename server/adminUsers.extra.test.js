// Kiểm thử độc lập (T-11): quản lý người dùng, khoá tài khoản (G-19) — tìm chỗ thiếu của adminUsers.test.js.
// Tên test có tiền tố [BUG] là test đang ĐỎ vì code nguồn sai (giữ nguyên, không hạ kỳ vọng).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { withAccountLock } from './security/lockedAccounts.js'

const config = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false }, pwnedCheck: false }
let app, repo, auth, U

async function make(email, role = 'customer', extra = {}) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email.split('@')[0], role, email, ...extra })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { id: user.id, email, token: `Bearer ${s.accessToken}`, refresh: s.refreshToken }
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = createApp({ repo, auth, storage: createMemoryStorage(), config })
  U = {
    cust: await make('an@lamvi.test', 'customer', { phone: '0912345678' }),
    cust2: await make('binh@lamvi.test'),
    admin: await make('admin@lamvi.test', 'admin'),
    admin2: await make('admin2@lamvi.test', 'admin'),
    it: await make('it@lamvi.test', 'it'),
    it2: await make('it2@lamvi.test', 'it'),
  }
})

const as = (who, method, path, body) => {
  const r = request(app)[method](path).set('Authorization', U[who].token)
  return body === undefined ? r : r.send(body)
}

// Chặn hai request ở ngay trước bước ghi để chứng minh chúng cùng đã qua bước kiểm tra
function barrier(obj, method, n = 2) {
  const real = obj[method].bind(obj)
  let arrived = 0
  let release
  const gate = new Promise((r) => (release = r))
  const timer = setTimeout(() => release(), 800)
  obj[method] = async (...args) => {
    arrived += 1
    if (arrived >= n) release()
    await gate
    clearTimeout(timer)
    return real(...args)
  }
}

describe('Người bị khoá còn đi được đâu? (G-19)', () => {
  it('token cũ của người bị khoá bị 401 ở MỌI endpoint dùng phiên (hồ sơ, giỏ, đơn, lời chúc, Mây, đổi mật khẩu)', async () => {
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: 'x' })
    const calls = [
      ['get', '/api/me'],
      ['patch', '/api/me', { fullName: 'Mới' }],
      ['get', '/api/cart'],
      ['put', '/api/cart/items/den-nguyet', { quantity: 1 }],
      ['post', '/api/checkout/quote', {}],
      ['post', '/api/orders', {}],
      ['get', '/api/orders'],
      ['get', '/api/orders/LV2610-AAAAAAA'],
      ['get', '/api/orders/LV2610-AAAAAAA/message'],
      ['put', '/api/orders/LV2610-AAAAAAA/message', { text: 'x' }],
      ['post', '/api/orders/LV2610-AAAAAAA/message/media-upload', { kind: 'voice', contentType: 'audio/mpeg', size: 1 }],
      ['post', '/api/orders/LV2610-AAAAAAA/cancel', {}],
      ['post', '/api/orders/LV2610-AAAAAAA/payment', {}],
      ['get', '/api/may/history'],
      ['post', '/api/may/chat', { message: 'xin chào', sessionId: 'abcdefgh12345678' }],
      ['post', '/api/auth/change-password', { currentPassword: 'Gio-Hoa#Sen2026', password: 'Moi-Gio#Lanh83' }],
      ['get', '/api/admin/users'],
      ['get', '/api/it/health'],
    ]
    for (const [method, path, body] of calls) {
      const r = await as('cust', method, path, body)
      // 401: phiên bị thu hồi (đúng). Bất kỳ mã khác (đặc biệt 2xx/403/404) nghĩa là đã lọt qua cổng khoá.
      expect(r.status, `${method} ${path}`).toBe(401)
    }
    // mật khẩu không đổi dù gọi đúng mật khẩu hiện tại
    expect((await request(app).post('/api/auth/login').send({ email: U.cust.email, password: 'Gio-Hoa#Sen2026' })).status).toBe(403)
  })

  it('admin/IT bị IT khoá: mất quyền ngay (401, không phải 403) ở admin và dashboard IT', async () => {
    await as('it', 'post', `/api/admin/users/${U.admin.id}/lock`, {})
    await as('it', 'post', `/api/admin/users/${U.it2.id}/lock`, {})
    for (const path of ['/api/admin/users', '/api/admin/orders', '/api/admin/products']) {
      expect((await as('admin', 'get', path)).status, path).toBe(401)
    }
    expect((await as('it2', 'get', '/api/it/health')).status).toBe(401)
    expect((await as('it2', 'get', '/api/admin/users')).status).toBe(401)
  })

  it('đăng xuất khi đã bị khoá: 204, cookie bị xoá, không cấp phiên mới', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: U.cust.email, password: 'Gio-Hoa#Sen2026' })
    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('lamvi_rt=')).split(';')[0]
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    const r = await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Origin', config.publicSiteUrl).set('Authorization', U.cust.token)
    expect(r.status).toBe(204)
    expect(r.headers['set-cookie'].join(';')).toMatch(/lamvi_rt=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i)
    expect(r.headers['set-cookie'].join(';')).not.toMatch(/lamvi_rt=[^;\s]+;/)
  })

  it('quên mật khẩu không lộ trạng thái khoá (cùng phản hồi với tài khoản thường); email chưa đăng ký thì 404 (D-92)', async () => {
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    const locked = await request(app).post('/api/auth/forgot-password').send({ email: U.cust.email })
    const normal = await request(app).post('/api/auth/forgot-password').send({ email: U.cust2.email })
    expect(locked.status).toBe(normal.status)
    expect(locked.body).toEqual(normal.body)
    const ghost = await request(app).post('/api/auth/forgot-password').send({ email: 'khong-co@lamvi.test' })
    expect(ghost.status).toBe(404)
    expect(ghost.body.error.code).toBe('EMAIL_NOT_REGISTERED')
  })

  it('đặt lại mật khẩu không gỡ khoá và không cấp phiên: đăng nhập bằng mật khẩu mới vẫn ACCOUNT_LOCKED', async () => {
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    const token = await auth.createRecoveryToken(U.cust.email)
    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Gio#Lanh83' })
    expect(reset.status).toBe(204)
    expect(reset.headers['set-cookie']?.join(';') ?? '').not.toMatch(/lamvi_rt=[^;\s]+;/)
    const login = await request(app).post('/api/auth/login').send({ email: U.cust.email, password: 'Moi-Gio#Lanh83' })
    expect(login.status).toBe(403)
    expect(login.body.error.code).toBe('ACCOUNT_LOCKED')
    expect((await repo.getProfile(U.cust.id)).lockedAt).toBeTruthy()
  })

  it('cửa Google (signInVerifiedEmail) và refresh bị khoá: ném ACCOUNT_LOCKED và thu hồi phiên vừa cấp', async () => {
    const locking = withAccountLock(auth, repo)
    await repo.updateProfileAdmin(U.cust.id, { lockedAt: new Date().toISOString() })
    const signOut = vi.spyOn(auth, 'signOut')
    // refresh trước: các cửa kia thu hồi mọi phiên của người này nên refresh token cũ sẽ chết
    await expect(locking.refresh(U.cust.refresh)).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })
    await expect(locking.signInVerifiedEmail(U.cust.email)).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })
    await expect(locking.signIn({ email: U.cust.email, password: 'Gio-Hoa#Sen2026' })).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })
    expect(signOut).toHaveBeenCalledTimes(3)
    // người không bị khoá không bị ảnh hưởng
    expect((await locking.signInVerifiedEmail(U.cust2.email)).accessToken).toBeTruthy()
  })

  it('người có nhiều phiên: khoá chặn tất cả; mở khoá cho đăng nhập mới được', async () => {
    const s2 = await auth.signIn({ email: U.cust.email, password: 'Gio-Hoa#Sen2026' })
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    for (const tk of [U.cust.token, `Bearer ${s2.accessToken}`]) {
      expect((await request(app).get('/api/me').set('Authorization', tk)).status).toBe(401)
    }
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/unlock`)
    const fresh = await request(app).post('/api/auth/login').send({ email: U.cust.email, password: 'Gio-Hoa#Sen2026' })
    expect(fresh.status).toBe(200)
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${fresh.body.accessToken}`)).status).toBe(200)
  })
})

describe('Phân quyền: tự nâng/hạ quyền, IT cuối cùng', () => {
  it('admin không tự nâng quyền: PATCH chính mình → 403; lock kèm role trong body không đổi role', async () => {
    const r = await as('admin', 'patch', `/api/admin/users/${U.admin.id}`, { role: 'it' })
    expect(r.status).toBe(403)
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { role: 'it', lockedAt: null })
    const p = await repo.getProfile(U.cust.id)
    expect(p.role).toBe('customer')
    expect(p.lockedAt).toBeTruthy()
  })

  it('PATCH vai trò với role sai kiểu (mảng, object, hoa, rỗng, thiếu) → 400; trường thừa không mở khoá người bị khoá', async () => {
    await as('it', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    for (const role of [['it'], { a: 1 }, 'IT', 'Admin', '', null, 7, 'it ']) {
      expect((await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role })).status, JSON.stringify(role)).toBe(400)
    }
    expect((await as('it', 'patch', `/api/admin/users/${U.cust.id}`, {})).status).toBe(400)
    const r = await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role: 'admin', lockedAt: null, lockedReason: null, id: U.cust2.id })
    expect(r.status).toBe(200)
    const p = await repo.getProfile(U.cust.id)
    expect(p).toMatchObject({ role: 'admin' })
    expect(p.lockedAt).toBeTruthy()
    expect((await repo.getProfile(U.cust2.id)).role).toBe('customer')
  })

  it('IT hạ IT khác về khách → người đó mất quyền ngay; IT còn lại không tự hạ mình được (không mất hết IT tuần tự)', async () => {
    expect((await as('it', 'patch', `/api/admin/users/${U.it2.id}`, { role: 'customer' })).status).toBe(200)
    expect((await as('it2', 'get', '/api/it/health')).status).toBe(403)
    expect((await as('it', 'patch', `/api/admin/users/${U.it.id}`, { role: 'customer' })).status).toBe(409)
    expect((await as('it', 'get', '/api/it/health')).status).toBe(200)
  })

  it('[BUG] hai IT cùng lúc hạ quyền nhau → vẫn phải còn ít nhất một IT', async () => {
    barrier(repo, 'updateProfileAdmin')
    const [a, b] = await Promise.all([
      as('it', 'patch', `/api/admin/users/${U.it2.id}`, { role: 'customer' }),
      as('it2', 'patch', `/api/admin/users/${U.it.id}`, { role: 'customer' }),
    ])
    // Không có giao dịch nhiều dòng: hai yêu cầu đua nhau có thể cùng bị hoàn tác (409 LAST_IT, thử lại được).
    // Bất biến cần giữ là còn ít nhất một IT, không phải việc có yêu cầu thành công.
    expect([a.status, b.status].every((s) => [200, 401, 409].includes(s))).toBe(true)
    const its = (await repo.listProfiles({ role: 'it', limit: 50 })).items
    expect(its.length).toBeGreaterThanOrEqual(1)
  })

  it('[BUG] hai IT cùng lúc khoá nhau → vẫn phải còn ít nhất một IT dùng được', async () => {
    barrier(repo, 'updateProfileAdmin')
    await Promise.all([
      as('it', 'post', `/api/admin/users/${U.it2.id}/lock`, {}),
      as('it2', 'post', `/api/admin/users/${U.it.id}/lock`, {}),
    ])
    const alive = (await repo.listProfiles({ role: 'it', locked: false, limit: 50 })).items
    expect(alive.length).toBeGreaterThanOrEqual(1)
  })

  it('[BUG] hai admin khoá cùng một khách đồng thời → chỉ một dòng nhật ký "lock"', async () => {
    barrier(repo, 'updateProfileAdmin')
    await Promise.all([
      as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: 'A' }),
      as('admin2', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: 'B' }),
    ])
    const logs = (await repo.listAuditLog({ entity: 'user', entityId: U.cust.id })).filter((l) => l.action === 'lock')
    expect(logs).toHaveLength(1)
  })

  it('admin không xem được chi tiết/khoá/mở khoá/đổi vai trò khi id không phải UUID hoặc không tồn tại → 404 đồng nhất', async () => {
    for (const id of ['__proto__', 'constructor', '%00', '1', 'A'.repeat(36), '00000000-0000-4000-8000-000000000000']) {
      for (const [method, suffix] of [['get', ''], ['post', '/lock'], ['post', '/unlock'], ['patch', '']]) {
        const r = await as('it', method, `/api/admin/users/${id}${suffix}`, method === 'get' ? undefined : { role: 'admin' })
        expect(r.status, `${method} ${id}${suffix}`).toBe(404)
      }
    }
  })
})

describe('Danh sách/tìm kiếm với đầu vào lạ', () => {
  it('ký tự đại diện/cú pháp lọc được coi là chữ thường, không khớp tất cả', async () => {
    const q = async (v) => (await as('admin', 'get', `/api/admin/users?q=${encodeURIComponent(v)}`)).body
    for (const v of ['%', '_', '*', '\\', ',', '(', ')', '%25', 'a,role.eq.it', "x'); drop table profiles;--", '.*']) {
      const r = await q(v)
      expect(r.total, v).toBe(0)
    }
    // dấu cách hai đầu không làm hỏng; q rỗng/toàn dấu cách = không lọc
    expect((await q('  AN@lamvi  ')).total).toBe(1)
    expect((await q('   ')).total).toBe(6)
  })

  it('q/role/status/page dạng mảng hoặc rác không gây 500', async () => {
    for (const qs of ['q=a&q=b', 'q[x]=1', 'role=it&role=admin', 'status[]=locked', 'page=1&page=2', 'page=1e3', 'page=0', 'page=99999999999999999999', 'page=%00']) {
      const r = await as('admin', 'get', `/api/admin/users?${qs}`)
      expect(r.status, qs).toBe(200)
    }
  })

  it('[BUG] chi tiết người dùng: orderCount khớp danh sách khi khách có nhiều hơn 20 đơn', async () => {
    for (let i = 0; i < 22; i++) {
      await as('cust', 'put', '/api/cart/items/den-nguyet', { quantity: 1 })
      const r = await as('cust', 'post', '/api/orders', {
        orderKind: 'self',
        recipientIsSelf: true,
        recipientName: 'An',
        recipientPhone: '0912345678',
        addressLine: '1 A',
        province: 'Hà Nội',
        paymentMethod: 'cod',
      })
      expect(r.status).toBe(201)
    }
    const list = (await as('admin', 'get', '/api/admin/users?q=an@lamvi')).body.items[0]
    const detail = (await as('admin', 'get', `/api/admin/users/${U.cust.id}`)).body
    expect(list.orderCount).toBe(22)
    expect(detail.item.orderCount).toBe(list.orderCount)
  })
})

describe('Lý do khoá và nhật ký', () => {
  it('lý do không phải chuỗi (object/mảng/số) hoặc chỉ khoảng trắng → null; HTML được lưu nguyên văn (UI phải escape)', async () => {
    for (const [i, reason] of [{ a: 1 }, ['x'], 5, '   '].entries()) {
      const id = [U.cust.id, U.cust2.id][i % 2]
      await as('admin', 'post', `/api/admin/users/${id}/unlock`)
      const r = await as('admin', 'post', `/api/admin/users/${id}/lock`, { reason })
      expect(r.body.item.lockedReason, JSON.stringify(reason)).toBeNull()
    }
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/unlock`)
    const html = await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: '<img src=x onerror=alert(1)>' })
    expect(html.body.item.lockedReason).toBe('<img src=x onerror=alert(1)>')
    expect(html.headers['content-type']).toMatch(/application\/json/)
  })

  it('[BUG] lý do dài chứa emoji bị cắt giữa cặp thay thế (lone surrogate) → DB/JSON không hợp lệ', async () => {
    const reason = `a${'😀'.repeat(200)}`
    const r = await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason })
    expect(r.status).toBe(200)
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    expect(lone.test(r.body.item.lockedReason)).toBe(false)
    expect(lone.test(JSON.stringify((await repo.listAuditLog({ entity: 'user', entityId: U.cust.id }))[0].newValue.reason))).toBe(false)
  })

  it('nhật ký chi tiết người dùng không chứa mật khẩu/token/băm', async () => {
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: 'spam' })
    await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role: 'admin' })
    const d = await as('admin', 'get', `/api/admin/users/${U.cust.id}`)
    expect(d.body.audit.length).toBe(2)
    expect(JSON.stringify(d.body)).not.toMatch(/password|hash|salt|accessToken|refreshToken|Bearer/i)
  })
})

describe('PATCH /api/me không chạm được vai trò/khoá/email/người khác', () => {
  it('id, role, email, lockedAt, lockedReason, __proto__ trong body đều bị bỏ qua', async () => {
    const r = await request(app)
      .patch('/api/me')
      .set('Authorization', U.cust.token)
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          fullName: 'Tên mới',
          id: U.cust2.id,
          role: 'it',
          email: 'ke-gian@x.test',
          lockedAt: '2020-01-01T00:00:00.000Z',
          lockedReason: 'tu khoa',
          __proto__: { role: 'it' },
          constructor: { prototype: { role: 'it' } },
        }),
      )
      .catch((e) => e.response ?? { status: 0 })
    expect(r.status).toBe(200)
    expect(r.body.profile).toMatchObject({ id: U.cust.id, role: 'customer', email: U.cust.email, fullName: 'Tên mới' })
    const mine = await repo.getProfile(U.cust.id)
    expect(mine).toMatchObject({ role: 'customer', email: U.cust.email, lockedAt: null })
    const other = await repo.getProfile(U.cust2.id)
    expect(other.fullName).not.toBe('Tên mới')
    expect(Object.hasOwn(Object.prototype, 'role')).toBe(false)
    expect(({}).role).toBeUndefined()
  })
})
