import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { collections, faqEntries, products } from './data/seed.js'
import { SPEC_KEYS, parseSpecs } from './domain/admin.js'
import vi from '../src/i18n/messages/vi.js'
import en from '../src/i18n/messages/en.js'
import zh from '../src/i18n/messages/zh.js'

// D-104: seed thật = bộ sưu tập đầu tiên của LAMVI (5 đèn), lấy từ Content Plan + báo cáo đồ án.
const SLUGS = ['den-thu-hoach', 'den-tu-linh', 'den-phuc-loc-song-toan', 'den-ga-tam-duong-khai-thai', 'den-lon-dan']
const LANGS = ['vi', 'en', 'zh']

describe('Seed thật — bộ sưu tập đầu tiên (D-104)', () => {
  it('một bộ sưu tập, 5 đèn lẻ đúng thứ tự, không có gói "set" (không còn Q-05)', () => {
    expect(collections.map((c) => c.slug)).toEqual(['bo-suu-tap-dau-tien'])
    expect(products.map((p) => p.slug)).toEqual(SLUGS)
    expect(products.every((p) => p.kind === 'single' && p.collectionSlug === 'bo-suu-tap-dau-tien')).toBe(true)
    expect(products.map((p) => p.pieceOrder)).toEqual([1, 2, 3, 4, 5])
    expect(products.map((p) => p.sortOrder)).toEqual([1, 2, 3, 4, 5])
  })

  it('id và slug duy nhất; slug đúng định dạng', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(5)
    for (const p of products) expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('giá 1.400.000 đ [ASSUMPTION] nằm trong khoảng dự kiến 1,3–1,5 triệu của báo cáo', () => {
    for (const p of products) {
      expect(p.price).toBe(1400000)
      expect(p.price).toBeGreaterThanOrEqual(1300000)
      expect(p.price).toBeLessThanOrEqual(1500000)
    }
  })

  it('mỗi đèn có tên + mô tả đủ vi/en/zh, không rỗng', () => {
    for (const p of [...products, ...collections]) {
      for (const f of ['name', 'description']) for (const l of LANGS) expect(p[f][l]?.trim(), `${p.slug}.${f}.${l}`).toBeTruthy()
    }
    for (const c of collections) for (const f of ['storyTitle', 'story']) for (const l of LANGS) expect(c[f][l]?.trim()).toBeTruthy()
  })

  it('thông số hợp lệ theo parseSpecs: kích thước 20×12 cm, đế gỗ 5 cm; chưa bịa cân nặng/bảo quản', () => {
    for (const p of products) {
      const r = parseSpecs(p.specs)
      expect(r.error).toBeUndefined()
      expect(Object.keys(r.value).every((k) => SPEC_KEYS.includes(k))).toBe(true)
      expect(p.specs.size.vi).toContain('cao 20 cm')
      expect(p.specs.size.vi).toContain('đường kính 12 cm')
      expect(p.specs.size.vi).toContain('đế gỗ cao 5 cm')
      expect(p.specs.weight).toBeUndefined()
      expect(p.specs.care).toBeUndefined()
    }
  })

  it('FAQ: 9 câu, sortOrder liên tục, đủ vi/en/zh', () => {
    expect(faqEntries).toHaveLength(9)
    expect(faqEntries.map((f) => f.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(faqEntries.map((f) => f.id)).size).toBe(9)
    for (const f of faqEntries) for (const l of LANGS) {
      expect(f.question[l]?.trim()).toBeTruthy()
      expect(f.answer[l]?.trim()).toBeTruthy()
    }
  })

  it('supabase/seed.sql chứa đủ 5 đèn và thông số', () => {
    const sql = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8')
    for (const s of SLUGS) expect(sql).toContain(`'${s}'`)
    expect(sql).not.toContain('den-nguyet')
    expect(sql).toContain('specs')
  })
})

describe('Nội dung thật không còn ý "QR khắc trên đèn" (D-104)', () => {
  const FORBIDDEN = [/khắc (mã|QR)[^.]*(trên|lên) đèn/i, /mã khắc trên đèn/i, /engraved on the lantern/i, /engraved code/i, /灯上刻/, /刻上二维码/, /khắc QR(?!\s+hay)/i]
  const dump = (o, out = []) => {
    if (typeof o === 'string') out.push(o)
    else if (o && typeof o === 'object') Object.values(o).forEach((v) => dump(v, out))
    return out
  }
  it('i18n giao diện và FAQ không khẳng định QR được khắc trên đèn', () => {
    const texts = [...dump(vi), ...dump(en), ...dump(zh), ...dump(faqEntries), ...dump(products), ...dump(collections)]
    // Câu phủ định ("LAMVI không khắc QR lên đèn") là nội dung đúng, không tính
    const NEGATION = /không (đặt|khắc)|does not|not (place|engrave)|不会/i
    const sentences = texts.flatMap((t) => t.split(/(?<=[.。!?])\s*/))
    const hits = sentences.filter((t) => FORBIDDEN.some((re) => re.test(t)) && !NEGATION.test(t))
    expect(hits).toEqual([])
  })

  it('có nói rõ QR ở thiệp cảm ơn và LAMVI không khắc QR lên đèn', () => {
    expect(vi.qr.text).toContain('thiệp cảm ơn')
    expect(vi.qr.text).toContain('không khắc QR')
    expect(en.qr.text).toContain('thank-you card')
    expect(en.qr.text).toContain('does not engrave')
    expect(zh.qr.text).toContain('感谢卡')
  })

  it('5 tên lookbook = 5 đèn; 4 bước quy trình đủ ở cả 3 ngôn ngữ; số liệu mẫu cũ đã gỡ', () => {
    for (const m of [vi, en, zh]) {
      expect(m.lookbook.items).toHaveLength(5)
      expect(m.process.steps).toHaveLength(4)
      expect(m.process.steps.every((s) => s.label && s.note)).toBe(true)
      expect(m.artisan.years).toBeUndefined()
      expect(m.artisan.made).toBeUndefined()
      expect(m.story.statYears).toBeUndefined()
      expect(m.story.statArtisans).toBeUndefined()
    }
    expect(vi.artisan.name).toContain('Nguyễn Hữu Quả')
    expect(vi.artisan.quote).not.toMatch(/^[“"]/)
    expect(vi.artisan.name).not.toContain('Nguyễn Văn Tài')
  })
})
