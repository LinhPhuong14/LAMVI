// Kiểm thử độc lập (T-11) — phân loại đường dẫn khi URL viết khác hoa/thường.
// React Router khớp route KHÔNG phân biệt hoa/thường (caseSensitive mặc định false), còn
// classifyPath/isInternalPath ở server thì phân biệt → hai bên lệch nhau.
// Liên quan: BR-SEO-001 (noindex admin/tài khoản), deploy-vercel.md quy tắc 2 (/admin, /it không
// nhúng GA) và quy tắc 9 (trang riêng tư no-store), T-15 (trang phải render được ở server).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { classifyPath } from '../src/seo/routes.js'

const config = { publicSiteUrl: 'https://lamvi.test', gaMeasurementId: 'G-TEST12345' }
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

const page = (url) =>
  renderPage({ repo: createMemoryRepo(), config, template, render, url, pathname: url.split('?')[0] })

describe('Đường dẫn viết đúng chữ thường (mốc so sánh)', () => {
  it('/admin, /it: riêng tư, noindex, KHÔNG nhúng GA', async () => {
    for (const url of ['/admin', '/admin/products', '/it']) {
      expect(classifyPath(url).kind, url).toBe('private')
      const r = await page(url)
      expect(r.noindex, url).toBe(true)
      expect(r.html.includes('googletagmanager'), url).toBe(false)
    }
  })

  it('/account, /cart, /login, /reset-password: riêng tư, noindex', async () => {
    for (const url of ['/account', '/en/account', '/cart', '/login', '/reset-password']) {
      expect(classifyPath(url).kind, url).toBe('private')
      expect((await page(url)).noindex, url).toBe(true)
    }
  })
})

describe('Đường dẫn viết hoa vẫn mở đúng trang ở trình duyệt', () => {
  it('classifyPath nhận ra trang riêng tư dù viết hoa', () => {
    for (const url of ['/ADMIN', '/Admin/products', '/IT', '/Account', '/en/ACCOUNT', '/Cart', '/Reset-Password']) {
      expect(classifyPath(url).kind, url).toBe('private')
    }
  })

  it('/ADMIN, /IT: không nhúng GA (số liệu nội bộ không được lẫn vào báo cáo)', async () => {
    for (const url of ['/ADMIN', '/Admin/products', '/IT']) {
      const r = await page(url)
      expect(r.html.includes('googletagmanager'), url).toBe(false)
    }
  })

  it('/ADMIN, /Account: noindex (nếu không, CDN giữ bản chung và bot index được)', async () => {
    for (const url of ['/ADMIN', '/Admin/products', '/IT', '/Account', '/en/ACCOUNT']) {
      expect((await page(url)).noindex, url).toBe(true)
    }
  })

  it('/Reset-Password render được ở server, không ném lỗi (T-15)', async () => {
    // ResetPasswordPage đọc window.location.hash ngay khi render → nếu lọt vào nhánh SSR thường
    // thì ném ReferenceError và khách nhận trang 500.
    await expect(page('/Reset-Password')).resolves.toMatchObject({ status: 200 })
  })
})
