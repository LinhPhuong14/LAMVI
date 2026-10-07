# Nhật ký phiên

## 2026-10-07 — QA/QC vòng hai (feat/production-commerce-readiness)

Kết quả cuối: 3.150/3.150 tests, lint/build pass; PostgreSQL 001–020 + 10 SQL regressions/concurrency pass; browser recovery mất response/COD/cancel và 8 mẫu axe không có finding; local smoke 1.000 requests, 0 lỗi; production dependency audit 0 known advisory.

Review độc lập tìm và sửa race payment/cancel/refund, signed webhook trust, atomic cart/reload recovery, cart lookup >1.000, returns response-loss replay, outbox settlement/fencing/payload cleanup, telemetry PII và bounded media cleanup. Không đổi nghiệp vụ đang chờ PO. Bằng chứng và gate còn thiếu: [báo cáo QA](../qa-qc-2026-10-07-round2.md).

Không merge master/deploy khi chưa schema preflight và Preview integration T-59; cloud hiện thiếu binding thật.


## 2026-10-07 — Triển khai commerce readiness (feat/production-commerce-readiness)

Đã triển khai checkout idempotency/UX, collection admin, outbox email, metrics serverless và đổi trả gate-off; runtime fail-closed, footer cấu hình thật, private lazy routes và hydration fixes. Không thay quyết định PO/LEGAL. Bộ test đầy đủ 3.070/3.070 qua; build qua; PostgreSQL 001–018 và concurrency được kiểm thật trên container tạm. Kiểm cuối: thêm 29 tests messages/TTL qua; browser mobile 7 samples, 0 JS errors/axe findings, keyboard xã PASS; local public-read smoke 1.000 requests/20 concurrency, 0 lỗi (memory adapter, không chứng nhận 1M). Browser mobile/axe và local load smoke được ghi trong [runbook](../production-release-1m.md).

Chưa deploy hoặc nghiệm thu 1M: thiếu production bindings/schema preflight/Preview integration; cần PO chốt video/retention/phạm vi quốc tế, nội dung sản phẩm và doanh nghiệp thật. Giữ master theo gate T-59.


## 2026-10-07 — Audit production và kế hoạch hoàn thiện

- Nhánh `docs/production-feature-plan-2026-10-07`; không sửa application/schema hay quyết định BA.
- Đối chiếu GET công khai production, BA v0.37, source; ghi rõ guard/app shell không chứng minh flow hoạt động.
- Đọc 12 nguồn chính chủ Shopify Hydrogen, Stripe examples, W3C ARIA và Google web-vitals; website benchmark trực tiếp bị proxy chặn. Network draft save bị `stale_base`, chưa lưu; proposal bảo toàn ngoài repo.
- Tạo [kế hoạch P00–P08](../production-feature-plan-2026-10-07.md), có schema/API đề xuất, acceptance, dependency PO/legal và rollout gate. Chưa triển khai/code các ticket.
- Kiểm tra link nội bộ và số evidence; không chạy lại suite application cho thay đổi tài liệu. Tài liệu hiện lưu trong workspace trên nhánh docs; chưa push/merge.

## 2026-10-06 — Checkout nguyên tử và dấu vết giữ kho (nhánh `fix/checkout-atomic-inventory`)

**Yêu cầu**: bắt đầu sửa theo đề xuất rà soát BA/production, ưu tiên bộ sưu tập và an toàn đơn/kho.

**Đã làm (T-59)**: migration 013 + RPC transaction cho giữ kho/coupon, tạo đơn/dòng hàng và dọn giỏ; kiểm lại giá/status/coupon và per-user limit dưới lock; `stock_reserved` phân biệt không theo dõi với số thực giữ. Huỷ mới opt-in `atomic_cancellation` để trạng thái và trả tài nguyên cùng commit; flag bảo vệ migrate-before-deploy khỏi double release với code cũ. Legacy ledger NULL không tự suy đoán stock; cần đối soát. Supabase adapter gọi một RPC, không bù trừ sau timeout không rõ commit. Collections thiếu schema nhận mã 503 riêng; thêm `scripts/check-schema.js` đọc-only.

**Kiểm tra**: subagent độc lập T-11 thêm 12 regression HTTP; PostgreSQL 17 Docker chạy toàn bộ migrations, chạy lại 013, lỗi giữa order/items, rollback cancellation, legacy và compatibility, tranh hàng cuối/coupon, giới hạn coupon theo khách, double checkout, đảo thứ tự sản phẩm. Toàn suite: 150 file/2.979 test qua; sau bổ sung hai test marker rollout, nhóm Supabase/checkout độc lập 23/23 qua. Lint + build qua; bản SSR build local trả 200 ở `/`, `/en`, `/zh`, `/shop`, `/collections/sum-vay` và API sản phẩm/bộ sưu tập.

**Còn lại**: production `lamvi.com.vn` chưa được sửa/deploy. API collections 500 chỉ có lỗi chung, không thể kết luận thiếu migration từ response đó. Chạy preflight với binding production qua kênh an toàn, áp dụng migration theo runbook và kiểm Preview trước merge master. Không đổ seed mẫu vào DB thật. Outbox mail, gắn lô, đổi trả và các mục UX là các đợt tiếp theo.

---

## 2026-10-05 (phiên 5) — Địa chỉ 2 cấp và tồn kho (nhánh `feat/address-inventory`)

**Yêu cầu người dùng**: "làm tiếp G-46 địa chỉ VN và tồn kho".

**Quyết định từ người dùng**: D-99 (địa chỉ 2 cấp mới: tỉnh/thành → phường/xã, thay phần quận/huyện của D-41 vì cấp quận/huyện đã bỏ từ 01/07/2025); D-100 (tồn kho theo số lượng từng đèn, trừ khi đặt đơn — chốt Q-07).

**Đã làm**: T-58. Danh mục 34 tỉnh/3.321 phường-xã đóng gói trong repo; checkout chọn từ hai ô, server tra tên; tồn kho giữ chỗ nguyên tử (hàm SQL), trả khi huỷ/hết hạn, UI "Tạm hết hàng", giỏ/checkout chặn, admin chỉnh tồn.

**Bẫy**: nhiều test checkout/đơn cũ gửi `province` dạng chữ → đổi sang `provinceCode`/`wardCode`; test thương hiệu cấm "Mộc" nên loại file danh mục địa danh; memory adapter phải mặc định `stock: null` cho khớp Supabase.

**Còn lại / cần người dùng**: chạy migration `20261005000012` trước khi deploy (G-78) rồi nhập tồn kho ở `/admin/products`; cảnh báo sắp hết hàng (G-79) cần chốt ngưỡng/kênh.

---

## 2026-10-05 (phiên 3) — Mây tra đơn, chính sách, audit log, bộ sưu tập, gallery + chăn Đông Hồ (nhánh `feat/may-orders-policy-audit`)

**Yêu cầu người dùng**: danh sách khoảng trống (Mây tra đơn; chính sách riêng tư/đổi trả; audit log sản phẩm/FAQ/lô; thông báo đơn; khoá tài khoản admin; phần nhỏ) + (8) thiết kế lại catalog: bộ sưu tập khác đèn lẻ, mua lẻ đèn trong bộ; (9) gallery đèn, video lời chúc, chăn Đông Hồ mở mảnh khi đủ bộ với hiệu ứng như game.

**Quyết định từ người dùng**: D-98 (đổi trả 7 ngày từ DELIVERED, đổi/hoàn khi lỗi-vỡ-sai hàng); gallery lấy từ đơn DELIVERED; đèn sở hữu = mảnh nhỏ, đủ bộ = mảnh lớn; dev dựng khung + nội dung mẫu (D-96, D-97).

**Đã làm** (mỗi tính năng có subagent kiểm thử độc lập, T-11)

1. Mây tra đơn (G-29). Subagent: không lỗi bảo mật; sửa `String(code)` ép mảng thành mã hợp lệ.
2. Trang `/privacy`, `/returns` + footer + sitemap (G-10). Subagent: nhãn footer en/zh lệch tiêu đề → đã đồng bộ; nhắc Q-19/Q-22 chưa có D-xx → đã ghi D-98.
3. Audit log sản phẩm/FAQ/lô (G-21), rollback đăng ký (G-38), nhật ký bảo trì (G-27).
4. Bộ sưu tập, gallery, chăn Đông Hồ (D-96, D-97).

**Đã có từ trước (không làm lại)**: thông báo đơn qua Resend (v0.33, G-45 còn nhắc soạn/khoá lời chúc), khoá tài khoản (v0.31, G-19).

**Chưa làm**: G-46 (địa chỉ VN), G-44 (tồn kho), G-25 (cảnh báo IT chủ động) — mỗi mục cần quyết định riêng (G-77); luồng gửi yêu cầu đổi trả (G-75); admin quản lý bộ sưu tập (G-70).

**Còn lại / cần người dùng**: chạy migration 011 + seed bộ mẫu (G-69); thay nội dung mẫu (G-71); pháp chế duyệt chính sách (Q-40); xem hiệu ứng chăn trên thiết bị thật (G-72).
## 2026-10-05 (phiên 3) — Chân thư doanh nghiệp (nhánh `feat/mail-business-footer`)

**Mục tiêu người dùng**: thư thật đã có banner nhưng muốn đẹp và chuyên nghiệp hơn, thêm footer và thông tin như email doanh nghiệp chuẩn mực.

**Đã làm**: D-95, T-56 (bổ sung). `server/mail/layout.js` (tách khung thư khỏi `templates.js`): nhãn phân loại, vạch son, hộp lưu ý, khối đơn hàng có mã đơn, chân thư doanh nghiệp đọc từ `MAIL_*`. Đã xem bằng Chromium với dữ liệu mẫu.

**Bẫy**: website không có thông tin công ty thật nên KHÔNG điền bừa địa chỉ/hotline/MST — mục nào trống thì không hiện. Thư báo đổi mật khẩu vẫn không có link nào, kể cả `mailto:`/mạng xã hội (giữ chữ thuần).

**Còn lại / cần người dùng**: cung cấp thông tin công ty (tên pháp nhân + MST, địa chỉ, hotline, email hỗ trợ, giờ làm việc, link mạng xã hội) để đặt `MAIL_*` ở Vercel rồi redeploy; quyết có hộp thư hỗ trợ trả lời được không (G-68).

---

## 2026-10-05 (phiên 2) — Header/footer auth kính mờ (nhánh `fix/glass-header-footer`, `docs/glass-auth-header-footer`)

**Mục tiêu người dùng**: "sửa các phần banner và footer thành dạng glass morphism" (ảnh chụp trang đặt lại mật khẩu).

**Đã làm**: T-55. Thêm class `page-auth`; ảnh sân khấu phủ sau header/footer; kính tối cho `.nav-auth` và `.auth-foot`. Không đổi nghiệp vụ nên không thêm `D-xx` (thuộc D-80).

**Bẫy**: bản đầu dùng `position: fixed` + `backdrop-filter` cho `.nav-auth` → `AccountTheme.extra.test.jsx` hỏng (chỉ `.nav` được miễn). Sửa bằng sticky + `margin-bottom: -56px`, không nới test. Lần chạy `npm test` đầu chỉ thấy 1 test hỏng; chạy lại nguyên bộ mới ra tên.

**Kiểm thử độc lập (T-11)**: subagent đọc diff, thêm `src/components/AuthGlass.extra.test.jsx`.

**Còn lại**: chưa xem bằng mắt trên trình duyệt thật (mobile, trình duyệt không có `backdrop-filter`).

## 2026-10-05 (tiếp) — Thông báo đơn hàng, khung thư, mật khẩu, quên mật khẩu, trang đích admin (nhánh `feat/order-notifications`)

**Mục tiêu người dùng**: gửi thông báo đơn hàng qua Resend; thiết kế banner và layout cho thư; đặt lại mật khẩu cần ô nhập lại + quy tắc mật khẩu (sau đó rút gọn: chỉ cần quy tắc cơ bản, không chặn mật khẩu phổ biến/đã lộ); "quên mật khẩu" phải từ chối email chưa từng đăng ký; admin đăng nhập vào thẳng /admin.

**Đã làm**: D-91…D-94, T-56. Notifier + 5 loại thư; `layout()` dùng chung + banner (`npm run gen:mail-banner`) đã xem bằng Chromium desktop/di động ở vi/en/zh; `src/lib/password.js` + `PasswordRules` + ô nhập lại; `EMAIL_NOT_REGISTERED` + link tạo tài khoản; `landingPath` cho đăng nhập và Google callback.

**Bẫy**: (1) Đã làm bản mật khẩu khắt khe (danh sách phổ biến, leetspeak, dãy liên tiếp, thông tin cá nhân; 118 test cũ phải đổi mật khẩu thử) rồi PO bảo bỏ — chỉ giữ quy tắc cơ bản; mật khẩu thử trong test nay là `Gio-Hoa#Sen2026` và họ hàng. (2) `useSubmit().run` trả giá trị của hàm truyền vào — viết `run(async () => { x = … })` làm đăng nhập luôn bị coi là thất bại. (3) Test cũ khẳng định đúng hành vi cũ (quên mật khẩu luôn 202, đo thời gian) phải đổi/xoá theo D-92. (4) Banner xem thử bằng `file://` dễ sai đường dẫn: ô tiêu đề hiện chữ `alt` nên lỗi lộ ngay.

**Còn lại / cần người dùng**: xem thư thật trên Gmail/Outlook (G-66); nhắc soạn/khoá lời chúc và cảnh báo ngân sách Mây qua email chưa làm (cần lịch chạy); PO xác nhận IT cũng vào /admin thay vì /it (D-94 `[ASSUMPTION]`); Resend miễn phí 100 thư/ngày.

---

## 2026-10-05 — Lời chúc & QR, quản lý người dùng, Resend (nhánh `feat/gift-message-admin-users`)

**Mục tiêu người dùng**: kiểm tra production so với BA; rồi "thêm quản lý user vào admin, làm lời chúc và trang QR lời chúc"; "tích hợp luôn Resend, dashboard IT đang báo có config nhưng chưa tích hợp". Người dùng báo đã gắn Supabase thật, Resend, OAuth, OpenAI cho Mây, GA4, Vercel Web Analytics.

**Quyết định từ người dùng**: D-88 (chữ + giọng nói + video, 300 ký tự, 20/100 MB), D-89 (Q-14/27/29 tạm thời theo "mặc định an toàn"), D-90 (quản lý người dùng đầy đủ: khoá/mở khoá + đổi vai trò).

**Đã làm**: T-54. Migration `20261005000010`; `server/domain/message.js`, `server/messages/service.js`, `server/routes/qr.js`, mở rộng `routes/orders.js`/`admin.js`; `server/routes/adminUsers.js` + `server/security/lockedAccounts.js`; `may.translate`; trang `GiftPage`, khung soạn `GiftMessageEditor`, `UsersPage`, khối QR ở chi tiết đơn admin (thư viện `qrcode`, chỉ nạp khi mở chi tiết đơn); i18n vi/en/zh; `mailer.ping()` + health thật cho Resend; sửa dashboard IT không còn báo "Chưa tích hợp" sai cho thư và payOS.

**Bẫy**: (1) `tool_choice` không được gửi khi không có `tools` (OpenAI báo lỗi) → tách `completeText`. (2) Test cũ khẳng định đúng hành vi sai ("payos not_integrated") nên phải đổi theo. (3) Test cron khẳng định body `{ cancelled }` chính xác → thêm `mediaPurged`. (4) Memory `upsertProfile` phải còn nhận `role` vì test dùng nó để cấp quyền, nhưng không được ghi đè `lockedAt`.

**Còn lại / cần người dùng**: **chạy migration 010 trên Supabase TRƯỚC khi deploy** (G-55) — vì vậy nhánh chưa được gộp vào `master` dù CLAUDE.md cho phép tự gộp; gộp sau khi migration đã chạy. Thử luồng thật: tải media, quét QR, dịch (G-59, G-61). PO chốt Q-14 (G-56: admin chưa có chữ để viết thiệp tay), Q-27, Q-29, Q-25. Thông báo đơn hàng qua Resend (G-45) vẫn chờ Q-24 (kênh) và nội dung thư.

---

## 2026-10-02 — Chi tiết sản phẩm v2 (nhánh `feat/product-detail-v2`)

**Mục tiêu người dùng**: thiết kế lại trang sản phẩm chi tiết giống phong cách shop.

**Đã làm**: D-87, T-53 — tấm tranh lớn + khung mua hàng kính + "Có thể bạn cũng thích"; breadcrumb có "Cửa hàng"; sửa 2 test.

**Bẫy**: con dấu nhãn bị kéo giãn cả chiều rộng khi chỉ đặt `left` (class gốc có `right: 26px`).

## 2026-10-02 — Rà RLS và độ trễ Mây (nhánh `fix/rls-openai-latency`)

**Đã làm**: T-51 — migration `20261002000009_harden_rls.sql`; song song hoá DB/tool trong `server/may/service.js`; `max_tokens` 350; test `server/may.latency.extra.test.js`.

**Còn lại / cần người dùng**: chạy migration trên Supabase; uỷ quyền Supabase MCP để chạy advisor và đối chiếu RLS thật; đo p50/p95 `/api/may/chat` trước/sau ở dashboard IT.

## 2026-10-02 — Trang Cửa hàng và navbar thu nhỏ (nhánh `feat/shop-navbar`)

**Mục tiêu người dùng**: thiết kế trang shop riêng, mọi nút xem đèn đi tới shop thay vì section; thêm "Xem thêm" ở bộ sưu tập; navbar luôn ở đầu trang, cuộn xuống thì thu nhỏ 20% và bo góc.

**Đã làm**: D-86, T-52. `/shop` (lọc, sắp xếp, SSR, sitemap), `ProductCards` dùng chung, đổi link `#products` → `/shop`, nút "Xem thêm", navbar `scale(0.8)` + viên thuốc, bỏ tự ẩn khi cuộn. Sửa test sitemap, header tự ẩn, link `#products`.

**Diễn giải**: "bo góc 50%" làm thành bo tròn hoàn toàn (9999px) — bo 50% theo chiều rộng sẽ thành hình elip. PO xem lại nếu muốn khác.

## 2026-10-02 — Giỏ hàng, bộ sưu tập, tooltip giỏ, dashboard, chat Mây (nhánh `feat/cart-collection-may-dashboard`)

**Mục tiêu người dùng**: thiết kế lại trang giỏ hàng; bỏ hai tab Mua tặng/Mua cho mình ở bộ sưu tập; thay dòng link giỏ hàng trên thẻ sản phẩm bằng phản hồi tốt hơn; thiết kế lại dashboard và khung chat Mây. Giữa chừng PO đổi ý về vị trí phản hồi: không gắn vào Mây, mà ở navbar có huy hiệu + tooltip.

**Đã làm**: D-83, D-84, T-48. Tooltip + huy hiệu trên navbar; giỏ hàng v2; dashboard v2; chat Mây v2 (chip gợi ý, bong bóng, ô soạn). Sửa/xoá các test gắn với tab intent, link "Xem giỏ hàng" trên thẻ, văn bản "Giỏ hàng (n)".

**Hạn chế**: Behance/Pinterest vẫn không xem được ảnh mẫu. Dark theme của dashboard chưa kiểm tra bằng mắt sau khi đổi thanh bên/tab.

## 2026-10-02 — Auth chuẩn production không cần Supabase Pro/Twilio (nhánh `feat/auth-production`)

**Yêu cầu**: thiết kế phần auth chuẩn production cho web không có Supabase Pro và Twilio.

**Phát hiện**: auth đã có nhiều thứ (email+mật khẩu, Google, rate limit, đổi mật khẩu). Lỗ hổng thật khi không có gói trả phí: (1) thư đặt lại mật khẩu đi qua SMTP dùng chung của Supabase Free — chỉ tới thành viên nhóm, vài thư/giờ → "Quên mật khẩu" hỏng ở production; (2) refresh token ở `localStorage` (G-17); (3) bộ giới hạn `reset`/`change` mật khẩu truyền `keys = () => []` nên không đếm gì; (4) không chặn mật khẩu đã lộ.

**Đã làm** (T-49): mailer HTTPS Resend/Brevo + mẫu thư vi/en/zh; đặt lại mật khẩu bằng token một lần (`generateLink` + `verifyOtp`), link `#t=`; refresh token cookie HttpOnly + `sameOriginOnly`; Google callback không để token trên URL; HIBP k-anonymity (fail-open); thư báo đổi mật khẩu + `audit_log`; sửa giới hạn tốc độ; thêm `mail` vào health IT. Cập nhật test cũ theo cơ chế mới, thêm test mailer/pwned/sessionCookie; subagent kiểm thử độc lập (T-11).

**Quyết định không tự đưa ra**: xác minh email khi đăng ký (đảo D-63) → Q-39; PO chốt giữ D-63 (D-85, phiên sau). Không làm SMS/OTP điện thoại, không làm TOTP admin (chưa có yêu cầu).

**Còn lại / cần người dùng**: đặt `MAIL_FROM` + `RESEND_API_KEY`/`BREVO_API_KEY` (và DNS SPF/DKIM nếu dùng Resend) ở Vercel (G-52); thử luồng quên mật khẩu trên Supabase thật; rủi ro G-53, G-54.

## 2026-10-02 — Rà soát CI/CD, bảo mật, hiệu năng (nhánh `fix/devops-hardening`)

**Phát hiện**: repo chưa có CI; `npm audit` sạch; header bảo mật/CSP/rate limit đã đủ; `immutable 1 năm` áp cho cả tệp không băm; ảnh `public/` chỉ có cache mặc định của Vercel; `CRON_SECRET` so sánh bằng `!==`; `probe2.tmp.mjs` bị commit; `deploy-vercel.md` ghi CSP nonce trong khi code dùng hash.

**Đã làm**: T-50 — CI + Dependabot, cache tĩnh đúng loại, `timingSafeEqual`, xoá tệp tạm, sửa tài liệu.

**Còn lại / cần người dùng**: bật branch protection yêu cầu job `lint · test · build`; xem xét RLS Supabase bằng `supabase` MCP khi đã uỷ quyền (phiên này chưa xác thực được).

## 2026-10-01 — Trang auth v2 (nhánh `feat/auth-redesign-v2`)

**Mục tiêu người dùng**: thiết kế lại trang auth cho đẹp hơn, tham khảo Pinterest/Behance.

**Đã làm**: D-82, T-47 — sân khấu ảnh toàn màn hình, thẻ kính, lời dẫn serif lớn, viên thuốc chuyển tab, hiện/ẩn mật khẩu, quầng bokeh. Sửa 3 test gắn với link cuối form cũ.

**Hạn chế**: Behance trả 403 và Pinterest không tải được, chỉ đọc được bài tổng hợp xu hướng 2026 (Liquid Glass, heritage, chữ serif biểu cảm) — chưa tham khảo trực tiếp ảnh mẫu. Cần PO xem lại và gửi ảnh mẫu nếu muốn sát hơn.

## 2026-10-01 — Ảnh riêng cho trang auth (nhánh `feat/auth-photo`)

**Mục tiêu người dùng**: đổi ảnh ở phần auth sang ảnh đẹp hơn, không dùng ảnh của landing.

**Đã làm**: D-81. Tải 1 ảnh CC0 (Openverse/rawpixel): đèn lụa Hội An phản chiếu trên sông đêm; đặt ở nửa trái thiếp đăng nhập, mask tan về chàm; bộ `public/images/auth` có CREDITS riêng.

**Lưu ý**: ảnh gốc 1024px (không phóng to). Nửa trái chỉ dùng một ảnh cho cả 4 trang auth.

## 2026-10-01 — Header kính mờ, header auth riêng, nền mới (nhánh `feat/header-glass-backgrounds`)

**Mục tiêu người dùng**: header cũng kính mờ; trang auth có header khác (không link sang landing); đổi background, tải asset đẹp hơn hoặc nền trơn; mảng navy phủ ảnh cảnh vật độ đậm thấp.

**Đã làm**: T-46, D-80. Tải 2 ảnh CC0 qua Openverse (Hạ Long, đồi sương) — ghi CREDITS; nền auth bằng CSS; sửa 5 test mã hoá hành vi cũ (header auth, `.nav` blur, link trùng tên).

**Lưu ý**: ảnh `hills-gold` gốc 1024px. Các phần nền giấy khác của trang chủ (hero, sản phẩm…) vẫn dùng ảnh cũ — PO chưa yêu cầu đổi.

## 2026-10-01 — Bo góc, kính mờ, chuyển trang (nhánh `feat/ui-glass-transitions`)

**Mục tiêu người dùng**: "bo góc các component, làm kiểu glass morphism, làm motion khi chuyển tiếp giữa các trang".

**Đã làm**: token `--r-*` và `--g-*`; bo góc nút/ô nhập/thẻ/khung; kính mờ cho thẻ công khai; `PageTransition` (T-45); design-rules cập nhật (thay quy tắc góc 2–3px).

**Phát hiện khi viết**: trang đang thoát đọc location mới của router → `<Navigate>` lặp vô hạn (cả bộ test treo); sửa bằng `Frozen`. Test cấp ứng dụng phải chờ qua thời gian thoát.

**Còn lại**: thanh điều hướng dính chưa có kính (giữ nền đặc theo design-rules §9) — PO quyết nếu muốn đổi; góc lõm ở ảnh sản phẩm (`.product-art::after`) chưa bo theo.

## 2026-10-01 — Làm lại auth + đăng nhập Google (nhánh `feat/auth-redesign-google`)

**Mục tiêu người dùng**: khảo sát mẫu Behance/Pinterest cùng vibe LAMVI, chỉnh lại layout đăng nhập/đăng ký/đăng xuất, thêm đăng nhập Google; sau đó yêu cầu dùng cấu hình OAuth của Google Cloud, không dùng Google provider của Supabase.

**Đã làm**: khung `AuthShell` thiếp thư hai nửa (mảng chàm đêm + giấy điệp) cho 4 trang auth; nút Google + dải "hoặc" kẻ đôi; luồng OAuth trực tiếp (T-44, D-78); `/auth/callback`; nút đăng xuất ở header; i18n vi/en/zh.

**Lưu ý**: không xem trực tiếp được ảnh Behance/Pinterest (trang chặn/không tải được) — bố cục dựa trên design-rules (thiếp thư, tranh bồi) và mẫu split-card phổ biến; cần PO xem lại.

**Còn lại / cần người dùng**: tạo OAuth client ở Google Cloud, đặt `GOOGLE_CLIENT_ID/SECRET` + redirect URI (G-51); `[LEGAL]` nội dung quyền riêng tư cho dữ liệu Google.

## 2026-10-01 — Báo cáo GA realtime trong admin (nhánh `feat/admin-ga-realtime`)

**Mục tiêu người dùng**: "thêm báo cáo GA xem realtime vào Admin dashboard".

**Đã làm**: `GET /api/admin/analytics/realtime` (GA4 Data API, service account, T-43), trang `/admin/analytics` (người online, biểu đồ 30 phút, top trang/quốc gia/thiết bị, tự làm mới 30 giây), mục điều hướng mới. Subagent kiểm thử độc lập (T-11). Spec v0.20: `[ASSUMPTION]` §23.3, G-50.

**Phát hiện khi viết**: 5 báo cáo chạy song song đổi token 5 lần → dùng chung một promise.

**Còn lại / cần người dùng**: tạo service account + bật Data API + thêm làm Viewer của property GA, đặt `GA_PROPERTY_ID` và `GA_SERVICE_ACCOUNT_JSON` ở Vercel; thử với property thật (chưa kiểm chứng). Nhánh theo CLAUDE.md là `feat/…`, không phải `claude/…` như môi trường gợi ý.

## 2026-09-30 — Production: giá đã gồm VAT, checkout/đơn/thanh toán, GA + SEO, gia cố (nhánh `feat/production-checkout-seo-ga`)

**Mục tiêu người dùng**: "tiếp tục build theo BA document nhưng theo level production, thêm cả analysis gg và seo cho web".

**Quyết định từ người dùng** (chốt toàn bộ P0 còn lại — spec v0.19, D-68…D-77)

- D-68 (chốt `[LEGAL]` I-04): **giá niêm yết đã gồm VAT** — thay D-03 và D-50.
- D-69 (Q-09): VAT 10%, tính cả trên phí ship, làm tròn một lần ở tổng đơn.
- D-70 (Q-11): phí ship đồng giá 30.000đ, miễn phí từ 1.000.000đ.
- D-71 (C-1…C-3, C-5, C-6, C-8): coupon 3 loại, giảm trước VAT, áp được cho sản phẩm cụ thể, có trần giảm và giới hạn lượt; huỷ đơn trả lượt.
- D-72 (chốt `[LEGAL]` Q-32): **không banner đồng ý cookie**, GA chạy ngay.
- D-73 (Q-15): link payOS 15 phút. D-74 (Q-16): hoàn tiền thủ công.
- D-75 (Q-26): media lời chúc xoá sau 90 ngày kể từ khi giao xong. D-76 (Q-08): soạn lời chúc sau khi đặt; chưa soạn thì thiệp để trống.
- D-77 (G-23): ảnh sản phẩm tải trong admin, ảnh OG tạo trước.

**Đã làm** (mỗi tính năng có subagent kiểm thử độc lập, T-11)

1. **Giá đã gồm VAT**: đổi `price_excl_vat` → `price`, `server/domain/pricing.js` làm nguồn sự thật duy nhất về tiền, cấu hình thuế/ship ở `app_settings`, sửa câu chữ vi/en/zh và JSON-LD. *Subagent phát hiện*: Mây vẫn báo `priceNote: 'excl. VAT'` cho OpenAI (ngược với D-68 vừa chốt, và test cũ đang khoá hành vi sai này); coupon có `type` lạ bị hiểu thành "giảm số tiền"; coupon thiếu `value` làm cả bảng giá thành `NaN`.
2. **GA4 + SEO production + security headers (T-37)**: danh sách sự kiện đóng, làm sạch đường dẫn/tham số; og:image 1200×630, JSON-LD Organization/WebSite/Breadcrumb; CSP, HSTS, cache CDN. *Subagent phát hiện*: `classifyPath`/`isInternalPath` phân biệt hoa/thường trong khi React Router thì không → `/ADMIN`, `/Account` lọt index, lọt cache CDN dùng chung và bị nhúng GA; **CSP nonce vô nghĩa khi response được CDN phát lại cho nhiều người** → chuyển sang hash (T-37); `sanitizePath` lọt token với `/QR/…` và `//qr/…`; `PUBLIC_SITE_URL` có `/` cuối sinh URL hai gạch chéo.
3. **Ảnh sản phẩm trong admin** (D-77): bucket riêng, signed upload URL, kiểm kiểu file thật, không nhận SVG.
4. **Checkout → đơn hàng → thanh toán** (backend + giao diện): bảng giá một nguồn (T-40), khoá lạc quan cho chuyển trạng thái (T-41), webhook payOS xác minh chữ ký, lượt coupon nguyên tử trong DB, nhật ký kiểm toán. *Subagent phát hiện*: **huỷ đơn chỉ trả lượt coupon tổng, không xoá bản ghi lượt theo khách** → `per_user_limit` bị tiêu vĩnh viễn dù đơn đã huỷ; webhook về sau hạn cho kết quả khác nhau tuỳ cron đã chạy hay chưa; admin huỷ đơn không huỷ link payOS; `expectedTotal` sai kiểu âm thầm bỏ bước chốt giá; mã đơn 6 ký tự va chạm ở quy mô ~20.000 mã (đã nâng lên 7 và bỏ lệch modulo).
5. **Admin đơn hàng và coupon**; thêm `POST /orders/:code/payment` để lấy lại liên kết thanh toán (trước đó lỗi cổng payOS làm khách kẹt với đơn không trả được).
6. **Gia cố trước go-live**: G-18 (đặt lại mật khẩu chỉ nhận token khôi phục + đổi mật khẩu có xác minh mật khẩu cũ), G-20 (chống dò/spam đếm trong DB — T-38), G-28 (che dữ liệu cá nhân trong nhật ký lỗi 5xx).
7. **Hạ tầng test**: nới timeout vitest và testing-library, giới hạn số worker (`maxWorkers: '50%'`) — trước đó bộ test fail giả và OOM khi chạy song song.

**Kiểm chứng thật**: chạy bản build production trong trình duyệt — đặt đơn COD hoàn chỉnh từ giỏ → checkout → trang cảm ơn; GA bắn đúng `view_item`, `begin_checkout`, `purchase`; CSP hash không chặn script nào; admin đổi trạng thái đơn và ghi nhật ký; tải ảnh sản phẩm hiện trên trang chi tiết.

**Còn lại / cần người dùng**

- **Lời chúc & trang QR lời chúc (G-42)** là phần nghiệp vụ lớn nhất chưa làm; quyết định đã đủ để làm ngay.
- Mây tra đơn (G-29); nội dung Chính sách riêng tư + đổi trả (G-10, bắt buộc vì D-72 nêu GA ở đó).
- Chưa thử với **payOS thật** và **Supabase thật** (G-36): cần chạy migration 001→008 + seed, đặt `SUPABASE_*`, `PAYOS_*`, `GA_MEASUREMENT_ID`, `CRON_SECRET`, `MAY_HASH_SALT`, `TRUST_PROXY=1`.
- Khoảng trống mới ghi vào spec: G-42…G-47 (lời chúc, BR-ORD-002 không kiểm được, tồn kho, thông báo, danh mục địa chỉ, cron chưa kiểm chứng).
- Câu hỏi mới: Q-37 (giới hạn giá trị COD), Q-38 (ngưỡng chống dò/spam).

---

Mới nhất ở trên. Mỗi mục: mục tiêu · quyết định · đã làm · còn lại.

---

## 2026-09-29 (phiên 10) — Cân lại bố cục dashboard màn rộng (nhánh `fix/dashboard-layout`, từ `master`)

**Nhận xét người dùng**: cụm nội dung bên phải bị dồn trái, để lại khoảng trống lớn → layout lệch.

**Đã làm**: vùng nội dung dashboard rộng tối đa 1320px và căn giữa; tab một thẻ (Trò chuyện) trải hết cột, Hồ sơ 980px căn giữa; hai thẻ hàng dưới Tổng quan cao bằng nhau. Kiểm ở 1440/1812/2560px. Design rules §12.

---

## 2026-09-29 — Kiểm tra production sau khi nối Supabase; sửa link bịa của Mây (nhánh `fix/may-links`)

**Kiểm tra** (người dùng đã chạy migration và đặt biến Vercel): đủ 11 bảng + bucket `batch-videos`; seed 3 sản phẩm, 5 FAQ. `lamvi.vercel.app` `/`, `/en`, `/api/health`, `/api/products`, `/api/faq`, `/sitemap.xml` → 200; server ghi `api_metrics`, `profiles`, `chat_messages` vào Supabase (không còn dữ liệu bộ nhớ). 2 tài khoản đều đã xác nhận email (D-63 chạy đúng). Gửi 1 câu hỏi khách tới Mây → trả lời bằng OpenAI (`kind: answer`, ~7,8 giây), `may_usage` ghi 939 token / 0,000165 USD.

**Lỗi phát hiện**: câu trả lời của Mây chứa markdown `[tại đây](https://lamvi.com/products/den-nguyet)` — domain bịa, và khung chat hiển thị văn bản thuần nên lộ nguyên cú pháp. **Sửa**: `toPlainText` (`server/may/guard.js`) bỏ link/URL/đậm trước khi trả; system prompt cấm markdown/link. Test `server/may.links.extra.test.js`. Spec v0.18, G-41.

**Còn lại**: chưa có admin (cả 2 profile là `customer`); Supabase Auth URL Configuration chưa kiểm được từ phiên này.

---

## 2026-09-29 — Mây: OpenAI mặc định bật (nhánh `feat/may-openai-default`)

**Quyết định từ người dùng**: đồng ý `[LEGAL]` I-14, đổi mặc định bật OpenAI → D-67 (trên nhánh đánh D-64; khi gộp `master` đổi thành D-67 vì D-64…D-66 đã dùng).

**Đã làm**: `DEFAULT_MAY_CONFIG.openaiEnabled = true` (`server/may/config.js`); thiếu `OPENAI_API_KEY` vẫn chạy FAQ offline; admin vẫn tắt được ở `/admin/may`. Bỏ câu "chờ pháp chế" ở admin/IT/`.env.example`. Subagent kiểm thử (T-11): không có lỗi, thêm `server/may.default.extra.test.js` (12 test, gồm che SĐT/email trước khi gửi OpenAI). Spec v0.17.

**Còn lại / cần người dùng**: Vercel đã có `OPENAI_API_KEY`; cấu hình Mây lưu ở Supabase nên vẫn cần nối Supabase. Cấu hình đã lưu với `openaiEnabled: false` giữ nguyên.

---

## 2026-09-29 (phiên 9) — Dashboard kính mờ, nền mây khói, giao diện tối (nhánh `feat/account-glass`, từ `master`)

**Quyết định từ người dùng**: D-65 — glassmorphism, nền dải mây khói/đèn trời bay lên khi vào trang, dark mode.

**Đã làm**

1. Kính mờ cho thẻ, dải số liệu, khung đầu trang, thẻ gợi ý; thanh bên nền trong (T-35).
2. `DashSky`: dải khói màu trôi, hoạ tiết preset `dash`, 8 đèn trời bay lên một lượt.
3. Giao diện tối trong phạm vi dashboard (`data-theme`, nút chuyển ở hàng logo, lưu trình duyệt, mặc định theo thiết bị); đo tương phản ≥ 5,3:1 cho chữ.
4. Test: nhóm "Giao diện sáng/tối và nền" trong `AccountDashboard.extra.test.jsx`; subagent kiểm thử độc lập (T-11) thêm `AccountTheme.extra.test.jsx` (21 test), phát hiện nút chính khi hover ở chế độ tối chỉ 4,33:1 → đổi sang son đậm #9f3a27 (6,3:1).
5. Spec v0.14 (D-65, `[ASSUMPTION]` phạm vi dark mode), design rules §9/§12, T-35.

6. Theo yêu cầu "tìm asset trên mạng/Canva, không tự vẽ SVG ở background": thay nền bằng ảnh thật CC0 (Openverse: rawpixel, StockSnap) — trời sương/trời đêm, khói tách nền, đèn trời tách nền; cảnh đầu trang cũng dùng ảnh. Bỏ preset hoạ tiết `dash` và dải khói gradient. `public/images/dash/CREDITS.md`. Canva không dùng (giấy phép + không có kết nối). Test nền cập nhật (chỉ ảnh thật, có dòng nguồn CC0). Spec v0.15, Q-36 mở rộng.

7. Theo yêu cầu "mobile chưa tốt; thêm ảnh như vậy vào trang chủ và các trang khác — cùng keyword nhưng tìm khác": bộ ảnh mới `public/images/scene` (15 ảnh CC0 qua Openverse: ruộng bậc thang sương, Hạ Long sương, trời đêm đầy đèn trời, biển mây, hồ sương, khói…); `Scene` thay `FloatingMotifs` ở 9 phần trang chủ; cảnh đầu trang cho đăng nhập/đăng ký (thẻ kính mờ), sản phẩm, giỏ, trang lô; 404 khung trời sao; đèn trời lookbook là ảnh thật. Dashboard mobile: thanh điều hướng đáy, 3 ô số liệu một hàng. D-66, T-36, spec v0.16. Người dùng yêu cầu bỏ qua kiểm thử độc lập (T-11) cho đợt này và gộp thẳng vào `master` — chỉ có test cập nhật trong `Folk.extra`/`ssr.folk.extra` + lint/test/build.

**Còn lại**: dark mode cho trang công khai nếu người dùng muốn; pháp chế xác nhận ảnh nền (Q-36).

---

## 2026-09-29 (phiên 8) — Dashboard tài khoản khách (nhánh `feat/account-dashboard`, từ `master`)

**Quyết định từ người dùng**

- D-64: dashboard tài khoản dạng tab dọc, không dùng header (và footer) của trang giới thiệu, tối ưu trải nghiệm.

**Đã làm**

1. `LocaleLayout`: trang dạng ứng dụng (`/account`) không render `SiteHeader`/`SiteFooter` (class `.page-app`).
2. `AccountPage` thành dashboard: thanh bên chàm (logo, đổi ngôn ngữ, người dùng, tab dọc WAI-ARIA, về cửa hàng, giỏ, đăng xuất); tab lưu ở `?tab=`; Tổng quan (số liệu giỏ/đơn/Mây, chat gần đây, tóm tắt hồ sơ), Đơn hàng (chỗ chờ, không đơn giả — G-40), Trò chuyện với Mây (chia theo ngày giờ VN), Hồ sơ. Màn ≤960px: tab ngang dính đầu trang. Design rules §12.
3. Test cũ đổi sang `/account?tab=profile` / `?tab=may`.
4. Subagent kiểm thử độc lập (T-11): `src/pages/AccountDashboard.extra.test.jsx` (58 test) phát hiện: giờ tiếng Anh hiện 12h; tin không có thời điểm xen giữa làm lặp tiêu đề ngày; hai nút "Xem" trùng tên truy cập → đã sửa.
5. Spec v0.12: D-64, quy tắc dashboard §5.2 (`[ASSUMPTION]`), G-40 (khi gộp `master` đánh số lại từ D-63/G-37 vì trùng mã với nhánh `feat/signup-no-confirm`).

6. Theo nhận xét "chưa đủ thanh thoát, thanh lịch, tham khảo dashboard Trung Quốc": làm lại giao diện (T-34) — thanh bên giấy sáng, nét 1px thống nhất, bỏ bóng/khung trang trí, dải số liệu ngăn nét dọc với số chữ mảnh, vạch son trước tiêu đề mục, nhãn tab ngắn ("Trò chuyện"). Không đổi chức năng; bộ test độc lập vẫn xanh (cập nhật tên tab). Spec v0.12 (T-34).

7. Theo yêu cầu "bo các góc và thêm nhiều hình ảnh minh hoạ": bo góc toàn dashboard; minh hoạ SVG tự vẽ `DashArt.jsx` (cảnh dây đèn đầu trang, hình trong ô số liệu, 4 công đoạn ở tab đơn hàng, phong thư ở hồ sơ, thẻ gợi ý có đèn ở thanh bên). Test tab đơn hàng giới hạn vào danh sách tính năng + kiểm 4 công đoạn. Spec v0.13. Gộp vào `master`.

**Còn lại**: tab đơn hàng làm thật cùng FR-ACC-002/003 (chờ checkout, Q-08).

---

## 2026-09-29 — Bỏ xác nhận email + nối Supabase với lamvi.vercel.app (nhánh `feat/signup-no-confirm`)

**Quyết định từ người dùng**: bỏ xác nhận email sau khi đăng ký (Supabase gói Free) → D-63.

**Đã làm**: `server/adapters/supabase/auth.js` đăng ký bằng `auth.admin.createUser({ email_confirm: true })` — không gửi thư, không phụ thuộc cài đặt "Confirm email"; frontend đã sẵn nhánh tự đăng nhập khi `needsConfirmation: false`. Spec v0.11 (D-63, G-37, cập nhật G-16). `deploy-vercel.md`: quy trình nối Supabase với `lamvi.vercel.app`. Kiểm tra `lamvi.vercel.app/api/products` trả 200 bằng dữ liệu bộ nhớ → Vercel chưa có biến `SUPABASE_*`.

**Còn lại / cần người dùng**: chạy migration + seed trên Supabase; đặt biến ở Vercel và redeploy; đặt Site URL/Redirect URLs trong Supabase Auth (không có quyền Vercel/Supabase Management từ phiên này). G-20 (rate limit đăng ký) nên làm sớm vì G-37.

## 2026-09-29 — Supabase MCP + agent skills (nhánh `feat/supabase-mcp`)

**Mục tiêu**: cho Claude Code truy cập Supabase project `nufguvziuoekyqnuqphf` qua MCP.

**Đã làm**: `claude mcp add --scope project --transport http supabase …` → `.mcp.json` (features: docs, account, database, debugging, development, functions, branching). `npx skills add supabase/agent-skills --agent claude-code` → `.claude/skills/{supabase,supabase-postgres-best-practices}` + `skills-lock.json` (chỉ Markdown, không có script).

Kết nối DB: `server/config.js` nhận tên khoá mới `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` (tên cũ anon/service_role vẫn nhận; test `server/config.keys.extra.test.js`); cập nhật `.env.example`, `deploy-vercel.md`, T-04 trong `decisions.md`. Chạy thử local với `.env` (không commit): server báo "Dùng Supabase", Auth trả 200, nhưng REST trả `PGRST205` — **chưa chạy migration** trên project.

**Còn lại / cần người dùng**: xác thực OAuth trên máy cá nhân: `claude /mcp` → chọn `supabase` → Authenticate. Chạy `supabase/migrations/*.sql` theo thứ tự rồi `supabase/seed.sql`. Đặt biến `SUPABASE_*` mới ở Vercel. Không commit token.

## 2026-09-29 — Đổi tên thương hiệu sang LAMVI (nhánh `feat/brand-lamvi`)

**Quyết định từ người dùng**: tên web và thương hiệu là **LAMVI** (viết liền, không dấu) ở mọi nơi; không dùng "MỘC", cũng không dùng "LÂM VỊ" → D-62.

**Đã làm**: logo/ấn triện/chữ lớn footer, trang admin, IT, trang bảo trì SSR, JSON-LD `brand`, prompt của Mây, i18n vi/en/zh (tiêu đề, bản quyền, lời chào tour, nhãn trợ lý) → LAMVI. Cập nhật test theo tên mới; spec v0.10 (D-62, bỏ giả định "giữ MỘC"), `BRAND_GUIDELINE.md`, `design-rules.md`, README.

**Còn lại**: favicon, ảnh chia sẻ mạng xã hội chưa có chữ thương hiệu (G-23); tên miền/Zalo/mạng xã hội thật chưa có.

---

## 2026-09-29 (phiên 7) — Gộp nhánh vào `master` + Vercel (nhánh `claude/relaxed-knuth-46vztf`)

**Đã làm**

1. Gộp vào `master`: `docs/branding-guideline`, `feat/folk-art-redesign` (giải xung đột; T-21…T-24 của Mây/giỏ hàng đánh số lại T-29…T-32, G-29/G-30 của redesign → G-33/G-34; test "Xem chi tiết" cập nhật theo nút giỏ hàng). `feat/landing-page` và `claude/folk-art-web-design-v3ice8` là nguyên mẫu cũ xung đột toàn bộ điểm vào app → gộp kiểu `-s ours` (chỉ ghi lịch sử, không lấy nội dung). `fix/web-copy-ba-spec` đã nằm trong `master`.
2. Vercel (T-33): `api/index.js`, `vercel.json`, `deploy-vercel.md`, quy tắc trong `CLAUDE.md`, `engines` Node 22.

**Còn lại**: deploy thử thật và kiểm quy tắc 4 (G-36); số liệu API trên serverless (G-35).

---

## 2026-09-29 (phiên 6) — Giỏ hàng (nhánh `feat/cart`, từ `master`), gộp vào `master`

**Quyết định từ người dùng**

- D-59 (Q-13): vãng lai có giỏ lưu trình duyệt, gộp khi đăng nhập.
- D-60: tối đa 10 mỗi dòng. D-61: nút Thanh toán bắt đăng nhập rồi báo sắp ra mắt.

**Đã làm**

1. Server: `server/cart/service.js`, `/api/cart/*`, migration `20260929000005_cart.sql`; bảo trì cho phép `/api/cart/quote`.
2. Frontend: `CartProvider`, nút thêm vào giỏ (thẻ + trang chi tiết), header đếm số lượng, `/cart`. Test cũ cập nhật theo hành vi mới (nút thẻ sản phẩm đổi từ "Xem chi tiết" sang thêm vào giỏ; test render routes cần `AuthProvider`). Sửa header xuống dòng ở 1280px.
3. Spec v0.7: D-59…D-61, gỡ Q-13, G-02 đã xử lý.
4. Subagent kiểm thử giỏ hàng (101 test mới) phát hiện: `/api/cart/quote` lộ tên sản phẩm nháp cho khách (D-39); quote chậm ghi đè giỏ vừa gộp khi đăng nhập; giỏ trình duyệt >100 dòng làm kẹt trang giỏ/gộp → đã sửa (quote bỏ nháp, ẩn tên sản phẩm đã ẩn; mã yêu cầu tăng dần trong `CartProvider`; `loadLocalCart` gộp trùng + cắt 50 dòng). Thêm: PUT sản phẩm nháp/ẩn chưa có trong giỏ trả cùng 404 như không tồn tại; gộp lỗi (bảo trì 503) vẫn hiện giỏ tài khoản. Rủi ro còn lại ghi G-32.

**Còn lại / cần người dùng**

- Chạy migration `20260929000005_cart.sql`.
- Checkout chờ P0: Q-09 (VAT), Q-11 (phí ship), coupon C-1…C-3/C-5, Q-08 (lời chúc), Q-15/Q-16 (payOS), Q-17 đã có (chặn COD khi giao người khác).

---

## 2026-09-28 (phiên 5) — AI Mây (nhánh `feat/may`, từ `master`), gộp vào `master`

**Quyết định từ người dùng**

- D-55: code đủ OpenAI nhưng tắt bằng cờ (mặc định tắt) tới khi pháp chế duyệt I-14.
- D-56: kênh hỗ trợ (Q-31) do admin nhập. D-57: timeout 15 giây. D-58: ngân sách 20 USD/tháng.

**Đã làm**

1. Server: `server/may/*`, `/api/may/chat`, `/api/may/history`, `/api/admin/may/*`, migration `20260928000004_may.sql`; dashboard IT hiện trạng thái OpenAI + % ngân sách.
2. Frontend: mascot, khung chat, tour trang chủ, lịch sử trên trang tài khoản, `/admin/may`.
3. Spec v0.6: D-55…D-58, gỡ Q-31, G-05 một phần, G-29…G-31.
4. Subagent kiểm thử Mây phát hiện: SĐT dạng `(+84) 912 345 678` không bị che → đã sửa. Rủi ro đã xử lý: lỗi DB khi đọc/ghi chi phí hoặc lưu lịch sử không còn làm hỏng câu trả lời (500/"ốm"); chặn câu nhắc giảm giá / số tiền viết tắt ở server; cắt lịch sử theo 500 ký tự/lượt; timeout cắt được cả tool treo; ngân sách 0 báo "đã hết".

**Còn lại / cần người dùng**

- Pháp chế duyệt I-14 → admin bật OpenAI ở `/admin/may` (cần `OPENAI_API_KEY` trên server).
- Nhập kênh hỗ trợ ở `/admin/may`. Duyệt nội dung tour + câu thông báo en/zh.
- Tra đơn (G-29) làm cùng đơn hàng.

---

## 2026-09-28 (phiên 5) — Giao diện dân gian cổ + motion (nhánh `feat/folk-art-redesign`)

**Quyết định từ người dùng**

- Web phải "thật nghệ thuật dân gian", thêm cảm giác cổ xưa hoài niệm; motion tốt cả khi xuất hiện và biến mất; hiệu năng tốt; màu tốt hơn.
- Làm trên nhánh mới từ `master` (bản thiết kế đầu tiên ở nhánh `claude/folk-art-web-design-v3ice8` dựa trên master cũ, không gộp).

**Đã làm**

1. Bảng màu Đông Hồ đã ngả màu thời gian + bí danh biến cũ cho `pages.css` (T-23); texture sợi dó, vết ố, mực mòn, viền tối kiểu ảnh cũ.
2. Hoạ tiết SVG (`Motifs.jsx`): trống đồng, mây, sen, con dấu son (logo), dấu bưu điện, ảnh cũ viền răng cưa; đèn vẽ lại theo lối khắc gỗ có tua rua.
3. Motion (T-22): `useViewState` + `Reveal` — xuất hiện khi cuộn tới, biến mất theo hướng cuộn; `CountUp`; đèn lookbook thắp/lịm; hero cuộn đi thì đèn bay lên; header ẩn/hiện theo hướng cuộn; FAQ mở như cuộn thư; `LazyMotion strict`.
4. Hiệu năng (T-21): font tự host + preload, bỏ Google Fonts. Đo local: LCP ~1,55 s → ~0,45 s, CLS 0.
5. Test `src/components/Motion.test.jsx`. Test phát hiện: `useReducedMotion` bỏ qua `MotionConfig` → đổi sang `useReducedMotionConfig`.
5a. Subagent kiểm thử độc lập (T-11): `Motion.extra.test.jsx`, `server/ssr.design.extra.test.js` — không có lỗi; lưu ý HTML SSR có 68 phần tử `opacity:0` (G-34) và cảnh báo lint `set-state-in-effect` → đã sửa: màn hình đầu chạy bằng CSS, `@media (scripting: none)`, `useFinePointer` dùng `useSyncExternalStore`.
5b. Theo yêu cầu "tham khảo Aceternity UI": 9 hiệu ứng tự viết lại (T-24) — Lamp, Spotlight, 3D Card, Text Generate, Tracing Beam, Moving Border, Focus Cards, Sparkles (đèn trời), Text Hover.
5e. Bảng màu cân lại (T-26); phòng tranh ảnh tư liệu Wikimedia Commons public domain/CC0 (T-27) — Commons giới hạn tần suất (429, Retry-After 600s), dùng User-Agent riêng + cỡ ảnh chuẩn 1280, tải chậm; loại ảnh có trẻ em. Design rules `docs/knowledge/design-rules.md`. Hoạ tiết lơ lửng tự vẽ (T-28) vì Commons không có SVG hoạ tiết Việt dùng được. Q-36 `[LEGAL]` chờ pháp chế. Subagent kiểm thử độc lập lần 4 (T-11): `Palette.extra`, `Folk.extra`, `ssr.folk.extra` (50 test) — không có lỗi; lưu ý phòng tranh vẫn `opacity:0` trong SSR (G-34), chữ nguồn ảnh 4,83:1 sát ngưỡng. Tự phát hiện: ảnh nguồn <480px bị phóng to → xuất theo `widths`.
5d. Theo nhận xét "khối có stroke chưa cổ điển": xem 6 web bảo tàng/di sản Trung Quốc, chuyển sang phong cách cổ điển (T-25) — nét mảnh, khung viền đôi, góc triện, mái đình, ấn triện dọc, tranh bồi, thiếp thư. Subagent kiểm thử độc lập lần 3 (T-11): `Classic.extra.test.jsx`, `server/ssr.classic.extra.test.js` (36 test) — không có lỗi.
5c. Subagent kiểm thử độc lập lần 2 (T-11): `Effects.extra.test.jsx`, `server/ssr.effects.extra.test.js` (31 test) — không có lỗi; rủi ro id gradient `brandInk` viết cứng (trùng nếu tái dùng) → đã sửa bằng `useId()`.
6. Spec v0.6: §31.4, G-33, G-34, `[ASSUMPTION]` ngưỡng NFR-PERF-001.

**Còn lại / cần người dùng**

- PO chốt NFR-PERF-001; thống nhất thương hiệu MỘC ↔ "LÂM VỊ" (nhánh `docs/branding-guideline`) trước khi gộp.
- Thay minh hoạ bằng ảnh thật khi có (G-23, G-33).

---

## 2026-09-28 (phiên 4) — Vai trò IT + dashboard IT (nhánh `feat/it-dashboard`), gộp vào `master`

**Quyết định từ người dùng**

- D-51: vai trò IT, dashboard riêng `/it`; IT có cả quyền admin.
- D-52: dashboard gồm số liệu API, trạng thái tích hợp, chế độ bảo trì.
- D-53: số liệu lưu Supabase. D-54: bảo trì = trang bảo trì + API ghi 503.
- Gộp chuỗi nhánh foundation → admin → seo → it-dashboard thẳng vào `master`.

**Đã làm**

1. Hoàn tất kiểm thử SEO còn dở (phiên 3): hai subagent (client + server) → sửa 5 lỗi (xem commit "Bổ sung test độc lập SEO phía server").
2. Vai trò IT, `/api/it/*`, `server/monitoring/*`, `/it`, migration `20260928000003_it.sql`. Lỗi tự phát hiện: nhãn route đọc ở sự kiện `finish` bị mất `req.route` → chụp lúc `writeHead` (T-19).
3. Spec v0.5: FR-IT-001…004, D-51…D-54, G-24…G-28.
4. Subagent kiểm thử IT phát hiện: route API lạ đưa nguyên đoạn URL vào nhãn (uuid/chuỗi tuỳ ý, bảng phình) → gộp `/api/*`. Rủi ro đã xử lý: bảo trì fail-open cả khi trước đó đang bật; flush từng bước độc lập, dọn dữ liệu chỉ đánh dấu khi thành công; revoke execute `record_api_metrics`; allowlist bảo trì không phân biệt hoa thường và chấp nhận `/` cuối.

**Còn lại / cần người dùng**

- Chạy migration `20260928000003_it.sql`; cấp vai trò `it` trong Supabase.
- Cảnh báo chủ động (G-25) chờ kênh thông báo Q-24.

---

## 2026-09-28 (phiên 3) — SEO (nhánh `feat/seo`, tách từ `feat/admin`)

**Quyết định từ người dùng**

- D-49: SSR trong Express (một server Node cho web + API).
- D-50: JSON-LD sản phẩm có giá chưa VAT, `valueAddedTaxIncluded: false` (I-04 vẫn chờ pháp chế).

**Đã làm**

1. Hoàn tất kiểm thử admin còn dở từ phiên 2: subagent phát hiện `contentType` `toString`/`__proto__` lọt kiểm tra → đã sửa; thêm các bản sửa rủi ro (xem commit trên `feat/admin`).
2. SSR: `server/ssr.js`, `src/entry-server.jsx`, `src/AppShell.jsx`, hydrate có dữ liệu nạp sẵn. Lỗi tự phát hiện khi chạy trình duyệt thật: trang chủ lệch hydrate vì trang chủ và footer dùng chung key `/products` mà key bị xoá sau lần đọc đầu → sửa bằng store xoá sau khi hydrate xong.
3. `<Seo>` cho mọi trang; canonical, hreflang, Open Graph, JSON-LD; 404 thật; `sitemap.xml`, `robots.txt`.
4. Spec v0.4: D-49, D-50, G-12/G-15 đã xử lý, G-23 mới.
5. Subagent kiểm thử SEO (client + server) phát hiện: `fill()` dùng chuỗi thay thế nên `$'`/`` $` ``/`$&` trong DB làm vỡ HTML; slug mã hoá hỏng trả 200 trang "đang tải"; dev server 500 với URL `%` hỏng; sitemap 500 khi `updatedAt` hỏng; robots `Disallow: /admin` chặn nhầm tiền tố → đã sửa. Còn mở: trang chủ khi DB lỗi vẫn trả 200 (chưa có yêu cầu).

**Còn lại / cần người dùng**

- Triển khai giờ cần server Node (không còn hosting tĩnh): `npm run build && npm start`, đặt `PUBLIC_SITE_URL` đúng tên miền.
- Ảnh sản phẩm/og:image (G-23). Google Analytics chờ `[LEGAL]` Q-32.

---

## 2026-09-28 (phiên 2) — Admin (nhánh `feat/admin`, tách từ `feat/foundation-web`)

**Mục tiêu**: admin sản phẩm, FAQ, lô & video lô.

**Quyết định từ người dùng**

- D-45: chốt câu "lời chúc riêng cho mỗi món quà", "Hành trình mẻ đèn của bạn".
- D-46: video lô tải file lên Supabase Storage.
- D-47: lô đã xuất bản được thay video, không gỡ/xoá/đổi mã.
- D-48: giao diện admin chỉ tiếng Việt.

**Đã làm**

1. Gộp `origin/master` (nhánh `fix/web-copy-ba-spec` — sửa câu chữ §31.3 đợt 1) vào `feat/foundation-web`: dùng câu chữ đợt 1 trong i18n, hợp nhất §31.2/§31.3; đổi Q-34 (409 đăng ký) của phiên trước thành Q-35 vì trùng mã với Q-34 trên master. Sửa dòng "Trạng thái" đầu spec bị thay nhãn nhầm ở phiên trước.
2. Admin: `/api/admin/*` + `/admin` (sản phẩm, FAQ, lô, tải video bằng signed URL, xuất bản). Subagent kiểm thử độc lập (T-11). Subagent phát hiện: `VIDEO_TYPES[contentType]` nhận cả `toString`/`__proto__` → đã sửa. Rủi ro đã xử lý: kiểm lại kiểu file thật khi gắn video, bucket chỉ nhận video, PATCH rỗng không gọi update, trigger chặn xoá video của lô đã xuất bản.
3. Spec v0.3: D-45…D-48, G-06 một phần, G-21, G-22, giả định mới.

**Còn lại / cần người dùng**

- Chạy migration `20260928000002_admin.sql`; cấp admin bằng `update public.profiles set role = 'admin' …`; thử tải video với Supabase thật (G-22).
- Nhánh khác trên origin (`docs/branding-guideline`, `feat/landing-page`) đổi thương hiệu sang "LÂM VỊ" + Tailwind — chưa gộp master; cần thống nhất trước khi gộp.

---

## 2026-09-28 — Nền tảng web (nhánh `feat/foundation-web`)

**Mục tiêu**: hiện thực phần của `ba-spec.md` không bị chặn bởi `[BA DECISION REQUIRED]`; lập knowledge base.

**Quyết định từ người dùng**

- Nhánh `feat/…` thay vì `claude/…` (CLAUDE.md).
- Stack: Supabase + Node + Express (T-02, T-03).
- Phạm vi: nền tảng chưa bị chặn — routing, i18n, catalog + FAQ từ DB, tài khoản, trang QR lô, sửa nội dung §31.3.
- Duyệt toàn bộ `[PROPOSAL]`/`[ASSUMPTION]` của spec v0.1 → D-41 (và D-37…D-40 cụ thể hoá).
- Q-30: QR đèn là mã chung của lô → D-43. Trang lô `noindex` → D-44.
- Đăng nhập email + mật khẩu → D-42.
- Có Supabase project; người dùng sẽ thêm biến môi trường.

**Đã làm** (mỗi tính năng có subagent kiểm thử độc lập, T-11)

1. Backend Express + adapter Supabase/bộ nhớ; API catalog, FAQ, lô; migration + seed. Subagent phát hiện: URL hỏng và body quá lớn trả 500 → đã sửa; ràng buộc `video_url` rỗng → đã sửa.
2. Frontend: router `/`, `/en`, `/zh`; i18n; sản phẩm/FAQ từ API; chú thích VAT; sửa nội dung §31.3. Subagent phát hiện: câu "lưu giữ bền bỉ" (D-26), framer-motion bỏ qua reduced-motion, client trả `null` với 200 không phải JSON → đã sửa.
3. Tài khoản: đăng ký, đăng nhập, đăng xuất, refresh, quên/đặt lại mật khẩu, hồ sơ.
3a. Subagent phát hiện: lỗi mạng khi refresh làm mất phiên; form hồ sơ không hiện giá trị đã chuẩn hoá; quên mật khẩu dò được email qua 429 của Supabase; đăng xuất Supabase chỉ thu hồi phiên hiện tại; đăng ký lại email chưa xác nhận ghi đè hồ sơ; mật khẩu > 72 byte → đã sửa. Còn mở: G-18 (reset nhận mọi access token), G-20 (rate limit), Q-35 (409 khi email đã đăng ký).
4. Trang QR lô đèn `/lo/:code`. Subagent phát hiện: tiêu đề "không tìm thấy" khi lỗi 500, ngày lệch theo múi giờ → đã sửa.
5. Spec v0.2: D-37…D-44, §31.2/§31.3, giả định mới `[ASSUMPTION]`.

**Còn lại / cần người dùng**

- Trả lời P0 ở `ba-spec.md` §30 để làm giỏ hàng → checkout → thanh toán → lời chúc.
- Duyệt câu thay thế §31.3 và bản dịch en/zh (G-14).
- Cấu hình Supabase: chạy migration + seed, Redirect URLs (G-16), thêm `.env`.
- Trả lời Q-35. Trước go-live: G-17, G-18, G-20.
