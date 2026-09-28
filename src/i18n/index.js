import { createContext, useContext, useMemo } from 'react'
import { DEFAULT_LOCALE, localePath, translate } from './core.js'

export * from './core.js'

export const LocaleContext = createContext(DEFAULT_LOCALE)

export function useI18n() {
  const lang = useContext(LocaleContext)
  return useMemo(
    () => ({
      lang,
      t: (key, vars) => translate(lang, key, vars),
      path: (p) => localePath(lang, p),
    }),
    [lang],
  )
}
