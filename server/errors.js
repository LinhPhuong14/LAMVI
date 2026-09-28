export class HttpError extends Error {
  constructor(status, code, message = code, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const notFound = () => new HttpError(404, 'NOT_FOUND', 'Không tìm thấy')

export function errorHandler(err, req, res, _next) {
  // Cho số liệu API (dashboard IT, D-52) — chỉ lưu phía server
  res.locals.errorCode = err?.code
  res.locals.errorMessage = err?.message
  if (err instanceof HttpError) {
    const body = { code: err.code, message: err.message }
    if (err.fields) body.fields = err.fields
    return res.status(err.status).json({ error: body })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON không hợp lệ' } })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu quá lớn' } })
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
