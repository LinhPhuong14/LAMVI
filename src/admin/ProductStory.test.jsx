// @vitest-environment jsdom
// G-108, D-105: admin nhập câu chuyện từng mẫu đèn (nhiều đoạn, 3 ngôn ngữ)
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@moc.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@moc.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const lamp = { id: 'p1', slug: 'den-thu-hoach', kind: 'single', status: 'published', price: 1400000, name: { vi: 'Đèn Thu Hoạch' }, sortOrder: 1, story: { vi: 'Truyện cũ.\n\nĐoạn hai.', en: 'Old story.' } }

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))

describe('Admin — câu chuyện mẫu đèn', () => {
  it('form sửa hiện sẵn câu chuyện hiện có ở 3 ô ngôn ngữ, có chú thích hướng dẫn', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/products': () => ({ body: { items: [lamp] } }), 'GET /admin/collections': () => ({ body: { items: [] } }) })
    renderAt('/admin/products')
    fireEvent.click(within((await screen.findByText('Đèn Thu Hoạch')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    expect(screen.getByLabelText('Câu chuyện của mẫu đèn — Tiếng Việt').value).toBe('Truyện cũ.\n\nĐoạn hai.')
    expect(screen.getByLabelText('Câu chuyện của mẫu đèn — English').value).toBe('Old story.')
    expect(screen.getByLabelText('Câu chuyện của mẫu đèn — 简体中文').value).toBe('')
    expect(screen.getByText(/Các đoạn cách nhau bằng một dòng trống/)).toBeInTheDocument()
  })

  it('lưu: PATCH gửi story đa ngôn ngữ; lỗi quá dài hiện ở trường', async () => {
    const patches = []
    mockApi({
      'GET /me': me,
      'GET /admin/products': () => ({ body: { items: [lamp] } }),
      'GET /admin/collections': () => ({ body: { items: [] } }),
      'PATCH /admin/products/p1': (url, init) => {
        patches.push(JSON.parse(init.body))
        return patches.length === 1
          ? { status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { story: 'TOO_LONG' } } } }
          : { status: 200, body: { item: lamp } }
      },
    })
    renderAt('/admin/products')
    fireEvent.click(within((await screen.findByText('Đèn Thu Hoạch')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    fireEvent.change(screen.getByLabelText('Câu chuyện của mẫu đèn — 简体中文'), { target: { value: '新故事' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].story).toEqual({ vi: 'Truyện cũ.\n\nĐoạn hai.', en: 'Old story.', zh: '新故事' })
    expect(await screen.findAllByText(/quá dài/i)).not.toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument())
  })
})
