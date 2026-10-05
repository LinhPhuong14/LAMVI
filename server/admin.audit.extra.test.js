// Kiểm thử độc lập (T-11) cho G-21/NFR-AUD-001, G-38, G-27
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createSupabaseAuth } from './adapters/supabase/auth.js'
import { createMaintenance } from './monitoring/maintenance.js'

const PW = 'Gio-Hoa#Sen2026'
let app, repo, auth, storage, admin, itTok, maintenance, consoleError

async function login(email, role) {
  const { user } = await auth.signUp({ email, password: PW })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  return { id: user.id, bearer: `Bearer ${(await auth.signIn({ email, password: PW })).accessToken}` }
}

beforeEach(async () => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  storage = createMemoryStorage({ maxBytes: 1024 * 1024 })
  maintenance = createMaintenance({ repo, ttlMs: 0 })
  app = createApp({ repo, auth, storage, maintenance, config: { publicSiteUrl: 'https://moc.test', maxVideoMb: 1 } })
  admin = (await login('admin@moc.test', 'admin')).bearer
  itTok = (await login('it@moc.test', 'it')).bearer
})
afterEach(() => vi.restoreAllMocks())

const api = (m, url, body) => request(app)[m](`/api${url}`).set('Authorization', admin).send(body)
const logOf = (entity, entityId) => repo.listAuditLog({ entity, entityId })

async function newBatch(code = 'L-X1') {
  return (await api('post', '/admin/batches', { code, title: { vi: 'Mẻ' } })).body.item
}
async function attachVideo(id) {
  const up = await api('post', `/admin/batches/${id}/video-upload`, { contentType: 'video/mp4', size: 5 })
  await request(app).put(up.body.uploadUrl).set('Content-Type', 'video/mp4').send(Buffer.from('video'))
  return api('post', `/admin/batches/${id}/video`, { path: up.body.path })
}

describe('G-21: lô — video và xuất bản', () => {
  it('set_video, publish có dòng log; publish lần 2 không ghi thêm', async () => {
    const b = await newBatch()
    expect((await attachVideo(b.id)).status).toBe(200)
    expect((await api('post', `/admin/batches/${b.id}/publish`)).status).toBe(200)
    expect((await api('post', `/admin/batches/${b.id}/publish`)).status).toBe(200)
    const rows = await logOf('batch', b.id)
    expect(rows.filter((r) => r.action === 'publish')).toHaveLength(1)
    expect(rows.filter((r) => r.action === 'set_video')).toHaveLength(1)
    const pub = rows.find((r) => r.action === 'publish')
    expect(pub.oldValue).toEqual({ status: 'created' })
    expect(pub.newValue).toEqual({ status: 'video_published' })
  })

  it('publish khi chưa có video (409) không ghi log; thay video sau xuất bản ghi oldValue là video cũ', async () => {
    const b = await newBatch()
    expect((await api('post', `/admin/batches/${b.id}/publish`)).status).toBe(409)
    expect((await logOf('batch', b.id)).filter((r) => r.action === 'publish')).toHaveLength(0)
    const first = await attachVideo(b.id)
    await api('post', `/admin/batches/${b.id}/publish`)
    const second = await attachVideo(b.id)
    const sv = (await logOf('batch', b.id)).filter((r) => r.action === 'set_video')
    expect(sv).toHaveLength(2)
    const latest = sv.find((r) => r.newValue.videoPath === second.body.item.videoPath)
    expect(latest.oldValue.videoPath).toBe(first.body.item.videoPath)
  })

  it('xoá lô đã xuất bản (409) và đổi mã lô đã xuất bản (409) không ghi log', async () => {
    const b = await newBatch()
    await attachVideo(b.id)
    await api('post', `/admin/batches/${b.id}/publish`)
    const before = (await logOf('batch', b.id)).length
    expect((await api('delete', `/admin/batches/${b.id}`)).status).toBe(409)
    expect((await api('patch', `/admin/batches/${b.id}`, { code: 'L-DOI' })).status).toBe(409)
    expect((await logOf('batch', b.id)).length).toBe(before)
  })
})

describe('G-21: ảnh sản phẩm', () => {
  async function newProduct() {
    return (await api('post', '/admin/products', { slug: 'den-a', kind: 'single', price: 100000, name: { vi: 'Đèn A' }, description: { vi: 'M' } })).body.item
  }
  async function setImage(id) {
    const up = await api('post', `/admin/products/${id}/image-upload`, { contentType: 'image/webp', size: 100 })
    await request(app).put(up.body.uploadUrl).set('Content-Type', 'image/webp').send(Buffer.alloc(100, 1))
    return api('post', `/admin/products/${id}/image`, { path: up.body.path })
  }

  it('set_image, remove_image có log; gỡ ảnh khi chưa có ảnh không ghi dòng thừa', async () => {
    const p = await newProduct()
    expect((await api('delete', `/admin/products/${p.id}/image`)).status).toBe(200)
    expect((await logOf('product', p.id)).filter((r) => r.action === 'remove_image')).toHaveLength(0)
    const s = await setImage(p.id)
    expect(s.status).toBe(200)
    expect((await api('delete', `/admin/products/${p.id}/image`)).status).toBe(200)
    const rows = await logOf('product', p.id)
    const set = rows.find((r) => r.action === 'set_image')
    const rem = rows.find((r) => r.action === 'remove_image')
    expect(set.oldValue).toEqual({ imagePath: null })
    expect(set.newValue.imagePath).toBe(s.body.item.imagePath)
    expect(rem.oldValue.imagePath).toBe(s.body.item.imagePath)
  })

  it('nhật ký không chứa token, URL ký, URL tải lên hay Bearer', async () => {
    const p = await newProduct()
    const b = await newBatch()
    await setImage(p.id)
    await attachVideo(b.id)
    await api('post', `/admin/batches/${b.id}/publish`)
    await api('patch', `/admin/products/${p.id}`, { price: 5 })
    const all = JSON.stringify(await repo.listAuditLog({}))
    expect(all).not.toMatch(/dev-storage|uploadUrl|Bearer|token|signed|password/i)
  })
})

describe('G-21: sửa không đổi gì / audit lỗi', () => {
  it('update bằng giá trị y hệt → newValue/oldValue rỗng, không lộ trường khác', async () => {
    const c = await api('post', '/admin/products', { slug: 'den-b', kind: 'single', price: 200000, name: { vi: 'Đèn B' }, description: { vi: 'Bí mật nội bộ' } })
    const id = c.body.item.id
    await api('patch', `/admin/products/${id}`, { price: 200000 })
    const upd = (await logOf('product', id)).find((r) => r.action === 'update')
    expect(upd.oldValue).toEqual({})
    expect(upd.newValue).toEqual({})
    expect(JSON.stringify(await logOf('product', id))).not.toContain('Bí mật nội bộ')
  })

  it('đổi object lồng nhau bằng nhau (FAQ answer) không tính là thay đổi', async () => {
    const c = await api('post', '/admin/faq', { question: { vi: 'Hỏi?' }, answer: { vi: 'Đáp.' } })
    await api('patch', `/admin/faq/${c.body.item.id}`, { answer: { vi: 'Đáp.' } })
    const upd = (await logOf('faq', c.body.item.id)).find((r) => r.action === 'update')
    expect(upd.newValue).toEqual({})
  })

  it('appendAuditLog ném lỗi → request admin vẫn thành công, lỗi chỉ log', async () => {
    repo.appendAuditLog = async () => {
      throw new Error('audit down')
    }
    const c = await api('post', '/admin/products', { slug: 'den-c', kind: 'single', price: 1, name: { vi: 'C' }, description: { vi: 'M' } })
    expect(c.status).toBe(201)
    const id = c.body.item.id
    expect((await api('patch', `/admin/products/${id}`, { price: 2 })).status).toBe(200)
    const b = await newBatch('L-ERR')
    expect(b.id).toBeTruthy()
    expect((await attachVideo(b.id)).status).toBe(200)
    expect((await api('post', `/admin/batches/${b.id}/publish`)).status).toBe(200)
    expect((await api('delete', `/admin/products/${id}`)).status).toBe(204)
    expect(consoleError).toHaveBeenCalled()
  })

  it('repo không có appendAuditLog → vẫn chạy', async () => {
    repo.appendAuditLog = undefined
    expect((await api('post', '/admin/faq', { question: { vi: 'Q' }, answer: { vi: 'A' } })).status).toBe(201)
  })

  it('xoá bản ghi không tồn tại → 404, không ghi log; khách (không phải admin) bị chặn và không ghi log', async () => {
    expect((await api('delete', '/admin/faq/khong-co')).status).toBe(404)
    expect((await api('delete', '/admin/products/khong-co')).status).toBe(404)
    const cust = (await login('khach@moc.test', 'customer')).bearer
    const res = await request(app).post('/api/admin/faq').set('Authorization', cust).send({ question: { vi: 'Q' }, answer: { vi: 'A' } })
    expect(res.status).toBe(403)
    expect(await repo.listAuditLog({})).toEqual([])
  })
})

describe('G-38: rollback đăng ký', () => {
  const body = { email: 'moi@moc.test', password: PW, fullName: 'Khách Mới' }

  it('deleteUser cũng lỗi → vẫn trả lỗi gốc (500), lỗi rollback chỉ được log', async () => {
    repo.upsertProfile = async () => {
      throw new Error('db down')
    }
    auth.deleteUser = async () => {
      throw new Error('delete down')
    }
    const res = await request(app).post('/api/auth/register').send(body)
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toMatch(/delete down|db down/)
    expect(consoleError.mock.calls.flat().join(' ')).toContain('rollback')
  })

  it('deleteUser ném đồng bộ (không async) → vẫn trả lỗi gốc', async () => {
    repo.upsertProfile = async () => {
      throw new Error('db down')
    }
    auth.deleteUser = () => {
      throw new Error('sync boom')
    }
    const res = await request(app).post('/api/auth/register').send(body)
    expect(res.status).toBe(500)
  })

  it('auth không có deleteUser → vẫn trả lỗi gốc, không crash', async () => {
    repo.upsertProfile = async () => {
      throw new Error('db down')
    }
    auth.deleteUser = undefined
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(500)
  })

  it('getProfile lỗi cũng kích hoạt rollback; rollback xong email đăng ký lại được và đăng nhập được', async () => {
    const real = repo.getProfile
    repo.getProfile = async () => {
      throw new Error('read down')
    }
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(500)
    repo.getProfile = real
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(201)
    const li = await request(app).post('/api/auth/login').send({ email: body.email, password: PW })
    expect(li.status).toBe(200)
  })

  it('đăng ký thành công thì không gọi deleteUser', async () => {
    const spy = vi.spyOn(auth, 'deleteUser')
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(201)
    expect(spy).not.toHaveBeenCalled()
  })

  it('memory deleteUser chỉ gỡ đúng user theo id, id lạ là no-op', async () => {
    const { user } = await auth.signUp({ email: 'a@x.test', password: PW })
    await auth.signUp({ email: 'b@x.test', password: PW })
    await auth.deleteUser('khong-co')
    await auth.deleteUser(user.id)
    await expect(auth.signIn({ email: 'a@x.test', password: PW })).rejects.toBeTruthy()
    await expect(auth.signIn({ email: 'b@x.test', password: PW })).resolves.toBeTruthy()
  })
})

describe('Supabase auth.deleteUser (G-38)', () => {
  it('gọi admin.auth.admin.deleteUser với id; lỗi được map và ném', async () => {
    const del = vi.fn(async () => ({ data: null, error: null }))
    const a = createSupabaseAuth({ admin: { auth: { admin: { deleteUser: del } } }, makePublicClient: () => ({}) })
    await a.deleteUser('u-1')
    expect(del).toHaveBeenCalledWith('u-1')
    del.mockResolvedValueOnce({ data: null, error: { name: 'AuthApiError', code: 'user_not_found', status: 404, message: 'secret internals' } })
    await expect(a.deleteUser('u-2')).rejects.toBeTruthy()
  })

  it('đăng ký qua route thật với Supabase auth: ghi hồ sơ lỗi → gọi deleteUser đúng id mới tạo, trả 500', async () => {
    const admin = {
      auth: {
        admin: {
          createUser: vi.fn(async ({ email }) => ({ data: { user: { id: 'u-new', email } }, error: null })),
          deleteUser: vi.fn(async () => ({ data: null, error: { name: 'AuthApiError', status: 500, message: 'x' } })),
        },
      },
    }
    const r = createMemoryRepo()
    r.upsertProfile = async () => {
      throw new Error('db down')
    }
    const a = createApp({ repo: r, auth: createSupabaseAuth({ admin, makePublicClient: () => ({}) }), config: { publicSiteUrl: 'https://moc.test' } })
    const res = await request(a).post('/api/auth/register').send({ email: 'an@example.com', password: PW, fullName: 'An' })
    expect(res.status).toBe(500)
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u-new')
  })
})

describe('G-27: nhật ký bảo trì', () => {
  const put = (enabled, tok = itTok) => request(app).put('/api/it/maintenance').set('Authorization', tok).send({ enabled })
  const getLog = () => request(app).get('/api/it/maintenance/log').set('Authorization', itTok)

  it('mới → cũ, có oldValue/newValue và actorId', async () => {
    await put(true)
    await put(false)
    const items = (await getLog()).body.items
    expect(items.map((e) => e.action)).toEqual(['disable', 'enable'])
    expect(items[0].oldValue).toEqual({ enabled: true })
    expect(items[0].newValue).toEqual({ enabled: false })
    expect(items[1].oldValue).toEqual({ enabled: false })
    expect(items.every((e) => e.actorId)).toBe(true)
  })

  it('giới hạn 50 dòng, dòng mới nhất đứng đầu', async () => {
    for (let i = 0; i < 55; i++) await put(i % 2 === 0)
    const items = (await getLog()).body.items
    expect(items).toHaveLength(50)
    expect(items[0].action).toBe('enable') // i=54 chẵn → bật
    expect(items[0].id).toBeGreaterThan(items[49].id)
  })

  it('giá trị không hợp lệ (400) không ghi log; chưa ai bật → log rỗng; chưa đăng nhập 401; log chỉ chứa entity maintenance', async () => {
    expect((await getLog()).body.items).toEqual([])
    expect((await put('yes')).status).toBe(400)
    expect((await getLog()).body.items).toEqual([])
    expect((await request(app).get('/api/it/maintenance/log')).status).toBe(401)
    await api('post', '/admin/faq', { question: { vi: 'Q' }, answer: { vi: 'A' } })
    await put(true)
    const items = (await getLog()).body.items
    expect(items).toHaveLength(1)
    expect(items[0].entity).toBe('maintenance')
  })

  it('appendAuditLog lỗi → bật bảo trì vẫn thành công', async () => {
    repo.appendAuditLog = async () => {
      throw new Error('audit down')
    }
    const res = await put(true)
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(true)
  })

  it('admin không bật được bảo trì (403) và không ghi log', async () => {
    expect((await put(true, admin)).status).toBe(403)
    expect((await getLog()).body.items).toEqual([])
  })
})
