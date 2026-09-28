// T-07: mã ngôn ngữ dùng trong code/URL
export const LOCALES = ['vi', 'en', 'zh']
export const DEFAULT_LOCALE = 'vi'

export function normalizeLang(value) {
  return LOCALES.includes(value) ? value : DEFAULT_LOCALE
}

// D-40: thiếu bản dịch thì hiển thị tiếng Việt
export function pick(text, lang) {
  if (text == null) return null
  if (typeof text === 'string') return text
  return text[lang] || text[DEFAULT_LOCALE] || null
}

// D-37: đường dẫn web theo ngôn ngữ (dùng cho link trong email)
export function localePath(lang, path) {
  return lang === DEFAULT_LOCALE ? path : `/${lang}${path}`
}
