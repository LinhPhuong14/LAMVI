import { describe, expect, it } from 'vitest'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMayService } from './may/service.js'
import { toPlainText } from './may/guard.js'

// Khung chat Mây hiển thị văn bản thuần: không để lộ markdown hay link bịa domain
describe('toPlainText', () => {
  it('markdown link → chỉ giữ chữ (lỗi thật trên production: domain lamvi.com bịa)', () => {
    expect(toPlainText('Đèn Nguyệt có giá 890.000 VND (chưa bao gồm VAT). Bạn có thể tìm hiểu thêm [tại đây](https://lamvi.com/products/den-nguyet).')).toBe(
      'Đèn Nguyệt có giá 890.000 VND (chưa bao gồm VAT). Bạn có thể tìm hiểu thêm tại đây.',
    )
  })

  it('link tương đối và link có ngoặc trong URL', () => {
    expect(toPlainText('Xem [Đèn Vọng](/products/den-vong) nhé')).toBe('Xem Đèn Vọng nhé')
    expect(toPlainText('Xem [ở đây](https://x.vn/a_(b)) nha')).toBe('Xem ở đây nha')
  })

  it('URL trần, www, URL trong ngoặc → bỏ, không để ngoặc rỗng hay khoảng trắng thừa', () => {
    expect(toPlainText('Xem https://lamvi.com/products/den-nguyet nhé')).toBe('Xem nhé')
    expect(toPlainText('Trang: www.lamvi.com')).toBe('Trang:')
    expect(toPlainText('Đèn Nguyệt (https://lamvi.com/x) rất đẹp')).toBe('Đèn Nguyệt rất đẹp')
  })

  it('bỏ **đậm** và __đậm__, giữ nguyên dấu * đơn', () => {
    expect(toPlainText('Giá **890.000 VND** và __chưa VAT__')).toBe('Giá 890.000 VND và chưa VAT')
    expect(toPlainText('3 * 2 = 6')).toBe('3 * 2 = 6')
  })

  it('giữ nguyên văn bản thường, xuống dòng và tiếng Trung', () => {
    expect(toPlainText('Chào bạn!\nMây giúp gì được nè?')).toBe('Chào bạn!\nMây giúp gì được nè?')
    expect(toPlainText('月灯价格为 890.000 越南盾（不含增值税）')).toBe('月灯价格为 890.000 越南盾（不含增值税）')
  })
})

describe('Mây trả lời qua OpenAI → văn bản thuần', () => {
  const fake = (content) => ({
    calls: [],
    async complete({ messages }) {
      this.calls.push(messages)
      return { message: { role: 'assistant', content }, usage: { promptTokens: 10, completionTokens: 5 } }
    },
  })

  it('link markdown trong câu trả lời bị bỏ; system prompt cấm link/URL', async () => {
    const openai = fake('Mây đây! Xem [trang sản phẩm](https://lamvi.com/products) nha.')
    const may = createMayService({ repo: createMemoryRepo(), openai, random: () => 0 })
    const reply = await may.chat({ message: 'Có những đèn nào?', lang: 'vi', sessionId: 'sess-12345678', history: [], user: null, ip: '1.1.1.1' })
    expect(reply).toEqual({ kind: 'answer', text: 'Mây đây! Xem trang sản phẩm nha.' })
    expect(openai.calls[0][0].content).toMatch(/no links, no URLs/)
  })
})
