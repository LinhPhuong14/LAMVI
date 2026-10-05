import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { api, ApiError } from '../api/client.js'
import Seo from '../seo/Seo.jsx'
import { track } from '../analytics/index.js'

// FR-QR-002…005, US-004: trang QR lời chúc cho người nhận. Không cần tài khoản — bảo vệ bằng token
// ngẫu nhiên (BR-QR-001). Luôn noindex (BR-SEO-001, D-44). Token không bao giờ gửi sang GA
// (sanitizePath thay bằng /qr/:token — NFR-PRV-002).
export default function GiftPage() {
  const { token } = useParams()
  const { t, lang, path } = useI18n()
  const [state, setState] = useState({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [translation, setTranslation] = useState(null) // { lang, text }
  const [shown, setShown] = useState(false)
  const [error, setError] = useState(null)
  const opened = useRef(false)

  const load = useCallback(async () => {
    try {
      const r = await api(`/qr/${encodeURIComponent(token)}`)
      // Phản hồi 200 nhưng không có `item` (proxy/phiên bản lệch) → báo lỗi thay vì làm trắng trang
      if (!r?.item || typeof r.item !== 'object') throw new ApiError(0, 'INTERNAL_ERROR')
      setState({ status: 'ok', item: r.item })
    } catch (err) {
      setState({ status: 'error', error: err instanceof ApiError ? err : new ApiError(0, 'INTERNAL_ERROR') })
    }
  }, [token])

  useEffect(() => {
    // Đồng bộ với hệ thống ngoài (API); mọi setState trong load đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  // §23.3 open_qr_gift: một lần mỗi lần mở trang, chỉ khi token hợp lệ
  useEffect(() => {
    if (state.status !== 'ok' || opened.current) return
    opened.current = true
    track('open_qr_gift')
  }, [state.status])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const r = await api(`/qr/${encodeURIComponent(token)}/confirm`, { method: 'POST', body: {} })
      if (!r?.item || typeof r.item !== 'object') throw new ApiError(0, 'INTERNAL_ERROR')
      setState({ status: 'ok', item: r.item })
      track('confirm_gift_received')
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
      // Đơn vừa đổi trạng thái (vd chưa gửi đi) → lấy lại để hiển thị đúng
      if (err.code === 'GIFT_NOT_READY') load()
    } finally {
      setBusy(false)
    }
  }

  async function translate(target) {
    // Đã có bản dịch cho ngôn ngữ này (cache ở server hoặc vừa dịch) → chỉ bật/tắt hiển thị
    const have = translation?.lang === target ? translation : state.item.translations?.[target] && { lang: target, text: state.item.translations[target] }
    if (have) {
      setTranslation(have)
      setShown((s) => !s)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await api(`/qr/${encodeURIComponent(token)}/translate`, { method: 'POST', body: { lang: target } })
      setTranslation({ lang: r.item.lang, text: r.item.text })
      setShown(true)
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
    } finally {
      setBusy(false)
    }
  }

  const head = <Seo title={t('gift.eyebrow')} noindex />

  if (state.status === 'loading') {
    return (
      <section className="page-section narrow">
        {head}
        <p role="status">{t('gift.loading')}</p>
      </section>
    )
  }

  if (state.status === 'error') {
    // AC-004: mọi mã không dùng được đều hiện cùng một trang, không lộ đơn có tồn tại hay không
    const notFound = state.error.status === 404
    return (
      <section className="page-section narrow">
        <Seo title={notFound ? t('gift.notFoundTitle') : t('gift.errorTitle')} noindex status={notFound ? 404 : 500} />
        <h1 className="page-title">{notFound ? t('gift.notFoundTitle') : t('gift.errorTitle')}</h1>
        <p>{notFound ? t('gift.notFoundText') : t(`errors.${state.error.code}`)}</p>
        <Link to={path('/')} className="btn btn-primary" style={{ marginTop: 24 }}>
          {t('gift.toHome')}
        </Link>
      </section>
    )
  }

  const m = state.item

  if (m.state === 'preparing') {
    return (
      <section className="page-section narrow gift-page">
        {head}
        <span className="eyebrow">{t('gift.eyebrow')}</span>
        <h1 className="page-title">{t('gift.preparingTitle')}</h1>
        <p>{t('gift.preparingText')}</p>
      </section>
    )
  }

  if (m.state === 'greeting') {
    return (
      <section className="page-section narrow gift-page">
        {head}
        <span className="eyebrow">{t('gift.eyebrow')}</span>
        <h1 className="page-title">{t('gift.greetingTitle')}</h1>
        <p>{t('gift.greetingText')}</p>
        {error && (
          <p className="notice error" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
          {busy ? t('gift.confirming') : t('gift.confirm')}
        </button>
        <p className="field-hint" style={{ marginTop: 24 }}>
          {t('gift.private')}
        </p>
      </section>
    )
  }

  // Server mới hơn client có thể trả trạng thái chưa biết: không được hiện như đã mở lời chúc
  if (m.state !== 'active') {
    return (
      <section className="page-section narrow">
        <Seo title={t('gift.errorTitle')} noindex status={500} />
        <h1 className="page-title">{t('gift.errorTitle')}</h1>
        <p>{t('errors.INTERNAL_ERROR')}</p>
      </section>
    )
  }

  // m.state === 'active'
  const hasMedia = Boolean(m.media?.voice || m.media?.video)
  const empty = !m.text && !hasMedia && !m.mediaExpired
  // Chỉ dịch khi ngôn ngữ giao diện khác ngôn ngữ của lời chúc (§21.4(6))
  const canTranslate = Boolean(m.text) && m.textLang && m.textLang !== lang
  const days = m.mediaDaysLeft

  return (
    <section className="page-section narrow gift-page">
      {head}
      <span className="eyebrow">{t('gift.eyebrow')}</span>

      {empty ? (
        <>
          <h1 className="page-title">{t('gift.emptyTitle')}</h1>
          <p>{t('gift.emptyText')}</p>
          {m.batch && (
            <Link to={path(`/lo/${encodeURIComponent(m.batch.code)}`)} className="btn btn-primary" style={{ marginTop: 16 }}>
              {t('gift.watchBatch')}
            </Link>
          )}
        </>
      ) : (
        <>
          <h1 className="page-title">{t('gift.original')}</h1>
          {m.text && (
            <div className="account-card gift-card">
              <p className="gift-text" lang={m.textLang ?? undefined}>
                {m.text}
              </p>
              {canTranslate && (
                <button type="button" className="btn btn-ghost" onClick={() => translate(lang)} disabled={busy}>
                  {busy ? t('gift.translating') : t('gift.translate')}
                </button>
              )}
              {shown && translation && (
                <div className="gift-translation" role="region" aria-label={t('gift.translated')}>
                  <span className="status">{t('gift.translated')}</span>
                  <p className="gift-text" lang={translation.lang}>
                    {translation.text}
                  </p>
                  <p className="field-hint">{t('gift.translatedHint')}</p>
                </div>
              )}
            </div>
          )}
          {error && (
            <p className="notice error" role="alert">
              {t(`errors.${error}`)}
            </p>
          )}

          {m.media?.voice && (
            <div className="account-card gift-card">
              <h2>{t('gift.voice')}</h2>
              <audio className="gift-audio" src={m.media.voice.url} controls preload="none" />
              <a className="btn btn-ghost" href={m.media.voice.downloadUrl} download>
                {t('gift.download')}
              </a>
            </div>
          )}
          {m.media?.video && (
            <div className="account-card gift-card">
              <h2>{t('gift.video')}</h2>
              <video className="batch-video" src={m.media.video.url} controls playsInline preload="metadata" />
              <a className="btn btn-ghost" href={m.media.video.downloadUrl} download>
                {t('gift.download')}
              </a>
            </div>
          )}
          {/* BR-MSG-004: đếm ngược ngày xoá media */}
          {hasMedia && days !== null && (
            <p className="notice" role="status">
              {days <= 0 ? t('gift.countdownToday') : t('gift.countdown', { days })}
            </p>
          )}
          {m.mediaExpired && <p className="notice">{t('gift.mediaExpired')}</p>}
        </>
      )}
      <p className="field-hint" style={{ marginTop: 24 }}>
        {t('gift.private')}
      </p>
    </section>
  )
}
