// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import express from 'express'
import request from 'supertest'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'
import { buildCsp } from '../../server/middleware/security.js'

const SVG = readFileSync('public/images/brand/logotype.svg', 'utf8')
afterEach(cleanup)

describe('Wordmark header', () => {
  for (const [loc, href] of [['', '/'], ['/en', '/en'], ['/zh', '/zh']]) {
    it(`link LAMVI (${loc || 'vi'}) có href đúng, img alt rỗng, có width/height`, async () => {
      mockApi({ 'GET /products': () => ({ body: productsVi }), 'GET /faq': () => ({ body: faqVi }) })
      const { container } = renderAt(loc || '/')
      await waitFor(() => expect(container.querySelector('header.nav .nav-mark')).toBeTruthy())
      const link = container.querySelector('header.nav .nav-mark')
      expect(link.getAttribute('aria-label')).toBe('LAMVI')
      expect(link.getAttribute('href')).toBe(href)
      const img = link.querySelector('img')
      expect(img.getAttribute('alt')).toBe('')
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0)
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0)
      expect(screen.getAllByRole('link', { name: 'LAMVI' }).length).toBeGreaterThan(0)
      expect(container.querySelectorAll('header.nav img[alt="LAMVI"]').length).toBe(0)
    })
  }
  it('trang đăng nhập dùng wordmark trong link LAMVI', async () => {
    mockApi({})
    const { container } = renderAt('/en/login')
    await waitFor(() => expect(container.querySelector('.nav-auth .nav-mark img.brand-wordmark')).toBeTruthy())
    const l = container.querySelector('.nav-auth .nav-mark')
    expect(l.getAttribute('aria-label')).toBe('LAMVI')
    expect(l.querySelector('img').getAttribute('alt')).toBe('')
  })
})

describe('logotype.svg', () => {
  it('XML hợp lệ, có viewBox, không script/image/ref ngoài/handler', () => {
    const doc = new JSDOM(SVG, { contentType: 'image/svg+xml' }).window.document
    const root = doc.documentElement
    expect(root.localName).toBe('svg')
    expect(root.getAttribute('viewBox')).toBe('0 0 180.75 49.5')
    expect(doc.querySelector('parsererror')).toBeNull()
    for (const el of doc.querySelectorAll('*'))
      for (const a of el.attributes) {
        expect(a.name, a.name).not.toMatch(/^on/i)
        if (a.name !== 'xmlns:xlink') expect(a.name).not.toMatch(/href/i)
      }
    expect(SVG).not.toMatch(/<script|<image|<foreignObject|<style|<use|javascript:|https?:\/\/(?!www\.w3\.org)|url\(|@import|<!ENTITY|<!DOCTYPE/i)
  })
  it('không vi phạm quét tên thương hiệu D-62 (SVG + CREDITS)', () => {
    const OLD = /MỘC|Mộc(?! bản)|LÂM VỊ|Lâm [Vv]ị|lâm vị/u
    const WRONG = /\b(?!LAMVI\b)[Ll][Aa][Mm][ _-]?[Vv][Ii]\b/
    for (const f of ['public/images/brand/logotype.svg', 'public/images/brand/CREDITS.md'])
      for (const l of readFileSync(f, 'utf8').normalize('NFC').split('\n')) {
        expect(OLD.test(l), f).toBe(false)
      }
    for (const l of SVG.split('\n')) expect(WRONG.test(l)).toBe(false)
  })
  it('CSP img-src cho phép SVG cùng origin; phục vụ image/svg+xml', async () => {
    const csp = buildCsp({ supabaseUrl: null, gaEnabled: false })
    expect(csp).toMatch(/img-src 'self'/)
    expect(csp).not.toMatch(/img-src[^;]*\*/)
    const app = express()
    app.use(express.static('public'))
    const r = await request(app).get('/images/brand/logotype.svg')
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toMatch(/image\/svg\+xml/)
  })
})
