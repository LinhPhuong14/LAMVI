// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
const session = {
  accessToken: 'a1',
  refreshToken: 'r1',
  expiresAt: 9999999999,
  user: { id: 'admin', email: 'admin@lamvi.test' },
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})
const row = (id, status = 'requested') => ({
  id,
  orderCode: `LV-${id}`,
  reason: 'wrong_item',
  description: 'Wrong lamp delivered',
  status,
  items: [{ slug: 'lamp', quantity: 1 }],
})
it('admin can reach older requests, switch to approved and record manual resolution', async () => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  let resolved = false
  const fetch = mockApi({
    'GET /me': () => ({ body: { profile: { role: 'admin', preferredLocale: 'vi' } } }),
    'GET /admin/returns': (url) => ({
      body:
        url.searchParams.get('status') === 'approved'
          ? { items: resolved ? [] : [row('approved', 'approved')], nextCursor: null }
          : url.searchParams.has('cursor')
            ? { items: [row('older')], nextCursor: null }
            : { items: [row('newest')], nextCursor: 'oldercursor' },
    }),
    'POST /admin/returns/approved/resolve': (_, init) => {
      expect(JSON.parse(init.body)).toEqual({ resolution: 'refund', note: 'Refund completed manually' })
      resolved = true
      return { body: { item: { status: 'resolved' } } }
    },
  })
  renderAt('/admin/returns')
  expect(await screen.findByRole('link', { name: 'LV-newest' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Giao sai hàng' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(await screen.findByRole('link', { name: 'LV-older' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'approved' } })
  expect(await screen.findByRole('link', { name: 'LV-approved' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Kết quả xử lý thủ công'), { target: { value: 'refund' } })
  fireEvent.change(screen.getByLabelText('Lý do / hướng xử lý'), { target: { value: 'Refund completed manually' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu quyết định' }))
  await waitFor(() => expect(screen.getByText('Không có yêu cầu trong trạng thái này.')).toBeInTheDocument())
  expect(fetch.mock.calls.some(([url]) => String(url).includes('/resolve'))).toBe(true)
})
it('failed queue shows retry and then empty state after recovery', async () => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  let fail = true
  mockApi({
    'GET /me': () => ({ body: { profile: { role: 'admin' } } }),
    'GET /admin/returns': () =>
      fail ? { status: 503, body: { error: { code: 'UNAVAILABLE' } } } : { body: { items: [], nextCursor: null } },
  })
  renderAt('/admin/returns')
  expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Không có yêu cầu trong trạng thái này.')).toBeInTheDocument()
})
