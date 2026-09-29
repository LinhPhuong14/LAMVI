// Cổng payOS (NFR-SEC-002, §15.1): chữ ký, bóc tách webhook, gọi API.
import { describe, expect, it, vi } from 'vitest'
import { createPayosClient, parseWebhook, signData, signaturePayload, verifySignature } from './adapters/payos.js'
import { generatePayosOrderCode } from './domain/order.js'

const KEY = 'checksum-key'

describe('Chuỗi ký (signaturePayload)', () => {
  it('khoá sắp xếp a→z, nối k=v bằng &', () => {
    expect(signaturePayload({ orderCode: 5, amount: 1000, description: 'x' })).toBe(
      'amount=1000&description=x&orderCode=5',
    )
  })

  it('thứ tự khoá trong object không ảnh hưởng chữ ký', () => {
    const a = { amount: 1, cancelUrl: 'c', description: 'd', orderCode: 2, returnUrl: 'r' }
    const b = { returnUrl: 'r', orderCode: 2, description: 'd', cancelUrl: 'c', amount: 1 }
    expect(signData(a, KEY)).toBe(signData(b, KEY))
  })

  it('null/undefined thành chuỗi rỗng; object/mảng thành JSON', () => {
    expect(signaturePayload({ a: null, b: undefined, c: [1, 2], d: { x: 1 } })).toBe('a=&b=&c=[1,2]&d={"x":1}')
  })

  it('khoá khác nhau → chữ ký khác nhau', () => {
    const data = { orderCode: 1, amount: 100 }
    expect(signData(data, KEY)).not.toBe(signData(data, 'khoa-khac'))
  })
})

describe('verifySignature', () => {
  const data = { orderCode: 1, amount: 100 }

  it('đúng khoá → true', () => {
    expect(verifySignature(data, signData(data, KEY), KEY)).toBe(true)
  })

  it('sai/thiếu/không phải chuỗi → false, không ném lỗi', () => {
    for (const sig of ['', null, undefined, 123, {}, 'abc', signData(data, 'khac')]) {
      expect(verifySignature(data, sig, KEY)).toBe(false)
    }
  })

  it('chữ ký đúng nhưng dữ liệu bị sửa → false (không sửa được số tiền)', () => {
    const sig = signData(data, KEY)
    expect(verifySignature({ ...data, amount: 999_999 }, sig, KEY)).toBe(false)
  })

  it('chữ ký dài/ngắn hơn không làm timingSafeEqual ném lỗi', () => {
    expect(() => verifySignature(data, 'a', KEY)).not.toThrow()
    expect(() => verifySignature(data, 'a'.repeat(500), KEY)).not.toThrow()
  })
})

describe('parseWebhook', () => {
  const ok = (data) => ({ code: '00', desc: 'success', data, signature: signData(data, KEY) })

  it('hợp lệ → bóc tách mã đơn, số tiền, trạng thái trả', () => {
    const r = parseWebhook(ok({ orderCode: 42, amount: 920_000, code: '00', reference: 'FT1' }), KEY)
    expect(r).toMatchObject({ ok: true, orderCode: 42, amount: 920_000, paid: true, reference: 'FT1' })
  })

  it('mã khác "00" → không coi là đã trả', () => {
    expect(parseWebhook(ok({ orderCode: 42, amount: 1, code: '01' }), KEY).paid).toBe(false)
  })

  it.each([
    ['body rỗng', null],
    ['body là mảng', []],
    ['thiếu data', { signature: 'x' }],
    ['data là mảng', { data: [], signature: 'x' }],
  ])('%s → INVALID_BODY', (_name, body) => {
    expect(parseWebhook(body, KEY)).toMatchObject({ ok: false, reason: 'INVALID_BODY' })
  })

  it('chữ ký sai → INVALID_SIGNATURE, không đọc tiếp dữ liệu', () => {
    const body = ok({ orderCode: 42, amount: 1, code: '00' })
    expect(parseWebhook({ ...body, signature: 'sai' }, KEY)).toMatchObject({ ok: false, reason: 'INVALID_SIGNATURE' })
  })

  it.each([
    [{ orderCode: 'abc', amount: 1 }, 'INVALID_ORDER_CODE'],
    [{ orderCode: 0, amount: 1 }, 'INVALID_ORDER_CODE'],
    [{ orderCode: -5, amount: 1 }, 'INVALID_ORDER_CODE'],
    [{ orderCode: 1e30, amount: 1 }, 'INVALID_ORDER_CODE'],
    [{ orderCode: 1, amount: 'nhieu' }, 'INVALID_AMOUNT'],
  ])('dữ liệu hỏng → %s', (data, reason) => {
    expect(parseWebhook(ok(data), KEY)).toMatchObject({ ok: false, reason })
  })
})

describe('createPayosClient', () => {
  const keys = { clientId: 'c', apiKey: 'k', checksumKey: KEY }

  it('thiếu bất kỳ khoá nào → null (dev chạy được, chỉ COD)', () => {
    expect(createPayosClient({ ...keys, clientId: null })).toBeNull()
    expect(createPayosClient({ ...keys, apiKey: '' })).toBeNull()
    expect(createPayosClient({ ...keys, checksumKey: undefined })).toBeNull()
  })

  it('tạo link: gửi đúng header khoá và chữ ký trên 5 trường theo tài liệu payOS', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: '00', data: { checkoutUrl: 'https://pay/1', paymentLinkId: 'p', qrCode: 'q' } }),
    }))
    const client = createPayosClient({ ...keys, fetchImpl })
    const r = await client.createPaymentLink({
      orderCode: 7,
      amount: 1000,
      description: 'LV2610-ABCDEF',
      returnUrl: 'https://x/ok',
      cancelUrl: 'https://x/huy',
      expiredAt: 1_800_000_000_000,
    })
    expect(r.checkoutUrl).toBe('https://pay/1')
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers).toMatchObject({ 'x-client-id': 'c', 'x-api-key': 'k' })
    const sent = JSON.parse(init.body)
    expect(sent.signature).toBe(
      signData(
        { amount: 1000, cancelUrl: 'https://x/huy', description: 'LV2610-ABCDEF', orderCode: 7, returnUrl: 'https://x/ok' },
        KEY,
      ),
    )
    // payOS nhận hạn dạng Unix giây
    expect(sent.expiredAt).toBe(1_800_000_000)
  })

  it('payOS trả mã lỗi → ném lỗi PAYMENT_GATEWAY_ERROR, không trả link rỗng', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ code: '20', desc: 'sai tham số' }) }))
    const client = createPayosClient({ ...keys, fetchImpl })
    await expect(client.createPaymentLink({ orderCode: 1, amount: 1 })).rejects.toMatchObject({
      code: 'PAYMENT_GATEWAY_ERROR',
    })
  })

  it('HTTP lỗi hoặc body không phải JSON → ném lỗi', async () => {
    const bad = createPayosClient({ ...keys, fetchImpl: async () => ({ ok: false, status: 500, json: async () => null }) })
    await expect(bad.getPaymentLink(1)).rejects.toMatchObject({ code: 'PAYMENT_GATEWAY_ERROR' })
  })
})

describe('Mã đơn gửi payOS', () => {
  it('là số nguyên dương an toàn của JS', () => {
    for (const t of ['2026-01-01T00:00:00Z', '2026-10-01T03:00:00Z', '2036-12-31T23:59:59Z']) {
      const code = generatePayosOrderCode(new Date(t))
      expect(Number.isSafeInteger(code)).toBe(true)
      expect(code).toBeGreaterThan(0)
    }
  })

  it('tăng dần theo thời gian và không trùng trong cùng mili-giây (phần ngẫu nhiên)', () => {
    const t = new Date('2026-10-01T03:00:00Z')
    expect(generatePayosOrderCode(new Date(t.getTime() + 1000))).toBeGreaterThan(generatePayosOrderCode(t))
    const codes = new Set(Array.from({ length: 200 }, () => generatePayosOrderCode(t)))
    expect(codes.size).toBeGreaterThan(1)
  })

  it('thời điểm trước mốc 2026 không sinh số âm', () => {
    expect(generatePayosOrderCode(new Date('2020-01-01T00:00:00Z'))).toBeGreaterThanOrEqual(0)
  })
})
