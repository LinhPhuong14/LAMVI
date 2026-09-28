import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import AppRoutes from '../routes.jsx'
import AuthProvider from '../auth/AuthProvider.jsx'

// Giả lập fetch cho /api/*; handlers: { 'GET /products': (url, init) => ({ status, body }) }
export function mockApi(handlers) {
  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = new URL(input, 'http://localhost')
    const method = init.method || 'GET'
    const key = `${method} ${url.pathname.replace(/^\/api/, '')}`
    const handler = handlers[key]
    const { status = 200, body = {} } = handler ? await handler(url, init) : { status: 404, body: { error: { code: 'NOT_FOUND' } } }
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )
}
