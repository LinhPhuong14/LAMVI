// Kiểm thử độc lập D-67: OpenAI của Mây mặc định bật; admin tắt được; thiếu khoá → FAQ offline.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { runHealthChecks } from './monitoring/health.js'
import { createMayService } from './may/service.js'
import { DEFAULT_MAY_CONFIG, MAY_SETTING_KEY, loadMayConfig } from './may/config.js'

const SID = 'sess-default-0001'
let repo, auth, openai, app, may, adminBearer, clock

function fakeOpenAi(script) {
  const calls = []
  return {
    calls,
    async complete({ messages }) {
      calls.push({ messages: structuredClone(messages) })
      return script[Math.min(calls.length - 1, script.length - 1)]()
    },
  }
}
const say = (content) => () => ({ message: { role: 'assistant', content }, usage: { promptTokens: 10, completionTokens: 5 } })

function build(script) {
  openai = script ? fakeOpenAi(script) : null
  may = createMayService({ repo, openai, now: () => clock, random: () => 0 })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://moc.test' }, may })
}
const chat = (body) => request(app).post('/api/may/chat').send({ sessionId: SID, lang: 'vi', ...body })
const getConfig = () => request(app).get('/api/admin/may/config').set('Authorization', adminBearer)
const putConfig = (body) => request(app).put('/api/admin/may/config').set('Authorization', adminBearer).send(body)
const health = async () => {
  const r = await runHealthChecks({ repo, auth, storage: createMemoryStorage(), config: {}, may, env: {} })
  return { overall: r.status, openai: r.checks.find((c) => c.name === 'openai') }
}

beforeEach(async () => {
  clock = Date.parse('2026-09-29T03:00:00Z')
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  const { user } = await auth.signUp({ email: 'admin@moc.test', password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: 'Admin', role: 'admin' })
  adminBearer = `Bearer ${(await auth.signIn({ email: 'admin@moc.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('D-67: mặc định bật', () => {
  it('hằng mặc định là true', () => {
    expect(DEFAULT_MAY_CONFIG.openaiEnabled).toBe(true)
  })

  it('cài mới + có khoá → gọi OpenAI đúng 1 lần', async () => {
    build([say('Chào bạn')])
    const res = await chat({ message: 'Xin chào' })
    expect(res.body.reply.kind).toBe('answer')
    expect(openai.calls).toHaveLength(1)
  })

  it('cài mới + không khoá → "nghỉ ngơi" kèm FAQ', async () => {
    build(null)
    const res = await chat({ message: 'Video lưu bao lâu?' })
    expect(res.status).toBe(200)
    expect(res.body.reply.kind).toBe('resting')
    expect(Array.isArray(res.body.reply.faq)).toBe(true)
  })

  it('đã lưu { openaiEnabled:false } → "nghỉ ngơi", OpenAI không bao giờ được gọi (nhiều lượt)', async () => {
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: false }, null)
    build([say('không được gọi')])
    for (const m of ['Xin chào', 'Giá đèn?', 'Lời chúc lưu bao lâu?']) {
      expect((await chat({ message: m })).body.reply.kind).toBe('resting')
    }
    expect(openai.calls).toHaveLength(0)
  })

  it('cấu hình đã lưu thiếu khoá openaiEnabled (chỉ ngân sách) → bật', async () => {
    await repo.setSetting(MAY_SETTING_KEY, { monthlyBudgetUsd: 5 }, null)
    expect((await loadMayConfig(repo)).openaiEnabled).toBe(true)
    build([say('Chào')])
    expect((await chat({ message: 'Xin chào' })).body.reply.kind).toBe('answer')
    expect(openai.calls).toHaveLength(1)
  })
})

describe('PUT /api/admin/may/config một phần không lật cờ', () => {
  it('cài mới: GET trả true; PUT chỉ ngân sách → vẫn true', async () => {
    build(null)
    expect((await getConfig()).body.config.openaiEnabled).toBe(true)
    const r = await putConfig({ monthlyBudgetUsd: 7 })
    expect(r.status).toBe(200)
    expect(r.body.config).toMatchObject({ openaiEnabled: true, monthlyBudgetUsd: 7 })
    expect((await repo.getSetting(MAY_SETTING_KEY)).value.openaiEnabled).toBe(true)
  })

  it('admin đã tắt; PUT chỉ ngân sách/kênh → vẫn false, OpenAI không được gọi', async () => {
    build([say('không được gọi')])
    expect((await putConfig({ openaiEnabled: false })).body.config.openaiEnabled).toBe(false)
    expect((await putConfig({ monthlyBudgetUsd: 9, supportChannel: { vi: 'Zalo' } })).body.config.openaiEnabled).toBe(false)
    expect((await putConfig({})).body.config.openaiEnabled).toBe(false)
    expect((await getConfig()).body.config.openaiEnabled).toBe(false)
    expect((await chat({ message: 'Xin chào' })).body.reply.kind).toBe('resting')
    expect(openai.calls).toHaveLength(0)
  })

  it('openaiEnabled sai kiểu ("false", null) → 400, không đổi', async () => {
    build(null)
    expect((await putConfig({ openaiEnabled: 'false' })).status).toBe(400)
    expect((await putConfig({ openaiEnabled: null })).status).toBe(400)
    expect((await getConfig()).body.config.openaiEnabled).toBe(true)
  })

  it('bật lại sau khi tắt → gọi OpenAI', async () => {
    build([say('Chào')])
    await putConfig({ openaiEnabled: false })
    await putConfig({ openaiEnabled: true })
    expect((await chat({ message: 'Xin chào' })).body.reply.kind).toBe('answer')
    expect(openai.calls).toHaveLength(1)
  })
})

describe('Health IT mặc định', () => {
  it('cài mới + có khoá → ok (không phải disabled), tổng ok', async () => {
    build([say('x')])
    const h = await health()
    expect(h.openai.status).toBe('ok')
    expect(h.overall).toBe('ok')
  })
  it('cài mới + không khoá → not_configured', async () => {
    build(null)
    expect((await health()).openai).toMatchObject({ status: 'not_configured', configured: false })
  })
})

describe('NFR-PRV-001 ở chế độ mặc định bật', () => {
  it('SĐT/email trong câu hỏi và lịch sử bị che trước khi gửi OpenAI', async () => {
    build([say('Đã nhận')])
    await chat({
      message: 'Gọi mình 0912 345 678 hoặc mail khach@vd.vn',
      history: [
        { role: 'user', content: 'Số mình +84 912345678, email a.b@c.com' },
        { role: 'assistant', content: 'Dạ' },
      ],
    })
    expect(openai.calls).toHaveLength(1)
    const sent = JSON.stringify(openai.calls[0].messages)
    for (const pii of ['0912 345 678', 'khach@vd.vn', '912345678', 'a.b@c.com']) expect(sent).not.toContain(pii)
    expect(sent).toContain('[phone]')
    expect(sent).toContain('[email]')
  })
})
