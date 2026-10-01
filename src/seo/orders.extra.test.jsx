// @vitest-environment node
// T-11: trang checkout / đơn hàng là trang riêng tư (BR-SEO-001), render server không đụng window
import { describe, expect, it } from 'vitest'
import { classifyPath } from './routes.js'
import { render } from '../entry-server.jsx'

describe('Trang riêng tư mới (BR-SEO-001)', () => {
  it.each(['/checkout', '/en/checkout', '/zh/checkout/', '/account/orders/o1', '/en/account/orders/o1', '/zh/account/orders/abc', '/admin/orders/o1', '/admin/coupons', '/admin/shop'])(
    '%s → private',
    (p) => {
      expect(classifyPath(p).kind).toBe('private')
    },
  )

  it('ngôn ngữ của trang riêng tư theo tiền tố', () => {
    expect(classifyPath('/zh/account/orders/o1').lang).toBe('zh')
    expect(classifyPath('/en/checkout').lang).toBe('en')
  })

  it('đường dẫn gần giống không bị coi là /checkout', () => {
    expect(classifyPath('/checkoutx').kind).not.toBe('private')
    expect(classifyPath('/accounts').kind).not.toBe('private')
  })

  it.each(['/checkout', '/en/checkout', '/zh/account/orders/o1', '/account', '/admin/orders', '/admin/coupons'])(
    'render server %s không lỗi khi không có window',
    (p) => {
      expect(typeof window).toBe('undefined')
      expect(() => render(p, { initialData: {}, siteUrl: 'https://moc.test' })).not.toThrow()
    },
  )
})
