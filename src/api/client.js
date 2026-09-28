// T-05: frontend chỉ gọi API Express
export class ApiError extends Error {
  constructor(status, code, fields) {
    super(code)
    this.status = status
    this.code = code
    this.fields = fields
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
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code || 'INTERNAL_ERROR', data?.error?.fields)
  }
  return data
}
