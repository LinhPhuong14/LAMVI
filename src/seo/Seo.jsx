import { useEffect } from 'react'
import { useI18n } from '../i18n/index.js'
import { buildHeadTags, applyHeadTags } from './head.js'
import { useHeadCollector, useSiteUrl } from './context.js'
import { useNoIndex } from '../hooks/useNoIndex.js'

function NoIndex() {
  useNoIndex()
  return null
}

/**
 * Khai báo head của trang (FR-SEO-001). SSR: ghi vào bộ thu thập; client: cập nhật document.head.
 * status: mã HTTP khi SSR (vd 404). noindex: thêm meta robots (BR-SEO-001).
 */
export default function Seo({ title, description, path, noindex = false, type, jsonLd, image, status }) {
  const { lang } = useI18n()
  const siteUrl = useSiteUrl()
  const collector = useHeadCollector()
  const props = { lang, siteUrl, path, title, description, noindex, type, jsonLd, image }

  if (collector) {
    collector.setTags(buildHeadTags(props))
    if (status) collector.setStatus(status)
  }

  const key = JSON.stringify(props)
  useEffect(() => {
    applyHeadTags(document, buildHeadTags(JSON.parse(key)))
  }, [key])

  return noindex ? <NoIndex /> : null
}
