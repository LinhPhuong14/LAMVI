import { Component, lazy, Suspense, useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { splitLocale } from '../i18n/core.js'
import MayAvatar from './MayAvatar.jsx'
import Tour from './Tour.jsx'
import { markTourDone } from './storage.js'
import { track } from '../analytics/index.js'

// Khung chat tải khi mở (không làm nặng trang)
const MayChat = lazy(() => import('./MayChat.jsx'))

// NFR-AVL-001: Mây lỗi không được chặn duyệt web
class MayBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.error('[may]', err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function MayInner() {
  const { t, path } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  const rest = splitLocale(location.pathname).rest
  const isHome = rest === '/'
  // Feedback 08/10, 7.5/16: nút Mây nổi đè lên form giỏ hàng/thanh toán trên mobile → ẩn ở hai trang này
  const hideFab = rest === '/cart' || rest === '/checkout'

  // Feedback 08/10 mục 10: không tự bật tour (che hero/CTA, tự cuộn trang). Tour là lựa chọn trong Mây (“Dẫn tour”).

  // §23.3: mascot_tour_complete — `completed` phân biệt xem hết tour hay bỏ giữa chừng
  const closeTour = useCallback((completed = false) => {
    markTourDone()
    setTouring(false)
    track('mascot_tour_complete', { completed })
  }, [])

  // I-21: mở lại tour qua nút Mây; ở trang khác thì về trang chủ (trang công khai)
  const startTour = () => {
    setOpen(false)
    if (!isHome) navigate(path('/'))
    setTouring(true)
  }

  return (
    <>
      {touring && isHome && <Tour onClose={closeTour} />}
      {open && (
        <Suspense fallback={null}>
          <MayChat onClose={() => setOpen(false)} onTour={startTour} />
        </Suspense>
      )}
      {!hideFab && <button
        type="button"
        className="may-fab"
        onClick={() => {
          // Gửi sự kiện NGOÀI hàm updater: StrictMode gọi updater hai lần ở bản dev → đếm đôi
          if (!open) track('mascot_open')
          setOpen((o) => !o)
        }}
        aria-label={t('may.open')}
        aria-expanded={open}
      >
        <MayAvatar size={60} />
      </button>}
    </>
  )
}

export default function May() {
  return (
    <MayBoundary>
      <MayInner />
    </MayBoundary>
  )
}
