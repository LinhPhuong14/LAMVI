// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useOutlet, useSearchParams } from 'react-router-dom'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { describe, expect, it, vi } from 'vitest'
import PageTransition from './PageTransition'
import AppRoutes from '../routes.jsx'
import AuthProvider from '../auth/AuthProvider.jsx'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'

const WAIT = { timeout: 5000 }

// ---------- khung thử nghiệm nhỏ ----------
const mounts = { a: 0, b: 0, c: 0 }
const unmounts = { a: 0, b: 0, c: 0 }

function Page({ id }) {
  const { pathname, search } = useLocation()
  const [params] = useSearchParams()
  useEffect(() => {
    mounts[id] += 1
    return () => {
      unmounts[id] += 1
    }
  }, [id])
  return (
    <section>
      <p data-testid={`path-${id}`}>{pathname}</p>
      <p data-testid={`search-${id}`}>{search}</p>
      <p data-testid={`q-${id}`}>{params.get('next') ?? ''}</p>
      <p>{`trang ${id.toUpperCase()}`}</p>
    </section>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const navigate = useNavigate()
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <Link to="/a">go-a</Link>
        <Link to="/b">go-b</Link>
        <Link to="/c">go-c</Link>
        <button onClick={() => navigate('/a?next=%2Fx')}>q-x</button>
        <button onClick={() => navigate('/a?next=%2Fy')}>q-y</button>
        <button onClick={() => navigate('/a#neo')}>hash</button>
        <PageTransition pageKey={pathname}>{outlet}</PageTransition>
      </MotionConfig>
    </LazyMotion>
  )
}

const harness = (initial) => (
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/a" element={<Page id="a" />} />
        <Route path="/b" element={<Page id="b" />} />
        <Route path="/c" element={<Page id="c" />} />
      </Route>
    </Routes>
  </MemoryRouter>
)

function reset() {
  for (const k of Object.keys(mounts)) mounts[k] = unmounts[k] = 0
}

describe('PageTransition extra (T-45)', () => {
  it('(1) cấp ứng dụng: /login -> /register -> /forgot-password, trang cũ biến mất', async () => {
    mockApi({})
    renderAt('/login')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: viMsg.auth.loginTitle })).toBeInTheDocument(), WAIT)
    fireEvent.click(within(screen.getByRole('navigation', { name: viMsg.auth.tabsLabel })).getByRole('link', { name: viMsg.auth.registerTitle }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: viMsg.auth.registerTitle })).toBeInTheDocument(), WAIT)
    expect(screen.queryByRole('heading', { level: 1, name: viMsg.auth.loginTitle })).toBeNull()
    fireEvent.click(within(screen.getByRole('navigation', { name: viMsg.auth.tabsLabel })).getByRole('link', { name: viMsg.auth.loginTitle }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: viMsg.auth.loginTitle })).toBeInTheDocument(), WAIT)
    fireEvent.click(screen.getByText(viMsg.auth.toForgot))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: viMsg.auth.forgotTitle })).toBeInTheDocument(), WAIT)
    expect(screen.queryByRole('heading', { level: 1, name: viMsg.auth.loginTitle })).toBeNull()
    expect(document.querySelectorAll('main').length).toBe(1)
  })

  it('(2) đổi hash / query cùng pathname: không remount, query mới phản ánh ngay', async () => {
    reset()
    render(harness('/a'))
    await screen.findByText('trang A')
    expect(mounts.a).toBe(1)
    const main = document.querySelector('main')

    fireEvent.click(screen.getByText('q-x'))
    await waitFor(() => expect(screen.getByTestId('q-a').textContent).toBe('/x'), WAIT)
    fireEvent.click(screen.getByText('q-y'))
    await waitFor(() => expect(screen.getByTestId('q-a').textContent).toBe('/y'), WAIT)
    fireEvent.click(screen.getByText('hash'))
    await waitFor(() => expect(screen.getByTestId('search-a').textContent).toBe(''), WAIT)

    expect(mounts.a).toBe(1)
    expect(unmounts.a).toBe(0)
    expect(document.querySelector('main')).toBe(main)
    expect(document.querySelectorAll('main').length).toBe(1)
  })

  it('(2b) cấp ứng dụng: ?error= đổi trên /login hiện thông báo, không remount main', async () => {
    mockApi({})
    function Nav() {
      const navigate = useNavigate()
      return <button onClick={() => navigate('/login?error=GOOGLE_FAILED')}>nav-err</button>
    }
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
        <Nav />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { level: 1, name: viMsg.auth.loginTitle }, WAIT)
    const main = document.querySelector('main')
    fireEvent.click(screen.getByText('nav-err'))
    await screen.findByText(viMsg.errors.GOOGLE_FAILED, undefined, WAIT)
    expect(document.querySelector('main')).toBe(main)
  })

  it('(3) đổi ngôn ngữ /login -> /en/login hiển thị trang tiếng Anh', async () => {
    mockApi({})
    function Nav() {
      const navigate = useNavigate()
      return <button onClick={() => navigate('/en/login')}>to-en</button>
    }
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
        <Nav />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { level: 1, name: viMsg.auth.loginTitle }, WAIT)
    fireEvent.click(screen.getByText('to-en'))
    await screen.findByRole('heading', { level: 1, name: enMsg.auth.loginTitle }, WAIT)
    expect(screen.queryByRole('heading', { level: 1, name: viMsg.auth.loginTitle })).toBeNull()
  })

  it('(4) điều hướng nhanh A->B->C kết thúc ở C, không sót A/B', async () => {
    reset()
    render(harness('/a'))
    await screen.findByText('trang A')
    fireEvent.click(screen.getByText('go-b'))
    fireEvent.click(screen.getByText('go-c'))
    await waitFor(() => expect(screen.getByText('trang C')).toBeInTheDocument(), WAIT)
    await waitFor(() => {
      expect(screen.queryByText('trang A')).toBeNull()
      expect(screen.queryByText('trang B')).toBeNull()
    }, WAIT)
    expect(document.querySelectorAll('main').length).toBe(1)
    expect(mounts.c).toBe(1)
  })

  it('(4b) A->B rồi C sau một nhịp (B đang vào) vẫn kết thúc ở C', async () => {
    render(harness('/a'))
    await screen.findByText('trang A')
    fireEvent.click(screen.getByText('go-b'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })
    fireEvent.click(screen.getByText('go-c'))
    await waitFor(() => expect(screen.getByText('trang C')).toBeInTheDocument(), WAIT)
    await waitFor(() => expect(document.querySelectorAll('main').length).toBe(1), WAIT)
    expect(screen.queryByText('trang A')).toBeNull()
    expect(screen.queryByText('trang B')).toBeNull()
  })

  it('(5) trang đang thoát giữ location cũ; trang mới thấy location mới', async () => {
    render(harness('/a'))
    await screen.findByText('trang A')
    expect(screen.getByTestId('path-a').textContent).toBe('/a')
    fireEvent.click(screen.getByText('go-b'))
    // ngay sau khi điều hướng: A còn trong DOM (đang thoát) và vẫn thấy /a
    expect(screen.getByTestId('path-a').textContent).toBe('/a')
    await waitFor(() => expect(screen.getByTestId('path-b').textContent).toBe('/b'), WAIT)
    expect(screen.queryByTestId('path-a')).toBeNull()
  })

  it('(5b) trang thoát không bị đẩy qua <Navigate>/effect theo location mới (không lặp vô hạn)', async () => {
    const spy = vi.fn()
    function Watcher() {
      const { pathname } = useLocation()
      spy(pathname)
      return <p>watcher</p>
    }
    render(
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route
            element={
              <LazyMotion features={domAnimation} strict>
                <MotionConfig reducedMotion="user">
                  <LinkB />
                  <Wrap />
                </MotionConfig>
              </LazyMotion>
            }
          >
            <Route path="/a" element={<Watcher />} />
            <Route path="/b" element={<p>trang B</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    function LinkB() {
      return <Link to="/b">go-b</Link>
    }
    function Wrap() {
      const { pathname } = useLocation()
      return <PageTransition pageKey={pathname}>{useOutlet()}</PageTransition>
    }
    await screen.findByText('watcher')
    fireEvent.click(screen.getByText('go-b'))
    await screen.findByText('trang B', undefined, WAIT)
    // Watcher chưa từng thấy '/b'
    expect(spy.mock.calls.map((c) => c[0])).not.toContain('/b')
  })

  describe('(6) CSS', () => {
    const index = readFileSync('src/index.css', 'utf8')
    const app = readFileSync('src/styles/App.css', 'utf8')
    it.each(['--r-xs', '--r-sm', '--r-md', '--r-lg', '--g-bg', '--g-blur', '--g-border', '--g-shadow'])('index.css khai báo %s', (tok) => {
      expect(index).toMatch(new RegExp(`${tok}\\s*:`))
    })
    it('App.css có @supports not cho thẻ kính', () => {
      // Có nhiều khối @supports not (thẻ kính, trang auth, header) — thẻ sản phẩm nằm ở một trong số đó
      const blocks = [...app.matchAll(/@supports not[^{]*backdrop-filter[^{]*\{([\s\S]*?)\n\}/g)].map((x) => x[1])
      const card = blocks.find((x) => /\.product-card/.test(x))
      expect(card).toBeDefined()
      expect(card).toMatch(/var\(--g-bg-strong\)/)
    })
  })
})
