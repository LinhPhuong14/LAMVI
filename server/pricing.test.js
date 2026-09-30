import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRICING,
  couponDiscount,
  normalizePricingConfig,
  quoteOrder,
  vatFromGross,
} from './domain/pricing.js'

const items = (...pairs) => pairs.map(([productId, unitPrice, quantity]) => ({ productId, unitPrice, quantity }))

describe('Tách VAT ngược từ giá đã gồm thuế (D-68, D-69 / Q-09)', () => {
  it('VAT = tổng × 10% / 110%, làm tròn một lần ở tổng đơn', () => {
    // 1.100.000 đã gồm VAT 10% → VAT 100.000
    expect(vatFromGross(1_100_000, 0.1)).toBe(100_000)
    // 890.000 → 80.909,09… → 80.909
    expect(vatFromGross(890_000, 0.1)).toBe(80_909)
  })

  it('tổng 0 hoặc thuế suất 0 → VAT 0', () => {
    expect(vatFromGross(0, 0.1)).toBe(0)
    expect(vatFromGross(500_000, 0)).toBe(0)
  })

  it('phần chưa VAT + VAT luôn bằng đúng tổng (không lệch đồng nào)', () => {
    for (const gross of [1, 999, 890_000, 1_050_000, 1_680_000, 2_580_000, 3_333_333]) {
      const vat = vatFromGross(gross, 0.1)
      expect(vat).toBeLessThan(gross)
      expect(Number.isInteger(vat)).toBe(true)
    }
  })
})

describe('Cấu hình tính giá đọc từ app_settings', () => {
  it('thiếu / hỏng → dùng mặc định', () => {
    expect(normalizePricingConfig(null)).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig({ vatRate: 'x', shippingFee: -5, freeShippingFrom: NaN })).toEqual(DEFAULT_PRICING)
    expect(normalizePricingConfig({ vatRate: 1.5 })).toEqual(DEFAULT_PRICING)
  })

  it('giá trị hợp lệ được giữ, số tiền làm tròn về đồng', () => {
    expect(normalizePricingConfig({ vatRate: 0.08, shippingFee: 25_000.4, freeShippingFrom: 500_000 })).toEqual({
      vatRate: 0.08,
      shippingFee: 25_000,
      freeShippingFrom: 500_000,
    })
  })
})

describe('Phí vận chuyển (D-70 / Q-11): đồng giá 30.000đ, miễn phí từ 1.000.000đ', () => {
  it('dưới ngưỡng → thu phí', () => {
    const q = quoteOrder({ items: items(['p1', 890_000, 1]) })
    expect(q.shippingFee).toBe(30_000)
    expect(q.freeShipping).toBe(false)
    expect(q.total).toBe(920_000)
  })

  it('đúng ngưỡng 1.000.000đ → miễn phí', () => {
    const q = quoteOrder({ items: items(['p1', 500_000, 2]) })
    expect(q.shippingFee).toBe(0)
    expect(q.freeShipping).toBe(true)
    expect(q.total).toBe(1_000_000)
  })

  it('giỏ rỗng → không tính phí ship', () => {
    const q = quoteOrder({ items: [] })
    expect(q).toMatchObject({ subtotal: 0, shippingFee: 0, total: 0, vatAmount: 0, freeShipping: false })
  })
})

describe('Coupon (D-71 / C-1…C-3, C-6)', () => {
  const lines = [
    { productId: 'p1', lineTotal: 890_000 },
    { productId: 'p2', lineTotal: 210_000 },
  ]

  it('giảm %: tính trên tạm tính, làm tròn về đồng', () => {
    expect(couponDiscount({ type: 'percent', value: 10 }, lines)).toBe(110_000)
  })

  it('giảm % có trần (C-6) → không vượt trần', () => {
    expect(couponDiscount({ type: 'percent', value: 50, maxDiscount: 100_000 }, lines)).toBe(100_000)
  })

  it('giảm số tiền: không vượt quá tạm tính', () => {
    expect(couponDiscount({ type: 'amount', value: 50_000 }, lines)).toBe(50_000)
    expect(couponDiscount({ type: 'amount', value: 9_000_000 }, lines)).toBe(1_100_000)
  })

  it('C-3: coupon giới hạn sản phẩm chỉ giảm trên dòng hàng thuộc phạm vi', () => {
    expect(couponDiscount({ type: 'percent', value: 10, productIds: ['p2'] }, lines)).toBe(21_000)
    // Không có sản phẩm nào trong phạm vi → không giảm
    expect(couponDiscount({ type: 'amount', value: 50_000, productIds: ['p9'] }, lines)).toBe(0)
  })

  it('free_shipping không giảm tiền hàng, chỉ miễn phí ship', () => {
    expect(couponDiscount({ type: 'free_shipping', value: 0 }, lines)).toBe(0)
    const q = quoteOrder({ items: items(['p1', 500_000, 1]), coupon: { code: 'FREESHIP', type: 'free_shipping' } })
    expect(q.discount).toBe(0)
    expect(q.shippingFee).toBe(0)
    expect(q.total).toBe(500_000)
    expect(q.couponCode).toBe('FREESHIP')
  })

  it('không có coupon → không giảm', () => {
    expect(couponDiscount(null, lines)).toBe(0)
  })
})

describe('Bảng giá đơn hàng (BR-PRC-001)', () => {
  it('tổng = tạm tính − giảm giá + phí ship; VAT tách ngược từ tổng (gồm cả phí ship)', () => {
    const q = quoteOrder({
      items: items(['p1', 890_000, 1], ['p2', 105_000, 2]),
      coupon: { code: 'GIAM10', type: 'percent', value: 10 },
    })
    expect(q.subtotal).toBe(1_100_000)
    expect(q.discount).toBe(110_000)
    // 990.000 < 1.000.000 → vẫn thu phí ship
    expect(q.shippingFee).toBe(30_000)
    expect(q.total).toBe(1_020_000)
    expect(q.vatAmount).toBe(vatFromGross(1_020_000, 0.1))
    expect(q.netAmount + q.vatAmount).toBe(q.total)
  })

  it('coupon kéo tạm tính xuống dưới ngưỡng → mất miễn phí ship', () => {
    const q = quoteOrder({ items: items(['p1', 1_050_000, 1]), coupon: { type: 'amount', value: 100_000 } })
    expect(q.freeShipping).toBe(false)
    expect(q.total).toBe(1_050_000 - 100_000 + 30_000)
  })

  it('dòng hàng giữ đơn giá và thành tiền để chốt giá lúc tạo đơn (BR-PRC-002)', () => {
    const q = quoteOrder({ items: items(['p1', 890_000, 3]) })
    expect(q.lines).toEqual([{ productId: 'p1', unitPrice: 890_000, quantity: 3, lineTotal: 2_670_000 }])
  })

  it('thuế suất đổi trong cấu hình → VAT đổi theo, tổng không đổi', () => {
    const q = quoteOrder({ items: items(['p1', 1_100_000, 1]), config: { vatRate: 0.08 } })
    expect(q.total).toBe(1_100_000)
    expect(q.vatAmount).toBe(vatFromGross(1_100_000, 0.08))
  })
})
