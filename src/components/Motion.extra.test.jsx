// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho đợt đổi giao diện "tranh Đông Hồ": motion, header, hero, FAQ, hoạ tiết.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'
import Lantern from './Lantern.jsx'
import { Cloud, DrumSun, Lotus, OldPhoto, VerticalSeal } from './Motifs.jsx'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '/', en: '/en', zh: '/zh' }

const handlers = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({
    body: {
      items: [
        ...faqVi.items,
        { id: 'f2', question: 'Câu hỏi hai?', answer: 'Trả lời hai.' },
      ],
    },
  }),
}

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const sourceFiles = (dir) =>
  readdirSync(join(process.cwd(), dir))
    .filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => [`${dir}/${f}`, readFileSync(join(process.cwd(), dir, f), 'utf8')])

afterEach(() => {
  vi.unstubAllGlobals()
  window.scrollY = 0
})

describe('LazyMotion strict — không dùng motion.* dưới LocaleLayout', () => {
  it('src/pages, src/components, src/pages/auth: không có motion.xxx / <motion.xxx / import { motion }', () => {
    const hits = []
    for (const dir of ['src/pages', 'src/pages/auth', 'src/components', 'src/seo', 'src/i18n']) {
      for (const [file, src] of sourceFiles(dir)) {
        const code = stripComments(src)
        code.split('\n').forEach((line, i) => {
          if (/(^|[^\w.'"/])motion\.[a-zA-Z]/.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`)
        })
        if (/import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/.test(code))
          hits.push(`${file}: import { motion } from 'framer-motion'`)
      }
    }
    expect(hits).toEqual([])
  })

  it('render trang chủ dưới LazyMotion strict không ném lỗi', async () => {
    mockApi(handlers)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt('/')
    await screen.findByText('Lưu bao lâu?')
    const strictErrors = errors.mock.calls.filter((c) => /LazyMotion|strict/i.test(String(c[0])))
    errors.mockRestore()
    expect(strictErrors).toEqual([])
  })
})

describe('Hero — tiêu đề tách từng từ nhưng không dính chữ', () => {
  it.each(['vi', 'en', 'zh'])('%s: h1 = hero.title1 + hero.title2, khoảng trắng đúng', async (lang) => {
    mockApi(handlers)
    renderAt(PREFIX[lang])
    const h1 = screen.getByRole('heading', { level: 1 })
    const { title1, title2 } = MESSAGES[lang].hero
    // <br/> không thêm ký tự → textContent là nối trực tiếp hai dòng
    expect(h1.textContent).toBe(`${title1}${title2}`)
    const words = [...h1.querySelectorAll('.word')].map((w) => w.textContent)
    expect(words).toEqual([...title1.split(' '), ...title2.split(' ')])
    expect(h1.querySelector('.h1-accent').textContent).toBe(title2)
    await screen.findAllByText(productsVi.items[0].name)
  })
})

describe('Header — logo con dấu và tự ẩn khi cuộn', () => {
  it.each(['vi', 'en', 'zh'])('%s: .nav-mark là link về trang chủ theo ngôn ngữ, có tên truy cập được', async (lang) => {
    mockApi(handlers)
    renderAt(lang === 'vi' ? '/account' : `/${lang}/account`)
    const mark = await screen.findByRole('link', { name: 'LAMVI' })
    expect(mark.tagName).toBe('A')
    expect(mark).toHaveAttribute('href', PREFIX[lang])
    expect(screen.getByRole('link', { name: 'LAMVI' })).toBe(mark)
    expect(mark.querySelector('.seal')).not.toBeNull()
  })

  // jsdom không có document.scrollingElement → framer useScroll() không gắn listener (noop).
  // Giả lập bằng documentElement để mô phỏng cuộn trang.
  it('cuộn xuống → header thu nhỏ (is-scrolled) và KHÔNG bao giờ ẩn đi; về đầu trang thì trở lại (D-86)', async () => {
    Object.defineProperty(document, 'scrollingElement', { value: document.documentElement, configurable: true })
    mockApi(handlers)
    const { container } = renderAt('/')
    const header = container.querySelector('header.nav')
    expect(header).not.toHaveClass('is-scrolled')

    const scrollTo = async (y) => {
      window.scrollY = y
      window.pageYOffset = y
      document.documentElement.scrollTop = y
      await act(async () => {
        window.dispatchEvent(new Event('scroll'))
        await new Promise((r) => setTimeout(r, 50))
      })
    }
    await scrollTo(100)
    await waitFor(() => expect(header).toHaveClass('is-scrolled'))
    await scrollTo(600)
    expect(header).toHaveClass('is-scrolled')
    expect(header).not.toHaveClass('is-hidden')
    await scrollTo(400)
    expect(header).not.toHaveClass('is-hidden')
    await scrollTo(0)
    await waitFor(() => expect(header).not.toHaveClass('is-scrolled'))
    delete document.scrollingElement
  })

  it('CSS: .nav.is-scrolled thu nhỏ 20% và bo tròn; không còn .is-hidden', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/App.css'), 'utf8')
    const m = css.match(/\.nav\.is-scrolled\s*\{([^}]*)\}/)
    expect(m).not.toBeNull()
    expect(m[1]).toMatch(/scale\(0\.8\)/)
    expect(m[1]).toMatch(/border-radius:\s*9999px/)
    expect(css).not.toMatch(/\.nav\.is-hidden/)
  })
})

describe('Bộ sưu tập một mạch (D-83)', () => {
  it.each(['vi', 'en', 'zh'])('%s: không còn tab Mua tặng / Mua cho mình; chỉ một đoạn mô tả chung', async (lang) => {
    mockApi(handlers)
    renderAt(PREFIX[lang])
    const p = MESSAGES[lang].products
    expect(document.querySelector('.intent-toggle')).toBeNull()
    expect(screen.queryByRole('button', { name: /Mua tặng|Mua cho mình/ })).toBeNull()
    expect(screen.getByText(p.collectionCopy)).toBeInTheDocument()
  })

  it('nút thêm vào giỏ chỉ có một nhãn (FR-CART-001)', async () => {
    mockApi(handlers)
    renderAt('/')
    await screen.findAllByText(productsVi.items[0].name)
    expect(screen.getAllByRole('button', { name: viMsg.cart.add })[0]).toBeInTheDocument()
  })
})

describe('FAQ — mở/đóng có animation', () => {
  it('icon "+" aria-hidden; tên nút là câu hỏi; aria-expanded đúng khi mở/đóng', async () => {
    mockApi(handlers)
    renderAt('/')
    const q1 = await screen.findByRole('button', { name: 'Lưu bao lâu?' })
    const q2 = screen.getByRole('button', { name: 'Câu hỏi hai?' })
    for (const q of [q1, q2]) expect(q.querySelector('.faq-icon')).toHaveAttribute('aria-hidden', 'true')

    expect(q1).toHaveAttribute('aria-expanded', 'true')
    expect(q2).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Chữ vĩnh viễn, media 30 ngày.')).toBeInTheDocument()

    fireEvent.click(q2)
    expect(q2).toHaveAttribute('aria-expanded', 'true')
    expect(q1).toHaveAttribute('aria-expanded', 'false')
    expect(await screen.findByText('Trả lời hai.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Chữ vĩnh viễn, media 30 ngày.')).toBeNull())

    fireEvent.click(q2)
    expect(q2).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByText('Trả lời hai.')).toBeNull())
  })
})

describe('Marquee', () => {
  it('bản sao thứ hai aria-hidden, bản đầu đọc được; không còn ký tự ✦', async () => {
    mockApi(handlers)
    const { container } = renderAt('/')
    const lines = container.querySelectorAll('.marquee-line')
    expect(lines).toHaveLength(2)
    expect(lines[0]).not.toHaveAttribute('aria-hidden')
    expect(lines[1]).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.marquee').textContent).not.toContain('✦')
    for (const item of viMsg.marquee) expect(lines[0].textContent).toContain(item)
    lines[0].querySelectorAll('svg').forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'))
  })
})

describe('Hoạ tiết SVG trang trí đều aria-hidden', () => {
  it.each([
    ['DrumSun', <DrumSun key="d" />],
    ['Cloud', <Cloud key="c" />],
    ['Lotus', <Lotus key="l" />],
    ['OldPhoto', <OldPhoto key="o"><rect width="1" height="1" /></OldPhoto>],
    ['Lantern', <Lantern key="n" />],
  ])('%s', (_, el) => {
    const { container } = render(el)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('VerticalSeal: ấn triện dọc aria-hidden, mỗi ký tự một ô, giữ nguyên chữ có dấu', () => {
    const { container } = render(<VerticalSeal label="MỘC" />)
    const seal = container.firstChild
    expect(seal).toHaveAttribute('aria-hidden', 'true')
    expect([...seal.children].map((c) => c.textContent)).toEqual(['M', 'Ộ', 'C'])
  })

  it('trên trang chủ: mọi <svg> đều aria-hidden hoặc nằm trong vùng aria-hidden', async () => {
    mockApi(handlers)
    const { container } = renderAt('/')
    await screen.findAllByText(productsVi.items[0].name)
    const exposed = [...container.querySelectorAll('svg')].filter((s) => !s.closest('[aria-hidden="true"]'))
    expect(exposed.map((s) => s.outerHTML.slice(0, 80))).toEqual([])
  })
})

describe('G-08: file mới không có chuỗi tiếng Việt viết cứng', () => {
  const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
  it.each(['src/components/Motifs.jsx', 'src/components/Reveal.jsx', 'src/lib/motion.js'])('%s', (file) => {
    const hits = stripComments(readFileSync(join(process.cwd(), file), 'utf8'))
      .split('\n')
      .map((l, i) => [l.split('MỘC').join(''), i])
      .filter(([l]) => VI_CHARS.test(l))
      .map(([, i]) => `${file}:${i + 1}`)
    expect(hits).toEqual([])
  })
})

describe('Số liệu CountUp trên trang', () => {
  it('trình đọc màn hình đọc "100+", "12", "32", "4.000+" (sr-only)', async () => {
    mockApi(handlers)
    const { container } = renderAt('/')
    const sr = [...container.querySelectorAll('strong > .sr-only')].map((s) => s.textContent)
    expect(sr).toEqual(expect.arrayContaining(['100+', '12', '1', '32', '4.000+']))
  })
})
