import { createHash } from 'node:crypto'
import { HttpError } from '../errors.js'

// G-20: chống dò/spam ở tầng ứng dụng cho đăng nhập, đăng ký, quên mật khẩu và tạo đơn.
//
// Trên serverless mỗi request có thể rơi vào một tiến trình khác nhau, nên bộ đếm phải nằm ở DB.
// Dùng lại `repo.incrementMayCounter(key, ttl)` — bộ đếm có hạn dùng, tăng nguyên tử (đã có cho
// hạn mức Mây, D-31). Trả về số lần trong cửa sổ hiện tại.
//
// NFR-PRV-002 / G-28: khoá đếm là băm của IP + email với muối riêng, không lưu IP hay email thô.

const hash = (value, salt) => createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 32)

/**
 * IP thật của khách. Sau proxy cần đặt TRUST_PROXY để Express đọc X-Forwarded-For.
 * Không xác định được → trả 'unknown' (một bộ đếm chung) thay vì chuỗi rỗng: chuỗi rỗng sẽ bị
 * `filter(Boolean)` loại và request đó **không bị giới hạn gì cả**.
 */
export const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown'

/**
 * @param {object} p
 * @param {object} p.repo
 * @param {string} p.salt muối băm (MAY_HASH_SALT)
 * @param {string} p.name tên nhóm giới hạn, vào khoá đếm
 * @param {number} p.max số lần tối đa trong cửa sổ
 * @param {number} p.windowSec độ dài cửa sổ (giây)
 * @param {(req: object) => string[]} [p.keys] các giá trị tính giới hạn riêng (mặc định: IP)
 * @param {boolean} [p.enabled]
 */
export function rateLimit({ repo, salt, name, max, windowSec, keys, enabled = true }) {
  return async function rateLimitMiddleware(req, res, next) {
    // Tắt bằng cấu hình (test), hoặc adapter không có bộ đếm → bỏ qua, không chặn luồng
    if (!enabled || !repo?.incrementMayCounter) return next()
    const values = (keys ? keys(req) : [clientIp(req)]).filter(Boolean)
    // Cửa sổ trượt theo khối: mỗi khối một khoá, hết khối là bộ đếm tự hết hạn
    const bucket = Math.floor(Date.now() / (windowSec * 1000))
    for (const v of values) {
      const count = await repo.incrementMayCounter(`rl:${name}:${hash(v, salt)}:${bucket}`, windowSec * 2)
      if (count > max) {
        res.set('Retry-After', String(windowSec))
        throw new HttpError(429, 'RATE_LIMITED', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.')
      }
    }
    next()
  }
}

/** Giới hạn theo IP và theo email cùng lúc (email để một IP đổi liên tục vẫn không dò được một tài khoản). */
export const byIpAndEmail = (req) => [
  `ip:${clientIp(req)}`,
  typeof req.body?.email === 'string' ? `em:${req.body.email.trim().toLowerCase()}` : '',
]
