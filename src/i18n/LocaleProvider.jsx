import { useEffect } from 'react'
import { HTML_LANG, LocaleContext } from './index.js'

export default function LocaleProvider({ lang, children }) {
  useEffect(() => {
    // Tiêu đề trang do <Seo> đặt
    document.documentElement.lang = HTML_LANG[lang]
  }, [lang])
  return <LocaleContext.Provider value={lang}>{children}</LocaleContext.Provider>
}
