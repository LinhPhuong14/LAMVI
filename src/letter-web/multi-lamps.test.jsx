// @vitest-environment jsdom
// D-162: thắp nhiều đèn trong phong thư, xếp trên cung parabol
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LetterWeb from './LetterWeb.jsx'
import { arcLayout, lampsOf } from './themes.js'
import { validateLetterContent } from '../../server/domain/letter.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const mm = () => vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn.'], template: 'web', recipientName: 'Lan', senderName: '', occasionData: null, postscript: null }
const FIVE = ['tu-linh', 'thu-hoach', 'phuc-loc-song-toan', 'tam-duong-khai-thai', 'lon-dan']

describe('D-162: server', () => {
  it('nhận 2–5 mẫu, bỏ mẫu lạ/trùng; dưới 2 → null; lamp = đèn đầu', () => {
    expect(validateLetterContent({ ...base, lamps: ['thu-hoach', 'tu-linh'] }).value).toMatchObject({ lamps: ['thu-hoach', 'tu-linh'], lamp: 'thu-hoach' })
    expect(validateLetterContent({ ...base, lamps: ['thu-hoach', 'thu-hoach', 'x', '__proto__', 1, 'lon-dan'] }).value.lamps).toEqual(['thu-hoach', 'lon-dan'])
    expect(validateLetterContent({ ...base, lamps: [...FIVE, ...FIVE] }).value.lamps).toEqual(FIVE)
    expect(validateLetterContent({ ...base, lamp: 'lon-dan', lamps: ['tu-linh'] }).value).toMatchObject({ lamps: null, lamp: 'lon-dan' })
    for (const lamps of [undefined, null, 'tu-linh,lon-dan', { 0: 'tu-linh' }]) expect(validateLetterContent({ ...base, lamps }).value.lamps).toBeNull()
  })
})

describe('D-162: bố cục vòng cung', () => {
  it('lampsOf: thư cũ một đèn; nhiều đèn hợp lệ', () => {
    expect(lampsOf({ lamp: 'lon-dan' })).toEqual(['lon-dan'])
    expect(lampsOf({})).toEqual(['tu-linh'])
    expect(lampsOf({ lamps: ['tu-linh', 'bad'] , lamp: 'thu-hoach' })).toEqual(['thu-hoach'])
    expect(lampsOf({ lamps: ['lon-dan', 'tu-linh', 'lon-dan'] })).toEqual(['lon-dan', 'tu-linh'])
  })
  it('đèn đầu ở giữa (t = 0), các đèn sau xen kẽ phải/trái; đối xứng, nâng theo t² (parabol)', () => {
    const l3 = arcLayout(['a', 'b', 'c'])
    expect(l3.map((x) => x.slug)).toEqual(['c', 'a', 'b'])
    expect(l3.map((x) => x.t)).toEqual([-1, 0, 1])
    expect(l3.map((x) => x.depth)).toEqual([1, 0, 1])
    const l5 = arcLayout(['a', 'b', 'c', 'd', 'e'])
    expect(l5.map((x) => x.slug)).toEqual(['e', 'c', 'a', 'b', 'd'])
    expect(l5.map((x) => x.t)).toEqual([-1, -0.5, 0, 0.5, 1])
    const l4 = arcLayout(['a', 'b', 'c', 'd'])
    expect(l4.map((x) => x.slug)).toEqual(['d', 'b', 'a', 'c'])
    expect(l4[0].t).toBeCloseTo(-1)
    expect(l4[1].t).toBeCloseTo(-1 / 3)
    expect(arcLayout(['a'])).toEqual([{ slug: 'a', t: 0, depth: 0 }])
  })
})

describe('D-162: hiển thị', () => {
  it('nhiều đèn: mỗi đèn một ảnh, đèn giữa đứng trước, thắp lần lượt từ giữa; tên các đèn', () => {
    mm()
    const { container } = render(<LetterWeb letter={{ ...base, lamps: ['thu-hoach', 'tu-linh', 'lon-dan'] }} />)
    const wrap = container.querySelector('.lw-lamp-wrap')
    expect(wrap.classList.contains('is-multi')).toBe(true)
    const lamps = [...wrap.querySelectorAll('.lw-lamp')]
    expect(lamps.map((b) => b.querySelector('img').getAttribute('src'))).toEqual(['/images/lamps/lon-dan-cutout.webp', '/images/lamps/thu-hoach-cutout.webp', '/images/lamps/tu-linh-cutout.webp'])
    expect(lamps.map((b) => b.style.zIndex)).toEqual(['9', '10', '9'])
    expect(lamps.map((b) => b.style.getPropertyValue('--d'))).toEqual(['0.35s', '0s', '0.35s'])
    expect(lamps.map((b) => b.style.getPropertyValue('--t2'))).toEqual(['1', '0', '1'])
    expect(container.querySelector('.lw-lamp-name').textContent).toBe('Thu Hoạch · Tứ Linh · Lợn Đàn')
    // chạm vào bất kỳ đèn nào cũng bật
    fireEvent.click(lamps[0])
    expect(container.querySelector('.lw-page').classList.contains('is-lit')).toBe(true)
  })
  it('một đèn: như cũ (không is-multi, không style vị trí)', () => {
    mm()
    const { container } = render(<LetterWeb letter={{ ...base, lamp: 'lon-dan' }} />)
    expect(container.querySelector('.lw-lamp-wrap.is-multi')).toBeNull()
    const lamps = container.querySelectorAll('.lw-lamp')
    expect(lamps).toHaveLength(1)
    expect(lamps[0].getAttribute('style')).toBeNull()
    expect(container.querySelector('.lw-lamp-name').textContent).toBe('Đèn Lợn Đàn')
  })
})

describe('D-162: admin', () => {
  it('bật "Thắp nhiều đèn", chọn theo thứ tự → gửi lamps (đèn đầu ở giữa); dưới 2 đèn có cảnh báo', async () => {
    const ID = '11111111-2222-4333-8444-555555555555'
    const calls = []
    let stored = null
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }))
    mockApi({
      'GET /me': () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } }),
      'POST /admin/letters': (_u, init) => {
        const b = JSON.parse(init.body)
        calls.push(b)
        stored = { id: ID, orderId: null, label: b.label, status: 'draft', content: b.content, url: null }
        return { status: 201, body: { item: stored } }
      },
      [`GET /admin/letters/${ID}`]: () => ({ body: { item: stored } }),
    })
    renderAt('/admin/letters/new')
    fireEvent.change(await screen.findByLabelText('Nội dung thư'), { target: { value: 'Chào bạn.' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thắp nhiều đèn (xếp vòng cung)' }))
    // bật lên thì đèn đang chọn (mặc định Tứ Linh) thành đèn giữa
    expect(screen.getByRole('button', { name: /Tứ Linh/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Chọn ít nhất 2 đèn (chưa đủ thì thư dùng một đèn).')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Lợn Đàn/ }))
    fireEvent.click(screen.getByRole('button', { name: /Thu Hoạch/ }))
    expect(screen.queryByText('Chọn ít nhất 2 đèn (chưa đủ thì thư dùng một đèn).')).toBeNull()
    expect(screen.getByRole('link', { name: /Xem mẫu web 2D/ }).getAttribute('href')).toContain('lamps=tu-linh,lon-dan,thu-hoach')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].content).toMatchObject({ lamps: ['tu-linh', 'lon-dan', 'thu-hoach'], lamp: 'tu-linh' })
    // nạp lại từ server: vẫn bật và giữ thứ tự
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Thắp nhiều đèn (xếp vòng cung)' }).checked).toBe(true))
    expect(screen.getByRole('button', { name: /Lợn Đàn/ }).textContent).toContain('2')
    act(() => {})
  })
})
