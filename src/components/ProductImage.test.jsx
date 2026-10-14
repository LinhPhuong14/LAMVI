// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import ProductImage from './ProductImage.jsx'

// D-107: thẻ nhỏ dùng đèn đã tách nền khi có; trang chi tiết dùng ảnh đầy đủ phủ khung
const photo = { url: '/images/lamps/tu-linh.jpg', alt: 'Đèn Tứ Linh', cutout: '/images/lamps/tu-linh-cutout.webp' }
describe('<ProductImage>', () => {
  it('cutout + có image.cutout → <img.lamp-cutout> cao ~1,35×size, tỉ lệ ~0,44', () => {
    const { container } = render(<ProductImage image={photo} size={100} cutout />)
    const img = container.querySelector('img.lamp-cutout')
    expect(img.getAttribute('src')).toBe(photo.cutout)
    expect(img.getAttribute('height')).toBe('135')
    expect(img.getAttribute('width')).toBe('59')
    expect(img.getAttribute('alt')).toBe('Đèn Tứ Linh')
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(container.querySelector('img.product-photo')).toBeNull()
  })
  it('priority → loading eager', () => {
    const { container } = render(<ProductImage image={photo} size={100} cutout priority />)
    expect(container.querySelector('img').getAttribute('loading')).toBe('eager')
  })
  it('cutout nhưng ảnh không có cutout (ảnh admin) → ảnh thường', () => {
    const { container } = render(<ProductImage image={{ url: 'https://cdn/x.jpg', alt: 'x' }} size={100} cutout />)
    expect(container.querySelector('img.product-photo').getAttribute('src')).toBe('https://cdn/x.jpg')
    expect(container.querySelector('img.lamp-cutout')).toBeNull()
  })
  it('không bật cutout → ảnh đầy đủ dù ảnh có cutout; fill → rộng 100%', () => {
    const a = render(<ProductImage image={photo} size={100} />)
    expect(a.container.querySelector('img.product-photo').getAttribute('src')).toBe(photo.url)
    a.unmount()
    const b = render(<ProductImage image={photo} size={300} fill />)
    expect(b.container.querySelector('img').style.width).toBe('100%')
  })
  it('không có ảnh → hình minh hoạ SVG', () => {
    const { container } = render(<ProductImage image={null} size={100} cutout />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})
