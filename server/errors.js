export class HttpError extends Error {
  /**
   * @param {object} [details] dữ liệu kèm theo lỗi trả cho client (vd bảng giá mới khi giá đổi).
   *   Chỉ đặt dữ liệu client được phép thấy — nội dung này đi thẳng vào response.
   */
  constructor(status, code, message = code, fields, details) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
    this.details = details
  }
}

export const notFound = () => new HttpError(404, 'NOT_FOUND', 'Không tìm thấy')

// Postgres/PostgREST: bảng, cột hoặc hàm RPC chưa có (migration chưa chạy). Trả 503 có mã rõ để
// client giữ dữ liệu và dashboard IT thấy nguyên nhân, thay vì 500 mơ hồ (feedback 08/10 mục 6, 31, 32).
const SCHEMA_CODES = new Set(['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703', '42883'])

export function errorHandler(err, req, res, _next) {
  // Cho số liệu API (dashboard IT, D-52) — chỉ lưu phía server
  res.locals.errorCode = err?.code
  res.locals.errorMessage = err?.message
  if (err instanceof HttpError) {
    const body = { code: err.code, message: err.message }
    if (err.fields) body.fields = err.fields
    if (err.details) body.details = err.details
    return res.status(err.status).json({ error: body })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON không hợp lệ' } })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu quá lớn' } })
  }
  if (SCHEMA_CODES.has(err?.code)) {
    res.locals.errorCode = 'SCHEMA_OUTDATED'
    console.error(err)
    return res.status(503).json({ error: { code: 'SCHEMA_OUTDATED', message: 'Hệ thống đang cập nhật, vui lòng thử lại sau' } })
  }
  // Lỗi 4xx do Express/body-parser ném (vd URL percent-encoding hỏng)
  const status = err?.status ?? err?.statusCode
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'Yêu cầu không hợp lệ' } })
  }
  res.locals.errorCode = 'INTERNAL_ERROR'
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } })
}
