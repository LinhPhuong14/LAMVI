// Kiểm thử độc lập adapter cho Mây: OpenAI (fetch) và Supabase repo (rpc / chat_messages)
import { describe, expect, it, vi } from 'vitest'
import { createOpenAiClient } from './openai.js'
import { createSupabaseRepo } from './supabase/repo.js'

const jsonRes = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('createOpenAiClient', () => {
  const tools = [{ type: 'function', function: { name: 'get_faq', parameters: {} } }]
  const messages = [{ role: 'user', content: 'hi' }]

  it('POST tới {baseUrl}/chat/completions với Bearer, model, tools; map message + usage', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ choices: [{ message: { role: 'assistant', content: 'chào' } }], usage: { prompt_tokens: 12, completion_tokens: 3 } }),
    )
    const c = createOpenAiClient({ apiKey: 'sk-test', model: 'gpt-4o-mini', baseUrl: 'https://proxy.test/v1', fetchImpl })
    const ctrl = new AbortController()
    const r = await c.complete({ messages, tools, signal: ctrl.signal })
    expect(r).toEqual({ message: { role: 'assistant', content: 'chào' }, usage: { promptTokens: 12, completionTokens: 3 } })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://proxy.test/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-test', 'Content-Type': 'application/json' })
    expect(init.signal).toBe(ctrl.signal)
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ model: 'gpt-4o-mini', messages, tools, tool_choice: 'auto' })
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('baseUrl mặc định api.openai.com; model lộ ra, khoá không lộ trong object client', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ choices: [{ message: { role: 'assistant', content: 'x' } }] }))
    const c = createOpenAiClient({ apiKey: 'sk-secret', model: 'm', fetchImpl })
    await c.complete({ messages, tools })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
    expect(c.model).toBe('m')
    expect(JSON.stringify(c)).not.toContain('sk-secret')
  })

  it('thiếu usage/choices → usage 0, message rỗng (không ném)', async () => {
    const c = createOpenAiClient({ apiKey: 'k', model: 'm', fetchImpl: async () => jsonRes({}) })
    expect(await c.complete({ messages, tools })).toEqual({ message: { role: 'assistant', content: '' }, usage: { promptTokens: 0, completionTokens: 0 } })
  })

  it('HTTP lỗi (429, 500, 401) → ném Error openai_<status> kèm detail rút gọn, không chứa khoá', async () => {
    for (const status of [401, 429, 500]) {
      const c = createOpenAiClient({ apiKey: 'sk-secret', model: 'm', fetchImpl: async () => new Response('x'.repeat(1000), { status }) })
      const err = await c.complete({ messages, tools }).catch((e) => e)
      expect(err).toBeInstanceOf(Error)
      expect(err.message).toBe(`openai_${status}`)
      expect(err.status).toBe(status)
      expect(err.detail.length).toBeLessThanOrEqual(300)
      expect(JSON.stringify({ m: err.message, d: err.detail })).not.toContain('sk-secret')
    }
  })

  it('fetch bị huỷ (AbortError) / lỗi mạng → ném ra ngoài để service trả "ốm"', async () => {
    const ctrl = new AbortController()
    const fetchImpl = (url, init) =>
      new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
    const c = createOpenAiClient({ apiKey: 'k', model: 'm', fetchImpl })
    const p = c.complete({ messages, tools, signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    const c2 = createOpenAiClient({ apiKey: 'k', model: 'm', fetchImpl: async () => Promise.reject(new TypeError('fetch failed')) })
    await expect(c2.complete({ messages, tools })).rejects.toThrow('fetch failed')
  })

  it('JSON trả về hỏng → ném', async () => {
    const c = createOpenAiClient({ apiKey: 'k', model: 'm', fetchImpl: async () => new Response('<html>', { status: 200 }) })
    await expect(c.complete({ messages, tools })).rejects.toThrow()
  })
})

// Client Supabase giả: ghi lại rpc / from(...) chuỗi lời gọi
function fakeClient({ rpc = {}, tables = {}, error = null } = {}) {
  const calls = { rpc: [], from: [] }
  return {
    calls,
    rpc(name, args) {
      calls.rpc.push([name, args])
      return Promise.resolve(error ? { data: null, error } : { data: rpc[name], error: null })
    },
    from(table) {
      const ops = []
      calls.from.push({ table, ops })
      let rows = [...(tables[table] ?? [])]
      const b = {
        select: (...a) => (ops.push(['select', ...a]), b),
        insert: (r) => (ops.push(['insert', r]), b),
        eq: (c, v) => (ops.push(['eq', c, v]), (rows = rows.filter((r) => r[c] === v)), b),
        order: (c, o) => (ops.push(['order', c, o]), b),
        limit: (n) => (ops.push(['limit', n]), b),
        maybeSingle: () => Promise.resolve(error ? { data: null, error } : { data: rows[0] ?? null, error: null }),
        then: (res, rej) => Promise.resolve(error ? { data: null, error } : { data: rows, error: null }).then(res, rej),
      }
      return b
    },
  }
}

describe('createSupabaseRepo — Mây', () => {
  it('incrementMayCounter gọi rpc may_increment(p_key, p_ttl_seconds) và trả số đếm', async () => {
    const client = fakeClient({ rpc: { may_increment: 7 } })
    expect(await createSupabaseRepo(client).incrementMayCounter('ip:abc:2026-09-28', 172800)).toBe(7)
    expect(client.calls.rpc).toEqual([['may_increment', { p_key: 'ip:abc:2026-09-28', p_ttl_seconds: 172800 }]])
  })

  it('addMayUsage gọi rpc may_add_usage; map hàng (mảng hoặc object), numeric chuỗi → số', async () => {
    const row = { month: '2026-09', requests: 3, prompt_tokens: '4010', completion_tokens: '2005', cost_usd: '0.012030' }
    for (const data of [row, [row]]) {
      const client = fakeClient({ rpc: { may_add_usage: data } })
      const u = await createSupabaseRepo(client).addMayUsage('2026-09', { promptTokens: 10, completionTokens: 5, costUsd: 0.00001 })
      expect(u).toEqual({ month: '2026-09', requests: 3, promptTokens: 4010, completionTokens: 2005, costUsd: 0.01203 })
      expect(client.calls.rpc[0]).toEqual(['may_add_usage', { p_month: '2026-09', p_prompt: 10, p_completion: 5, p_cost: 0.00001 }])
    }
  })

  it('getMayUsage: có hàng → map; không có → số 0', async () => {
    const client = fakeClient({ tables: { may_usage: [{ month: '2026-09', requests: 1, prompt_tokens: 5, completion_tokens: 6, cost_usd: '1.5' }] } })
    const repo = createSupabaseRepo(client)
    expect(await repo.getMayUsage('2026-09')).toEqual({ month: '2026-09', requests: 1, promptTokens: 5, completionTokens: 6, costUsd: 1.5 })
    expect(await repo.getMayUsage('2026-10')).toEqual({ month: '2026-10', requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 })
    expect(client.calls.from[0].ops).toContainEqual(['eq', 'month', '2026-09'])
  })

  it('appendChatMessages: insert snake_case; mảng rỗng → không gọi DB', async () => {
    const client = fakeClient()
    const repo = createSupabaseRepo(client)
    await repo.appendChatMessages([])
    expect(client.calls.from).toHaveLength(0)
    await repo.appendChatMessages([{ userId: 'u1', sessionId: 's1', role: 'user', kind: 'message', content: 'hi', lang: 'en' }])
    expect(client.calls.from[0].table).toBe('chat_messages')
    expect(client.calls.from[0].ops[0]).toEqual(['insert', [{ user_id: 'u1', session_id: 's1', role: 'user', kind: 'message', content: 'hi', lang: 'en' }]])
  })

  it('listChatMessages: lọc user_id, mới nhất trước + limit rồi đảo lại tăng dần; map camelCase', async () => {
    const rows = [
      { id: 3, user_id: 'u1', session_id: 's', role: 'assistant', kind: 'answer', content: 'c', lang: 'vi', created_at: '2026-09-28T03:00:02Z' },
      { id: 2, user_id: 'u1', session_id: 's', role: 'user', kind: 'message', content: 'b', lang: 'vi', created_at: '2026-09-28T03:00:01Z' },
      { id: 9, user_id: 'u2', session_id: 's', role: 'user', kind: 'message', content: 'khác', lang: 'vi', created_at: '2026-09-28T03:00:03Z' },
    ]
    const client = fakeClient({ tables: { chat_messages: rows } })
    const items = await createSupabaseRepo(client).listChatMessages('u1', { limit: 50 })
    expect(items.map((m) => m.content)).toEqual(['b', 'c'])
    expect(items[0]).toEqual({ id: 2, userId: 'u1', sessionId: 's', role: 'user', kind: 'message', content: 'b', lang: 'vi', createdAt: '2026-09-28T03:00:01Z' })
    const ops = client.calls.from[0].ops
    expect(ops).toContainEqual(['eq', 'user_id', 'u1'])
    expect(ops).toContainEqual(['order', 'created_at', { ascending: false }])
    expect(ops).toContainEqual(['limit', 50])
  })

  it('lỗi Supabase → ném (để service xử lý)', async () => {
    const repo = createSupabaseRepo(fakeClient({ error: { code: 'XX000', message: 'boom' } }))
    await expect(repo.incrementMayCounter('k', 1)).rejects.toMatchObject({ message: 'boom' })
    await expect(repo.addMayUsage('m', { promptTokens: 0, completionTokens: 0, costUsd: 0 })).rejects.toMatchObject({ message: 'boom' })
    await expect(repo.getMayUsage('m')).rejects.toMatchObject({ message: 'boom' })
    await expect(repo.listChatMessages('u')).rejects.toMatchObject({ message: 'boom' })
    await expect(repo.appendChatMessages([{ userId: 'u' }])).rejects.toMatchObject({ message: 'boom' })
  })
})
