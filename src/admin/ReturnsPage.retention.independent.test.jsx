// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'admin', email: 'a@lamvi.test' } }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })
const row = (id, videoPurged) => ({ id, orderCode: `LV-${id}`, reason: 'wrong_item', description: 'd', status: 'resolved', items: [{ slug: 'lamp', quantity: 1 }], videoPurged })
it('hides preview button and shows note only when videoPurged', async () => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  mockApi({
    'GET /me': () => ({ body: { profile: { role: 'admin', preferredLocale: 'vi' } } }),
    'GET /admin/returns': () => ({ body: { items: [row('gone', true), row('kept', false)], nextCursor: null } }),
  })
  renderAt('/admin/returns')
  await screen.findByRole('link', { name: 'LV-gone' })
  expect(screen.getAllByRole('button', { name: 'Xem video riêng tư (5 phút)' })).toHaveLength(1)
  expect(screen.getAllByText(/Video đã xoá theo chính sách lưu 90 ngày/)).toHaveLength(1)
})
