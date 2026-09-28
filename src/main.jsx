import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/App.css'
import './styles/pages.css'
import AppShell from './AppShell.jsx'
import { createDataStore } from './seo/context.js'

// D-49: trang công khai được server render sẵn → hydrate; trang riêng tư chỉ có khung → render mới
const app = <AppShell dataStore={createDataStore(window.__INITIAL_DATA__)} Router={BrowserRouter} />
const root = document.getElementById('root')
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
