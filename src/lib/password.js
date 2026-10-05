// Chính sách mật khẩu cơ bản (D-91). Hàm thuần, KHÔNG phụ thuộc gì: dùng chung cho server (kiểm bắt buộc)
// và giao diện (danh sách quy tắc hiện theo từng phím). Server luôn kiểm lại — giao diện chỉ để hướng dẫn.
//
// Cố ý chỉ có quy tắc cơ bản (PO yêu cầu): KHÔNG chặn mật khẩu "phổ biến"/dễ đoán hay đã lộ — những kiểm
// tra đó làm khách khó chịu hơn là an toàn hơn. Giới hạn trên 72 byte vì Supabase Auth dùng bcrypt.
//
// Mã lỗi (khớp `errors.*` ở i18n): PASSWORD_TOO_SHORT, PASSWORD_TOO_LONG, PASSWORD_WHITESPACE,
// PASSWORD_NEEDS_VARIETY, PASSWORD_MISMATCH (ô nhập lại, do route kiểm).

export const PASSWORD_MIN = 8
export const PASSWORD_MAX_BYTES = 72

const byteLength = (s) => new TextEncoder().encode(s).length

/**
 * Từng quy tắc đạt/chưa — để giao diện hiện danh sách. Thứ tự = thứ tự ưu tiên báo lỗi.
 * Chữ có dấu tiếng Việt tính là chữ thường/HOA.
 * @param {string} pw
 * @returns {{id: 'length'|'lower'|'upper'|'digit', code: string, ok: boolean}[]}
 */
export function passwordRules(pw) {
  const s = typeof pw === 'string' ? pw : ''
  return [
    { id: 'length', code: 'PASSWORD_TOO_SHORT', ok: [...s].length >= PASSWORD_MIN },
    { id: 'lower', code: 'PASSWORD_NEEDS_VARIETY', ok: /\p{Ll}/u.test(s) },
    { id: 'upper', code: 'PASSWORD_NEEDS_VARIETY', ok: /\p{Lu}/u.test(s) },
    { id: 'digit', code: 'PASSWORD_NEEDS_VARIETY', ok: /\p{Nd}/u.test(s) },
  ]
}

/**
 * Kiểm tra đầy đủ. Trả mã lỗi đầu tiên hoặc null.
 * `REQUIRED` khi rỗng/không phải chuỗi.
 */
export function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length === 0) return 'REQUIRED'
  if (byteLength(pw) > PASSWORD_MAX_BYTES) return 'PASSWORD_TOO_LONG'
  // Dấu cách đầu/cuối gần như luôn là lỗi dán nhầm, và gây khó hiểu khi đăng nhập
  if (pw !== pw.trim()) return 'PASSWORD_WHITESPACE'
  return passwordRules(pw).find((r) => !r.ok)?.code ?? null
}
