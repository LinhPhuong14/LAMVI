// Kiểm soát an toàn cho Mây — chạy ở server, không dựa vào prompt (NFR-SEC-003).

// NFR-PRV-001: không gửi SĐT, email sang OpenAI (khách có thể tự gõ vào chat)
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g
const VN_PHONE = /(?:\+?84|0)(?:[\s.-]?\d){9,10}\b/g

export function redactPii(text) {
  return String(text).replace(EMAIL, '[email]').replace(VN_PHONE, '[phone]')
}

// BR-AI-003: mọi con số (giá, năm, mã…) từ 4 chữ số trở lên trong câu trả lời phải xuất hiện
// trong kết quả hàm backend của chính lượt đó
const NUMBER = /\d{1,3}(?:[.,  ]\d{3})+|\d{4,}/g
const digits = (s) => s.replace(/\D/g, '')

export function unverifiedNumbers(reply, toolOutputs) {
  const allowed = new Set()
  for (const out of toolOutputs) {
    const text = typeof out === 'string' ? out : JSON.stringify(out)
    for (const m of text.match(/\d+/g) ?? []) allowed.add(m)
    for (const m of text.match(NUMBER) ?? []) allowed.add(digits(m))
  }
  return (String(reply).match(NUMBER) ?? []).map(digits).filter((n) => !allowed.has(n))
}

// Bỏ dấu tiếng Việt để khớp từ khoá (FAQ offline)
export function normalizeText(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
}

const STOP = new Set(['la', 'co', 'khong', 'the', 'cua', 'va', 'cho', 'toi', 'minh', 'ban', 'nao', 'gi', 'bao', 'a', 'an', 'the', 'is', 'are', 'do', 'i', 'my', 'to', 'of'])

function tokens(s) {
  const n = normalizeText(s)
  // Tiếng Trung không có khoảng trắng → dùng từng ký tự CJK làm token
  const words = n.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w))
  const cjk = n.match(/\p{Script=Han}/gu) ?? []
  return new Set([...words, ...cjk])
}

// FAQ offline (§22.4): trả tối đa `limit` câu hỏi gần nhất; không khớp → các câu đầu tiên
export function matchFaq(query, items, limit = 3) {
  const q = tokens(query)
  const scored = items
    .map((f, i) => {
      const t = tokens(`${f.question} ${f.answer}`)
      let score = 0
      for (const w of q) if (t.has(w)) score += 1
      return { f, i, score }
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
  const hits = scored.filter((s) => s.score > 0)
  return (hits.length ? hits : scored).slice(0, limit).map((s) => s.f)
}
