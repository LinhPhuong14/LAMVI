import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { buildCsp } from './middleware/security.js'
import { renderPage } from './ssr.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { render } from '../src/entry-server.jsx'
import { CRAFT_FILMS } from '../src/data/craftFilms.js'
import viMsg from '../src/i18n/messages/vi.js'
import enMsg from '../src/i18n/messages/en.js'
import zhMsg from '../src/i18n/messages/zh.js'

// Kiểm thử độc lập D-118 (T-11): video làng nghề tự host trên trang chủ
const root = new URL('..', import.meta.url).pathname
const MB = 1024 * 1024

async function ssrHome(url) {
  const r = await renderPage({
    repo: createMemoryRepo(),
    config: { publicSiteUrl: 'https://moc.test' },
    template: readFileSync(`${root}index.html`, 'utf8'),
    render,
    url,
    pathname: url,
  })
  expect(r.status).toBe(200)
  return new JSDOM(r.html).window.document
}

describe('D-118 — tệp video trong public/', () => {
  for (const [key, film] of Object.entries(CRAFT_FILMS)) {
    it(`${key}: mp4 và poster tồn tại, dung lượng hợp lý`, () => {
      const mp4 = statSync(`${root}public${film.src}`)
      // journey là clip 15 s cho khung điện thoại (D-120) nên nhỏ hơn
      expect(mp4.size).toBeGreaterThan(key === 'journey' ? 0.3 * MB : 1 * MB)
      expect(mp4.size).toBeLessThan(30 * MB)
      const poster = statSync(`${root}public${film.poster}`)
      expect(poster.size).toBeGreaterThan(1024)
      expect(poster.size).toBeLessThan(500 * 1024)
    })

    it(`${key}: mp4 có moov trước mdat (+faststart) và poster là WebP thật`, () => {
      const head = readFileSync(`${root}public${film.src}`).subarray(0, 64 * 1024)
      expect(head.subarray(4, 8).toString('latin1')).toBe('ftyp')
      const moov = head.indexOf('moov', 0, 'latin1')
      expect(moov).toBeGreaterThan(0)
      const mdat = head.indexOf('mdat', 0, 'latin1')
      if (mdat !== -1) expect(moov).toBeLessThan(mdat)
      const webp = readFileSync(`${root}public${film.poster}`).subarray(0, 12)
      expect(webp.subarray(0, 4).toString('latin1')).toBe('RIFF')
      expect(webp.subarray(8, 12).toString('latin1')).toBe('WEBP')
    })
  }
})

describe('D-118 — SSR trang chủ', () => {
  it('vi: đầu trang là ảnh bìa .intro-cover đứng trước #hero; không có video nào trước #artisan', async () => {
    const doc = await ssrHome('/')
    const cover = doc.querySelector('.intro-cover')
    expect(cover).toBeTruthy()
    expect(doc.querySelector('.intro-film')).toBeNull()
    expect(cover.compareDocumentPosition(doc.querySelector('#hero')) & 4).toBeTruthy() // #hero đứng sau
    const artisan = doc.querySelector('#artisan')
    for (const v of doc.querySelectorAll('video')) {
      expect(artisan.compareDocumentPosition(v) & 4 || artisan.contains(v), 'video phải ở #artisan hoặc sau đó').toBeTruthy()
    }
    expect(doc.querySelector('main, #root').querySelector('video').closest('#artisan')).toBe(artisan)
  })

  it('vi: ba video còn lại (2 làng nghề + clip điện thoại), preload="none", có poster/aria-label, không iframe', async () => {
    const doc = await ssrHome('/')
    const videos = [...doc.querySelectorAll('video')]
    expect(videos).toHaveLength(3)
    const srcs = videos.map((v) => v.querySelector('source')?.getAttribute('src'))
    expect(srcs).toEqual(expect.arrayContaining([CRAFT_FILMS.dongho.src, CRAFT_FILMS.paper.src, CRAFT_FILMS.journey.src]))
    for (const v of videos) {
      expect(v.getAttribute('preload')).toBe('none')
      // Clip trong khung điện thoại dùng nút phát/dừng riêng (.phone-video-toggle) thay thanh điều khiển
      if (v.closest('.phone-video')) expect(v.parentElement.querySelector('.phone-video-toggle')).toBeTruthy()
      else expect(v.hasAttribute('controls')).toBe(true)
      expect(v.getAttribute('poster')).toMatch(/^\/videos\/.+\.webp$/)
      expect(v.getAttribute('aria-label')).toBeTruthy()
      expect(v.hasAttribute('autoplay')).toBe(false)
    }
    expect(doc.querySelectorAll('iframe').length).toBe(0)
  })

  it('#artisan: video Đông Hồ thay ảnh minh hoạ cũ (không còn svg.old-photo)', async () => {
    const doc = await ssrHome('/')
    const artisan = doc.querySelector('#artisan')
    expect(artisan).toBeTruthy()
    expect(artisan.querySelector('svg.old-photo')).toBeNull()
    expect(artisan.querySelector('.artisan-portrait')).toBeNull()
    const film = artisan.querySelector('.artisan-film video source')
    expect(film.getAttribute('src')).toBe(CRAFT_FILMS.dongho.src)
    expect(artisan.querySelector('.artisan-film figcaption').textContent).toContain(viMsg.artisan.videoCaption)
  })

  it('#films nằm ngay sau #process và chứa video giấy dó', async () => {
    const doc = await ssrHome('/')
    const films = doc.querySelector('section#films')
    expect(films).toBeTruthy()
    expect(films.previousElementSibling?.id).toBe('process')
    expect(films.querySelector('video source').getAttribute('src')).toBe(CRAFT_FILMS.paper.src)
    expect(films.textContent).toContain(viMsg.films.title)
    expect(doc.querySelectorAll('#films').length).toBe(1)
  })

  for (const [lang, msg] of [['en', enMsg], ['zh', zhMsg]]) {
    it(`${lang}: SSR /${lang} có chữ video theo ngôn ngữ`, async () => {
      const doc = await ssrHome(`/${lang}`)
      expect(doc.querySelectorAll('video').length).toBeGreaterThanOrEqual(2)
      expect(doc.querySelector('#films').textContent).toContain(msg.films.title)
      expect(doc.querySelector('#films').textContent).toContain(msg.films.paperTitle)
      const artisanVideo = doc.querySelector('#artisan video')
      expect(artisanVideo.getAttribute('aria-label')).toBe(msg.artisan.videoTitle)
      expect(doc.querySelector('#artisan figcaption').textContent).toContain(msg.artisan.videoCaption)
    })
  }

  it('en/zh có đủ khoá films.* như vi', () => {
    const keys = Object.keys(viMsg.films).sort()
    expect(Object.keys(enMsg.films).sort()).toEqual(keys)
    expect(Object.keys(zhMsg.films).sort()).toEqual(keys)
  })
})

describe('D-118 — CSP và cấu hình deploy', () => {
  it("media-src 'self' (có và không có Supabase) — video cùng origin được phép, không mở host ngoài", () => {
    for (const opts of [{ gaEnabled: false }, { gaEnabled: true, supabaseUrl: 'https://abc.supabase.co' }]) {
      const media = buildCsp(opts).split(';').map((s) => s.trim()).find((s) => s.startsWith('media-src'))
      expect(media.split(/\s+/)).toContain("'self'")
      expect(media).not.toMatch(/youtube|vimeo|drive\.google|\*/)
    }
    const csp = buildCsp({ gaEnabled: false })
    expect(csp).not.toMatch(/frame-src [^;]*youtube/)
  })

  it('vercel.json hợp lệ: vẫn includeFiles dist/**, excludeFiles video, cache /videos/', () => {
    const cfg = JSON.parse(readFileSync(`${root}vercel.json`, 'utf8'))
    const fn = cfg.functions['api/index.js']
    expect(Object.keys(cfg.functions)).toEqual(['api/index.js'])
    expect(fn.includeFiles).toContain('dist/**')
    expect(fn.excludeFiles).toBe('dist/client/videos/**')
    expect(cfg.outputDirectory).toBe('public')
    const v = cfg.headers.find((h) => h.source === '/videos/(.*)')
    expect(v.headers.find((h) => h.key === 'Cache-Control').value).toMatch(/public, max-age=\d+/)
  })

  it('vite.config: bản SSR tắt publicDir, bản client giữ public', async () => {
    const mod = (await import('../vite.config.js')).default
    expect(typeof mod).toBe('function')
    expect(mod({ command: 'build', mode: 'production', isSsrBuild: true }).publicDir).toBe(false)
    expect(mod({ command: 'build', mode: 'production', isSsrBuild: false }).publicDir).toBe('public')
  })
})
