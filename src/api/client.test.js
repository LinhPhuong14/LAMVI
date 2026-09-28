import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client.js'

const jsonRes = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function stubFetch(impl) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('ghép ?lang= khi path chưa có query', async () => {
    const f = stubFetch(async () => jsonRes(200, { ok: 1 }))
    await api('/products', { lang: 'en' })
    expect(f.mock.calls[0][0]).toBe('/api/products?lang=en')
  })

  it('ghép &lang= khi path đã có query', async () => {
    const f = stubFetch(async () => jsonRes(200, { ok: 1 }))
    await api('/products?kind=set', { lang: 'zh' })
    expect(f.mock.calls[0][0]).toBe('/api/products?kind=set&lang=zh')
  })

  it('không có lang → không thêm tham số', async () => {
    const f = stubFetch(async () => jsonRes(200, { ok: 1 }))
    await api('/faq')
    expect(f.mock.calls[0][0]).toBe('/api/faq')
  })

  it('trả JSON khi 200', async () => {
    stubFetch(async () => jsonRes(200, { items: [1] }))
    await expect(api('/faq')).resolves.toEqual({ items: [1] })
  })

  it('lỗi mạng → ApiError NETWORK_ERROR, status 0', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const err = await api('/faq').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.status).toBe(0)
  })

  it('204 → null', async () => {
    stubFetch(async () => new Response(null, { status: 204 }))
    await expect(api('/x', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('body lỗi không phải JSON → INTERNAL_ERROR, giữ status', async () => {
    stubFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    const err = await api('/faq').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.status).toBe(502)
  })

  it('lỗi có code + fields → giữ nguyên', async () => {
    stubFetch(async () =>
      jsonRes(400, { error: { code: 'VALIDATION_ERROR', message: 'x', fields: { email: 'INVALID_EMAIL' } } }),
    )
    const err = await api('/auth/register', { method: 'POST', body: {} }).catch((e) => e)
    expect(err.status).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.fields).toEqual({ email: 'INVALID_EMAIL' })
  })

  it('404 không có body → INTERNAL_ERROR nhưng status 404', async () => {
    stubFetch(async () => new Response('', { status: 404 }))
    const err = await api('/products/x').catch((e) => e)
    expect(err.status).toBe(404)
  })

  it('gửi Authorization Bearer khi có token', async () => {
    const f = stubFetch(async () => jsonRes(200, {}))
    await api('/me', { token: 'abc.def' })
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer abc.def')
  })

  it('không gửi Authorization khi không có token; GET không có body/Content-Type', async () => {
    const f = stubFetch(async () => jsonRes(200, {}))
    await api('/products')
    const init = f.mock.calls[0][1]
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('có body → JSON.stringify + Content-Type application/json', async () => {
    const f = stubFetch(async () => jsonRes(200, {}))
    await api('/me', { method: 'PATCH', body: { fullName: 'Lan' }, token: 't' })
    const init = f.mock.calls[0][1]
    expect(init.method).toBe('PATCH')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ fullName: 'Lan' })
  })
})

it('200 nhưng body không phải JSON → INTERNAL_ERROR (không trả null)', async () => {
  const { api } = await import('./client.js')
  vi.stubGlobal('fetch', async () => new Response('<html></html>', { status: 200 }))
  await expect(api('/products')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 200 })
  vi.unstubAllGlobals()
})
