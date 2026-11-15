import { useEffect, useState } from 'react'
import { S } from './strings.js'

// Ảnh QR dựng ngay trong trình duyệt (không gửi link đi đâu). Có nút tải PNG để in.
export default function QrImage({ url, size = 160, fileName = 'qr-phong-thu' }) {
  const [png, setPng] = useState(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    import('qrcode')
      .then((m) => m.default.toDataURL(url, { margin: 2, width: 640, errorCorrectionLevel: 'M' }))
      .then((d) => alive && setPng(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [url])
  if (!url) return null
  return (
    <div className="letter-qr">
      {png ? <img src={png} alt={S.letters.qr} width={size} height={size} /> : <div style={{ width: size, height: size }} aria-hidden="true" />}
      {png && (
        <a className="btn btn-small" href={png} download={`${fileName}.png`}>
          {S.letters.qrDownload}
        </a>
      )}
    </div>
  )
}

export function CopyLink({ url }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* trình duyệt chặn clipboard: admin vẫn chọn tay ở ô link */
    }
  }
  return (
    <button type="button" className="btn btn-small" onClick={copy}>
      {copied ? S.letters.qrCopied : S.letters.qrCopy}
    </button>
  )
}
