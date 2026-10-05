import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runTool, LOOKUP_MAX_PER_HOUR } from './may/tools.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { extractPhones, phoneKey } from './may/guard.js'
import { createMayService } from './may/service.js'
import { MAY_SETTING_KEY } from './may/config.js'

let repo
const NOW = Date.parse('2026-10-05T03:00:00Z')

const order = (over = {}) => ({
  code: 'LV2610-ABCDEFG',
  userId: 'u1',
  status: 'confirmed',
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  total: 799000,
  recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678',
  addressLine: '12 Hàng Bạc',
  ...over,
})
const item = { slug: 'den-a', name: { vi: 'Đèn A', en: 'Lamp A' }, unitPrice: 799000, quantity: 1, lineTotal: 799000 }

beforeEach(async () => {
  repo = createMemoryRepo()
  await repo.createOrder(order(), [item])
  await repo.createOrder(order({ code: 'LV2610-ZZZZZZ2', userId: 'u2', recipientPhone: '0987654321' }), [item])
})

const ctx = (over = {}) => ({ repo, lang: 'vi', now: NOW, failKey: 'k', ...over })

describe('Mây tra đơn (FR-AI-004, BR-AI-002)', () => {
  it('get_my_orders: chỉ đơn của mình, không có địa chỉ/SĐT (AC-001, AC-004)', async () => {
    const out = await runTool('get_my_orders', {}, ctx({ user: { id: 'u1' } }))
    expect(out.orders).toHaveLength(1)
    expect(out.orders[0]).toMatchObject({ code: 'LV2610-ABCDEFG', status: 'confirmed', total: 799000 })
    expect(JSON.stringify(out)).not.toMatch(/Hàng Bạc|0912345678|Nguyễn/)
  })

  it('get_my_orders: khách vãng lai bị từ chối', async () => {
    expect(await runTool('get_my_orders', {}, ctx())).toEqual({ error: 'login_required' })
  })

  it('lookup_order: người đăng nhập hỏi đơn người khác → not_found (AC-002)', async () => {
    const out = await runTool('lookup_order', { code: 'LV2610-ZZZZZZ2' }, ctx({ user: { id: 'u1' } }))
    expect(out).toEqual({ error: 'not_found' })
  })

  it('lookup_order: vãng lai cần SĐT khớp (AC-003)', async () => {
    expect(await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx())).toEqual({ error: 'need_phone' })
    const bad = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ phones: ['0900000000'] }))
    expect(bad).toEqual({ error: 'not_found' })
    const ok = await runTool('lookup_order', { code: 'lv2610-abcdefg' }, ctx({ phones: ['0912345678'] }))
    expect(ok.order.code).toBe('LV2610-ABCDEFG')
    expect(JSON.stringify(ok)).not.toMatch(/0912345678|Hàng Bạc/)
  })

  it('mã không tồn tại và mã sai SĐT trả cùng một kết quả (không dò được)', async () => {
    const a = await runTool('lookup_order', { code: 'LV2610-NOPE222' }, ctx({ phones: ['0912345678'] }))
    const b = await runTool('lookup_order', { code: 'LV2610-ZZZZZZ2' }, ctx({ phones: ['0912345678'] }))
    expect(a).toEqual(b)
  })

  it('chặn dò mã đơn: quá hạn mức thì dừng, kể cả khi SĐT đúng', async () => {
    for (let i = 0; i < LOOKUP_MAX_PER_HOUR; i++) {
      await runTool('lookup_order', { code: `LV2610-AAAAA${i}2` }, ctx({ phones: ['0912345678'] }))
    }
    const out = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ phones: ['0912345678'] }))
    expect(out).toEqual({ error: 'too_many_attempts' })
  })

  it('đơn payOS quá hạn thanh toán hiển thị là đã huỷ (BR-PAY-003)', async () => {
    await repo.createOrder(
      order({ code: 'LV2610-PAYOS22', status: 'pending_payment', paymentMethod: 'payos', paymentExpiresAt: '2026-10-05T02:00:00Z' }),
      [item],
    )
    const out = await runTool('lookup_order', { code: 'LV2610-PAYOS22' }, ctx({ user: { id: 'u1' } }))
    expect(out.order.status).toBe('cancelled')
  })

  it('đọc SĐT các kiểu gõ', () => {
    expect(extractPhones('đơn LV2610-ABCDEFG sđt 0912 345 678')).toEqual(['0912345678'])
    expect(extractPhones('+84 912 345 678')).toEqual(['0912345678'])
    expect(phoneKey('+84912345678')).toBe('0912345678')
  })
})

describe('Mây tra đơn qua chat: SĐT không sang OpenAI', () => {
  it('SĐT bị che trong prompt nhưng vẫn đối chiếu được ở server', async () => {
    await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true }, null)
    const seen = []
    let n = 0
    const openai = {
      async complete({ messages }) {
        seen.push(JSON.stringify(messages))
        if (n++ === 0) {
          return {
            message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'lookup_order', arguments: '{"code":"LV2610-ABCDEFG"}' } }] },
            usage: { promptTokens: 1, completionTokens: 1 },
          }
        }
        const tool = JSON.parse(JSON.stringify(messages.at(-1).content))
        return { message: { role: 'assistant', content: `Đơn LV2610-ABCDEFG: ${JSON.parse(tool).order.status}` }, usage: { promptTokens: 1, completionTokens: 1 } }
      },
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const may = createMayService({ repo, openai, now: () => NOW, random: () => 0 })
    const reply = await may.chat({ message: 'đơn LV2610-ABCDEFG sđt 0912345678 tới đâu rồi', lang: 'vi', sessionId: 'sess-12345678', ip: '1.1.1.1' })
    expect(reply.kind).toBe('answer')
    expect(reply.text).toContain('confirmed')
    expect(seen.join('')).not.toContain('0912345678')
  })
})
