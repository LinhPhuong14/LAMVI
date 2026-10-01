import { useContext, useEffect, useRef, useState } from 'react'
import { UNSAFE_LocationContext as LocationContext, UNSAFE_RouteContext as RouteContext } from 'react-router-dom'
import { AnimatePresence, m, useIsPresent, useReducedMotionConfig } from 'framer-motion'
import { EASE_IN, EASE_OUT } from '../lib/motion.js'

// Chuyển trang (T-45): trang cũ mờ đi và trôi nhẹ lên, trang mới hiện từ dưới như tờ giấy dó được
// trải ra. `pageKey` đổi → AnimatePresence giữ phần tử cũ (đã chụp lúc render) cho tới khi thoát xong.
// Giảm chuyển động / SSR / lần vào đầu tiên: hiện ngay, không animation.
// Dùng đối tượng trực tiếp (không dùng tên biến thể) để không truyền xuống các `m.*` bên trong
const ENTER = { opacity: 0, y: 18 }
const SHOW = { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } }
const LEAVE = { opacity: 0, y: -10, transition: { duration: 0.22, ease: EASE_IN } }

// Sang trang khác thì về đầu trang (trừ link có #neo — trang chủ tự cuộn tới neo)
function toTop() {
  if (typeof window !== 'undefined' && !window.location.hash && window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' })
}

// Trang đang thoát phải giữ nguyên vị trí/tuyến của chính nó. Nếu không, nó đọc location mới của router:
// `<Navigate>` trong trang cũ chạy lại mỗi lần đổi đường dẫn → vòng lặp điều hướng vô hạn.
function Frozen({ children }) {
  const location = useContext(LocationContext)
  const route = useContext(RouteContext)
  const present = useIsPresent()
  const [snap, setSnap] = useState({ location, route })
  // Còn hiện diện thì theo router; thoát rồi mới đóng băng (cập nhật state ngay trong render là mẫu React cho phép)
  if (present && (snap.location !== location || snap.route !== route)) setSnap({ location, route })
  const live = present ? { location, route } : snap
  return (
    <LocationContext.Provider value={live.location}>
      <RouteContext.Provider value={live.route}>{children}</RouteContext.Provider>
    </LocationContext.Provider>
  )
}

// onAnimationStart nhận đối tượng animate (có opacity: 1) khi trang mới vào
const toTopOnShow = (def) => def?.opacity === 1 && toTop()

export default function PageTransition({ pageKey, className, children }) {
  const reduce = useReducedMotionConfig()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) first.current = false
    else if (reduce) toTop()
  }, [pageKey, reduce])
  if (reduce) return <main className={className}>{children}</main>
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.main
        key={pageKey}
        className={className ? `page-frame ${className}` : 'page-frame'}
        initial={ENTER}
        animate={SHOW}
        exit={LEAVE}
        onAnimationStart={toTopOnShow}
      >
        <Frozen>{children}</Frozen>
      </m.main>
    </AnimatePresence>
  )
}
