import { createDegradedApp } from './degraded.js'

// Mọi khởi tạo (đọc biến môi trường, kết nối Supabase, nạp bản build) nằm ở main.js. Lỗi ở đó không
// được làm sập cả function — xem degraded.js (feedback 08/10, mục 1).
let app
let port = Number(process.env.PORT) || 5173
try {
  const main = await import('./main.js')
  app = main.app
  port = main.config.port
} catch (err) {
  app = createDegradedApp(err)
}
export { app }

// T-33: trên Vercel, `api/index.js` dùng `app` làm hàm serverless — không tự listen
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`[web+api] http://localhost:${port}`)
  })
}
