import { createRoot, hydrateRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/fraunces/soft.css'
import '@fontsource-variable/fraunces/soft-italic.css'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import './index.css'
import './styles/App.css'
import './styles/pages.css'
import './styles/gallery.css'
import AppShell from './AppShell.jsx'
import { createDataStore } from './seo/context.js'
import { sanitizePath } from './analytics/ga.js'

// D-49: trang công khai được server render sẵn → hydrate; trang riêng tư chỉ có khung → render mới
const app = <AppShell dataStore={createDataStore(window.__INITIAL_DATA__)} Router={BrowserRouter} />
const root = document.getElementById('root')
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)

// Load diagnostics separately from the storefront bundle. No extra analytics event or network
// collector is enabled; deployment QA can read the three numeric measurements locally.
import('./analytics/vitals.js').then(({ startVitals }) => startVitals()).catch(() => {})

// Vercel Web Analytics (không cookie). URL gửi đi đã làm sạch như GA: bỏ query/hash, che token QR (NFR-PRV-002)
inject({
  beforeSend: (event) => {
    const { origin, pathname } = new URL(event.url)
    return { ...event, url: `${origin}${sanitizePath(pathname)}` }
  },
})
