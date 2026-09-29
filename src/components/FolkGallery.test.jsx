// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, within } from '@testing-library/react'
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

  it.each(['vi', 'en', 'zh'])('%s: tên, alt, nguồn theo ngôn ngữ; ảnh lazy và có kích thước', (lang) => {
    const { container } = renderGallery(lang)
    const figures = container.querySelectorAll('figure.folk-print')
    expect(figures).toHaveLength(FOLK_ART.length)
    FOLK_ART.forEach((art, i) => {
      const item = MESSAGES[lang].gallery.items[art.id]
      expect(item, `${lang} thiếu gallery.items.${art.id}`).toBeTruthy()
      const fig = figures[i]
      const img = fig.querySelector('img')
      expect(img).toHaveAttribute('alt', item.alt)
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('width', String(art.width))
      expect(img).toHaveAttribute('height', String(art.height))
      for (const w of art.widths) expect(img.getAttribute('srcset')).toContain(`${folkSrc(art.id, w)} ${w}w`)
      expect(img.getAttribute('sizes')).toMatch(/px/)
      expect(within(fig).getByText(item.name)).toBeInTheDocument()
      const link = within(fig).getByRole('link')
      expect(link).toHaveAttribute('href', art.source)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    })
  })

  it.each(['vi', 'en', 'zh'])('%s: ghi chú nói rõ không phải ảnh sản phẩm (design-rules §7.2)', (lang) => {
    const { container } = renderGallery(lang)
    const note = container.querySelector('.folk-gallery-note')
    expect(note).toHaveTextContent(MESSAGES[lang].gallery.note)
    expect(MESSAGES[lang].gallery.note).toMatch(/không phải ảnh sản phẩm|not photos of LAMVI products|并非 LAMVI 的产品照片/)
  })

  it('dải tranh là vùng cuộn truy cập được bằng bàn phím', () => {
    const { container } = renderGallery('vi')
    const track = container.querySelector('.folk-gallery-track')
    expect(track).toHaveAttribute('role', 'list')
    expect(track).toHaveAttribute('tabindex', '0')
    expect(track).toHaveAttribute('aria-label', viMsg.gallery.label)
  })
})
