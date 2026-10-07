// @vitest-environment jsdom
// Ô "nhập lại mật khẩu mới" và danh sách quy tắc mật khẩu (D-91).
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'

const base = { 'GET /products': () => ({ body: { items: [] } }) }
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const rule = (id) => document.querySelector(`.pw-rules [data-rule="${id}"]`)

beforeEach(() => {
  window.history.replaceState(null, '', '/reset-password#t=tok1')
})

describe('Đặt lại mật khẩu: nhập lại mật khẩu mới', () => {
  it('hai ô không khớp → báo lỗi ngay ở trình duyệt, KHÔNG gọi API (token chưa bị tiêu thụ)', async () => {
    const fetchMock = mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 204 }) })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan72')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
    expect(await screen.findByText('Hai ô mật khẩu chưa khớp nhau.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/reset-password'))).toBe(false)
  })

  it('sửa ô nhập lại cho khớp → lỗi biến mất và gửi được; body có confirmPassword', async () => {
    const fetchMock = mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 204 }) })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'sai')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
    await screen.findByText('Hai ô mật khẩu chưa khớp nhau.')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    expect(screen.queryByText('Hai ô mật khẩu chưa khớp nhau.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã đổi mật khẩu')
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/auth/reset-password'))
    expect(JSON.parse(call[1].body).confirmPassword).toBe('Moi-Nang#Xuan71')
  })

  it('server báo PASSWORD_MISMATCH → hiện lỗi cạnh ô nhập lại', async () => {
    mockApi({
      ...base,
      'POST /auth/reset-password': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { confirmPassword: 'PASSWORD_MISMATCH' } } } }),
    })
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'Moi-Nang#Xuan71')
    type('Nhập lại mật khẩu mới', 'Moi-Nang#Xuan71')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
    expect(await screen.findByText('Hai ô mật khẩu chưa khớp nhau.')).toBeInTheDocument()
  })

  it('có 3 ngôn ngữ cho nhãn ô nhập lại', async () => {
    mockApi(base)
    renderAt('/zh/reset-password')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByLabelText('再次输入新密码')).toBeInTheDocument()
  })
})

describe('Danh sách quy tắc mật khẩu', () => {
  it('chưa gõ: hiện đủ 4 quy tắc + "khớp nhau", không tô đỏ', async () => {
    mockApi(base)
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    for (const id of ['length', 'lower', 'upper', 'digit', 'match']) expect(rule(id), id).not.toBeNull()
    expect(document.querySelector('.pw-rules .is-bad')).toBeNull()
    expect(document.querySelector('.pw-rules .is-ok')).toBeNull()
  })

  it('đánh dấu từng quy tắc theo từng phím và có chữ cho trình đọc màn hình', async () => {
    mockApi(base)
    renderAt('/reset-password')
    await screen.findByRole('heading', { level: 1 })
    type('Mật khẩu mới', 'abc')
    expect(rule('lower')).toHaveClass('is-ok')
    expect(rule('length')).toHaveClass('is-bad')
    expect(rule('upper')).toHaveClass('is-bad')
    expect(within(rule('length')).getByText(/chưa đạt/)).toBeInTheDocument()
    type('Mật khẩu mới', 'Abcdefg1')
    for (const id of ['length', 'lower', 'upper', 'digit']) expect(rule(id), id).toHaveClass('is-ok')
    expect(rule('match')).toHaveClass('is-bad')
    type('Nhập lại mật khẩu mới', 'Abcdefg1')
    expect(rule('match')).toHaveClass('is-ok')
  })

  it('trang đăng ký có danh sách quy tắc (không có quy tắc "khớp nhau")', async () => {
    mockApi(base)
    renderAt('/register')
    await screen.findByRole('heading', { level: 1 })
    expect(rule('digit')).not.toBeNull()
    expect(rule('match')).toBeNull()
    type('Mật khẩu', 'Abcdefg1')
    expect(rule('length')).toHaveClass('is-ok')
  })

  it('ngôn ngữ en/zh dịch quy tắc', async () => {
    mockApi(base)
    renderAt('/en/reset-password')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Be at least 8 characters')).toBeInTheDocument()
  })
})
