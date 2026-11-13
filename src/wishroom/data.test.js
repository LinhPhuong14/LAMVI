import { describe, expect, it } from 'vitest'
import {
  IMPLEMENTED_OCCASIONS,
  SAMPLE_ANNIVERSARY_WISH,
  SAMPLE_BIRTHDAY_WISH,
  SAMPLE_JUSTBECAUSE_WISH,
  SAMPLE_TEXT_WISH,
  SAMPLE_VIDEO_WISH,
  getSampleWish,
} from './data.js'

describe('getSampleWish', () => {
  it('trả đúng mẫu theo key hợp lệ (?mau=)', () => {
    expect(getSampleWish('chu')).toBe(SAMPLE_TEXT_WISH)
    expect(getSampleWish('video')).toBe(SAMPLE_VIDEO_WISH)
    expect(getSampleWish('sinhnhat')).toBe(SAMPLE_BIRTHDAY_WISH)
    expect(getSampleWish('kyniem')).toBe(SAMPLE_ANNIVERSARY_WISH)
    expect(getSampleWish('batchot')).toBe(SAMPLE_JUSTBECAUSE_WISH)
  })

  it('key không hợp lệ hoặc thiếu → rơi về mẫu thư chữ, không crash', () => {
    expect(getSampleWish('khong-ton-tai')).toBe(SAMPLE_TEXT_WISH)
    expect(getSampleWish(undefined)).toBe(SAMPLE_TEXT_WISH)
    expect(getSampleWish(null)).toBe(SAMPLE_TEXT_WISH)
    expect(getSampleWish('')).toBe(SAMPLE_TEXT_WISH)
  })
})

describe('IMPLEMENTED_OCCASIONS', () => {
  it('đúng 3 dịp có giao diện riêng ở đợt này (§21.9)', () => {
    expect(IMPLEMENTED_OCCASIONS).toEqual(['birthday', 'anniversary', 'justBecause'])
  })

  it('occasion của mẫu chữ/video KHÔNG thuộc danh sách đã làm (rơi về P.S. thường)', () => {
    expect(IMPLEMENTED_OCCASIONS).not.toContain(SAMPLE_TEXT_WISH.occasion)
    expect(IMPLEMENTED_OCCASIONS).not.toContain(SAMPLE_VIDEO_WISH.occasion)
  })
})
