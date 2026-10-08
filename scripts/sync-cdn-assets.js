// Đưa tệp tĩnh có tên băm (dist/client/assets) vào public/assets để CDN của Vercel phục vụ trực tiếp,
// không đi qua function (feedback 08/10, mục 1.2): function sập thì JS/CSS của trang vẫn tải được.
// `clean` chạy TRƯỚC khi build (Vite sao chép public/ vào dist/client nên không để bản cũ lẫn vào),
// `copy` chạy SAU khi build. public/assets bị .gitignore.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const target = `${root}public/assets`
const source = `${root}dist/client/assets`

const mode = process.argv[2]
if (mode === 'clean') {
  rmSync(target, { recursive: true, force: true })
} else if (mode === 'copy') {
  if (!existsSync(source)) throw new Error(`Thiếu ${source} — chạy vite build trước`)
  rmSync(target, { recursive: true, force: true })
  cpSync(source, target, { recursive: true })
} else {
  throw new Error('Cách dùng: node scripts/sync-cdn-assets.js clean|copy')
}
