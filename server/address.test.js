// G-46, D-99: danh mục hành chính 2 cấp và địa chỉ giao hàng chuẩn hoá
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { VN_PROVINCES } from './data/vnAdmin.js'
import { listProvinces, listWards, resolveAddress } from './domain/address.js'
import { validateCheckout } from './domain/order.js'

const app = () => createApp({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://moc.test' } })

describe('Danh mục hành chính', () => {
  it('34 tỉnh/thành, mã không trùng, mọi tỉnh có phường/xã, mã phường/xã không trùng trong tỉnh', () => {
    expect(VN_PROVINCES).toHaveLength(34)
    expect(new Set(VN_PROVINCES.map((p) => p.code)).size).toBe(34)
    for (const p of VN_PROVINCES) {
      expect(p.wards.length, p.name).toBeGreaterThan(0)
      expect(new Set(p.wards.map((w) => w[0])).size, p.name).toBe(p.wards.length)
      for (const [code, name] of p.wards) {
        expect(code).toMatch(/^\d+$/)
        expect(name.trim()).toBe(name)
        expect(name).not.toBe('')
      }
    }
    expect(VN_PROVINCES.reduce((n, p) => n + p.wards.length, 0)).toBeGreaterThan(3000)
  })

  it('không còn cấp quận/huyện trong danh mục', () => {
    for (const p of VN_PROVINCES) for (const [, name] of p.wards) expect(name).not.toMatch(/^(Quận|Huyện)\b/)
  })
})

describe('resolveAddress', () => {
  it('tra tên từ mã, bỏ qua mọi tên client tự gửi', () => {
    expect(resolveAddress('1', '4')).toEqual({ province: 'Thành phố Hà Nội', ward: 'Phường Ba Đình', provinceCode: '1', wardCode: '4' })
  })
  it('thiếu / sai mã / phường thuộc tỉnh khác / sai kiểu', () => {
    expect(resolveAddress('', '4').errors).toEqual({ provinceCode: 'REQUIRED' })
    expect(resolveAddress('1', '').errors).toEqual({ wardCode: 'REQUIRED' })
    expect(resolveAddress('999', '4').errors.provinceCode).toBe('INVALID')
    const other = listWards('79')[0].code
    expect(resolveAddress('1', other).errors).toEqual({ wardCode: 'INVALID' })
    expect(resolveAddress(1, 4).errors).toEqual({ provinceCode: 'INVALID' })
    expect(resolveAddress({}, [])).toHaveProperty('errors')
    expect(resolveAddress('__proto__', 'constructor').errors.provinceCode).toBe('INVALID')
  })
  it('validateCheckout: địa chỉ do server chuẩn hoá, district luôn null, tên tự do bị bỏ', () => {
    const { values, errors } = validateCheckout({
      orderKind: 'self', recipientIsSelf: true, recipientName: 'A', recipientPhone: '0912345678', addressLine: '12 X',
      provinceCode: '1', wardCode: '4', province: 'Gõ bậy', ward: 'Gõ bậy', district: 'Quận 1', paymentMethod: 'cod',
    })
    expect(errors).toEqual({})
    expect(values).toMatchObject({ province: 'Thành phố Hà Nội', ward: 'Phường Ba Đình', district: null, provinceCode: '1', wardCode: '4' })
  })
  it('chỉ gửi tên tự do (kiểu cũ) → bị từ chối', () => {
    const { errors } = validateCheckout({ recipientName: 'A', province: 'Hà Nội', ward: 'Ba Đình' })
    expect(errors.provinceCode).toBe('REQUIRED')
    expect(errors.wardCode).toBe('REQUIRED')
  })
})

describe('API /api/geo', () => {
  it('GET /geo/provinces: công khai, cache được, chỉ mã + tên', async () => {
    const res = await request(app()).get('/api/geo/provinces')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toMatch(/public/)
    expect(res.body.items).toEqual(listProvinces())
    expect(Object.keys(res.body.items[0]).sort()).toEqual(['code', 'name'])
  })
  it('GET /geo/provinces/:code/wards; mã lạ → 404', async () => {
    const res = await request(app()).get('/api/geo/provinces/1/wards')
    expect(res.status).toBe(200)
    expect(res.body.items[0]).toEqual({ code: '4', name: 'Phường Ba Đình' })
    expect((await request(app()).get('/api/geo/provinces/999/wards')).status).toBe(404)
    expect((await request(app()).get('/api/geo/provinces/__proto__/wards')).status).toBe(404)
  })
})
