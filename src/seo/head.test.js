// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyHeadTags, buildHeadTags, renderHeadTags, safeJson } from './head.js'
import { classifyPath, dataKeysFor } from './routes.js'

describe('head', () => {
  it('trang noindex không có canonical/hreflang; meta robots chỉ do renderHeadTags thêm', () => {
    const tags = buildHeadTags({ lang: 'vi', siteUrl: 'https://x', path: '/a', title: 'T', noindex: true })
    expect(tags).toEqual([{ tag: 'title', text: 'T' }])
    expect(renderHeadTags(tags, { noindex: true })).toContain('name="robots" content="noindex"')
  })

  it('applyHeadTags thay thẻ data-seo cũ, không đụng meta noindex của useNoIndex', () => {
    document.head.innerHTML = '<link rel="canonical" href="/cu" data-seo><meta name="robots" content="noindex" data-noindex>'
    applyHeadTags(document, buildHeadTags({ lang: 'en', siteUrl: 'https://x', path: '/', title: 'Home' }))
    expect(document.title).toBe('Home')
    expect(document.querySelector('link[rel=canonical]').href).toBe('https://x/en')
    expect(document.querySelectorAll('link[rel=canonical]')).toHaveLength(1)
    expect(document.querySelector('meta[data-noindex]')).not.toBeNull()
  })

  it('safeJson không cho thoát khỏi <script>', () => {
    expect(safeJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}')
  })
})

describe('phân loại đường dẫn SSR', () => {
  it.each([
    ['/', { kind: 'home', lang: 'vi' }],
    ['/en', { kind: 'home', lang: 'en' }],
    ['/zh/products/den-vong', { kind: 'product', lang: 'zh', slug: 'den-vong' }],
    ['/lo/L%2001', { kind: 'batch', lang: 'vi', code: 'L 01' }],
    ['/en/login', { kind: 'private', lang: 'en' }],
    ['/account/', { kind: 'private', lang: 'vi' }],
    ['/admin', { kind: 'private', lang: 'vi' }],
    ['/products/%E0%A4%A', { kind: 'invalid', lang: 'vi' }],
    ['/en/lo/%zz', { kind: 'invalid', lang: 'en' }],
    ['/abc', { kind: 'other', lang: 'vi' }],
  ])('%s', (path, expected) => {
    expect(classifyPath(path)).toEqual(expected)
  })

  it('key dữ liệu khớp useApi', () => {
    expect(dataKeysFor({ kind: 'product', lang: 'vi', slug: 'a b' })).toEqual(['/products', '/products/a%20b'])
  })
})
