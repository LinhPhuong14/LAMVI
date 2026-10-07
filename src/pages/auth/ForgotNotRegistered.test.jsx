// @vitest-environment jsdom
// D-92: email chưa đăng ký → báo rõ và mời đăng ký, không để khách chờ một lá thư không tới.
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'

const base = { 'GET /products': () => ({ body: { items: [] } }) }
const submit = (email) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: /Gửi email đặt lại/ }))
}

describe('Quên mật khẩu với email chưa đăng ký', () => {
  const notRegistered = { 'POST /auth/forgot-password': () => ({ status: 404, body: { error: { code: 'EMAIL_NOT_REGISTERED' } } }) }

  it('hiện thông báo rõ và link tạo tài khoản; không hiện "đã gửi thư"', async () => {
    mockApi({ ...base, ...notRegistered })
    renderAt('/forgot-password')
    await screen.findByLabelText('Email')
    submit('chua-dk@example.com')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Email này chưa đăng ký tài khoản LAMVI.')
    expect(screen.getByRole('link', { name: 'Tạo tài khoản mới' }).getAttribute('href')).toBe('/register')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('form còn nguyên để nhập lại email khác; gửi lại thành công thì hiện "đã gửi"', async () => {
    let n = 0
    mockApi({
      ...base,
      'POST /auth/forgot-password': () => (n++ === 0 ? { status: 404, body: { error: { code: 'EMAIL_NOT_REGISTERED' } } } : { status: 202, body: { ok: true } }),
    })
    renderAt('/forgot-password')
    await screen.findByLabelText('Email')
    submit('sai@example.com')
    await screen.findByRole('alert')
    submit('dung@example.com')
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('link đăng ký giữ tiền tố ngôn ngữ (en/zh) và thông báo dịch được', async () => {
    mockApi({ ...base, ...notRegistered })
    renderAt('/en/forgot-password')
    await screen.findByLabelText('Email')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Send reset email/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This email is not registered with LAMVI.')
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe('/en/register')
  })

  it('lỗi khác (mạng, 429) vẫn hiện thông báo chung, không có link đăng ký', async () => {
    mockApi({ ...base, 'POST /auth/forgot-password': () => ({ status: 429, body: { error: { code: 'RATE_LIMITED' } } }) })
    renderAt('/forgot-password')
    await screen.findByLabelText('Email')
    submit('a@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent('quá nhanh')
    expect(screen.queryByRole('link', { name: 'Tạo tài khoản mới' })).toBeNull()
  })
})
