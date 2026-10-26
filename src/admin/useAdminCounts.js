import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context.js'

// Số việc cần xử lý để hiện huy hiệu ở thanh bên: đơn mới xác nhận (chờ làm) và yêu cầu đổi trả mới.
// Tải lại mỗi khi đổi trang trong admin để số luôn sát thực tế sau khi vừa xử lý xong.
export function useAdminCounts() {
  const { authedApi } = useAuth()
  const { pathname } = useLocation()
  const [counts, setCounts] = useState({ orders: 0, returns: 0 })

  useEffect(() => {
    let alive = true
    Promise.allSettled([authedApi('/admin/orders'), authedApi('/admin/returns?status=requested')]).then(([o, r]) => {
      if (!alive) return
      setCounts({
        orders: o.status === 'fulfilled' ? o.value.items.filter((x) => x.status === 'confirmed').length : 0,
        returns: r.status === 'fulfilled' ? (r.value.items?.length ?? 0) : 0,
      })
    })
    return () => {
      alive = false
    }
  }, [authedApi, pathname])

  return counts
}
