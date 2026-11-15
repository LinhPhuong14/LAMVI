import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import Seo from '../seo/Seo.jsx'
import IntroFilms from '../letters/IntroFilms.jsx'
import LetterExtras from '../letters/LetterExtras.jsx'
import { introSeen, markIntroSeen } from '../letters/films.js'
import { useI18n } from '../i18n/index.js'

// Phòng thư 3D (letter-room, D-136/D-137) — chỉ tải three.js sau khi xem xong hai video mở đầu
const LetterRoom = lazy(() => import('../letter-room/LetterRoom.jsx'))
// Bản web 2D (D-140) là bản chính (D-141): mọi thư mở bằng LetterWeb trừ khi admin chọn rõ Phòng thư 3D (`template: 'room'`)
const LetterWeb = lazy(() => import('../letter-web/LetterWeb.jsx'))

// D-138: trang phong thư của người nhận (/thu/<slug> trên domain chính). Token nằm sau dấu # (không
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
        // D-138: hai video LAMVI trước, xem hết mới vào phòng bật đèn
        if (alive) setState({ status: 'ok', letter: r.item, intro: true, canSkip: introSeen(slug) })
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
      {state.status === 'ok' && state.intro ? (
        <main>
          <IntroFilms
            canSkip={state.canSkip}
            onDone={(watchedAll) => {
              if (watchedAll) markIntroSeen(slug)
              setState((s) => ({ ...s, intro: false }))
            }}
          />
        </main>
      ) : state.status === 'ok' ? (
        <Suspense
          fallback={
            <main className="lt-status" role="status" aria-busy="true">
              <p>{t('letter.loading')}</p>
            </main>
          }
        >
          {/* Căn phòng: bật đèn → phong bì → thư (tiêu đề viết tay) → hai nút xem lại cuối thư */}
          {state.letter.template === 'room' ? (
            <LetterRoom letter={state.letter} afterLetter={<LetterExtras />} />
          ) : (
            <LetterWeb letter={state.letter} afterLetter={<LetterExtras />} />
          )}
        </Suspense>
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
