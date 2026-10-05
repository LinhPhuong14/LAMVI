// Quản lý người dùng trong admin (G-19, §3.2, §7, D-38, D-51).
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'

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

describe('Quyền truy cập', () => {
  it('khách và chưa đăng nhập không vào được', async () => {
    expect((await as('cust', 'get', '/api/admin/users')).status).toBe(403)
    expect((await request(app).get('/api/admin/users')).status).toBe(401)
    expect((await as('cust', 'post', `/api/admin/users/${U.cust2.id}/lock`, {})).status).toBe(403)
    expect((await as('cust', 'patch', `/api/admin/users/${U.cust2.id}`, { role: 'admin' })).status).toBe(403)
  })
})

describe('Danh sách và tìm kiếm', () => {
  it('liệt kê, kèm số đơn; không lộ trường nhạy cảm', async () => {
    const r = await as('admin', 'get', '/api/admin/users')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ total: 6, page: 1, pageSize: 20 })
    const an = r.body.items.find((u) => u.email === 'an@lamvi.test')
    expect(an).toMatchObject({ id: U.cust.id, role: 'customer', locked: false, orderCount: 0, phone: '0912345678' })
    expect(JSON.stringify(r.body)).not.toMatch(/password|hash|token/i)
  })

  it('tìm theo email/tên/SĐT (không phân biệt hoa thường), lọc theo vai trò và trạng thái', async () => {
    const q = async (qs) => (await as('admin', 'get', `/api/admin/users?${qs}`)).body
    expect((await q('q=AN@LAMVI')).items.map((u) => u.email)).toEqual(['an@lamvi.test'])
    expect((await q('q=0912345678')).total).toBe(1)
    expect((await q('role=it')).total).toBe(2)
    expect((await q('role=hacker')).total).toBe(6) // vai trò lạ bị bỏ qua, không lỗi
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    expect((await q('status=locked')).items.map((u) => u.email)).toEqual(['an@lamvi.test'])
    expect((await q('status=active')).total).toBe(5)
  })

  it('đầu vào tìm kiếm lạ không gây lỗi (ký tự đặc biệt, quá dài, page rác)', async () => {
    for (const qs of ['q=%25%27)%20or%20(1=1', 'q=' + 'a'.repeat(500), 'page=-3', 'page=abc', 'q[]=x']) {
      expect((await as('admin', 'get', `/api/admin/users?${qs}`)).status).toBe(200)
    }
  })

  it('phân trang 20 người/trang', async () => {
    for (let i = 0; i < 25; i++) await make(`u${i}@lamvi.test`)
    const p1 = (await as('admin', 'get', '/api/admin/users')).body
    const p2 = (await as('admin', 'get', '/api/admin/users?page=2')).body
    expect(p1.items).toHaveLength(20)
    expect(p1.total).toBe(31)
    expect(p2.items).toHaveLength(11)
    expect(new Set([...p1.items, ...p2.items].map((u) => u.id)).size).toBe(31)
  })

  it('chi tiết: hồ sơ, đơn gần đây, nhật ký; id sai hình/không có → 404', async () => {
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: 'spam' })
    const r = await as('admin', 'get', `/api/admin/users/${U.cust.id}`)
    expect(r.body.item).toMatchObject({ email: 'an@lamvi.test', locked: true, lockedReason: 'spam' })
    expect(r.body.audit[0]).toMatchObject({ entity: 'user', action: 'lock' })
    expect((await as('admin', 'get', '/api/admin/users/khong-phai-uuid')).status).toBe(404)
    expect((await as('admin', 'get', '/api/admin/users/00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })
})

describe('Khoá / mở khoá (G-19)', () => {
  it('khoá → phiên đang có bị chặn ngay, đăng nhập và refresh bị từ chối ACCOUNT_LOCKED', async () => {
    const lock = await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: 'gian lận' })
    expect(lock.body.item).toMatchObject({ locked: true, lockedReason: 'gian lận' })
    // Token đang dùng bị từ chối ở request kế tiếp
    expect((await as('cust', 'get', '/api/me')).status).toBe(401)
    const login = await request(app).post('/api/auth/login').send({ email: 'an@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    expect(login.status).toBe(403)
    expect(login.body.error.code).toBe('ACCOUNT_LOCKED')
    expect(login.headers['set-cookie']?.join('') ?? '').not.toMatch(/lamvi_rt=[^;]/)
    await expect(auth.refresh(U.cust.refresh)).rejects.toBeDefined()
  })

  it('refresh bằng cookie của người bị khoá → 403 ACCOUNT_LOCKED và xoá cookie (không cấp phiên mới)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'an@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('lamvi_rt=')).split(';')[0]
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    const r = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('Origin', config.publicSiteUrl)
    expect(r.status).toBe(403)
    expect(r.body.error.code).toBe('ACCOUNT_LOCKED')
    expect(r.body.accessToken).toBeUndefined()
  })

  it('mở khoá → đăng nhập lại được, dữ liệu giữ nguyên', async () => {
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    const un = await as('admin', 'post', `/api/admin/users/${U.cust.id}/unlock`)
    expect(un.body.item).toMatchObject({ locked: false, lockedAt: null, lockedReason: null })
    const login = await request(app).post('/api/auth/login').send({ email: 'an@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    expect(login.status).toBe(200)
  })

  it('khoá hai lần / mở khi chưa khoá là idempotent, không ghi nhật ký thừa', async () => {
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, {})
    await as('admin', 'post', `/api/admin/users/${U.cust2.id}/unlock`)
    expect((await repo.listAuditLog({ entity: 'user' })).length).toBe(1)
  })

  it('không tự khoá mình; admin không khoá được admin/it, IT thì được; không ai khoá được chính mình', async () => {
    const self = await as('admin', 'post', `/api/admin/users/${U.admin.id}/lock`, {})
    expect(self.status).toBe(409)
    expect(self.body.error.code).toBe('CANNOT_MANAGE_SELF')
    expect((await as('admin', 'post', `/api/admin/users/${U.admin2.id}/lock`, {})).status).toBe(403)
    expect((await as('admin', 'post', `/api/admin/users/${U.it.id}/lock`, {})).status).toBe(403)
    expect((await as('it', 'post', `/api/admin/users/${U.admin2.id}/lock`, {})).status).toBe(200)
    expect((await as('it', 'post', `/api/admin/users/${U.it.id}/lock`, {})).status).toBe(409)
  })

  it('lý do dài bị cắt 300; body rác không làm hỏng', async () => {
    const r = await as('admin', 'post', `/api/admin/users/${U.cust.id}/lock`, { reason: 'x'.repeat(1000) })
    expect(r.body.item.lockedReason).toHaveLength(300)
    const r2 = await as('admin', 'post', `/api/admin/users/${U.cust2.id}/lock`, [1, 2])
    expect(r2.status).toBe(200)
  })

  it('khoá có hiệu lực với mọi route dùng phiên (đơn, giỏ, admin)', async () => {
    await as('it', 'post', `/api/admin/users/${U.admin2.id}/lock`, {})
    expect((await as('admin2', 'get', '/api/admin/products')).status).toBe(401)
    expect((await as('admin2', 'get', '/api/cart')).status).toBe(401)
  })
})

describe('Đổi vai trò (D-38, D-51)', () => {
  it('chỉ IT đổi được; admin → 403', async () => {
    expect((await as('admin', 'patch', `/api/admin/users/${U.cust.id}`, { role: 'admin' })).status).toBe(403)
    const r = await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role: 'admin' })
    expect(r.body.item.role).toBe('admin')
    // có hiệu lực ngay ở request kế tiếp (vai trò đọc từ DB mỗi request)
    expect((await as('cust', 'get', '/api/admin/products')).status).toBe(200)
    expect((await as('cust', 'get', '/api/it/health')).status).toBe(403)
  })

  it('không tự đổi vai trò mình; vai trò lạ → 400; đổi về cũ → không ghi nhật ký', async () => {
    expect((await as('it', 'patch', `/api/admin/users/${U.it.id}`, { role: 'customer' })).body.error.code).toBe('CANNOT_MANAGE_SELF')
    const bad = await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role: 'root' })
    expect(bad.status).toBe(400)
    expect((await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role: '__proto__' })).status).toBe(400)
    await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role: 'customer' })
    expect((await repo.listAuditLog({ entity: 'user' })).length).toBe(0)
  })

  it('nhật ký ghi ai đổi, giá trị cũ/mới (NFR-AUD-001)', async () => {
    await as('it', 'patch', `/api/admin/users/${U.cust.id}`, { role: 'admin' })
    const [log] = await repo.listAuditLog({ entity: 'user', entityId: U.cust.id })
    expect(log).toMatchObject({ actorId: U.it.id, actorRole: 'it', action: 'role', oldValue: { role: 'customer' }, newValue: { role: 'admin' } })
  })

  it('role và khoá không đổi được qua PATCH /api/me hay đăng ký', async () => {
    const me = await as('cust', 'patch', '/api/me', { fullName: 'X', role: 'it', lockedAt: null })
    expect(me.body.profile.role).toBe('customer')
    await as('admin', 'post', `/api/admin/users/${U.cust2.id}/lock`, {})
    await repo.upsertProfile({ id: U.cust2.id, fullName: 'đổi tên', lockedAt: null })
    expect((await repo.getProfile(U.cust2.id)).lockedAt).toBeTruthy()
  })
})

describe('Email ở hồ sơ', () => {
  it('đăng ký lưu email; GET /me bổ sung email cho hồ sơ cũ', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email: 'Moi@Lamvi.Test', password: 'Dai-Hon#Muoi4411', fullName: 'Mới' })
    expect(reg.status).toBe(201)
    expect((await repo.getProfile(reg.body.user.id)).email).toBe('moi@lamvi.test')
    const old = await make('cu@lamvi.test')
    await repo.upsertProfile({ id: old.id, email: null })
    await as('cust', 'get', '/api/me')
    await request(app).get('/api/me').set('Authorization', old.token)
    expect((await repo.getProfile(old.id)).email).toBe('cu@lamvi.test')
  })
})
