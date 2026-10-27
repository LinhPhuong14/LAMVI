// @vitest-environment jsdom
// D-130: tab "Theo kỳ" của Analytics (phễu, người dùng theo ngày, kênh vào) và nút đổi thứ tự bộ sưu tập
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/context.js'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import AnalyticsPage from './AnalyticsPage.jsx'
import CollectionsPage from './CollectionsPage.jsx'
import { ANALYTICS as A, S } from './strings.js'

function setup(Page, handler) {
  const calls = []
  const authedApi = vi.fn(async (path, opts = {}) => {
    calls.push([opts.method ?? 'GET', path, opts.body])
    return handler(opts.method ?? 'GET', path)
  })
  render(
    <AuthContext.Provider value={{ authedApi, user: { id: 'a' }, session: {} }}>
      <LocaleProvider lang="vi">
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </LocaleProvider>
    </AuthContext.Provider>,
  )
  return calls
}

const realtime = { configured: true, fetchedAt: new Date().toISOString(), activeUsers: 1, pageViews: 2, perMinute: [], pages: [], countries: [], devices: [] }
const report = (days) => ({
  configured: true,
  days,
  fetchedAt: new Date().toISOString(),
  users: 120,
  pageViews: 900,
  sessions: 300,
  funnel: [
    { name: 'view_item', users: 100, events: 250 },
    { name: 'add_to_cart', users: 30, events: 41 },
    { name: 'begin_checkout', users: 15, events: 15 },
    { name: 'purchase', users: 3, events: 3 },
  ],
  daily: [{ date: '20261025', users: 40 }],
  channels: [{ name: 'Organic Social', value: 200 }],
})

describe('Analytics theo kỳ', () => {
  const handler = (m, path) => (path.startsWith('/admin/analytics/report') ? report(Number(new URL(path, 'http://x').searchParams.get('days'))) : realtime)

  it('tab Theo kỳ gọi báo cáo 7 ngày, hiện phễu với tỉ lệ so với bước trước', async () => {
    const calls = setup(AnalyticsPage, handler)
    fireEvent.click(screen.getByRole('button', { name: A.tabPeriod }))
    expect(await screen.findByText(A.funnelSteps.view_item)).toBeInTheDocument()
    expect(calls.some((c) => c[1] === '/admin/analytics/report?days=7')).toBe(true)
    expect(screen.getByText(/30% so với bước trước/)).toBeInTheDocument() // 30/100
    expect(screen.getByText(/50% so với bước trước/)).toBeInTheDocument() // 15/30
    expect(screen.getByText(/20% so với bước trước/)).toBeInTheDocument() // 3/15
    expect(screen.getByText('Organic Social')).toBeInTheDocument()
  })

  it('đổi kỳ sang 28 ngày gọi lại với days=28', async () => {
    const calls = setup(AnalyticsPage, handler)
    fireEvent.click(screen.getByRole('button', { name: A.tabPeriod }))
    await screen.findByText(A.funnelSteps.view_item)
    fireEvent.click(screen.getByRole('button', { name: A.periods[28] }))
    await waitFor(() => expect(calls.some((c) => c[1] === '/admin/analytics/report?days=28')).toBe(true))
    expect(screen.getByRole('button', { name: A.periods[28] })).toHaveAttribute('aria-pressed', 'true')
  })

  it('chưa cấu hình GA → hướng dẫn cài đặt', async () => {
    setup(AnalyticsPage, (m, path) => (path.includes('/report') ? { configured: false } : realtime))
    fireEvent.click(screen.getByRole('button', { name: A.tabPeriod }))
    expect(await screen.findByText(A.notConfigured)).toBeInTheDocument()
  })
})

describe('Bộ sưu tập: đổi thứ tự', () => {
  const col = (id, name, order) => ({ id, slug: id, name: { vi: name }, status: 'published', sortOrder: order })
  const handler = (m) => (m === 'GET' ? { items: [col('a', 'Bộ A', 0), col('b', 'Bộ B', 1)] } : { item: {} })

  it('↓ đổi chỗ hai bộ liền kề bằng hai PATCH sortOrder; nút đầu/cuối bị khoá', async () => {
    const calls = setup(CollectionsPage, handler)
    expect(await screen.findByRole('button', { name: `${S.faq.moveUp}: Bộ A` })).toBeDisabled()
    expect(screen.getByRole('button', { name: `${S.faq.moveDown}: Bộ B` })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: `${S.faq.moveDown}: Bộ A` }))
    await waitFor(() => expect(calls.filter((c) => c[0] === 'PATCH')).toHaveLength(2))
    expect(calls).toContainEqual(['PATCH', '/admin/collections/a', { sortOrder: 1 }])
    expect(calls).toContainEqual(['PATCH', '/admin/collections/b', { sortOrder: 0 }])
  })
})
