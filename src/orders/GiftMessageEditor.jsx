import { useCallback, useEffect, useRef, useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { uploadFile } from '../admin/uploadFile.js'

const MB = 1024 * 1024
const LOCKED_CODES = new Set(['MESSAGE_TEXT_LOCKED', 'MESSAGE_LOCKED'])
const ACCEPT = { voice: 'audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,audio/wav', video: 'video/mp4,video/webm,video/quicktime' }

// Một dòng media (giọng nói hoặc video): tải lên bằng signed URL, gỡ
function MediaRow({ kind, has, disabled, limitBytes, onUpload, onRemove, busy, progress }) {
  const { t } = useI18n()
  const input = useRef(null)
  const [tooBig, setTooBig] = useState(false)

  function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Kiểm sớm để khỏi tải cả file rồi mới bị từ chối; server vẫn kiểm lại (nguồn sự thật)
    setTooBig(file.size > limitBytes)
    if (file.size <= limitBytes) onUpload(kind, file)
  }

  return (
    <div className="gift-media-row">
      <strong>{t(`giftEditor.${kind}`)}</strong>
      <span className="field-hint">{progress !== null ? t('giftEditor.uploading', { percent: progress }) : has ? t('giftEditor.uploaded') : t('giftEditor.none')}</span>
      <input ref={input} type="file" accept={ACCEPT[kind]} onChange={pick} hidden aria-label={t(`giftEditor.${kind}`)} />
      <button type="button" className="btn btn-ghost btn-small" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {has ? t('giftEditor.replace') : t('giftEditor.choose')}
      </button>
      {has && (
        <button type="button" className="btn btn-ghost btn-small" disabled={disabled || busy} onClick={() => onRemove(kind)}>
          {t('giftEditor.remove')}
        </button>
      )}
      {tooBig && (
        <span className="field-error" role="alert">
          {t('errors.MEDIA_TOO_LARGE')}
        </span>
      )}
    </div>
  )
}

/**
 * FR-ACC-003, US-003: người mua soạn/sửa lời chúc của đơn. Chữ khoá từ PACKED (BR-MSG-008), mọi thứ
 * khoá từ SHIPPED (BR-MSG-001) — server là nơi quyết định, ở đây chỉ phản chiếu `canEditText/Media`.
 * Q-27 (mặc định): người mua KHÔNG xem trang QR; chỉ biết người nhận đã xác nhận hay chưa.
 */
export default function GiftMessageEditor({ code }) {
  const { t } = useI18n()
  const { authedApi } = useAuth()
  const base = `/orders/${encodeURIComponent(code)}/message`
  const [item, setItem] = useState(null)
  const [text, setText] = useState('')
  const [textLang, setTextLang] = useState('vi')
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ voice: null, video: null })

  const apply = useCallback((it) => {
    setItem(it)
    setText(it.text ?? '')
    setTextLang(it.textLang)
  }, [])

  // Đơn có thể vừa bị khoá (admin bấm "Đã đóng gói"/"Đã gửi") giữa lúc khách đang soạn: lấy lại trạng thái
  // thật để khung phản chiếu đúng, nhưng GIỮ chữ khách đang gõ dở (không ghi đè ô nhập)
  const refreshLock = useCallback(async () => {
    try {
      const r = await authedApi(base)
      setItem(r.item)
    } catch {
      /* giữ nguyên khung hiện tại; thông báo lỗi đã hiện */
    }
  }, [authedApi, base])

  useEffect(() => {
    let alive = true
    authedApi(base)
      .then((r) => alive && apply(r.item))
      .catch((err) => alive && setError(err.code ?? 'INTERNAL_ERROR'))
    return () => {
      alive = false
    }
  }, [authedApi, base, apply])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})
    setSaved(false)
    try {
      const r = await authedApi(base, { method: 'PUT', body: { text, textLang } })
      apply(r.item)
      setSaved(true)
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
      setFieldErrors(err.fields ?? {})
      if (LOCKED_CODES.has(err.code)) await refreshLock()
    } finally {
      setBusy(false)
    }
  }

  async function upload(kind, file) {
    setBusy(true)
    setError(null)
    setProgress((p) => ({ ...p, [kind]: 0 }))
    try {
      const up = await authedApi(`${base}/media-upload`, { method: 'POST', body: { kind, contentType: file.type, size: file.size } })
      await uploadFile(up.uploadUrl, file, up.headers, (percent) => setProgress((p) => ({ ...p, [kind]: percent })))
      const r = await authedApi(`${base}/media`, { method: 'POST', body: { kind, path: up.path } })
      // Chỉ cập nhật cờ media; giữ nguyên chữ người dùng đang gõ dở
      setItem(r.item)
    } catch (err) {
      setError(err.fields ? Object.values(err.fields)[0] : (err.code ?? 'INTERNAL_ERROR'))
      if (LOCKED_CODES.has(err.code)) await refreshLock()
    } finally {
      setProgress((p) => ({ ...p, [kind]: null }))
      setBusy(false)
    }
  }

  async function removeMedia(kind) {
    setBusy(true)
    setError(null)
    try {
      const r = await authedApi(`${base}/media/${kind}`, { method: 'DELETE' })
      setItem(r.item)
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
      if (LOCKED_CODES.has(err.code)) await refreshLock()
    } finally {
      setBusy(false)
    }
  }

  if (!item) {
    return error ? (
      <p className="notice error" role="alert">
        {t(`errors.${error}`)}
      </p>
    ) : null
  }
  if (!item.allowed) return null

  const { limits } = item
  return (
    <section className="account-card gift-editor" aria-labelledby={`gift-${code}`}>
      <h2 id={`gift-${code}`}>{t('giftEditor.title')}</h2>
      <p className="field-hint">{t('giftEditor.intro')}</p>
      <p className="status" role="status">
        {t(`giftEditor.states.${item.state}`)}
      </p>
      {item.confirmed && <p className="notice success">{t('giftEditor.confirmed')}</p>}
      {!item.canEditText && <p className="notice">{item.canEditMedia ? t('giftEditor.textLocked') : t('giftEditor.allLocked')}</p>}
      {item.mediaDeleted && <p className="notice">{t('giftEditor.mediaDeleted')}</p>}

      <form onSubmit={save} noValidate>
        <Field
          as="textarea"
          label={t('giftEditor.text')}
          rows={5}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setSaved(false)
          }}
          disabled={!item.canEditText || busy}
          error={fieldErrors.text}
          hint={t('giftEditor.counter', { n: [...text].length, max: limits.maxChars })}
        />
        <Field
          as="select"
          label={t('giftEditor.lang')}
          value={textLang}
          onChange={(e) => setTextLang(e.target.value)}
          disabled={!item.canEditText || busy}
          error={fieldErrors.textLang}
          hint={t('giftEditor.langHint')}
        >
          {['vi', 'en', 'zh'].map((l) => (
            <option key={l} value={l}>
              {t(`giftEditor.langs.${l}`)}
            </option>
          ))}
        </Field>
        <button type="submit" className="btn btn-primary" disabled={!item.canEditText || busy}>
          {busy ? t('giftEditor.saving') : t('giftEditor.save')}
        </button>
        {saved && (
          <span className="notice success" role="status" style={{ marginLeft: 12 }}>
            {t('giftEditor.saved')}
          </span>
        )}
      </form>

      <div className="gift-media">
        <MediaRow
          kind="voice"
          has={item.hasVoice}
          disabled={!item.canEditMedia}
          limitBytes={limits.voiceBytes}
          onUpload={upload}
          onRemove={removeMedia}
          busy={busy}
          progress={progress.voice}
        />
        <MediaRow
          kind="video"
          has={item.hasVideo}
          disabled={!item.canEditMedia}
          limitBytes={limits.videoBytes}
          onUpload={upload}
          onRemove={removeMedia}
          busy={busy}
          progress={progress.video}
        />
        <p className="field-hint">{t('giftEditor.limits', { voice: Math.round(limits.voiceBytes / MB), video: Math.round(limits.videoBytes / MB) })}</p>
      </div>

      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
    </section>
  )
}
