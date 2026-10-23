import { useEffect } from 'react'
import { useHydratedReducedMotion } from './hydration.js'

/**
 * Tự phát video khi cuộn tới (≥ 50% trong màn hình), **không tiếng** (trình duyệt chỉ cho tự phát khi tắt tiếng);
 * cuộn qua thì dừng. Người xem bấm dừng thì không tự phát lại cho tới khi họ bấm phát; đã bật tiếng thì giữ tiếng.
 * Giảm chuyển động → không tự phát. Dùng chung cho video làng nghề và video trong khung điện thoại (D-119).
 */
export function useAutoplayInView(ref) {
  const reduce = useHydratedReducedMotion()

  useEffect(() => {
    const video = ref.current
    if (!video || reduce || typeof IntersectionObserver === 'undefined') return
    let userPaused = false
    let autoPausing = false
    let userUnmuted = false
    const onPause = () => {
      if (autoPausing) autoPausing = false
      else userPaused = true
    }
    const onPlay = () => {
      userPaused = false
    }
    const onVolume = () => {
      if (!video.muted) userUnmuted = true
    }
    video.addEventListener('pause', onPause)
    video.addEventListener('play', onPlay)
    video.addEventListener('volumechange', onVolume)
    const io = new IntersectionObserver(
      (entries) => {
        // Cuộn nhanh có thể dồn nhiều entry (vào rồi ra) trong một lần gọi → lấy entry mới nhất
        const entry = entries[entries.length - 1]
        if (entry.isIntersecting) {
          if (userPaused || !video.paused) return
          // Người xem đã bật tiếng thì giữ tiếng (họ đã tương tác nên trình duyệt cho phát có tiếng)
          if (!userUnmuted) video.muted = true
          video.play()?.catch(() => {})
        } else if (!video.paused) {
          autoPausing = true
          video.pause()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(video)
    return () => {
      io.disconnect()
      video.removeEventListener('pause', onPause)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('volumechange', onVolume)
    }
  }, [ref, reduce])
}
