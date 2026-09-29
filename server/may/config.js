import { LOCALES } from '../i18n.js'

// Cấu hình Mây (FR-AI-007) lưu ở app_settings key 'may'; admin/IT sửa tại /admin/may.
export const MAY_SETTING_KEY = 'may'

export const MESSAGE_GROUPS = ['sick', 'tired', 'resting', 'unknown', 'unknownNoChannel']

// §22.4 — câu mẫu vi theo spec; en/zh do đội dev dịch (G-14). {channel} = kênh hỗ trợ (D-56)
const DEFAULT_MESSAGES = {
  sick: {
    vi: ['Mây bị ốm rùi, chờ Mây khỏe lại xíu nha', 'Mây đang hơi mệt trong người, bạn thử lại sau ít phút nha'],
    en: ['Mây is feeling a little sick — please wait a bit while Mây gets better', 'Mây is under the weather, please try again in a few minutes'],
    zh: ['Mây 生病了，请等 Mây 恢复一下哦', 'Mây 有点不舒服，请过几分钟再试'],
  },
  tired: {
    vi: ['Hôm nay Mây nói nhiều quá, mai mình trò chuyện tiếp nha'],
    en: ['Mây has talked a lot today — let’s chat again tomorrow'],
    zh: ['今天 Mây 说了太多话啦，明天再聊吧'],
  },
  resting: {
    vi: ['Mây đang nghỉ ngơi, bạn xem thử mấy câu hỏi thường gặp nè'],
    en: ['Mây is taking a rest — here are some frequently asked questions'],
    zh: ['Mây 正在休息，先看看这些常见问题吧'],
  },
  unknown: {
    vi: ['Cái này Mây chưa biết, bạn liên hệ {channel} giúp Mây nha'],
    en: ['Mây doesn’t know this yet — please contact {channel}'],
    zh: ['这个 Mây 还不知道，请联系 {channel}'],
  },
  unknownNoChannel: {
    vi: ['Cái này Mây chưa biết rùi, bạn xem thử phần hỏi đáp trên web nha'],
    en: ['Mây doesn’t know this yet — you could check the FAQ on our site'],
    zh: ['这个 Mây 还不知道，可以看看网站上的常见问题'],
  },
}

export const DEFAULT_MAY_CONFIG = {
  // D-64: I-14 đã duyệt → mặc định BẬT (vẫn chạy FAQ offline khi server thiếu OPENAI_API_KEY);
  // admin tắt được ở /admin/may (D-55)
  openaiEnabled: true,
  // D-58
  monthlyBudgetUsd: 20,
  // D-56: admin nhập; rỗng → không gợi ý kênh
  supportChannel: { vi: '', en: '', zh: '' },
  // §22.4 (D-31, D-41)
  limits: { guestPerSession: 20, guestPerDayIp: 50, userPerDay: 100, maxChars: 500 },
  messages: DEFAULT_MESSAGES,
}

const clone = (v) => structuredClone(v)

// Gộp cấu hình đã lưu với mặc định (khoá thiếu → mặc định)
export async function loadMayConfig(repo) {
  const saved = (await repo.getSetting(MAY_SETTING_KEY))?.value ?? {}
  const c = clone(DEFAULT_MAY_CONFIG)
  if (typeof saved.openaiEnabled === 'boolean') c.openaiEnabled = saved.openaiEnabled
  if (Number.isFinite(saved.monthlyBudgetUsd)) c.monthlyBudgetUsd = saved.monthlyBudgetUsd
  if (saved.supportChannel) Object.assign(c.supportChannel, saved.supportChannel)
  if (saved.limits) Object.assign(c.limits, saved.limits)
  for (const g of MESSAGE_GROUPS) {
    for (const l of LOCALES) {
      const list = saved.messages?.[g]?.[l]
      if (Array.isArray(list) && list.length) c.messages[g][l] = list
    }
  }
  return c
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

// PUT /api/admin/may/config — trả { errors, values } (values là cấu hình đầy đủ)
export function validateMayConfig(body, current) {
  const errors = {}
  const v = clone(current)
  if (body.openaiEnabled !== undefined) {
    if (typeof body.openaiEnabled !== 'boolean') errors.openaiEnabled = 'INVALID'
    else v.openaiEnabled = body.openaiEnabled
  }
  if (body.monthlyBudgetUsd !== undefined) {
    const b = body.monthlyBudgetUsd
    if (typeof b !== 'number' || !Number.isFinite(b) || b < 0 || b > 100000) errors.monthlyBudgetUsd = 'INVALID'
    else v.monthlyBudgetUsd = Math.round(b * 100) / 100
  }
  if (body.supportChannel !== undefined) {
    const s = body.supportChannel
    if (!s || typeof s !== 'object' || Array.isArray(s)) errors.supportChannel = 'INVALID'
    else
      for (const l of LOCALES) {
        if (s[l] === undefined) continue
        if (typeof s[l] !== 'string' || s[l].length > 200) errors.supportChannel = 'INVALID'
        else v.supportChannel[l] = s[l].trim()
      }
  }
  if (body.limits !== undefined) {
    const lim = body.limits
    const bounds = { guestPerSession: [0, 1000], guestPerDayIp: [0, 10000], userPerDay: [0, 10000], maxChars: [50, 2000] }
    if (!lim || typeof lim !== 'object') errors.limits = 'INVALID'
    else
      for (const [k, [min, max]] of Object.entries(bounds)) {
        if (lim[k] === undefined) continue
        if (!isInt(lim[k], min, max)) errors.limits = 'INVALID'
        else v.limits[k] = lim[k]
      }
  }
  if (body.messages !== undefined) {
    const m = body.messages
    if (!m || typeof m !== 'object') errors.messages = 'INVALID'
    else
      for (const g of MESSAGE_GROUPS) {
        for (const l of LOCALES) {
          const list = m[g]?.[l]
          if (list === undefined) continue
          const clean = Array.isArray(list) ? list.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean) : null
          // Mỗi nhóm phải còn ít nhất một câu tiếng Việt (D-40)
          if (!clean || clean.some((x) => x.length > 300) || clean.length > 20 || (l === 'vi' && !clean.length)) {
            errors.messages = 'INVALID'
          } else v.messages[g][l] = clean.length ? clean : DEFAULT_MESSAGES[g][l]
        }
      }
  }
  return { errors, values: v }
}
