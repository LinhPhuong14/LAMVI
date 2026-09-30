// Kiểm thử độc lập (T-11) — dựng URL tuyệt đối và JSON-LD mức production (FR-SEO-001, §23.2).
import { describe, expect, it } from 'vitest'
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildHeadTags,
  organizationJsonLd,
  renderHeadTags,
  safeJson,
  webSiteJsonLd,
} from './head.js'

const SITE = 'https://lamvi.test'

describe('absoluteUrl', () => {
  it('URL đã tuyệt đối giữ nguyên (không nối thêm siteUrl)', () => {
    expect(absoluteUrl(SITE, 'https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
    expect(absoluteUrl(SITE, 'HTTP://cdn.example/a.png')).toBe('HTTP://cdn.example/a.png')
  })

  it('đường dẫn không có "/" đầu vẫn ra URL hợp lệ', () => {
    expect(absoluteUrl(SITE, 'images/og/default.png')).toBe(`${SITE}/images/og/default.png`)
  })

  it('giá trị rỗng hoặc thiếu siteUrl → null (không sinh URL cụt)', () => {
    expect(absoluteUrl(SITE, '')).toBeNull()
    expect(absoluteUrl(SITE, null)).toBeNull()
    expect(absoluteUrl('', '/a.png')).toBeNull()
    expect(absoluteUrl(undefined, '/a.png')).toBeNull()
  })

  it('không tạo được URL có scheme nguy hiểm từ giá trị trong DB', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x']) {
      const out = absoluteUrl(SITE, bad)
      expect(out.startsWith(SITE)).toBe(true)
      expect(out).not.toMatch(/^(javascript|data|vbscript):/i)
    }
  })

  it('siteUrl có dấu "/" ở cuối không sinh URL hai gạch chéo', () => {
    expect(absoluteUrl('https://lamvi.test/', '/images/og/default.png')).toBe(
      'https://lamvi.test/images/og/default.png',
    )
    expect(absoluteUrl('https://lamvi.test///', 'images/a.png')).toBe('https://lamvi.test/images/a.png')
  })

  // ⚠️ Ràng buộc còn hở: chỉ absoluteUrl (và seoRouter) chuẩn hoá; canonical/hreflang/og:url và
  // @id của JSON-LD vẫn nối siteUrl thô → phụ thuộc hoàn toàn vào loadConfig đã cắt dấu "/" cuối.
  it('canonical và @id KHÔNG tự chuẩn hoá — bảo đảm nằm ở loadConfig', () => {
    const [canonical] = buildHeadTags({ lang: 'vi', siteUrl: 'https://lamvi.test/', path: '/products/x' }).filter(
      (t) => t.attrs?.rel === 'canonical',
    )
    expect(canonical.attrs.href).toBe('https://lamvi.test//products/x')
    expect(organizationJsonLd('https://lamvi.test/')['@id']).toBe('https://lamvi.test//#organization')
  })

  it('URL dạng //host (protocol-relative) không bị hiểu là đường dẫn nội bộ', () => {
    // Hiện tại thành `${siteUrl}//cdn.example/a.png` — vô hại nhưng là URL sai
    const out = absoluteUrl(SITE, '//cdn.example/a.png')
    expect(out).not.toBe('//cdn.example/a.png')
  })
})

describe('JSON-LD — nội dung độc từ DB', () => {
  const hostile = '</script><script>alert(1)</script>'

  it('tên sản phẩm chứa </script> không thoát được khối ld+json', () => {
    const block = breadcrumbJsonLd(SITE, 'vi', [
      { name: 'Trang chủ', path: '/' },
      { name: hostile, path: '/products/x' },
    ])
    const html = renderHeadTags(buildHeadTags({ lang: 'vi', siteUrl: SITE, path: '/products/x', jsonLd: block }))
    // Chỉ còn đúng các thẻ script do renderHeadTags mở/đóng
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).toContain('\\u003c/script')
  })

  it('safeJson thoát cả U+2028/U+2029 (ký tự phá cú pháp JS)', () => {
    const out = safeJson({ s: 'a\u2028b\u2029c<d' })
    expect(out).not.toContain('\u2028')
    expect(out).not.toContain('\u2029')
    expect(out).not.toContain('<')
    expect(JSON.parse(out).s).toBe('a\u2028b\u2029c<d')
  })

  it('mảng jsonLd bỏ qua phần tử null/undefined, giữ đúng thứ tự', () => {
    const tags = buildHeadTags({
      lang: 'vi',
      siteUrl: SITE,
      path: '/',
      jsonLd: [organizationJsonLd(SITE), null, undefined, webSiteJsonLd(SITE, { lang: 'vi' })],
    })
    const scripts = tags.filter((t) => t.tag === 'script')
    expect(scripts).toHaveLength(2)
    expect(JSON.parse(scripts[0].text)['@type']).toBe('Organization')
    expect(JSON.parse(scripts[1].text)['@type']).toBe('WebSite')
  })
})

describe('JSON-LD trang chủ — @id và 3 ngôn ngữ', () => {
  it('@id của Organization/WebSite giống nhau ở mọi ngôn ngữ (một thực thể duy nhất)', () => {
    const ids = new Set()
    for (const lang of ['vi', 'en', 'zh']) {
      const site = webSiteJsonLd(SITE, { lang })
      expect(site.publisher['@id']).toBe(organizationJsonLd(SITE)['@id'])
      ids.add(site['@id'])
    }
    expect(ids.size).toBe(1)
  })

  it('url của WebSite theo tiền tố ngôn ngữ (D-37), inLanguage dùng zh-Hans', () => {
    expect(webSiteJsonLd(SITE, { lang: 'vi' }).url).toBe(`${SITE}/`)
    expect(webSiteJsonLd(SITE, { lang: 'en' }).url).toBe(`${SITE}/en`)
    expect(webSiteJsonLd(SITE, { lang: 'zh' })).toMatchObject({ url: `${SITE}/zh`, inLanguage: 'zh-Hans' })
  })

  it('description không truyền → bỏ trường, không để undefined lọt vào JSON', () => {
    const json = JSON.parse(safeJson(webSiteJsonLd(SITE, { lang: 'vi' })))
    expect('description' in json).toBe(false)
  })
})

describe('BreadcrumbList', () => {
  it('vị trí bắt đầu từ 1 và item mang tiền tố ngôn ngữ', () => {
    const b = breadcrumbJsonLd(SITE, 'en', [
      { name: 'Home', path: '/' },
      { name: 'Đèn Nguyệt', path: '/products/den-nguyet' },
    ])
    expect(b.itemListElement[0]).toMatchObject({ position: 1, item: `${SITE}/en` })
    expect(b.itemListElement[1]).toMatchObject({ position: 2, item: `${SITE}/en/products/den-nguyet` })
  })

  it('slug có ký tự cần mã hoá vẫn cho URL dùng được', () => {
    const b = breadcrumbJsonLd(SITE, 'vi', [{ name: 'x', path: `/products/${encodeURIComponent('đèn nguyệt')}` }])
    expect(b.itemListElement[0].item).not.toContain(' ')
    expect(() => new URL(b.itemListElement[0].item)).not.toThrow()
  })
})

describe('og:image và twitter card (G-23)', () => {
  it('trang noindex không sinh og/twitter/JSON-LD nào', () => {
    const tags = buildHeadTags({
      lang: 'vi',
      siteUrl: SITE,
      path: '/lo/ABC',
      title: 'x',
      noindex: true,
      jsonLd: organizationJsonLd(SITE),
    })
    const html = renderHeadTags(tags, { noindex: true })
    expect(html).not.toContain('og:')
    expect(html).not.toContain('twitter:')
    expect(html).not.toContain('ld+json')
    expect(html).toContain('<meta name="robots" content="noindex"')
  })

  it('og:image mặc định tuyệt đối + twitter:image trùng giá trị', () => {
    const tags = buildHeadTags({ lang: 'vi', siteUrl: SITE, path: '/', title: 'x' })
    const og = tags.find((t) => t.attrs?.property === 'og:image').attrs.content
    const tw = tags.find((t) => t.attrs?.name === 'twitter:image').attrs.content
    expect(og).toBe(`${SITE}/images/og/default.png`)
    expect(tw).toBe(og)
  })

  it('tiêu đề/mô tả có ký tự HTML được escape trong thuộc tính', () => {
    const html = renderHeadTags(
      buildHeadTags({ lang: 'vi', siteUrl: SITE, path: '/', title: 'Đèn "A" & <B>', description: "O'Brien" }),
    )
    expect(html).toContain('&quot;A&quot;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&lt;B&gt;')
    expect(html).toContain('&#39;')
    expect(html).not.toMatch(/content="[^"]*<B>/)
  })
})
