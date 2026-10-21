// @vitest-environment jsdom
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import MayAvatar from './MayAvatar.jsx'
import { MAY_POSES } from './poses.js'

describe('MayAvatar — mascot Mây', () => {
  it('mặc định là ảnh tư thế chat, trang trí (alt rỗng), có width/height theo size', () => {
    const { container } = render(<MayAvatar size={60} />)
    const img = container.querySelector('img.may-avatar')
    expect(img.getAttribute('src')).toBe('/images/may/chat.webp')
    expect(img.getAttribute('alt')).toBe('')
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['60', '60'])
  })
  it.each(MAY_POSES)('tư thế %s có tệp ảnh trong public/images/may', (pose) => {
    const { container } = render(<MayAvatar pose={pose} />)
    const src = container.querySelector('img').getAttribute('src')
    expect(existsSync(`public${src}`)).toBe(true)
  })
  it('mood="sleepy" và tư thế lạ rơi về hình SVG cũ (chưa có tư thế ngủ)', () => {
    expect(render(<MayAvatar mood="sleepy" />).container.querySelector('svg.may-avatar')).not.toBeNull()
    expect(render(<MayAvatar pose="khong-co" mood="sleepy" />).container.querySelector('img')).toBeNull()
  })
})
