import { expect, it, vi } from 'vitest'
import { createMessageService } from './messages/service.js'

function fixture(remainingMs) {
  const now = new Date('2026-10-07T00:00:00Z')
  const message = { text: 'Greeting', confirmedAt: new Date(now.getTime() - 30 * 86400_000 + remainingMs).toISOString(), voicePath: 'owner/order/audio.mp3', voiceType: 'audio/mpeg' }
  const repo = { getOrderByQrToken: async () => ({ id: 'order', status: 'delivered', orderKind: 'gift', hasMessage: true }), getGiftMessage: async () => message }
  const storage = { signedUrl: vi.fn(async () => 'private-signed-url'), removeObject: vi.fn() }
  return { service: createMessageService({ repo, storage, now: () => now }), storage }
}

it('does not issue one-hour playback/download URLs near the approved retention deadline', async () => {
  const { service, storage } = fixture(10_000)
  const view = await service.view('a'.repeat(64))
  expect(view.media.voice.url).toBe('private-signed-url')
  expect(storage.signedUrl).toHaveBeenCalledTimes(2)
  for (const call of storage.signedUrl.mock.calls) expect(call[2].expiresIn).toBe(10)
})

it('does not round subsecond remaining lifetime up beyond expiry', async () => {
  const { service, storage } = fixture(500)
  const view = await service.view('a'.repeat(64))
  expect(view.media).toEqual({})
  expect(storage.signedUrl).not.toHaveBeenCalled()
})
