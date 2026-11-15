// Kiểm thử độc lập: banner thư (T-111) và LampPhoto trong AccountPage
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BANNER = resolve(ROOT, 'public/images/mail/banner.jpg')
const SCRIPT = readFileSync(resolve(ROOT, 'scripts/gen_mail_banner.py'), 'utf8')
const ACCOUNT = readFileSync(resolve(ROOT, 'src/pages/AccountPage.jsx'), 'utf8')

let pil = false
try {
  execFileSync('python3', ['-I', '-c', 'import PIL'], { stdio: 'ignore' })
  pil = true
} catch {
  pil = false
}

function py(code) {
  return execFileSync('python3', ['-I', '-c', code, BANNER], { encoding: 'utf8' }).trim()
}

describe('banner thư', () => {
  it('nhỏ hơn 120KB', () => {
    expect(statSync(BANNER).size).toBeLessThan(120 * 1024)
  })

  it.skipIf(!pil)('kích thước 1200x400', () => {
    const out = py('import sys;from PIL import Image;i=Image.open(sys.argv[1]);print(i.width,i.height)')
    expect(out).toBe('1200 400')
  })

  it.skipIf(!pil)('góc nền gần Deep Brown, không chàm (B không lớn hơn R)', () => {
    const out = py(
      'import sys;from PIL import Image;i=Image.open(sys.argv[1]).convert("RGB");w,h=i.size;' +
        'pts=[(5,5),(w-6,5),(5,h-6),(w-6,h-6)];print(";".join(",".join(map(str,i.getpixel(p))) for p in pts))',
    )
    const target = [43, 22, 7]
    for (const px of out.split(';')) {
      const [r, g, b] = px.split(',').map(Number)
      expect(b).toBeLessThanOrEqual(r)
      for (const [i, v] of [r, g, b].entries()) expect(Math.abs(v - target[i])).toBeLessThanOrEqual(20)
    }
  })

  it.skipIf(!pil)('không có pixel đỏ son (163,50,31) trội', () => {
    const out = py(
      'import sys;from PIL import Image;i=Image.open(sys.argv[1]).convert("RGB");d=list(i.getdata());' +
        'n=sum(1 for r,g,b in d if abs(r-163)<=12 and abs(g-50)<=12 and abs(b-31)<=12);print(n/len(d))',
    )
    expect(Number(out)).toBeLessThan(0.005)
  })

  it('script không còn màu chàm đêm/đỏ son', () => {
    expect(SCRIPT).not.toMatch(/163,\s*50,\s*31/)
    expect(SCRIPT).toMatch(/\(43,\s*22,\s*7\)/)
  })

  it('script chỉ tham chiếu đủ 5 slug có tệp cutout', () => {
    const m = SCRIPT.match(/LAMPS\s*=\s*\[([^\]]*)\]/)
    expect(m).toBeTruthy()
    const slugs = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
    expect(slugs).toHaveLength(5)
    expect(new Set(slugs).size).toBe(5)
    for (const s of slugs) expect(existsSync(resolve(ROOT, `public/images/lamps/${s}-cutout.webp`))).toBe(true)
    // mọi slug được nhắc tới trong đường dẫn lamps/ của script đều thuộc danh sách
    const refs = [...SCRIPT.matchAll(/lamps\/([a-z0-9-]+)-cutout\.webp/g)].map((x) => x[1])
    for (const r of refs) expect(slugs).toContain(r)
  })
})

describe('AccountPage dùng LampPhoto', () => {
  it('không còn import hay dùng Lantern', () => {
    expect(ACCOUNT).not.toMatch(/import[^\n]*Lantern/)
    expect(ACCOUNT).not.toMatch(/<Lantern\b/)
  })

  it('có đúng 3 chỗ dùng LampPhoto trỏ tới cutout tồn tại', () => {
    const uses = [...ACCOUNT.matchAll(/<LampPhoto\s+slug="([^"]+)"/g)].map((x) => x[1])
    expect(uses).toEqual(['tu-linh', 'thu-hoach', 'lon-dan'])
    for (const s of uses) expect(existsSync(resolve(ROOT, `public/images/lamps/${s}-cutout.webp`))).toBe(true)
    expect(ACCOUNT).toMatch(/className="dash-lamp"[^>]*src=\{`\/images\/lamps\/\$\{slug\}-cutout\.webp`\}|src=\{`\/images\/lamps\/\$\{slug\}-cutout\.webp`\}[^>]*className="dash-lamp"/)
  })

  it('ba vị trí (đơn hàng trống, việc cần làm trống, ô tiếp tục mua) không chứa svg', () => {
    const blocks = [
      ['dash-orders-art', /<div className="dash-orders-art"[\s\S]*?<\/div>/],
      ['dash-todo-empty', /<div className="dash-todo-empty">[\s\S]*?<\/Link>/],
      ['dash-promo-art', /<span className="dash-promo-art"[\s\S]*?<\/span>/],
    ]
    for (const [, re] of blocks) {
      const blk = ACCOUNT.match(re)
      expect(blk).toBeTruthy()
      expect(blk[0]).toContain('<LampPhoto')
      expect(blk[0]).not.toMatch(/<svg|Lantern/)
    }
  })
})
