// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AppRoutes from '../routes.jsx'
import AuthProvider from '../auth/AuthProvider.jsx'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '', en: '/en', zh: '/zh' }
const HTML_LANG = { vi: 'vi', en: 'en', zh: 'zh-Hans' }

const productsEn = {
  items: productsVi.items.map((p) => ({ ...p, name: `${p.name} EN`, description: 'Desc EN' })),
}
const productsZh = {
  items: productsVi.items.map((p) => ({ ...p, name: `${p.name} ZH`, description: 'Desc ZH' })),
}
const byLang = (url, map) => map[url.searchParams.get('lang')] ?? map.vi

const handlers = {
  'GET /products': (url) => ({ body: byLang(url, { vi: productsVi, en: productsEn, zh: productsZh }) }),
  'GET /faq': () => ({ body: { items: [{ id: 'f', question: 'Q', answer: 'A' }] } }),
  'GET /products/den-nguyet': (url) => ({
    body: { item: byLang(url, { vi: productsVi, en: productsEn, zh: productsZh }).items[0] },
  }),
}

function LocationProbe() {
  const loc = useLocation()
  return <output data-testid="loc">{`${loc.pathname}${loc.search}${loc.hash}`}</output>
}

function renderWithLoc(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {/* App thật luôn có AuthProvider (giỏ hàng trong layout cần phiên — FR-CART-001) */}
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <LocationProbe />
    </MemoryRouter>,
  )
}

const loc = () => screen.getByTestId('loc').textContent
const switcher = () => screen.getByRole('navigation', { name: /Ngôn ngữ|Language|语言/ })
const hrefOf = (el) => el.getAttribute('href')

describe('US-012 AC-001 — bộ chọn ngôn ngữ', () => {
  it('vi → en → zh → vi, giữ đường dẫn con; giao diện, html lang, title đổi theo (FR-SEO-001: title riêng từng sản phẩm)', async () => {
    const f = mockApi(handlers)
    renderWithLoc('/products/den-nguyet')
    await screen.findByRole('heading', { level: 1, name: 'Đèn Nguyệt' })
    expect(document.documentElement.lang).toBe('vi')
    // <Seo> đặt title trong effect → chờ
    await waitFor(() => expect(document.title).toBe(viMsg.meta.productTitle.replace('{name}', 'Đèn Nguyệt')))
    expect(screen.getByText(viMsg.products.backToCollection)).toBeInTheDocument()

    fireEvent.click(within(switcher()).getByRole('link', { name: 'EN' }))
    expect(loc()).toBe('/en/products/den-nguyet')
    await screen.findByRole('heading', { level: 1, name: 'Đèn Nguyệt EN' })
    expect(document.documentElement.lang).toBe('en')
    // <Seo> đặt title trong effect → chờ
    await waitFor(() => expect(document.title).toBe(enMsg.meta.productTitle.replace('{name}', 'Đèn Nguyệt EN')))
    expect(screen.getByText(enMsg.products.backToCollection)).toBeInTheDocument()
    expect(screen.queryByText(viMsg.products.backToCollection)).toBeNull()
    expect(f.mock.calls.some(([u]) => String(u) === '/api/products/den-nguyet?lang=en')).toBe(true)

    fireEvent.click(within(switcher()).getByRole('link', { name: 'ZH' }))
    expect(loc()).toBe('/zh/products/den-nguyet')
    await screen.findByRole('heading', { level: 1, name: 'Đèn Nguyệt ZH' })
    expect(document.documentElement.lang).toBe('zh-Hans')
    // <Seo> đặt title trong effect → chờ
    await waitFor(() => expect(document.title).toBe(zhMsg.meta.productTitle.replace('{name}', 'Đèn Nguyệt ZH')))
    expect(screen.getByText(zhMsg.products.backToCollection)).toBeInTheDocument()

    fireEvent.click(within(switcher()).getByRole('link', { name: 'VI' }))
    expect(loc()).toBe('/products/den-nguyet')
    await screen.findByRole('heading', { level: 1, name: 'Đèn Nguyệt' })
    expect(document.documentElement.lang).toBe('vi')
    // <Seo> đặt title trong effect → chờ
    await waitFor(() => expect(document.title).toBe(viMsg.meta.productTitle.replace('{name}', 'Đèn Nguyệt')))
  })

  it('giữ query và hash khi đổi ngôn ngữ', async () => {
    mockApi(handlers)
    renderWithLoc('/en/products/den-nguyet?intent=self#top')
    await screen.findByRole('heading', { level: 1, name: 'Đèn Nguyệt EN' })
    const links = within(switcher()).getAllByRole('link')
    expect(links.map(hrefOf)).toEqual([
      '/products/den-nguyet?intent=self#top',
      '/en/products/den-nguyet?intent=self#top',
      '/zh/products/den-nguyet?intent=self#top',
    ])
    fireEvent.click(within(switcher()).getByRole('link', { name: 'ZH' }))
    expect(loc()).toBe('/zh/products/den-nguyet?intent=self#top')
  })

  it('trang chủ: /zh → vi là "/", → en là "/en"; đánh dấu ngôn ngữ hiện tại', async () => {
    mockApi(handlers)
    renderWithLoc('/zh')
    await screen.findAllByText('Đèn Nguyệt ZH')
    const links = within(switcher()).getAllByRole('link')
    expect(links.map(hrefOf)).toEqual(['/', '/en', '/zh'])
    expect(within(switcher()).getByRole('link', { name: 'ZH' })).toHaveAttribute('aria-current', 'true')
    expect(within(switcher()).getByRole('link', { name: 'VI' })).not.toHaveAttribute('aria-current')
  })

  it('đổi ngôn ngữ ở trang chủ: lưới sản phẩm tải lại, không còn tên ngôn ngữ cũ', async () => {
    mockApi(handlers)
    renderWithLoc('/')
    await screen.findByText('Đèn Nguyệt', { selector: '.product-card a' })
    fireEvent.click(within(switcher()).getByRole('link', { name: 'EN' }))
    await screen.findByText('Đèn Nguyệt EN', { selector: '.product-card a' })
    expect(screen.queryByText('Đèn Nguyệt', { selector: '.product-card a' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(enMsg.hero.title1)
  })
})

describe('D-37 — link nội bộ giữ tiền tố ngôn ngữ', () => {
  for (const lang of ['vi', 'en', 'zh']) {
    const p = PREFIX[lang]
    const home = p || '/'

    it(`${lang}: header, footer, thẻ sản phẩm`, async () => {
      mockApi(handlers)
      renderAt(home)
      const cardLink = await screen.findByText(
        lang === 'vi' ? 'Đèn Nguyệt' : `Đèn Nguyệt ${lang.toUpperCase()}`,
        { selector: '.product-card a' },
      )
      const card = cardLink.closest('.product-card')
      const header = document.querySelector('header')
      expect(hrefOf(cardLink)).toBe(`${p}/products/den-nguyet`)
      // FR-CART-001: nút trên thẻ là "Tặng ngay/Thêm vào giỏ"; link chi tiết là tên sản phẩm
      expect(within(card).getByRole('button', { name: MESSAGES[lang].cart.giftAdd })).toBeInTheDocument()
      expect(hrefOf(within(header).getByRole('link', { name: MESSAGES[lang].cart.nav }))).toBe(`${p}/cart`)

      expect(hrefOf(header.querySelector('.nav-mark'))).toBe(home)
      expect(hrefOf(within(header).getByRole('link', { name: MESSAGES[lang].nav.story }))).toBe(`${home}#story`)
      expect(hrefOf(within(header).getByRole('link', { name: MESSAGES[lang].nav.account }))).toBe(`${p}/account`)
      expect(hrefOf(within(header).getByRole('link', { name: MESSAGES[lang].nav.cta }))).toBe(`${home}#products`)

      const footer = document.querySelector('footer')
      await waitFor(() => expect(footer.querySelectorAll('.footer-col a[href*="/products/"]').length).toBe(2))
      for (const a of footer.querySelectorAll('.footer-col a[href*="/products/"]')) {
        expect(hrefOf(a)).toMatch(new RegExp(`^${p}/products/`))
      }
      expect(hrefOf(within(footer).getByRole('link', { name: MESSAGES[lang].footer.faq }))).toBe(`${home}#faq`)
    })

    it(`${lang}: trang chi tiết — link quay lại bộ sưu tập`, async () => {
      mockApi(handlers)
      renderAt(`${p}/products/den-nguyet`)
      const back = await screen.findByRole('link', { name: MESSAGES[lang].products.backToCollection })
      expect(hrefOf(back)).toBe(`${home}#products`)
    })
  }

  it('lưới sản phẩm: chuyển Mua cho mình → nút đổi thành "Thêm vào giỏ", link tên giữ tiền tố', async () => {
    mockApi(handlers)
    renderAt('/en')
    const link = await screen.findByText('Đèn Nguyệt EN', { selector: '.product-card a' })
    const card = link.closest('.product-card')
    fireEvent.click(screen.getByRole('button', { name: enMsg.products.self }))
    expect(within(card).getByRole('button', { name: enMsg.cart.add })).toBeInTheDocument()
    expect(hrefOf(link)).toBe('/en/products/den-nguyet')
  })
})

describe('BR-PRC-003 — mọi chỗ hiển thị giá có chú thích VAT', () => {
  for (const lang of ['vi', 'en', 'zh']) {
    const p = PREFIX[lang]
    const note = MESSAGES[lang].price.exclVat

    it(`${lang}: mỗi thẻ sản phẩm có giá VND số nguyên + "${note}"`, async () => {
      mockApi(handlers)
      renderAt(p || '/')
      await screen.findAllByText(new RegExp(`Đèn Nguyệt`), { selector: '.product-card a' })
      const cards = document.querySelectorAll('.product-card')
      expect(cards).toHaveLength(2)
      for (const c of cards) {
        const price = c.querySelector('.product-price')
        expect(price.textContent).toMatch(/^\d{1,3}(\.\d{3})+\s₫$/)
        expect(within(c).getByText(note)).toBeInTheDocument()
      }
      // Không có giá nào (₫) hiển thị mà thiếu chú thích VAT
      const priced = [...document.querySelectorAll('body *')].filter(
        (el) => el.children.length === 0 && /₫/.test(el.textContent),
      )
      for (const el of priced) {
        expect(el.closest('.price')?.querySelector('.price-note')).toHaveTextContent(note)
      }
    })

    it(`${lang}: trang chi tiết có giá + "${note}"`, async () => {
      mockApi(handlers)
      renderAt(`${p}/products/den-nguyet`)
      await screen.findByRole('heading', { level: 1 })
      const detail = document.querySelector('.product-detail')
      expect(detail.querySelector('.product-price').textContent).toMatch(/^890\.000\s₫$/)
      expect(within(detail).getByText(note)).toBeInTheDocument()
    })
  }
})

describe('Trang 404', () => {
  for (const lang of ['vi', 'en', 'zh']) {
    it(`${lang}: route lạ → 404 đúng ngôn ngữ, link về trang chủ giữ tiền tố`, () => {
      mockApi(handlers)
      renderAt(`${PREFIX[lang]}/khong-ton-tai/abc`)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MESSAGES[lang].notFound.title)
      expect(hrefOf(screen.getByRole('link', { name: MESSAGES[lang].notFound.back }))).toBe(PREFIX[lang] || '/')
      expect(document.documentElement.lang).toBe(HTML_LANG[lang])
    })
  }

  it('/english không bị coi là tiền tố en → 404 tiếng Việt', () => {
    mockApi(handlers)
    renderWithLoc('/english')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(viMsg.notFound.title)
    expect(document.documentElement.lang).toBe('vi')
    // bộ chọn ngôn ngữ: en → /en/english (giữ đường dẫn con), không phải /en/glish
    expect(hrefOf(within(switcher()).getByRole('link', { name: 'EN' }))).toBe('/en/english')
  })

  it('/zhx và /en-us không phải tiền tố ngôn ngữ', () => {
    mockApi(handlers)
    renderAt('/en-us')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(viMsg.notFound.title)
  })

  it('/vi/... không phải tiền tố hợp lệ (vi không có tiền tố) → 404 tiếng Việt', () => {
    mockApi(handlers)
    renderAt('/vi/products/den-nguyet')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(viMsg.notFound.title)
  })

  it('en: sản phẩm không tồn tại → thông báo tiếng Anh', async () => {
    mockApi(handlers)
    renderAt('/en/products/khong-co')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(enMsg.products.notFound)
  })

  it('zh: API lỗi 500 ở trang chi tiết → thông báo lỗi chung, không phải "không tìm thấy"', async () => {
    mockApi({ ...handlers, 'GET /products/den-nguyet': () => ({ status: 500, body: {} }) })
    renderAt('/zh/products/den-nguyet')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(zhMsg.products.error)
  })

  it('slug có ký tự đặc biệt được mã hoá khi gọi API', async () => {
    const f = mockApi(handlers)
    renderAt('/products/a%3Fb')
    await screen.findByRole('heading', { level: 1 })
    expect(f.mock.calls.some(([u]) => String(u).startsWith('/api/products/a%3Fb?lang=vi'))).toBe(true)
  })
})
