import { useEffect } from 'react'

// BR-SEO-001, D-44: trang QR, tài khoản, giỏ, checkout, admin không được index
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
