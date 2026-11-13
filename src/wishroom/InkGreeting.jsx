import { useEffect, useRef, useState } from 'react'

// Cảnh D — nét mực: một gạch nhấn vẽ bằng SVG stroke-dasharray (nét bút cố định, viết sẵn), đi kèm
// chữ chào hiện dần trái→phải theo cùng nhịp. Tên người nhận là dữ liệu động (không có path viết
// tay dựng sẵn) nên hiện trực tiếp bằng font chữ viết tay thay vì giả nét — đúng yêu cầu §Cảnh D.
export default function InkGreeting({ recipientName, reducedMotion, onDone }) {
  const [phase, setPhase] = useState(reducedMotion ? 'done' : 'start')
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (reducedMotion) {
      doneRef.current?.()
      return undefined
    }
    const t1 = setTimeout(() => setPhase('written'), 900)
    const t2 = setTimeout(() => {
      setPhase('done')
      doneRef.current?.()
    }, 1300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [reducedMotion])

  const written = phase !== 'start'

  return (
    <p className={`wishroom-greeting${written ? ' is-written' : ''}`} lang="vi">
      <svg className="wishroom-greeting-flourish" viewBox="0 0 220 40" aria-hidden="true" focusable="false">
        <path d="M6 30 C 40 6, 70 6, 96 22 C 118 35, 150 10, 214 14" />
      </svg>
      <span className="wishroom-greeting-text">{recipientName} ơi,</span>
    </p>
  )
}
