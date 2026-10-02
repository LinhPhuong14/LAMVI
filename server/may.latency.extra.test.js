import { describe, expect, it } from 'vitest'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMayService } from './may/service.js'
import { MAY_SETTING_KEY } from './may/config.js'

const multiCall = () => ({
  message: {
    role: 'assistant',
    content: null,
    tool_calls: [
      { id: 'a', type: 'function', function: { name: 'get_faq', arguments: '{}' } },
      { id: 'b', type: 'function', function: { name: 'get_products', arguments: '{}' } },
    ],
  },
  usage: { promptTokens: 10, completionTokens: 5 },
})

describe('Mây: giảm độ trễ', () => {
  it('nhiều tool trong một lượt: giữ thứ tự tool_call_id khi gửi lại cho OpenAI', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true }, null)
    const seen = []
    let n = 0
    const openai = {
      async complete({ messages }) {
        seen.push(messages)
        return n++ === 0 ? multiCall() : { message: { role: 'assistant', content: 'Xin chào' }, usage: { promptTokens: 1, completionTokens: 1 } }
      },
    }
    const may = createMayService({ repo, openai })
    const reply = await may.chat({ message: 'giá?', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    expect(reply.kind).toBe('answer')
    const tools = seen[1].filter((m) => m.role === 'tool').map((m) => m.tool_call_id)
    expect(tools).toEqual(['a', 'b'])
  })

  it('đã vượt hạn mức: không gọi OpenAI và vẫn trả "mệt"', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true, limits: { guestPerSession: 1 } }, null)
    let calls = 0
    const openai = { async complete() { calls++; return { message: { role: 'assistant', content: 'ok' }, usage: { promptTokens: 1, completionTokens: 1 } } } }
    const may = createMayService({ repo, openai })
    await may.chat({ message: 'a', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    const r = await may.chat({ message: 'b', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    expect(r.kind).toBe('tired')
    expect(calls).toBe(1)
  })

  const ok = { message: { role: 'assistant', content: 'ok' }, usage: { promptTokens: 1, completionTokens: 1 } }

  it('ngân sách hết: không gọi OpenAI, trả FAQ offline (resting)', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true, monthlyBudgetUsd: 1 }, null)
    repo.getMayUsage = async () => ({ costUsd: 5, promptTokens: 0, completionTokens: 0 })
    let calls = 0
    const may = createMayService({ repo, openai: { async complete() { calls++; return ok } } })
    const r = await may.chat({ message: 'hi', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    expect(r.kind).toBe('resting')
    expect(calls).toBe(0)
  })

  it('openai tắt: không đọc usage', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: false }, null)
    let reads = 0
    repo.getMayUsage = async () => { reads++; return { costUsd: 0 } }
    const may = createMayService({ repo, openai: { async complete() { return ok } } })
    const r = await may.chat({ message: 'hi', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    expect(r.kind).toBe('resting')
    expect(reads).toBe(0)
  })

  it('đọc usage lỗi: coi như hết ngân sách, không gọi OpenAI', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true }, null)
    repo.getMayUsage = async () => { throw new Error('db down') }
    let calls = 0
    const may = createMayService({ repo, openai: { async complete() { calls++; return ok } } })
    const r = await may.chat({ message: 'hi', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    expect(r.kind).toBe('resting')
    expect(calls).toBe(0)
  })

  it('overLimit ném lỗi và usage lỗi: không có unhandled rejection', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true }, null)
    repo.getMayUsage = async () => { throw new Error('usage down') }
    repo.incrementMayCounter = async () => { throw new Error('counter down') }
    const unhandled = []
    const h = (e) => unhandled.push(e)
    process.on('unhandledRejection', h)
    try {
      const may = createMayService({ repo, openai: { async complete() { return ok } } })
      await expect(may.chat({ message: 'hi', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })).rejects.toThrow('counter down')
      await new Promise((r) => setTimeout(r, 20))
    } finally {
      process.off('unhandledRejection', h)
    }
    expect(unhandled).toEqual([])
  })

  it('một tool lỗi, tool kia treo/lỗi muộn: kind sick, không unhandled rejection', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true }, null)
    let n = 0
    repo.listPublicFaq = undefined
    const origFaq = repo.listFaq
    let first = true
    // Tool đầu lỗi ngay, tool sau lỗi muộn
    repo.listProducts = async () => { await new Promise((r) => setTimeout(r, 10)); throw new Error('late') }
    repo.listFaq = async (...a) => { if (first) { first = false; throw new Error('early') } return origFaq?.(...a) }
    const unhandled = []
    const h = (e) => unhandled.push(e)
    process.on('unhandledRejection', h)
    try {
      const openai = { async complete() { return n++ === 0 ? multiCall() : ok } }
      const may = createMayService({ repo, openai })
      const r = await may.chat({ message: 'giá?', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
      expect(r.kind).toBe('sick')
      await new Promise((r) => setTimeout(r, 40))
    } finally {
      process.off('unhandledRejection', h)
    }
    expect(unhandled).toEqual([])
  })

  it('timeout khi tool song song treo: kind sick', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true }, null)
    repo.listProducts = () => new Promise(() => {})
    repo.listFaq = () => new Promise(() => {})
    let n = 0
    const openai = { async complete() { return n++ === 0 ? multiCall() : ok } }
    const may = createMayService({ repo, openai, timeoutMs: 30 })
    const r = await may.chat({ message: 'giá?', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    expect(r.kind).toBe('sick')
  })
})
