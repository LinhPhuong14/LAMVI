import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import { useHydratedReducedMotion } from '../lib/hydration.js'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import Seo from '../seo/Seo.jsx'
import MayAvatar from '../may/MayAvatar.jsx'

// Trang thông điệp để in QR dán lên đèn cho các đơn không kèm lời chúc (D-126).
// Trải nghiệm kiểu "story": các cảnh tự chạy nối nhau (giới thiệu, hai video làng nghề, năm đèn, Mây, kết),
// thanh tiến độ trên cùng, chạm trái/phải để lùi/tiến, giữ để tạm dừng. Giảm chuyển động → không tự chạy.
const LAMPS = ['thu-hoach', 'tu-linh', 'phuc-loc-song-toan', 'tam-duong-khai-thai', 'lon-dan']
const SLIDE_MS = 5500
const INTRO_MS = 7000
const MAY_MS = 9000
const VIDEO_MAX_MS = 20000

function useScenes(t, products) {
  return useMemo(() => {
    const names = t('lookbook.items')
    const lamps = LAMPS.map((slug, i) => ({
      type: 'lamp',
      slug,
      name: products[i]?.name ?? names[i],
      text: products[i]?.description ?? '',
      ms: SLIDE_MS,
    }))
    return [
      { type: 'intro', ms: INTRO_MS },
      { type: 'video', film: CRAFT_FILMS.paper, kicker: t('welcome.paperKicker'), title: t('films.paperTitle'), text: t('films.paperNote') },
      { type: 'video', film: CRAFT_FILMS.dongho, kicker: t('welcome.dongKicker'), title: t('artisan.videoTitle'), text: t('artisan.videoCaption') },
      ...lamps,
      { type: 'may', ms: MAY_MS },
      { type: 'end', ms: 0 },
    ]
  }, [t, products])
}

function Video({ scene, paused, muted, onProgress, onEnd }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = muted
    if (paused) v.pause()
    else v.play()?.catch(() => {})
  }, [paused, muted])
  return (
    <video
      ref={ref}
      className="welcome-video"
      src={scene.film.src}
      poster={scene.film.poster}
      muted
      playsInline
      preload="auto"
      aria-label={scene.title}
      onTimeUpdate={(e) => onProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1), e.currentTarget.currentTime * 1000 >= VIDEO_MAX_MS)}
      onEnded={onEnd}
    />
  )
}

// Điện thoại dựng đứng: nhắc xoay ngang. Android Chrome cho vào toàn màn hình rồi khoá hướng ngang (screen.orientation.lock);
// iOS Safari không hỗ trợ khoá hướng nên chỉ nhắc, người xem tự xoay (D-126).
function useLandscape() {
  const [portrait, setPortrait] = useState(false)
  const [full, setFull] = useState(false)
  const [canFull, setCanFull] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 700px) and (pointer: coarse)')
    const sync = () => setPortrait(mq.matches)
    // oxlint-disable-next-line react/set-state-in-effect
    sync()
    mq.addEventListener?.('change', sync)
    // oxlint-disable-next-line react/set-state-in-effect
    setCanFull(Boolean(document.fullscreenEnabled && window.matchMedia('(pointer: coarse)').matches))
    const onFs = () => {
      setFull(Boolean(document.fullscreenElement))
      if (!document.fullscreenElement) screen.orientation?.unlock?.()
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      mq.removeEventListener?.('change', sync)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])
  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else {
        await document.documentElement.requestFullscreen()
        await screen.orientation?.lock?.('landscape')
      }
    } catch {
      /* trình duyệt từ chối khoá hướng: vẫn ở toàn màn hình, người xem tự xoay */
    }
  }, [])
  return { portrait, full, canFull, toggle }
}


// Một cảnh. Cảnh vừa rời được giữ thêm ~0,8 giây ở lớp dưới và mờ dần trong khi cảnh mới hiện lên (chuyển cảnh liền mạch).
function SceneView({ scene, t, path, paused, muted, leaving, onProgress, onNext, onReplay, onMay }) {
  return (
    <section
      className={`welcome-scene scene-${scene.type}${leaving ? ' is-leaving' : ''}`}
      aria-hidden={leaving || undefined}
      aria-live={leaving ? undefined : 'polite'}
    >
      {scene.type === 'intro' && (
      <>
        <img className="welcome-bg blur" src="/images/brand/cover-800.webp" alt="" />
        <div className="welcome-frame is-cover">
          <img className="kenburns" src="/images/brand/cover-1672.webp" alt="" />
        </div>
        <div className="welcome-copy">
          <p className="welcome-kicker">{t('welcome.introKicker')}</p>
          <h1>{t('welcome.introTitle')}</h1>
          <p className="welcome-text">{t('welcome.introText')}</p>
        </div>
      </>
    )}

    {scene.type === 'video' && (
      <>
        <img className="welcome-bg blur" src={scene.film.poster} alt="" />
        <div className="welcome-copy">
          <p className="welcome-kicker">{scene.kicker}</p>
          <h2>{scene.title}</h2>
        </div>
        <div className="welcome-frame">
          <Video scene={scene} paused={paused || leaving} muted={muted} onProgress={(r, over) => !leaving && (onProgress(r), over && onNext())} onEnd={onNext} />
        </div>
        <p className="welcome-caption">{scene.text}</p>
      </>
    )}

    {scene.type === 'lamp' && (
      <>
        <img className="welcome-bg blur" src={`/images/lamps/${scene.slug}.jpg`} alt="" />
        <div className="welcome-lamp">
          <img src={`/images/lamps/${scene.slug}-cutout.webp`} alt={scene.name} />
        </div>
        <div className="welcome-copy">
          <p className="welcome-kicker">{`${LAMPS.indexOf(scene.slug) + 1} / ${LAMPS.length} · ${t('welcome.lampsKicker')}`}</p>
          <h2>{scene.name}</h2>
          {scene.text && <p className="welcome-text">{scene.text}</p>}
        </div>
      </>
    )}

    {scene.type === 'may' && (
      <>
        <div className="welcome-may" aria-hidden="true">
          <MayAvatar pose="welcome" size={150} />
        </div>
        <div className="welcome-copy">
          <p className="welcome-kicker">{t('welcome.mayKicker')}</p>
          <h2>{t('welcome.mayTitle')}</h2>
          <p className="welcome-text">{t('welcome.mayText')}</p>
          <ul className="welcome-chips">
            {t('welcome.mayChips').map((c, i) => (
              <li key={c} style={{ animationDelay: `${0.5 + i * 0.35}s` }}>
                {c}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onPointerDown={(e) => e.stopPropagation()} onClick={onMay}>
            {t('welcome.mayAsk')}
          </button>
        </div>
      </>
    )}

    {scene.type === 'end' && (
      <>
        <img className="welcome-bg blur" src="/images/brand/cover-800.webp" alt="" />
        <div className="welcome-frame is-cover">
          <img className="kenburns" src="/images/brand/cover-1672.webp" alt="" />
        </div>
        <div className="welcome-copy">
          <h2>{t('welcome.endTitle')}</h2>
          <p className="welcome-text">{t('welcome.endText')}</p>
          <div className="welcome-actions" onPointerDown={(e) => e.stopPropagation()}>
            <Link to={path('/shop')} className="btn btn-primary">
              {t('welcome.endShop')}
            </Link>
            <Link to={path('/contact')} className="btn btn-ghost">
              {t('welcome.endContact')}
            </Link>
            <button type="button" className="btn btn-ghost" onClick={onReplay}>
              {t('welcome.replay')}
            </button>
          </div>
        </div>
      </>
    )}
    </section>
  )
}

export default function WelcomePage() {
  // Cảnh toàn màn hình dựng ở <body>: tổ tiên có transform (chuyển trang) làm `position: fixed` tính sai khung
  const [mounted, setMounted] = useState(false)
  const land = useLandscape()
  const [hintGone, setHintGone] = useState(false)
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => setMounted(true), [])
  const { t, lang, path } = useI18n()
  const reduce = useHydratedReducedMotion()
  const res = useApi('/products', lang)
  const products = useMemo(() => (res.status === 'ok' ? [...res.data.items].sort((a, b) => (a.pieceOrder ?? 0) - (b.pieceOrder ?? 0)) : []), [res])
  const scenes = useScenes(t, products)
  const [idx, setIdx] = useState(0)
  const [hold, setHold] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [vp, setVp] = useState(0)
  const [tick, setTick] = useState(0)
  const [leaving, setLeaving] = useState(null)
  const scene = scenes[idx]
  const last = idx === scenes.length - 1
  const paused = hold || userPaused || reduce

  const go = useCallback(
    (to) => {
      const target = Math.max(0, Math.min(scenes.length - 1, to))
      if (target === idx) return
      setLeaving({ scene: scenes[idx], key: `l${idx}-${Date.now()}` })
      setIdx(target)
      setVp(0)
      setTick((n) => n + 1)
    },
    [scenes, idx],
  )
  const next = useCallback(() => go(idx + 1), [go, idx])

  useEffect(() => {
    if (!leaving) return undefined
    const id = setTimeout(() => setLeaving(null), 900)
    return () => clearTimeout(id)
  }, [leaving])

  // Nạp trước video của cảnh kế tiếp để chuyển cảnh không bị khựng
  const upcoming = scenes[idx + 1]?.type === 'video' ? scenes[idx + 1].film.src : null

  // Cảnh có thời lượng cố định tự chuyển sau `ms`; thanh tiến độ CSS dùng cùng thời lượng nên khớp.
  const timer = useRef(null)
  const started = useRef(0)
  const left = useRef(0)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!scene || scene.type === 'video' || last) return undefined
    left.current = scene.ms
    started.current = Date.now()
    return undefined
  }, [scene, last, tick])
  useEffect(() => {
    if (!scene || scene.type === 'video' || last) return undefined
    if (paused) {
      clearTimeout(timer.current)
      left.current -= Date.now() - started.current
      return undefined
    }
    started.current = Date.now()
    timer.current = setTimeout(next, Math.max(300, left.current))
    return () => clearTimeout(timer.current)
  }, [scene, last, paused, next, tick])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') go(idx - 1)
      else if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        setUserPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, idx, next])

  const openMay = () => typeof window !== 'undefined' && window.dispatchEvent(new Event('lamvi:may-open'))
  const dur = scene && scene.type !== 'video' ? scene.ms : 0

  if (!mounted) return <Seo title={t('welcome.label')} noindex />
  return createPortal(
    <div className="welcome" role="region" aria-roledescription="carousel" aria-label={t('welcome.label')}>
      <Seo title={t('welcome.label')} noindex />

      <ol className="welcome-bars" aria-hidden="true">
        {scenes.map((s, i) => (
          <li key={i} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''}>
            <span
              style={
                i === idx && !last
                  ? s.type === 'video'
                    ? { width: `${Math.round(vp * 100)}%`, animation: 'none' }
                    : { animationDuration: `${dur}ms`, animationPlayState: paused ? 'paused' : 'running' }
                  : undefined
              }
              key={i === idx ? `${i}-${tick}` : i}
            />
          </li>
        ))}
      </ol>

      <div className="welcome-top">
        <Link to={path('/')} className="welcome-close">
          {t('welcome.close')}
        </Link>
        <div className="welcome-tools">
          <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? t('welcome.play') : t('welcome.pause')}>
            {userPaused ? '▶' : '❚❚'}
          </button>
          {land.canFull && (
            <button type="button" onClick={land.toggle} aria-label={land.full ? t('welcome.exitFull') : t('welcome.landscape')}>
              {land.full ? '⤡' : '⤢'}
            </button>
          )}
          {scene?.type === 'video' && (
            <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? t('welcome.soundOn') : t('welcome.soundOff')}>
              {muted ? '🔇' : '🔊'}
            </button>
          )}
        </div>
      </div>

      <div
        className="welcome-stage"
        onPointerDown={() => setHold(true)}
        onPointerUp={() => setHold(false)}
        onPointerLeave={() => setHold(false)}
        onPointerCancel={() => setHold(false)}
      >
        {leaving && <SceneView key={leaving.key} scene={leaving.scene} t={t} path={path} paused muted={muted} leaving />}
        {scene && (
          <SceneView
            key={`${idx}-${tick}`}
            scene={scene}
            t={t}
            path={path}
            paused={paused}
            muted={muted}
            onProgress={setVp}
            onNext={next}
            onReplay={() => go(0)}
            onMay={openMay}
          />
        )}
        {land.portrait && !hintGone && (
          <button type="button" className="welcome-rotate" onPointerDown={(e) => e.stopPropagation()} onClick={() => (land.canFull && !land.full ? land.toggle() : setHintGone(true))}>
            <span className="welcome-rotate-icon" aria-hidden="true" />
            {t('welcome.rotate')}
          </button>
        )}
        {upcoming && <video className="welcome-preload" src={upcoming} preload="auto" muted playsInline aria-hidden="true" tabIndex={-1} />}
        <button type="button" className="welcome-zone zone-prev" onClick={() => go(idx - 1)} aria-label={t('welcome.prev')} disabled={idx === 0} />
        <button type="button" className="welcome-zone zone-next" onClick={next} aria-label={t('welcome.next')} disabled={last} />
      </div>
    </div>,
    document.body,
  )
}
