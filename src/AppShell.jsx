import { StrictMode, useEffect } from 'react'
import AppRoutes from './routes.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import { DataContext, HeadContext } from './seo/context.js'

// Effect của component cha chạy sau mọi effect con của lần commit đầu → hydrate xong mới xoá
// dữ liệu SSR, để các lần điều hướng sau gọi API lấy dữ liệu mới
function ClearInitialData({ store, children }) {
  useEffect(() => {
    store?.clear()
  }, [store])
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
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </Router>
          </ClearInitialData>
        </DataContext.Provider>
      </HeadContext.Provider>
    </StrictMode>
  )
}
