import { createContext, useContext } from 'react'

// SSR: bộ thu thập head/status do server truyền vào; client: null
export const HeadContext = createContext(null)
// Kho dữ liệu API nạp sẵn khi SSR (createDataStore): key '<path>|<lang>' → { data } | { error: { status, code } }
export const DataContext = createContext(null)

export const useHeadCollector = () => useContext(HeadContext)

// Bộ thu thập cho entry-server (các trang ghi qua hàm, không sửa trực tiếp giá trị context)
export function createHeadCollector(siteUrl) {
  const state = { siteUrl, tags: [], status: 200, noindex: false }
  return {
    siteUrl,
    state,
    // Trang con render sau cùng thắng (vd trang lỗi thay trang chủ)
    setTags: (tags) => {
      state.tags = tags
    },
    setStatus: (status) => {
      state.status = status
    },
    markNoindex: () => {
      state.noindex = true
    },
  }
}

// Gốc URL tuyệt đối (canonical, hreflang)
export function useSiteUrl() {
  const collector = useContext(HeadContext)
  if (collector) return collector.siteUrl
  return typeof window === 'undefined' ? '' : window.location.origin
}

// Kho dữ liệu SSR cho useApi: đọc theo key; clear() sau khi hydrate xong (AppShell)
export function createDataStore(data = {}) {
  let entries = { ...data }
  return {
    get: (key) => entries[key],
    clear: () => {
      entries = {}
    },
  }
}
