import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { parseSpecs, validateProduct } from './domain/admin.js'
import { presentSpecs } from './domain/catalog.js'

describe('parseSpecs (feedback 08/10, 33.5)', () => {
  it('null/rỗng → null; chỉ giữ khoá có nội dung', () => {
    expect(parseSpecs(null)).toEqual({ value: null })
    expect(parseSpecs({})).toEqual({ value: null })
    expect(parseSpecs({ size: { vi: '  ' } })).toEqual({ value: null })
    expect(parseSpecs({ size: { vi: '30 cm', en: '30 cm' }, care: { vi: 'Tránh ẩm' } })).toEqual({ value: { size: { vi: '30 cm', en: '30 cm' }, care: { vi: 'Tránh ẩm' } } })
  })

  it('khoá lạ, kiểu sai, thiếu tiếng Việt, quá dài → lỗi', () => {
    expect(parseSpecs({ color: { vi: 'đỏ' } }).error).toBe('INVALID')
    expect(parseSpecs([]).error).toBe('INVALID')
    expect(parseSpecs({ size: 'abc' }).error).toBe('INVALID')
    expect(parseSpecs({ size: { en: '30 cm' } }).error).toBe('VI_REQUIRED')
    expect(parseSpecs({ size: { vi: 'x'.repeat(201) } }).error).toBe('TOO_LONG')
  })

  it('validateProduct nhận specs ở PATCH một phần', () => {
    const { errors, values } = validateProduct({ specs: { material: { vi: 'Giấy dó' } } }, { partial: true })
    expect(errors).toEqual({})
    expect(values.specs).toEqual({ material: { vi: 'Giấy dó' } })
  })
})

describe('presentSpecs', () => {
  it('chọn ngôn ngữ, rơi về tiếng Việt, bỏ khoá rỗng', () => {
    const specs = { size: { vi: '30 cm', en: '30 cm tall' }, material: { vi: 'Giấy dó' } }
    expect(presentSpecs(specs, 'en')).toEqual({ size: '30 cm tall', material: 'Giấy dó' })
    expect(presentSpecs(null, 'vi')).toEqual({})
  })
})

describe('API: admin lưu specs, khách thấy specs theo ngôn ngữ', () => {
  it('PATCH specs → GET /api/products/:slug?lang=en', async () => {
    const repo = createMemoryRepo()
    const auth = createMemoryAuth()
    const { user } = await auth.signUp({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'Ad', role: 'admin' })
    const token = `Bearer ${(await auth.signIn({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
    const app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test' } })
    const p = (await repo.listProducts({ publishedOnly: true }))[0]
    const bad = await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ specs: { color: { vi: 'đỏ' } } })
    expect(bad.status).toBe(400)
    const ok = await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send({ specs: { size: { vi: 'Cao 30 cm', en: '30 cm tall' } } })
    expect(ok.status).toBe(200)
    const en = await request(app).get(`/api/products/${p.slug}?lang=en`)
    expect(en.body.item.specs).toEqual({ size: '30 cm tall' })
    const vi = await request(app).get(`/api/products/${p.slug}`)
    expect(vi.body.item.specs).toEqual({ size: 'Cao 30 cm' })
    const other = await request(app).get('/api/products')
    expect(other.body.items.find((x) => x.slug !== p.slug).specs).toEqual({})
  })
})
