// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { S } from './strings.js'
import { returnStrings } from '../returns/strings.js'
const L = returnStrings('vi')
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
const admin = () => localStorage.setItem('moc.session', JSON.stringify(session))
const meAdmin = { 'GET /me': () => ({ body: { profile: { role: 'admin', preferredLocale: 'vi' } } }) }
it('status chips replace the select, load older pages by cursor and record a manual resolution', async () => {
  admin()
  let resolved = false
  const fetch = mockApi({
    ...meAdmin,
    'GET /admin/returns': (url) => ({
      body:
        url.searchParams.get('status') === 'approved'
          ? { items: resolved ? [] : [row('approved', 'approved')], nextCursor: null }
          : url.searchParams.has('cursor')
            ? { items: [row('older')], nextCursor: null }
            : { items: [row('newest')], nextCursor: 'oldercursor' },
    }),
    'GET /admin/returns/approved/video': () => ({ body: { url: 'https://storage.test/a.mp4' } }),
    'POST /admin/returns/approved/resolve': (_, init) => {
      expect(JSON.parse(init.body)).toEqual({ resolution: 'refund', note: 'Refund completed manually' })
      resolved = true
      return { body: { item: { status: 'resolved' } } }
    },
  })
  const { container } = renderAt('/admin/returns')
  expect(await screen.findByRole('link', { name: 'LV-newest' })).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(container.querySelector('.returns-split')).toBeInTheDocument()
  expect(container.querySelector('aside.returns-aside article.returns-detail')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: L.requested })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: L.approved })).toHaveAttribute('aria-pressed', 'false')
  // xem thêm nối trang kế vào danh sách, hết cursor thì ẩn nút
  fireEvent.click(screen.getByRole('button', { name: S.returns.more }))
  await waitFor(() => expect(container.querySelectorAll('.returns-card')).toHaveLength(2))
  expect(fetch.mock.calls.some(([u]) => String(u).includes('cursor=oldercursor'))).toBe(true)
  expect(screen.queryByRole('button', { name: S.returns.more })).toBeNull()
  expect(screen.queryByRole('button', { name: S.returns.next })).toBeNull()
  // đổi chip sang approved
  fireEvent.click(screen.getByRole('button', { name: L.approved }))
  expect(await screen.findByRole('link', { name: 'LV-approved' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: L.approved })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: S.returns.outcomes.replacement })).toHaveAttribute('value', 'replacement')
  fireEvent.change(screen.getByLabelText(S.returns.reason), { target: { value: 'Refund completed manually' } })
  fireEvent.click(screen.getByRole('button', { name: S.returns.outcomes.refund }))
  await waitFor(() => expect(screen.getByText(S.returns.empty)).toBeInTheDocument())
  expect(fetch.mock.calls.some(([url]) => String(url).includes('/resolve'))).toBe(true)
})
it('requested request offers approve and reject buttons that PATCH the status with the note', async () => {
  admin()
  const bodies = []
  let state = 'requested'
  mockApi({
    ...meAdmin,
    'GET /admin/returns': () => ({ body: { items: state === 'requested' ? [row('r1')] : [], nextCursor: null } }),
    'GET /admin/returns/r1/video': () => ({ body: { url: 'https://storage.test/r1.mp4' } }),
    'PATCH /admin/returns/r1': (_, init) => {
      bodies.push(JSON.parse(init.body))
      state = 'approved'
      return { body: { item: { status: 'approved' } } }
    },
  })
  renderAt('/admin/returns')
  const approve = await screen.findByRole('button', { name: S.returns.approve })
  expect(approve).toHaveAttribute('name', 'status')
  expect(approve).toHaveAttribute('value', 'approved')
  const reject = within(approve.closest('form')).getByRole('button', { name: S.returns.reject })
  expect(reject).toHaveAttribute('value', 'rejected')
  const note = screen.getByLabelText(S.returns.reason)
  expect(note).toBeRequired()
  expect(note).toHaveAttribute('minlength', '3')
  fireEvent.change(note, { target: { value: 'Hợp lệ' } })
  fireEvent.click(approve)
  await waitFor(() => expect(bodies).toEqual([{ status: 'approved', note: 'Hợp lệ' }]))
})
it('failed queue shows retry and then empty state after recovery', async () => {
  admin()
  let fail = true
  mockApi({
    'GET /me': () => ({ body: { profile: { role: 'admin' } } }),
    'GET /admin/returns': () =>
      fail ? { status: 503, body: { error: { code: 'UNAVAILABLE' } } } : { body: { items: [], nextCursor: null } },
  })
  renderAt('/admin/returns')
  expect(await screen.findByRole('button', { name: S.returns.retry })).toBeInTheDocument()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: S.returns.retry }))
  expect(await screen.findByText(S.returns.empty)).toBeInTheDocument()
})
it('selecting a request auto-loads its private video inline; failure offers retry', async () => {
  admin()
  let calls = 0
  mockApi({
    ...meAdmin,
    'GET /admin/returns': () => ({ body: { items: [row('evidence')], nextCursor: null } }),
    'GET /admin/returns/evidence/video': () =>
      ++calls === 1 ? { status: 500, body: { error: { code: 'X' } } } : { body: { url: 'https://storage.test/private?signed=short' } },
  })
  const { container } = renderAt('/admin/returns')
  expect(screen.queryByRole('button', { name: S.returns.video })).toBeNull()
  expect(await screen.findByText(S.returns.videoError)).toBeInTheDocument()
  expect(container.querySelector('video')).toBeNull()
  expect(within(screen.getByText(S.returns.videoError).closest('div')).getByRole('button', { name: S.returns.retry })).toBeInTheDocument()
})
it('video loads without any click when the request is selected', async () => {
  admin()
  mockApi({
    ...meAdmin,
    'GET /admin/returns': () => ({ body: { items: [row('evidence')], nextCursor: null } }),
    'GET /admin/returns/evidence/video': () => ({ body: { url: 'https://storage.test/private?signed=short' } }),
  })
  const { container } = renderAt('/admin/returns')
  await waitFor(() => expect(container.querySelector('video')).toHaveAttribute('src', 'https://storage.test/private?signed=short'))
  expect(container.querySelector('video')).toHaveAttribute('controls')
  expect(container.querySelector('video')).toHaveAttribute('aria-label', S.returns.video)
})
