import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import AppShell from './AppShell.jsx'
import { createDataStore, createHeadCollector } from './seo/context.js'

// D-49: SSR trong Express. Trả HTML + thông tin head/status do các trang khai báo qua <Seo>.
export function render(url, { initialData, siteUrl }) {
  const collector = createHeadCollector(siteUrl)
  const html = renderToString(
    <AppShell dataStore={createDataStore(initialData)} collector={collector} Router={StaticRouter} routerProps={{ location: url }} />,
  )
  return { html, head: collector.state }
}
