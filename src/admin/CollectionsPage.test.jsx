// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
const c = { id: 'c1', slug: 'my-collection', status: 'draft', name: { vi: 'Bộ đã duyệt' }, story: { vi: 'Truyện' }, sortOrder: 0 }
beforeEach(() => { localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@test.com' } })) })
const me = () => ({ body: { profile: { id: 'u1', role: 'admin', preferredLocale: 'vi' } } })
it('edits reward translations with immutable slug and publishes using numeric sortOrder', async () => {
  let body
  mockApi({ 'GET /me': me, 'GET /admin/collections': () => ({ body: { items: [c] } }), 'PATCH /admin/collections/c1': (_u, init) => { body = JSON.parse(init.body); return { body: { item: c } } } })
  renderAt('/admin/collections')
  fireEvent.click(within((await screen.findByText('Bộ đã duyệt')).closest('tr')).getByRole('button', { name: 'Sửa' }))
  expect(screen.getByLabelText('Slug bộ sưu tập')).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'published' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(body).toMatchObject({ status: 'published', sortOrder: 0, story: { vi: 'Truyện' } }))
})
it('shows actionable delete conflict and collection load retry', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockApi({ 'GET /me': me, 'GET /admin/collections': () => ({ body: { items: [c] } }), 'DELETE /admin/collections/c1': () => ({ status: 409, body: { error: { code: 'COLLECTION_IN_USE' } } }) })
  renderAt('/admin/collections')
  fireEvent.click(within((await screen.findByText('Bộ đã duyệt')).closest('tr')).getByRole('button', { name: 'Xoá' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('chuyển sang Đã ẩn')
})
