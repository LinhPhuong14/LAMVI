// Kiểm thử độc lập Mây tra đơn (FR-AI-004, BR-AI-002, US-008 AC-001…004, NFR-PRV-001) — bổ sung cho may.orders.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { createMayService } from './may/service.js'
import { runTool, LOOKUP_MAX_PER_HOUR } from './may/tools.js'
import { MAY_SETTING_KEY } from './may/config.js'
import { extractPhones, phoneKey, redactPii, unverifiedNumbers } from './may/guard.js'

const NOW = Date.parse('2026-10-05T03:00:00Z')
const HOUR = 3600_000
const PRIVATE = /Hàng Bạc|Nguyễn Văn A|0912345678|912345678|Lê Thị B|0987654321|Trần Phố/

let repo, auth, app, clock, openaiCalls

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
const item = { slug: 'den-a', name: { vi: 'Đèn A', en: 'Lamp A', zh: '灯A' }, unitPrice: 799000, quantity: 2, lineTotal: 1598000 }
const ctx = (over = {}) => ({ repo, lang: 'vi', now: NOW, failKey: 'k', ...over })

// OpenAI giả: gọi các tool theo kịch bản rồi trả câu trả lời dựng từ kết quả tool cuối
function fakeOpenAi(calls, answer) {
  let n = 0
  return {
    async complete({ messages }) {
      openaiCalls.push(JSON.stringify(messages))
      if (n === 0) {
        n++
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: calls.map((c, i) => ({ id: `c${i}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })),
          },
          usage: { promptTokens: 1, completionTokens: 1 },
        }
      }
      const tools = messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content))
      return { message: { role: 'assistant', content: answer(tools) }, usage: { promptTokens: 1, completionTokens: 1 } }
    },
  }
}

function buildApp(openai) {
  const may = createMayService({ repo, openai, now: () => clock, random: () => 0 })
  app = createApp({
    repo,
    auth,
    storage: createMemoryStorage(),
    config: { publicSiteUrl: 'https://moc.test' },
    may,
    maintenance: createMaintenance({ repo, ttlMs: 0 }),
  })
  return may
}

async function login(email) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role: 'customer' })
  const bearer = `Bearer ${(await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })).accessToken}`
  return { id: user.id, bearer }
}

const chat = (body, token) => {
  const r = request(app).post('/api/may/chat').send({ sessionId: 'sess-orders-01', lang: 'vi', ...body })
  return token ? r.set('Authorization', token) : r
}

beforeEach(async () => {
  clock = NOW
  openaiCalls = []
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  await repo.setSetting(MAY_SETTING_KEY, { openaiEnabled: true }, null)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Không lộ địa chỉ / SĐT / tên người nhận ở mọi đường (AC-004, NFR-PRV-001)', () => {
  beforeEach(async () => {
    await repo.createOrder(order({ recipientName: 'Lê Thị B', addressLine: '5 Trần Phố', recipientPhone: '0987654321' }), [item])
  })

  it('get_my_orders và lookup_order (đăng nhập hoặc SĐT) chỉ có đúng các trường cho phép', async () => {
    const mine = await runTool('get_my_orders', {}, ctx({ user: { id: 'u1' } }))
    const byUser = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ user: { id: 'u1' } }))
    const byPhone = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ phones: ['0987654321'] }))
    for (const out of [mine, byUser, byPhone]) {
      expect(JSON.stringify(out)).not.toMatch(PRIVATE)
      expect(JSON.stringify(out)).not.toMatch(/recipient|address|phone|userId/i)
    }
    expect(Object.keys(byUser.order).sort()).toEqual(['code', 'createdAt', 'currency', 'items', 'paymentMethod', 'paymentStatus', 'status', 'total'])
    expect(byUser.order.items).toEqual([{ name: 'Đèn A', quantity: 2 }])
    expect(byPhone.order).toEqual(byUser.order)
  })

  it('đường chat: prompt gửi OpenAI không có địa chỉ/SĐT/tên, kể cả SĐT gõ ở lượt trước', async () => {
    buildApp(fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-ABCDEFG' } }], ([t]) => `Đơn ${t.order.code}: ${t.order.status}`))
    const res = await chat({
      message: 'đơn LV2610-ABCDEFG tới đâu rồi',
      history: [{ role: 'user', content: 'sđt mình là 0987 654 321' }, { role: 'assistant', content: 'Bạn cho Mây mã đơn nha' }],
    }).expect(200)
    expect(res.body.reply).toMatchObject({ kind: 'answer', text: 'Đơn LV2610-ABCDEFG: confirmed' })
    expect(openaiCalls.length).toBeGreaterThan(0)
    expect(openaiCalls.join('')).not.toMatch(PRIVATE)
    expect(openaiCalls.join('')).not.toMatch(/0987\s?654\s?321/)
    expect(JSON.stringify(res.body)).not.toMatch(PRIVATE)
  })

  it('đường chat: SĐT gõ dạng +84 trong tin nhắn cũng bị che', async () => {
    buildApp(fakeOpenAi([], () => 'ok'))
    await chat({ message: 'gọi +84 987 654 321 hoặc (+84) 987654321 nha' }).expect(200)
    expect(openaiCalls.join('')).not.toMatch(/987\s?654\s?321/)
    expect(redactPii('+84 987 654 321')).toBe('[phone]')
  })
})

describe('Đăng nhập tra đơn qua POST /api/may/chat (AC-001, AC-002)', () => {
  let a, b
  beforeEach(async () => {
    a = await login('a@moc.test')
    b = await login('b@moc.test')
    await repo.createOrder(order({ code: 'LV2610-AAAAAA2', userId: a.id }), [item])
    await repo.createOrder(order({ code: 'LV2610-BBBBBB2', userId: b.id, status: 'shipping', recipientPhone: '0987654321' }), [item])
  })

  it('AC-001: get_my_orders trả trạng thái đúng DB, chỉ đơn của mình', async () => {
    buildApp(fakeOpenAi([{ name: 'get_my_orders' }], ([t]) => t.orders.map((o) => `${o.code} ${o.status}`).join('; ')))
    const res = await chat({ message: 'đơn của tôi tới đâu rồi' }, a.bearer).expect(200)
    expect(res.body.reply.text).toBe('LV2610-AAAAAA2 confirmed')
    expect(res.body.reply.text).not.toContain('BBBBBB2')
  })

  it('AC-002: hỏi mã đơn của người khác → not_found, không lộ gì, kể cả khi gõ đúng SĐT chủ đơn', async () => {
    const outs = []
    buildApp(
      fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-BBBBBB2' } }], ([t]) => {
        outs.push(t)
        return 'Mây không tìm thấy đơn này'
      }),
    )
    const res = await chat({ message: 'tra đơn LV2610-BBBBBB2 sđt 0987654321' }, a.bearer).expect(200)
    expect(outs).toEqual([{ error: 'not_found' }])
    expect(res.body.reply.text).toBe('Mây không tìm thấy đơn này')
    expect(openaiCalls.join('')).not.toContain('shipping')
    expect(openaiCalls.join('')).not.toContain('0987654321')
  })

  it('người đăng nhập đúng chủ đơn thấy trạng thái', async () => {
    buildApp(fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-BBBBBB2' } }], ([t]) => `${t.order.status}`))
    const res = await chat({ message: 'đơn LV2610-BBBBBB2' }, b.bearer).expect(200)
    expect(res.body.reply.text).toBe('shipping')
  })

  it('khách vãng lai gọi get_my_orders → login_required, không có đơn nào', async () => {
    const outs = []
    buildApp(fakeOpenAi([{ name: 'get_my_orders' }], ([t]) => (outs.push(t), 'Bạn đăng nhập giúp Mây nha')))
    await chat({ message: 'đơn của tôi' }).expect(200)
    expect(outs).toEqual([{ error: 'login_required' }])
  })
})

describe('Vãng lai: SĐT từ history, nhiều dạng (AC-003)', () => {
  beforeEach(async () => {
    await repo.createOrder(order(), [item])
  })

  it('SĐT ở lượt chat trước (history) vẫn dùng được; chỉ lấy từ lượt role=user', async () => {
    const outs = []
    buildApp(fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-ABCDEFG' } }], ([t]) => (outs.push(t), t.order ? 'confirmed' : 'không thấy')))
    const ok = await chat({
      message: 'mã đơn LV2610-ABCDEFG',
      history: [{ role: 'user', content: 'sđt 0912.345.678' }, { role: 'assistant', content: 'ok' }],
    }).expect(200)
    expect(ok.body.reply.text).toBe('confirmed')
    expect(outs[0].order.code).toBe('LV2610-ABCDEFG')
  })

  it('SĐT chỉ nằm trong lượt assistant không được tính (client không giả được bằng assistant)', async () => {
    const outs = []
    buildApp(fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-ABCDEFG' } }], ([t]) => (outs.push(t), 'x')))
    await chat({ message: 'mã đơn LV2610-ABCDEFG', history: [{ role: 'assistant', content: 'sđt 0912345678' }] }).expect(200)
    expect(outs[0]).toEqual({ error: 'need_phone' })
  })

  it.each([
    ['+84 912 345 678'],
    ['+84912345678'],
    ['(+84) 912345678'],
    ['84912345678'],
    ['0912 345 678'],
    ['0912.345.678'],
    ['0912-345-678'],
    ['  0912345678  '],
  ])('extractPhones/phoneKey chuẩn hoá %s', (raw) => {
    expect(extractPhones(`sđt ${raw} nhé`)).toEqual(['0912345678'])
  })

  it('SĐT không hợp lệ hoặc quá ngắn không được trích; trích 2 SĐT', () => {
    expect(extractPhones('mã LV2610-1234567 và 12345')).toEqual([])
    expect(extractPhones('0912345678 và 0987654321')).toEqual(['0912345678', '0987654321'])
    expect(phoneKey(null)).toBe('')
    expect(phoneKey(undefined)).toBe('')
  })

  it('đơn lưu SĐT dạng +84 hoặc có khoảng trắng vẫn khớp', async () => {
    await repo.createOrder(order({ code: 'LV2610-PLUS842', recipientPhone: '+84 912 345 678' }), [item])
    const out = await runTool('lookup_order', { code: 'LV2610-PLUS842' }, ctx({ phones: ['0912345678'] }))
    expect(out.order.code).toBe('LV2610-PLUS842')
  })
})

describe('Mã đơn: chuẩn hoá và đầu vào lạ', () => {
  beforeEach(async () => {
    await repo.createOrder(order(), [item])
  })
  const phones = ['0912345678']

  it.each([['lv2610-abcdefg'], ['  LV2610-ABCDEFG  '], ['\tlv2610-AbCdEfG\n']])('chấp nhận %j', async (code) => {
    const out = await runTool('lookup_order', { code }, ctx({ phones }))
    expect(out.order?.code).toBe('LV2610-ABCDEFG')
  })

  it.each([
    [{ code: null }],
    [{ code: undefined }],
    [{}],
    [null],
    [undefined],
    [{ code: { $ne: 'x' } }],
    [{ code: 123 }],
    [{ code: '' }],
    [{ code: 'LV2610-ABCDEFG extra' }],
    [{ code: "LV2610-' OR 1=1 --" }],
    [{ code: 'LV2610-ABCDEF' }],
    [{ code: 'LV2610-ABCDEFGH' }],
    [{ code: 'x'.repeat(5000) }],
  ])('args %j → not_found, không ném lỗi', async (args) => {
    const out = await runTool('lookup_order', args, ctx({ phones }))
    expect(out).toEqual({ error: 'not_found' })
  })

  it('tool lạ → unknown_function; get_my_orders bỏ qua args rác', async () => {
    expect(await runTool('delete_order', { code: 'LV2610-ABCDEFG' }, ctx())).toEqual({ error: 'unknown_function' })
    const out = await runTool('get_my_orders', { userId: 'u2' }, ctx({ user: { id: 'u1' } }))
    expect(out.orders.map((o) => o.code)).toEqual(['LV2610-ABCDEFG'])
  })

  it('arguments JSON hỏng từ model không làm sập chat', async () => {
    const openai = {
      async complete({ messages }) {
        if (!messages.some((m) => m.role === 'tool')) {
          return {
            message: { role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'lookup_order', arguments: '{bad json' } }] },
            usage: { promptTokens: 1, completionTokens: 1 },
          }
        }
        return { message: { role: 'assistant', content: 'Mây không tìm thấy' }, usage: { promptTokens: 1, completionTokens: 1 } }
      },
    }
    buildApp(openai)
    const res = await chat({ message: 'tra đơn giúp mình 0912345678' }).expect(200)
    expect(res.body.reply.kind).toBe('answer')
  })
})

describe('Hạn mức dò mã (BR-AI-002)', () => {
  beforeEach(async () => {
    await repo.createOrder(order(), [item])
  })
  const probe = (n, c) => {
    const rs = []
    return (async () => {
      for (let i = 0; i < n; i++) rs.push(await runTool('lookup_order', { code: `LV2610-PROBE${String(i).padStart(2, '0')}`.slice(0, 14) }, c))
      return rs
    })()
  }

  it(`đúng ${LOOKUP_MAX_PER_HOUR} lần đầu được trả lời, lần kế tiếp bị chặn`, async () => {
    const c = ctx({ phones: ['0912345678'], failKey: 'ip:A' })
    const first = await probe(LOOKUP_MAX_PER_HOUR, c)
    expect(first.every((r) => r.error === 'not_found')).toBe(true)
    expect(await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, c)).toEqual({ error: 'too_many_attempts' })
  })

  it('theo user: hai người không lẫn hạn mức', async () => {
    const u1 = ctx({ user: { id: 'u1' }, failKey: 'u:u1' })
    const u2 = ctx({ user: { id: 'u2' }, failKey: 'u:u2' })
    await probe(LOOKUP_MAX_PER_HOUR + 1, u1)
    expect(await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, u1)).toEqual({ error: 'too_many_attempts' })
    expect(await runTool('lookup_order', { code: 'LV2610-ZZZZZZ2' }, u2)).toEqual({ error: 'not_found' })
    const own = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ user: { id: 'u1' }, failKey: 'u:u1', now: NOW + HOUR }))
    expect(own.order.code).toBe('LV2610-ABCDEFG')
  })

  it('theo IP: hai IP không lẫn; user và IP là hai bộ đếm riêng', async () => {
    const ipA = ctx({ phones: ['0912345678'], failKey: 'ip:A' })
    const ipB = ctx({ phones: ['0912345678'], failKey: 'ip:B' })
    await probe(LOOKUP_MAX_PER_HOUR + 1, ipA)
    expect(await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ipA)).toEqual({ error: 'too_many_attempts' })
    expect((await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ipB)).order.code).toBe('LV2610-ABCDEFG')
    expect((await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ user: { id: 'u1' }, failKey: 'u:A' }))).order.code).toBe('LV2610-ABCDEFG')
  })

  it('reset sau 1 giờ; chưa đủ 1 giờ vẫn bị chặn', async () => {
    const at = (t) => ctx({ phones: ['0912345678'], failKey: 'ip:A', now: t })
    await probe(LOOKUP_MAX_PER_HOUR + 1, at(NOW))
    expect(await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, at(NOW + HOUR - 1000))).toEqual({ error: 'too_many_attempts' })
    const later = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, at(NOW + HOUR + 1000))
    expect(later.order.code).toBe('LV2610-ABCDEFG')
  })

  it('need_phone không tốn hạn mức', async () => {
    for (let i = 0; i < LOOKUP_MAX_PER_HOUR + 3; i++) {
      expect(await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ failKey: 'ip:C' }))).toEqual({ error: 'need_phone' })
    }
    const ok = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ phones: ['0912345678'], failKey: 'ip:C' }))
    expect(ok.order.code).toBe('LV2610-ABCDEFG')
  })

  it('qua chat: IP bị chặn dò sau hạn mức, người đăng nhập khác (cùng IP) không bị ảnh hưởng', async () => {
    const u = await login('c@moc.test')
    await repo.createOrder(order({ code: 'LV2610-CCCCCC2', userId: u.id }), [item])
    const outs = []
    buildApp(
      fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-NOPE222' } }], ([t]) => (outs.push(t), 'Mây không tìm thấy')),
    )
    for (let i = 0; i < LOOKUP_MAX_PER_HOUR + 1; i++) {
      // mỗi vòng cần fake OpenAI mới (đếm lượt gọi riêng) và session riêng để không dính hạn mức tin nhắn
      buildApp(fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-NOPE222' } }], ([t]) => (outs.push(t), 'Mây không tìm thấy')))
      await chat({ message: 'tra đơn LV2610-NOPE222 sđt 0912345678', sessionId: `sess-probe-${i}000` }).expect(200)
    }
    expect(outs.slice(0, LOOKUP_MAX_PER_HOUR).every((t) => t.error === 'not_found')).toBe(true)
    expect(outs.at(-1)).toEqual({ error: 'too_many_attempts' })
    buildApp(fakeOpenAi([{ name: 'lookup_order', args: { code: 'LV2610-CCCCCC2' } }], ([t]) => (outs.push(t), t.order ? 'confirmed' : 'không thấy')))
    const res = await chat({ message: 'đơn của tôi LV2610-CCCCCC2' }, u.bearer).expect(200)
    expect(res.body.reply.text).toBe('confirmed')
  })
})

describe('Trạng thái đơn và ngôn ngữ', () => {
  it('pending_payment quá hạn → cancelled; còn hạn / đúng thời điểm hết hạn', async () => {
    const mk = (code, exp, over = {}) =>
      repo.createOrder(order({ code, status: 'pending_payment', paymentMethod: 'payos', paymentExpiresAt: exp, ...over }), [item])
    await mk('LV2610-EXPIRE2', new Date(NOW - 1000).toISOString())
    await mk('LV2610-EXACT22', new Date(NOW).toISOString())
    await mk('LV2610-FUTURE2', new Date(NOW + 60_000).toISOString())
    await mk('LV2610-NOEXP22', undefined)
    const st = async (code) => (await runTool('lookup_order', { code }, ctx({ user: { id: 'u1' }, failKey: null }))).order.status
    expect(await st('LV2610-EXPIRE2')).toBe('cancelled')
    expect(await st('LV2610-EXACT22')).toBe('cancelled')
    expect(await st('LV2610-FUTURE2')).toBe('pending_payment')
    expect(await st('LV2610-NOEXP22')).toBe('pending_payment')
    const list = await runTool('get_my_orders', {}, ctx({ user: { id: 'u1' } }))
    expect(list.orders.find((o) => o.code === 'LV2610-EXPIRE2').status).toBe('cancelled')
  })

  it('đơn confirmed có paymentExpiresAt đã qua vẫn là confirmed', async () => {
    await repo.createOrder(order({ code: 'LV2610-PAID222', paymentMethod: 'payos', paymentStatus: 'paid', paymentExpiresAt: '2020-01-01T00:00:00Z' }), [item])
    const out = await runTool('lookup_order', { code: 'LV2610-PAID222' }, ctx({ user: { id: 'u1' } }))
    expect(out.order.status).toBe('confirmed')
  })

  it('tên sản phẩm theo ngôn ngữ vi/en/zh; thiếu bản dịch thì rơi về vi; tên chuỗi thuần giữ nguyên', async () => {
    await repo.createOrder(
      order({ code: 'LV2610-LANG222' }),
      [item, { ...item, slug: 'b', name: { vi: 'Đèn B' } }, { ...item, slug: 'c', name: 'Đèn C' }],
    )
    const names = async (lang) =>
      (await runTool('lookup_order', { code: 'LV2610-LANG222' }, ctx({ user: { id: 'u1' }, lang }))).order.items.map((i) => i.name)
    expect(await names('vi')).toEqual(['Đèn A', 'Đèn B', 'Đèn C'])
    expect(await names('en')).toEqual(['Lamp A', 'Đèn B', 'Đèn C'])
    expect(await names('zh')).toEqual(['灯A', 'Đèn B', 'Đèn C'])
  })

  it('đơn không có item không làm lỗi', async () => {
    await repo.createOrder(order({ code: 'LV2610-EMPTY22' }), [])
    const out = await runTool('lookup_order', { code: 'LV2610-EMPTY22' }, ctx({ user: { id: 'u1' } }))
    expect(out.order.items).toEqual([])
  })

  it('get_my_orders tối đa 5 đơn', async () => {
    for (let i = 0; i < 7; i++) await repo.createOrder(order({ code: `LV2610-MANY${i}22` }), [item])
    const out = await runTool('get_my_orders', {}, ctx({ user: { id: 'u1' } }))
    expect(out.orders.length).toBe(5)
  })

  it('người dùng chưa có đơn → danh sách rỗng', async () => {
    expect(await runTool('get_my_orders', {}, ctx({ user: { id: 'nobody' } }))).toEqual({ orders: [] })
  })
})

describe('unverifiedNumbers với mã đơn (BR-AI-003)', () => {
  it('chữ số trong mã đơn LV2610-… có trong tool output nên không bị chặn', async () => {
    await repo.createOrder(order(), [item])
    const out = await runTool('lookup_order', { code: 'LV2610-ABCDEFG' }, ctx({ user: { id: 'u1' } }))
    expect(unverifiedNumbers('Đơn LV2610-ABCDEFG tổng 799.000 đ', [out])).toEqual([])
    // mã đơn có phần chữ số dài
    const code = 'LV2610-1234567'
    await repo.createOrder(order({ code }), [item])
    const out2 = await runTool('lookup_order', { code }, ctx({ user: { id: 'u1' } }))
    expect(unverifiedNumbers(`Đơn ${code} tổng 799.000 đ`, [out2])).toEqual([])
  })

  it('mã đơn bịa hoặc số tiền sai vẫn bị chặn; not_found thì mọi mã đều bị chặn', () => {
    const out = { order: { code: 'LV2610-ABCDEFG', total: 799000 } }
    expect(unverifiedNumbers('Đơn LV2610-9999999', [out])).toEqual(['9999999'])
    expect(unverifiedNumbers('tổng 800.000 đ', [out])).toEqual(['800000'])
    expect(unverifiedNumbers('Đơn LV2610-1234567 đang giao', [{ error: 'not_found' }])).toEqual(['2610', '1234567'])
  })

  it('qua chat: trả lời có mã đơn đúng được giữ, mã bịa bị thay bằng câu "chưa biết"', async () => {
    await repo.createOrder(order(), [item])
    const u = await login('d@moc.test')
    await repo.createOrder(order({ code: 'LV2610-DDDDDD2', userId: u.id }), [item])
    buildApp(fakeOpenAi([{ name: 'get_my_orders' }], ([t]) => `Đơn ${t.orders[0].code} tổng ${t.orders[0].total}`))
    const good = await chat({ message: 'đơn của tôi' }, u.bearer).expect(200)
    expect(good.body.reply.kind).toBe('answer')
    expect(good.body.reply.text).toContain('LV2610-DDDDDD2')
    buildApp(fakeOpenAi([{ name: 'get_my_orders' }], () => 'Đơn LV2610-7654321 đang giao'))
    const bad = await chat({ message: 'đơn của tôi', sessionId: 'sess-orders-02' }, u.bearer).expect(200)
    expect(bad.body.reply.kind).toBe('unknown')
  })
})
