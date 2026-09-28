// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi as vitest } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useApi } from '../api/useApi.js'
import { useNoIndex } from '../hooks/useNoIndex.js'
import { LocaleContext } from '../i18n/index.js'
import Price from './Price.jsx'
import Marquee from './Marquee.jsx'
import Faq from './Faq.jsx'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }

// Gom mọi chuỗi trong file messages
const strings = (v) =>
  typeof v === 'string' ? [v] : Array.isArray(v) || (v && typeof v === 'object') ? Object.values(v).flatMap(strings) : []

// §31.3 — cụm từ cam kết sai (so khớp không phân biệt hoa thường)
const BANNED = [
  'lưu giữ lâu dài',
  'của chính chiếc đèn này',
  'gắn mã riêng',
  'theo dõi đèn của bạn từng bước',
  'lưu giữ ký ức vĩnh viễn',
  'câu chuyện riêng mỗi đèn',
  'sổ lưu niệm',
]

const PERMANENT = /vĩnh viễn|forever|permanent|永久|lâu dài|long-term|长期/i
const GIFT_VOICE = /giọng nói|voice|语音/i
const VIDEO = /video|视频/i
const BATCH = /\blô\b|lô đèn|batch|批次/i

// D-26: giọng nói/video lời chúc chỉ lưu 30 ngày → câu nào nhắc giọng nói hoặc video (không phải video lô) không được kèm "vĩnh viễn"
function mediaPermanenceViolations(text) {
  return text
    .split(/[.;。；\n]/)
    .filter((seg) => PERMANENT.test(seg) && (GIFT_VOICE.test(seg) || (VIDEO.test(seg) && !BATCH.test(seg))))
}

function bannedIn(text) {
  const low = text.toLowerCase()
  return BANNED.filter((b) => low.includes(b))
}

describe('§31.3 — nội dung trong file messages', () => {
  for (const [lang, msg] of Object.entries(MESSAGES)) {
    it(`${lang}: không còn cụm từ cam kết sai`, () => {
      const all = strings(msg).join('\n')
      expect(bannedIn(all)).toEqual([])
    })

    it(`${lang}: không hứa lưu giọng nói/video lời chúc vĩnh viễn (D-26)`, () => {
      const bad = strings(msg).flatMap(mediaPermanenceViolations)
      expect(bad).toEqual([])
    })

    it(`${lang}: có nêu mốc 30 ngày cho giọng nói/video`, () => {
      const all = strings(msg).join('\n')
      expect(all).toMatch(/30/)
    })
  }

  // Phát hiện thêm: câu "story.text" hứa câu chuyện gia đình được lưu giữ "bền bỉ / enduringly / 长久地保存"
  // — cùng loại cam kết "lưu giữ lâu dài" mà D-26 bác bỏ
  it('không có diễn đạt khác của "lưu giữ lâu dài" (vi/en/zh)', () => {
    const bad = [
      ...strings(viMsg).filter((s) => /lưu giữ[^.;]*bền bỉ/i.test(s)),
      ...strings(enMsg).filter((s) => /kept[^.;]*(enduring|long-term|for a long time)/i.test(s)),
      ...strings(zhMsg).filter((s) => /长久|长期保存/.test(s)),
    ]
    expect(bad).toEqual([])
  })
})

describe('§31.3 — nội dung render ra DOM', () => {
  const faqNeutral = { items: [{ id: 'f1', question: 'Q?', answer: 'A.' }] }
  for (const [lang, prefix] of [['vi', '/'], ['en', '/en'], ['zh', '/zh']]) {
    it(`${lang}: trang chủ không hiển thị cam kết sai`, async () => {
      mockApi({
        'GET /products': () => ({ body: productsVi }),
        'GET /faq': () => ({ body: faqNeutral }),
      })
      renderAt(prefix)
      await screen.findByText('Q?')
      // Nối từng nút chữ bằng xuống dòng để các mục danh sách không dính vào nhau
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const parts = []
      while (walker.nextNode()) parts.push(walker.currentNode.nodeValue)
      const text = parts.join('\n')
      expect(bannedIn(text)).toEqual([])
      expect(mediaPermanenceViolations(text)).toEqual([])
      // marquee cũ
      expect(text).not.toMatch(/LƯU GIỮ KÝ ỨC VĨNH VIỄN/)
      // qr.points đã render
      expect(text).toContain(MESSAGES[lang].qr.points[2])
    })
  }
})

describe('Không còn chuỗi tiếng Việt viết cứng trong JSX (G-08)', () => {
  const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
  // Tên thương hiệu không dịch
  const ALLOW = ['MỘC']
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  for (const dir of ['src/pages', 'src/components']) {
    it(`${dir}: không có ký tự tiếng Việt ngoài comment`, () => {
      const root = join(process.cwd(), dir)
      const files = readdirSync(root).filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f))
      const hits = []
      for (const f of files) {
        stripComments(readFileSync(join(root, f), 'utf8'))
          .split('\n')
          .forEach((line, i) => {
            let l = line
            for (const a of ALLOW) l = l.split(a).join('')
            if (VI_CHARS.test(l)) hits.push(`${dir}/${f}:${i + 1}: ${line.trim()}`)
          })
      }
      expect(hits).toEqual([])
    })
  }
})

describe('Price — BR-PRC-003', () => {
  const renderPrice = (lang, amount) =>
    render(
      <LocaleContext.Provider value={lang}>
        <Price amount={amount} />
      </LocaleContext.Provider>,
    )

  it.each(['vi', 'en', 'zh'])('%s: có chú thích chưa gồm VAT', (lang) => {
    const { container } = renderPrice(lang, 890000)
    expect(container.querySelector('.price-note')).toHaveTextContent(MESSAGES[lang].price.exclVat)
    expect(MESSAGES[lang].price.exclVat).toMatch(/VAT|增值税/)
  })

  it('định dạng VND số nguyên, dấu chấm hàng nghìn, không có phần thập phân', () => {
    const { container } = renderPrice('en', 1680000)
    const txt = container.querySelector('.product-price').textContent
    expect(txt).toMatch(/^1\.680\.000\s₫$/)
  })

  it('số lẻ vẫn hiển thị không có phần thập phân', () => {
    const { container } = renderPrice('vi', 890000.6)
    expect(container.querySelector('.product-price').textContent).not.toMatch(/,\d/)
  })
})

describe('Marquee', () => {
  it.each(['vi', 'en', 'zh'])('%s: hiển thị marquee theo ngôn ngữ, không có cam kết vĩnh viễn', (lang) => {
    const { container } = render(
      <LocaleContext.Provider value={lang}>
        <Marquee />
      </LocaleContext.Provider>,
    )
    const txt = container.textContent
    expect(txt).toContain(MESSAGES[lang].marquee[0])
    expect(txt).not.toMatch(/vĩnh viễn|forever|永久/i)
    // Bản sao thứ hai ẩn với trình đọc màn hình
    expect(container.querySelectorAll('.marquee-track span')[1]).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Faq — G-07', () => {
  const renderFaq = (lang) =>
    render(
      <MemoryRouter>
        <LocaleContext.Provider value={lang}>
          <Faq />
        </LocaleContext.Provider>
      </MemoryRouter>,
    )

  it('gọi /faq theo ngôn ngữ và hiện câu hỏi, mục đầu mở sẵn', async () => {
    const f = mockApi({ 'GET /faq': () => ({ body: { items: [{ id: 'a', question: 'Q1', answer: 'A1' }, { id: 'b', question: 'Q2', answer: 'A2' }] } }) })
    renderFaq('zh')
    expect(await screen.findByText('Q1')).toBeInTheDocument()
    expect(String(f.mock.calls[0][0])).toBe('/api/faq?lang=zh')
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Q1/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Q2/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it.each(['vi', 'en', 'zh'])('%s: API lỗi → thông báo lỗi đúng ngôn ngữ', async (lang) => {
    mockApi({ 'GET /faq': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderFaq(lang)
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES[lang].faq.error)
  })
})

describe('useApi', () => {
  function deferredFetch() {
    const pending = []
    const fn = vitest.fn(
      (url) =>
        new Promise((resolve) => {
          pending.push({ url: String(url), resolve })
        }),
    )
    vitest.stubGlobal('fetch', fn)
    const respond = (match, body) => {
      const p = pending.find((x) => x.url.includes(match))
      p.resolve(new Response(JSON.stringify(body), { status: 200 }))
    }
    return { fn, respond }
  }

  it('đổi ngôn ngữ → gọi lại API, trạng thái loading, không trả dữ liệu cũ', async () => {
    const { fn, respond } = deferredFetch()
    const { result, rerender } = renderHook(({ lang }) => useApi('/faq', lang), { initialProps: { lang: 'vi' } })
    expect(result.current.status).toBe('loading')
    await act(async () => respond('lang=vi', { v: 'vi' }))
    expect(result.current).toMatchObject({ status: 'ok', data: { v: 'vi' } })

    rerender({ lang: 'en' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(String(fn.mock.calls[1][0])).toContain('lang=en')
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeUndefined()
    await act(async () => respond('lang=en', { v: 'en' }))
    expect(result.current.data).toEqual({ v: 'en' })
  })

  it('race: phản hồi của ngôn ngữ cũ về sau không ghi đè ngôn ngữ mới', async () => {
    const { respond } = deferredFetch()
    const { result, rerender } = renderHook(({ lang }) => useApi('/products', lang), { initialProps: { lang: 'vi' } })
    rerender({ lang: 'zh' })
    await act(async () => respond('lang=zh', { v: 'zh' }))
    expect(result.current.data).toEqual({ v: 'zh' })
    await act(async () => respond('lang=vi', { v: 'vi' }))
    expect(result.current.data).toEqual({ v: 'zh' })
  })

  it('lỗi → status error kèm ApiError', async () => {
    mockApi({})
    const { result } = renderHook(() => useApi('/khong-co', 'vi'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.status).toBe(404)
  })
})

describe('useNoIndex — BR-SEO-001', () => {
  const robots = () => document.head.querySelectorAll('meta[name="robots"]')

  it('mount thêm meta robots=noindex, unmount gỡ đi', () => {
    expect(robots()).toHaveLength(0)
    const { unmount } = renderHook(() => useNoIndex())
    expect(robots()).toHaveLength(1)
    expect(robots()[0].getAttribute('content')).toMatch(/noindex/)
    unmount()
    expect(robots()).toHaveLength(0)
  })

  it('trang thường (trang chủ) không có noindex', async () => {
    mockApi({ 'GET /products': () => ({ body: productsVi }), 'GET /faq': () => ({ body: { items: [] } }) })
    renderAt('/')
    await screen.findAllByText('Đèn Nguyệt')
    expect(robots()).toHaveLength(0)
  })
})
