import vi from './messages/vi.js'
import en from './messages/en.js'
import zh from './messages/zh.js'

// T-07: mã trong code/URL; thuộc tính lang của HTML dùng zh-Hans
export const LOCALES = ['vi', 'en', 'zh']
export const DEFAULT_LOCALE = 'vi'
export const HTML_LANG = { vi: 'vi', en: 'en', zh: 'zh-Hans' }
const MESSAGES = { vi, en, zh }

const lookup = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

// D-40: thiếu bản dịch → tiếng Việt; thiếu cả tiếng Việt → trả về key
export function translate(lang, key, vars) {
  let v = lookup(MESSAGES[lang] ?? vi, key)
  if (v === undefined || v === '') v = lookup(vi, key)
  if (v === undefined) return key
  if (typeof v === 'string' && vars) {
    v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m))
  }
  return v
}

// D-37: vi không có tiền tố; en → /en, zh → /zh
export function localePath(lang, path = '/') {
  const p = path.startsWith('/') ? path : `/${path}`
  if (lang === DEFAULT_LOCALE) return p
  return p === '/' ? `/${lang}` : `/${lang}${p}`
}

export function splitLocale(pathname) {
  // React Router khớp route không phân biệt hoa/thường → `/EN/...` vẫn mở trang tiếng Anh.
  // Nếu ở đây phân biệt thì phân loại trang (riêng tư/noindex) sẽ sai (xem classifyPath).
  const m = pathname.match(/^\/(en|zh)(?=\/|$)(.*)$/i)
  if (!m) return { lang: DEFAULT_LOCALE, rest: pathname || '/' }
  return { lang: m[1].toLowerCase(), rest: m[2] || '/' }
}
