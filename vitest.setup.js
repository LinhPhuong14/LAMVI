import { afterEach } from 'vitest'

// Chỉ nạp jest-dom + cleanup khi test chạy trong jsdom
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => cleanup())
}
