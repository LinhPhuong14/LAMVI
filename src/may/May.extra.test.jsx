// @vitest-environment jsdom
// Kiểm thử độc lập giao diện Mây (FR-AI-001/002, US-010, BR-AI-007/008, NFR-AVL-001, NFR-A11Y-001)
import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import AppShell from '../AppShell.jsx'
import { createDataStore } from '../seo/context.js'
import { render as ssrRender } from '../entry-server.jsx'
import { classifyPath, dataKeysFor } from '../seo/routes.js'
import { listPublicFaq, listPublicProducts } from '../../server/services/catalog.js'
import { createMemoryRepo } from '../../server/adapters/memory/repo.js'

// Cho phép giả lập MayChat ném lỗi khi render (NFR-AVL-001)
const boom = vi.hoisted(() => ({ on: false }))
vi.mock('./MayChat.jsx', async (importOriginal) => {
  const real = await importOriginal()
  return {
    default: (props) => {
      if (boom.on) throw new Error('MayChat vỡ')
      return real.default(props)
    },
  }
})

const base = {
  'GET /products': () => ({ body: { items: [] } }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /products/den-vong': () => ({ body: { item: { slug: 'den-vong', name: 'Đèn Vọng', priceExclVat: 1050000, currency: 'VND' } } }),
  'GET /batches/L-01': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }),
}
const TOUR = { name: 'Tour cùng Mây' }
const FAB = { name: 'Trò chuyện với Mây' }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  boom.on = false
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  try {
    sessionStorage.clear()
  } catch {
    /* bị chặn */
  }
})

const wait = (ms = 1500) => act(() => vi.advanceTimersByTimeAsync(ms))
const openChat = async () => fireEvent.click(await screen.findByRole('button', FAB))

describe('Tour — không tự bật ngoài trang chủ (BR-AI-007, US-010 AC-003)', () => {
  it.each(['/lo/L-01', '/products/den-vong', '/en/products/den-vong', '/account', '/login', '/zh/khong-co'])('%s → không tự bật', async (url) => {
    mockApi(base)
    renderAt(url)
    await wait()
    expect(screen.queryByRole('dialog', TOUR)).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Tour with Mây' })).toBeNull()
    expect(localStorage.getItem('moc.tour.done')).toBeNull()
  })

  it.each(['/admin/products', '/admin/may', '/it'])('%s → không có Mây, không tour', async (url) => {
    // Đăng nhập IT để thực sự ở lại trang /admin, /it (không bị chuyển về /login)
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'it@moc.test' } }))
    mockApi({
      ...base,
      'GET /me': () => ({ body: { profile: { id: 'u1', role: 'it' } } }),
      'GET /admin/products': () => ({ body: { items: [] } }),
      'GET /admin/may/config': () => ({ status: 500, body: {} }),
      'GET /admin/may/usage': () => ({ status: 500, body: {} }),
    })
    renderAt(url)
    await wait()
    // Đang ở khung admin/IT thật (thanh điều hướng admin), không bị chuyển sang trang khách
    await waitFor(() => expect(document.querySelector('.admin-nav')).not.toBeNull())
    expect(screen.queryByRole('button', FAB)).toBeNull()
    expect(screen.queryByRole('dialog', TOUR)).toBeNull()
    expect(document.querySelector('.may-fab')).toBeNull()
  })

  it('Esc đóng tour và nhớ đã đóng', async () => {
    mockApi(base)
    renderAt('/')
    await wait()
    expect(screen.getByRole('dialog', TOUR)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', TOUR)).toBeNull()
    expect(localStorage.getItem('moc.tour.done')).toBe('1')
  })

  it('rời trang chủ khi tour đang chạy → tour ẩn; bỏ nổi bật phần tử', async () => {
    mockApi(base)
    const { container } = renderAt('/')
    await wait()
    expect(container.querySelector('.tour-highlight')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }))
    expect(container.querySelectorAll('.tour-highlight')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua tour' }))
    expect(container.querySelector('.tour-highlight')).toBeNull()
  })

  it('NFR-A11Y-001: prefers-reduced-motion → scrollIntoView behavior "auto"; mặc định "smooth"', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const mm = (reduce) => (q) => ({
      matches: reduce && q.includes('reduce'),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })
    vi.stubGlobal('matchMedia', mm(true))
    mockApi(base)
    const first = renderAt('/')
    await wait()
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls.every(([o]) => o.behavior === 'auto')).toBe(true)
    first.unmount()
    localStorage.clear()
    spy.mockClear()
    vi.stubGlobal('matchMedia', mm(false))
    renderAt('/')
    await wait()
    expect(spy.mock.calls.at(-1)[0].behavior).toBe('smooth')
  })
})

describe('Bộ nhớ trình duyệt bị chặn', () => {
  it('localStorage/sessionStorage ném lỗi → trang vẫn hiện, không tự bật tour, chat vẫn gửi được với sessionId hợp lệ', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const bodies = []
    mockApi({
      ...base,
      'POST /may/chat': (u, init) => (bodies.push(JSON.parse(init.body)), { body: { reply: { kind: 'resting', text: 'nghỉ' } } }),
    })
    renderAt('/')
    await wait()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', TOUR)).toBeNull()
    await openChat()
    fireEvent.change(await screen.findByLabelText('Nhập câu hỏi…'), { target: { value: 'chào' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    expect(await screen.findByText('nghỉ')).toBeInTheDocument()
    expect(bodies[0].sessionId).toMatch(/^[A-Za-z0-9-]{8,64}$/)
  })
})

describe('NFR-AVL-001: Mây lỗi không làm vỡ trang', () => {
  it('MayChat ném khi render → Mây ẩn đi, phần còn lại của trang vẫn hiện', async () => {
    localStorage.setItem('moc.tour.done', '1')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    boom.on = true
    mockApi(base)
    renderAt('/')
    await openChat()
    await waitFor(() => expect(screen.queryByRole('button', FAB)).toBeNull())
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

describe('Khung chat', () => {
  beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

  const setup = async (reply = { kind: 'answer', text: 'Mây trả lời' }) => {
    const bodies = []
    const fetchMock = mockApi({
      ...base,
      'POST /may/chat': (u, init) => (bodies.push(JSON.parse(init.body)), { body: { reply } }),
    })
    renderAt('/')
    await openChat()
    const input = await screen.findByLabelText('Nhập câu hỏi…')
    return { bodies, input, fetchMock }
  }

  it('có nhãn trợ lý AI; dialog có tên; nút mở có aria-expanded', async () => {
    await setup()
    expect(screen.getByRole('dialog', { name: 'Mây' })).toBeInTheDocument()
    expect(screen.getByText('Trợ lý AI của LAMVI')).toBeInTheDocument()
    expect(screen.getByText(/Mây là trợ lý AI/)).toBeInTheDocument()
    expect(screen.getByRole('button', FAB)).toHaveAttribute('aria-expanded', 'true')
  })

  it('Enter gửi; Shift+Enter không gửi', async () => {
    const { bodies, input } = await setup()
    fireEvent.change(input, { target: { value: 'dòng 1' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(bodies).toHaveLength(0)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Mây trả lời')).toBeInTheDocument()
    expect(bodies).toHaveLength(1)
    expect(bodies[0].message).toBe('dòng 1')
    expect(input).toHaveValue('')
  })

  it('không gửi tin rỗng / chỉ khoảng trắng (nút tắt, Enter không gọi API)', async () => {
    const { bodies, input } = await setup()
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled()
    fireEvent.change(input, { target: { value: '   \n ' } })
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled()
    fireEvent.keyDown(input, { key: 'Enter' })
    await wait(50)
    expect(bodies).toHaveLength(0)
  })

  it('đang chờ trả lời → không gửi lần hai (chống bấm liên tiếp)', async () => {
    let resolve
    const bodies = []
    mockApi({
      ...base,
      'POST /may/chat': (u, init) => {
        bodies.push(JSON.parse(init.body))
        return new Promise((r) => (resolve = () => r({ body: { reply: { kind: 'answer', text: 'xong' } } })))
      },
    })
    renderAt('/')
    await openChat()
    const input = await screen.findByLabelText('Nhập câu hỏi…')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'b' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Mây đang nghĩ…')).toBeInTheDocument()
    await act(async () => resolve())
    await screen.findByText('xong')
    expect(bodies).toHaveLength(1)
  })

  it('vãng lai: lịch sử lưu sessionStorage (không gọi /may/history), mở lại vẫn thấy; history gửi kèm chỉ gồm user + answer', async () => {
    const { input, fetchMock, bodies } = await setup({ kind: 'resting', text: 'Mây nghỉ', faq: [] })
    fireEvent.change(input, { target: { value: 'câu 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    await screen.findByText('Mây nghỉ')
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('moc.may.chat')).map((m) => m.content)).toEqual(['câu 1', 'Mây nghỉ']))
    expect(localStorage.getItem('moc.may.chat')).toBeNull()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/may/history'))).toBe(false)
    // đóng & mở lại
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    await openChat()
    expect(await screen.findByText('câu 1')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi…'), { target: { value: 'câu 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    // câu "nghỉ ngơi" không phải câu trả lời thật → không đưa vào ngữ cảnh
    expect(bodies[1].history).toEqual([{ role: 'user', content: 'câu 1' }])
    expect(bodies[1].sessionId).toBe(bodies[0].sessionId)
  })

  it('sessionStorage chứa JSON hỏng → khung chat vẫn mở', async () => {
    sessionStorage.setItem('moc.may.chat', '{hỏng')
    await setup()
    expect(screen.getByRole('dialog', { name: 'Mây' })).toBeInTheDocument()
  })

  it('ô nhập giới hạn 500 ký tự và bộ đếm', async () => {
    const { input } = await setup()
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(screen.getByText('3/500')).toBeInTheDocument()
  })
})

describe('SSR trang chủ có nút Mây và hydrate không lệch', () => {
  it('HTML SSR có nút Mây; hydrate không báo lỗi', async () => {
    const repo = createMemoryRepo()
    const route = classifyPath('/')
    const data = {}
    for (const p of dataKeysFor(route)) {
      data[`${p}|vi`] = { data: p === '/products' ? await listPublicProducts(repo, 'vi') : await listPublicFaq(repo, 'vi') }
    }
    const { html } = ssrRender('/', { initialData: data, siteUrl: 'http://localhost' })
    expect(html).toContain('aria-label="Trò chuyện với Mây"')
    expect(html).not.toContain('may-panel')
    expect(html).not.toContain('tour-pop')

    localStorage.setItem('moc.tour.done', '1')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    window.history.replaceState(null, '', '/')
    const root = document.createElement('div')
    root.innerHTML = html
    document.body.appendChild(root)
    const recoverable = []
    const errors = []
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' ')))
    let r
    await act(async () => {
      r = hydrateRoot(root, <AppShell dataStore={createDataStore(data)} Router={BrowserRouter} />, {
        onRecoverableError: (e) => recoverable.push(String(e?.message ?? e)),
      })
    })
    await wait(100)
    expect(recoverable).toEqual([])
    expect(errors.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([])
    expect(root.querySelector('.may-fab')).not.toBeNull()
    act(() => r.unmount())
    root.remove()
  })
})

describe('i18n: không có chuỗi tiếng Việt cứng trong src/may/*.jsx', () => {
  const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
  const dir = `${process.cwd()}/src/may/`
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
  it.each(files)('%s', (f) => {
    const code = readFileSync(dir + f, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    const bad = code.split('\n').filter((l) => VI.test(l))
    expect(bad).toEqual([])
  })
})
