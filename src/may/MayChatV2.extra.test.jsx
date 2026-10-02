// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const base = { 'GET /products': () => ({ body: { items: [] } }), 'GET /faq': () => ({ body: { items: [] } }) }
const CHIP1 = 'Đèn làm từ chất liệu gì?'
beforeEach(() => {
  localStorage.setItem('moc.tour.done', '1')
  try { sessionStorage.clear() } catch { /* bỏ qua */ }
})
const open = async () => fireEvent.click(await screen.findByRole('button', { name: 'Trò chuyện với Mây' }))
const chips = () => document.querySelectorAll('.may-chip')

describe('MayChat v2', () => {
  it('chip hiện trước tin đầu; bấm chip gửi đúng nội dung và ẩn chip; typing có chữ cho trình đọc màn hình', async () => {
    const bodies = []
    let release
    const gate = new Promise((r) => { release = r })
    mockApi({
      ...base,
      'POST /may/chat': async (url, init) => {
        bodies.push(JSON.parse(init.body))
        await gate
        return { body: { reply: { kind: 'answer', text: 'Giấy dó và tre' } } }
      },
    })
    renderAt('/')
    await open()
    await waitFor(() => expect(chips()).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: CHIP1 }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].message).toBe(CHIP1)
    expect(chips()).toHaveLength(0)
    const typing = document.querySelector('.may-typing')
    expect(typing).not.toBeNull()
    expect(typing.textContent).toContain('Mây đang nghĩ…')
    release()
    expect(await screen.findByText('Giấy dó và tre')).toBeInTheDocument()
    expect(document.querySelector('.may-typing')).toBeNull()
    expect(chips()).toHaveLength(0)
  })

  it('nút gửi tắt khi rỗng; Enter gửi, Shift+Enter không gửi', async () => {
    const bodies = []
    mockApi({ ...base, 'POST /may/chat': (u, init) => (bodies.push(JSON.parse(init.body)), { body: { reply: { kind: 'answer', text: 'ok' } } }) })
    renderAt('/')
    await open()
    const send = await screen.findByRole('button', { name: 'Gửi' })
    expect(send).toBeDisabled()
    const box = screen.getByLabelText('Nhập câu hỏi…')
    fireEvent.change(box, { target: { value: '   ' } })
    expect(send).toBeDisabled()
    fireEvent.change(box, { target: { value: 'chào Mây' } })
    expect(send).toBeEnabled()
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(bodies).toHaveLength(0)
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].message).toBe('chào Mây')
    expect(await screen.findByText('ok')).toBeInTheDocument()
    expect(box.value).toBe('')
    expect(chips()).toHaveLength(0)
  })

  it('"Dẫn tour" vẫn mở tour', async () => {
    mockApi(base)
    renderAt('/')
    await open()
    fireEvent.click(await screen.findByRole('button', { name: 'Dẫn tour' }))
    expect(await screen.findByRole('dialog', { name: 'Tour cùng Mây' })).toBeInTheDocument()
  })
})
