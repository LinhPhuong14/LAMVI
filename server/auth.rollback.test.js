// G-38: đăng ký lỗi ở bước ghi hồ sơ thì gỡ user vừa tạo
import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'

const body = { email: 'moi@moc.test', password: 'Gio-Hoa#Sen2026', fullName: 'Khách Mới' }

describe('Đăng ký: rollback khi ghi hồ sơ lỗi (G-38)', () => {
  it('upsertProfile lỗi → 500, user bị gỡ, đăng ký lại được', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    const auth = createMemoryAuth()
    const app = createApp({ repo, auth, config: { publicSiteUrl: 'https://moc.test' } })
    const real = repo.upsertProfile
    repo.upsertProfile = async () => {
      throw new Error('db down')
    }
    const bad = await request(app).post('/api/auth/register').send(body)
    expect(bad.status).toBe(500)
    repo.upsertProfile = real
    const ok = await request(app).post('/api/auth/register').send(body)
    expect(ok.status).toBe(201)
  })
})
