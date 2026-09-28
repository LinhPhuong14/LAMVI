import { useEffect, useState } from 'react'

export const EASE_OUT = [0.22, 1, 0.36, 1]
export const EASE_IN = [0.55, 0, 0.75, 0.2]

/**
 * Vị trí của phần tử so với khung nhìn: 'below' (chưa tới), 'in' (đang thấy), 'above' (đã cuộn qua).
 * Dùng để phần tử hiện ra khi cuộn tới và tan đi theo hướng cuộn khi rời khỏi màn hình.
 * Không có IntersectionObserver (SSR, trình duyệt cũ) → luôn 'in' để nội dung không bị ẩn.
 */
export function useViewState(ref, margin = '-12% 0px -12% 0px') {
  const [state, setState] = useState('below')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setState('in')
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setState('in')
        else setState(entry.boundingClientRect.top < 0 ? 'above' : 'below')
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, margin])
  return state
}

// Hiện: trồi lên nhẹ. Biến mất: trôi tiếp theo hướng cuộn rồi mờ đi.
export const rise = {
  below: { opacity: 0, y: 40, transition: { duration: 0.45, ease: EASE_IN } },
  in: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } },
  above: { opacity: 0, y: -32, transition: { duration: 0.45, ease: EASE_IN } },
}

// Mực loang: chữ nhoè rồi nét dần như mực thấm vào giấy dó
export const ink = {
  below: { opacity: 0, y: 18, filter: 'blur(8px)', transition: { duration: 0.4, ease: EASE_IN } },
  in: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: EASE_OUT } },
  above: { opacity: 0, y: -14, filter: 'blur(6px)', transition: { duration: 0.4, ease: EASE_IN } },
}

// Đóng dấu: thẻ rơi xuống, xoay về khuôn; khi rời đi thì nhấc lên như gỡ tờ giấy
export const stamp = {
  below: { opacity: 0, y: 56, rotate: -3, scale: 0.96, transition: { duration: 0.4, ease: EASE_IN } },
  in: (i = 0) => ({
    opacity: 1,
    y: 0,
    rotate: i % 2 === 0 ? -0.6 : 0.6,
    scale: 1,
    transition: { type: 'spring', stiffness: 170, damping: 18, mass: 0.8 },
  }),
  above: (i = 0) => ({
    opacity: 0,
    y: -36,
    rotate: i % 2 === 0 ? 2 : -2,
    scale: 0.97,
    transition: { duration: 0.4, ease: EASE_IN },
  }),
}

// Khung chứa: con xuất hiện lần lượt; khi biến mất thì con cuối đi trước
export const group = {
  below: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  in: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
  above: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
}

export const parseStat = (text) => {
  const match = /^([\d.]+)(\D*)$/.exec(text)
  if (!match) return null
  return { target: Number(match[1].replace(/\./g, '')), suffix: match[2] }
}

// Nhóm hàng nghìn bằng dấu chấm như cách viết số liệu hiện có ("4.000+")
export const group3 = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
