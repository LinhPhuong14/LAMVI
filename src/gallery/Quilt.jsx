import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m, useReducedMotionConfig } from 'framer-motion'
import { useI18n } from '../i18n/index.js'
import { Emblem, Patch, toneOf } from './patches.jsx'

// D-97: chăn Đông Hồ. Mỗi đèn sở hữu mở một mảnh nhỏ; đủ đèn của một bộ mở mảnh lớn + cốt truyện
// thưởng; đủ mọi bộ thì chăn hoàn chỉnh. Hiệu ứng mở khoá chỉ chạy một lần cho mỗi mảnh/phần thưởng
// (lưu ở trình duyệt), có thể xem lại bằng nút "Đọc cốt truyện".

const PIECE_STAGGER_S = 0.2
const PIECE_BASE_S = 0.5

const seenKey = (userId) => `moc.quilt.seen.${userId ?? 'anon'}`
function readSeen(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(seenKey(userId)) ?? '[]')
    return new Set(Array.isArray(v) ? v : [])
  } catch {
    return new Set()
  }
}
function writeSeen(userId, set) {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify([...set]))
  } catch {
    // chế độ riêng tư: hiệu ứng sẽ chạy lại lần sau, không sao
  }
}

// Gõ chữ từng ký tự như hội thoại trong game; giảm chuyển động → hiện hết ngay
function Typewriter({ text, reduce, speed = 28 }) {
  const [n, setN] = useState(reduce ? text.length : 0)
  useEffect(() => {
    if (reduce) return undefined
    const id = setInterval(() => setN((v) => Math.min(text.length, v + 1)), speed)
    return () => clearInterval(id)
  }, [text, reduce, speed])
  const done = n >= text.length
  return (
    <p className="reward-story" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      {!done && <span className="reward-caret" aria-hidden="true" />}
    </p>
  )
}

const SPARKS = Array.from({ length: 16 }, (_, i) => i)

function RewardModal({ kind, title, story, tone, index, onClose, reduce }) {
  const { t } = useI18n()
  const closeRef = useRef(null)
  const c = toneOf(tone)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <m.div
      className={`reward-overlay is-${kind}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ '--rw-bg': c.bg, '--rw-fg': c.fg, '--rw-soft': c.soft }}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
    >
      {!reduce && <div className="reward-rays" aria-hidden="true" />}
      {!reduce && (
        <div className="reward-sparks" aria-hidden="true">
          {SPARKS.map((i) => (
            <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 5) * 0.35}s`, '--s': `${0.6 + (i % 4) * 0.25}` }} />
          ))}
        </div>
      )}
      <m.div
        className="reward-card"
        initial={reduce ? false : { scale: 0.3, y: 80, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.1 }}
      >
        <p className="reward-kicker">{kind === 'finale' ? t('account.gallery.finaleKicker') : t('account.gallery.rewardKicker')}</p>
        <m.div
          className="reward-emblem"
          initial={reduce ? false : { scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 11, delay: 0.45 }}
        >
          {kind === 'finale' ? <Emblem tone={tone} unlocked label="" /> : <Patch index={index} tone={tone} unlocked label="" />}
        </m.div>
        <h3 className="reward-title">{title}</h3>
        <Typewriter text={story} reduce={reduce} />
        <button ref={closeRef} type="button" className="btn btn-primary" onClick={onClose}>
          {kind === 'finale' ? t('account.gallery.finaleClose') : t('account.gallery.rewardClose')}
        </button>
      </m.div>
    </m.div>
  )
}

export default function Quilt({ gallery, userId }) {
  const { t } = useI18n()
  const reduce = useReducedMotionConfig()
  const { collections, quilt } = gallery
  // Ảnh chụp trạng thái "đã xem" lúc vào trang: quyết định mảnh/phần thưởng nào là MỚI
  const [seen0] = useState(() => readSeen(userId))
  const seenRef = useRef(new Set(seen0))
  const [active, setActive] = useState(null) // phần thưởng đang mở
  const [pending, setPending] = useState(() => {
    const q = collections.filter((c) => c.complete && !seen0.has(`c:${c.slug}`)).map((c) => ({ kind: 'collection', slug: c.slug }))
    if (quilt.complete && !seen0.has('finale')) q.push({ kind: 'finale' })
    return q
  })
  const [ready, setReady] = useState(false)

  const newPieces = useMemo(() => collections.flatMap((c) => c.pieces.filter((p) => p.owned && !seen0.has(`p:${p.slug}`)).map((p) => p.slug)), [collections, seen0])
  const newOrder = (slug) => newPieces.indexOf(slug)

  // Sau khi các mảnh mới ghép xong mới đến lượt phần thưởng (như màn thưởng trong game)
  useEffect(() => {
    const wait = reduce ? 0 : (PIECE_BASE_S + newPieces.length * PIECE_STAGGER_S + 0.9) * 1000
    const id = setTimeout(() => {
      const next = new Set(seenRef.current)
      for (const slug of newPieces) next.add(`p:${slug}`)
      seenRef.current = next
      writeSeen(userId, next)
      setReady(true)
    }, wait)
    return () => clearTimeout(id)
  }, [newPieces, reduce, userId])

  useEffect(() => {
    if (ready && !active && pending.length) {
      // oxlint-disable-next-line react/set-state-in-effect
      setActive(pending[0])
      setPending((q) => q.slice(1))
    }
  }, [ready, active, pending])

  const close = useCallback(() => {
    setActive((a) => {
      if (a && !a.replay) {
        const next = new Set(seenRef.current)
        next.add(a.kind === 'finale' ? 'finale' : `c:${a.slug}`)
        seenRef.current = next
        writeSeen(userId, next)
      }
      return null
    })
  }, [userId])

  const modal = (() => {
    if (!active) return null
    if (active.kind === 'finale') {
      const tone = collections[collections.length - 1]?.tone
      return { kind: 'finale', title: t('account.gallery.finaleTitle'), story: t('account.gallery.finaleStory'), tone, index: 0 }
    }
    const i = collections.findIndex((c) => c.slug === active.slug)
    const c = collections[i]
    return c?.reward ? { kind: 'collection', title: c.reward.title, story: c.reward.story, tone: c.tone, index: i } : null
  })()

  return (
    <section className={`quilt${quilt.complete ? ' is-complete' : ''}`} aria-labelledby="quilt-title">
      <header className="quilt-head">
        <h3 id="quilt-title">{t('account.gallery.quiltTitle')}</h3>
        <p className="quilt-progress" role="status">
          {t('account.gallery.quiltProgress', { a: quilt.unlockedPieces, b: quilt.totalPieces })}
        </p>
      </header>
      <p className="quilt-lead">{quilt.complete ? t('account.gallery.quiltDone') : t('account.gallery.quiltLead')}</p>
      <div className="quilt-board">
        {collections.map((c) => (
          <div key={c.slug} className={`quilt-panel tone-${c.tone ?? 'amber'}${c.complete ? ' is-complete' : ''}`}>
            <div className="quilt-panel-head">
              <h4>{c.name}</h4>
              <span>{t('account.gallery.panelProgress', { a: c.ownedCount, b: c.pieces.length })}</span>
            </div>
            <ul className="quilt-patches">
              {c.pieces.map((p, pi) => {
                const isNew = p.owned && newOrder(p.slug) >= 0 && !reduce
                const delay = PIECE_BASE_S + newOrder(p.slug) * PIECE_STAGGER_S
                return (
                  <li key={p.slug} className={`quilt-patch${p.owned ? ' is-on' : ' is-off'}${isNew ? ' is-new' : ''}`} style={{ '--delay': `${delay}s` }}>
                    <m.div
                      initial={isNew ? { scale: 0.15, rotate: -30, opacity: 0 } : false}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 180, damping: 12, delay }}
                    >
                      <Patch index={pi} tone={c.tone} unlocked={p.owned} label={p.owned ? p.name : t('account.gallery.locked')} />
                    </m.div>
                    {isNew && (
                      <span className="quilt-burst" aria-hidden="true">
                        {Array.from({ length: 8 }, (_, k) => (
                          <i key={k} style={{ '--a': `${k * 45}deg` }} />
                        ))}
                      </span>
                    )}
                    <span className="quilt-patch-name">{p.owned ? p.name : '???'}</span>
                  </li>
                )
              })}
            </ul>
            <div className={`quilt-emblem${c.complete ? ' is-on' : ''}`}>
              <Emblem tone={c.tone} unlocked={c.complete} label={c.complete ? c.name : t('account.gallery.locked')} />
              {c.complete ? (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setActive({ kind: 'collection', slug: c.slug, replay: true })}>
                  {t('account.gallery.readStory')}
                </button>
              ) : (
                <p className="quilt-hint">{t('account.gallery.collectHint', { n: c.pieces.length - c.ownedCount })}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {quilt.complete && (
        <button type="button" className="btn btn-primary quilt-finale-btn" onClick={() => setActive({ kind: 'finale', replay: true })}>
          {t('account.gallery.readFinale')}
        </button>
      )}
      {/* Portal ra <body>: cha có backdrop-filter nên position:fixed sẽ bị nhốt trong khung dashboard */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>{modal && <RewardModal key={`${active.kind}-${active.slug ?? ''}`} {...modal} reduce={reduce} onClose={close} />}</AnimatePresence>,
          document.body,
        )}
    </section>
  )
}
