import { useEffect } from 'react'
import { useHeadCollector } from '../seo/context.js'

// BR-SEO-001, D-44: trang QR, tài khoản, giỏ, checkout, admin không được index
export function useNoIndex() {
  const collector = useHeadCollector()
  // SSR: báo cho server chèn meta robots vào HTML
  collector?.markNoindex()

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    meta.setAttribute('data-noindex', '')
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
