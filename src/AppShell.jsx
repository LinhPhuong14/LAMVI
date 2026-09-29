import { StrictMode, useEffect } from 'react'
import AppRoutes from './routes.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import { DataContext, HeadContext } from './seo/context.js'
import { usePageViews } from './analytics/index.js'

// Effect của component cha chạy sau mọi effect con của lần commit đầu → hydrate xong mới xoá
// dữ liệu SSR, để các lần điều hướng sau gọi API lấy dữ liệu mới
function ClearInitialData({ store, children }) {
  useEffect(() => {
    store?.clear()
  }, [store])
  return children
}

// FR-GA-001: page_view ở mỗi lần điều hướng SPA (đường dẫn đã làm sạch — NFR-PRV-002).
// Phải nằm trong Router vì dùng useLocation.
function PageViews({ children }) {
  usePageViews()
  return children
}

// Dùng chung cho client (BrowserRouter) và SSR (StaticRouter) — router do entry bọc ngoài
export default function AppShell({ dataStore = null, collector = null, Router, routerProps }) {
  return (
    <StrictMode>
      <HeadContext.Provider value={collector}>
        <DataContext.Provider value={dataStore}>
          <ClearInitialData store={dataStore}>
            <Router {...routerProps}>
              <PageViews>
                <AuthProvider>
                  <AppRoutes />
                </AuthProvider>
              </PageViews>
            </Router>
          </ClearInitialData>
        </DataContext.Provider>
      </HeadContext.Provider>
    </StrictMode>
  )
}
