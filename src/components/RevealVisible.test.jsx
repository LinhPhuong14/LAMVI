// @vitest-environment node
// Feedback 08/10 mục 12: HTML từ SSR phải hiển thị sẵn, không ẩn opacity:0 chờ scroll-reveal.
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { LazyMotion, domAnimation } from 'framer-motion'
import { CountUp, Reveal } from './Reveal.jsx'

describe('Reveal / CountUp khi render ở server', () => {
  it('nội dung không bị opacity:0', () => {
    const html = renderToString(
      <LazyMotion features={domAnimation}>
        <Reveal>
          <p>Nội dung quan trọng</p>
        </Reveal>
      </LazyMotion>,
    )
    expect(html).toContain('Nội dung quan trọng')
    expect(html).not.toMatch(/opacity:\s*0[;"]/)
  })

  it('bộ đếm render sẵn số thật', () => {
    const html = renderToString(<CountUp value="4.000+" />)
    expect(html).toContain('4.000+')
    expect(html).not.toMatch(/>0\+</)
  })
})
