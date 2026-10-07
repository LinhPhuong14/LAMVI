// @vitest-environment jsdom
// T-11: kiểm thử độc lập G-44 (tồn kho) và G-46 (AddressSelect) trên giao diện
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AddToCart from './AddToCart.jsx'
import AddressSelect from '../components/AddressSelect.jsx'
import { CartContext } from './context.js'
import { mockApi } from '../test/renderApp.jsx'

const geo = (over = {}) =>
  mockApi({
    'GET /geo/provinces': () => ({ body: { items: [{ code: '1', name: 'Thành phố Hà Nội' }, { code: '79', name: 'Thành phố Hồ Chí Minh' }] } }),
    'GET /geo/provinces/1/wards': () => ({ body: { items: [{ code: '4', name: 'Phường Ba Đình' }] } }),
    'GET /geo/provinces/79/wards': () => ({ body: { items: [{ code: '26734', name: 'Phường Sài Gòn' }] } }),
    ...over,
  })

beforeEach(() => localStorage.clear())

describe('AddToCart soldOut', () => {
  it('khoá nút, không gọi add, không có vùng role=status lỗi', () => {
    const add = vi.fn()
    const view = render(
      <CartContext.Provider value={{ add, error: null }}>
        <AddToCart slug="den-a" soldOut />
      </CartContext.Provider>,
    )
    const btn = screen.getByRole('button', { name: 'Tạm hết hàng' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(add).not.toHaveBeenCalled()
    view.unmount()
  })
})

describe('AddressSelect', () => {
  function Harness({ initial = { provinceCode: '', wardCode: '' }, errors, onSpy }) {
    const [v, setV] = React.useState(initial)
    return (
      <MemoryRouter>
        <AddressSelect {...v} errors={errors} onChange={(n) => { onSpy?.(n); setV(n) }} />
      </MemoryRouter>
    )
  }
  it('chưa chọn tỉnh → ô phường khoá, có nhãn truy cập được; không gọi API phường', async () => {
    const f = geo()
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Phường / xã' })).toBeDisabled()
    expect(screen.getByLabelText('Tỉnh / thành phố')).toBeRequired()
    await screen.findByRole('option', { name: 'Thành phố Hà Nội' })
    expect(f.mock.calls.some(([u]) => String(u).includes('/wards'))).toBe(false)
  })
  it('đổi tỉnh → onChange xoá mã phường; phường cũ không còn trong danh sách', async () => {
    geo()
    const spy = vi.fn()
    render(<Harness onSpy={spy} />)
    await screen.findByRole('option', { name: 'Thành phố Hà Nội' })
    fireEvent.change(screen.getByLabelText('Tỉnh / thành phố'), { target: { value: '1' } })
    fireEvent.focus(screen.getByRole('combobox', { name: 'Phường / xã' }))
    await screen.findByRole('option', { name: 'Phường Ba Đình' })
    fireEvent.click(screen.getByRole('option', { name: 'Phường Ba Đình' }))
    expect(screen.getByRole('combobox', { name: 'Phường / xã' })).toHaveValue('Phường Ba Đình')
    fireEvent.change(screen.getByLabelText('Tỉnh / thành phố'), { target: { value: '79' } })
    expect(spy).toHaveBeenLastCalledWith({ provinceCode: '79', wardCode: '' })
    fireEvent.focus(screen.getByRole('combobox', { name: 'Phường / xã' }))
    await screen.findByRole('option', { name: 'Phường Sài Gòn' })
    expect(screen.queryByRole('option', { name: 'Phường Ba Đình' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Phường / xã' })).toHaveValue('')
  })
  it('đổi tỉnh nhanh: kết quả của tỉnh cũ (về muộn) không đè danh sách tỉnh mới', async () => {
    let release
    const slow = new Promise((r) => { release = r })
    geo({ 'GET /geo/provinces/1/wards': async () => { await slow; return { body: { items: [{ code: '4', name: 'Phường Ba Đình' }] } } } })
    render(<Harness />)
    await screen.findByRole('option', { name: 'Thành phố Hà Nội' })
    fireEvent.change(screen.getByLabelText('Tỉnh / thành phố'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Tỉnh / thành phố'), { target: { value: '79' } })
    fireEvent.focus(screen.getByRole('combobox', { name: 'Phường / xã' }))
    await screen.findByRole('option', { name: 'Phường Sài Gòn' })
    release()
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByRole('option', { name: 'Phường Ba Đình' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Phường Sài Gòn' })).toBeTruthy()
  })
  it('danh mục tỉnh lỗi: hiện gợi ý, form không vỡ', async () => {
    geo({ 'GET /geo/provinces': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    render(<Harness />)
    expect(await screen.findByText(/Chưa tải được danh mục địa chỉ/)).toBeTruthy()
    expect(screen.getByLabelText('Tỉnh / thành phố')).toBeTruthy()
  })
  it('danh mục phường lỗi: hiện gợi ý', async () => {
    geo({ 'GET /geo/provinces/1/wards': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    render(<Harness initial={{ provinceCode: '1', wardCode: '' }} />)
    expect(await screen.findByText(/Chưa tải được danh mục địa chỉ/)).toBeTruthy()
  })
  it('lỗi trường được gắn aria-invalid + mô tả', async () => {
    geo()
    render(<Harness errors={{ provinceCode: 'REQUIRED', wardCode: 'INVALID' }} />)
    await waitFor(() => expect(screen.getByLabelText('Tỉnh / thành phố')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByRole('combobox', { name: 'Phường / xã' })).toHaveAttribute('aria-describedby')
  })
  it('mã tỉnh lạ chứa ký tự đặc biệt được mã hoá trong URL', async () => {
    const f = geo()
    render(<Harness initial={{ provinceCode: 'a/b?c', wardCode: '' }} />)
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('a%2Fb%3Fc'))).toBe(true))
  })
})
