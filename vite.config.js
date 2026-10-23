import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  // Bản SSR (dist/server) chỉ cần entry-server.js; không chép public/ (ảnh, video làng nghề ~35 MB)
  // vào đó → gói Vercel Function nhẹ hơn (T-84). Tệp tĩnh đã có ở dist/client và CDN (public/).
  publicDir: isSsrBuild ? false : 'public',
  test: {
    environment: 'node',
    include: ['server/**/*.test.js', 'src/**/*.test.{js,jsx}', 'scripts/**/*.test.js'],
    setupFiles: ['./vitest.setup.js'],
    // Bộ test chạy mỗi file một worker; khi máy CI/dev chạy nhiều worker song song, các test
    // render React + SSR vượt mặc định 5 s và fail giả. Nới ngưỡng để kết quả ổn định.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Mỗi worker là một tiến trình Node + jsdom (~250 MB). Mặc định vitest mở worker theo số CPU,
    // máy ít RAM bị OOM giữa chừng. Giới hạn một nửa số CPU để chạy được ở cả máy dev và CI.
    maxWorkers: '50%',
  },
}))
