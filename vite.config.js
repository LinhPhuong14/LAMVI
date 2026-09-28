import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // T-02: API Express chạy ở cổng 8787
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    environment: 'node',
    include: ['server/**/*.test.js', 'src/**/*.test.{js,jsx}', 'scripts/**/*.test.js'],
    setupFiles: ['./vitest.setup.js'],
  },
})
