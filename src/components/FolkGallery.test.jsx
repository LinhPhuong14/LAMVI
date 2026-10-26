// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, within } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { LocaleContext } from '../i18n/index.js'
import FolkGallery from './FolkGallery.jsx'
import { FOLK_ART, folkSrc } from '../data/folkArt.js'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'

const MESSAGES = { vi: viMsg, en: enMsg, zh: zhMsg }

const renderGallery = (lang) =>
  render(
    <LocaleContext.Provider value={lang}>
      <LazyMotion features={domAnimation} strict>
        <FolkGallery />
      </LazyMotion>
    </LocaleContext.Provider>,
  )

describe('FolkGallery — ảnh tư liệu (T-27)', () => {
  it('có ít nhất một ảnh và mỗi độ rộng khai báo có file WebP thật trong public/', () => {
    expect(FOLK_ART.length).toBeGreaterThan(0)
    for (const art of FOLK_ART) {
      expect(art.widths.length).toBeGreaterThan(0)
      for (const w of art.widths) {
        expect(existsSync(join(process.cwd(), 'public', folkSrc(art.id, w)))).toBe(true)
      }
    }
  })

  it('chỉ dùng ảnh public domain hoặc CC0, có link trang gốc Wikimedia Commons', () => {
    for (const art of FOLK_ART) {
      expect(['Public domain', 'CC0']).toContain(art.license)
      expect(art.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
    }
  })

  it('mọi ảnh có ghi nguồn trong CREDITS.md', () => {
    const credits = readFileSync(join(process.cwd(), 'public/images/folk/CREDITS.md'), 'utf8')
    for (const art of FOLK_ART) expect(credits).toContain(art.source)
  })

  it.each(['vi', 'en', 'zh'])('%s: tranh lớn có tên, alt, nguồn theo ngôn ngữ; thumbnail lazy, có kích thước, aria-label = tên', (lang) => {
    const { container } = renderGallery(lang)
    const art0 = FOLK_ART[0]
    const item0 = MESSAGES[lang].gallery.items[art0.id]
    const feature = container.querySelector('figure.folk-feature')
    expect(feature).not.toBeNull()
    const big = feature.querySelector('img')
    expect(big).toHaveAttribute('alt', item0.alt)
    expect(big).toHaveAttribute('width', String(art0.width))
    expect(big).toHaveAttribute('height', String(art0.height))
    expect(within(feature).getByText(item0.name)).toBeInTheDocument()
    const link = within(feature).getByRole('link')
    expect(link).toHaveAttribute('href', art0.source)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')

    const thumbs = container.querySelectorAll('button.folk-thumb')
    expect(thumbs).toHaveLength(FOLK_ART.length)
    FOLK_ART.forEach((art, i) => {
      const item = MESSAGES[lang].gallery.items[art.id]
      expect(item, `${lang} thiếu gallery.items.${art.id}`).toBeTruthy()
      expect(thumbs[i]).toHaveAttribute('aria-label', item.name)
      const img = thumbs[i].querySelector('img')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('width', String(art.width))
      expect(img).toHaveAttribute('height', String(art.height))
      expect(img.getAttribute('src')).toContain(folkSrc(art.id, art.widths[0]))
    })
  })

  it.each(['vi', 'en', 'zh'])('%s: ghi chú nói rõ không phải ảnh sản phẩm (design-rules §7.2)', (lang) => {
    const { container } = renderGallery(lang)
    const note = container.querySelector('.folk-gallery-note')
    expect(note).toHaveTextContent(MESSAGES[lang].gallery.note)
    expect(MESSAGES[lang].gallery.note).toMatch(/không phải ảnh sản phẩm|not photos of LAMVI products|并非 LAMVI 的产品照片/)
  })

  it('không còn dải cuộn ngang; vùng là carousel có nhãn', () => {
    const { container } = renderGallery('vi')
    expect(container.querySelector('.folk-gallery-track')).toBeNull()
    const region = container.querySelector('.folk-gallery')
    expect(region).toHaveAttribute('role', 'region')
    expect(region).toHaveAttribute('aria-roledescription', 'carousel')
    expect(region).toHaveAttribute('aria-label', viMsg.gallery.label)
  })
})

describe('FolkGallery — sân khấu và tự chuyển (D-124)', () => {
  const realIO = window.IntersectionObserver
  beforeEach(() => {
    vi.useFakeTimers()
    window.IntersectionObserver = class {
      constructor(cb) {
        this.cb = cb
      }
      observe() {
        this.cb([{ isIntersecting: true }])
      }
      disconnect() {}
    }
  })
  afterEach(() => {
    vi.useRealTimers()
    window.IntersectionObserver = realIO
  })

  const stageName = (c) => c.querySelector('.folk-feature .folk-print-name').textContent
  const nameOf = (i) => viMsg.gallery.items[FOLK_ART[i].id].name
  const thumbs = (c) => [...c.querySelectorAll('button.folk-thumb')]

  it('mở đầu: tranh đầu tiên ở sân khấu, thumbnail đầu được đánh dấu', () => {
    const { container } = renderGallery('vi')
    expect(stageName(container)).toBe(nameOf(0))
    expect(thumbs(container)[0]).toHaveAttribute('aria-current', 'true')
    expect(thumbs(container)[0]).toHaveClass('is-on')
    expect(thumbs(container)[1]).toHaveAttribute('aria-current', 'false')
  })

  it('tự chuyển sang tranh kế sau 4500 ms, hết vòng thì quay lại tranh đầu', () => {
    const { container } = renderGallery('vi')
    act(() => vi.advanceTimersByTime(4499))
    expect(stageName(container)).toBe(nameOf(0))
    act(() => vi.advanceTimersByTime(1))
    expect(stageName(container)).toBe(nameOf(1))
    act(() => vi.advanceTimersByTime(4500 * (FOLK_ART.length - 1)))
    expect(stageName(container)).toBe(nameOf(0))
  })

  it('click thumbnail đổi tranh ở sân khấu', () => {
    const { container } = renderGallery('vi')
    fireEvent.click(thumbs(container)[2])
    expect(stageName(container)).toBe(nameOf(2))
    expect(thumbs(container)[2]).toHaveAttribute('aria-current', 'true')
    expect(container.querySelector('.folk-feature img')).toHaveAttribute('alt', viMsg.gallery.items[FOLK_ART[2].id].alt)
  })

  it('rê chuột vào thumbnail đưa tranh đó lên sân khấu; không có khung .hover-preview', () => {
    const { container } = renderGallery('vi')
    fireEvent.mouseEnter(thumbs(container)[3])
    expect(stageName(container)).toBe(nameOf(3))
    expect(document.querySelector('.hover-preview')).toBeNull()
  })

  it('rê chuột / focus vào khu vực thì tạm dừng, rời thì chạy tiếp', () => {
    const { container } = renderGallery('vi')
    const region = container.querySelector('.folk-gallery')
    fireEvent.mouseEnter(region)
    expect(thumbs(container)[0]).not.toHaveClass('is-running')
    act(() => vi.advanceTimersByTime(20000))
    expect(stageName(container)).toBe(nameOf(0))
    fireEvent.mouseLeave(region)
    act(() => vi.advanceTimersByTime(4500))
    expect(stageName(container)).toBe(nameOf(1))
    fireEvent.focus(region)
    act(() => vi.advanceTimersByTime(20000))
    expect(stageName(container)).toBe(nameOf(1))
    fireEvent.blur(region)
    act(() => vi.advanceTimersByTime(4500))
    expect(stageName(container)).toBe(nameOf(2))
  })

  it('ngoài màn hình thì không tự chuyển', () => {
    window.IntersectionObserver = class {
      constructor(cb) {
        this.cb = cb
      }
      observe() {
        this.cb([{ isIntersecting: false }])
      }
      disconnect() {}
    }
    const { container } = renderGallery('vi')
    act(() => vi.advanceTimersByTime(20000))
    expect(stageName(container)).toBe(nameOf(0))
  })
})
