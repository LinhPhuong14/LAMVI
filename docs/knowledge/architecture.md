# Kiến trúc

## Tổng quan

```text
Trình duyệt ──GET trang──► Express (server/) ──SSR (server/ssr.js + src/entry-server.jsx)──► HTML + __INITIAL_DATA__
     │                         │
     └──fetch /api────────────►├─► routes/* ──► services/domain ──► Adapter ──► Supabase (Postgres + Auth + Storage)
                               │                                              └► Bộ nhớ (dev/test, T-04)
                               └─► /sitemap.xml, /robots.txt (routes/seo.js)
```

- Một server (T-15, D-49). Dev: `npm run dev` → Express + Vite middleware (HMR) ở cổng 5173. Prod: `npm run build` rồi `npm start`. `npm run dev:api` chạy chỉ API.
- Frontend **không** giữ key Supabase (T-05). Mọi quyền truy cập kiểm tra ở server.

## Thư mục

```text
api/index.js               Vercel Function: re-export `app` (T-33, xem deploy-vercel.md)
vercel.json                Rewrite, includeFiles, buildCommand (T-33)
server/
  index.js                 Khởi động: đọc env, chọn adapter Supabase/bộ nhớ, gắn SSR; export `app` (không listen khi VERCEL, T-33)
  ssr.js                   createWeb (Vite middleware / dist) + renderPage (SSR)
  services/catalog.js      Truy vấn công khai dùng chung API + SSR
  monitoring/              metrics.js (số liệu API), maintenance.js (bảo trì), health.js (kiểm tra tích hợp)
  may/                     config.js (cấu hình mặc định + validate), guard.js (PII, kiểm tra số, FAQ offline), tools.js (hàm backend cho Mây), service.js
  cart/service.js          Giỏ hàng: tính giá, gộp, giới hạn (D-59, D-60)
  orders/notify.js         Thông báo đơn hàng qua email (§20, D-93, T-56)
  messages/service.js      Lời chúc: soạn (chữ/giọng nói/video), trang QR người nhận, xác nhận, dịch, xoá media hết hạn (FR-MSG-001, FR-QR-002…005, T-54)
  security/lockedAccounts.js  Bọc auth provider: tài khoản bị khoá không có phiên (G-19, T-54)
  orders/service.js        Checkout → đơn → thanh toán: quoteCart (T-40), createOrder, webhook payOS, huỷ, hết hạn (T-41)
  app.js                   createApp({ repo, auth, config }) — dùng trong test
  config.js                Đọc biến môi trường
  errors.js                HttpError + errorHandler (định dạng lỗi thống nhất)
  i18n.js                  normalizeLang, pick (D-40), localePath (D-37)
  domain/                  Quy tắc nghiệp vụ thuần (catalog.js, account.js, pricing.js, order.js, coupon.js, couponValidate.js, message.js)
  middleware/auth.js       requireAuth (Bearer token → req.user)
  middleware/sessionCookie.js  cookie refresh token HttpOnly (`lamvi_rt`), `sameOriginOnly` chống CSRF (T-49)
  mail/{mailer,templates}.js   thư giao dịch qua Resend/Brevo (HTTPS), khung thư dùng chung (banner + bố cục) và mẫu thư vi/en/zh (T-49, T-56)
  security/pwned.js        kiểm mật khẩu đã lộ (HIBP k-anonymity, fail-open) (T-49)
  middleware/security.js   Security headers + CSP hash (T-37)
  middleware/rateLimit.js  Chống dò/spam, đếm trong DB (T-38, G-20)
  routes/                  catalog.js, auth.js, admin.js, adminUsers.js, it.js, may.js, cart.js, orders.js, qr.js, seo.js (sitemap, robots)
  adapters/openai.js       Chat Completions qua fetch (T-29)
  adapters/payos.js        Cổng thanh toán: ký/xác minh HMAC, tạo & huỷ link (NFR-SEC-002)
  domain/admin.js          Kiểm tra dữ liệu admin (sản phẩm, FAQ, lô, video)
  adapters/
    authErrors.js          AuthError (mã lỗi chuẩn hoá)
    repoErrors.js          RepoError('CONFLICT', field) — trùng slug/mã lô
    memory/{repo,auth,storage}.js   Adapter bộ nhớ
    supabase/{repo,auth,storage}.js Adapter Supabase
  data/seed.js             Dữ liệu khởi tạo (nguồn cho supabase/seed.sql)
supabase/
  migrations/*.sql         Schema
  seed.sql                 Sinh từ server/data/seed.js (npm run db:seed-sql)
src/
  main.jsx                 Client: hydrateRoot / createRoot
  entry-server.jsx         SSR render(url, { initialData, siteUrl })
  AppShell.jsx             Provider chung (HeadContext, DataContext, Router, Auth)
  routes.jsx               Router: /, /en, /zh (D-37), /admin
  seo/                     head.js (thẻ head, JSON-LD), Seo.jsx, context.js, routes.js (phân loại SSR)
  analytics/               ga.js (danh sách sự kiện, làm sạch đường dẫn/tham số), index.js (track, usePageViews) — FR-GA-001
  i18n/                    core.js (translate, localePath), index.js (useI18n), LocaleProvider.jsx, messages/{vi,en,zh}.js
  api/                     client.js (api, ApiError), useApi.js
  auth/                    AuthProvider.jsx, context.js (useAuth, phiên), useForm.js
  lib/password.js          Quy tắc mật khẩu cơ bản, dùng chung server + giao diện (D-91)
  auth/landing.js          Trang đích sau đăng nhập: admin/IT → /admin (D-94)
  hooks/useNoIndex.js      meta robots noindex (BR-SEO-001, D-44)
  components/              SiteHeader, SiteFooter, LocaleLayout, Price, Field, Faq, Marquee, Lantern…
                           Reveal.jsx (Reveal, CountUp — motion xuất hiện/biến mất), Effects.jsx (TiltCard, PointerGlow, BrandHover — T-24), Motifs.jsx (hoạ tiết SVG: trống đồng, mây, sen, con dấu, dấu bưu điện, ảnh cũ)
  pages/                   HomePage, ProductPage, BatchPage, AccountPage, CartPage, CheckoutPage, OrderPage, NotFoundPage, auth/*
  admin/                   AdminLayout, OrdersPage, ProductsPage, FaqPage, BatchesPage, CouponsPage, MayConfigPage, I18nInput, strings.js (D-48)
  it/                      ItDashboard.jsx, strings.js (D-51)
  may/                     May.jsx (nút, tour), MayChat.jsx, Tour.jsx, MayAvatar.jsx, storage.js
  cart/                    CartProvider.jsx, context.js (useCart), AddToCart.jsx, QuantityInput.jsx
  orders/                  useOrders.js (đơn của tôi), OrderStatus.jsx (nhãn + tiến độ §16)
  lib/money.js             formatVnd
  lib/motion.js            useViewState (below/in/above), biến thể rise/ink/stamp/group (T-22)
  styles/                  App.css (landing), pages.css (trang mới); token màu + texture ở index.css (T-23)
  test/                    renderApp.jsx (mockApi, renderAt), fixtures.js
scripts/gen-seed-sql.js, scripts/gen-og-image.js + gen_og_image.py (ảnh og:image, G-23)
docs/ba-spec.md, docs/knowledge/
```

## Interface adapter

Thêm phương thức → thêm ở **cả** `memory` và `supabase` + test.

### Repository

| Phương thức | Trả về |
|---|---|
| `listProducts({ statuses })` | `Product[]` theo `sortOrder` |
| `getProductBySlug(slug)` | `Product \| null` |
| `listFaq({ publishedOnly })` | `FaqEntry[]` |
| `getBatchByCode(code)` | `Batch \| null` |
| `getProfile(userId)` | `Profile \| null` |
| `upsertProfile({ id, fullName?, phone?, preferredLocale? })` | `Profile` (role mặc định `customer`, không đổi role qua đây) |
| `getProductById`, `createProduct`, `updateProduct(id, patch)`, `deleteProduct` | Admin; trùng slug → `RepoError CONFLICT` |
| `getFaq`, `createFaq`, `updateFaq`, `deleteFaq` | Admin |
| `listBatches`, `getBatchById`, `createBatch`, `updateBatch`, `deleteBatch` | Admin; trùng mã → `RepoError CONFLICT` |

### Lời chúc và người dùng (repository)

| Phương thức | Ghi chú |
|---|---|
| `getOrderByQrToken(token)` | Đơn theo token QR (64 hex) |
| `getGiftMessage(orderId)`, `upsertGiftMessage(orderId, patch)` | Mỗi đơn tối đa một dòng `gift_messages` |
| `confirmGiftMessage(orderId, at)` | Ghi `confirmed_at` đúng một lần (tạo dòng nếu chưa có) |
| `listGiftMediaCandidates()` | Các dòng còn media chưa xoá, kèm đơn — để cron xoá quá hạn |
| `listProfiles({ q, role, locked, limit, offset })`, `countOrdersByUsers(ids)` | Admin: danh sách người dùng |
| `updateProfileAdmin(id, { role?, lockedAt?, lockedReason? })` | Đổi vai trò/khoá; `upsertProfile` không đổi được khoá |

Storage thêm `signedUrl(path, bucket, { expiresIn, download })` (bucket riêng tư `gift-media`). Mailer thêm `ping()` (kiểm khoá, không gửi thư). OpenAI client thêm `completeText` (không tool) cho `may.translate`.

### Giám sát (repository)

| Phương thức | Ghi chú |
|---|---|
| `ping()` | Kiểm tra DB |
| `recordApiMetrics(rows)`, `listApiMetrics({ since })`, `deleteApiMetricsBefore(iso)` | Số liệu (D-53) |
| `recordApiErrors(rows)`, `listApiErrors({ since, limit })` | Lỗi 5xx |
| `getSetting(key)`, `setSetting(key, value, userId)` | Cài đặt (bảo trì) |

Auth provider và storage có thêm `ping()`.

### Giỏ hàng (repository)

| Phương thức | Ghi chú |
|---|---|
| `getCart(userId)` | `[{ productId, quantity, addedAt }]` theo thứ tự thêm |
| `setCartItem(userId, productId, quantity)`, `removeCartItem(userId, productId)` | |

### Mây (repository)

| Phương thức | Ghi chú |
|---|---|
| `incrementMayCounter(key, ttlSeconds)` | Trả số đếm mới; hết hạn thì về 1 |
| `addMayUsage(month, { promptTokens, completionTokens, costUsd })`, `getMayUsage(month)` | Ngân sách |
| `appendChatMessages(rows)`, `listChatMessages(userId, { limit })` | Lịch sử |

### Storage

| Phương thức | Ghi chú |
|---|---|
| `createVideoUpload({ path, contentType })` | `{ uploadUrl, headers }` — URL tải lên dùng một lần (T-12) |
| `statObject(path)` | `{ size, contentType } \| null` |
| `publicUrl(path)` | Link công khai của file |

### Auth provider

| Phương thức | Ghi chú |
|---|---|
| `signUp({ email, password, redirectTo })` | `{ user, needsConfirmation }`; lỗi `EMAIL_TAKEN` |
| `signIn({ email, password })` | Phiên `{ accessToken, refreshToken, expiresAt, user }`; lỗi `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED` |
| `refresh(refreshToken)` | Phiên mới; lỗi `UNAUTHORIZED` |
| `getUser(accessToken)` | `{ id, email, isRecovery } \| null` — `isRecovery` cho biết token đến từ link "Quên mật khẩu" (G-18) |
| `signOut(accessToken)` | |
| `sendPasswordReset(email, redirectTo)` | Không báo email có tồn tại hay không |
| `updatePassword(userId, password)` | |
| `verifyPassword(userId, password)` | `true/false` — xác minh mật khẩu hiện tại khi đổi mật khẩu (G-18) |

Lỗi chung: `RATE_LIMITED`.

## Schema (Supabase)

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `collections` | `slug` unique, `status`, `tone`, `name/description` jsonb, `story_title/story` jsonb (phần thưởng, chỉ server trả khi đủ bộ) — D-96, migration 011 |
| `products` | `slug` unique, `kind` single/set, `status` draft/published/hidden, `price` int (**đã gồm VAT**), `name/description/badge` jsonb, `image_url`/`image_path`/`image_alt` | D-39, D-68, D-77 |
| `faq_entries` | `question/answer` jsonb, `is_published`, `sort_order` | G-07 |
| `batches` | `code` unique, `status` created/video_published, `video_url`, `video_path`, `title/story` jsonb | D-10, D-43; `video_published` bắt buộc có `video_url`; trigger chặn gỡ xuất bản/xoá/đổi mã khi đã xuất bản (D-47) |
| `storage.buckets: batch-videos` | Bucket công khai chứa video lô | D-46 |
| `storage.buckets: product-images` | Bucket công khai chứa ảnh sản phẩm | D-77 |
| `profiles` | `id` → `auth.users`, `full_name`, `phone`, `preferred_locale`, `role` customer/admin/it | D-38, D-42, D-51 |
| `api_metrics` | PK (`bucket` phút, `method`, `route`, `status`); `count`, `total_ms`, `max_ms`, histogram `le_50…gt_2500` | D-53; ghi qua RPC `record_api_metrics` |
| `api_errors` | `at`, `method`, `route`, `path`, `status`, `code`, `message` | Lỗi 5xx |
| `app_settings` | `key`, `value` jsonb, `updated_by`, `updated_at` | `maintenance` (D-54), `may` (cấu hình Mây), `pricing` (thuế suất, phí ship, ngưỡng miễn ship — D-69, D-70) |
| `cart_items` | PK (`user_id`, `product_id`), `quantity` 1..10 | Giỏ người đã đăng nhập (D-41, D-60) |
| `chat_messages` | `user_id`, `session_id`, `role`, `kind`, `content`, `lang` | Lịch sử chat người đã đăng nhập (D-19) |
| `may_counters` | `key` (đã băm), `count`, `expires_at` | Hạn mức §22.4; RPC `may_increment` |
| `may_usage` | `month`, `requests`, tokens, `cost_usd` | Ngân sách (D-58); RPC `may_add_usage` |
| `coupons` | `code` unique (chữ HOA), `type` percent/amount/free_shipping, `value`, `max_discount`, `min_order`, `product_ids` uuid[], `usage_limit`, `per_user_limit`, `used_count`, `starts_at`/`ends_at`, `status` | D-71; RPC `claim_coupon` / `release_coupon` (tăng/trả lượt nguyên tử) |
| `orders` | `code` unique, `user_id`, `status` (§16), `order_kind` gift/self, `has_message`, `qr_lang`, người nhận + địa chỉ VN, `payment_method` payos/cod, `payment_status`, `payment_expires_at`, `payos_order_code` unique, `payment_flag`, bảng giá chốt (`subtotal`, `discount`, `shipping_fee`, `total`, `vat_amount`, `vat_rate`), `coupon_id`/`coupon_code`, `tracking_code` | D-68…D-76. Ràng buộc: COD chỉ khi giao cho chính mình (BR-PAY-004), `qr_lang` chỉ khi có lời chúc, COD không ở `pending_payment` |
| `order_items` | `order_id`, `product_id` (nullable), `slug`, `name` jsonb, `unit_price`, `quantity`, `line_total` | Chốt giá và tên lúc tạo đơn (BR-PRC-002) |
| `coupon_redemptions` | `coupon_id`, `user_id`, `order_id` unique | Đếm lượt theo khách (C-5); xoá khi huỷ đơn (C-8) |
| `audit_log` | `at`, `actor_id`, `actor_role`, `entity`, `entity_id`, `action`, `old_value`/`new_value` jsonb | NFR-AUD-001: đơn, coupon, hoàn tiền, người dùng (khoá, mở khoá, đổi vai trò) |
| `gift_messages` | `order_id` unique, `text` (≤300 ký tự do server kiểm), `text_lang`, `voice_path/type`, `video_path/type`, `confirmed_at`, `media_deleted_at`, `translations` jsonb | FR-MSG-001, D-12, D-26, D-75; bucket riêng tư `gift-media` |
| `orders` (thêm) | `qr_token` unique NOT NULL (256 bit hex), `delivered_at` | BR-QR-001, D-75 |
| `profiles` (thêm) | `email`, `locked_at`, `locked_reason` | G-19, D-90 |

RLS bật, không có policy (chỉ service role của server truy cập).

## API

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/sitemap.xml`, `/robots.txt` | – | §23.2 |
| GET | `/api/health` | – | |
| GET | `/api/products?lang=` | – | Sản phẩm `published` |
| GET | `/api/products/:slug?lang=` | – | 404 nếu không `published` |
| GET | `/api/collections?lang=` | – | Bộ sưu tập `published` kèm `lamps[]` và `set` (D-96); không có story |
| GET | `/api/collections/:slug?lang=` | – | 404 nếu không công khai |
| GET | `/api/geo/provinces` | – | Tỉnh/thành (mã, tên) — D-99, cache dài |
| GET | `/api/geo/provinces/:code/wards` | – | Phường/xã của tỉnh; 404 nếu mã lạ |
| GET | `/api/gallery?lang=` | Đăng nhập | Đèn đã nhận (đơn DELIVERED), bộ sưu tập + mảnh, `reward` chỉ khi đủ bộ, `quilt` (D-97) |
| GET | `/api/it/maintenance/log` | IT | Lịch sử bật/tắt bảo trì (G-27) |
| GET | `/api/faq?lang=` | – | FAQ `is_published` |
| GET | `/api/batches/:code?lang=` | – | 404 nếu chưa có video |
| POST | `/api/auth/register?lang=` | – | `{ email, password, fullName, phone?, preferredLocale? }` → 201 |
| POST | `/api/auth/login` | – | → phiên `{ accessToken, expiresAt, user }` + cookie `lamvi_rt` (HttpOnly). Không có `refreshToken` trong body (T-49) |
| POST | `/api/auth/refresh` | Cookie `lamvi_rt` + kiểm Origin | → phiên mới, xoay vòng cookie; cookie bị từ chối → xoá cookie, 401 |
| POST | `/api/auth/logout` | Bearer hoặc cookie + kiểm Origin | 204; luôn xoá cookie, thu hồi mọi phiên (cả khi access token đã hết hạn) |
| POST | `/api/auth/forgot-password?lang=` | – | `{ email }` → 202 và gửi thư; email chưa đăng ký → 404 `EMAIL_NOT_REGISTERED` (D-92) |
| POST | `/api/auth/reset-password` | – (token một lần trong body) | `{ token, password , confirmPassword? }` → 204, thu hồi mọi phiên, thư báo đổi. Token sai/hết hạn/đã dùng → 400 `INVALID_RESET_TOKEN`; mật khẩu yếu/đã lộ → 400 (token chưa bị tiêu thụ) |
| POST | `/api/auth/change-password` | Bearer | `{ currentPassword, password }` → 204, thu hồi mọi phiên (G-18) |
| GET | `/api/me` | Bearer | Hồ sơ |
| PATCH | `/api/me` | Bearer | `{ fullName?, phone?, preferredLocale? }` |
| GET/POST | `/api/admin/products` | Admin | Danh sách mọi trạng thái / tạo (mặc định draft) |
| GET/PATCH/DELETE | `/api/admin/products/:id` | Admin | 409 `SLUG_TAKEN` |
| GET/POST | `/api/admin/faq` | Admin | |
| PATCH/DELETE | `/api/admin/faq/:id` | Admin | |
| GET/POST | `/api/admin/batches` | Admin | 409 `BATCH_CODE_TAKEN` |
| GET/PATCH/DELETE | `/api/admin/batches/:id` | Admin | Đã xuất bản: 409 `BATCH_CODE_LOCKED` (đổi mã), `BATCH_PUBLISHED` (xoá) |
| POST | `/api/admin/batches/:id/video-upload` | Admin | `{ contentType, size }` → `{ path, uploadUrl, headers }` |
| POST | `/api/admin/batches/:id/video` | Admin | `{ path }` → gắn video (thay được sau xuất bản) |
| POST | `/api/admin/batches/:id/publish` | Admin | 409 `VIDEO_REQUIRED` |
| POST | `/api/admin/products/:id/image-upload` | Admin | `{ contentType, size }` → `{ path, uploadUrl, headers }` (D-77) |
| POST/DELETE | `/api/admin/products/:id/image` | Admin | Gắn / gỡ ảnh sản phẩm; gắn ảnh mới thì xoá object cũ |
| GET | `/api/admin/analytics/realtime` | Admin, IT | GA realtime (T-43): `{configured:false}` hoặc người online, lượt xem, 30 phút theo phút, top trang/quốc gia/thiết bị; lỗi GA → 502 `GA_*` |
| GET/POST | `/api/admin/coupons` | Admin | Danh sách / tạo (§14, D-71) |
| GET/PATCH/DELETE | `/api/admin/coupons/:id` | Admin | Xoá coupon đã dùng → 409 `COUPON_IN_USE` |
| GET | `/api/admin/orders?status=` | Admin | Danh sách đơn, kèm `nextStatuses` và `paymentFlag` |
| GET | `/api/admin/orders/:code` | Admin | Chi tiết + nhật ký kiểm toán + `message` (cờ, KHÔNG có nội dung — D-89) + `qrUrl` để in thiệp |
| POST | `/api/admin/orders/:code/status` | Admin | `{ status, trackingCode? }`; bước nhảy sai → 409 (§16) |
| POST | `/api/admin/orders/:code/refund` | Admin | Ghi nhận đã hoàn tiền thủ công (D-74) |
| PUT/GET | `/api/dev-storage/upload/:token`, `/api/dev-storage/o/*` | Token | Chỉ khi chạy adapter bộ nhớ |
| POST | `/api/cart/quote?lang=` | – | `{ items: [{ slug, quantity }] }` → giỏ đã tính giá (vãng lai) |
| GET | `/api/cart?lang=` | Bearer | Giỏ tài khoản |
| PUT/DELETE | `/api/cart/items/:slug` | Bearer | `{ quantity }` 1..10 |
| POST | `/api/cart/merge` | Bearer | Gộp giỏ trình duyệt (D-59) |
| POST | `/api/checkout/quote?lang=` | Bearer | `{ couponCode? }` → bảng giá của giỏ (FR-CHK-008) |
| POST | `/api/orders?lang=` | Bearer | Dữ liệu checkout + `expectedTotal?` → `{ order, payment }`; giá lệch → 409 `PRICE_CHANGED` kèm bảng giá mới |
| GET | `/api/orders?lang=` | Bearer | Đơn của tôi (FR-ACC-002) |
| GET | `/api/orders/:code?lang=` | Bearer | Chi tiết; đơn người khác → 404 |
| POST | `/api/orders/:code/payment` | Bearer | Lấy lại liên kết thanh toán payOS |
| POST | `/api/orders/:code/cancel` | Bearer | Huỷ đơn trước SHIPPED (BR-ORD-001) |
| GET/PUT | `/api/orders/:code/message` | Bearer | Đọc / lưu chữ lời chúc `{ text, textLang? }`. 409 `MESSAGE_TEXT_LOCKED` (từ PACKED), `NO_MESSAGE`; đơn người khác → 404 |
| POST | `/api/orders/:code/message/media-upload` | Bearer | `{ kind: voice\|video, contentType, size }` → `{ path, uploadUrl, headers }`; 409 `MESSAGE_LOCKED` (từ SHIPPED) |
| POST/DELETE | `/api/orders/:code/message/media[/:kind]` | Bearer | Gắn media đã tải (kiểm lại kiểu/size thật) / gỡ |
| GET | `/api/qr/:token` | – (token) | Trang người nhận: `preparing` \| `greeting` \| `active` (chữ, media signed URL, đếm ngược). Token sai/đơn huỷ → 404 chung |
| POST | `/api/qr/:token/confirm` | – (token) | "Tôi đã nhận được quà": ghi `confirmed_at` lần đầu; 409 `GIFT_NOT_READY` nếu chưa SHIPPED |
| POST | `/api/qr/:token/translate` | – (token) | `{ lang }` → `{ lang, text, cached }`; 503 `TRANSLATE_UNAVAILABLE` |
| GET | `/api/admin/users?q=&role=&status=&page=` | Admin, IT | Danh sách 20 người/trang kèm số đơn (D-90) |
| GET | `/api/admin/users/:id` | Admin, IT | Hồ sơ + 20 đơn gần nhất + nhật ký |
| POST | `/api/admin/users/:id/lock` · `/unlock` | Admin (khách), IT (mọi người) | `{ reason? }`; không tự khoá mình (409 `CANNOT_MANAGE_SELF`) |
| PATCH | `/api/admin/users/:id` | IT | `{ role }` customer/admin/it; không tự đổi vai trò của mình |
| POST | `/api/payments/payos/webhook` | **Chữ ký** | Nguồn sự thật để xác nhận đơn (NFR-SEC-002, BR-PAY-001) |
| GET/POST | `/api/internal/expire-orders` | `CRON_SECRET` | Quét đơn payOS quá hạn (BR-PAY-003) và xoá media lời chúc quá hạn (D-26, D-75) → `{ cancelled, mediaPurged }`; Vercel Cron gọi bằng GET |
| POST | `/api/may/chat` | Tuỳ chọn | `{ message, lang, sessionId, history }` → `{ reply: { kind: answer\|resting\|tired\|sick\|unknown, text, faq? } }` |
| GET | `/api/may/history` | Bearer | Lịch sử chat của mình |
| GET/PUT | `/api/admin/may/config` | Admin, IT | Cấu hình Mây |
| GET | `/api/admin/may/usage` | Admin, IT | Chi phí tháng, % ngân sách |
| GET | `/api/it/health` | IT | Kiểm tra tích hợp + máy chủ + trạng thái bảo trì |
| GET | `/api/it/metrics?range=1h\|24h\|7d` | IT | Tổng hợp theo endpoint |
| GET | `/api/it/errors?range=` | IT | Lỗi 5xx gần đây |
| PUT | `/api/it/maintenance` | IT | `{ enabled }` |

Quyền: `requireRole` đọc `profiles.role` ở server mỗi request. `/api/admin/*`: admin, it; `/api/it/*`: it (D-51). Cấp quyền: `update public.profiles set role = 'admin' /* hoặc 'it' */ where id = '<uuid>';`

Bảo trì (D-54): `maintenance.apiGuard` chặn API ghi; `renderPage` trả trang bảo trì 503 cho trang công khai.

## Luồng đặt lại mật khẩu (T-49, không dùng SMTP của Supabase)

1. `POST /api/auth/forgot-password` → `auth.createRecoveryToken(email)` (Supabase `generateLink` type recovery, không gửi thư; email không có → bỏ qua) → mailer gửi `PUBLIC_SITE_URL/[lang/]reset-password#t=<token>`. Luôn trả 202.
2. `ResetPasswordPage` đọc `#t=`, xoá hash khỏi URL, gửi `POST /api/auth/reset-password { token, password }`.
3. Server kiểm mật khẩu (độ dài + HIBP) → `auth.resetPassword` (`verifyOtp` tiêu thụ token → `updateUserById` → `signOut global`) → xoá cookie, ghi `audit_log`, gửi thư báo đổi.

## Luồng phiên (T-49)

`login`/Google callback đặt cookie `lamvi_rt` (HttpOnly). Client giữ access token; hết hạn (401) → `POST /api/auth/refresh` (cookie, không body) → token mới + cookie mới. Đăng xuất gọi `/auth/logout` rồi xoá `localStorage`.

## Luồng đặt hàng và thanh toán

```text
Giỏ → POST /api/checkout/quote (bảng giá + coupon)
    → POST /api/orders  { dữ liệu checkout, expectedTotal }
        ├─ COD  → đơn CONFIRMED ngay (D-41) → trang cảm ơn
        └─ payOS → đơn PENDING_PAYMENT + link thanh toán (hạn 15 phút, D-73)
              → khách trả tiền trên trang payOS
              → webhook POST /api/payments/payos/webhook (xác minh chữ ký)
                   ├─ đúng số tiền → CONFIRMED + payment_status paid
                   ├─ lệch số tiền → giữ nguyên trạng thái + cờ AMOUNT_MISMATCH
                   └─ đơn đã huỷ  → ghi nhận paid + cờ PAID_AFTER_CANCEL (hoàn tay)
              → hết hạn: huỷ đơn + trả lượt coupon (khi khách mở đơn, hoặc Vercel Cron 5 phút)
```

Mọi chuyển trạng thái dùng `updateOrderIfStatus` (khoá lạc quan — T-41). Bảng giá do `quoteCart`
sinh ra, dùng chung cho trang checkout và lúc tạo đơn (T-40).

Cần cấu hình trong Supabase Dashboard → Authentication → URL Configuration: thêm `PUBLIC_SITE_URL/reset-password`, `/en/reset-password`, `/zh/reset-password`, `/login`… vào Redirect URLs.

## Frontend

- Route: `LocaleLayout` bọc mọi trang, cấp ngôn ngữ qua `LocaleProvider`, đặt `<html lang>` và `document.title`.
- Công khai: `/shop` (bộ sưu tập + đèn lẻ), `/collections/:slug`, `/privacy`, `/returns`; tài khoản: `/account?tab=gallery` (gallery + chăn Đông Hồ).
- Admin: `/admin/{orders,users,products,faq,batches,coupons,analytics,may}` — chỉ tiếng Việt, ngoài `LocaleLayout` (D-48).
- IT: `/it` — chỉ tiếng Việt (D-51).
- Trang con: `/` · `/products/:slug` · `/lo/:code` · `/qr/:token` (riêng tư, noindex) · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/account` · `*` (404), mỗi trang có thêm biến thể `/en/…`, `/zh/…`.
- `AuthProvider`: access token + user trong `localStorage` (`moc.session`, không có refresh token — T-49), `authedApi` tự gọi `/auth/refresh` (cookie) một lần khi gặp 401.


## Checkout transaction (T-59)

`orders/service.js` tính quote và payload; `repo.createOrder` commit qua RPC `create_checkout_order`. Postgres giữ kho/coupon, order_items snapshots, redemption và consumption của cart trong một transaction. Memory adapter mô phỏng khi `fromCart:true`; việc chèn snapshot fixture không có cart dùng cho test lịch sử.

Schema 013 thêm `order_items.stock_reserved` và `orders.atomic_cancellation`. Các lệnh huỷ adapter mới set marker ngay trong conditional UPDATE; trigger `orders_release_on_cancel` trả tài nguyên atomic. Public order presentation không trả các trường vận hành này. Ledger legacy NULL cần runbook đối soát, không dựa vào tồn kho hiện tại để suy luận quá khứ.
