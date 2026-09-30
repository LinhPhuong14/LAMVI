// Sinh ảnh chia sẻ mạng xã hội mặc định 1200×630 (G-23, §23.2).
// Chạy: npm run gen:og — cần python3 + Pillow. Kết quả: public/images/og/default.png
//
// [ASSUMPTION] Ảnh nền là ảnh CC0 trong public/images/scene (xem CREDITS.md) — ảnh không khí,
// KHÔNG phải ảnh sản phẩm LAMVI. Thay bằng ảnh sản phẩm thật khi có (design-rules §7).
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
execFileSync('python3', [`${root}scripts/gen_og_image.py`], { cwd: root, stdio: 'inherit' })
