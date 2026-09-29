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
  app.js                   createApp({ repo, auth, config }) — dùng trong test
  config.js                Đọc biến môi trường
  errors.js                HttpError + errorHandler (định dạng lỗi thống nhất)
  i18n.js                  normalizeLang, pick (D-40), localePath (D-37)
  domain/                  Quy tắc nghiệp vụ thuần (catalog.js, account.js)
  middleware/auth.js       requireAuth (Bearer token → req.user)
  routes/                  catalog.js, auth.js, admin.js, it.js, may.js, cart.js, seo.js (sitemap, robots)
  adapters/openai.js       Chat Completions qua fetch (T-29)
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
  i18n/                    core.js (translate, localePath), index.js (useI18n), LocaleProvider.jsx, messages/{vi,en,zh}.js
  api/                     client.js (api, ApiError), useApi.js
  auth/                    AuthProvider.jsx, context.js (useAuth, phiên), useForm.js
  hooks/useNoIndex.js      meta robots noindex (BR-SEO-001, D-44)
  components/              SiteHeader, SiteFooter, LocaleLayout, Price, Field, Faq, Marquee, Lantern…
                           Reveal.jsx (Reveal, CountUp — motion xuất hiện/biến mất), Effects.jsx (TiltCard, PointerGlow, BrandHover — T-24), Motifs.jsx (hoạ tiết SVG: trống đồng, mây, sen, con dấu, dấu bưu điện, ảnh cũ)
  pages/                   HomePage, ProductPage, BatchPage, AccountPage, NotFoundPage, auth/*
  admin/                   AdminLayout, ProductsPage, FaqPage, BatchesPage, I18nInput, strings.js (D-48)
  it/                      ItDashboard.jsx, strings.js (D-51)
  may/                     May.jsx (nút, tour), MayChat.jsx, Tour.jsx, MayAvatar.jsx, storage.js
  cart/                    CartProvider.jsx, context.js (useCart), AddToCart.jsx, QuantityInput.jsx
  lib/money.js             formatVnd
  lib/motion.js            useViewState (below/in/above), biến thể rise/ink/stamp/group (T-22)
  styles/                  App.css (landing), pages.css (trang mới); token màu + texture ở index.css (T-23)
  test/                    renderApp.jsx (mockApi, renderAt), fixtures.js
scripts/gen-seed-sql.js
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
| `getUser(accessToken)` | `{ id, email } \| null` |
| `signOut(accessToken)` | |
| `sendPasswordReset(email, redirectTo)` | Không báo email có tồn tại hay không |
| `updatePassword(userId, password)` | |

Lỗi chung: `RATE_LIMITED`.

## Schema (Supabase)

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `products` | `slug` unique, `kind` single/set, `status` draft/published/hidden, `price_excl_vat` int, `name/description/badge` jsonb | D-03, D-39 |
| `faq_entries` | `question/answer` jsonb, `is_published`, `sort_order` | G-07 |
| `batches` | `code` unique, `status` created/video_published, `video_url`, `video_path`, `title/story` jsonb | D-10, D-43; `video_published` bắt buộc có `video_url`; trigger chặn gỡ xuất bản/xoá/đổi mã khi đã xuất bản (D-47) |
| `storage.buckets: batch-videos` | Bucket công khai chứa video lô | D-46 |
| `profiles` | `id` → `auth.users`, `full_name`, `phone`, `preferred_locale`, `role` customer/admin/it | D-38, D-42, D-51 |
| `api_metrics` | PK (`bucket` phút, `method`, `route`, `status`); `count`, `total_ms`, `max_ms`, histogram `le_50…gt_2500` | D-53; ghi qua RPC `record_api_metrics` |
| `api_errors` | `at`, `method`, `route`, `path`, `status`, `code`, `message` | Lỗi 5xx |
| `app_settings` | `key`, `value` jsonb, `updated_by`, `updated_at` | `maintenance` (D-54), `may` (cấu hình Mây) |
| `cart_items` | PK (`user_id`, `product_id`), `quantity` 1..10 | Giỏ người đã đăng nhập (D-41, D-60) |
| `chat_messages` | `user_id`, `session_id`, `role`, `kind`, `content`, `lang` | Lịch sử chat người đã đăng nhập (D-19) |
| `may_counters` | `key` (đã băm), `count`, `expires_at` | Hạn mức §22.4; RPC `may_increment` |
| `may_usage` | `month`, `requests`, tokens, `cost_usd` | Ngân sách (D-58); RPC `may_add_usage` |

RLS bật, không có policy (chỉ service role của server truy cập).

## API

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/sitemap.xml`, `/robots.txt` | – | §23.2 |
| GET | `/api/health` | – | |
| GET | `/api/products?lang=` | – | Sản phẩm `published` |
| GET | `/api/products/:slug?lang=` | – | 404 nếu không `published` |
| GET | `/api/faq?lang=` | – | FAQ `is_published` |
| GET | `/api/batches/:code?lang=` | – | 404 nếu chưa có video |
| POST | `/api/auth/register?lang=` | – | `{ email, password, fullName, phone?, preferredLocale? }` → 201 |
| POST | `/api/auth/login` | – | → phiên |
| POST | `/api/auth/refresh` | – | `{ refreshToken }` → phiên mới |
| POST | `/api/auth/logout` | Bearer | 204 |
| POST | `/api/auth/forgot-password?lang=` | – | Luôn 202 |
| POST | `/api/auth/reset-password` | Bearer (token khôi phục) | `{ password }` → 204, vô hiệu token |
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
| PUT/GET | `/api/dev-storage/upload/:token`, `/api/dev-storage/o/*` | Token | Chỉ khi chạy adapter bộ nhớ |
| POST | `/api/cart/quote?lang=` | – | `{ items: [{ slug, quantity }] }` → giỏ đã tính giá (vãng lai) |
| GET | `/api/cart?lang=` | Bearer | Giỏ tài khoản |
| PUT/DELETE | `/api/cart/items/:slug` | Bearer | `{ quantity }` 1..10 |
| POST | `/api/cart/merge` | Bearer | Gộp giỏ trình duyệt (D-59) |
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

## Luồng đặt lại mật khẩu (Supabase)

1. `POST /api/auth/forgot-password` → Supabase gửi email, link về `PUBLIC_SITE_URL/[lang/]reset-password#access_token=…&type=recovery`.
2. `ResetPasswordPage` đọc token trong hash, xoá khỏi URL, gửi `POST /api/auth/reset-password` với `Authorization: Bearer <token>`.
3. Server `getUser(token)` → `updatePassword` → `signOut(token)`.

Cần cấu hình trong Supabase Dashboard → Authentication → URL Configuration: thêm `PUBLIC_SITE_URL/reset-password`, `/en/reset-password`, `/zh/reset-password`, `/login`… vào Redirect URLs.

## Frontend

- Route: `LocaleLayout` bọc mọi trang, cấp ngôn ngữ qua `LocaleProvider`, đặt `<html lang>` và `document.title`.
- Admin: `/admin/{products,faq,batches}` — chỉ tiếng Việt, ngoài `LocaleLayout` (D-48).
- IT: `/it` — chỉ tiếng Việt (D-51).
- Trang con: `/` · `/products/:slug` · `/lo/:code` · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/account` · `*` (404), mỗi trang có thêm biến thể `/en/…`, `/zh/…`.
- `AuthProvider`: phiên trong `localStorage` (`moc.session`), `authedApi` tự refresh một lần khi gặp 401.
