// @vitest-environment jsdom
// Kiểm thử độc lập D-104: trang chủ đồng bộ nội dung thật, trang lời chúc luôn có link video mẻ đèn
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'

const handlers = { 'GET /products': () => ({ body: productsVi }), 'GET /faq': () => ({ body: faqVi }) }
const body = () => document.body.textContent

describe('Trang chủ — nội dung thật (D-104)', () => {
  it('vi: số liệu 5/3/1, nghệ nhân Ưu tú Nguyễn Hữu Quả, 5 tên lookbook, không còn số liệu mẫu', async () => {
    mockApi(handlers)
    renderAt('/')
    await screen.findAllByText('Đèn Nguyệt')
    const t = body()
    expect(t).toContain('chiếc đèn trong bộ sưu tập đầu tiên')
    expect(t).toContain('chặng hành trình')
    expect(t).toContain('Nghệ nhân Ưu tú Nguyễn Hữu Quả')
    for (const n of ['Thu Hoạch', 'Tứ Linh', 'Phúc Lộc Song Toàn', 'Tam Dương Khai Thái', 'Lợn Đàn']) expect(t).toContain(n)
    expect(t).not.toContain('năm nghề giấy dó')
    expect(t).not.toContain('nghệ nhân đồng hành')
    expect(t).not.toContain('Nguyễn Văn Tài')
    expect(t).not.toContain('4.000')
    expect(t).not.toContain('năm trong nghề')
    expect(document.querySelector('.artisan-stats')).toBeNull()
    expect(document.querySelector('.portrait-quote-mark')).toBeNull()
  })

  it('vi: lời trích nghệ nhân không bị bọc dấu ngoặc kép; không chữ "khắc QR" ở khối quy trình / QR', async () => {
    mockApi(handlers)
    renderAt('/')
    await screen.findAllByText('Đèn Nguyệt')
    expect(body()).not.toMatch(/[“”]Giấy dó lấy từ Dương Ổ/)
    expect(body()).not.toMatch(/(?<!không )khắc QR/)
    expect(body()).not.toMatch(/mã khắc trên đèn/)
  })

  it('en và zh: không rơi về key thô hay chữ vi, có tên nghệ nhân', async () => {
    mockApi(handlers)
    renderAt('/en')
    await screen.findAllByText('Đèn Nguyệt')
    expect(body()).toContain('Meritorious Artisan Nguyễn Hữu Quả')
    expect(body()).toContain('lanterns in the first collection')
    expect(body()).not.toMatch(/story\.stat|artisan\.(years|made)/)
    expect(body()).not.toMatch(/engrav(ed|ing) (code|on the lantern)/i)
  })

  it('zh: số liệu và nghệ nhân có chữ Hán', async () => {
    mockApi(handlers)
    renderAt('/zh')
    await screen.findAllByText('Đèn Nguyệt')
    expect(body()).toContain('阮有果')
    expect(body()).not.toMatch(/story\.stat|artisan\.(years|made)/)
  })
})
