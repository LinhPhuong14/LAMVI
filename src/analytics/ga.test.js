import { describe, expect, it } from 'vitest'
import {
  GA_EVENTS,
  gaInlineScript,
  gaScriptSrc,
  isValidMeasurementId,
  sanitizeParams,
  sanitizePath,
} from './ga.js'

describe('Measurement ID (FR-GA-001)', () => {
  it('nhận đúng dạng G-XXXXXXX', () => {
    expect(isValidMeasurementId('G-ABC1234567')).toBe(true)
    expect(isValidMeasurementId('G-1234')).toBe(true)
  })

  it('từ chối giá trị hỏng hoặc có ký tự chèn mã (nhúng vào <script> nội tuyến)', () => {
    for (const bad of [
      '',
      null,
      undefined,
      'UA-12345-1',
      'G-',
      'G-ABC"</script><script>alert(1)',
      'G-ABC 123',
      'G-ABC\n123',
      `G-${'A'.repeat(30)}`,
    ]) {
      expect(isValidMeasurementId(bad)).toBe(false)
    }
  })
})

describe('Làm sạch đường dẫn trước khi gửi GA (NFR-PRV-002)', () => {
  it('bỏ query và hash — có thể chứa token', () => {
    expect(sanitizePath('/products/den-nguyet?token=bimat#phan-1')).toBe('/products/den-nguyet')
    expect(sanitizePath('/?utm_source=fb')).toBe('/')
  })

  it('thay token của trang QR lời chúc bằng nhãn cố định, giữ tiền tố ngôn ngữ', () => {
    expect(sanitizePath('/qr/abc123secret')).toBe('/qr/:token')
    expect(sanitizePath('/en/qr/abc123secret')).toBe('/en/qr/:token')
    expect(sanitizePath('/zh/qr/abc123secret/xem')).toBe('/zh/qr/:token')
  })

  it('thay token đặt lại mật khẩu', () => {
    expect(sanitizePath('/reset-password/eyJhbGciOi')).toBe('/reset-password/:token')
  })

  it('mã lô KHÔNG bị che — là mã chung của mẻ đèn, không bí mật (D-43)', () => {
    expect(sanitizePath('/lo/LO-2026-01')).toBe('/lo/LO-2026-01')
  })

  it('đầu vào rỗng/không phải chuỗi → "/"', () => {
    expect(sanitizePath('')).toBe('/')
    expect(sanitizePath(null)).toBe('/')
    expect(sanitizePath(123)).toBe('/')
  })
})

describe('Làm sạch tham số sự kiện (NFR-PRV-002)', () => {
  it('giữ số, boolean, chuỗi ngắn', () => {
    expect(sanitizeParams({ item_id: 'den-nguyet', value: 890000, completed: true })).toEqual({
      item_id: 'den-nguyet',
      value: 890000,
      completed: true,
    })
  })

  it('cắt chuỗi dài để không lọt nội dung lời chúc/địa chỉ', () => {
    const out = sanitizeParams({ note: 'x'.repeat(500) })
    expect(out.note).toHaveLength(100)
  })

  it('bỏ object/array lồng nhau và số không hữu hạn', () => {
    expect(sanitizeParams({ user: { email: 'a@b.c' }, items: [1, 2], bad: NaN, inf: Infinity })).toEqual({})
  })

  it('bỏ tên tham số không hợp lệ', () => {
    expect(sanitizeParams({ 'Bad-Name': 1, _x: 2, '': 3, ok_1: 4 })).toEqual({ ok_1: 4 })
  })

  it('đầu vào không phải object → {}', () => {
    expect(sanitizeParams(null)).toEqual({})
    expect(sanitizeParams('x')).toEqual({})
  })
})

describe('Thẻ nhúng gtag', () => {
  it('src có id đã mã hoá URL', () => {
    expect(gaScriptSrc('G-ABC1234')).toBe('https://www.googletagmanager.com/gtag/js?id=G-ABC1234')
  })

  it('mã nội tuyến tắt page_view tự động (SPA gửi tay đường dẫn đã làm sạch)', () => {
    const js = gaInlineScript('G-ABC1234')
    expect(js).toContain('send_page_view:false')
    expect(js).toContain('"G-ABC1234"')
    expect(js).not.toContain('</script')
  })
})

describe('Danh sách sự kiện §23.3', () => {
  it('đủ 11 sự kiện đã chốt ở D-41 + login_view (feedback 08/10)', () => {
    expect(GA_EVENTS).toEqual([
      'view_item',
      'add_to_cart',
      'begin_checkout',
      'login_view',
      'purchase',
      'cancel_order',
      'open_qr_gift',
      'confirm_gift_received',
      'open_qr_batch',
      'mascot_open',
      'mascot_tour_complete',
      'mascot_error',
    ])
  })
})
