import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const css = readFileSync(new URL('./pages.css', import.meta.url), 'utf8')
const start = css.indexOf('Giao diện điện thoại — đợt 2')
const tail = css.slice(start)
const blocks = tail.split(/@media \(max-width: 640px\) \{/).slice(1)

describe('mobile phase 2 CSS (static)', () => {
  it('có hai khối @media (max-width: 640px) ở cuối pages.css', () => {
    expect(start).toBeGreaterThan(0)
    expect(blocks.length).toBe(2)
  })
  it('min-width: 0 cho con của .pdp-grid', () => {
    expect(blocks[0]).toMatch(/\.pdp-grid,\s*\.pdp-grid > \*,[\s\S]*?\{\s*min-width: 0;/)
  })
  it('order: buy/stock 1, desc 2, note/perks 3', () => {
    expect(blocks[0]).toMatch(/\.pdp-buy > \.product-buy,\s*\.pdp-buy > \.stock-left \{\s*order: 1;/)
    expect(blocks[0]).toMatch(/\.pdp-buy > \.pdp-desc \{\s*order: 2;/)
    expect(blocks[0]).toMatch(/\.pdp-buy > \.pdp-note,\s*\.pdp-buy > \.pdp-perks \{\s*order: 3;/)
  })
  it('order chỉ nằm trong media query (desktop không bị ảnh hưởng)', () => {
    const before = css.slice(0, start)
    expect(before).not.toMatch(/\.pdp-buy[^{]*\{[^}]*\border:\s*\d/)
    expect(css.slice(0, start - 200)).not.toMatch(/\.pdp-buy > \.pdp-desc/)
  })
  it('dải vuốt ngang: flex, scroll-snap, thẻ 80%', () => {
    expect(blocks[0]).toMatch(/\.products \.product-grid,\s*\.pdp-related \.product-grid \{[^}]*display: flex;[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;/)
    expect(blocks[0]).toMatch(/flex: 0 0 80%;[\s\S]*?scroll-snap-align: start;/)
  })
  it('perks trong PDP được wrap', () => {
    expect(blocks[0]).toMatch(/\.pdp-perks \{[^}]*flex-wrap: wrap;/)
  })
  it('giỏ hàng: bước một hàng, lưới hai tầng, ẩn price-note', () => {
    expect(blocks[1]).toMatch(/\.cart-steps \{[^}]*flex-wrap: nowrap;/)
    expect(blocks[1]).toMatch(/grid-template-areas:\s*'art info info'\s*'art qty total';/)
    expect(blocks[1]).toMatch(/\.cart-line-info \.price-note \{\s*display: none;/)
  })
})
