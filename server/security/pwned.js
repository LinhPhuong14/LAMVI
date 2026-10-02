import { createHash } from 'node:crypto'

// Chặn mật khẩu đã lộ trong các vụ rò rỉ (NIST SP 800-63B) bằng Pwned Passwords của HIBP.
// k-anonymity: chỉ gửi 5 ký tự đầu của SHA-1, mật khẩu không bao giờ rời máy chủ. Miễn phí, không
// cần khoá. FAIL-OPEN: dịch vụ chậm/lỗi thì cho qua — đăng ký không được hỏng vì bên thứ ba.
const TIMEOUT_MS = 1500

export async function isPwnedPassword(password, fetchImpl = globalThis.fetch) {
  try {
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return false
    const body = await res.text()
    // Dòng "SUFFIX:COUNT"; COUNT 0 là dòng đệm (Add-Padding)
    return body.split(/\r?\n/).some((line) => {
      const [s, n] = line.split(':')
      return s?.trim() === suffix && Number(n) > 0
    })
  } catch {
    return false
  }
}
