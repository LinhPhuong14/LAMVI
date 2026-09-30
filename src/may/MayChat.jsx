import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import MayAvatar from './MayAvatar.jsx'
import { getSessionId, loadGuestChat, saveGuestChat } from './storage.js'
import { track } from '../analytics/index.js'

const MAX = 500

// FR-AI-001/003/005/006: khung chat với Mây
export default function MayChat({ onClose, onTour }) {
  const { t, lang } = useI18n()
  const { user, authedApi } = useAuth()
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

  async function send(e) {
    e.preventDefault()
    const message = text.trim()
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

  return (
    <section className="may-panel" role="dialog" aria-label={t('may.title')}>
      <header className="may-head">
        <MayAvatar size={40} />
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
        {pending && <li className="may-msg may-assistant may-typing">{t('may.sending')}</li>}
      </ol>
      <form className="may-form" onSubmit={send}>
        <textarea
          ref={inputRef}
          value={text}
          maxLength={MAX}
          rows={2}
          placeholder={t('may.placeholder')}
          aria-label={t('may.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e)
          }}
        />
        <div className="may-form-foot">
          <small>{t('may.counter', { n: text.length, max: MAX })}</small>
          <button type="button" className="btn btn-small btn-ghost" onClick={onTour}>
            {t('may.startTour')}
          </button>
          <button type="submit" className="btn btn-small" disabled={pending || !text.trim()}>
            {t('may.send')}
          </button>
        </div>
        <small className="may-save-note">{user ? t('may.historyNote') : t('may.guestNote')}</small>
      </form>
    </section>
  )
}
