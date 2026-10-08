import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/useApi.js'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import MayAvatar from './MayAvatar.jsx'
import { getSessionId, loadGuestChat, saveGuestChat } from './storage.js'
import { track } from '../analytics/index.js'

const MAX = 500

// FR-AI-001/003/005/006: khung chat với Mây
export default function MayChat({ onClose, onTour }) {
  const { t, lang, path } = useI18n()
  const { user, authedApi } = useAuth()
  // Chuyển sang người thật: Zalo nếu đã cấu hình, không thì trang Liên hệ (feedback 08/10, mục 4)
  const site = useApi('/site', lang)
  const zalo = site.status === 'ok' ? site.data.zalo : ''
  const [messages, setMessages] = useState(() => (user ? [] : loadGuestChat()))
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  // Người đã đăng nhập: nạp lịch sử đã lưu (D-19)
  useEffect(() => {
    if (!user) return
    let alive = true
    authedApi('/may/history')
      .then((res) => alive && setMessages(res.items.slice(-30).map(({ role, kind, content }) => ({ role, kind, content }))))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user, authedApi])

  useEffect(() => {
    if (!user) saveGuestChat(messages)
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight })
  }, [messages, user])

  useEffect(() => inputRef.current?.focus(), [])

  async function send(e, preset) {
    e.preventDefault()
    const message = (preset ?? text).trim()
    if (!message || pending) return
    const history = messages.filter((m) => m.role === 'user' || m.kind === 'answer').map(({ role, content }) => ({ role, content }))
    setMessages((m) => [...m, { role: 'user', content: message }])
    setText('')
    setPending(true)
    const body = { message, lang, sessionId: getSessionId(), history: history.slice(-10) }
    try {
      const res = user ? await authedApi('/may/chat', { method: 'POST', body }) : await api('/may/chat', { method: 'POST', body })
      setMessages((m) => [...m, { role: 'assistant', kind: res.reply.kind, content: res.reply.text, faq: res.reply.faq }])
    } catch (err) {
      // NFR-AVL-001: lỗi Mây không chặn web; báo lỗi ngay trong khung chat
      setMessages((m) => [...m, { role: 'assistant', kind: 'error', content: t(`errors.${err.code ?? 'NETWORK_ERROR'}`) }])
      // §23.3: chỉ gửi mã lỗi, không gửi nội dung câu hỏi của khách (NFR-PRV-002)
      track('mascot_error', { error_code: err.code ?? 'NETWORK_ERROR' })
    } finally {
      setPending(false)
    }
  }

  const started = messages.some((m) => m.role === 'user')

  return (
    <section className="may-panel" role="dialog" aria-label={t('may.title')}>
      <header className="may-head">
        <span className="may-head-avatar">
          <MayAvatar size={44} />
          <i className="may-online" aria-hidden="true" />
        </span>
        <div>
          <strong>{t('may.title')}</strong>
          <span>{t('may.subtitle')}</span>
        </div>
        <button type="button" className="may-close" onClick={onClose} aria-label={t('may.close')}>
          ×
        </button>
      </header>
      {/* §22.5: hiển thị rõ Mây là trợ lý AI */}
      <p className="may-notice">{t('may.aiNotice')}</p>
      <ol className="may-list" ref={listRef} aria-live="polite">
        <li className="may-msg may-assistant">{t('may.greeting')}</li>
        {messages.map((m, i) => (
          <li key={i} className={`may-msg may-${m.role} may-kind-${m.kind ?? 'text'}`}>
            {m.content}
            {m.faq?.length > 0 && (
              <details className="may-faq" open>
                <summary>{t('may.faqTitle')}</summary>
                {m.faq.map((f) => (
                  <details key={f.question}>
                    <summary>{f.question}</summary>
                    <p>{f.answer}</p>
                  </details>
                ))}
              </details>
            )}
          </li>
        ))}
        {pending && (
          <li className="may-msg may-assistant may-typing">
            <span className="sr-only">{t('may.sending')}</span>
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
          </li>
        )}
      </ol>
      {/* Gợi ý câu hỏi cho lần mở đầu: bấm là gửi, đỡ phải gõ */}
      {!started && !pending && (
        <div className="may-chips" role="group" aria-label={t('may.suggestTitle')}>
          {t('may.suggestions').map((q) => (
            <button key={q} type="button" className="may-chip" onClick={(e) => send(e, q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <form className="may-form" onSubmit={send}>
        <div className="may-compose">
          <textarea
            ref={inputRef}
            value={text}
            maxLength={MAX}
            rows={1}
            placeholder={t('may.placeholder')}
            aria-label={t('may.placeholder')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) send(e)
            }}
          />
          <button type="submit" className="may-send" aria-label={t('may.send')} disabled={pending || !text.trim()}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="may-form-foot">
          <small>{t('may.counter', { n: text.length, max: MAX })}</small>
          <button type="button" className="may-tour" onClick={onTour}>
            {t('may.startTour')}
          </button>
        </div>
        <a className="may-handoff" href={zalo || path('/contact')} {...(zalo ? { target: '_blank', rel: 'noopener noreferrer' } : {})} title={t('may.handoffHint')}>
          {t('may.handoff')}
        </a>
        <small className="may-save-note">{user ? t('may.historyNote') : t('may.guestNote')}</small>
      </form>
    </section>
  )
}
