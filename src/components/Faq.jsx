import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'

const EASE = [0.22, 1, 0.36, 1]

export default function Faq() {
  const [open, setOpen] = useState(0)
  const { t, lang } = useI18n()
  // G-07: FAQ lấy từ DB (Mây dùng cùng nguồn)
  const faq = useApi('/faq', lang)

  if (faq.status === 'loading') return <p className="faq-status">{t('faq.loading')}</p>
  if (faq.status === 'error') return <p className="faq-status" role="alert">{t('faq.error')}</p>

  return (
    <div className="faq-list">
      {faq.data.items.map((item, i) => {
        const isOpen = open === i
        return (
          <div className={`faq-item ${isOpen ? 'is-open' : ''}`} key={item.id}>
            <button
              className="faq-question"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
              <span className="faq-icon" aria-hidden="true">
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                // Mở ra như trải cuộn thư từ trên xuống; đóng lại thì cuộn ngược lên
                <m.div
                  className="faq-answer"
                  initial={{ height: 0, opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
                  animate={{ height: 'auto', opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
                  exit={{ height: 0, opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <p>{item.answer}</p>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
