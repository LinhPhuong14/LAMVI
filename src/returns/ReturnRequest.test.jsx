// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import ReturnRequest from './ReturnRequest.jsx'
const authedApi = vi.hoisted(() => vi.fn())
vi.mock('../auth/context.js', () => ({ useAuth: () => ({ authedApi }) }))
vi.mock('../i18n/index.js', () => ({ useI18n: () => ({ lang: 'en' }) }))
const order = { code: 'LM1', status: 'delivered', items: [{ slug: 'lamp', quantity: 1, name: 'Lamp' }] }
const enabled = { enabled: true, eligible: true, maxBytes: 1000000, items: [] }
beforeEach(() => {
  authedApi.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})
function fill(container) {
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lamp' }))
  fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Broken lamp' } })
  fireEvent.click(screen.getByLabelText('I confirm this video continuously records the unboxing.'))
  fireEvent.change(screen.getByLabelText('Continuous unboxing video'), {
    target: { files: [new File(['abc'], 'video.mp4', { type: 'video/mp4' })] },
  })
  return container.querySelector('form')
}
it('gateoff shows contact message without upload form or mutation calls', async () => {
  authedApi.mockResolvedValue({ enabled: false, eligible: false, maxBytes: 0, items: [] })
  render(<ReturnRequest order={order} />)
  expect(
    await screen.findByText('Return video uploads are not yet enabled. Please contact the store.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Submit request' })).toBeNull()
  expect(authedApi).toHaveBeenCalledTimes(1)
})
it('non-delivered order does not fetch return endpoints', () => {
  render(<ReturnRequest order={{ ...order, status: 'confirmed' }} />)
  expect(authedApi).not.toHaveBeenCalled()
})
it('response-loss retry keeps one upload and finalizes same id; list refresh failure keeps success visible', async () => {
  let submits = 0,
    lists = 0
  const saved = {
    id: 'request',
    status: 'requested',
    reason: 'manufacturing_defect',
    items: [{ slug: 'lamp', quantity: 1 }],
  }
  authedApi.mockImplementation(async (path) => {
    if (path.endsWith('/upload')) return { id: 'request', uploadUrl: 'https://storage.test/file' }
    if (path.endsWith('/submit')) {
      if (++submits === 1) throw Error('lost response')
      return { item: saved }
    }
    if (++lists > 1) throw Error('refresh down')
    return enabled
  })
  const fetch = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetch)
  const { container } = render(<ReturnRequest order={order} />)
  await screen.findByRole('button', { name: 'Submit request' })
  const form = fill(container)
  fireEvent.submit(form)
  await screen.findByRole('alert')
  fireEvent.submit(form)
  await screen.findByText('Request submitted. The store will review your video and respond.')
  expect(screen.getByText('Awaiting review · Manufacturing defect')).toBeInTheDocument()
  expect(authedApi.mock.calls.filter(([p]) => p.endsWith('/upload'))).toHaveLength(1)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(submits).toBe(2)
})
it('missing item selection does not allocate upload credentials', async () => {
  authedApi.mockResolvedValue(enabled)
  const { container } = render(<ReturnRequest order={order} />)
  await screen.findByRole('button', { name: 'Submit request' })
  fireEvent.change(screen.getByLabelText('Continuous unboxing video'), {
    target: { files: [new File(['abc'], 'video.mp4', { type: 'video/mp4' })] },
  })
  fireEvent.submit(container.querySelector('form'))
  await screen.findByRole('alert')
  expect(authedApi.mock.calls.some(([p]) => p.endsWith('/upload'))).toBe(false)
})
it('finalize can recover an uploaded object when direct upload response is lost', async () => {
  const saved = { id: 'request', status: 'requested', reason: 'manufacturing_defect', items: [] }
  authedApi.mockImplementation(async (path) =>
    path.endsWith('/upload')
      ? { id: 'request', uploadUrl: 'https://storage.test/file' }
      : path.endsWith('/submit')
        ? { item: saved }
        : enabled,
  )
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('upload response lost')))
  const { container } = render(<ReturnRequest order={order} />)
  await screen.findByRole('button', { name: 'Submit request' })
  fireEvent.submit(fill(container))
  expect(
    await screen.findByText('Request submitted. The store will review your video and respond.'),
  ).toBeInTheDocument()
  expect(authedApi.mock.calls.some(([p]) => p.endsWith('/submit'))).toBe(true)
})
