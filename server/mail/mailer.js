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
  if (!res.ok) throw new Error(`mail ${res.status}`)
}

// Resend: 3.000 thư/tháng, 100/ngày (gói miễn phí); cần xác minh tên miền gửi
const resend = ({ apiKey, from }, fetchImpl) => ({
  provider: 'resend',
  send: ({ to, subject, text, html }) =>
    post('https://api.resend.com/emails', { Authorization: `Bearer ${apiKey}` }, { from, to: [to], subject, text, html }, fetchImpl),
})

// Brevo: 300 thư/ngày (gói miễn phí); cho xác minh một địa chỉ gửi đơn lẻ, không bắt buộc tên miền
const brevo = ({ apiKey, from }, fetchImpl) => ({
  provider: 'brevo',
  send: ({ to, subject, text, html }) =>
    post(
      'https://api.brevo.com/v3/smtp/email',
      { 'api-key': apiKey },
      { sender: parseFrom(from), to: [{ email: to }], subject, textContent: text, htmlContent: html },
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
  return { provider: 'memory', outbox, async send(msg) { outbox.push({ ...msg }) } }
}

// Dev không có nhà cung cấp thư: in thư ra console để bấm link thử luồng đặt lại mật khẩu
export function createConsoleMailer(log = console.log) {
  return { provider: 'console', async send({ to, subject, text }) { log(`[mail → ${to}] ${subject}\n${text}`) } }
}
