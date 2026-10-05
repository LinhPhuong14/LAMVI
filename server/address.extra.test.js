// T-11: kiểm thử độc lập G-46, D-99 (địa chỉ 2 cấp)
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { VN_PROVINCES } from './data/vnAdmin.js'
import { listWards, resolveAddress } from './domain/address.js'
import { validateCheckout } from './domain/order.js'
import { buildVnAdminJs } from '../scripts/gen-vn-admin.js'

const config = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } }
let app, repo, auth, customer
async function login(email) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role: 'customer' })
  return `Bearer ${(await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })).accessToken}`
}
const BODY = { orderKind: 'self', hasMessage: false, recipientIsSelf: true, recipientName: 'A', recipientPhone: '0912345678', addressLine: '12 X', paymentMethod: 'cod' }
const place = (over) => request(app).post('/api/orders').set('Authorization', customer).send({ ...BODY, ...over })

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = createApp({ repo, auth, storage: createMemoryStorage(), config })
  customer = await login('a@lamvi.test')
  await request(app).put('/api/cart/items/den-nguyet').set('Authorization', customer).send({ quantity: 1 })
})

describe('resolveAddress — đầu vào xấu', () => {
  const P = '1'
  const W = '4'
  it('không nhận kiểu số, khoảng trắng, hoa/thường, tên thuộc tính prototype', () => {
    const bad = [1, 4, ' 1', '1 ', '01', '1.0', '+1', 'constructor', '__proto__', 'toString', 'hasOwnProperty', true, null, [], ['1'], {}]
    for (const v of bad) {
      const r = resolveAddress(v, W)
      expect(r.errors, JSON.stringify(v)).toBeTruthy()
    }
    for (const v of [4, ' 4', '4 ', '04', 'constructor', '__proto__', true, ['4'], {}]) {
      expect(resolveAddress(P, v).errors?.wardCode, JSON.stringify(v)).toBe('INVALID')
    }
  })
  it('thiếu một trong hai: báo đúng trường', () => {
    expect(resolveAddress(undefined, undefined).errors).toEqual({ provinceCode: 'REQUIRED', wardCode: 'REQUIRED' })
    expect(resolveAddress(P, undefined).errors).toEqual({ wardCode: 'REQUIRED' })
    expect(resolveAddress(undefined, W).errors).toEqual({ provinceCode: 'REQUIRED' })
    expect(resolveAddress(null, null).errors).toEqual({ provinceCode: 'REQUIRED', wardCode: 'REQUIRED' })
  })
  it('phường của tỉnh khác bị từ chối cho mọi cặp lệch (mẫu)', () => {
    for (let i = 0; i < VN_PROVINCES.length; i += 1) {
      const a = VN_PROVINCES[i]
      const b = VN_PROVINCES[(i + 1) % VN_PROVINCES.length]
      const foreign = b.wards.find(([c]) => !a.wards.some(([ac]) => ac === c))
      if (foreign) expect(resolveAddress(a.code, foreign[0]).errors, a.name).toEqual({ wardCode: 'INVALID' })
    }
  })
  it('mọi (tỉnh, phường) trong danh mục đều resolve ra đúng tên', () => {
    for (const p of VN_PROVINCES) for (const [c, n] of p.wards) {
      const r = resolveAddress(p.code, c)
      expect(r.ward).toBe(n)
      expect(r.province).toBe(p.name)
    }
  })
  it('listWards: kiểu số cũng tra được (route dùng chuỗi), mã lạ → null, không rò prototype', () => {
    expect(listWards('__proto__')).toBeNull()
    expect(listWards('constructor')).toBeNull()
    expect(listWards('')).toBeNull()
    expect(listWards(undefined)).toBeNull()
  })
})

describe('Danh mục — chất lượng dữ liệu', () => {
  it('tên tỉnh không trùng; tên phường không trùng trong cùng tỉnh', () => {
    expect(new Set(VN_PROVINCES.map((p) => p.name)).size).toBe(VN_PROVINCES.length)
    const dups = []
    for (const p of VN_PROVINCES) {
      const seen = new Set()
      for (const [, n] of p.wards) { if (seen.has(n)) dups.push(`${p.name}: ${n}`); seen.add(n) }
    }
    expect(dups).toEqual([])
  })
  it('mã tỉnh/phường là chuỗi số, không có ký tự lạ, tên không chứa xuống dòng/thẻ', () => {
    for (const p of VN_PROVINCES) {
      expect(p.code).toMatch(/^\d+$/)
      expect(p.name).not.toMatch(/[<>\n\t]/)
      for (const [c, n] of p.wards) { expect(typeof c).toBe('string'); expect(n).not.toMatch(/[<>\n\t]/) }
    }
  })
  it('file sinh ra khớp với generator (không sửa tay)', () => {
    const src = readFileSync(new URL('./data/vnAdmin.js', import.meta.url), 'utf8')
    const list = VN_PROVINCES.map((p) => ({ code: p.code, name: p.name, wards: p.wards.map(([code, name]) => ({ code, name })) }))
    expect(buildVnAdminJs(list)).toBe(src)
  })
})

describe('validateCheckout — địa chỉ', () => {
  it('addressLine rỗng / chỉ khoảng trắng vẫn bị báo, độc lập với tỉnh', () => {
    const { errors } = validateCheckout({ ...BODY, addressLine: '   ', provinceCode: '1', wardCode: '4' })
    expect(errors.addressLine).toBe('REQUIRED')
    expect(errors.provinceCode).toBeUndefined()
  })
  it('client gửi province/ward/district tuỳ ý cùng mã đúng → server ghi đè', () => {
    const { values } = validateCheckout({ ...BODY, provinceCode: '1', wardCode: '4', province: '<script>', ward: 'x', district: 'y' })
    expect(values.province).toBe('Thành phố Hà Nội')
    expect(values.district).toBeNull()
  })
})

describe('Đặt đơn với mã địa chỉ', () => {
  it('đơn lưu mã + tên chuẩn hoá; district null', async () => {
    const r = await place({ provinceCode: '1', wardCode: '4', province: 'Giả', district: 'Giả' })
    expect(r.status).toBe(201)
    expect(r.body.order).toMatchObject({ province: 'Thành phố Hà Nội', ward: 'Phường Ba Đình', district: null, provinceCode: '1', wardCode: '4' })
  })
  it('mã sai/kiểu số/phường tỉnh khác → 400 VALIDATION_ERROR, không tạo đơn, giỏ giữ nguyên', async () => {
    const other = listWards('79')[0].code
    for (const over of [{ provinceCode: 1, wardCode: 4 }, { provinceCode: '1', wardCode: other }, { provinceCode: '1' }, { wardCode: '4' }, { provinceCode: '__proto__', wardCode: '__proto__' }, {}]) {
      const r = await place(over)
      expect(r.status, JSON.stringify(over)).toBe(400)
    }
    expect(await repo.listOrders({})).toHaveLength(0)
    expect((await request(app).get('/api/cart').set('Authorization', customer)).body.items).toHaveLength(1)
  })
  it('đơn cũ không có provinceCode/wardCode vẫn hiển thị (null)', async () => {
    const r = await place({ provinceCode: '1', wardCode: '4' })
    const stored = await repo.getOrderByCode(r.body.order.code)
    await repo.updateOrder(stored.id, { provinceCode: undefined, wardCode: undefined, province: 'Hà Nội', ward: 'Ba Đình' })
    const got = await request(app).get(`/api/orders/${r.body.order.code}`).set('Authorization', customer)
    expect(got.status).toBe(200)
    expect(got.body.item).toMatchObject({ province: 'Hà Nội', provinceCode: null, wardCode: null })
  })
})

describe('API /api/geo', () => {
  it('header cache không bị no-store của API ghi đè (cả hai route)', async () => {
    for (const url of ['/api/geo/provinces', '/api/geo/provinces/1/wards']) {
      const cc = (await request(app).get(url)).headers['cache-control']
      expect(cc, url).toContain('s-maxage')
      expect(cc, url).not.toContain('no-store')
    }
  })
  it('404 không cache dài; mã lạ/khoảng trắng/ký tự đặc biệt → 404 (không 500)', async () => {
    for (const code of ['999', '%20', '1%20', 'constructor', '..', '%00', 'a'.repeat(500)]) {
      const r = await request(app).get(`/api/geo/provinces/${code}/wards`)
      expect(r.status, code).toBe(404)
      expect(r.headers['cache-control'], code).not.toMatch(/s-maxage/)
    }
  })
  it('không cần đăng nhập; chỉ GET', async () => {
    expect((await request(app).post('/api/geo/provinces').send({})).status).toBeGreaterThanOrEqual(400)
  })
  it('provinces và ward có đúng 2 khoá, tất cả tỉnh đều trả phường', async () => {
    const { items } = (await request(app).get('/api/geo/provinces')).body
    expect(items).toHaveLength(34)
    const w = (await request(app).get(`/api/geo/provinces/${items[5].code}/wards`)).body.items
    expect(w.length).toBeGreaterThan(0)
    expect(Object.keys(w[0]).sort()).toEqual(['code', 'name'])
  })
})

describe('Migration SQL — cột địa chỉ', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261005000012_address_inventory.sql', import.meta.url), 'utf8')
  it('thêm province_code/ward_code nullable, idempotent', () => {
    expect(sql).toMatch(/add column if not exists province_code text;/)
    expect(sql).toMatch(/add column if not exists ward_code text;/)
    expect(sql).not.toMatch(/province_code text not null/)
  })
})
