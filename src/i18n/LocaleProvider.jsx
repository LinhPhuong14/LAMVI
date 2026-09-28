import { useEffect } from 'react'
import { HTML_LANG, LocaleContext, translate } from './index.js'

export default function LocaleProvider({ lang, children }) {
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang]
    document.title = translate(lang, 'meta.title')
  }, [lang])
  return <LocaleContext.Provider value={lang}>{children}</LocaleContext.Provider>
}
