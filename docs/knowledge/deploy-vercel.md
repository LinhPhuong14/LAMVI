# Triển khai Vercel

Quyết định: T-33 ([`decisions.md`](decisions.md)). Đây là nguồn quy tắc deploy duy nhất; `CLAUDE.md` chỉ tóm tắt.

## Cách chạy trên Vercel

- Một Vercel Function duy nhất `api/index.js` re-export `app` từ `server/index.js` (Express: web SSR + API, T-15). `server/index.js` **không** `listen` khi có `process.env.VERCEL`.
- `vercel.json`:
  - `buildCommand: npm run build` → `dist/client` + `dist/server`.
  - `functions["api/index.js"].includeFiles: "dist/**"` — bắt buộc, vì `server/ssr.js` đọc `dist/client/index.html` và `dist/server/entry-server.js` lúc chạy.
  - `rewrites: /(.*) → /api` — mọi đường dẫn (trang, `/api/*`, `/sitemap.xml`, `/robots.txt`) đi qua Express; Express giữ nguyên URL gốc.
  - `outputDirectory: "public"` — cố ý **không** trỏ `dist/client`, nếu không CDN sẽ trả thẳng `index.html` rỗng cho `/` và bỏ qua SSR (T-15, SEO). File trong `public/` do CDN phục vụ; `dist/client/assets` do Express phục vụ (cache 1 năm, immutable; tệp khác trong `dist/client` 1 giờ). `public/images/*` và favicon có `Cache-Control` 1 ngày + SWR 7 ngày đặt ở `vercel.json` → `headers`.
- Node 22 (`engines`), vì script dev dùng `--env-file-if-exists`.

## Quy tắc

1. **Bắt buộc có Supabase ở Preview/Production.** Thiếu `SUPABASE_*` server rơi về adapter bộ nhớ (T-04) — trên serverless mỗi instance một bản dữ liệu, mất khi instance tắt. Không được deploy kiểu đó.
2. **Biến môi trường** đặt ở Vercel (Project → Settings → Environment Variables), theo từng môi trường; không commit `.env`, không đưa key vào frontend (T-05). Danh sách: xem [`../../.env.example`](../../.env.example). Riêng Vercel:
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`), `SUPABASE_SECRET_KEY` (`sb_secret_…`) (bắt buộc; secret key chỉ ở server). Tên cũ `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` vẫn nhận nếu không có tên mới.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (tuỳ chọn, T-44): OAuth client Web ở Google Cloud; Authorized redirect URI = `{PUBLIC_SITE_URL}/api/auth/google/callback`. Thiếu → ẩn nút "Tiếp tục với Google".
   - **Thư giao dịch (T-49, bắt buộc ở Production)**: `MAIL_FROM` (vd `LAMVI <no-reply@tên-miền-của-bạn>`) + **một** trong `RESEND_API_KEY` hoặc `BREVO_API_KEY`. Thiếu → "Quên mật khẩu" vẫn trả 202 nhưng không có thư (dashboard IT hiện `mail` chưa cấu hình). Resend (3.000 thư/tháng, 100/ngày): thêm tên miền, đặt DNS SPF/DKIM, `MAIL_FROM` phải thuộc tên miền đó. Brevo (300 thư/ngày): xác minh một địa chỉ gửi đơn lẻ là đủ, nhưng dễ vào thư rác hơn. **Không cần** SMTP của Supabase.
   - `PWNED_CHECK=1` bật kiểm mật khẩu đã lộ (mặc định **tắt** từ D-91; gọi `api.pwnedpasswords.com`, lỗi thì cho qua).
   - `PUBLIC_SITE_URL` = URL công khai thật (dùng cho link đặt lại mật khẩu, sitemap, hreflang) — Production đặt domain chính; Preview không dùng link đặt lại mật khẩu để kiểm thử thật. Thêm URL này vào Redirect URLs của Supabase (G-16).
   - `TRUST_PROXY=1` (Vercel đứng trước hàm; nếu không, hạn mức Mây theo IP và IP trong log sai).
   - `MAY_HASH_SALT` đặt giá trị bí mật riêng; `OPENAI_*`, `PAYOS_*` khi tích hợp. Không đặt `DEV_ADMIN_*`/`DEV_IT_*` trên Vercel.
   - `GIT_COMMIT`: có thể dùng `VERCEL_GIT_COMMIT_SHA` (chưa nối tự động).
   - `GA_PROPERTY_ID` + `GA_SERVICE_ACCOUNT_JSON` (hoặc `GA_CLIENT_EMAIL` + `GA_PRIVATE_KEY`) — tuỳ chọn, bật báo cáo realtime ở `/admin/analytics` (T-43). Tạo service account trong Google Cloud, bật *Google Analytics Data API*, thêm email của nó vào GA (Admin → Property access management) vai trò Viewer. `GA_PROPERTY_ID` là số của property, không phải `G-…`. Đặt ở Production; không commit khoá.
   - `GA_MEASUREMENT_ID` (FR-GA-001, D-72): **chỉ đặt ở Production**, không đặt ở Preview để số liệu thử nghiệm không lẫn vào báo cáo. Dạng `G-XXXXXXXXXX`; sai định dạng bị `loadConfig` bỏ qua và web chạy không có GA. Trang `/admin`, `/it` không nhúng GA.
3. **Giới hạn serverless — đừng phá:**
   - Body request tối đa 4,5 MB → upload video lô **phải** đi qua signed upload URL (T-12), không qua Express. Không thêm endpoint nhận file lớn.
   - Không ghi file cục bộ, không giữ trạng thái quan trọng trong bộ nhớ tiến trình; mọi trạng thái vào Supabase.
   - `maxDuration: 30` (Mây có timeout 15 giây/lượt gọi OpenAI, T-29). Không nâng nếu không cần.
   - Số liệu API (T-18) flush bằng `setInterval` + SIGTERM: trên Vercel instance có thể bị đóng trước khi flush → số liệu có thể thiếu (G-35).
4. **Trước khi push lên nhánh deploy:** `npm run lint`, `npm test`, `npm run build` đều xanh. Preview deployment của nhánh/PR phải mở được `/`, `/en`, `/zh`, `/api/products` (200) trước khi gộp.
5. **Production = `master`.** Không deploy tay từ máy (`vercel --prod`) trừ khi người dùng yêu cầu; không dùng token Vercel trong repo. Thư mục `.vercel/` đã ở `.gitignore`.
6. **Thay đổi cấu hình deploy** (`vercel.json`, `api/`, biến môi trường bắt buộc mới) → cập nhật file này, `.env.example` và `decisions.md` cùng lúc.
7. Mỗi lần thêm route/tệp đọc lúc chạy ngoài `dist/**` (ví dụ thư mục dữ liệu, template) → thêm vào `includeFiles`.
8. **Security headers (T-37)** do `server/middleware/security.js` đặt cho mọi response, không cấu hình ở `vercel.json` (để một chỗ duy nhất quyết định). CSP dùng **hash** của script nội tuyến (không dùng nonce vì trang được CDN chia sẻ) và **chỉ bật khi `NODE_ENV=production`** — ở dev Vite chèn script nội tuyến riêng. Thêm host bên ngoài (CDN ảnh, dịch vụ mới) → phải mở đúng host đó trong `buildCsp`, không dùng `*`. HSTS chỉ gửi khi `x-forwarded-proto: https`.
9. **Cron quét đơn quá hạn (BR-PAY-003)**: `vercel.json` → `crons`. **Gói Hobby chỉ cho cron chạy MỘT LẦN MỖI NGÀY** — đặt lịch dày hơn (ví dụ `*/5 * * * *`) thì Vercel **từ chối cả bản deploy**, không chỉ bỏ qua cron; trang lỗi trỏ tới `vercel.com/docs/cron-jobs/usage-and-pricing`. Hiện đặt `0 18 * * *` (01:00 giờ Việt Nam, giờ vắng khách). Đúng đắn về nghiệp vụ không phụ thuộc cron: đơn quá hạn còn được huỷ ngay khi khách mở đơn hoặc mở danh sách đơn (`expireIfDue`); cron chỉ để trả lượt coupon của những đơn không ai mở. Lên gói Pro thì mới tăng tần suất được.
10. **Chống dò/spam (G-20)** bật mặc định; ngưỡng ở `server/config.js`. Đếm bằng `app_settings`-style counter trong DB (không dùng bộ nhớ tiến trình vì serverless), khoá đếm là **băm** của IP/email với `MAY_HASH_SALT` → không lưu IP hay email thô. **Không đặt `RATE_LIMIT=0` ở Preview/Production.** `TRUST_PROXY=1` là bắt buộc, nếu không mọi request đều mang IP của Vercel và một người bị chặn sẽ chặn cả site.
11. **Cache headers**: trang công khai `s-maxage=60, stale-while-revalidate=300` (CDN Vercel giữ bản chung — SSR trang công khai không phụ thuộc phiên đăng nhập); trang riêng tư `private, no-store`; `sitemap.xml` `s-maxage=3600`; `robots.txt` `s-maxage=86400`. Đổi SSR sang phụ thuộc phiên (ví dụ render tên người dùng ở server) thì **phải** bỏ `s-maxage` cùng lúc.

## Nối Supabase với `lamvi.vercel.app` (thứ tự bắt buộc)

1. **Tạo bảng trước**: Supabase → SQL Editor, chạy lần lượt `supabase/migrations/*.sql` rồi `supabase/seed.sql`. Đặt biến ở bước 2 khi DB chưa có bảng → mọi API trả 500 (`PGRST205`).
2. **Vercel → Settings → Environment Variables** (Production): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PUBLIC_SITE_URL=https://lamvi.vercel.app`, `TRUST_PROXY=1`, `MAY_HASH_SALT` (chuỗi ngẫu nhiên).
3. **Redeploy** Production (biến mới chỉ áp dụng cho lần deploy sau).
4. **Supabase → Authentication → URL Configuration**: Site URL `https://lamvi.vercel.app`. Link đặt lại mật khẩu nay do server tự tạo và gửi (T-49) nên **không** cần Redirect URLs hay SMTP của Supabase. Giữ "OTP expiry" ở 3600 giây (link đặt lại mật khẩu hết hạn sau từng ấy). Xác nhận email đã bỏ ở tầng app (D-63) — không cần chỉnh "Confirm email".
5. Cookie phiên `lamvi_rt` là `Secure` khi `PUBLIC_SITE_URL` là https — Production phải đặt đúng https, nếu không trình duyệt không lưu cookie ở trang https. Preview (domain `*.vercel.app` khác `PUBLIC_SITE_URL`) vẫn đăng nhập được vì kiểm Origin chấp nhận cùng Host.
6. Kiểm tra: `/api/products` 200; đăng ký tài khoản mới → vào thẳng `/account`; Supabase → Authentication → Users thấy user mới.

## Kiểm thử cục bộ giống Vercel

```bash
npm run build
VERCEL=1 NODE_ENV=production node -e "const {default:app}=await import('./api/index.js'); \
  import('node:http').then(({createServer})=>createServer(app).listen(5180))"
curl -i localhost:5180/en
```

Chưa kiểm chứng trên một deployment Vercel thật (G-36) — phiên đầu tiên deploy phải kiểm tra §Quy tắc 4.

## Vercel Web Analytics (T-42)

Gói `@vercel/analytics` được nhúng ở `src/main.jsx`. Bật **Analytics** trong dashboard Vercel của project để có số liệu; không cần biến môi trường hay đổi CSP.
12. **CI (T-50)**: `.github/workflows/ci.yml` chạy `lint`, `test`, `build` (Node 22) và `npm audit --omit=dev --audit-level=high` cho mọi PR và push `master`; `.github/dependabot.yml` mở PR cập nhật npm/Actions hằng tuần. Nên bật branch protection yêu cầu job `lint · test · build` xanh trước khi gộp vào `master`. Cron secret so sánh bằng `timingSafeEqual`.
13. **Migration đi trước code (T-54)**: bản có lời chúc/QR cần `supabase/migrations/20261005000010_gift_messages_users.sql` (cột `orders.qr_token NOT NULL`, `orders.delivered_at`, `profiles.email/locked_at`, bảng `gift_messages`, bucket **riêng tư** `gift-media`). **Chạy migration trên Supabase TRƯỚC khi deploy Production** — thiếu cột `qr_token` thì tạo đơn lỗi 500. Migration an toàn khi chạy lại (`if not exists`, `on conflict`) và tự điền token cho đơn cũ. Sau khi chạy: kiểm Storage → bucket `gift-media` ở chế độ Private.
13b. **Migration đi trước code (T-57, T-58)**: `20261005000011_collections.sql` (bộ sưu tập; thiếu thì `/api/collections` và gallery lỗi 500) và `20261005000012_address_inventory.sql` (cột `orders.province_code/ward_code`, `products.stock`, hàm `reserve_stock`/`release_stock`; **thiếu thì tạo đơn lỗi 500**). Chạy theo thứ tự 011 → 012 trên Supabase TRƯỚC khi deploy Production. Cả hai chạy lại an toàn (`if not exists`, `create or replace`). Sau khi chạy 012: tồn kho mọi sản phẩm là NULL (không theo dõi) — vào `/admin/products` nhập số lượng thì mới bắt đầu trừ kho.
14. **Cron `expire-orders` làm hai việc (T-54)**: quét đơn payOS quá hạn và xoá media lời chúc quá hạn (D-26, D-75). Vẫn một cron/ngày (gói Hobby); không thêm cron mới. Media quá hạn còn bị xoá lười mỗi khi có người mở trang QR.
15. **Dashboard IT → Thư giao dịch (T-54)**: gọi thật nhà cung cấp mỗi lần mở (Resend `GET /domains`, Brevo `GET /account`; không gửi thư). `Tốt` = khoá dùng được và tên miền của `MAIL_FROM` đã xác minh; khoá chỉ có quyền gửi (Sending access) hiện `Tốt` kèm ghi chú vì không đọc được danh sách tên miền; `Lỗi` kèm mã `invalid_api_key` / `domain_not_verified`. Chưa đặt biến → `Chưa có khoá`.
16. **Thông báo đơn hàng và banner thư (T-56)**: dùng chung `MAIL_FROM` + `RESEND_API_KEY`; không có biến mới. `PUBLIC_SITE_URL` phải là domain https công khai vì banner nằm ở `{PUBLIC_SITE_URL}/images/mail/banner.jpg` (Gmail chỉ tải ảnh công khai). Dựng lại banner: `npm run gen:mail-banner` (python3 + Pillow). Gói Resend miễn phí 100 thư/ngày. `PWNED_CHECK` nay mặc định tắt.
17. **Chân thư doanh nghiệp (T-56)**: đặt ở Vercel (Production) các biến `MAIL_COMPANY_LEGAL` (tên pháp nhân + MST), `MAIL_COMPANY_ADDRESS`, `MAIL_SUPPORT_EMAIL`, `MAIL_SUPPORT_PHONE`, `MAIL_SUPPORT_HOURS`, `MAIL_FACEBOOK_URL`/`MAIL_INSTAGRAM_URL`/`MAIL_TIKTOK_URL`/`MAIL_ZALO_URL`/`MAIL_YOUTUBE_URL`, tuỳ chọn `MAIL_BRAND_NAME` (mặc định LAMVI). Mục nào trống thì **không hiện** — code không có giá trị mặc định về địa chỉ/điện thoại/MST. Có `MAIL_SUPPORT_EMAIL` hoặc điện thoại thì chân thư nói "cần hỗ trợ hãy liên hệ…", không có thì nói "không trả lời thư này". Đổi biến cần redeploy. Thư báo đổi mật khẩu luôn không có liên kết (kể cả mạng xã hội, mailto).

