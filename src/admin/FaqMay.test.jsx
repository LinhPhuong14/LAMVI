// @vitest-environment jsdom
// D-129: Hỏi đáp (đổi thứ tự, công tắc hiển thị, chip lọc) và Mây (tab, thanh lưu theo thay đổi)
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/context.js'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import FaqPage from './FaqPage.jsx'
import MayConfigPage from './MayConfigPage.jsx'
import { S } from './strings.js'

const faq = (id, q, order, on = true) => ({ id, question: { vi: q }, answer: { vi: `Trả lời ${q}` }, sortOrder: order, isPublished: on })
let calls

function setup(Page, handlers) {
  calls = []
  const authedApi = vi.fn(async (path, opts = {}) => {
    calls.push([opts.method ?? 'GET', path, opts.body])
    for (const [re, fn] of handlers) if (re.test(`${opts.method ?? 'GET'} ${path}`)) return fn(opts)
    throw Object.assign(new Error('x'), { code: 'NOT_FOUND' })
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
}

beforeEach(() => vi.spyOn(window, 'confirm').mockReturnValue(true))
afterEach(() => vi.restoreAllMocks())

describe('FaqPage', () => {
  const list = () => ({ items: [faq('1', 'Câu một', 0), faq('2', 'Câu hai', 1), faq('3', 'Câu ba', 2, false)] })

  it('chip đếm và lọc theo hiển thị/ẩn; nút đổi thứ tự khoá khi đang lọc', async () => {
    setup(FaqPage, [[/^GET \/admin\/faq$/, list]])
    expect(await screen.findByText('Câu một')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(S.faq.hidden) }))
    expect(screen.queryByText('Câu một')).toBeNull()
    expect(screen.getByText('Câu ba')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(S.faq.moveUp) })).toBeDisabled()
  })

  it('công tắc gửi PATCH isPublished', async () => {
    setup(FaqPage, [[/^GET \/admin\/faq$/, list], [/^PATCH \/admin\/faq\/2$/, () => ({ item: {} })]])
    fireEvent.click(await screen.findByRole('switch', { name: /Câu hai/ }))
    await waitFor(() => expect(calls).toContainEqual(['PATCH', '/admin/faq/2', { isPublished: false }]))
  })

  it('nút ↓ đổi chỗ hai mục liền kề bằng hai PATCH sortOrder', async () => {
    setup(FaqPage, [[/^GET \/admin\/faq$/, list], [/^PATCH /, () => ({ item: {} })]])
    fireEvent.click(await screen.findByRole('button', { name: `${S.faq.moveDown}: Câu một` }))
    await waitFor(() => expect(calls.filter((c) => c[0] === 'PATCH')).toHaveLength(2))
    expect(calls).toContainEqual(['PATCH', '/admin/faq/1', { sortOrder: 1 }])
    expect(calls).toContainEqual(['PATCH', '/admin/faq/2', { sortOrder: 0 }])
  })

  it('Sửa mở biểu mẫu ở ngăn bên phải', async () => {
    setup(FaqPage, [[/^GET \/admin\/faq$/, list]])
    const row = (await screen.findByText('Câu hai')).closest('li')
    fireEvent.click(within(row).getByRole('button', { name: S.common.edit }))
    const aside = document.querySelector('aside.split-aside')
    expect(aside).not.toBeNull()
    expect(within(aside).getAllByRole('textbox').length).toBeGreaterThan(0)
  })
})

describe('MayConfigPage', () => {
  const cfg = () => ({
    config: {
      openaiEnabled: true,
      monthlyBudgetUsd: 20,
      supportChannel: { vi: '', en: '', zh: '' },
      limits: { guestPerSession: 20, guestPerDayIp: 50, userPerDay: 100, maxChars: 500 },
      messages: Object.fromEntries(['sick', 'tired', 'resting', 'unknown', 'unknownNoChannel'].map((g) => [g, { vi: ['a'], en: ['b'], zh: ['c'] }])),
    },
  })
  const usage = () => ({ costUsd: 16.5, budgetUsd: 20, budgetPct: 0.825, requests: 42, openaiConfigured: true, alert: 'warning' })
  const handlers = () => [[/^GET \/admin\/may\/config$/, cfg], [/^GET \/admin\/may\/usage$/, usage], [/^PUT \/admin\/may\/config$/, () => ({ config: cfg().config })]]

  it('mặc định ở tab Cấu hình; tab Chi phí hiện số liệu, thanh tiến độ và cảnh báo, ẩn biểu mẫu', async () => {
    setup(MayConfigPage, handlers())
    expect(await screen.findByLabelText(S.may.budget)).toBeInTheDocument()
    // cảnh báo ngân sách hiện ngay ở tab Cấu hình, kèm nút sang tab chi phí
    expect(screen.getByText(new RegExp(S.may.alertWarning))).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(S.may.tabUsage) })[0])
    expect(screen.queryByLabelText(S.may.budget)).toBeNull()
    expect(screen.getByText('16.50 / 20 USD')).toBeInTheDocument()
    expect(screen.getByText('83%')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /42/ })).toBeInTheDocument()
    expect(screen.getByText(S.may.alertWarning)).toBeInTheDocument()
  })

  it('thanh lưu chỉ hiện "có thay đổi chưa lưu" khi đã sửa, và mất sau khi lưu', async () => {
    setup(MayConfigPage, handlers())
    const budget = await screen.findByLabelText(S.may.budget)
    expect(screen.queryByText(S.may.dirty)).toBeNull()
    fireEvent.change(budget, { target: { value: '30' } })
    expect(screen.getByText(S.may.dirty)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: S.common.save }))
    await waitFor(() => expect(calls.some((c) => c[0] === 'PUT')).toBe(true))
    await waitFor(() => expect(screen.queryByText(S.may.dirty)).toBeNull())
    expect(calls.find((c) => c[0] === 'PUT')[2].monthlyBudgetUsd).toBe(30)
  })
})
