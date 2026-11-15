// @vitest-environment jsdom
// D-147: thư không có tên người nhận / người gửi vẫn tạo QR và hiển thị đẹp
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LetterWeb from '../letter-web/LetterWeb.jsx'
import Envelope from '../letter-web/Envelope.jsx'
import { themeOf } from '../letter-web/themes.js'
import { validateLetterContent } from '../../server/domain/letter.js'
import { withNameFallbacks, recipientOf, senderOf } from './names.js'

const reduced = () => vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => vi.unstubAllGlobals())

const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn nhé.'], template: 'web', occasionData: null, postscript: null }

describe('D-147: tên tuỳ chọn', () => {
  it('server chấp nhận tên trống/khoảng trắng, vẫn chặn tên quá dài', () => {
    const { value, errors } = validateLetterContent({ ...base, recipientName: '', senderName: '   ' })
    expect(errors).toEqual({})
    expect(value).toMatchObject({ recipientName: '', senderName: '' })
    expect(validateLetterContent({ ...base, recipientName: 'x'.repeat(61) }).errors.recipientName).toBe('TOO_LONG')
  })

  it('chữ thay thế: "bạn" cho người nhận; Phòng thư 3D có tên người gửi thay thế', () => {
    expect(recipientOf({ recipientName: '  ' })).toBe('bạn')
    expect(senderOf({})).toBe('')
    expect(withNameFallbacks({ recipientName: '', senderName: null })).toMatchObject({ recipientName: 'bạn', senderName: 'Một người thương bạn' })
    expect(withNameFallbacks({ recipientName: 'Linh', senderName: 'An' })).toMatchObject({ recipientName: 'Linh', senderName: 'An' })
  })

  it('web 2D: "Gửi bạn," và chữ ký chỉ còn "Thương mến,"', async () => {
    reduced()
    const { container } = render(<LetterWeb letter={{ ...base, recipientName: '', senderName: '' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Gửi bạn,' })).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Lời chúc gửi bạn' })).toBeTruthy()
    expect(container.querySelector('.lw-signature').textContent).toBe('Thương mến,')
    expect(container.querySelector('.lw-signature strong')).toBeNull()
  })

  it('phong bì: "Gửi bạn", xi mặc định chữ L', () => {
    const { container } = render(<Envelope theme={themeOf('thankYou')} recipientName="" senderName="" occasionLabel="Cảm ơn" open={false} out={false} />)
    expect(container.querySelector('.lw-env-to').textContent).toBe('Gửi bạn')
    expect(container.querySelector('.lw-env-sheet-title').textContent).toBe('Gửi bạn,')
    expect(container.querySelector('.lw-env-seal').textContent).toBe('L')
  })
})
