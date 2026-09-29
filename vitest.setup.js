import { afterEach, vi } from 'vitest'

// Chỉ nạp jest-dom + cleanup khi test chạy trong jsdom
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup, configure } = await import('@testing-library/react')

  // findBy*/waitFor có timeout riêng (mặc định 1 s), không theo testTimeout của vitest. Khi cả bộ
  // test chạy song song, animation vào/ra của framer-motion vượt 1 s → fail giả. Nới lên 5 s.
  configure({ asyncUtilTimeout: 5000 })

  // jsdom thiếu các API framer-motion dùng (whileInView, useScroll)
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  window.IntersectionObserver ??= IO
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
  Element.prototype.scrollIntoView ??= function () {}

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })
}
