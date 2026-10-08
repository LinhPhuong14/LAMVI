// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const base = {
  'GET /products': () => ({ body: { items: [] } }),
  'GET /faq': () => ({ body: { items: [] } }),
}
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

const openChat = async () => fireEvent.click(await screen.findByRole('button', { name: 'Trò chuyện với Mây' }))

describe('Tour Mây (US-010)', () => {
  it('feedback 08/10 mục 10: lần đầu vào trang chủ KHÔNG tự bật tour; bật qua “Dẫn tour”, đóng rồi nhớ', async () => {
    mockApi(base)
    const first = renderAt('/')
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(screen.queryByRole('dialog', { name: 'Tour cùng Mây' })).toBeNull()
    await openChat()
    fireEvent.click(await screen.findByRole('button', { name: 'Dẫn tour' }))
    expect(screen.getByRole('dialog', { name: 'Tour cùng Mây' })).toBeInTheDocument()
    expect(screen.getByText('Bước 1/5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua tour' }))
    expect(localStorage.getItem('moc.tour.done')).toBe('1')
    first.unmount()

    renderAt('/')
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.queryByRole('dialog', { name: 'Tour cùng Mây' })).toBeNull()
  })

  it('AC-003: vào trang khác trang chủ (trang lô, sản phẩm) → không tự bật', async () => {
    mockApi(base)
    renderAt('/lo/L-01')
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.queryByRole('dialog', { name: 'Tour cùng Mây' })).toBeNull()
  })

  it('đi qua các bước, bước cuối "Xong"; làm nổi bật phần tử đích', async () => {
    mockApi(base)
    const { container } = renderAt('/en')
    fireEvent.click(await screen.findByRole('button', { name: 'Chat with Mây' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take the tour' }))
    expect(container.querySelector('.hero').classList.contains('tour-highlight')).toBe(true)
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 5/5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog', { name: 'Tour with Mây' })).toBeNull()
  })

  it('mở lại tour từ khung chat (I-21)', async () => {
    localStorage.setItem('moc.tour.done', '1')
    mockApi(base)
    renderAt('/')
    await openChat()
    fireEvent.click(await screen.findByRole('button', { name: 'Dẫn tour' }))
    expect(screen.getByRole('dialog', { name: 'Tour cùng Mây' })).toBeInTheDocument()
  })
})

describe('Chat với Mây', () => {
  beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

  it('ghi rõ là trợ lý AI; gửi tin kèm sessionId, lang; hiện câu trả lời và FAQ gợi ý', async () => {
    const calls = []
    mockApi({
      ...base,
      'POST /may/chat': (url, init) => {
        calls.push(JSON.parse(init.body))
        return { body: { reply: { kind: 'resting', text: 'Mây đang nghỉ ngơi', faq: [{ question: 'Lưu bao lâu?', answer: '30 ngày' }] } } }
      },
    })
    renderAt('/zh')
    fireEvent.click(await screen.findByRole('button', { name: '和 Mây 聊天' }))
    expect(await screen.findByText(/Mây 是 AI 助手/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('输入您的问题…'), { target: { value: '保存多久' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('Mây đang nghỉ ngơi')).toBeInTheDocument()
    expect(screen.getByText('Lưu bao lâu?')).toBeInTheDocument()
    expect(calls[0]).toMatchObject({ message: '保存多久', lang: 'zh', history: [] })
    expect(calls[0].sessionId).toMatch(/.{8,}/)
    expect(screen.getByText('您尚未登录，对话不会被保存。')).toBeInTheDocument()
  })

  it('NFR-AVL-001: API lỗi → báo trong khung chat, trang vẫn dùng được', async () => {
    mockApi({ ...base, 'POST /may/chat': () => ({ status: 503, body: { error: { code: 'MAINTENANCE' } } }) })
    renderAt('/')
    await openChat()
    fireEvent.change(await screen.findByLabelText('Nhập câu hỏi…'), { target: { value: 'chào' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    expect(await screen.findByText('Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('đã đăng nhập: nạp lịch sử đã lưu và gửi kèm token', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const auths = []
    mockApi({
      ...base,
      'GET /may/history': () => ({ body: { items: [{ role: 'user', kind: 'message', content: 'hôm qua mình hỏi' }] } }),
      'POST /may/chat': (url, init) => {
        auths.push(init.headers.Authorization)
        return { body: { reply: { kind: 'answer', text: 'Mây trả lời' } } }
      },
    })
    renderAt('/')
    await openChat()
    expect(await screen.findByText('hôm qua mình hỏi')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi…'), { target: { value: 'nữa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    await screen.findByText('Mây trả lời')
    expect(auths).toEqual(['Bearer a1'])
  })

  it('giới hạn 500 ký tự trên ô nhập', async () => {
    mockApi(base)
    renderAt('/')
    await openChat()
    expect(await screen.findByLabelText('Nhập câu hỏi…')).toHaveAttribute('maxLength', '500')
  })
})

describe('Lịch sử trên trang tài khoản (FR-ACC-004)', () => {
  it('hiện lịch sử chat', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    localStorage.setItem('moc.tour.done', '1')
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile: { id: 'u1', email: 'an@moc.test', fullName: 'An', phone: null, preferredLocale: 'vi', role: 'customer' } } }),
      'GET /may/history': () => ({ body: { items: [{ role: 'assistant', kind: 'answer', content: 'Đèn Vọng giá 1.050.000 ₫' }] } }),
    })
    renderAt('/account?tab=may')
    expect(await screen.findByRole('heading', { name: 'Lịch sử trò chuyện với Mây' })).toBeInTheDocument()
    expect(await screen.findByText('Đèn Vọng giá 1.050.000 ₫')).toBeInTheDocument()
  })
})

describe('Admin — cấu hình Mây (FR-AI-007)', () => {
  it('hiện chi phí, cảnh báo; lưu cờ OpenAI + ngân sách + câu thông báo', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const puts = []
    const config = {
      openaiEnabled: false,
      monthlyBudgetUsd: 20,
      supportChannel: { vi: '', en: '', zh: '' },
      limits: { guestPerSession: 20, guestPerDayIp: 50, userPerDay: 100, maxChars: 500 },
      messages: Object.fromEntries(['sick', 'tired', 'resting', 'unknown', 'unknownNoChannel'].map((g) => [g, { vi: [`câu ${g}`], en: [], zh: [] }])),
    }
    mockApi({
      'GET /me': () => ({ body: { profile: { id: 'u1', role: 'admin' } } }),
      'GET /admin/may/config': () => ({ body: { config } }),
      'GET /admin/may/usage': () => ({ body: { costUsd: 17, budgetUsd: 20, budgetPct: 0.85, requests: 40, alert: 'warning', openaiConfigured: true } }),
      'PUT /admin/may/config': (url, init) => {
        puts.push(JSON.parse(init.body))
        return { body: { config } }
      },
    })
    renderAt('/admin/may')
    expect(await screen.findByText('Đã dùng trên 80% ngân sách tháng.')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Bật trả lời bằng OpenAI'))
    fireEvent.change(screen.getByLabelText('Ngân sách tháng (USD)'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Hết lượt ("mệt") — Tiếng Việt'), { target: { value: 'Mây mệt\n\nMây buồn ngủ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toMatchObject({ openaiEnabled: true, monthlyBudgetUsd: 30 })
    expect(puts[0].messages.tired.vi).toEqual(['Mây mệt', 'Mây buồn ngủ'])
    expect(await screen.findByText('Đã lưu.')).toBeInTheDocument()
  })
})
