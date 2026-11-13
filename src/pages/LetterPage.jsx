import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import Seo from '../seo/Seo.jsx'
import LetterPaper from '../letters/LetterPaper.jsx'
import { useI18n } from '../i18n/index.js'

// D-135: trang phong thư của người nhận (subdomain riêng → /thu/<slug>). Token nằm sau dấu # (không
// vào log server/Referer) và chỉ gửi trong body POST. Sai/không có token → cùng một màn "không tìm thấy".
export default function LetterPage() {
  const { slug } = useParams()
  const [state, setState] = useState({ status: 'loading' })
  const { t } = useI18n()

  useEffect(() => {
    let alive = true
    // Token base64url không chứa ký tự cần giải mã — không decodeURIComponent (# hỏng sẽ ném lỗi)
    const token = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')
    ;(async () => {
      try {
        // Token sai định dạng (thiếu, cắt cụt, mã hoá hỏng) → không gọi API
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(404, 'NOT_FOUND')
        const r = await api('/letters/open', { method: 'POST', body: { slug, token } })
        if (!r?.item || typeof r.item !== 'object') throw new ApiError(0, 'INTERNAL_ERROR')
        if (alive) setState({ status: 'ok', letter: r.item })
      } catch (err) {
        if (alive) setState({ status: 'error', code: err instanceof ApiError ? err.status : 0 })
      }
    })()
    return () => {
      alive = false
    }
  }, [slug])

  return (
    <>
      <Seo title={t('letter.title')} noindex />
      {state.status === 'ok' ? (
        <main>
          <LetterPaper letter={state.letter} />
        </main>
      ) : (
        <main className="lt-status" role={state.status === 'loading' ? 'status' : undefined} aria-busy={state.status === 'loading'}>
          {state.status === 'loading' ? (
            <p>{t('letter.loading')}</p>
          ) : state.code === 404 ? (
            <div>
              <h1>{t('letter.notFound')}</h1>
              <p>{t('letter.notFoundHint')}</p>
            </div>
          ) : (
            <div>
              <h1>{t('letter.error')}</h1>
              <p>{t('letter.errorHint')}</p>
            </div>
          )}
        </main>
      )}
    </>
  )
}
