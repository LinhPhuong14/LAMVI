// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { mockApi, renderAt } from '../../test/renderApp.jsx'
import { productsVi } from '../../test/fixtures.js'

const root = process.cwd()
const pub = (p) => path.join(root, 'public', p)
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /products/x': () => ({ body: { item: productsVi.items[0] } }),
}
const refs = () =>
  [...document.querySelectorAll('img')].flatMap((i) => [i.getAttribute('src') || '', i.getAttribute('srcset') || ''])
const urlsOf = (v) => v.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)

const pages = ['/login', '/register', '/forgot-password', '/reset-password']
const cases = ['', '/en', '/zh'].flatMap((l) => pages.map((p) => l + p))

describe('Ảnh trang auth (D-81)', () => {
  it.each(cases)('%s: đúng một ảnh trong aside ẩn, alt rỗng, tệp tồn tại', async (p) => {
    mockApi(base)
    renderAt(p)
    await waitFor(() => expect(document.querySelector('img.auth-aside-photo')).not.toBeNull())
    const imgs = document.querySelectorAll('img.auth-aside-photo')
    expect(imgs).toHaveLength(1)
    const img = imgs[0]
    expect(img.closest('aside[aria-hidden="true"]')).not.toBeNull()
    expect(img.getAttribute('alt')).toBe('')
    expect(Number(img.getAttribute('width'))).toBeGreaterThan(0)
    expect(Number(img.getAttribute('height'))).toBeGreaterThan(0)
    const all = [...urlsOf(img.getAttribute('src')), ...urlsOf(img.getAttribute('srcset'))]
    expect(all.length).toBeGreaterThanOrEqual(3)
    for (const u of all) {
      expect(u.startsWith('/images/auth/')).toBe(true)
      expect(fs.existsSync(pub(u))).toBe(true)
    }
    const set = urlsOf(img.getAttribute('srcset'))
    expect(set.some((u) => u.includes('-640'))).toBe(true)
    expect(set.some((u) => u.includes('-1024'))).toBe(true)
    // không ảnh scene nào trên trang auth
    for (const r of refs()) expect(r).not.toContain('/images/scene/')
  })

  it.each(['/', '/cart', '/products/x', '/en', '/zh'])('landing %s không tham chiếu /images/auth/', async (p) => {
    mockApi(base)
    renderAt(p)
    await waitFor(() => expect(document.querySelector('main, section, header')).not.toBeNull())
    await new Promise((r) => setTimeout(r, 30))
    expect(document.querySelector('img.auth-aside-photo')).toBeNull()
    for (const r of refs()) expect(r).not.toContain('/images/auth/')
    expect(document.body.innerHTML).not.toContain('/images/auth/')
  })

  it('ảnh auth không trùng byte với bất kỳ ảnh scene/dash', () => {
    const auth = fs.readdirSync(pub('images/auth')).filter((f) => f.endsWith('.webp'))
    expect(auth.sort()).toEqual(['lantern-river-1024.webp', 'lantern-river-640.webp'])
    const others = ['scene', 'dash'].flatMap((d) =>
      fs.readdirSync(pub('images/' + d)).filter((f) => !f.endsWith('.md')).map((f) => hash(pub(`images/${d}/${f}`))),
    )
    expect(others.length).toBeGreaterThan(10)
    for (const f of auth) {
      expect(fs.statSync(pub('images/auth/' + f)).size).toBeGreaterThan(1000)
      expect(others).not.toContain(hash(pub('images/auth/' + f)))
    }
    expect(hash(pub('images/auth/lantern-river-640.webp'))).not.toBe(hash(pub('images/auth/lantern-river-1024.webp')))
  })

  it('CREDITS.md ghi CC0 1.0 và lantern-river', () => {
    const t = fs.readFileSync(pub('images/auth/CREDITS.md'), 'utf8')
    expect(t).toContain('CC0 1.0')
    expect(t).toContain('lantern-river')
  })

  it('CSS: object-fit cover và quy tắc ≤640px ẩn câu trích', () => {
    const css = fs.readFileSync(path.join(root, 'src/styles/App.css'), 'utf8')
    const m = css.match(/\.auth-aside-photo\s*\{([^}]*)\}/)
    expect(m).not.toBeNull()
    expect(m[1]).toMatch(/object-fit:\s*cover/)
    const media = css.split('@media (max-width: 640px)').slice(1)
    const hit = media.some((blk) => /\.auth-aside-quote\s*\{[^}]*display:\s*none/.test(blk))
    expect(hit).toBe(true)
    expect(css).toMatch(/\.auth-aside::before/)
  })
})
