import { describe, expect, it } from 'vitest'
import { localePath, splitLocale, translate } from './core.js'
import vi from './messages/vi.js'
import en from './messages/en.js'
import zh from './messages/zh.js'

const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )

describe('i18n core', () => {
  it('D-37: đường dẫn theo ngôn ngữ', () => {
    expect(localePath('vi', '/products/a')).toBe('/products/a')
    expect(localePath('en', '/')).toBe('/en')
    expect(localePath('zh', '/products/a')).toBe('/zh/products/a')
    expect(splitLocale('/en/products/a')).toEqual({ lang: 'en', rest: '/products/a' })
    expect(splitLocale('/zh')).toEqual({ lang: 'zh', rest: '/' })
    expect(splitLocale('/english')).toEqual({ lang: 'vi', rest: '/english' })
  })

  it('D-40: thiếu key → tiếng Việt; thiếu hẳn → trả key; thay biến', () => {
    expect(translate('en', 'nav.story')).toBe('Story')
    expect(translate('xx', 'nav.story')).toBe('Câu chuyện')
    expect(translate('en', 'khong.co')).toBe('khong.co')
    expect(translate('vi', 'batch.code', { code: 'L1' })).toBe('Mã lô: L1')
  })

  it('FR-I18N-001: en và zh có đủ key như vi', () => {
    const viKeys = keys(vi).sort()
    expect(keys(en).sort()).toEqual(viKeys)
    expect(keys(zh).sort()).toEqual(viKeys)
  })
})
