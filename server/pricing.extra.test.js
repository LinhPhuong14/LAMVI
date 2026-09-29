// Kiểm thử độc lập (T-11) cho D-68…D-71: giá niêm yết đã gồm VAT + module tính giá đơn hàng.
// Tập trung vào edge case và tính nhất quán toàn repo mà server/pricing.test.js chưa phủ.
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRICING,
  couponDiscount,
  normalizePricingConfig,
  quoteOrder,
  vatFromGross,
} from './domain/pricing.js'
import { products } from './data/seed.js'
import vi from '../src/i18n/messages/vi.js'
import en from '../src/i18n/messages/en.js'
import zh from '../src/i18n/messages/zh.js'

const items = (...pairs) => pairs.map(([productId, unitPrice, quantity]) => ({ productId, unitPrice, quantity }))

const root = new URL('../', import.meta.url)

// Duyệt cây thư mục, trả về đường dẫn tương đối của các tệp khớp bộ lọc
const walk = (dir, filter, acc = [], prefix = '') => {
  for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const rel = `${prefix}${e.name}`
    if (e.isDirectory()) walk(`${dir}${e.name}/`, filter, acc, `${rel}/`)
    else if (filter(rel)) acc.push({ path: `${dir}${e.name}`, rel })
  }
  return acc
}

const readAll = (files) => files.map((f) => ({ ...f, text: readFileSync(new URL(f.path, root), 'utf8') }))

describe('Bất biến số học của bảng giá (BR-PRC-001, D-69)', () => {
  // PRNG cố định hạt giống để test lặp lại được
  const rnd = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648)

  it('netAmount + vatAmount === total và mọi số đều nguyên, với 300 đơn ngẫu nhiên', () => {
    const r = rnd(20260929)
    const types = ['percent', 'amount', 'free_shipping', null]
    for (let n = 0; n < 300; n += 1) {
      const lineCount = 1 + Math.floor(r() * 4)
      const list = Array.from({ length: lineCount }, (_, i) => [
        `p${i}`,
        Math.floor(r() * 2_000_000),
        1 + Math.floor(r() * 10),
      ])
      const type = types[Math.floor(r() * types.length)]
      const coupon = type ? { type, value: Math.floor(r() * 120), maxDiscount: Math.floor(r() * 500_000) } : null
      const config = { vatRate: Math.floor(r() * 30) / 100, shippingFee: Math.floor(r() * 80_000), freeShippingFrom: Math.floor(r() * 2_000_000) }
      const q = quoteOrder({ items: items(...list), coupon, config })

      expect(Number.isSafeInteger(q.total)).toBe(true)
      expect(Number.isSafeInteger(q.vatAmount)).toBe(true)
      expect(Number.isSafeInteger(q.netAmount)).toBe(true)
      expect(q.netAmount + q.vatAmount).toBe(q.total)
      expect(q.vatAmount).toBeGreaterThanOrEqual(0)
      expect(q.discount).toBeGreaterThanOrEqual(0)
      expect(q.discount).toBeLessThanOrEqual(q.subtotal)
      expect([0, normalizePricingConfig(config).shippingFee]).toContain(q.shippingFee)
      expect(q.total).toBe(q.subtotal - q.discount + q.shippingFee)
    }
  })

  it('số tiền rất lớn (trần giá 1 tỷ × 10 sản phẩm × 3 dòng) vẫn là số nguyên an toàn', () => {
    const q = quoteOrder({ items: items(['p1', 1_000_000_000, 10], ['p2', 1_000_000_000, 10], ['p3', 1_000_000_000, 10]) })
    expect(q.subtotal).toBe(30_000_000_000)
    expect(Number.isSafeInteger(q.total)).toBe(true)
    expect(Number.isSafeInteger(q.vatAmount)).toBe(true)
    expect(q.netAmount + q.vatAmount).toBe(q.total)
  })

  it('tổng âm hoặc thuế suất âm → VAT bằng 0, không bịa phí ship', () => {
    expect(vatFromGross(-100_000, 0.1)).toBe(0)
    expect(vatFromGross(100_000, -0.1)).toBe(0)
    const q = quoteOrder({ items: items(['p1', -100_000, 1]) })
    expect(q).toMatchObject({ shippingFee: 0, vatAmount: 0, freeShipping: false })
    expect(q.netAmount + q.vatAmount).toBe(q.total)
  })

  it('tổng nhỏ hơn một đơn vị thuế → VAT 0, phần chưa thuế bằng tổng', () => {
    expect(vatFromGross(1, 0.1)).toBe(0)
    expect(vatFromGross(5, 0.1)).toBe(0)
    expect(vatFromGross(6, 0.1)).toBe(1)
  })

  it('dòng hàng không còn bán (đơn giá null) không cộng vào tạm tính', () => {
    const q = quoteOrder({ items: [
      { productId: 'p1', unitPrice: 890_000, quantity: 1 },
      { productId: 'p2', unitPrice: null, quantity: 3 },
    ] })
    expect(q.subtotal).toBe(890_000)
    expect(Number.isSafeInteger(q.total)).toBe(true)
  })
})

describe('Biên ngưỡng miễn phí vận chuyển (D-70 / Q-11)', () => {
  const totalOf = (amount, coupon = null) => quoteOrder({ items: items(['p1', amount, 1]), coupon })

  it('999.999đ → vẫn thu phí; 1.000.000đ và 1.000.001đ → miễn phí', () => {
    expect(totalOf(999_999)).toMatchObject({ freeShipping: false, shippingFee: 30_000, total: 1_029_999 })
    expect(totalOf(1_000_000)).toMatchObject({ freeShipping: true, shippingFee: 0, total: 1_000_000 })
    expect(totalOf(1_000_001)).toMatchObject({ freeShipping: true, shippingFee: 0, total: 1_000_001 })
  })

  it('VAT tính cả trên phí ship: đơn 999.999đ có VAT lớn hơn đơn cùng giá được miễn ship', () => {
    expect(totalOf(999_999).vatAmount).toBe(93_636)
    expect(totalOf(1_000_000).vatAmount).toBe(90_909)
  })

  it('[ASSUMPTION] ngưỡng xét trên tạm tính SAU coupon: giảm 1đ là mất miễn phí ship', () => {
    const q = totalOf(1_000_000, { type: 'amount', value: 1 })
    expect(q.freeShipping).toBe(false)
    expect(q.total).toBe(1_000_000 - 1 + 30_000)
  })

  it('coupon miễn phí ship vẫn miễn khi đơn dưới ngưỡng, nhưng giỏ rỗng thì không có gì để miễn', () => {
    expect(totalOf(100_000, { type: 'free_shipping' })).toMatchObject({ freeShipping: true, shippingFee: 0, total: 100_000 })
    expect(quoteOrder({ items: [], coupon: { type: 'free_shipping' } })).toMatchObject({ freeShipping: false, shippingFee: 0, total: 0 })
  })
})

describe('Coupon — giá trị bất thường (D-71 / C-1…C-3, C-6)', () => {
  const lines = [
    { productId: 'p1', lineTotal: 600_000 },
    { productId: 'p2', lineTotal: 400_000 },
  ]

  it('giảm % vượt 100 → không giảm quá tiền hàng, khách vẫn phải trả phí ship', () => {
    expect(couponDiscount({ type: 'percent', value: 150 }, lines)).toBe(1_000_000)
    const q = quoteOrder({ items: items(['p1', 100_000, 1]), coupon: { type: 'percent', value: 150 } })
    expect(q.discount).toBe(100_000)
    expect(q.total).toBe(30_000)
    expect(q.netAmount + q.vatAmount).toBe(q.total)
  })

  it('giá trị giảm âm (% hoặc số tiền) → không giảm, không làm tăng tổng đơn', () => {
    expect(couponDiscount({ type: 'percent', value: -10 }, lines)).toBe(0)
    expect(couponDiscount({ type: 'amount', value: -50_000 }, lines)).toBe(0)
    const q = quoteOrder({ items: items(['p1', 890_000, 1]), coupon: { type: 'amount', value: -50_000 } })
    expect(q.total).toBe(890_000 + 30_000)
  })

  it('C-6: trần giảm bằng 0 → không giảm đồng nào; trần chỉ áp cho loại %', () => {
    expect(couponDiscount({ type: 'percent', value: 50, maxDiscount: 0 }, lines)).toBe(0)
    expect(couponDiscount({ type: 'amount', value: 300_000, maxDiscount: 0 }, lines)).toBe(300_000)
  })

  it('C-3: phạm vi sản phẩm — null/rỗng là toàn đơn, id lạ bị bỏ qua', () => {
    expect(couponDiscount({ type: 'percent', value: 10, productIds: null }, lines)).toBe(100_000)
    // [ASSUMPTION] mảng rỗng được hiểu là toàn đơn (giống null) — cần ghi vào spec §14
    expect(couponDiscount({ type: 'percent', value: 10, productIds: [] }, lines)).toBe(100_000)
    expect(couponDiscount({ type: 'percent', value: 10, productIds: ['p2', 'khong-ton-tai'] }, lines)).toBe(40_000)
    expect(couponDiscount({ type: 'amount', value: 500_000, productIds: ['p2'] }, lines)).toBe(400_000)
  })

  it('loại coupon không hợp lệ → không giảm (không được hiểu nhầm thành giảm số tiền)', () => {
    expect(couponDiscount({ type: 'buy_one_get_one', value: 300_000 }, lines)).toBe(0)
    expect(couponDiscount({ type: undefined, value: 300_000 }, lines)).toBe(0)
  })

  it('coupon thiếu/hỏng trường value → không giảm, bảng giá vẫn là số hữu hạn', () => {
    expect(couponDiscount({ type: 'percent' }, lines)).toBe(0)
    expect(couponDiscount({ type: 'amount', value: null }, lines)).toBe(0)
    const q = quoteOrder({ items: items(['p1', 890_000, 1]), coupon: { code: 'HONG', type: 'percent' } })
    expect(Number.isSafeInteger(q.total)).toBe(true)
    expect(q.total).toBe(890_000 + 30_000)
  })
})

describe('Cấu hình tính giá app_settings (key "pricing")', () => {
  it('kiểu dữ liệu hỏng ở mọi trường → về mặc định', () => {
    expect(normalizePricingConfig('pricing')).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig([])).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig(123)).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig({ vatRate: '0.1', shippingFee: '30000', freeShippingFrom: true })).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig({ vatRate: Infinity, shippingFee: Infinity, freeShippingFrom: -1 })).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig({ vatRate: -0.1 })).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig({ vatRate: 1 })).toEqual(DEFAULT_PRICING)
  })

  it('thuế suất 0 và gần 1 đều là giá trị hợp lệ', () => {
    expect(normalizePricingConfig({ vatRate: 0 }).vatRate).toBe(0)
    expect(normalizePricingConfig({ vatRate: 0.999 }).vatRate).toBe(0.999)
    const q0 = quoteOrder({ items: items(['p1', 500_000, 1]), config: { vatRate: 0 } })
    expect(q0).toMatchObject({ vatAmount: 0, netAmount: 530_000, total: 530_000 })
    const q1 = quoteOrder({ items: items(['p1', 500_000, 1]), config: { vatRate: 0.999 } })
    expect(q1.netAmount + q1.vatAmount).toBe(q1.total)
    expect(q1.vatAmount).toBeLessThan(q1.total)
  })

  it('phí ship 0 → không bao giờ cộng phí; ngưỡng 0 nghĩa là TẮT miễn phí ship theo ngưỡng', () => {
    expect(quoteOrder({ items: items(['p1', 100_000, 1]), config: { shippingFee: 0 } }).total).toBe(100_000)
    // [ASSUMPTION] freeShippingFrom = 0 hiện được hiểu là "không có ngưỡng miễn phí" — cần ghi vào spec §13
    const q = quoteOrder({ items: items(['p1', 100_000, 1]), config: { freeShippingFrom: 0 } })
    expect(q).toMatchObject({ freeShipping: false, shippingFee: 30_000 })
  })

  it('migration 006 nạp đúng giá trị mặc định vào app_settings', () => {
    const sql = readFileSync(new URL('supabase/migrations/20260929000006_pricing.sql', root), 'utf8')
    const json = sql.match(/values \('pricing', '(\{.*?\})'::jsonb\)/)[1]
    expect(normalizePricingConfig(JSON.parse(json))).toEqual(DEFAULT_PRICING)
  })
})

describe('Nhất quán sau khi đổi priceExclVat → price (D-68)', () => {
  const OLD_CAMEL = ['price', 'Excl', 'Vat'].join('')
  const OLD_SNAKE = ['price', 'excl', 'vat'].join('_')

  // Bỏ qua tệp test: test được phép nhắc tên cột cũ khi kiểm tra migration / adapter
  const sources = readAll([
    ...walk('server/', (r) => r.endsWith('.js') && !r.includes('.test.')),
    ...walk('src/', (r) => (r.endsWith('.js') || r.endsWith('.jsx')) && !r.includes('.test.')),
    ...walk('scripts/', (r) => r.endsWith('.js') && !r.includes('.test.')),
  ])

  it('không còn tên trường cũ trong mã nguồn server/src/scripts', () => {
    const hits = sources.filter((f) => f.text.includes(OLD_CAMEL) || f.text.includes(OLD_SNAKE))
    expect(hits.map((f) => f.path)).toEqual([])
  })

  it('migration: init giữ tên cột cũ, 006 đổi tên cột và ràng buộc; không migration nào sau đó dùng tên cũ', () => {
    const init = readFileSync(new URL('supabase/migrations/20260928000001_init.sql', root), 'utf8')
    expect(init).toMatch(new RegExp(`${OLD_SNAKE} integer not null check \\(${OLD_SNAKE} >= 0\\)`))
    const m006 = readFileSync(new URL('supabase/migrations/20260929000006_pricing.sql', root), 'utf8')
    expect(m006).toContain(`alter table public.products rename column ${OLD_SNAKE} to price;`)
    // Ràng buộc check không tên → Postgres đặt tên products_<cột>_check, phải đổi theo
    expect(m006).toContain(`rename constraint products_${OLD_SNAKE}_check to products_price_check;`)
    const later = walk('supabase/migrations/', (r) => r > '20260929000006_pricing.sql')
    for (const f of later) expect(readFileSync(new URL(f.path, root), 'utf8')).not.toContain(OLD_SNAKE)
  })

  it('seed.sql dùng cột price và khớp giá trong seed.js', () => {
    const sql = readFileSync(new URL('supabase/seed.sql', root), 'utf8')
    expect(sql).not.toContain(OLD_SNAKE)
    expect(sql).toContain('insert into public.products (id, slug, kind, status, price,')
    for (const p of products) {
      expect(Number.isInteger(p.price) && p.price > 0).toBe(true)
      expect(sql).toContain(`'${p.slug}',`)
      expect(sql).toMatch(new RegExp(`'${p.slug}'.*?, ${p.price},`))
    }
  })
})

describe('Câu chữ giá đã gồm VAT (BR-PRC-003, D-68)', () => {
  const FORBIDDEN = [['chưa', 'gồm VAT'].join(' '), ['excl', '. VAT'].join(''), ['不含', '增值税'].join('')]

  it('không còn câu chữ "giá chưa gồm VAT" ở bất kỳ ngôn ngữ nào trong mã nguồn', () => {
    const sources = readAll([
      ...walk('server/', (r) => r.endsWith('.js') && !r.includes('.test.')),
      ...walk('src/', (r) => (r.endsWith('.js') || r.endsWith('.jsx')) && !r.includes('.test.')),
    ])
    const hits = sources.flatMap((f) => FORBIDDEN.filter((s) => f.text.includes(s)).map((s) => `${f.path}: ${s}`))
    expect(hits).toEqual([])
  })

  it('cả vi/en/zh có key price.inclVat, không còn price.exclVat, nội dung nói tới VAT', () => {
    for (const [lang, m] of [['vi', vi], ['en', en], ['zh', zh]]) {
      expect(m.price, lang).toBeDefined()
      expect(Object.keys(m.price), lang).toEqual(['inclVat'])
      expect(String(m.price.inclVat), lang).toMatch(/VAT|增值税/)
    }
  })

  it('ghi chú ở giỏ hàng và tour của Mây đều nói giá đã gồm VAT', () => {
    for (const [lang, m] of [['vi', vi], ['en', en], ['zh', zh]]) {
      expect(String(m.cart.shippingNote), lang).toMatch(/VAT|增值税/)
      expect(m.may.tour.steps.some((s) => /VAT|增值税/.test(s)), lang).toBe(true)
    }
  })
})
