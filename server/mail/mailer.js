// Gửi thư giao dịch qua HTTPS API của nhà cung cấp có gói miễn phí (T-49). Không dùng SMTP của
// Supabase: gói Free chỉ gửi tới thành viên nhóm và giới hạn ~vài thư/giờ nên không dùng thật được.
// Không cần thêm thư viện: chỉ `fetch`. Không có nhà cung cấp → trả null và route bỏ qua việc gửi.

const TIMEOUT_MS = 8000

const parseFrom = (from) => {
  const m = String(from ?? '').match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/)
  return m ? { name: m[1]?.trim() || undefined, email: m[2].trim() } : { email: String(from ?? '').trim() }
}

async function post(url, headers, payload, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const error = new Error(`mail ${res.status}`)
    error.status = res.status
    throw error
  }
  return typeof res.json === 'function' ? await res.json().catch(() => null) : null
}

async function get(url, headers, fetchImpl) {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

// Tên miền của địa chỉ gửi, vd `Tên <no-reply@send.example.vn>` → send.example.vn
const fromDomain = (from) => parseFrom(from).email.split('@')[1]?.toLowerCase() ?? ''

// Resend: 3.000 thư/tháng, 100/ngày (gói miễn phí); cần xác minh tên miền gửi
const resend = ({ apiKey, from }, fetchImpl) => ({
  provider: 'resend',
  send: ({ to, subject, text, html, idempotencyKey, replyTo }) =>
    post('https://api.resend.com/emails', { Authorization: `Bearer ${apiKey}`, ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, { from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }, fetchImpl),
  // Kiểm khoá và tên miền gửi mà KHÔNG gửi thư (dashboard IT). Trả { note? }; lỗi → ném Error(mã).
  async ping() {
    const { status, data } = await get('https://api.resend.com/domains', { Authorization: `Bearer ${apiKey}` }, fetchImpl)
    // Khoá "Sending access" không đọc được danh sách tên miền nhưng vẫn gửi được → khoá hợp lệ, không kiểm được domain
    if (status === 401 && data?.name === 'restricted_api_key') return { note: 'sending_only' }
    if (status === 401 || status === 403) throw new Error('invalid_api_key')
    if (status === 429) throw new Error('rate_limited')
    if (status !== 200) throw new Error(`http_${status}`)
    const domain = fromDomain(from)
    // Địa chỉ thử nghiệm của Resend gửi được không cần xác minh nhưng chỉ tới chủ tài khoản
    if (domain === 'resend.dev') return { note: 'test_domain' }
    // Phản hồi lạ (không phải mảng, phần tử null/không phải object) → coi như chưa xác minh, không ném TypeError thô
    const list = Array.isArray(data?.data) ? data.data : []
    const verified = list.some((d) => {
      const name = typeof d?.name === 'string' ? d.name.toLowerCase() : ''
      return d?.status === 'verified' && name && (domain === name || domain.endsWith(`.${name}`))
    })
    if (!verified) throw new Error('domain_not_verified')
    return {}
  },
})

// Brevo: 300 thư/ngày (gói miễn phí); cho xác minh một địa chỉ gửi đơn lẻ, không bắt buộc tên miền
const brevo = ({ apiKey, from }, fetchImpl) => ({
  provider: 'brevo',
  async ping() {
    const { status } = await get('https://api.brevo.com/v3/account', { 'api-key': apiKey }, fetchImpl)
    if (status === 401 || status === 403) throw new Error('invalid_api_key')
    if (status !== 200) throw new Error(`http_${status}`)
    return {}
  },
  send: ({ to, subject, text, html, replyTo }) =>
    post(
      'https://api.brevo.com/v3/smtp/email',
      { 'api-key': apiKey },
      { sender: parseFrom(from), to: [{ email: to }], subject, textContent: text, htmlContent: html, ...(replyTo ? { replyTo: { email: replyTo } } : {}) },
      fetchImpl,
    ),
})

/**
 * @param {{resendApiKey?: string|null, brevoApiKey?: string|null, from?: string|null}} mail
 * @returns {{provider: string, send(msg: {to: string, subject: string, text: string, html: string}): Promise<void>} | null}
 */
export function createMailer(mail = {}, fetchImpl = globalThis.fetch) {
  if (!mail.from) return null
  if (mail.resendApiKey) return resend({ apiKey: mail.resendApiKey, from: mail.from }, fetchImpl)
  if (mail.brevoApiKey) return brevo({ apiKey: mail.brevoApiKey, from: mail.from }, fetchImpl)
  return null
}

// Hộp thư trong bộ nhớ cho dev/test: không gửi đi đâu, chỉ ghi lại để kiểm tra
export function createMemoryMailer() {
  const outbox = []
  return { provider: 'memory', outbox, async send(msg) { outbox.push({ ...msg }) }, async ping() { return {} } }
}

// Dev không có nhà cung cấp thư: in thư ra console để bấm link thử luồng đặt lại mật khẩu
export function createConsoleMailer(log = console.log) {
  return { provider: 'console', async send({ to, subject, text }) { log(`[mail → ${to}] ${subject}\n${text}`) }, async ping() { return { note: 'console' } } }
}
