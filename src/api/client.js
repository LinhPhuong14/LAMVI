// T-05: frontend chỉ gọi API Express
export class ApiError extends Error {
  /** @param {object} [details] dữ liệu kèm lỗi (vd bảng giá mới khi giá đổi giữa chừng) */
  constructor(status, code, fields, details) {
    super(code)
    this.status = status
    this.code = code
    this.fields = fields
    this.details = details
  }
}

export async function api(path, { method = 'GET', body, token, lang } = {}) {
  const url = lang ? `${path}${path.includes('?') ? '&' : '?'}lang=${lang}` : path
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`/api${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => undefined)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code || 'INTERNAL_ERROR', data?.error?.fields, data?.error?.details)
  }
  // Phản hồi thành công nhưng không phải JSON (vd proxy trả HTML) → coi là lỗi
  if (data === undefined) throw new ApiError(res.status, 'INTERNAL_ERROR')
  return data
}
