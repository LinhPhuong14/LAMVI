// NFR-AUD-001, G-21: nhật ký thay đổi của admin cho sản phẩm, FAQ và lô
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'

let app, repo, auth, admin, adminId

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = createApp({ repo, auth, storage: createMemoryStorage({ maxBytes: 1024 * 1024 }), config: { publicSiteUrl: 'https://moc.test', maxVideoMb: 1 } })
  const { user } = await auth.signUp({ email: 'admin@moc.test', password: 'Gio-Hoa#Sen2026' })
  adminId = user.id
  await repo.upsertProfile({ id: user.id, fullName: 'Admin', role: 'admin' })
  admin = `Bearer ${(await auth.signIn({ email: 'admin@moc.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
})

const api = (m, url, body) => request(app)[m](`/api${url}`).set('Authorization', admin).send(body)
const log = (entity, entityId) => repo.listAuditLog({ entity, entityId })

describe('audit_log cho sản phẩm / FAQ / lô', () => {
  it('sản phẩm: tạo, sửa (chỉ trường đổi), xoá đều có dòng nhật ký kèm người làm', async () => {
    const c = await api('post', '/admin/products', { slug: 'den-moi', kind: 'single', price: 750000, name: { vi: 'Đèn Mới' }, description: { vi: 'Mô tả' } })
    expect(c.status).toBe(201)
    const id = c.body.item.id
    const u = await api('patch', `/admin/products/${id}`, { price: 800000 })
    expect(u.status).toBe(200)
    await api('patch', `/admin/products/${id}`, { price: 800000 }) // không đổi gì
    expect((await api('delete', `/admin/products/${id}`)).status).toBe(204)
    const rows = await log('product', id)
    expect(rows.map((r) => r.action).sort()).toEqual(['create', 'delete', 'update', 'update'])
    const upd = rows.filter((r) => r.action === 'update')
    expect(upd.map((r) => r.newValue).sort((a, b) => Object.keys(a).length - Object.keys(b).length)).toEqual([{}, { price: 800000 }])
    expect(rows.every((r) => r.actorId === adminId)).toBe(true)
    expect(rows.find((r) => r.action === 'update' && r.newValue.price).oldValue).toEqual({ price: 750000 })
  })

  it('FAQ: tạo, sửa, xoá', async () => {
    const c = await api('post', '/admin/faq', { question: { vi: 'Hỏi?' }, answer: { vi: 'Đáp.' } })
    expect(c.status).toBe(201)
    const id = c.body.item.id
    await api('patch', `/admin/faq/${id}`, { answer: { vi: 'Đáp mới.' } })
    await api('delete', `/admin/faq/${id}`)
    expect((await log('faq', id)).map((r) => r.action).sort()).toEqual(['create', 'delete', 'update'])
  })

  it('lô: tạo, sửa, xoá; xuất bản ghi nhật ký', async () => {
    const a = await api('post', '/admin/batches', { code: 'L-001', title: { vi: 'Mẻ 1' } })
    expect(a.status).toBe(201)
    const id = a.body.item.id
    await api('patch', `/admin/batches/${id}`, { title: { vi: 'Mẻ một' } })
    await api('delete', `/admin/batches/${id}`)
    expect((await log('batch', id)).map((r) => r.action).sort()).toEqual(['create', 'delete', 'update'])
  })

  it('yêu cầu lỗi (404, 400) không ghi nhật ký', async () => {
    expect((await api('patch', '/admin/products/khong-co', { price: 1 })).status).toBeGreaterThanOrEqual(400)
    expect((await api('post', '/admin/products', {})).status).toBe(400)
    expect(await repo.listAuditLog({})).toEqual([])
  })
})
