// Chính sách mật khẩu cơ bản (D-91): độ dài, chữ thường/HOA/số, dấu cách, giới hạn bcrypt.
// Cố ý KHÔNG có quy tắc "mật khẩu phổ biến/dễ đoán/đã lộ" (PO không muốn khắt khe).
import { describe, expect, it } from 'vitest'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN, checkPassword, passwordRules } from './password.js'

const ok = (pw) => expect(checkPassword(pw), String(pw)).toBeNull()
const bad = (pw, code) => expect(checkPassword(pw), String(pw)).toBe(code)

describe('Độ dài', () => {
  it(`tối thiểu ${PASSWORD_MIN} ký tự, đếm theo ký tự hiển thị (không theo UTF-16)`, () => {
    bad('Abcdef1', 'PASSWORD_TOO_SHORT') // 7
    ok('Abcdefg1') // 8
    bad('Ab1😀😀😀😀', 'PASSWORD_TOO_SHORT') // 7 ký tự dù 11 đơn vị UTF-16
  })

  it(`tối đa ${PASSWORD_MAX_BYTES} byte (giới hạn bcrypt của Supabase)`, () => {
    const p72 = `Ab1${'x'.repeat(69)}`
    expect(new TextEncoder().encode(p72).length).toBe(72)
    ok(p72)
    bad(`${p72}x`, 'PASSWORD_TOO_LONG')
    // chữ có dấu chiếm nhiều byte (3 byte/ký tự): 'Ệ1ab' + 22 × 'ệ' = đúng 72 byte, thêm một chữ là vượt
    ok(`Ệ1ab${'ệ'.repeat(22)}`)
    bad(`Ệ1ab${'ệ'.repeat(23)}`, 'PASSWORD_TOO_LONG')
  })

  it('rỗng / không phải chuỗi → REQUIRED', () => {
    for (const v of ['', undefined, null, 12345678, [], {}]) bad(v, 'REQUIRED')
  })

  it('dấu cách đầu/cuối bị từ chối; dấu cách ở giữa được giữ (passphrase)', () => {
    bad(' Gio-Hoa#Sen2026', 'PASSWORD_WHITESPACE')
    bad('Gio-Hoa#Sen2026 ', 'PASSWORD_WHITESPACE')
    bad('Gio-Hoa#Sen2026\n', 'PASSWORD_WHITESPACE')
    ok('Gio Hoa Sen 2026')
  })
})

describe('Chữ thường, chữ HOA, chữ số', () => {
  it('thiếu nhóm nào cũng báo PASSWORD_NEEDS_VARIETY', () => {
    bad('abcdefgh1', 'PASSWORD_NEEDS_VARIETY') // thiếu HOA
    bad('ABCDEFGH1', 'PASSWORD_NEEDS_VARIETY') // thiếu thường
    bad('Abcdefghi', 'PASSWORD_NEEDS_VARIETY') // thiếu số
    bad('12345678', 'PASSWORD_NEEDS_VARIETY')
  })

  it('đủ ba nhóm là đạt; ký tự đặc biệt không bắt buộc', () => {
    ok('Abcdefg1')
    ok('Abcdef1!')
  })

  it('chữ có dấu tiếng Việt tính là chữ thường/HOA', () => {
    ok('Đẹp-lắm-rồi-9')
    ok('ĐẸPlắm9x')
  })

  it('không khắt khe: mật khẩu hay gặp nhưng đủ quy tắc cơ bản vẫn được chấp nhận', () => {
    ok('Password1')
    ok('Matkhau123')
    ok('Qwerty123')
    ok('Aaaa1111b') // lặp ký tự vẫn được
    ok('Abcdef12') // dãy liên tiếp vẫn được
  })

  it('chữ số khác chữ Latin (Ả Rập, Devanagari) vẫn là chữ số', () => {
    ok('Abcdefg٣')
  })
})

describe('passwordRules (cho giao diện)', () => {
  it('bốn quy tắc theo thứ tự ưu tiên, đạt/chưa riêng từng cái', () => {
    const r = passwordRules('abc')
    expect(r.map((x) => x.id)).toEqual(['length', 'lower', 'upper', 'digit'])
    expect(Object.fromEntries(r.map((x) => [x.id, x.ok]))).toEqual({ length: false, lower: true, upper: false, digit: false })
  })

  it('chuỗi rỗng / sai kiểu: không quy tắc nào đạt', () => {
    for (const v of ['', undefined, null, 5]) expect(passwordRules(v).every((x) => !x.ok)).toBe(true)
  })

  it('mật khẩu tốt: mọi quy tắc đạt', () => {
    expect(passwordRules('Gio-Hoa#Sen2026').every((x) => x.ok)).toBe(true)
  })

  it('checkPassword trả mã của quy tắc đầu tiên không đạt', () => {
    expect(checkPassword('abcdefgh')).toBe(passwordRules('abcdefgh').find((x) => !x.ok).code)
  })
})
