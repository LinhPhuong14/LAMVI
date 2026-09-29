# Triển khai Vercel

Quyết định: T-33 ([`decisions.md`](decisions.md)). Đây là nguồn quy tắc deploy duy nhất; `CLAUDE.md` chỉ tóm tắt.

## Cách chạy trên Vercel

- Một Vercel Function duy nhất `api/index.js` re-export `app` từ `server/index.js` (Express: web SSR + API, T-15). `server/index.js` **không** `listen` khi có `process.env.VERCEL`.
- `vercel.json`:
  - `buildCommand: npm run build` → `dist/client` + `dist/server`.
  - `functions["api/index.js"].includeFiles: "dist/**"` — bắt buộc, vì `server/ssr.js` đọc `dist/client/index.html` và `dist/server/entry-server.js` lúc chạy.
  - `rewrites: /(.*) → /api` — mọi đường dẫn (trang, `/api/*`, `/sitemap.xml`, `/robots.txt`) đi qua Express; Express giữ nguyên URL gốc.
  - `outputDirectory: "public"` — cố ý **không** trỏ `dist/client`, nếu không CDN sẽ trả thẳng `index.html` rỗng cho `/` và bỏ qua SSR (T-15, SEO). File trong `public/` do CDN phục vụ; `dist/client/assets` do Express phục vụ (cache 1 năm).
- Node 22 (`engines`), vì script dev dùng `--env-file-if-exists`.

## Quy tắc

1. **Bắt buộc có Supabase ở Preview/Production.** Thiếu `SUPABASE_*` server rơi về adapter bộ nhớ (T-04) — trên serverless mỗi instance một bản dữ liệu, mất khi instance tắt. Không được deploy kiểu đó.
2. **Biến môi trường** đặt ở Vercel (Project → Settings → Environment Variables), theo từng môi trường; không commit `.env`, không đưa key vào frontend (T-05). Danh sách: xem [`../../.env.example`](../../.env.example). Riêng Vercel:
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`), `SUPABASE_SECRET_KEY` (`sb_secret_…`) (bắt buộc; secret key chỉ ở server). Tên cũ `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` vẫn nhận nếu không có tên mới.
   - `PUBLIC_SITE_URL` = URL công khai thật (dùng cho link đặt lại mật khẩu, sitemap, hreflang) — Production đặt domain chính; Preview không dùng link đặt lại mật khẩu để kiểm thử thật. Thêm URL này vào Redirect URLs của Supabase (G-16).
   - `TRUST_PROXY=1` (Vercel đứng trước hàm; nếu không, hạn mức Mây theo IP và IP trong log sai).
   - `MAY_HASH_SALT` đặt giá trị bí mật riêng; `OPENAI_*`, `PAYOS_*` khi tích hợp. Không đặt `DEV_ADMIN_*`/`DEV_IT_*` trên Vercel.
   - `GIT_COMMIT`: có thể dùng `VERCEL_GIT_COMMIT_SHA` (chưa nối tự động).
3. **Giới hạn serverless — đừng phá:**
   - Body request tối đa 4,5 MB → upload video lô **phải** đi qua signed upload URL (T-12), không qua Express. Không thêm endpoint nhận file lớn.
   - Không ghi file cục bộ, không giữ trạng thái quan trọng trong bộ nhớ tiến trình; mọi trạng thái vào Supabase.
   - `maxDuration: 30` (Mây có timeout 15 giây/lượt gọi OpenAI, T-29). Không nâng nếu không cần.
   - Số liệu API (T-18) flush bằng `setInterval` + SIGTERM: trên Vercel instance có thể bị đóng trước khi flush → số liệu có thể thiếu (G-35).
4. **Trước khi push lên nhánh deploy:** `npm run lint`, `npm test`, `npm run build` đều xanh. Preview deployment của nhánh/PR phải mở được `/`, `/en`, `/zh`, `/api/products` (200) trước khi gộp.
5. **Production = `master`.** Không deploy tay từ máy (`vercel --prod`) trừ khi người dùng yêu cầu; không dùng token Vercel trong repo. Thư mục `.vercel/` đã ở `.gitignore`.
6. **Thay đổi cấu hình deploy** (`vercel.json`, `api/`, biến môi trường bắt buộc mới) → cập nhật file này, `.env.example` và `decisions.md` cùng lúc.
7. Mỗi lần thêm route/tệp đọc lúc chạy ngoài `dist/**` (ví dụ thư mục dữ liệu, template) → thêm vào `includeFiles`.

## Kiểm thử cục bộ giống Vercel

```bash
npm run build
VERCEL=1 NODE_ENV=production node -e "const {default:app}=await import('./api/index.js'); \
  import('node:http').then(({createServer})=>createServer(app).listen(5180))"
curl -i localhost:5180/en
```

Chưa kiểm chứng trên một deployment Vercel thật (G-36) — phiên đầu tiên deploy phải kiểm tra §Quy tắc 4.
