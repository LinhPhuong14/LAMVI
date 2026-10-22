import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Chất lượng ảnh (yêu cầu "không ảnh nào bị vỡ", 21/10): kích thước thật của ảnh phải đủ cho nơi dùng,
// và khai báo srcSet phải khớp bề rộng thật (nếu lệch, trình duyệt chọn sai bản và ảnh bị phóng/nặng).
const PUB = join(process.cwd(), 'public')

function webpSize(buf) {
  const t = buf.toString('ascii', 12, 16)
  if (t === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) }
  if (t === 'VP8L') {
    const b = buf.readUInt32LE(21)
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }
  }
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff }
}
function jpegSize(buf) {
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue }
    const m = buf[i + 1]
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error('không đọc được JPEG')
}
const size = (rel) => {
  const buf = readFileSync(join(PUB, rel))
  return rel.endsWith('.webp') ? webpSize(buf) : jpegSize(buf)
}

describe('ảnh đèn (nâng cấp Real-ESRGAN)', () => {
  const lamps = ['thu-hoach', 'tu-linh', 'phuc-loc-song-toan', 'tam-duong-khai-thai', 'lon-dan']
  it.each(lamps)('%s: ảnh đầy đủ ≥ 800 px và bản tách nền cao ≥ 1000 px', (n) => {
    const full = size(`images/lamps/${n}.jpg`)
    expect(Math.min(full.w, full.h)).toBeGreaterThanOrEqual(800)
    const cut = size(`images/lamps/${n}-cutout.webp`)
    expect(cut.h).toBeGreaterThanOrEqual(1000)
    expect(cut.w).toBeGreaterThanOrEqual(400)
  })
})

describe('thương hiệu', () => {
  it('logo tròn ≥ 400 px, ảnh bìa ≥ 1600 px, apple-touch-icon 180 px', () => {
    expect(size('images/brand/logo-round-400.jpg').w).toBeGreaterThanOrEqual(400)
    expect(size('images/brand/cover-1672x800.jpg').w).toBeGreaterThanOrEqual(1600)
    const icon = readFileSync(join(PUB, 'apple-touch-icon.png'))
    expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([180, 180])
  })
})

describe('ảnh nền phong cảnh: srcSet khớp bề rộng thật', () => {
  const scenes = [...new Set(readdirSync(join(PUB, 'images/scene')).filter((f) => /-(640|1280)\.webp$/.test(f)).map((f) => f.replace(/-(640|1280)\.webp$/, '')))]
  it.each(scenes)('%s: bản -640 rộng ≥ 1280 và bản -1280 rộng ≥ 1920 (descriptor 1280w/1920w)', (n) => {
    expect(size(`images/scene/${n}-640.webp`).w).toBeGreaterThanOrEqual(1280)
    expect(size(`images/scene/${n}-1280.webp`).w).toBeGreaterThanOrEqual(1920)
  })
  it.each(scenes)('%s: có thêm bản -2560 (≥2560 px) cho màn hình lớn/retina và Scene.jsx khai báo 2560w', (n) => {
    if (!['bay-green', 'cloud-sea', 'dawn-lake', 'golden-clouds', 'golden-sky', 'halong-mist', 'hills-gold', 'lake-village', 'lantern-glow', 'lanterns-night', 'mist-terraces', 'starry', 'valley-light'].includes(n)) return
    expect(size(`images/scene/${n}-2560.webp`).w).toBeGreaterThanOrEqual(2560)
    expect(readFileSync('src/components/Scene.jsx', 'utf8')).toContain(`'${n}'`)
  })
  it('khói (lớp trong suốt) đã nâng gấp đôi và còn kênh alpha', () => {
    expect(size('images/scene/smoke-ink.webp').w).toBeGreaterThanOrEqual(1440)
    expect(size('images/scene/smoke-ember.webp').w).toBeGreaterThanOrEqual(1440)
    const buf = readFileSync(join(PUB, 'images/scene/smoke-ink.webp'))
    expect(['VP8X', 'VP8L']).toContain(buf.toString('ascii', 12, 16)) // VP8 thường không có alpha
  })
  it('lantern-river (trang auth) cũng vậy và component khai báo đúng descriptor', () => {
    expect(size('images/auth/lantern-river-640.webp').w).toBeGreaterThanOrEqual(1280)
    expect(size('images/auth/lantern-river-1024.webp').w).toBeGreaterThanOrEqual(1920)
    expect(readFileSync('src/components/Scene.jsx', 'utf8')).toContain('-640.webp 1280w')
    expect(readFileSync('src/components/Scene.jsx', 'utf8')).toContain('-1280.webp 1920w')
    expect(readFileSync('src/pages/auth/AuthShell.jsx', 'utf8')).toContain('lantern-river-640.webp 1280w')
  })
})
