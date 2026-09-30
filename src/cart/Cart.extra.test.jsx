// @vitest-environment jsdom
// Kiểm thử độc lập: giỏ hàng phía trình duyệt (FR-CART-001, §11, D-49, D-59…D-61, US-001 AC-003, US-010 AC-003)
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { useState } from 'react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import AppShell from '../AppShell.jsx'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import QuantityInput from './QuantityInput.jsx'
import { loadLocalCart } from './context.js'
import { createDataStore } from '../seo/context.js'
import { render as ssrRender } from '../entry-server.jsx'
import { classifyPath, dataKeysFor } from '../seo/routes.js'
import { listPublicFaq, listPublicProducts } from '../../server/services/catalog.js'
import { createMemoryRepo } from '../../server/adapters/memory/repo.js'
import { MAX_LINES, createCartService, parseLine } from '../../server/cart/service.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }

// Server giả dùng đúng dịch vụ giỏ thật + repo bộ nhớ (giá, tên, gộp như server)
function fakeServer({ repo = createMemoryRepo(), fail = {} } = {}) {
  const cart = createCartService({ repo })
  const log = []
  const lang = (url) => url.searchParams.get('lang') ?? 'vi'
  // Giống parseLines ở server/routes/cart.js
  const items = (init) => {
    const list = JSON.parse(init.body).items
    if (!Array.isArray(list) || list.length > MAX_LINES * 2) throw Object.assign(new Error('v'), { status: 400, code: 'VALIDATION_ERROR' })
    return list.map(parseLine).filter(Boolean)
  }
  const wrap = (key, fn) => async (url, init) => {
    log.push({ key, url: String(url), body: init?.body ? JSON.parse(init.body) : undefined })
    if (fail[key]) return fail[key](url, init)
    try {
      return { body: await fn(url, init) }
    } catch (err) {
      return { status: err.status ?? 500, body: { error: { code: err.code ?? 'INTERNAL_ERROR' } } }
    }
  }
  const handlers = {
    'GET /products': wrap('products', (u) => listPublicProducts(repo, lang(u))),
    'GET /faq': wrap('faq', (u) => listPublicFaq(repo, lang(u))),
    'POST /cart/quote': wrap('quote', (u, init) => cart.quote(items(init), lang(u))),
    'GET /cart': wrap('get', (u) => cart.get('u1', lang(u))),
    'POST /cart/merge': wrap('merge', (u, init) => cart.merge('u1', items(init), lang(u))),
    'POST /auth/login': wrap('login', () => session),
  }
  for (const slug of ['den-nguyet', 'den-vong', 'den-sum-vay']) {
    handlers[`PUT /cart/items/${slug}`] = wrap('put', (u, init) => cart.setQuantity('u1', slug, JSON.parse(init.body).quantity, lang(u)))
    handlers[`DELETE /cart/items/${slug}`] = wrap('delete', (u) => cart.remove('u1', slug, lang(u)))
  }
  return { repo, cart, log, handlers }
}

async function flush(n = 5) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('moc.tour.done', '1')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
})

describe('SSR trang chủ + giỏ trong localStorage (D-49)', () => {
  it('hydrate không lệch; số trên header chỉ hiện sau hydrate', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 2 }, { slug: 'den-vong', quantity: 1 }]))
    const repo = createMemoryRepo()
    const route = classifyPath('/')
    const data = {}
    for (const p of dataKeysFor(route)) {
      data[`${p}|vi`] = { data: p === '/products' ? await listPublicProducts(repo, 'vi') : await listPublicFaq(repo, 'vi') }
    }
    const { html } = ssrRender('/', { initialData: data, siteUrl: 'http://localhost' })
    // SSR không biết giỏ trình duyệt
    expect(html).toContain('>Giỏ hàng</a>')
    expect(html).not.toMatch(/Giỏ hàng \(\d+\)/)

    document.body.innerHTML = ''
    const root = document.createElement('div')
    root.id = 'root'
    root.innerHTML = html
    document.body.appendChild(root)
    window.history.replaceState(null, '', '/')
    const srv = fakeServer({ repo })
    mockApi(srv.handlers)
    const recoverable = []
    const errors = []
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' ')))
    let r
    await act(async () => {
      r = hydrateRoot(root, <AppShell dataStore={createDataStore(data)} Router={BrowserRouter} />, {
        onRecoverableError: (e) => recoverable.push(String(e?.message ?? e)),
      })
    })
    await flush()
    expect(recoverable).toEqual([])
    expect(errors.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([])
    expect(root.querySelector('.nav-cart').textContent).toBe('Giỏ hàng (3)')
    act(() => r.unmount())
  })
})

describe('localStorage hỏng / bị chặn', () => {
  it.each(['{hong', '"x"', '{"slug":"den-nguyet"}', '[null,1,"a",{"slug":"den-nguyet","quantity":"2"},{"slug":"den-vong","quantity":0}]', 'null'])(
    'moc.cart = %s → trang giỏ vẫn chạy, coi như trống',
    async (raw) => {
      localStorage.setItem('moc.cart', raw)
      mockApi(fakeServer().handlers)
      renderAt('/cart')
      expect(await screen.findByText('Giỏ hàng đang trống.')).toBeInTheDocument()
    },
  )

  it('loadLocalCart lọc dòng sai', () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-vong', quantity: 2 }, { slug: 'x', quantity: -1 }, { slug: 1, quantity: 1 }]))
    expect(loadLocalCart()).toEqual([{ slug: 'den-vong', quantity: 2 }])
  })

  it('localStorage ném lỗi (chế độ riêng tư) → trang chủ và giỏ không vỡ, thêm vào giỏ không ném', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    mockApi(fakeServer().handlers)
    renderAt('/')
    const card = (await screen.findByText('Đèn Nguyệt', { selector: '.product-card a' })).closest('.product-card')
    fireEvent.click(within(card).getByRole('button', { name: 'Tặng ngay' }))
    expect(await within(card).findByText('Đã thêm vào giỏ.')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (1)' })).toBeInTheDocument()
  })

  it('giỏ trình duyệt quá dài (>100 dòng, bị sửa tay) → trang giỏ không kẹt ở lỗi', async () => {
    localStorage.setItem('moc.cart', JSON.stringify(Array.from({ length: 150 }, () => ({ slug: 'den-vong', quantity: 1 }))))
    mockApi(fakeServer().handlers)
    renderAt('/cart')
    expect(await screen.findByText('Đèn Vọng', { selector: 'strong' })).toBeInTheDocument()
  })
})

describe('Header và ngôn ngữ', () => {
  it('/en: header đếm đúng và giữ tiền tố ngôn ngữ', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 2 }, { slug: 'den-sum-vay', quantity: 3 }]))
    mockApi(fakeServer().handlers)
    renderAt('/en')
    expect(await screen.findByRole('link', { name: 'Cart (5)' })).toHaveAttribute('href', '/en/cart')
  })

  it('header không đếm dòng không còn bán', async () => {
    const srv = fakeServer()
    const p = await srv.repo.getProductBySlug('den-vong')
    await srv.repo.updateProduct(p.id, { status: 'hidden' })
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 2 }, { slug: 'den-vong', quantity: 3 }]))
    mockApi(srv.handlers)
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (2)' })).toBeInTheDocument()
  })

  it('đổi ngôn ngữ → tên sản phẩm trong giỏ đổi theo', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 1 }]))
    mockApi(fakeServer().handlers)
    renderAt('/cart')
    expect(await screen.findByText('Đèn Nguyệt', { selector: 'strong' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'EN' }))
    expect(await screen.findByText('Nguyet Lantern', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cart' })).toBeInTheDocument()
  })
})

describe('Thanh toán (D-61, US-001 AC-003)', () => {
  it('chưa đăng nhập: /en/cart → login?next=/en/cart → đăng nhập → quay lại /en/cart, giỏ được gộp', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 2 }]))
    const srv = fakeServer()
    await srv.cart.setQuantity('u1', 'den-nguyet', 1, 'en')
    mockApi(srv.handlers)
    renderAt('/en/cart')
    fireEvent.click(await screen.findByRole('button', { name: 'Checkout' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    // Liên kết Đăng ký giữ next
    expect(screen.getByRole('link', { name: /create|register|sign up/i }).getAttribute('href')).toContain('next=%2Fen%2Fcart')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'an@moc.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'matkhau123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Cart' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Cart (3)' })).toHaveAttribute('href', '/en/cart')
    expect(srv.log.filter((l) => l.key === 'merge').map((l) => l.body)).toEqual([{ items: [{ slug: 'den-nguyet', quantity: 2 }] }])
    expect(srv.log.find((l) => l.key === 'merge').url).toContain('lang=en')
    expect(localStorage.getItem('moc.cart')).toBeNull()
  })

  it('đăng nhập khi đang có yêu cầu quote chậm → kết quả quote cũ không ghi đè giỏ đã gộp', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 1 }]))
    const srv = fakeServer()
    await srv.cart.setQuantity('u1', 'den-vong', 4, 'vi')
    let release
    const gate = new Promise((r) => (release = r))
    const quoteHandler = srv.handlers['POST /cart/quote']
    mockApi({
      ...srv.handlers,
      'POST /cart/quote': async (u, init) => {
        await gate
        return quoteHandler(u, init)
      },
    })
    renderAt('/login?next=/cart')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'an@moc.test' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (5)' })).toBeInTheDocument()
    await act(async () => release())
    await flush()
    expect(screen.getByRole('link', { name: /^Giỏ hàng/ }).textContent).toBe('Giỏ hàng (5)')
  })

  it('mọi dòng đều không còn bán → nút Thanh toán bị vô hiệu', async () => {
    const srv = fakeServer()
    for (const s of ['den-nguyet', 'den-vong']) {
      const p = await srv.repo.getProductBySlug(s)
      await srv.repo.updateProduct(p.id, { status: 'hidden' })
    }
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 1 }, { slug: 'den-vong', quantity: 1 }]))
    mockApi(srv.handlers)
    renderAt('/cart')
    expect(await screen.findByRole('button', { name: 'Thanh toán' })).toBeDisabled()
    expect(screen.getAllByText('Sản phẩm này hiện không còn bán — vui lòng xoá khỏi giỏ.')).toHaveLength(2)
  })

  it('đã đăng nhập: bấm Thanh toán → sang trang checkout (FR-CHK-001)', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const srv = fakeServer()
    await srv.cart.setQuantity('u1', 'den-nguyet', 1, 'vi')
    mockApi(srv.handlers)
    renderAt('/cart')
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán' }))
    expect(await screen.findByRole('heading', { name: 'Thanh toán', level: 1 })).toBeInTheDocument()
  })
})

describe('Lỗi mạng', () => {
  it('vãng lai: thêm khi mất mạng → hiện lỗi, giỏ trình duyệt không mất', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-vong', quantity: 1 }]))
    const srv = fakeServer()
    const f = mockApi(srv.handlers)
    renderAt('/')
    const card = (await screen.findByText('Đèn Nguyệt', { selector: '.product-card a' })).closest('.product-card')
    await screen.findByRole('link', { name: 'Giỏ hàng (1)' })
    f.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    fireEvent.click(within(card).getByRole('button', { name: 'Tặng ngay' }))
    expect(await within(card).findByText('Không kết nối được máy chủ. Vui lòng thử lại.')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('moc.cart'))
    expect(saved).toEqual(expect.arrayContaining([{ slug: 'den-vong', quantity: 1 }]))
  })

  it('đã đăng nhập: PUT lỗi mạng → hiện lỗi, giỏ hiển thị giữ nguyên', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const srv = fakeServer({ fail: { put: () => Promise.reject(new TypeError('Failed to fetch')) } })
    await srv.cart.setQuantity('u1', 'den-vong', 2, 'vi')
    mockApi(srv.handlers)
    renderAt('/')
    const card = (await screen.findByText('Đèn Nguyệt', { selector: '.product-card a' })).closest('.product-card')
    await screen.findByRole('link', { name: 'Giỏ hàng (2)' })
    fireEvent.click(within(card).getByRole('button', { name: 'Tặng ngay' }))
    expect(await within(card).findByText(/Vui lòng thử lại/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Giỏ hàng (2)' })).toBeInTheDocument()
  })

  it('tải giỏ lỗi → trang giỏ hiện lỗi, không vỡ', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-vong', quantity: 1 }]))
    mockApi(fakeServer({ fail: { quote: () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) } }).handlers)
    renderAt('/cart')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('moc.cart'))).toEqual([{ slug: 'den-vong', quantity: 1 }])
  })
})

describe('Tour Mây (US-010 AC-003)', () => {
  it('không tự bật ở /cart', async () => {
    localStorage.removeItem('moc.tour.done')
    mockApi(fakeServer().handlers)
    renderAt('/cart')
    await screen.findByText('Giỏ hàng đang trống.')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1000))
    })
    expect(document.querySelector('.tour-pop')).toBeNull()
  })
})

describe('QuantityInput (D-60)', () => {
  function Harness({ initial = 1, calls }) {
    const [v, setV] = useState(initial)
    return (
      <LocaleProvider lang="vi">
        <QuantityInput
          value={v}
          onChange={(q) => {
            calls.push(q)
            setV(q)
          }}
        />
      </LocaleProvider>
    )
  }

  it('không cho < 1 hoặc > 10', () => {
    const calls = []
    render(<Harness calls={calls} />)
    const input = screen.getByRole('spinbutton')
    expect(screen.getByRole('button', { name: 'Giảm số lượng' })).toBeDisabled()
    for (const v of ['0', '-5', '99', '1e9', '10', '11', 'abc', '']) fireEvent.change(input, { target: { value: v } })
    expect(calls.every((q) => Number.isInteger(q) && q >= 1 && q <= 10)).toBe(true)
    expect(input.value).toBe('10')
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled()
    expect(input).toHaveAttribute('min', '1')
    expect(input).toHaveAttribute('max', '10')
  })
})

describe('Không có chuỗi tiếng Việt cứng (NFR-L10N)', () => {
  const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
  it.each(['src/cart/AddToCart.jsx', 'src/cart/QuantityInput.jsx', 'src/cart/CartProvider.jsx', 'src/pages/CartPage.jsx'])('%s', (file) => {
    const code = readFileSync(`${process.cwd()}/${file}`, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    const bad = code.split('\n').filter((l) => VI.test(l))
    expect(bad).toEqual([])
  })
})
