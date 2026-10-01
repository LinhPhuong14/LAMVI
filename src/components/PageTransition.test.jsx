// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/react'
import PageTransition from './PageTransition'
import { useLocation, useOutlet } from 'react-router-dom'

function Layout() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <Link to="/b">go-b</Link>
        <PageTransition pageKey={pathname}>{outlet}</PageTransition>
      </MotionConfig>
    </LazyMotion>
  )
}

const app = (initial) => (
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/a" element={<p>trang A</p>} />
        <Route path="/b" element={<p>trang B</p>} />
        <Route path="/old" element={<Navigate to="/b" replace />} />
      </Route>
    </Routes>
  </MemoryRouter>
)

describe('PageTransition (T-45)', () => {
  it('đổi trang: trang cũ thoát, trang mới vào', async () => {
    render(app('/a'))
    expect(screen.getByText('trang A')).toBeInTheDocument()
    fireEvent.click(screen.getByText('go-b'))
    await waitFor(() => expect(screen.getByText('trang B')).toBeInTheDocument())
    expect(screen.queryByText('trang A')).toBeNull()
  })

  it('chuyển hướng bằng <Navigate> không lặp vô hạn', async () => {
    render(app('/old'))
    await waitFor(() => expect(screen.getByText('trang B')).toBeInTheDocument())
  })

  it('giảm chuyển động: render thẳng, không bọc animation', () => {
    const { container } = render(
      <MemoryRouter>
        <MotionConfig reducedMotion="always">
          <PageTransition pageKey="a">nội dung</PageTransition>
        </MotionConfig>
      </MemoryRouter>,
    )
    expect(container.querySelector('main.page-frame')).toBeNull()
    expect(screen.getByText('nội dung').closest('main')).not.toBeNull()
  })
})
