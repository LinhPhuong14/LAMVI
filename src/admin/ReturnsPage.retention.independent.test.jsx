// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { S, fmt } from './strings.js'
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'admin', email: 'a@lamvi.test' } }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString()
const row = (id, o = {}) => ({ id, orderCode: `LV-${id}`, reason: 'wrong_item', description: 'd', status: 'resolved', resolvedAt: ago(10), items: [{ slug: 'lamp', quantity: 1 }], videoPurged: false, ...o })
const setup = (items, status) => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  mockApi({
    'GET /me': () => ({ body: { profile: { role: 'admin', preferredLocale: 'vi' } } }),
    'GET /admin/returns': (url) => ({ body: { items: url.searchParams.get('status') === status ? items : [], nextCursor: null } }),
    'GET /admin/returns/kept/video': () => ({ body: { url: 'https://storage.test/k.mp4' } }),
  })
  renderAt('/admin/returns')
}
it('purged video shows the retention note, no player and no fetch', async () => {
  setup([row('gone', { videoPurged: true })], 'requested')
  expect(await screen.findByText(S.returns.videoPurged)).toBeInTheDocument()
  expect(screen.getByText(S.returns.videoGone)).toBeInTheDocument()
  expect(document.querySelector('video')).toBeNull()
})
it('resolved request shows a 90-day countdown (90 - days since resolvedAt)', async () => {
  setup([row('kept')], 'resolved')
  fireEvent.click(await screen.findByRole('button', { name: 'Đã xử lý' }))
  expect(await screen.findByText(fmt(S.returns.purgeIn, { n: 80 }))).toBeInTheDocument()
  await waitFor(() => expect(document.querySelector('video')).not.toBeNull())
})
it('rejected request counts down from decidedAt and floors at 0', async () => {
  setup([row('kept', { status: 'rejected', resolvedAt: undefined, decidedAt: ago(120) })], 'rejected')
  fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }))
  expect(await screen.findByText(fmt(S.returns.purgeIn, { n: 0 }))).toBeInTheDocument()
})
it('pending request has no countdown', async () => {
  setup([row('kept', { status: 'requested', resolvedAt: undefined })], 'requested')
  await screen.findByRole('link', { name: 'LV-kept' })
  expect(screen.queryByText(/Video tự xoá sau/)).toBeNull()
})
