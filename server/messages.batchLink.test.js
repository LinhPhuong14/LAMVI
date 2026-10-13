import { expect, it } from 'vitest'
import { createMessageService } from './messages/service.js'

// D-104: QR chỉ nằm trên thiệp cảm ơn → trang lời chúc luôn kèm lối tới video mẻ đèn mới nhất,
// kể cả khi người mua đã soạn lời chúc (trước đây chỉ hiện khi lời chúc trống).
const now = new Date('2026-10-13T00:00:00Z')
const BATCHES = [
  { code: 'OLD-01', status: 'video_published', videoUrl: 'https://example.com/a.mp4', producedOn: '2026-08-01', title: { vi: 'Cũ' } },
  { code: 'NEW-02', status: 'video_published', videoUrl: 'https://example.com/b.mp4', producedOn: '2026-09-01', title: { vi: 'Mới' } },
  { code: 'DRAFT-03', status: 'created', videoUrl: null, producedOn: '2026-10-01', title: { vi: 'Nháp' } },
]

function view(message, batches = BATCHES) {
  const repo = {
    getOrderByQrToken: async () => ({ id: 'o1', status: 'delivered', orderKind: 'gift', hasMessage: true, deliveredAt: now.toISOString() }),
    getGiftMessage: async () => message,
    listBatches: async () => batches,
  }
  return createMessageService({ repo, storage: { signedUrl: async () => 'u', removeObject: async () => {} }, now: () => now }).view('a'.repeat(64))
}

it('lời chúc có chữ vẫn kèm lô công khai mới nhất, bỏ qua lô nháp', async () => {
  const item = await view({ text: 'Chúc mừng!', textLang: 'vi', confirmedAt: now.toISOString() })
  expect(item.state).toBe('active')
  expect(item.text).toBe('Chúc mừng!')
  expect(item.batch.code).toBe('NEW-02')
})

it('lời chúc trống vẫn kèm lô như cũ (D-76)', async () => {
  const item = await view({ text: null, confirmedAt: now.toISOString() })
  expect(item.batch.code).toBe('NEW-02')
})

it('chưa có lô công khai → batch null, không lỗi', async () => {
  const item = await view({ text: 'Chúc mừng!', textLang: 'vi', confirmedAt: now.toISOString() }, [BATCHES[2]])
  expect(item.batch).toBeNull()
})
