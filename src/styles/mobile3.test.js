import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Giao diện điện thoại đợt 3 (D-117): kiểm các quy tắc CSS tĩnh (không cần trình duyệt)
const css = readFileSync('src/styles/pages.css', 'utf8')
const block = css.slice(css.indexOf('Giao diện điện thoại — đợt 3'))

describe('CSS điện thoại đợt 3', () => {
  it('nằm trong @media (max-width: 640px), không đụng desktop', () => {
    expect(block).toMatch(/@media \(max-width: 640px\) \{/)
    const outside = block.slice(0, block.indexOf('@media'))
    expect(outside).not.toMatch(/\.story-stats|\.faq-question|\.timeline/)
  })
  it('số liệu 5/3/1: lưới 3 cột, ngăn bằng nét chấm dọc', () => {
    expect(block).toMatch(/\.story-stats \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
    expect(block).toMatch(/\.story-stats > div \+ div \{[^}]*border-left: 1px dashed/)
  })
  it('câu hỏi thường gặp vẫn cao ≥ 44px để chạm', () => {
    expect(block).toMatch(/\.faq-question \{[^}]*min-height: 48px/)
  })
  it('bước quy trình nhỏ lại nhưng chỉ số tròn ≥ 40px', () => {
    expect(block).toMatch(/\.timeline-index \{[^}]*width: 40px/)
  })
})
