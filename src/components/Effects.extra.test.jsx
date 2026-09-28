// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho các hiệu ứng theo con trỏ (Effects.jsx), useFinePointer,
// trang chủ (ProcessTimeline, lời nghệ nhân tách từ) và quy ước LazyMotion strict / G-08.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'
import { useFinePointer, stamp } from '../lib/motion.js'
import { BrandHover, PointerGlow, TiltCard } from './Effects.jsx'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '/', en: '/en', zh: '/zh' }
const FINE = '(hover: hover) and (pointer: fine)'

// matchMedia điều khiển được: trạng thái chung + listener theo từng query.
// Cài ở top-level trước lần render đầu → framer-motion (initPrefersReducedMotion) cũng dùng mock này.
const media = { fine: false, reduce: false }
const listeners = new Map()
const matchesFor = (q) => {
  if (q === FINE) return media.fine
  if (/prefers-reduced-motion/.test(q)) return media.reduce
  return false
}
window.matchMedia = (query) => {
  if (!listeners.has(query)) listeners.set(query, new Set())
  const set = listeners.get(query)
  return {
    media: query,
    get matches() {
      return matchesFor(query)
    },
    addEventListener: (_t, cb) => set.add(cb),
    removeEventListener: (_t, cb) => set.delete(cb),
    addListener: (cb) => set.add(cb),
    removeListener: (cb) => set.delete(cb),
  }
}
const emit = (query) => {
  for (const cb of listeners.get(query) ?? []) cb({ matches: matchesFor(query), media: query })
}
const setMedia = (patch) => {
  Object.assign(media, patch)
  for (const q of listeners.keys()) emit(q)
}

const handlers = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: faqVi }),
}

const wrap = (ui, reducedMotion = 'never') => (
  <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion={reducedMotion}>{ui}</MotionConfig>
  </LazyMotion>
)

beforeEach(() => {
  media.fine = false
  media.reduce = false
})
afterEach(() => {
  vi.restoreAllMocks()
})

function Probe() {
  return <span data-testid="fine">{String(useFinePointer())}</span>
}

describe('useFinePointer', () => {
  it('renderToString → false (snapshot server), kể cả khi matchMedia trả true', () => {
    media.fine = true
    expect(renderToString(<Probe />)).toContain('false')
  })

  it('client: matchMedia matches=true → true', () => {
    media.fine = true
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('fine').textContent).toBe('true')
  })

  it('client: mặc định jsdom (thô) → false; phản ứng sự kiện change cả hai chiều', () => {
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('fine').textContent).toBe('false')
    act(() => setMedia({ fine: true }))
    expect(getByTestId('fine').textContent).toBe('true')
    act(() => setMedia({ fine: false }))
    expect(getByTestId('fine').textContent).toBe('false')
  })

  it('gỡ listener change khi unmount', () => {
    const { unmount } = render(<Probe />)
    expect(listeners.get(FINE)?.size).toBeGreaterThan(0)
    unmount()
    expect(listeners.get(FINE)?.size ?? 0).toBe(0)
  })
})

const card = (props = {}) => (
  <TiltCard className="product-card tone-amber" variants={stamp} custom={1} data-testid="card" {...props}>
    <div className="lift">con</div>
  </TiltCard>
)

describe('TiltCard', () => {
  it('pointer thô: không .card-spotlight, không is-tilt, không style rotate; vẫn render con và class', () => {
    const { getByTestId } = render(wrap(card()))
    const el = getByTestId('card')
    expect(el.tagName).toBe('ARTICLE')
    expect(el.className).toBe('product-card tone-amber')
    expect(el.querySelector('.card-spotlight')).toBeNull()
    expect(el.querySelector('.lift').textContent).toBe('con')
    expect(el.getAttribute('style') ?? '').not.toMatch(/rotate|perspective/)
    // Không gắn handler: pointermove không đổi gì
    fireEvent.pointerMove(el, { clientX: 10, clientY: 10 })
    expect(el.getAttribute('style') ?? '').not.toMatch(/rotate/)
  })

  it('pointer thô: biến thể vẫn hoạt động (trạng thái initial "below" của stamp áp vào thẻ)', () => {
    const { getByTestId } = render(wrap(<div>{card({ initial: 'below', animate: 'below' })}</div>))
    expect(getByTestId('card').style.opacity).toBe('0')
  })

  it('pointer mịn: có .card-spotlight aria-hidden, is-tilt; pointermove không lỗi; pointerleave đưa về 0', async () => {
    media.fine = true
    const { getByTestId } = render(wrap(card()))
    const el = getByTestId('card')
    expect(el).toHaveClass('is-tilt')
    const spot = el.querySelector('.card-spotlight')
    expect(spot).not.toBeNull()
    expect(spot.getAttribute('aria-hidden')).toBe('true')
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 300, right: 200, bottom: 300, x: 0, y: 0 })
    expect(() => {
      fireEvent.pointerEnter(el, { clientX: 0, clientY: 0 })
      fireEvent.pointerMove(el, { clientX: 200, clientY: 0 })
    }).not.toThrow()
    await waitFor(() => expect(el.style.transform).toMatch(/rotate[XY]\((?!0deg)/))
    fireEvent.pointerLeave(el)
    await waitFor(
      () => {
        const t = el.style.transform
        const nums = [...t.matchAll(/rotate[XY]\((-?[\d.e-]+)deg\)/g)].map((x) => Math.abs(Number(x[1])))
        expect(nums.every((n) => n < 0.05)).toBe(true)
      },
      { timeout: 3000 },
    )
  })

  it('giảm chuyển động (MotionConfig always) → tắt dù pointer mịn', () => {
    media.fine = true
    const { getByTestId } = render(wrap(card(), 'always'))
    const el = getByTestId('card')
    expect(el).not.toHaveClass('is-tilt')
    expect(el.querySelector('.card-spotlight')).toBeNull()
  })

  it('bật lại khi thiết bị chuyển từ thô sang mịn (sự kiện change)', () => {
    const { getByTestId } = render(wrap(card()))
    expect(getByTestId('card')).not.toHaveClass('is-tilt')
    act(() => setMedia({ fine: true }))
    expect(getByTestId('card')).toHaveClass('is-tilt')
  })
})

const onHost = (spy, el) => spy.mock.instances.filter((inst) => inst === el).map(() => 1)

describe('PointerGlow', () => {
  const host = () => (
    <div data-testid="host">
      <PointerGlow className="x" />
    </div>
  )

  it('pointer thô: aria-hidden, opacity 0, không gắn listener vào phần tử cha', () => {
    const add = vi.spyOn(HTMLDivElement.prototype, 'addEventListener')
    const { container, getByTestId } = render(wrap(host()))
    const glow = container.querySelector('.pointer-glow')
    expect(glow.getAttribute('aria-hidden')).toBe('true')
    expect(glow).toHaveClass('x')
    expect(glow.style.opacity).toBe('0')
    // React gắn listener ủy quyền lên container gốc → chỉ xét phần tử cha trực tiếp
    expect(onHost(add, getByTestId('host'))).toEqual([])
  })

  it('pointer mịn: gắn pointermove/enter/leave vào đúng phần tử cha và gỡ đúng hàm khi unmount', () => {
    media.fine = true
    const add = vi.spyOn(HTMLDivElement.prototype, 'addEventListener')
    const remove = vi.spyOn(HTMLDivElement.prototype, 'removeEventListener')
    const { getByTestId, unmount } = render(wrap(host()))
    const parent = getByTestId('host')
    const ours = add.mock.instances
      .map((inst, i) => [inst, add.mock.calls[i]])
      .filter(([inst, c]) => inst === parent && /^pointer/.test(c[0]))
      .map(([, c]) => c)
    expect(ours.map((c) => c[0]).sort()).toEqual(['pointerenter', 'pointerleave', 'pointermove'])
    // Sự kiện thật không lỗi
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 })
    expect(() => {
      parent.dispatchEvent(new MouseEvent('pointerenter', { clientX: 5, clientY: 5 }))
      parent.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 50 }))
      parent.dispatchEvent(new MouseEvent('pointerleave'))
    }).not.toThrow()
    unmount()
    const removed = remove.mock.instances
      .map((inst, i) => [inst, remove.mock.calls[i]])
      .filter(([inst, c]) => inst === parent && /^pointer/.test(c[0]))
      .map(([, c]) => c)
    for (const [type, fn] of ours) {
      expect(removed.some(([t, f]) => t === type && f === fn), `gỡ ${type}`).toBe(true)
    }
  })

  it('giảm chuyển động → không gắn listener dù pointer mịn', () => {
    media.fine = true
    const add = vi.spyOn(HTMLDivElement.prototype, 'addEventListener')
    const { getByTestId } = render(wrap(host(), 'always'))
    expect(onHost(add, getByTestId('host'))).toEqual([])
  })
})

describe('BrandHover', () => {
  it('aria-hidden, có chữ MỘC, fill url(#brandInk) trỏ tới gradient có thật trong cùng SVG', () => {
    const { container } = render(wrap(<BrandHover text="MỘC" />))
    const svg = container.querySelector('svg.brand-hover')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.textContent).toContain('MỘC')
    const fill = svg.querySelector('.brand-hover-fill')
    const m = /^url\(#(.+)\)$/.exec(fill.getAttribute('fill'))
    expect(m).not.toBeNull()
    const grad = svg.querySelector(`#${m[1]}`)
    expect(grad).not.toBeNull()
    expect(grad.tagName.toLowerCase()).toBe('radialgradient')
    expect(svg.querySelector('.brand-hover-stroke').getAttribute('stroke-dasharray')).toBe('900')
  })

  it('pointer mịn: pointermove/enter/leave trên SVG không lỗi', () => {
    media.fine = true
    const { container } = render(wrap(<BrandHover text="MỘC" />))
    const svg = container.querySelector('svg')
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 170 })
    expect(() => {
      fireEvent.pointerEnter(svg, { clientX: 1, clientY: 1 })
      fireEvent.pointerMove(svg, { clientX: 300, clientY: 80 })
      fireEvent.pointerLeave(svg)
    }).not.toThrow()
  })

  // id gradient sinh bằng useId() → dùng nhiều BrandHover trên cùng trang không trùng id
  it('hai BrandHover trên cùng trang → mỗi cái có id gradient riêng và fill trỏ đúng id của mình', () => {
    const { container } = render(
      wrap(
        <>
          <BrandHover text="MỘC" />
          <BrandHover text="MỘC" />
        </>,
      ),
    )
    const ids = [...container.querySelectorAll('radialGradient')].map((g) => g.id)
    expect(new Set(ids).size).toBe(2)
    for (const svg of container.querySelectorAll('svg.brand-hover')) {
      const id = svg.querySelector('radialGradient').id
      expect(svg.querySelector('.brand-hover-fill').getAttribute('fill')).toBe(`url(#${id})`)
    }
  })

  it('trang chủ thật chỉ có đúng 1 gradient brandInk (footer)', async () => {
    mockApi(handlers)
    const { container } = renderAt('/')
    await waitFor(() => expect(container.querySelector('.product-card')).not.toBeNull())
    expect(container.querySelectorAll('[id^="brandInk"]')).toHaveLength(1)
  })
})

describe('Trang chủ — thẻ sản phẩm dùng TiltCard', () => {
  it('pointer thô: thẻ là article.product-card, không spotlight; có .lift', async () => {
    mockApi(handlers)
    const { container } = renderAt('/')
    await waitFor(() => expect(container.querySelectorAll('article.product-card')).toHaveLength(productsVi.items.length))
    expect(container.querySelector('.card-spotlight')).toBeNull()
    expect(container.querySelector('.product-card.is-tilt')).toBeNull()
    expect(container.querySelectorAll('.product-card .lift').length).toBeGreaterThan(0)
  })

  it('pointer mịn: mỗi thẻ có spotlight', async () => {
    media.fine = true
    mockApi(handlers)
    const { container } = renderAt('/')
    await waitFor(() => expect(container.querySelectorAll('article.product-card')).toHaveLength(productsVi.items.length))
    expect(container.querySelectorAll('.product-card.is-tilt .card-spotlight')).toHaveLength(productsVi.items.length)
  })
})

describe('Trang chủ — ProcessTimeline', () => {
  it('đủ 4 bước (vi), .timeline-track aria-hidden, không còn li trang trí trong ol', async () => {
    mockApi(handlers)
    const { container } = renderAt('/')
    const steps = viMsg.process.steps
    expect(steps).toHaveLength(4)
    const lis = container.querySelectorAll('ol.timeline > li')
    expect(lis).toHaveLength(4)
    lis.forEach((li, i) => {
      expect(li.querySelector('.timeline-label').textContent).toBe(steps[i].label)
      expect(li.querySelector('.timeline-index').textContent).toBe(String(i + 1).padStart(2, '0'))
    })
    expect(container.querySelector('.timeline-track').getAttribute('aria-hidden')).toBe('true')
  })

  it('giảm chuyển động (thiết bị) → mọi li có is-lit, không có tia lửa chạy', async () => {
    setMedia({ reduce: true })
    mockApi(handlers)
    const { container } = renderAt('/')
    const lis = [...container.querySelectorAll('ol.timeline > li')]
    expect(lis).toHaveLength(4)
    expect(lis.every((li) => li.classList.contains('is-lit'))).toBe(true)
    expect(container.querySelector('.timeline-spark-rail')).toBeNull()
    setMedia({ reduce: false })
  })
})

describe('Trang chủ — lời nghệ nhân tách từ', () => {
  it.each(['vi', 'en', 'zh'])('%s: textContent của .artisan-quote bằng đúng artisan.quote', (lang) => {
    mockApi(handlers)
    const { container } = renderAt(PREFIX[lang])
    const q = container.querySelector('.artisan-quote')
    expect(q.textContent).toBe(MESSAGES[lang].artisan.quote)
    const words = [...q.querySelectorAll('.word')].map((w) => w.textContent)
    expect(words.join(' ')).toBe(MESSAGES[lang].artisan.quote)
  })
})

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('Quy ước mã nguồn', () => {
  it('không còn motion.xxx dưới src/components, src/pages (LazyMotion strict)', () => {
    const hits = []
    for (const dir of ['src/components', 'src/pages', 'src/pages/auth']) {
      for (const f of readdirSync(join(process.cwd(), dir))) {
        if (!/\.jsx?$/.test(f) || /\.test\./.test(f)) continue
        const code = stripComments(readFileSync(join(process.cwd(), dir, f), 'utf8'))
        code.split('\n').forEach((line, i) => {
          if (/(^|[^\w.'"/])motion\.[a-zA-Z]/.test(line)) hits.push(`${dir}/${f}:${i + 1}`)
        })
        if (/import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/.test(code)) hits.push(`${dir}/${f}: import motion`)
      }
    }
    expect(hits).toEqual([])
  })

  it('G-08: Effects.jsx không có chuỗi tiếng Việt viết cứng (ngoài comment; cho phép "MỘC")', () => {
    const code = stripComments(readFileSync(join(process.cwd(), 'src/components/Effects.jsx'), 'utf8'))
    const vi = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i
    const hits = code
      .split('\n')
      .map((l, i) => [i + 1, l.replace(/MỘC/g, '')])
      .filter(([, l]) => vi.test(l))
    expect(hits).toEqual([])
  })
})
