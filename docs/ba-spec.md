# Đặc tả nghiệp vụ — Web bán đèn giấy dó LAMVI

| Mục | Giá trị |
|---|---|
| Phiên bản | v0.18 (bản nháp) |
| Ngày | 2026-09-29 |
| Trạng thái | PO đã duyệt toàn bộ `[PROPOSAL]`/`[ASSUMPTION]` của v0.1 (D-41). Còn chờ PO các mục `[BA DECISION REQUIRED]`; giả định phát sinh từ v0.2 gắn `[ASSUMPTION]` |
| Lịch sử | v0.2 (nhánh `fix/web-copy-ba-spec`): sửa câu chữ web theo §31.3, đợt 1. v0.2 (nhánh `feat/foundation-web`): D-37…D-44, nền tảng (catalog, FAQ, i18n, tài khoản, trang QR lô). v0.3: gộp hai nhánh v0.2, D-45…D-48, admin sản phẩm/FAQ/lô. v0.4: D-49, D-50, SEO (SSR, hreflang, sitemap, JSON-LD). v0.5: D-51…D-54, vai trò IT + dashboard IT (sức khoẻ, số liệu API, bảo trì). v0.6: D-55…D-58, AI Mây (chat, FAQ offline, tour, cấu hình). v0.7: D-59…D-61, giỏ hàng. v0.8: gộp nhánh `feat/folk-art-redesign` (giao diện dân gian cổ + motion, bảng màu, phòng tranh ảnh tư liệu — Q-36 `[LEGAL]`, design rules — §31.4) và `docs/branding-guideline` vào `master`. v0.9: deploy Vercel (T-33), G-35, G-36. v0.10: D-62 — tên web và thương hiệu là LAMVI (nhánh `feat/brand-lamvi`). v0.11: D-63 — bỏ xác nhận email khi đăng ký; G-37…G-39 (nhánh `feat/signup-no-confirm`). v0.12: D-64 — dashboard tài khoản khách dạng tab dọc, phong cách thanh thoát (T-34) (nhánh `feat/account-dashboard`), G-40. v0.13: dashboard bo góc + minh hoạ; tab đơn hàng minh hoạ 4 công đoạn. v0.14: D-65 — dashboard kính mờ, nền mây khói + đèn trời khi vào trang, giao diện tối (nhánh `feat/account-glass`). v0.15: nền dashboard dùng ảnh thật CC0 thay hình tự vẽ. v0.16: D-66 — ảnh nền thật cho trang chủ và các trang công khai; dashboard mobile có thanh điều hướng đáy. v0.17: D-67 — PO duyệt I-14, OpenAI của Mây mặc định bật (nhánh `feat/may-openai-default`). v0.18: câu trả lời Mây là văn bản thuần, không link/URL; G-41 (nhánh `fix/may-links`) |
| Phạm vi | **Chỉ hệ thống web** (storefront, tài khoản, trang QR, AI Mây, admin). Vận hành xưởng, kho, vận chuyển nằm ngoài phạm vi (D-34). |

**Quy ước nhãn**

| Nhãn | Ý nghĩa |
|---|---|
| `[CONFIRMED]` | Khách hàng/PO đã xác nhận (có mã quyết định D-xx ở Phụ lục A) |
| `[DERIVED]` | Suy ra trực tiếp từ yêu cầu đã xác nhận |
| `[ASSUMPTION]` | Giả định phát sinh (BA hoặc khi code) — cần PO duyệt. Mọi giả định của v0.1 đã được duyệt ở D-41 |
| `[PROPOSAL]` | Đề xuất của BA theo yêu cầu của PO (ví dụ D-31). Mọi đề xuất của v0.1 đã được duyệt ở D-41 |
| `[BA DECISION REQUIRED]` | Chưa có quyết định — không được tự hiện thực theo cách hiểu riêng |
| `[LEGAL]` | Cần pháp chế/kế toán xác nhận |

---

## 1. Tóm tắt

MỘC là web **B2C** bán đèn giấy dó thủ công tại Việt Nam, định vị là **quà tặng kể chuyện**. Ngoài bán hàng thông thường, web có ba năng lực khác biệt:

1. **Lời chúc gắn QR**: người mua ghi lời chúc (chữ, giọng nói, video). Người nhận quét QR trên thiệp cảm ơn để xem. Chữ lưu vĩnh viễn; giọng nói/video lưu 30 ngày kể từ khi người nhận xác nhận đã nhận quà.
2. **QR khắc trên đèn**: mở video quá trình làm của **lô** đèn, lưu vĩnh viễn.
3. **AI mascot "Mây"** (OpenAI): dẫn tour web, trả lời FAQ, tra tình trạng đơn — chỉ dùng dữ liệu thật từ DB.

Web có 3 ngôn ngữ (vi, en, zh-Hans), SEO, Google Analytics, admin quản lý coupon. Thanh toán qua **payOS** hoặc **COD**. **Bắt buộc có tài khoản để đặt hàng.** Chỉ giao trong nước, tiền tệ VND.

**Hiện trạng repo (v0.7)**: React + Vite frontend, backend Express + Supabase. Đã có: catalog và FAQ từ DB, đa ngôn ngữ vi/en/zh, tài khoản (đăng ký/đăng nhập/quên mật khẩu/hồ sơ), trang QR lô đèn, admin sản phẩm/FAQ/lô & video lô, SEO (SSR, hreflang, sitemap), vai trò IT + dashboard IT, AI Mây (chat, FAQ offline, tour — OpenAI mặc định bật — D-67), giỏ hàng. Chưa có: checkout, thanh toán, đơn, lời chúc, trang QR lời chúc, Mây tra đơn, admin đơn/coupon/đổi trả, GA (xem §31).

---

## 2. Phạm vi

### 2.1 Trong phạm vi

| Nhóm | Nội dung |
|---|---|
| Storefront | Trang chủ, danh sách/chi tiết sản phẩm, giỏ hàng, checkout, FAQ, chính sách |
| Tài khoản | Đăng ký, đăng nhập, quản lý đơn, soạn/sửa lời chúc, lịch sử chat Mây |
| Lời chúc & QR | Trang QR lời chúc (private), trang QR lô đèn (public), dịch tự động |
| AI Mây | Tour, FAQ, tra đơn, xử lý lỗi và hạn mức |
| Thanh toán | payOS, COD |
| Admin | Sản phẩm, đơn hàng (cập nhật trạng thái), lô & video lô, coupon, FAQ, cấu hình Mây, đổi trả |
| Nền tảng | Đa ngôn ngữ vi/en/zh-Hans, SEO, Google Analytics |

### 2.2 Ngoài phạm vi

| Nội dung | Lý do |
|---|---|
| Quy trình sản xuất, công suất xưởng, quay/dựng video lô | D-34 — vận hành |
| Tích hợp API hãng vận chuyển, in vận đơn | D-34 — admin cập nhật trạng thái thủ công `[CONFIRMED]` D-41 |
| Bán/giao quốc tế, đa tiền tệ | D-32 |
| Đánh giá sản phẩm do khách viết | Chưa được yêu cầu |
| Marketplace/nhiều người bán | D-33 (B2C) |

---

## 3. Actor & phân quyền

### 3.1 Actor

| Actor | Mô tả | Cần tài khoản |
|---|---|---|
| Khách vãng lai | Xem web, chat Mây giới hạn | Không |
| Khách hàng (người mua) | Đặt hàng, soạn lời chúc, theo dõi đơn | **Có** (D-36) |
| Người nhận | Người quét QR thiệp để xem lời chúc; có thể trùng người mua | Không `[DERIVED]` từ C-09 (không cần cài app) |
| Người xem QR đèn | Bất kỳ ai quét QR khắc trên đèn | Không |
| Admin | Quản trị nội dung (sản phẩm, FAQ, lô…) tại `/admin` | Có |
| IT | Vận hành kỹ thuật: sức khoẻ hệ thống, số liệu API, chế độ bảo trì tại `/it`; có cả quyền Admin (D-51) | Có |
| Mây (hệ thống AI) | Actor hệ thống, chỉ đọc | — |
| payOS | Cổng thanh toán bên ngoài | — |
| OpenAI | Dịch vụ AI bên ngoài | — |

Vai trò lưu ở hồ sơ: `customer` / `admin` / `it` (D-38, sửa bởi D-51). Một vai trò Admin duy nhất cho nội dung (D-38); vai trò IT có cả quyền Admin và thêm dashboard IT; Admin không vào được dashboard IT (D-51). Khách không tự đổi được vai trò; vai trò cấp bằng tay trong Supabase `[DERIVED]`.

### 3.2 Ma trận quyền

| Actor | Đối tượng | Tạo | Xem | Sửa | Xóa/Hủy |
|---|---|:-:|:-:|:-:|:-:|
| Khách vãng lai | Sản phẩm | – | ✓ | – | – |
| Khách vãng lai | Giỏ hàng (lưu trình duyệt) | ✓ | ✓ | ✓ | ✓ (D-59) |
| Khách hàng | Giỏ hàng của mình (lưu server) | ✓ | ✓ | ✓ | ✓ |
| Khách hàng | Đơn của mình | ✓ | ✓ | – | Hủy trước SHIPPED |
| Khách hàng | Lời chúc của đơn mình | ✓ | ✓ | Theo BR-MSG-001/008 | `[BA DECISION REQUIRED]` |
| Khách hàng | Yêu cầu đổi trả | ✓ | ✓ | – | – |
| Khách hàng | Lịch sử chat của mình | (tự sinh) | ✓ | – | `[LEGAL]` I-15 |
| Người nhận | Lời chúc (qua token QR) | – | ✓ | – | – |
| Admin | Sản phẩm, lô, FAQ, coupon | ✓ | ✓ | ✓ | ✓ |
| Admin | Đơn hàng | – | ✓ | Trạng thái | Hủy |
| IT | Mọi quyền của Admin | ✓ | ✓ | ✓ | ✓ |
| IT | Sức khoẻ hệ thống, số liệu API, lỗi 5xx | – | ✓ | – | – |
| IT | Chế độ bảo trì | – | ✓ | Bật/tắt | – |
| Admin | Lời chúc của khách | – | `[BA DECISION REQUIRED]` Q-14 | – | – |
| Mây | Sản phẩm, FAQ, chính sách | – | ✓ | – | – |
| Mây | Đơn hàng | – | Chỉ đơn đã xác thực (BR-AI-002) | – | – |

---

## 4. Mục tiêu kinh doanh

| ID | Mục tiêu | Ghi chú |
|---|---|---|
| BG-01 | Bán đèn trực tuyến cho khách lẻ trong nước | D-33 |
| BG-02 | Khác biệt hóa bằng trải nghiệm quà tặng kể chuyện (lời chúc + QR) | C-03…C-09 |
| BG-03 | Giảm tải hỗ trợ khách bằng AI Mây (FAQ, tra đơn) | D-15 |
| BG-04 | Thu hút khách qua tìm kiếm tự nhiên và đo lường hành vi | D-05 |
| BG-05 | Phục vụ người đọc tiếng Anh, tiếng Trung tại Việt Nam | FR-I18N-001, D-32 |

Không có chỉ số mục tiêu (KPI) định lượng — `[BA DECISION REQUIRED]` nếu cần.

---

## 5. Yêu cầu chức năng

### 5.1 Catalog
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-CAT-001 | Hiển thị danh sách và chi tiết sản phẩm | C-01 |
| FR-CAT-002 | Bán bộ Sum Vầy và bán lẻ từng đèn thuộc bộ | D-08 |
| FR-CAT-003 | Hiển thị giá chưa VAT kèm chú thích | D-03 |
| FR-CAT-004 | Admin quản lý sản phẩm (tạo, sửa, ẩn) và nội dung 3 ngôn ngữ | `[DERIVED]` |

### 5.2 Tài khoản
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-ACC-001 | Đăng ký, đăng nhập, đăng xuất, quên mật khẩu — bằng **email + mật khẩu** | D-36, D-42 |
| FR-ACC-002 | Xem danh sách và chi tiết đơn của mình, gồm công đoạn hiện tại | C-11 |
| FR-ACC-003 | Soạn, sửa lời chúc của đơn trong dashboard | C-08, D-13 |
| FR-ACC-004 | Xem lịch sử chat với Mây | D-19 |

**Quy tắc tài khoản (v0.2)**

- Đăng nhập bằng email + mật khẩu (D-42). SĐT không dùng để đăng nhập; chỉ lưu trong hồ sơ, không bắt buộc (D-42).
- Hồ sơ gồm: họ tên (bắt buộc, ≤100 ký tự), SĐT, ngôn ngữ ưa thích (vi/en/zh), vai trò (D-38).
- Mật khẩu 8–72 ký tự và không quá 72 byte UTF-8 (giới hạn của Supabase) `[ASSUMPTION]`.
- SĐT hồ sơ phải là số di động Việt Nam (0/+84, đầu số 3/5/7/8/9), lưu dạng `0xxxxxxxxx` `[ASSUMPTION]`.
- Ngôn ngữ ưa thích mặc định = ngôn ngữ giao diện lúc đăng ký `[ASSUMPTION]`.
- **Không xác nhận email** khi đăng ký: tài khoản dùng được ngay, web tự đăng nhập sau khi đăng ký `[CONFIRMED]` D-63. Server tạo user đã xác nhận qua admin API nên không phụ thuộc cài đặt "Confirm email" của Supabase và không gửi thư.
- "Quên mật khẩu" luôn trả cùng một thông báo, không tiết lộ email có đăng ký hay không, kể cả khi Supabase giới hạn gửi thư `[DERIVED]` (NFR-SEC).
- Đăng ký bằng email đã tồn tại → báo "Email này đã được đăng ký" `[ASSUMPTION]` — chờ Q-35. Đăng ký lại email đã có không ghi đè hồ sơ đã có `[DERIVED]`.
- Lỗi mạng khi làm mới phiên không đăng xuất khách; chỉ đăng xuất khi phiên bị máy chủ từ chối `[DERIVED]`.
- Đăng xuất vô hiệu mọi phiên của tài khoản trên mọi thiết bị; đặt lại mật khẩu xong phải đăng nhập lại `[ASSUMPTION]`.
- Trang đăng nhập/đăng ký/quên mật khẩu/tài khoản đặt `noindex` `[DERIVED]` BR-SEO-001.

**Dashboard tài khoản (v0.12)**

- Trang `/account` là dashboard dạng ứng dụng: **không** có header/footer của trang giới thiệu; thanh bên (logo về trang chủ, đổi ngôn ngữ, tên + email, tab dọc, về cửa hàng, giỏ hàng, đăng xuất). Màn ≤960px: tab chuyển thành thanh ngang dính đầu trang `[CONFIRMED]` D-64.
- 4 tab: Tổng quan, Đơn hàng, Trò chuyện với Mây, Hồ sơ. Tab đang mở lưu ở `?tab=` (`orders`, `may`, `profile`; không có hoặc sai → Tổng quan) để tải lại, chia sẻ link và nút Back giữ đúng tab; điều hướng bàn phím theo WAI-ARIA tabs `[ASSUMPTION]`.
- Tổng quan: số liệu nhanh (số sản phẩm và tạm tính của giỏ — có chú thích chưa gồm VAT theo BR-PRC-003; đơn hàng; số câu đã hỏi Mây), 2 tin chat gần nhất, tóm tắt hồ sơ `[ASSUMPTION]`.
- Khi chưa có đơn hàng (FR-ACC-002 chưa làm), tab đơn hàng chỉ báo "sắp ra mắt" và liệt kê những gì sẽ có (công đoạn, lời chúc, mã vận đơn — FR-ACC-002/003, D-41); **không** hiển thị đơn mẫu `[ASSUMPTION]`. Câu "soạn và sửa lời chúc" chưa nói thời hạn vì còn chờ Q-08.
- Giao diện dashboard: kính mờ, nền dải mây khói lơ lửng, đèn trời bay lên một lượt mỗi khi vào trang; có **giao diện tối** `[CONFIRMED]` D-65. Giao diện tối chỉ áp dụng cho dashboard tài khoản (trang công khai giữ giao diện sáng), mặc định theo cài đặt thiết bị, lựa chọn lưu trên trình duyệt (không lưu vào hồ sơ) `[ASSUMPTION]`. Bật giảm chuyển động → không có đèn bay, khói đứng yên `[DERIVED]` NFR-A11Y-001.
- Nền và cảnh đầu trang dashboard dùng **ảnh thật** (trời sương, trời đêm đầy đèn trời, khói, đèn trời tách nền) giấy phép CC0 tìm qua Openverse — danh sách ở `public/images/dash/CREDITS.md`; không dùng Canva vì giấy phép Canva không cho dùng riêng lẻ phần tử ngoài thiết kế Canva `[ASSUMPTION]`. Ảnh là nền không khí, không phải ảnh sản phẩm.
- Dashboard trên điện thoại (≤640px): các tab là thanh điều hướng cố định ở đáy màn hình `[ASSUMPTION]`.
- Tab đơn hàng có phần minh hoạ 4 công đoạn (C-11), dùng lại câu chữ đã duyệt ở trang chủ (`process.*`); chỉ minh hoạ, không gắn với đơn nào `[ASSUMPTION]`.
- Lịch sử chat Mây chia theo ngày, kèm giờ từng tin, theo giờ Việt Nam (Asia/Ho_Chi_Minh) `[ASSUMPTION]`; "số câu đã hỏi Mây" chỉ đếm tin của khách trong 100 tin gần nhất mà API trả về `[ASSUMPTION]`.

### 5.2a Dashboard IT (v0.5)

| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-IT-001 | Vai trò IT truy cập `/it`; có cả quyền Admin | D-51 |
| FR-IT-002 | Sức khoẻ hệ thống: DB, Auth, Storage (kết nối được không, độ trễ); payOS, OpenAI (đã cấu hình chưa — không hiển thị khoá); thông tin máy chủ (phiên bản, uptime, bộ nhớ) | D-52 |
| FR-IT-003 | Số liệu API theo endpoint trong 1 giờ / 24 giờ / 7 ngày: số request, 4xx, 5xx, tỷ lệ lỗi 5xx, độ trễ p50/p95/max; lỗi 5xx gần đây | D-52 |
| FR-IT-004 | Bật/tắt chế độ bảo trì | D-52, D-54 |

**Quy tắc (v0.5)**

- Số liệu API lưu ở Supabase (D-53), gộp theo phút × method × endpoint × mã HTTP; endpoint ghi theo mẫu (vd `/api/products/:slug`), không ghi query string, body, token `[DERIVED]` NFR-PRV. Giữ 30 ngày `[ASSUMPTION]`. p50/p95 là ước lượng theo mốc 50/100/250/500/1000/2500 ms `[ASSUMPTION]`.
- Lỗi 5xx gần đây lưu thời điểm, endpoint, đường dẫn, mã, mã lỗi, thông điệp nội bộ (cắt 300 ký tự) — chỉ IT xem `[ASSUMPTION]`. Thông điệp nội bộ có thể chứa chi tiết DB; cần rà soát nếu `[LEGAL]` yêu cầu (G-28).
- Đường dẫn API không thuộc nhóm đã biết được gộp chung một nhãn `/api/*` để không lưu giá trị tuỳ ý từ URL `[DERIVED]`.
- Ghi số liệu vào DB lỗi → bỏ số liệu của lượt đó (mất tối đa 1 phút), không ảnh hưởng request của khách `[ASSUMPTION]`.
- Dashboard tự làm mới mỗi 30 giây; giao diện chỉ tiếng Việt (như admin, D-48) `[ASSUMPTION]`.
- Chế độ bảo trì (D-54): trang công khai trả HTTP 503 + trang bảo trì (3 ngôn ngữ) + `Retry-After`; API ghi (POST/PUT/PATCH/DELETE) trả 503 `MAINTENANCE`, trừ đăng nhập/làm mới phiên/đăng xuất và API IT; API đọc vẫn chạy; `/login`, `/admin`, `/it` vẫn vào được `[ASSUMPTION]` (để IT vào tắt bảo trì). Không đọc được cài đặt → coi như tắt (không chặn web), kể cả khi trước đó đang bật `[ASSUMPTION]`. Nhiều server đồng bộ trạng thái trong ≤15 giây `[ASSUMPTION]`.

### 5.3 Giỏ hàng & checkout
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-CART-001 | Thêm, sửa số lượng, xóa sản phẩm trong giỏ | `[DERIVED]` |
| FR-CHK-001 | Checkout chỉ cho khách đã đăng nhập | D-36 |
| FR-CHK-002 | Chọn loại đơn: Mua tặng / Mua cho mình | C-02 |
| FR-CHK-003 | Với đơn Mua cho mình: ô "Thêm lời chúc" | D-14 |
| FR-CHK-004 | Chọn người nhận hàng = bản thân / người khác; nhập địa chỉ + SĐT tương ứng | D-02 |
| FR-CHK-005 | Chọn ngôn ngữ trang QR cho người nhận (vi/en/zh-Hans) | D-24 |
| FR-CHK-006 | Nhập mã coupon | D-21 |
| FR-CHK-007 | Chọn phương thức thanh toán: payOS / COD | D-35 |
| FR-CHK-008 | Hiển thị bảng giá cuối: tạm tính, giảm giá, phí ship, VAT, tổng | D-03 |

### 5.4 Thanh toán & đơn hàng
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-PAY-001 | Thanh toán qua payOS, xác nhận bằng webhook | D-35 |
| FR-PAY-002 | Thanh toán COD | D-35 |
| FR-ORD-001 | Khách hủy đơn khi trạng thái trước SHIPPED | D-06 |
| FR-ORD-002 | Admin cập nhật trạng thái đơn và công đoạn | `[DERIVED]` từ C-11, D-34 |
| FR-RET-001 | Khách gửi yêu cầu đổi trả kèm video khui hàng | D-07 |
| FR-RET-002 | Admin duyệt/từ chối yêu cầu đổi trả | `[DERIVED]` |

### 5.5 Lời chúc & QR
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-MSG-001 | Lời chúc gồm chữ và/hoặc giọng nói và/hoặc video | C-06 |
| FR-QR-001 | Mỗi đơn có thiệp cảm ơn in Anh–Việt kèm QR đơn hàng | D-28 |
| FR-QR-002 | Trang QR lời chúc private, truy cập bằng token | D-09, I-01 |
| FR-QR-003 | Người nhận bấm "Tôi đã nhận được quà" trước khi xem lời chúc | D-26, I-19 `[CONFIRMED]` D-41 |
| FR-QR-004 | Nút "Tải về" cho giọng nói/video trước khi bị xóa | D-09 |
| FR-QR-005 | Nút "Dịch tự động" cho lời chúc chữ | D-27 |
| FR-QR-006 | Trang QR đèn hiển thị video của lô, lưu vĩnh viễn | D-01, D-10 |
| FR-QR-007 | Admin quản lý lô và video lô | `[DERIVED]` |

### 5.6 AI Mây
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-AI-001 | Mascot Mây dạng nhân vật, chat bằng chữ | D-15 |
| FR-AI-002 | Tự bật tour dẫn khám phá web | D-30 |
| FR-AI-003 | Trả lời FAQ và thông tin sản phẩm từ DB | D-16 |
| FR-AI-004 | Tra tình trạng đơn | D-15, D-29 |
| FR-AI-005 | Thông báo lỗi theo phong cách Mây khi API lỗi / hết hạn mức | D-20, D-31 |
| FR-AI-006 | Lưu lịch sử chat của người đã đăng nhập | D-19 |
| FR-AI-007 | Admin cấu hình hạn mức và ngân sách | D-31 |

### 5.7 Coupon
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-CPN-001 | Admin tạo, sửa, tắt coupon | D-21 |
| FR-CPN-002 | Hệ thống kiểm tra hợp lệ coupon khi áp dụng và khi đặt hàng | `[DERIVED]` |

### 5.8 Nền tảng
| ID | Yêu cầu | Nguồn |
|---|---|---|
| FR-I18N-001 | Giao diện và nội dung ở vi / en / zh-Hans | D-23 |
| FR-SEO-001 | Tối ưu SEO cho các trang công khai | D-05 |
| FR-GA-001 | Tích hợp Google Analytics | D-05 |

---

## 6. Yêu cầu phi chức năng

Không có chỉ số định lượng nào được cung cấp; các ô "Mục tiêu" để trống là `[BA DECISION REQUIRED]`.

| ID | Nhóm | Yêu cầu | Mục tiêu |
|---|---|---|---|
| NFR-SEC-001 | Bảo mật | Token QR lời chúc ngẫu nhiên, không đoán được, không chứa dữ liệu cá nhân dạng đọc được | Độ dài/entropy do tech lead chốt |
| NFR-SEC-002 | Bảo mật | Webhook payOS phải được xác minh chữ ký trước khi xử lý | — |
| NFR-SEC-003 | Bảo mật | Quyền truy cập dữ liệu của Mây do backend kiểm tra, không dựa vào prompt | — |
| NFR-PRV-001 | Riêng tư | Chỉ gửi sang OpenAI các trường cần thiết; không gửi địa chỉ, SĐT | I-14 `[CONFIRMED]` D-67 |
| NFR-PRV-002 | Riêng tư | Token QR và dữ liệu cá nhân không được gửi tới Google Analytics | — |
| NFR-PRV-003 | Riêng tư | Xóa giọng nói/video là xóa thật, gồm bản sao lưu và cache CDN | Thời gian xóa khỏi backup `[BA DECISION REQUIRED]` |
| NFR-AUD-001 | Kiểm toán | Ghi log thay đổi trạng thái đơn, coupon, hoàn tiền (ai, khi nào, giá trị cũ/mới) | — |
| NFR-A11Y-001 | Tiếp cận | Tour Mây tắt được; tôn trọng `prefers-reduced-motion` | — (trang công khai đã áp dụng cho mọi hiệu ứng từ v0.6, §31.4) |
| NFR-L10N-001 | Bản địa hóa | Thiếu bản dịch thì hiển thị tiếng Việt `[CONFIRMED]` D-41 | — |
| NFR-PERF-001 | Hiệu năng | Thời gian tải trang, thời gian phản hồi Mây | `[BA DECISION REQUIRED]` — trang công khai tạm dùng ngưỡng nội bộ ở §31.4 `[ASSUMPTION]` |
| NFR-AVL-001 | Sẵn sàng | Mây lỗi không được chặn duyệt web, giỏ hàng, checkout | — |
| NFR-OBS-001 | Quan sát | Theo dõi lỗi webhook, lỗi OpenAI, chi phí OpenAI theo ngày. v0.5: dashboard IT có số liệu API (request, lỗi, độ trễ theo endpoint) và lỗi 5xx gần đây; webhook/OpenAI chưa có vì chưa tích hợp (G-26) | — |

---

## 7. Mô hình miền

| Thực thể | Mục đích | Thuộc tính chính | Quan hệ | Vòng đời |
|---|---|---|---|---|
| User | Tài khoản khách/admin | email/SĐT, vai trò, ngôn ngữ ưa thích | 1-n Order, 1-n ChatSession | Active / bị khóa |
| Product | Mẫu đèn hoặc bộ | tên, mô tả (×3 ngôn ngữ), giá chưa VAT, trạng thái hiển thị, loại (đơn lẻ / bộ) | Bộ gồm n Product thành phần | Draft → Published → Hidden `[CONFIRMED]` D-41 |
| Cart / CartItem | Giỏ của user | product, số lượng | 1 User – 1 Cart | — |
| Order | Đơn hàng | mã đơn, loại đơn (tặng/tự mua), người nhận, địa chỉ, SĐT, ngôn ngữ QR, phương thức TT, snapshot giá, coupon, trạng thái, công đoạn | 1-n OrderItem, 0-1 GiftMessage, 1-n Payment, 0-n ReturnRequest | §16 |
| OrderItem | Dòng hàng | product, SL, đơn giá snapshot, giảm giá phân bổ, batch | n-1 Batch | — |
| GiftMessage | Lời chúc | text, audio?, video?, token QR, thời điểm xác nhận nhận quà, thời điểm hết hạn media, bản dịch cache | 1-1 Order | §21 |
| Batch | Lô sản xuất | mã lô, video, mã QR đèn | 1-n OrderItem | Created → Video published |
| Payment | Giao dịch | phương thức, số tiền, mã giao dịch payOS, trạng thái | n-1 Order | §15 |
| Coupon | Mã giảm giá | mã, loại, giá trị, thời gian hiệu lực, giới hạn | n-n Order (qua CouponRedemption) | Draft → Active → Inactive/Expired |
| ReturnRequest | Yêu cầu đổi trả | lý do, video khui hàng, dòng hàng, kết quả | n-1 Order | §18 |
| ChatSession / ChatMessage | Hội thoại với Mây | user (nếu có), nội dung, thời điểm | n-1 User | Lưu vĩnh viễn nếu có user (D-19) |
| FaqEntry | Nội dung FAQ | câu hỏi, trả lời ×3 ngôn ngữ | — | Mây đọc từ đây |
| MayConfig | Cấu hình Mây | hạn mức, ngân sách tháng, câu thông báo lỗi | — | — |

---

## 8. Quy trình nghiệp vụ chính

| ID | Quy trình | Mục |
|---|---|---|
| BP-01 | Duyệt web → giỏ hàng → checkout → thanh toán | §11–15 |
| BP-02 | Soạn/sửa lời chúc | §21 |
| BP-03 | Người nhận quét QR thiệp → xác nhận nhận quà → xem lời chúc | §21 |
| BP-04 | Quét QR đèn → xem video lô | §21 |
| BP-05 | Hủy đơn | §16 |
| BP-06 | Đổi trả | §18 |
| BP-07 | Chat với Mây / tour / tra đơn | §22 |
| BP-08 | Admin quản lý coupon | §14 |

---

## 9. Sản phẩm & catalog

- Có 3 sản phẩm hiện tại: Đèn Nguyệt (890.000₫), Đèn Vọng (1.050.000₫), bộ Đèn Sum Vầy — 3 kích cỡ (1.680.000₫). `[CONFIRMED]` từ UI hiện có, **giá chưa VAT** (D-03).
- Bộ Sum Vầy bán nguyên bộ hoặc lẻ từng đèn (D-08).
  - `[BA DECISION REQUIRED]` Q-05: ba đèn trong bộ là sản phẩm riêng nào, giá lẻ từng đèn bao nhiêu?
  - `[BA DECISION REQUIRED]` Q-06: trả lại một đèn trong bộ thì hoàn bao nhiêu (giá lẻ hay giá phân bổ từ giá bộ)?
- Nội dung sản phẩm (tên, mô tả, ảnh alt) có ở 3 ngôn ngữ.
- Trạng thái hiển thị: Draft / Published / Hidden `[CONFIRMED]` D-39. Chỉ Published được hiển thị và bán; Draft/Hidden trả "không tìm thấy" với khách và không được Mây giới thiệu.
- Admin tạo/sửa/ẩn/xoá sản phẩm tại `/admin` (FR-CAT-004). Sản phẩm mới mặc định là Draft `[ASSUMPTION]`. Tên tiếng Việt bắt buộc; slug gồm chữ thường không dấu, số, gạch nối; giá là số nguyên VND ≥ 0 `[ASSUMPTION]`.
- Xoá sản phẩm được phép (§3.2). Khi đã có đơn hàng, sản phẩm đã bán phải chuyển Hidden thay vì xoá `[ASSUMPTION]`.
- Tài khoản admin do người quản trị hệ thống cấp bằng cách đặt `role = 'admin'` trong bảng `profiles` của Supabase; web chưa có màn hình cấp quyền `[ASSUMPTION]`.
- Thẻ sản phẩm có nút thêm vào giỏ ("Tặng ngay" khi chọn Mua tặng, "Thêm vào giỏ" khi chọn Mua cho mình — cả hai chỉ thêm vào giỏ; loại đơn chọn ở checkout, FR-CHK-002) `[ASSUMPTION]`; tên sản phẩm dẫn tới trang chi tiết. Trang chi tiết có chọn số lượng + "Thêm vào giỏ".
- Bộ Sum Vầy chỉ thêm vào giỏ nguyên bộ; bán lẻ từng đèn chờ Q-05 (FR-CAT-002).

## 10. Tồn kho

Vận hành xưởng ngoài phạm vi (D-34). Ở tầng web chỉ cần một quyết định:

- `[BA DECISION REQUIRED]` Q-07: web có giới hạn số lượng đặt hoặc có trạng thái "tạm hết hàng" không? Nếu **không**, web coi mọi sản phẩm Published là luôn đặt được `[CONFIRMED]` D-41, và admin tạm ẩn sản phẩm khi cần.

## 11. Giỏ hàng

| Chủ đề | Quy tắc |
|---|---|
| Ai có giỏ | Khách vãng lai thêm vào giỏ được; giỏ lưu trình duyệt (chỉ mã sản phẩm + số lượng). Khi đăng nhập, gộp vào giỏ tài khoản: cộng số lượng (tối đa 10), bỏ sản phẩm không còn bán, xoá bản trình duyệt `[CONFIRMED]` D-59 |
| Giá trong giỏ | Luôn hiển thị **giá hiện hành**; giá được chốt (snapshot) tại thời điểm tạo đơn `[CONFIRMED]` D-41 |
| Sản phẩm bị ẩn khi đang trong giỏ | Hiện cảnh báo, không cho checkout dòng đó `[CONFIRMED]` D-41 |
| Số lượng tối đa mỗi dòng | **10** `[CONFIRMED]` D-60. Tối đa 50 dòng mỗi giỏ `[ASSUMPTION]` |
| Lưu giỏ | Giỏ của user đã đăng nhập lưu trên server, đồng bộ giữa các thiết bị `[CONFIRMED]` D-41 |
| Giá giỏ của vãng lai | Server tính lại từ mã sản phẩm + số lượng; không nhận giá từ trình duyệt `[DERIVED]` §12 |
| Tạm tính | Σ(giá hiện hành chưa VAT × số lượng) của dòng còn bán; ghi "Phí vận chuyển và VAT được tính ở bước thanh toán" (chờ Q-09, Q-11) `[ASSUMPTION]` |
| Nút Thanh toán (chưa có checkout) | Chưa đăng nhập → đăng nhập rồi quay lại giỏ, giỏ còn nguyên (US-001 AC-003); đã đăng nhập → báo "Thanh toán trực tuyến sẽ sớm ra mắt" `[CONFIRMED]` D-61 |
| Trang giỏ | `noindex` (BR-SEO-001); không SSR nội dung (phụ thuộc trình duyệt/phiên) `[DERIVED]` D-49 |
| Bảo trì (D-54) | Thêm/sửa/xoá giỏ trả 503; xem giỏ và tính giá giỏ vãng lai vẫn chạy `[ASSUMPTION]` . Người đã đăng nhập còn giỏ trình duyệt: gộp bị 503 thì vẫn hiện giỏ tài khoản, giữ giỏ trình duyệt để gộp lần sau `[ASSUMPTION]` |
| Sản phẩm nháp / ẩn trong giỏ vãng lai | Sản phẩm nháp bị bỏ khỏi giỏ (coi như không tồn tại, D-39); sản phẩm đã ẩn hiện "Sản phẩm không còn bán" **không kèm tên/ảnh** `[ASSUMPTION]` |
| Thêm sản phẩm không bán vào giỏ tài khoản | Sản phẩm không tồn tại, nháp hoặc đã ẩn mà chưa có trong giỏ → cùng lỗi 404 "không còn bán" (không dò được mã sản phẩm nháp); đã có trong giỏ thì chỉ được giảm/xoá `[ASSUMPTION]` |
| Giỏ trình duyệt quá dài | Trình duyệt gộp dòng trùng, tối đa 10 mỗi dòng, giữ 50 dòng đầu; phần thừa bị bỏ `[ASSUMPTION]` |

## 12. Checkout

```text
Giỏ hàng
→ Đăng nhập (bắt buộc)
→ Loại đơn (Tặng / Tự mua [+ ô Thêm lời chúc])
→ Người nhận hàng (Bản thân / Người khác) + địa chỉ + SĐT
→ Ngôn ngữ trang QR
→ Coupon (tùy chọn)
→ Tính giá
→ Phương thức thanh toán (payOS / COD)
→ Tạo đơn
→ Thanh toán (payOS) / Xác nhận (COD)
→ Trang cảm ơn → Soạn lời chúc (nếu có)
```

| Bước | Đầu vào | Kiểm tra | Lỗi |
|---|---|---|---|
| Đăng nhập | Phiên | Có phiên hợp lệ | Chuyển tới đăng nhập, quay lại checkout |
| Loại đơn | tặng / tự mua, cờ lời chúc | — | — |
| Người nhận | tên, SĐT, địa chỉ VN | SĐT hợp lệ định dạng VN; địa chỉ trong VN (D-32) | Báo lỗi tại trường |
| Ngôn ngữ QR | vi/en/zh-Hans | Chỉ hiện khi đơn có lời chúc `[CONFIRMED]` D-41 | — |
| Coupon | mã | BR-CPN-* | Báo lý do không hợp lệ |
| Tính giá | giỏ, coupon, người nhận | Tính lại phía server; không tin giá từ trình duyệt | — |
| Thanh toán | payOS / COD | BR-PAY-004 (COD và đơn giao người khác) | — |
| Tạo đơn | toàn bộ trên | Kiểm tra lại giá, coupon, trạng thái sản phẩm ngay lúc tạo | Nếu giá/coupon đổi: hiện bảng giá mới, yêu cầu xác nhận lại `[CONFIRMED]` D-41 |

**Thời điểm soạn lời chúc** `[BA DECISION REQUIRED]` Q-08: bắt buộc soạn trong checkout, hay cho soạn sau trong dashboard (đến hạn khóa BR-MSG-001/008)? Nếu đến lúc khóa mà chưa soạn thì sao?

## 13. Tính giá

```text
Tạm tính          = Σ (đơn giá chưa VAT × số lượng)
− Giảm giá coupon  (áp trước hay sau VAT: Q-10)
+ Phí vận chuyển   (Q-11)
+ VAT              (thuế suất: Q-09)
= Tổng thanh toán
```

| Chủ đề | Quy tắc |
|---|---|
| Tiền tệ | VND, số nguyên đồng (D-32) |
| Làm tròn | `[BA DECISION REQUIRED]` làm tròn VAT theo dòng hay theo tổng đơn |
| Hiển thị giá chưa VAT | `[LEGAL]` I-04: xác nhận quy định niêm yết giá bán lẻ; nếu được phép, mọi nơi hiện giá phải có chú thích "chưa gồm VAT" |
| Phí vận chuyển | `[BA DECISION REQUIRED]` Q-11: cố định, theo vùng, hay miễn phí từ mức nào? Web cần công thức để tính trước khi thanh toán |
| Giá thiệp/lời chúc | `[BA DECISION REQUIRED]` Q-12: miễn phí hay tính phí? |

## 14. Coupon

Coupon được đưa vào phạm vi (D-21, thay D-04). Admin quản lý toàn bộ.

**Quy tắc hợp lệ tối thiểu** `[DERIVED]`:

```text
Coupon C hợp lệ cho đơn O khi:
  C.status = ACTIVE
  AND C.starts_at ≤ now < C.ends_at
  AND (C.usage_limit rỗng OR C.used_count < C.usage_limit)
  AND (C.per_user_limit rỗng OR số lần user đã dùng < C.per_user_limit)
  AND (C.min_order rỗng OR tạm_tính(O) ≥ C.min_order)
```

Các thuộc tính sau cần PO chốt trước khi thiết kế data model:

| # | Câu hỏi | Trạng thái |
|---|---|---|
| C-1 | Loại: giảm %, giảm số tiền, miễn phí ship? | `[BA DECISION REQUIRED]` |
| C-2 | Giảm trước VAT hay sau VAT? | `[BA DECISION REQUIRED]` + `[LEGAL]` |
| C-3 | Phạm vi: toàn đơn / sản phẩm cụ thể / có áp vào phí ship? | `[BA DECISION REQUIRED]` |
| C-4 | Mỗi đơn dùng tối đa mấy coupon? | **1** `[CONFIRMED]` D-41 |
| C-5 | Giới hạn tổng và giới hạn mỗi user? | `[BA DECISION REQUIRED]` (vì bắt buộc tài khoản, đếm theo user là khả thi) |
| C-6 | Có mức giảm tối đa (cho loại %)? | `[BA DECISION REQUIRED]` |
| C-8 | Hủy đơn có trả lại lượt dùng? Đổi trả một phần thì phân bổ giảm giá thế nào? | `[BA DECISION REQUIRED]` |
| C-9 | Sửa/tắt coupon đang chạy ảnh hưởng đơn đang checkout thế nào? | Đề xuất: kiểm tra lại lúc tạo đơn (BR-CPN-002) `[CONFIRMED]` D-41 |
| C-10 | Mây có được nhắc tới coupon không? | Đề xuất: **không** `[CONFIRMED]` D-41 (BR-AI-005) |

**Thời điểm tính là đã dùng coupon** `[CONFIRMED]` D-41: khi đơn được tạo thành công. Đơn payOS hết hạn thanh toán thì trả lại lượt dùng.

## 15. Thanh toán

Phương thức: **payOS** hoặc **COD** (D-35). `[CONFIRMED]` D-41 khách được chọn một trong hai ở mỗi đơn.

### 15.1 payOS

```text
Payment: PENDING → PAID
                 → EXPIRED   (quá hạn link thanh toán)
                 → CANCELLED (khách hủy trên trang payOS / hủy đơn)
PAID → REFUND_PENDING → REFUNDED
```

| Chủ đề | Quy tắc |
|---|---|
| Nguồn sự thật | **Webhook payOS (đã xác minh chữ ký)** là nguồn duy nhất để chuyển đơn sang CONFIRMED. Trang return URL chỉ để hiển thị, không cập nhật trạng thái. |
| Webhook trùng | Xử lý idempotent theo mã giao dịch; lần hai không đổi gì |
| Webhook đến chậm | Trang cảm ơn hiện "Đang chờ xác nhận thanh toán"; backend chủ động hỏi trạng thái payOS nếu quá thời gian `[CONFIRMED]` D-41 |
| Hạn link thanh toán | `[BA DECISION REQUIRED]` Q-15 (ví dụ 15 phút?). Hết hạn → đơn CANCELLED, trả lượt coupon |
| Thanh toán sau khi đơn đã hết hạn/hủy | Ghi nhận PAID, gắn cờ cho admin **hoàn tiền thủ công** `[CONFIRMED]` D-41 |
| Số tiền nhận khác số tiền đơn | Không xác nhận đơn, gắn cờ cho admin `[CONFIRMED]` D-41 |
| Hoàn tiền | `[BA DECISION REQUIRED]` Q-16: hoàn tự động qua payOS hay admin chuyển khoản thủ công rồi ghi nhận trên web? |

Chi tiết API (tên trạng thái, cơ chế chữ ký, hạn link) theo tài liệu payOS — tech lead xác nhận.

### 15.2 COD

| Chủ đề | Quy tắc |
|---|---|
| Xác nhận đơn | Đơn COD chuyển CONFIRMED ngay khi tạo `[CONFIRMED]` D-41 |
| Ghi nhận thu tiền | Admin đánh dấu "Đã thu COD" khi giao thành công |
| Giao thất bại / từ chối nhận | Admin chuyển đơn sang DELIVERY_FAILED `[CONFIRMED]` D-41 — xử lý tiếp là vận hành |
| COD + giao cho người khác (quà) | **Chặn COD** khi người nhận là người khác (BR-PAY-004) `[CONFIRMED]` D-41 |
| Giới hạn giá trị COD | `[BA DECISION REQUIRED]` |

## 16. Vòng đời đơn hàng

Trạng thái đề xuất `[CONFIRMED]` D-41, suy ra từ C-11 (4 công đoạn), D-06, D-13, I-10:

```text
PENDING_PAYMENT ──(webhook PAID)──▶ CONFIRMED
      │                                 │
      │(hết hạn / khách hủy)            ▼
      ▼                           IN_PRODUCTION  (công đoạn 1–4 hiển thị cho khách)
  CANCELLED ◀──(khách/admin hủy)────────┤
      ▲                                 ▼
      └─────────(khách/admin hủy)─── PACKED
                                        │
                                        ▼
                                     SHIPPED ──▶ DELIVERED ──▶ (đổi trả §18)
                                        │
                                        ▼
                                  DELIVERY_FAILED
```

Đơn COD bỏ qua PENDING_PAYMENT.

| Trạng thái | Ý nghĩa | Ai chuyển sang | Hệ quả |
|---|---|---|---|
| PENDING_PAYMENT | Đơn payOS chờ thanh toán | Hệ thống | Giữ lượt coupon |
| CONFIRMED | Đã thanh toán (payOS) hoặc đơn COD đã tạo | Webhook / Hệ thống | Thông báo khách |
| IN_PRODUCTION | Đang làm; kèm công đoạn 1–4 | Admin | Khách thấy công đoạn |
| PACKED | Đã đóng gói, thiệp đã viết | Admin | Khóa phần chữ lời chúc (BR-MSG-008, D-41) |
| SHIPPED | Đã giao cho hãng vận chuyển | Admin | **Khóa toàn bộ lời chúc** (D-13); **hết quyền hủy** (D-06) |
| DELIVERED | Giao thành công | Admin `[CONFIRMED]` D-41 | Mốc bắt đầu thời hạn đổi trả? (Q-19) |
| DELIVERY_FAILED | Giao thất bại | Admin | — |
| CANCELLED | Đã hủy | Khách (trước SHIPPED) / Admin / Hệ thống | Hoàn tiền nếu đã trả (payOS); trả lượt coupon (C-8) |

Lưu ý: **nút "Tôi đã nhận được quà" trên trang QR không đổi trạng thái đơn** `[CONFIRMED]` D-41 — tránh hai nguồn sự thật cho DELIVERED (xem I-19a, Q-18).

`[BA DECISION REQUIRED]` Q-20: hủy đơn đã thanh toán ở IN_PRODUCTION/PACKED có hoàn 100% không?

## 17. Vận chuyển (phần web)

- Chỉ giao trong Việt Nam (D-32). Form địa chỉ theo cấu trúc tỉnh/quận/phường VN `[CONFIRMED]` D-41.
- Người nhận = bản thân hoặc người khác (D-02). Đơn giao người khác: **không in giá trong kiện** `[BA DECISION REQUIRED]` Q-21 — việc in là vận hành, nhưng web có thể cần tạo phiếu không giá.
- Mã vận đơn: admin nhập tay, khách xem trong dashboard `[CONFIRMED]` D-41.
- Phí ship: Q-11.

## 18. Đổi trả & hoàn tiền

```text
Khách gửi yêu cầu (dashboard) + video khui hàng
→ Admin xem xét
→ Chấp nhận / Từ chối (kèm lý do)
→ (vận hành xử lý hàng)
→ Hoàn tiền / Làm lại → admin ghi nhận kết quả trên web
```

| Chủ đề | Quy tắc |
|---|---|
| Điều kiện bắt buộc | Video quay liên tục từ lúc khui hàng (D-07) |
| Ai gửi yêu cầu | Người mua, qua dashboard (vì đơn gắn với tài khoản) `[CONFIRMED]` D-41. Người nhận quà (không có tài khoản) nhờ người mua gửi. |
| Hướng dẫn quay video | Phải hiện ở trang QR và thiệp cảm ơn `[CONFIRMED]` D-41 I-05 — người nhận quà mới là người khui hàng |
| Thời hạn gửi yêu cầu | `[BA DECISION REQUIRED]` Q-19 (bao nhiêu ngày, tính từ DELIVERED?) |
| Lý do chấp nhận | `[BA DECISION REQUIRED]` Q-22 (vỡ, sai hàng, lỗi; có nhận đổi ý với hàng cá nhân hóa?) |
| Kết quả | `[BA DECISION REQUIRED]` Q-22: hoàn tiền / làm lại |
| Trả một phần | Được theo dòng hàng; số tiền hoàn phụ thuộc Q-06, C-8 |
| Dung lượng / định dạng video tải lên | `[BA DECISION REQUIRED]` |

## 19. Đánh giá

Ngoài phạm vi. **Lưu ý**: phần testimonial trên trang chủ (`src/App.jsx:59-78`) đang là dữ liệu cố định kèm 5★ và tên khách. `[BA DECISION REQUIRED]` Q-23: đây là đánh giá thật (có sự đồng ý của khách) hay placeholder? Nếu không thật, phải thay trước go-live (rủi ro R-05).

## 20. Thông báo

| Sự kiện | Người nhận | Kênh | Thời điểm |
|---|---|---|---|
| Đơn được xác nhận | Người mua | `[BA DECISION REQUIRED]` Q-24 | Ngay |
| Thanh toán payOS thất bại/hết hạn | Người mua | Q-24 | Ngay |
| Nhắc soạn lời chúc (nếu chưa soạn) | Người mua | Q-24 | Q-08 |
| Nhắc khóa lời chúc sắp đến (PACKED/SHIPPED) | Người mua | Q-24 | `[BA DECISION REQUIRED]` |
| Đơn đã gửi (kèm mã vận đơn) | Người mua | Q-24 | Ngay |
| Đơn bị hủy / hoàn tiền | Người mua | Q-24 | Ngay |
| Kết quả đổi trả | Người mua | Q-24 | Ngay |
| Media lời chúc sắp bị xóa | Người nhận? | Người nhận không có tài khoản/liên hệ → **chỉ hiện đếm ngược trên trang QR** `[CONFIRMED]` D-41 | — |
| Cảnh báo ngân sách Mây 80% / 100% | Admin | Q-24 | Ngay |

Ngôn ngữ thông báo = ngôn ngữ ưa thích của tài khoản người mua `[CONFIRMED]` D-41.

---

## 21. Lời chúc & QR

### 21.1 Hai loại QR

| | QR đơn hàng (trên thiệp cảm ơn in) | QR khắc trên đèn |
|---|---|---|
| Nội dung | Trang lời chúc của đơn | Video quá trình làm của **lô** |
| Truy cập | Private — token ngẫu nhiên (D-29, I-01) | Public `[CONFIRMED]` D-41 |
| Lưu trữ | Chữ: vĩnh viễn (D-12). Giọng nói/video: 30 ngày từ lúc xác nhận nhận quà (D-26) | Vĩnh viễn (D-10) |
| Có trong | Mọi đơn (D-28) `[CONFIRMED]` D-41 | Mọi đèn |
| SEO | `noindex` | `noindex` `[CONFIRMED]` D-44 |

### 21.2 Hai loại thiệp (D-28)

| | Thiệp viết tay | Thiệp cảm ơn in |
|---|---|---|
| Ngôn ngữ | Tiếng Việt (D-25) | Anh–Việt (D-25) |
| Nội dung | Lời chúc dạng chữ của người mua `[CONFIRMED]` D-41 I-10 | Lời cảm ơn cố định + QR đơn hàng + hướng dẫn quay video khui hàng `[CONFIRMED]` D-41 |
| Có trong | Đơn có lời chúc `[CONFIRMED]` D-41 | Mọi đơn `[CONFIRMED]` D-41 |

`[BA DECISION REQUIRED]` Q-25: đơn **Tự mua không tích "Thêm lời chúc"** thì QR trên thiệp cảm ơn dẫn tới đâu (trang theo dõi đơn / trang cảm ơn / không có QR)?

### 21.3 Trạng thái lời chúc

```text
EMPTY ──(soạn)──▶ DRAFT ──(PACKED)──▶ TEXT_LOCKED ──(SHIPPED)──▶ LOCKED
                                                                   │
                                   (người nhận bấm "Tôi đã nhận được quà")
                                                                   ▼
                                                               ACTIVE (media: đếm ngược 30 ngày)
                                                                   │
                                                             (hết 30 ngày)
                                                                   ▼
                                                    MEDIA_EXPIRED (chỉ còn chữ)
```

`TEXT_LOCKED` theo BR-MSG-008 (I-10, đã duyệt ở D-41).

### 21.4 Trang QR lời chúc — hành vi

1. Quét QR → trang hiện lời chào + nút **"Tôi đã nhận được quà"**. Chưa hiện nội dung lời chúc.
2. Bấm nút → ghi `confirmed_at` (chỉ lần đầu) → hiện lời chúc: chữ (bản gốc) + giọng nói/video + nút "Dịch tự động" + nút "Tải về" + đếm ngược ngày xóa media.
3. Các lần sau: vào thẳng nội dung.
4. Sau 30 ngày: media bị xóa; trang hiện chữ + thông báo media đã hết hạn.
5. Ngôn ngữ giao diện trang = ngôn ngữ người mua chọn (D-24); người xem có thể đổi ngôn ngữ giao diện `[CONFIRMED]` D-41.
6. Nút "Dịch tự động" chỉ dịch **chữ**; không dịch giọng nói/video. Đích dịch = ngôn ngữ giao diện đang hiển thị `[CONFIRMED]` D-41. Bản dịch được cache.
7. Trước khi đơn SHIPPED, quét QR hiện "Món quà đang được chuẩn bị" `[CONFIRMED]` D-41, không cho bấm xác nhận.

`[BA DECISION REQUIRED]`:
- **Q-26 (I-19c)**: nếu không ai bấm xác nhận, media lưu bao lâu? Đề xuất: tự coi là đã xác nhận sau X ngày kể từ DELIVERED.
- **Q-27**: người mua có được xem trang QR (xem trước) không? Nếu có, không được làm bắt đầu đếm ngược.
- **Q-28**: người mua có được tải media của chính mình từ dashboard sau khi media đã xóa khỏi trang QR? (Nếu xóa thật theo NFR-PRV-003 thì không.)

### 21.5 Soạn lời chúc

| Chủ đề | Quy tắc |
|---|---|
| Thành phần | Chữ và/hoặc giọng nói và/hoặc video (C-06) |
| Giới hạn ký tự chữ | `[BA DECISION REQUIRED]` (ảnh hưởng thiệp viết tay) |
| Giới hạn thời lượng/dung lượng media | `[BA DECISION REQUIRED]` |
| Kiểm duyệt nội dung | `[BA DECISION REQUIRED]` Q-14 — admin có xem/kiểm duyệt lời chúc không? |
| Ngôn ngữ chữ | Tự do; lưu ý thiệp viết tay bằng tiếng Việt (D-25) — nếu khách viết tiếng Anh/Trung, thiệp viết tay xử lý thế nào? Q-29 |

### 21.6 QR đèn & lô

- Mỗi đèn trong đơn được gán một lô; QR khắc trên đèn trỏ tới trang lô `[CONFIRMED]` D-41.
- QR đèn là **mã chung của lô**, không lưu serial từng đèn `[CONFIRMED]` D-43. URL: `/lo/<mã lô>` (thêm tiền tố `/en`, `/zh` khi xem ngôn ngữ khác).
- Trang lô chỉ công khai khi lô đã xuất bản video (trạng thái `video_published` và có link video); lô chưa có video hoặc mã không tồn tại hiện cùng một trang "không tìm thấy" `[ASSUMPTION]`.
- Mã lô khớp chính xác, phân biệt hoa thường `[ASSUMPTION]`.
- Trang lô ghi rõ video là của cả lô (D-01), `noindex` (D-44).

**Quản trị lô (FR-QR-007, v0.3)**

- Admin tạo lô (mã, ngày làm, tiêu đề, câu chuyện ×3 ngôn ngữ), tải video lên Supabase Storage (D-46), rồi bấm "Xuất bản". Chỉ xuất bản được khi lô đã có video.
- Mã lô chỉ gồm chữ in hoa, số, gạch nối, tối đa 40 ký tự `[ASSUMPTION]`.
- Video nhận MP4/WebM/MOV, tối đa `MAX_VIDEO_MB` (mặc định 500 MB) `[ASSUMPTION]`.
- Sau khi xuất bản: được thay video; không gỡ xuất bản, không xoá, không đổi mã (D-47). Video cũ khi bị thay vẫn giữ trong Storage, không xoá `[ASSUMPTION]` (D-10).
- Lô chưa xuất bản thì sửa mã và xoá được `[ASSUMPTION]`.
- Đơn chỉ được chuyển SHIPPED khi video lô của mọi dòng hàng đã xuất bản (BR-FUL-001) `[CONFIRMED]` D-41.

---

## 22. AI Mây

### 22.1 Phạm vi

| Năng lực | Vãng lai | Đã đăng nhập |
|---|:-:|:-:|
| Tour khám phá web | ✓ | ✓ |
| Trả lời về sản phẩm, giá (từ DB) | ✓ | ✓ |
| Trả lời FAQ, chính sách (từ DB) | ✓ | ✓ |
| Tra đơn bằng mã đơn + SĐT/email | ✓ | ✓ |
| Tra đơn của chính mình không cần nhập mã | – | ✓ |
| Thêm giỏ hàng, sửa/hủy đơn, sửa tài khoản | ✗ | ✗ (D-30, BR-AI-006) |
| Nhắc tới / tạo coupon | ✗ | ✗ `[CONFIRMED]` D-41 |
| Lưu lịch sử chat | Không `[CONFIRMED]` D-41 | Vĩnh viễn (D-19) |

### 22.2 Kiến trúc nghiệp vụ (bắt buộc)

- Mây chỉ lấy dữ liệu qua **danh sách hàm backend đã khai báo**, ví dụ `getProducts`, `getFaq`, `getPolicy`, `getMyOrders`, `lookupOrder(code, phoneOrEmail)`. Không truy vấn DB trực tiếp (D-29).
- Backend kiểm tra quyền theo phiên, không theo nội dung prompt.
- Chỉ trả về cho OpenAI các trường cần: mã đơn, trạng thái, công đoạn, ngày cập nhật, mã vận đơn. **Không** trả địa chỉ, SĐT, nội dung lời chúc (NFR-PRV-001).
- `lookupOrder` cần chống dò: giới hạn số lần thử sai `[CONFIRMED]` D-41.

### 22.3 Tour

- Tự bật ở lần truy cập đầu (D-30); đóng được; nhớ lựa chọn. Mở lại qua nút Mây `[CONFIRMED]` D-41 I-21.
- Không tự bật tại: trang QR, giỏ hàng, checkout, dashboard `[CONFIRMED]` D-41.
- Hành động được phép: cuộn tới mục, làm nổi bật phần tử, mở trang công khai. Không thao tác dữ liệu.
- Nội dung tour có ở 3 ngôn ngữ.

### 22.4 Hạn mức & lỗi (D-31 — `[CONFIRMED]` D-41, admin chỉnh được)

| Hạng mục | Vãng lai | Đã đăng nhập |
|---|---|---|
| Tin nhắn | 20 / phiên, 50 / ngày / IP | 100 / ngày |
| Độ dài tin nhắn | 500 ký tự | 500 ký tự |

| Tình huống | Hành vi | Câu mẫu (vi) |
|---|---|---|
| OpenAI lỗi / quá thời gian | Hiện câu ngẫu nhiên từ nhóm "ốm" | "Mây bị ốm rùi, chờ Mây khỏe lại xíu nha" |
| Hết lượt | Nhóm "mệt" | "Hôm nay Mây nói nhiều quá, mai mình trò chuyện tiếp nha" |
| Ngân sách tháng 80% | Cảnh báo admin | — |
| Ngân sách tháng 100% | Chuyển chế độ FAQ offline (không gọi API) | "Mây đang nghỉ ngơi, bạn xem thử mấy câu hỏi thường gặp nè" |
| Không có dữ liệu để trả lời | Nói không biết, gợi ý liên hệ | "Cái này Mây chưa biết, bạn liên hệ [kênh hỗ trợ] giúp Mây nha" |

Các câu thông báo có đủ vi/en/zh-Hans; admin sửa được. Nút "Dịch tự động" ở trang QR dùng chung ngân sách, không dùng chung hạn mức tin nhắn `[CONFIRMED]` D-41.

Kênh hỗ trợ người thật (Q-31): admin nhập tại cấu hình Mây (3 ngôn ngữ); để trống thì Mây chỉ nói "chưa biết", không gợi ý kênh `[CONFIRMED]` D-56.

**Hiện thực (v0.6)**

- **Bật/tắt OpenAI** `[CONFIRMED]` D-55, D-67: cờ trong cấu hình Mây, **mặc định bật** (PO đã duyệt I-14); admin tắt được. Khi tắt, hoặc server chưa có khoá OpenAI, Mây chạy **FAQ offline**: trả câu nhóm "nghỉ ngơi" + tối đa 3 câu FAQ khớp từ khoá câu hỏi `[ASSUMPTION]`.
- **Ngân sách tháng mặc định 20 USD** `[CONFIRMED]` D-58; chi phí tính theo token × đơn giá cấu hình ở server (`OPENAI_PRICE_*`); tháng tính theo giờ Việt Nam `[ASSUMPTION]`. Cảnh báo 80%/100% hiện ở trang cấu hình Mây và dashboard IT (kênh gửi cảnh báo chờ Q-24).
- **Timeout 15 giây** cho cả lượt trả lời (gồm các lần gọi hàm) `[CONFIRMED]` D-57 → câu nhóm "ốm".
- Câu trả lời của Mây là **văn bản thuần**: không markdown, không link/URL/tên miền — server tự bỏ nếu model vẫn viết `[ASSUMPTION]` (sau lỗi thật: Mây bịa link `lamvi.com`). Muốn dẫn tới sản phẩm thì nêu tên sản phẩm.
- Hàm backend Mây gọi được (v0.6): `get_products`, `get_product(slug)`, `get_faq`. Chưa có `get_policy` (chưa có nội dung chính sách — G-10), `get_my_orders` / `lookup_order` (chưa có đơn — FR-AI-004).
- Tối đa 4 vòng gọi hàm mỗi lượt; hết vòng mà chưa có câu trả lời → câu "chưa biết" `[ASSUMPTION]`.
- **Kiểm tra số liệu ở server (BR-AI-003)**: mọi số từ 4 chữ số trở lên trong câu trả lời (giá, năm, mã…) phải có trong kết quả hàm của lượt đó; nếu không → thay bằng câu "chưa biết" `[DERIVED]`.
- **Không gửi SĐT, email sang OpenAI** — server thay bằng `[phone]`, `[email]` trong tin nhắn và lịch sử trước khi gửi `[DERIVED]` NFR-PRV-001.
- **Chặn nhắc giảm giá ở server (BR-AI-005)**: câu trả lời có từ khoá giảm giá/khuyến mãi/coupon/voucher/%, hoặc số tiền viết tắt (799k, 1,05 triệu, 万) → thay bằng câu "chưa biết" `[ASSUMPTION]` (danh sách từ khoá do dev đặt, BA/PO bổ sung được).
- Lịch sử gửi kèm cho OpenAI: tối đa 10 lượt, mỗi lượt cắt theo độ dài tối đa tin nhắn (500 ký tự) `[ASSUMPTION]`.
- Không đọc được chi phí tháng → coi như hết ngân sách (FAQ offline); ghi chi phí hoặc lưu lịch sử lỗi → vẫn trả câu trả lời cho khách, ghi log `[ASSUMPTION]` NFR-AVL-001.
- Hạn mức theo phiên của khách vãng lai dùng mã phiên do trình duyệt tạo; hạn mức theo IP dùng IP đã băm, không lưu IP thô `[ASSUMPTION]`. Hạn mức theo ngày tính theo giờ Việt Nam `[ASSUMPTION]`.
- Khách vãng lai: lịch sử chỉ giữ trong tab trình duyệt (sessionStorage), gửi kèm tối đa 10 lượt gần nhất làm ngữ cảnh `[ASSUMPTION]`; server không lưu (BR-AI-008).
- Người đã đăng nhập: lưu cả câu hỏi gốc và câu trả lời; xem ở trang tài khoản (FR-ACC-004). Quyền xoá lịch sử chờ `[LEGAL]` I-15.
- Tour: 5 bước trên trang chủ (giới thiệu → bộ sưu tập → hai mã QR → hỏi đáp → nút Mây); chỉ tự bật khi lần đầu vào **trang chủ** `[ASSUMPTION]`; bấm "Dẫn tour" ở trang khác thì về trang chủ rồi chạy tour. Nội dung tour do đội dev soạn — chờ Marketing `[ASSUMPTION]` (G-14).
- Mascot Mây hiện trên mọi trang khách (trừ `/admin`, `/it`); lỗi của Mây không làm vỡ trang (NFR-AVL-001).
- Bảo trì bật (D-54) → gửi tin cho Mây trả 503, khung chat báo "đang bảo trì" `[DERIVED]`.
- Model mặc định `gpt-4o-mini`, đổi qua `OPENAI_MODEL` `[ASSUMPTION]` (tech lead chốt).

### 22.5 Quy tắc "chỉ nói thông tin thật" (kiểm thử được)

- Mọi giá, trạng thái đơn, ngày, chính sách Mây nêu phải có trong kết quả hàm backend của **chính lượt trả lời đó**.
- Không hứa ngày giao, không cam kết đổi trả/hoàn tiền, không đưa coupon.
- Mây trả lời bằng ngôn ngữ giao diện đang chọn `[CONFIRMED]` D-41.
- Hiển thị rõ Mây là trợ lý AI `[CONFIRMED]` D-41.

### 22.6 Lịch sử chat

- Lưu vĩnh viễn với người đã đăng nhập (D-19).
- `[LEGAL]` I-15: quyền yêu cầu xóa; xử lý khi xóa tài khoản.
- ~~`[LEGAL]` I-14: gửi dữ liệu sang OpenAI (máy chủ ngoài VN).~~ Đã duyệt `[CONFIRMED]` D-67 — vẫn giữ NFR-PRV-001 (không gửi SĐT/email/địa chỉ).

---

## 23. Đa ngôn ngữ, SEO, Analytics

### 23.1 Đa ngôn ngữ

| Chủ đề | Quy tắc |
|---|---|
| Ngôn ngữ | vi (mặc định), en, zh-Hans (D-23) |
| Phạm vi dịch | Giao diện, sản phẩm, FAQ, chính sách, tour Mây, câu lỗi Mây, trang QR, thông báo `[CONFIRMED]` D-41 |
| Không dịch | Nội dung lời chúc (chỉ dịch khi bấm nút, D-27); thiệp giấy (D-25) |
| Văn bản pháp lý | Bản tiếng Việt có giá trị ưu tiên khi có mâu thuẫn `[LEGAL]` R-11 |
| Chọn ngôn ngữ | Nằm trên URL (`/`, `/en/`, `/zh/`) `[CONFIRMED]` D-37. Mã `zh` trên URL tương ứng zh-Hans (thuộc tính `lang="zh-Hans"`) |
| Thiếu bản dịch | Hiển thị tiếng Việt `[CONFIRMED]` D-40 |
| Bản dịch hiện có | Bản en/zh của giao diện, sản phẩm, FAQ do đội dev soạn — chờ PO duyệt `[ASSUMPTION]` (G-14) |

### 23.2 SEO

- Trang công khai phải render sẵn HTML (pre-render hoặc SSR). **SSR trong Express** — một server Node phục vụ cả web và API, mỗi request render với dữ liệu mới nhất từ DB `[CONFIRMED]` D-49.
- URL riêng mỗi ngôn ngữ + `hreflang` + sitemap + meta title/description theo trang và ngôn ngữ.
- Structured data sản phẩm phải khớp cách hiển thị giá (I-04): JSON-LD `Product` có `Offer` giá **chưa VAT** kèm `valueAddedTaxIncluded: false` `[CONFIRMED]` D-50 — `[LEGAL]` I-04 vẫn chờ pháp chế; nếu kết luận khác phải sửa cùng lúc cách hiển thị giá và JSON-LD.
- `noindex`: trang QR lời chúc, dashboard, giỏ hàng, checkout, admin, trang lô (D-44), trang đăng nhập/đăng ký/quên & đặt lại mật khẩu, trang 404.

**Hiện thực (v0.4)**

| Trang | SSR | Index | Ghi chú |
|---|---|---|---|
| Trang chủ `/`, `/en`, `/zh` | Có | Có | title/description theo ngôn ngữ, canonical + hreflang (vi, en, zh-Hans, x-default = vi) |
| Chi tiết sản phẩm | Có | Có (chỉ Published) | title "{tên} — Mộc…", JSON-LD Product (D-50); Draft/Hidden/không có → 404 |
| Trang QR lô `/lo/:code` | Có | Không (D-44) | Không có trong sitemap |
| Đăng nhập, đăng ký, quên/đặt lại mật khẩu, tài khoản, admin | Không — chỉ khung HTML `[DERIVED]` (nội dung phụ thuộc phiên ở trình duyệt) | Không | Header `X-Robots-Tag: noindex` |
| Đường dẫn không tồn tại | Có | Không | HTTP 404 |

- `sitemap.xml`: trang chủ + sản phẩm Published × 3 ngôn ngữ, kèm `xhtml:link` hreflang và `lastmod` `[DERIVED]`.
- `robots.txt`: chỉ `Disallow` `/api/` và `/admin`; các trang riêng tư dùng `noindex` (để bot đọc được noindex) `[ASSUMPTION]`.
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type`, `og:locale`. Chưa có ảnh chia sẻ (`og:image`) vì chưa có ảnh sản phẩm thật `[ASSUMPTION]` (G-23).
- Câu meta description trang chủ và mẫu tiêu đề sản phẩm do đội dev soạn — chờ Marketing duyệt `[ASSUMPTION]` (G-14).
- URL gốc trong canonical/sitemap lấy từ biến môi trường `PUBLIC_SITE_URL` `[DERIVED]`.

### 23.3 Google Analytics

- Sự kiện đề xuất `[CONFIRMED]` D-41: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `cancel_order`, `open_qr_gift`, `confirm_gift_received`, `open_qr_batch`, `mascot_open`, `mascot_tour_complete`, `mascot_error`.
- Không gửi token QR (URL trang QR phải được làm sạch trước khi gửi), không gửi dữ liệu cá nhân (NFR-PRV-002).
- `[LEGAL]` Q-32: có cần banner xin đồng ý cookie/theo dõi không?

---

## 24. Business rules

| ID | Quy tắc | Nguồn |
|---|---|---|
| BR-ACC-001 | Chỉ người dùng đã đăng nhập mới tạo được đơn hàng. | D-36 |
| BR-PRC-001 | Tổng = Σ(giá chưa VAT × SL) − giảm giá + phí ship + VAT; tính phía server. | D-03 |
| BR-PRC-002 | Giá dòng hàng được chốt tại thời điểm tạo đơn; thay đổi giá sau đó không ảnh hưởng đơn. | `[CONFIRMED]` D-41 |
| BR-PRC-003 | Mọi nơi hiển thị giá phải có chú thích "chưa gồm VAT". | D-03, `[LEGAL]` |
| BR-CPN-001 | Coupon chỉ áp được khi thỏa điều kiện hợp lệ ở §14. | D-21 |
| BR-CPN-002 | Coupon được kiểm tra lại ngay lúc tạo đơn; không hợp lệ thì không tạo đơn và báo khách. | `[CONFIRMED]` D-41 |
| BR-CPN-003 | Mỗi đơn dùng tối đa 1 coupon. | `[CONFIRMED]` D-41 C-4 |
| BR-PAY-001 | Đơn payOS chỉ chuyển CONFIRMED khi nhận webhook PAID đã xác minh chữ ký và số tiền khớp. | D-35 |
| BR-PAY-002 | Webhook trùng mã giao dịch không làm thay đổi trạng thái lần hai. | `[DERIVED]` |
| BR-PAY-003 | Đơn payOS quá hạn thanh toán chuyển CANCELLED và trả lượt coupon. | `[CONFIRMED]` D-41 |
| BR-PAY-004 | Đơn có người nhận là người khác không được chọn COD. | `[CONFIRMED]` D-41 |
| BR-ORD-001 | Người mua hủy được đơn khi trạng thái trước SHIPPED. | D-06 |
| BR-ORD-002 | Đơn chỉ chuyển SHIPPED khi video lô của mọi dòng hàng đã xuất bản. | `[CONFIRMED]` D-41 BR-FUL-001 |
| BR-SHP-001 | Người mua chọn người nhận = bản thân / người khác; địa chỉ + SĐT theo lựa chọn. | D-02 |
| BR-SHP-002 | Chỉ giao trong Việt Nam; tiền tệ VND. | D-32 |
| BR-MSG-001 | Lời chúc không sửa được khi đơn đã SHIPPED. | D-13 |
| BR-MSG-008 | Phần chữ của lời chúc không sửa được khi đơn đã PACKED. | `[CONFIRMED]` D-41 I-10 |
| BR-MSG-002 | Đơn Tự mua chỉ có lời chúc khi người mua tích "Thêm lời chúc". | D-14 |
| BR-MSG-003 | Lời chúc dạng chữ lưu vô thời hạn. | D-12 |
| BR-MSG-004 | Giọng nói/video bị xóa sau 30 ngày kể từ lúc người nhận bấm "Tôi đã nhận được quà" lần đầu. | D-26 |
| BR-MSG-005 | Trang QR hiện bản gốc; bản dịch chỉ hiện khi bấm "Dịch tự động". | D-27 |
| BR-MSG-006 | Nếu không ai xác nhận, media được xử lý theo [Q-26]. | `[BA DECISION REQUIRED]` |
| BR-MSG-007 | Lượt mở trang QR trước khi bấm xác nhận không bắt đầu đếm ngược. | D-26 |
| BR-QR-001 | QR đơn hàng chỉ chứa token ngẫu nhiên; không chứa dữ liệu cá nhân dạng đọc được. | D-29, I-01 |
| BR-QR-002 | QR đèn trỏ tới video lô; video lô không bị xóa. | D-10 |
| BR-CARD-001 | Mọi đơn có thiệp cảm ơn in Anh–Việt kèm QR đơn hàng. | D-28 `[CONFIRMED]` D-41 |
| BR-CARD-002 | Thiệp viết tay tiếng Việt chỉ có trong đơn có lời chúc. | D-28 `[CONFIRMED]` D-41 |
| BR-RET-001 | Yêu cầu đổi trả bắt buộc kèm video quay liên tục từ lúc khui hàng. | D-07 |
| BR-AI-001 | Mây chỉ truy cập dữ liệu qua hàm backend được khai báo. | D-29 |
| BR-AI-002 | Mây chỉ trả thông tin đơn khi backend xác thực người hỏi là chủ đơn (phiên đăng nhập, hoặc mã đơn + SĐT/email khớp). | D-29 |
| BR-AI-003 | Mọi số liệu Mây nêu phải lấy từ kết quả hàm backend trong cùng lượt trả lời. | D-16 |
| BR-AI-004 | Khi OpenAI lỗi, hết lượt, hết ngân sách: hiện câu thông báo tương ứng bằng ngôn ngữ đang chọn. | D-20, D-31 |
| BR-AI-005 | Mây không đưa ra coupon, không cam kết ngày giao/đổi trả/hoàn tiền. | `[CONFIRMED]` D-41 |
| BR-AI-006 | Mây không thực hiện thao tác thay đổi dữ liệu. | D-30 |
| BR-AI-007 | Tour tự bật ở lần truy cập đầu; không tự bật tại trang QR, giỏ hàng, checkout, dashboard. | D-30 + `[CONFIRMED]` D-41 |
| BR-AI-008 | Lịch sử chat người đã đăng nhập lưu vô thời hạn; chat vãng lai không lưu. | D-19 + `[CONFIRMED]` D-41 |
| BR-SEO-001 | Trang QR lời chúc, dashboard, giỏ, checkout, admin đặt `noindex`. | `[CONFIRMED]` D-41 |
| BR-GA-001 | Không gửi token QR và dữ liệu cá nhân tới Google Analytics. | `[CONFIRMED]` D-41 |

---

## 25. User stories (trọng tâm)

**US-001 — Đặt quà giao tận tay người nhận**
Là người mua, tôi muốn đặt đèn làm quà và giao thẳng tới người nhận, để tặng mà không phải tự đi giao.
- AC-001: Given đã đăng nhập và giỏ có hàng, When chọn "Mua tặng" và "Người nhận là người khác", Then form yêu cầu tên, SĐT, địa chỉ người nhận.
- AC-002: Given người nhận là người khác, When tới bước thanh toán, Then không hiển thị COD (BR-PAY-004).
- AC-003: Given chưa đăng nhập, When bấm "Thanh toán", Then chuyển tới đăng nhập và quay lại checkout với giỏ còn nguyên.

**US-002 — Thanh toán payOS**
Là người mua, tôi muốn thanh toán qua payOS để đơn được xác nhận ngay.
- AC-001: Given đơn PENDING_PAYMENT, When payOS gửi webhook PAID hợp lệ với số tiền khớp, Then đơn chuyển CONFIRMED đúng một lần.
- AC-002: Given khách quay về return URL trước khi có webhook, Then trang hiện "Đang chờ xác nhận thanh toán", đơn vẫn PENDING_PAYMENT.
- AC-003: Given webhook đến hai lần cùng mã giao dịch, Then lần hai không đổi trạng thái, không gửi thông báo lần hai.
- AC-004: Given quá hạn thanh toán (Q-15), Then đơn CANCELLED và lượt coupon được trả lại.

**US-003 — Soạn lời chúc**
Là người mua, tôi muốn ghi lời chúc bằng chữ, giọng nói hoặc video để người nhận xem khi quét QR.
- AC-001: Given đơn chưa SHIPPED, When lưu lời chúc, Then lời chúc được cập nhật.
- AC-002: Given đơn đã PACKED, When sửa phần chữ, Then hệ thống từ chối (BR-MSG-008).
- AC-003: Given đơn đã SHIPPED, When sửa bất kỳ phần nào, Then hệ thống từ chối và giải thích lý do.

**US-004 — Người nhận xem lời chúc**
Là người nhận, tôi muốn quét QR trên thiệp để xem lời chúc mà không cần tài khoản.
- AC-001: Given token hợp lệ và đơn đã SHIPPED, When mở link, Then thấy nút "Tôi đã nhận được quà", chưa thấy nội dung.
- AC-002: When bấm nút lần đầu, Then `confirmed_at` được ghi, media hiện kèm đếm ngược 30 ngày.
- AC-003: Given đã quá 30 ngày từ `confirmed_at`, When mở link, Then chỉ còn chữ và thông báo media đã hết hạn; file media không còn truy cập được.
- AC-004: Given token không tồn tại, Then trang 404 chung, không tiết lộ đơn có tồn tại hay không.
- AC-005: When bấm "Dịch tự động", Then hiện bản dịch dưới bản gốc, có nhãn "Dịch tự động".

**US-005 — Xem video lô**
Là người sở hữu đèn, tôi muốn quét QR trên đèn để xem đèn được làm như thế nào.
- AC-001: Given QR đèn hợp lệ, When quét, Then phát video lô, không cần đăng nhập, ở bất kỳ thời điểm nào.

**US-006 — Hủy đơn**
Là người mua, tôi muốn hủy đơn trước khi gửi hàng.
- AC-001: Given đơn trước SHIPPED, When bấm hủy và xác nhận, Then đơn CANCELLED.
- AC-002: Given đơn SHIPPED trở đi, Then không hiển thị nút hủy; gọi API hủy bị từ chối.
- AC-003: Given đơn payOS đã PAID bị hủy, Then tạo bản ghi hoàn tiền trạng thái REFUND_PENDING.

**US-007 — Yêu cầu đổi trả**
Là người mua, tôi muốn gửi yêu cầu đổi trả kèm video khui hàng.
- AC-001: Given đơn DELIVERED trong thời hạn (Q-19), When gửi yêu cầu không có video, Then hệ thống từ chối.
- AC-002: When gửi kèm video, Then yêu cầu ở trạng thái chờ duyệt và admin thấy trong danh sách.

**US-008 — Mây tra đơn**
Là khách, tôi muốn hỏi Mây tình trạng đơn của mình.
- AC-001: Given đã đăng nhập, When hỏi "đơn của tôi tới đâu rồi", Then Mây trả lời trạng thái và công đoạn đúng như DB.
- AC-002: Given đã đăng nhập, When hỏi về mã đơn của người khác, Then Mây trả lời không tìm thấy, không lộ thông tin.
- AC-003: Given vãng lai, When cung cấp mã đơn + SĐT khớp, Then Mây trả lời trạng thái; không khớp thì báo không tìm thấy.
- AC-004: Câu trả lời không chứa địa chỉ, SĐT.

**US-009 — Mây khi lỗi**
- AC-001: Given OpenAI lỗi, When khách gửi tin, Then hiện một câu từ nhóm "ốm" bằng ngôn ngữ đang chọn trong thời gian tối đa 15 giây (D-57).
- AC-002: Given hết ngân sách tháng, Then Mây chuyển FAQ offline, không gọi OpenAI.

**US-010 — Tour Mây**
- AC-001: Given lần truy cập đầu tại trang chủ, Then tour tự bật.
- AC-002: Given đã đóng tour, When quay lại, Then tour không tự bật.
- AC-003: Given đang ở trang QR / giỏ / checkout, Then tour không tự bật.

**US-011 — Admin tạo coupon**
- AC-001: When tạo coupon với đủ thuộc tính (§14), Then coupon áp dụng được theo BR-CPN-001.
- AC-002: When tắt coupon, Then đơn tạo sau đó không áp được; đơn đã tạo không đổi.
- AC-003: Mọi thay đổi coupon được ghi log (NFR-AUD-001).

**US-012 — Đổi ngôn ngữ**
- AC-001: When chọn en/zh, Then URL đổi sang tiền tố tương ứng và toàn bộ giao diện đổi ngôn ngữ.

---

## 26. Use cases

### UC-01 — Đặt hàng & thanh toán payOS
| Mục | Nội dung |
|---|---|
| Actor | Người mua (đã đăng nhập); payOS |
| Tiền điều kiện | Giỏ có ≥1 sản phẩm Published |
| Luồng chính | 1. Mở checkout → 2. Chọn loại đơn, người nhận, ngôn ngữ QR → 3. Nhập coupon → 4. Server tính giá → 5. Chọn payOS → 6. Server tạo đơn PENDING_PAYMENT + link payOS → 7. Khách thanh toán → 8. Webhook PAID → đơn CONFIRMED → 9. Thông báo |
| Luồng thay thế | 5a. Chọn COD → đơn CONFIRMED ngay (nếu BR-PAY-004 cho phép) |
| Ngoại lệ | 4a. Giá/coupon đổi giữa chừng → hiện bảng giá mới. 7a. Hết hạn → CANCELLED. 8a. Webhook sai chữ ký → bỏ qua, ghi log. 8b. Số tiền không khớp → gắn cờ admin. 8c. Webhook tới khi đơn đã CANCELLED → gắn cờ hoàn tiền |
| Hậu điều kiện | Đơn CONFIRMED; coupon ghi nhận đã dùng |
| Quy tắc | BR-ACC-001, BR-PRC-*, BR-CPN-*, BR-PAY-* |

### UC-02 — Người nhận mở lời chúc
| Mục | Nội dung |
|---|---|
| Actor | Người nhận |
| Tiền điều kiện | Có thiệp cảm ơn với QR đơn hàng |
| Luồng chính | 1. Quét QR → 2. Server kiểm tra token → 3. Đơn đã SHIPPED → hiện nút xác nhận → 4. Bấm → ghi `confirmed_at` → 5. Hiện chữ + media + đếm ngược |
| Luồng thay thế | 3a. Đơn chưa SHIPPED → "Món quà đang được chuẩn bị". 5a. Bấm "Dịch tự động". 5b. Bấm "Tải về" |
| Ngoại lệ | 2a. Token sai → 404 chung. 5c. Media đã hết hạn → chỉ chữ. 5d. Dịch lỗi → câu lỗi kiểu Mây |
| Quy tắc | BR-MSG-003…007, BR-QR-001 |

### UC-03 — Mây tra đơn
| Mục | Nội dung |
|---|---|
| Actor | Khách (vãng lai/đã đăng nhập); OpenAI |
| Luồng chính | 1. Khách hỏi → 2. Mây gọi `getMyOrders` (đăng nhập) hoặc hỏi mã đơn + SĐT/email rồi gọi `lookupOrder` → 3. Backend kiểm quyền → 4. Trả trường tối thiểu → 5. Mây trả lời |
| Ngoại lệ | 3a. Không khớp → "không tìm thấy". 3b. Thử sai quá số lần → tạm khóa tra cứu. 5a. OpenAI lỗi → câu "ốm" |
| Quy tắc | BR-AI-001…004 |

### UC-04 — Hủy đơn
| Mục | Nội dung |
|---|---|
| Actor | Người mua / Admin |
| Luồng chính | 1. Bấm hủy → 2. Server kiểm tra trạng thái trước SHIPPED → 3. Đơn CANCELLED → 4. payOS đã PAID → tạo REFUND_PENDING → 5. Trả lượt coupon (C-8) → 6. Thông báo |
| Ngoại lệ | 2a. Admin vừa chuyển SHIPPED cùng lúc → thao tác đến sau bị từ chối (kiểm tra trạng thái nguyên tử) |
| Quy tắc | BR-ORD-001 |

### UC-05 — Đổi trả
| Mục | Nội dung |
|---|---|
| Actor | Người mua; Admin |
| Luồng chính | 1. Chọn đơn DELIVERED → 2. Chọn dòng hàng, lý do → 3. Tải video khui hàng → 4. Gửi → 5. Admin duyệt → 6. Admin ghi nhận kết quả (hoàn tiền/làm lại) |
| Ngoại lệ | 3a. Không có video → không gửi được. 1a. Quá hạn (Q-19) → không hiện nút. 5a. Từ chối kèm lý do |
| Quy tắc | BR-RET-001 |

---

## 27. Ma trận edge case

| Nhóm | Tình huống | Hành vi mong đợi | Quyết định |
|---|---|---|---|
| Giỏ | Sản phẩm bị ẩn khi đang trong giỏ | Cảnh báo, chặn checkout dòng đó | `[CONFIRMED]` D-41 |
| Giỏ | Giá đổi sau khi thêm vào giỏ | Hiện giá mới; chốt giá lúc tạo đơn | `[CONFIRMED]` D-41 BR-PRC-002 |
| Checkout | Coupon hết hạn/hết lượt giữa lúc checkout | Kiểm tra lại lúc tạo đơn, báo khách | `[CONFIRMED]` D-41 BR-CPN-002 |
| Checkout | Khách bấm "Đặt hàng" hai lần | Chỉ tạo một đơn (khóa trùng theo phiên checkout) | `[DERIVED]` |
| Thanh toán | Webhook payOS đến chậm | Trang chờ + backend hỏi lại payOS | `[CONFIRMED]` D-41 |
| Thanh toán | Webhook trùng | Idempotent | BR-PAY-002 |
| Thanh toán | Thanh toán thành công sau khi đơn hết hạn | Gắn cờ hoàn tiền thủ công | `[CONFIRMED]` D-41 |
| Thanh toán | Số tiền nhận khác đơn | Không xác nhận, gắn cờ admin | `[CONFIRMED]` D-41 |
| Thanh toán | Khách thanh toán thành công nhưng tạo đơn lỗi | Không xảy ra theo thiết kế: đơn được tạo **trước** khi tạo link payOS | `[DERIVED]` |
| Thanh toán | COD, người nhận là người khác | Chặn COD | BR-PAY-004, D-41 |
| Đơn | Khách hủy cùng lúc admin chuyển SHIPPED | Thao tác đến sau bị từ chối | `[DERIVED]` |
| Đơn | Hủy đơn đã PAID đang IN_PRODUCTION | Hoàn bao nhiêu? | Q-20 |
| Lời chúc | Chưa soạn lời chúc khi đơn tới PACKED/SHIPPED | ? | Q-08 |
| Lời chúc | Sửa chữ sau khi thiệp đã viết | Chặn từ PACKED | `[CONFIRMED]` D-41 BR-MSG-008 |
| QR | Nhân viên/người mua quét thử | Không bắt đầu đếm ngược (chưa bấm xác nhận) | D-26 |
| QR | App chat tự mở link để tạo preview | Không bắt đầu đếm ngược (cần bấm nút) | D-26 |
| QR | Người nhận không bao giờ bấm xác nhận | ? | Q-26 |
| QR | Quét trước khi đơn SHIPPED | "Món quà đang được chuẩn bị" | `[CONFIRMED]` D-41 |
| QR | Đơn bị hủy, thiệp chưa gửi | Token vô hiệu | `[CONFIRMED]` D-41 |
| QR | Mất thiệp / người lạ nhặt được thiệp | Người lạ xem được lời chúc | Rủi ro chấp nhận? Q-33 |
| QR | Quét QR đèn khi video lô chưa xuất bản | Không xảy ra với đèn đã giao (BR-ORD-002); nếu vẫn quét được thì hiện trang "không tìm thấy" chung | `[CONFIRMED]` D-41 + `[ASSUMPTION]` |
| Đổi trả | Người nhận quà khui hàng không quay video | Không đủ điều kiện đổi trả | D-07 — giảm thiểu bằng hướng dẫn trên thiệp |
| Mây | Khách yêu cầu xem đơn người khác | Từ chối | BR-AI-002 |
| Mây | Khách hỏi giảm giá | Không đưa coupon | `[CONFIRMED]` D-41 BR-AI-005 |
| Mây | OpenAI lỗi | Câu "ốm" | D-20 |
| Mây | Hết ngân sách | FAQ offline | `[CONFIRMED]` D-41 |
| Mây | Dò mã đơn + SĐT hàng loạt | Giới hạn thử sai | `[CONFIRMED]` D-41 |
| i18n | Thiếu bản dịch | Hiện tiếng Việt | `[CONFIRMED]` D-41 |
| i18n | Khách viết lời chúc bằng tiếng Trung | Thiệp viết tay xử lý thế nào? | Q-29 |

---

## 28. Truy vết

| Quyết định / nguồn | FR | BR | US | UC |
|---|---|---|---|---|
| D-36 bắt buộc tài khoản | FR-ACC-001, FR-CHK-001 | BR-ACC-001 | US-001 | UC-01 |
| D-35 payOS/COD | FR-PAY-001/002, FR-CHK-007 | BR-PAY-001…004 | US-002 | UC-01 |
| D-02 người nhận | FR-CHK-004 | BR-SHP-001 | US-001 | UC-01 |
| D-06 hủy | FR-ORD-001 | BR-ORD-001 | US-006 | UC-04 |
| D-07 đổi trả | FR-RET-001/002 | BR-RET-001 | US-007 | UC-05 |
| D-12, D-26, D-27 lời chúc | FR-QR-002…005 | BR-MSG-003…007 | US-004 | UC-02 |
| D-13, I-10 khóa sửa | FR-ACC-003 | BR-MSG-001, BR-MSG-008 | US-003 | — |
| D-01, D-10 QR đèn | FR-QR-006/007 | BR-QR-002, BR-ORD-002 | US-005 | — |
| D-15, D-16, D-29 Mây | FR-AI-003/004 | BR-AI-001…003 | US-008 | UC-03 |
| D-20, D-31 lỗi & hạn mức | FR-AI-005/007 | BR-AI-004 | US-009 | UC-03 |
| D-30 tour | FR-AI-002 | BR-AI-006/007 | US-010 | — |
| D-21 coupon | FR-CPN-001/002 | BR-CPN-001…003 | US-011 | UC-01 |
| D-23 i18n | FR-I18N-001 | — | US-012 | — |
| D-05, D-49, D-50 SEO/GA | FR-SEO-001, FR-GA-001 | BR-SEO-001, BR-GA-001 | — | — |
| D-37, D-40 URL ngôn ngữ, dự phòng vi | FR-I18N-001 | — | US-012 | — |
| D-39 trạng thái sản phẩm | FR-CAT-001, FR-CAT-004 | — | — | — |
| D-42 đăng nhập email | FR-ACC-001 | BR-ACC-001 | — | — |
| D-43, D-44 QR lô | FR-QR-006 | BR-QR-002 | US-005 | — |

**Yêu cầu mồ côi (chưa có US/UC)**: FR-CAT-004, FR-AI-006, FR-QR-007 (admin lô), FR-SEO-001, FR-GA-001 — cần bổ sung US ở bản sau.
**Yêu cầu trùng**: không phát hiện.

---

## 29. Sổ rủi ro

| ID | Rủi ro | Ảnh hưởng | Xác suất | Bằng chứng | Giảm thiểu | Người quyết |
|---|---|---|---|---|---|---|
| R-03 | Chữ trên thiệp và lời chúc online lệch nhau | Trung bình | UNKNOWN | D-13 cho sửa đến SHIPPED, thiệp viết lúc PACKED | BR-MSG-008 | PO |
| R-04 | Token QR bị đoán hoặc thiệp rơi vào tay người lạ | Cao — lộ lời chúc riêng | UNKNOWN | QR là link bearer | Token ngẫu nhiên; Q-33 | PO / Tech lead |
| R-05 | Testimonial cố định bị coi là đánh giá giả | Cao — pháp lý | UNKNOWN | `App.jsx:59-78` | Q-23 | PO |
| R-06 | COD cho quà giao người khác → người nhận trả tiền / từ chối | Cao — trải nghiệm | UNKNOWN | D-02 + D-35 | BR-PAY-004 | PO |
| R-07 | Mây nói sai giá/chính sách | Cao | UNKNOWN | LLM | BR-AI-003, BR-AI-005 | PO |
| R-08 | Chi phí OpenAI tăng vọt | Trung bình | UNKNOWN | Chat mở cho vãng lai | Hạn mức + trần ngân sách | PO |
| R-09 | Media lưu vô thời hạn khi không ai xác nhận | Trung bình — chi phí | UNKNOWN | D-26 | Q-26 | PO |
| R-10 | Nội dung web hứa "vĩnh viễn", "từng đèn" trái quyết định | Cao — quảng cáo sai | Chắc chắn nếu không sửa | §31.2 | Sửa nội dung | PO / Marketing |
| R-11 | Bản dịch chính sách lệch bản gốc | Trung bình | UNKNOWN | 3 ngôn ngữ | Bản VN ưu tiên | Pháp chế |
| R-12 | Lộ dữ liệu đơn qua Mây | Cao | UNKNOWN | Prompt injection | BR-AI-001/002 | Tech lead |
| R-13 | Chuyển dữ liệu cá nhân sang OpenAI | Cao — pháp lý | UNKNOWN | Máy chủ ngoài VN | NFR-PRV-001; I-14 (đã duyệt D-67) | Pháp chế |
| R-14 | Giá hiển thị chưa VAT trái quy định niêm yết | Cao — pháp lý | UNKNOWN | D-03 | I-04 | Pháp chế |
| R-15 | SEO kém do SPA chỉ render phía trình duyệt | Trung bình | UNKNOWN | `index.html` + React SPA | Pre-render/SSR | Tech lead |
| R-16 | Người nhận quà không biết phải quay video khui hàng | Cao — khiếu nại | UNKNOWN | D-07 + D-02 | Hướng dẫn trên thiệp & trang QR | PO |

---

## 30. Câu hỏi còn mở

### P0 — phải trả lời trước khi phát triển
| ID | Câu hỏi | Ảnh hưởng |
|---|---|---|
| Q-05 | Ba đèn trong bộ Sum Vầy là sản phẩm nào, giá lẻ bao nhiêu? | Catalog, data model |
| Q-09 | Thuế suất VAT? VAT có tính trên phí ship? | Tính giá |
| Q-11 | Công thức phí ship? | Checkout |
| Q-10, C-1…C-3, C-5 | Thiết kế coupon (C-4 đã chốt: 1 coupon/đơn, D-41) | Data model, tính giá |
| Q-15 | Hạn link thanh toán payOS? | Vòng đời đơn |
| Q-16 | Hoàn tiền payOS: tự động hay thủ công? | Thanh toán |
| Q-08 | Soạn lời chúc lúc nào; chưa soạn khi tới hạn khóa thì sao? | Checkout, lời chúc |
| Q-26 | Media lưu bao lâu nếu không ai xác nhận? | Lưu trữ |
| I-04 | `[LEGAL]` niêm yết giá chưa VAT (I-14 đã duyệt — D-67) | Pháp lý |

### P1 — trước khi làm tính năng liên quan
| ID | Câu hỏi |
|---|---|
| Q-06 | Hoàn tiền khi trả một đèn trong bộ |
| Q-12 | Thiệp/lời chúc có tính phí? |
| Q-14 | Admin có xem/kiểm duyệt lời chúc? |
| Q-19 | Thời hạn đổi trả, tính từ mốc nào |
| Q-20 | Hoàn bao nhiêu khi hủy đơn đã PAID ở IN_PRODUCTION/PACKED |
| Q-22 | Lý do đổi trả hợp lệ; hoàn tiền hay làm lại |
| Q-24 | Kênh thông báo (email/SMS/Zalo) |
| Q-25 | QR của đơn tự mua không có lời chúc dẫn tới đâu |
| Q-27 | Người mua xem trước trang QR? |
| Q-29 | Lời chúc không phải tiếng Việt → thiệp viết tay xử lý thế nào |
| Q-32 | `[LEGAL]` Banner đồng ý cookie/GA |
| Q-33 | Có cần lớp bảo vệ thêm (PIN) cho trang lời chúc? |
| I-15 | `[LEGAL]` Quyền xóa lịch sử chat |
| Q-35 | Đăng ký bằng email đã tồn tại hiện "Email này đã được đăng ký" (tiện cho khách nhưng cho phép dò email có tài khoản), hay luôn báo "kiểm tra email" giống quên mật khẩu? Hiện code báo "đã đăng ký" `[ASSUMPTION]` |
| Q-36 | `[LEGAL]` Dùng ảnh tư liệu public domain/CC0 (tranh Đông Hồ, tranh giấy dó của Bảo tàng Mỹ thuật Việt Nam) trên trang bán hàng — có cần xin phép bảo tàng? (§31.4, T-27) |

### P2 — có thể quyết định sau
| ID | Câu hỏi |
|---|---|
| Q-07 | Giới hạn số lượng / "tạm hết hàng" |
| Q-21 | Phiếu giao hàng không in giá |
| Q-23 | Testimonial thật hay placeholder (gồm câu "…quá trình đèn được làm cho riêng mình" — `testimonials.items[2]` trong `src/i18n/messages/*`) |
| — | KPI; chỉ số hiệu năng; giữ hay bỏ form newsletter (G-11) |

---

## 31. Kiểm tra chất lượng & khoảng trống so với hiện trạng

### 31.1 Kiểm tra chất lượng yêu cầu

| Tiêu chí | Kết quả |
|---|---|
| Đầy đủ | Thiếu: công thức phí ship, VAT, coupon, giá lẻ Sum Vầy — đều là P0 |
| Nhất quán | D-04 ↔ D-21 (coupon) đã giải quyết bằng D-21. D-22 ↔ D-32 (quốc tế) đã giải quyết bằng D-32. Mâu thuẫn D-13 (sửa đến SHIPPED) ↔ thiệp viết tay lúc PACKED đã giải quyết bằng BR-MSG-008 (D-41) |
| Mơ hồ | "Chỉ đọc thông tin thật" đã được cụ thể hóa thành BR-AI-001…003. "Private" đã cụ thể hóa thành token (BR-QR-001) |
| Kiểm thử được | Các BR có nhãn `[BA DECISION REQUIRED]` chưa kiểm thử được |
| Khả thi | Không phát hiện yêu cầu bất khả thi sau D-01 (video theo lô) |
| Bảo mật | Token QR, webhook payOS, quyền dữ liệu của Mây, dò mã đơn — đã có quy tắc |
| Đồng thời | Hủy ↔ SHIPPED; đặt hàng hai lần; webhook trùng — đã có quy tắc |
| Khôi phục lỗi | payOS chậm/lỗi, OpenAI lỗi — đã có quy tắc |
| Toàn vẹn dữ liệu | Giá chốt lúc tạo đơn; coupon kiểm tra lại lúc tạo đơn; webhook idempotent |

### 31.2 Khoảng trống so với code hiện tại

Cập nhật v0.2. Trạng thái: **Đã xử lý** / **Một phần** / **Còn thiếu**.

| ID | Yêu cầu | Hiện trạng | Loại | Trạng thái |
|---|---|---|---|---|
| G-01 | Catalog từ DB, giá dạng số | Bảng `products`, giá số nguyên VND; `GET /api/products` (`server/routes/catalog.js`) | — | **Đã xử lý** (v0.2) |
| G-02 | Giỏ hàng | `/cart`, `/api/cart/*`, thêm vào giỏ ở thẻ + trang chi tiết (FR-CART-001, D-59…D-61) | — | **Đã xử lý** (v0.7) |
| G-03 | Tài khoản, checkout, thanh toán, đơn | Đã có backend Express + Supabase, routing, tài khoản (FR-ACC-001). Chưa có checkout, thanh toán, đơn | Missing | **Một phần** |
| G-04 | Trang QR lời chúc, QR đèn | Trang QR lô đèn `/lo/:code` (FR-QR-006) đã có. Trang QR lời chúc chưa có | Missing | **Một phần** |
| G-05 | AI Mây | Chat (OpenAI function calling, mặc định tắt — D-55), FAQ offline, tour, hạn mức, ngân sách, lịch sử, cấu hình admin (`server/may/*`, `src/may/*`, `/admin/may`). Chưa có tra đơn (FR-AI-004) | Missing | **Một phần** (v0.6) |
| G-06 | Admin (sản phẩm, đơn, lô, coupon, FAQ, Mây) | `/admin` + `/api/admin/*` (v0.3): sản phẩm, FAQ, lô & video lô. Chưa có: đơn, coupon, cấu hình Mây, đổi trả (chưa có nghiệp vụ tương ứng); tài khoản admin cấp bằng tay trong Supabase (`profiles.role`) | Missing | **Một phần** (v0.3) |
| G-07 | FAQ từ DB (để Mây đọc) | Bảng `faq_entries`, `GET /api/faq` | — | **Đã xử lý** (v0.2) |
| G-08 | Đa ngôn ngữ | vi/en/zh cho giao diện, sản phẩm, FAQ, trang lô; URL `/`, `/en`, `/zh` (D-37) | — | **Đã xử lý** (v0.2) — bản dịch chờ duyệt (G-14) |
| G-09 | Chú thích "chưa gồm VAT" | Component `Price` luôn kèm chú thích (BR-PRC-003) | — | **Đã xử lý** (v0.2) — vẫn chờ `[LEGAL]` I-04 |
| G-10 | Theo dõi đơn, chính sách đổi trả | Link footer vẫn `href="#"` (`src/components/SiteFooter.jsx`) | Missing | **Còn thiếu** — chưa có đơn và nội dung chính sách |
| G-11 | Newsletter | Form vẫn bỏ email (`src/components/SiteFooter.jsx`) | Incorrect | **Còn thiếu** — chờ PO giữ/bỏ (§30 P2) |
| G-12 | SEO | SSR trong Express (D-49): trang công khai có HTML đầy đủ, `lang` và title đúng ngôn ngữ (`server/ssr.js`, `src/entry-server.jsx`) | — | **Đã xử lý** (v0.4) |
| G-13 | Google Analytics | Không có | Missing | **Còn thiếu** |
| G-14 | Bản dịch en/zh | Do đội dev soạn (`src/i18n/messages/*`, `server/data/seed.js`) | Chưa duyệt | **Mới** — chờ PO duyệt `[ASSUMPTION]` |
| G-15 | SEO đa ngôn ngữ | `hreflang`, canonical, meta description theo trang/ngôn ngữ (`src/seo/*`), `/sitemap.xml`, `/robots.txt` | — | **Đã xử lý** (v0.4) |
| G-16 | Cấu hình Supabase Auth | Cần đặt Site URL `https://lamvi.vercel.app` và Redirect URLs (`/reset-password` × 3 ngôn ngữ). Xác nhận email: đã bỏ (D-63) | Cấu hình | 🟡 Một phần (v0.11) — xem `docs/knowledge/deploy-vercel.md` |
| G-17 | Lưu phiên đăng nhập | Token ở `localStorage` (T-10) — rủi ro XSS | Technical debt | **Mới** — xem lại trước go-live |
| G-18 | Đặt lại mật khẩu | `POST /api/auth/reset-password` nhận mọi access token hợp lệ, không riêng token khôi phục; chưa có chức năng đổi mật khẩu (có hỏi mật khẩu cũ) | Security | **Mới** — cần kiểm tra token khôi phục trước go-live |
| G-19 | Khoá tài khoản | §7 có trạng thái User "bị khóa" nhưng chưa có cơ chế khoá | Missing | **Mới** — làm cùng admin (G-06) |
| G-20 | Chống dò/spam đăng nhập, đăng ký, quên mật khẩu | Chỉ dựa vào giới hạn của Supabase; chưa có giới hạn theo IP ở tầng app | Security | **Mới** |
| G-21 | Nhật ký thay đổi của admin | Sửa sản phẩm/FAQ/lô chưa ghi log (NFR-AUD-001 chỉ bắt buộc cho đơn, coupon, hoàn tiền) | Missing | **Mới** (v0.3) — bắt buộc khi làm coupon/đơn |
| G-23 | Ảnh chia sẻ mạng xã hội / ảnh sản phẩm | Chưa có ảnh sản phẩm thật (thẻ sản phẩm dùng hình đèn SVG) nên chưa có `og:image`, JSON-LD không có `image` (Google khuyến nghị có) | Missing | **Mới** (v0.4) |
| G-24 | Dashboard IT | `/it` + `/api/it/*` (FR-IT-001…004) | — | **Đã xử lý** (v0.5) |
| G-25 | Cảnh báo chủ động | Dashboard chỉ xem; chưa gửi cảnh báo khi lỗi 5xx tăng hay tích hợp lỗi (kênh thông báo chờ Q-24) | Missing | **Mới** (v0.5) |
| G-26 | Giám sát payOS webhook, chi phí OpenAI (NFR-OBS-001) | Chưa có vì chưa tích hợp payOS/OpenAI; dashboard chỉ báo đã cấu hình biến môi trường chưa | Missing | **Mới** (v0.5) |
| G-27 | Nhật ký bật/tắt bảo trì | Chỉ lưu người/thời điểm đổi lần cuối (`app_settings`) + log server; chưa có lịch sử đầy đủ | Missing | **Mới** (v0.5) |
| G-28 | Nội dung lỗi 5xx lưu cho IT | Lưu thông điệp lỗi nội bộ (có thể chứa chi tiết DB); chưa lọc dữ liệu cá nhân | Privacy | **Mới** (v0.5) |
| G-29 | Mây tra đơn (FR-AI-004, US-008) | Chưa có đơn hàng nên chưa có `get_my_orders` / `lookup_order` và chống dò mã đơn | Missing | **Mới** (v0.6) — làm cùng đơn hàng |
| G-30 | Mây — quyền xoá lịch sử chat, xoá khi xoá tài khoản | Chưa có — chờ `[LEGAL]` I-15 | Missing | **Mới** (v0.6) |
| G-31 | Nút "Dịch tự động" dùng chung ngân sách Mây (§22.4) | Chưa có trang QR lời chúc nên chưa có | Missing | **Mới** (v0.6) |
| G-32 | Giỏ hàng trên Supabase | Giới hạn 50 dòng và gộp giỏ là đọc-rồi-ghi, hai thao tác đồng thời có thể vượt 50 dòng / lệch số lượng; bảng `cart_items` bật RLS không có policy (chỉ server dùng service role truy cập) | Rủi ro thấp | **Mới** (v0.7) |
| G-33 | Hình minh hoạ thay cho ảnh thật | Đèn, chân dung nghệ nhân (khung "ảnh cũ"), hoạ tiết đều là SVG minh hoạ; chân dung không phải ảnh thật của nghệ nhân. Khi có ảnh thật phải thay, và không trình bày minh hoạ như ảnh tư liệu | Content | **Mới** (v0.6) — liên quan G-23 |
| G-34 | Nội dung khi chưa chạy JS | Các khối có hiệu ứng xuất hiện nằm trong HTML SSR (máy tìm kiếm đọc được) nhưng `opacity: 0` tới khi JS chạy. Đã giảm: màn hình đầu (tiêu đề, LCP) chạy bằng CSS nên hiện ngay; trình duyệt tắt JS được CSS `@media (scripting: none)` ép hiện. Còn lại: JS tải chậm thì các khối dưới màn hình đầu chờ hydrate mới hiện | Technical debt | 🟡 Một phần (v0.6) |
| G-35 | Số liệu API trên Vercel (T-18) | Flush bằng timer/SIGTERM; instance serverless có thể bị đóng trước khi flush nên dashboard IT có thể thiếu số liệu | Technical debt | **Mới** (v0.9) |
| G-36 | Deploy Vercel chưa kiểm chứng thật (T-33) | Mới thử local giả lập `VERCEL=1`; chưa deploy Preview/Production, chưa kiểm rewrite/`includeFiles` trên nền tảng | Chưa kiểm chứng | **Mới** (v0.9) |
| G-37 | Không xác minh chủ email khi đăng ký (D-63) | Ai cũng đăng ký được bằng email của người khác; khi chủ thật muốn dùng email đó phải "Quên mật khẩu". Đăng ký qua admin API không chịu giới hạn đăng ký của Supabase → G-20 càng cần thiết | Security | **Mới** (v0.11) |
| G-38 | Đăng ký: tạo user Supabase xong nhưng ghi hồ sơ lỗi | User đã tồn tại và đăng nhập được nhưng mất họ tên/SĐT/ngôn ngữ đã nhập (hồ sơ rỗng tạo lại ở `/me`); đăng ký lại báo email đã có. Chưa rollback (`admin.deleteUser`) | Rủi ro thấp | **Mới** (v0.11) |
| G-39 | Tài khoản đăng ký trước D-63 chưa xác nhận email | Không đăng nhập được (EMAIL_NOT_CONFIRMED) và không còn thư xác nhận; lối ra: "Quên mật khẩu" hoặc xác nhận tay trên Supabase dashboard. Chưa kiểm trên project thật | Vận hành | **Mới** (v0.11) — hiện Supabase chưa có user nào |
| G-40 | Dashboard tài khoản: mục đơn hàng (v0.12) | `/account` đã thiết kế lại thành dashboard tab dọc; tab đơn hàng và ô số liệu đơn hàng mới là chỗ chờ, làm thật cùng FR-ACC-002/003. Số câu hỏi Mây chỉ tính trên 100 tin gần nhất | Missing | **Mới** (v0.12) |
| G-41 | Mây không gửi được link bấm được tới trang sản phẩm | Khung chat chỉ hiển thị văn bản thuần; nếu cần link phải làm link nội bộ do server tạo (không để model viết URL) | UX | **Mới** (v0.18) |
| G-22 | Tải video lô bằng signed upload URL | Đã kiểm thử bằng adapter bộ nhớ; chưa thử với Supabase thật. Giới hạn dung lượng file của gói Supabase có thể nhỏ hơn `MAX_VIDEO_MB` (500) — phải chỉnh một trong hai cho khớp | Chưa kiểm chứng | **Mới** (v0.3) |

### 31.3 Nội dung web phải sửa (Incorrect)

Cập nhật v0.3. Nội dung đã chuyển sang `src/i18n/messages/{vi,en,zh}.js` (giao diện) và `server/data/seed.js` (FAQ). Câu chữ tiếng Việt lấy theo đợt sửa 1 do BA soạn (nhánh `fix/web-copy-ba-spec`, đã gộp master), trừ các dòng ghi chú khác. Bản en/zh dịch theo bản vi (G-14). Marketing có thể chỉnh văn phong nhưng không đổi ý nghĩa ở cột "Căn cứ".

| Vị trí cũ | Trước | Sau (key i18n / dữ liệu) | Căn cứ | Trạng thái |
|---|---|---|---|---|
| `src/components/Faq.jsx:7` | "Vĩnh viễn…không giới hạn thời gian xem lại" | FAQ 1: chữ + video lô vĩnh viễn; giọng nói/video 30 ngày từ khi người nhận xác nhận, bấm "Tải về" để giữ | D-10, D-12, D-26 | ✅ Đã sửa |
| `src/components/Faq.jsx:11` | "sửa…cho đến khi đèn được đóng gói" | FAQ 2: phần chữ khóa khi đơn đã đóng gói; giọng nói/video sửa được đến khi đơn gửi đi | D-13, BR-MSG-008 (D-41) | ✅ Đã sửa — khác đợt 1 vì BR-MSG-008 đã được duyệt (ghi chú 1 của đợt 1) |
| `src/App.jsx:394-396` | "Mỗi chiếc đèn mang một mã QR riêng…được lưu giữ lâu dài" | `qr.text`: tách QR thiệp cảm ơn (lời chúc) và QR khắc trên đèn (video mẻ đèn); không cần cài ứng dụng | D-01, D-26, D-28 | ✅ Đã sửa |
| `src/App.jsx:399` | "Video quá trình làm đèn của chính chiếc đèn này" | `qr.points[0]`: "Video quá trình làm ra mẻ đèn, xem lại bất cứ lúc nào" | D-01, D-10 | ✅ Đã sửa |
| `src/App.jsx:401` | "Lưu lại vĩnh viễn trong sổ lưu niệm" | `qr.points[2]`: chữ lưu mãi; giọng nói/video lưu 30 ngày từ khi xác nhận, tải về được | D-12, D-26 | ✅ Đã sửa |
| `src/App.jsx:48` | "Gắn mã riêng lưu câu chuyện của bạn" | `process.steps[3].note`: "Khắc mã mở video hành trình của mẻ đèn" | D-01, D-43 | ✅ Đã sửa |
| `src/App.jsx:300-301` | Thiệp + QR chỉ nhắc cho đơn Mua tặng | `products.giftCopy` / `products.selfCopy`: thêm thiệp cảm ơn có mã QR; đơn tự mua quét mã trên đèn + ô "Thêm lời chúc" | D-01, D-14, D-28 | ✅ Đã sửa |
| `src/App.jsx:360` | "Theo dõi đèn của bạn từng bước" | `process.title`: "Theo dõi đơn của bạn qua từng công đoạn" | D-01, C-11 | ✅ Đã sửa |
| `src/components/Marquee.jsx:5` | "LƯU GIỮ KÝ ỨC VĨNH VIỄN" | `marquee[3]`: "MỖI LỜI CHÚC, MỘT KỶ NIỆM" | D-26 | ✅ Đã sửa |
| `src/App.jsx:20-42` | Giá không có chú thích VAT | Component `Price` + "chưa gồm VAT" ở mọi nơi hiển thị giá | D-03, BR-PRC-003 | ✅ Đã sửa — vẫn chờ `[LEGAL]` I-04 |
| `src/App.jsx:220` | "1 — câu chuyện riêng mỗi đèn" | `story.statStory`: "lời chúc riêng cho mỗi món quà" | D-01, D-45 | ✅ Đã sửa |
| `src/App.jsx:426` | Mock điện thoại "Hành trình chiếc đèn của bạn" | `qr.phoneCaption`: "Hành trình mẻ đèn của bạn" | D-01, D-45 | ✅ Đã sửa |
| `src/App.jsx:209-212` | "…câu chuyện của gia đình bạn cũng được lưu giữ theo cách bền bỉ như vậy" | `story.text`: "…được thắp lên từ chính chất liệu bền bỉ ấy" | D-26 | ✅ Đã sửa (phát hiện ở v0.2) — câu do dev soạn `[ASSUMPTION]`, chờ Marketing |
| `testimonials.items[2]` | "…thấy cả quá trình đèn được làm cho riêng mình" | — | D-01 | ⬜ Chưa sửa — chờ Q-23 |

### 31.4 Giao diện dân gian cổ (v0.6)

Theo yêu cầu khách hàng: "nghệ thuật dân gian, cổ xưa hoài niệm, motion tốt (cả xuất hiện và biến mất), hiệu năng tốt, màu sắc tốt hơn". **Không đổi câu chữ, giá, cam kết hay luồng nghiệp vụ** — mọi chuỗi vẫn lấy từ `src/i18n/messages/*`; không ảnh hưởng §31.3.

| Hạng mục | Đã làm |
|---|---|
| Màu | Bảng màu tranh Đông Hồ đã ngả màu thời gian: giấy điệp ố vàng, mực than tre ngả nâu, đỏ son phai, vàng hoè, xanh chàm bạc, xanh lá |
| Chất cổ | Vân sợi giấy dó, vết ố, viền tối như ảnh cũ, mực in mòn trên mảng màu, chữ lệch khuôn in, số kiểu cổ; logo con dấu son, dấu bưu điện, ảnh cũ viền răng cưa có góc dán album |
| Motion | Mỗi khối hiện ra khi cuộn tới và tan đi theo hướng cuộn khi rời màn hình; tiêu đề hiện như mực loang; thẻ "đóng dấu"; số liệu đếm lên; đèn lookbook thắp sáng khi tới, lịm khi qua; đèn hero bay lên như thả đèn trời khi cuộn đi; header ẩn khi cuộn xuống, hiện khi cuộn lên; FAQ mở như trải cuộn thư |
| NFR-A11Y-001 | Giảm chuyển động → không animation lặp, không dịch chuyển, số liệu hiện giá trị thật ngay (đã kiểm: 0 animation chạy). Trình đọc màn hình luôn đọc giá trị số thật; hoạ tiết `aria-hidden` |
| Hoạ tiết lơ lửng (T-28) | Mây cuộn, mây đôi, dải mây, vân nước, vân gỗ, khói hương trôi chậm sau nội dung ở 9 phần; tự vẽ, mờ cùng tông, tắt khi giảm chuyển động |
| Bảng màu & ảnh thật (T-26, T-27) | Bảng màu cân lại theo bột màu Đông Hồ (giấy điệp 70% · mực 20% · son 7% · hoè 3%), mọi cặp chữ đạt WCAG AA; phòng tranh ở phần Di sản với 11 ảnh tư liệu thật (8 tranh Đông Hồ, 2 tranh giấy dó thế kỷ 18, 1 văn tự giấy dó 1904; tổng ~350 KB ở cỡ 480), có tên, nguồn, ghi chú "không phải ảnh sản phẩm"; design rule ở `docs/knowledge/design-rules.md` |
| Phong cách cổ điển (T-25, tham khảo nguyên tắc trình bày của web bảo tàng/di sản Trung Quốc, dịch sang hoạ tiết Việt) | Bỏ viền đen dày và bóng đổ cứng; nét mảnh, khung viền đôi, góc hoa văn triện, bóng mềm; mái đình làm đường chuyển giữa các phần; ấn triện dọc ở màn hình đầu; thẻ sản phẩm kiểu tranh bồi góc lõm; thiếp thư cho lời khách hàng; tab gạch chân; mây chìm trên nền chàm |
| Hiệu ứng tương tác (tham khảo ý tưởng Aceternity UI, tự viết lại — T-24) | Đèn treo rọi sáng tiêu đề lookbook; quầng đèn theo con trỏ ở hero; thẻ sản phẩm nghiêng 3D; lời nghệ nhân hiện từng chữ; sợi chỉ đỏ theo tiến độ cuộn ở công đoạn; viền chỉ vàng chạy quanh nút chính; lookbook làm mờ đèn không được chọn; đèn trời bay trên nền đêm; chữ MỘC ở footer loang màu son theo con trỏ. Hiệu ứng theo con trỏ chỉ có trên máy có chuột |
| Hiệu năng | Font tự host + preload; `LazyMotion`; animation lặp bằng CSS; texture vẽ trên nền tĩnh. Đo bản build local (không giới hạn mạng, desktop 1440×900): LCP ~1,55 s → ~0,3–0,6 s; CLS 0 → 0–0,02 (chữ tiêu đề đôi khi vẽ trước khi font Fraunces về rồi đổi font; vẫn dưới ngưỡng 0,1); JS 156,2 → 152,4 kB gzip (đã gồm hiệu ứng T-24, T-25) |

- `[ASSUMPTION]` Ngưỡng hiệu năng nội bộ cho trang công khai, chờ PO chốt NFR-PERF-001: LCP ≤ 2,5 s, CLS ≤ 0,1 (mức "tốt" của Core Web Vitals).
- `[ASSUMPTION]` Motion "biến mất" áp dụng khi khối rời khỏi màn hình (cuộn qua), không áp dụng khi chuyển trang (tránh chặn điều hướng và SSR).
- `[LEGAL]` Q-36 — Ảnh tư liệu (tranh Đông Hồ, tranh giấy dó thế kỷ 18 — Wikimedia Commons, public domain/CC0; danh sách ở `public/images/folk/CREDITS.md`) được dùng làm hình văn hoá trên trang bán hàng. Cần pháp chế xác nhận: (1) tình trạng public domain tại Việt Nam của bản chụp tranh dân gian và của ảnh chụp hiện vật bảo tàng (CC0 do người chụp tuyên bố); (2) có cần xin phép Bảo tàng Mỹ thuật Việt Nam khi dùng thương mại không. Chưa có xác nhận thì không đưa lên môi trường thật.
- `[LEGAL]` Q-36 (mở rộng v0.15) — Ảnh nền CC0 của dashboard tài khoản (rawpixel, StockSnap; `public/images/dash/CREDITS.md`) cũng cần pháp chế xác nhận cùng đợt.
- `[LEGAL]` Q-36 (mở rộng v0.16) — Ảnh nền CC0 của trang công khai (`public/images/scene/CREDITS.md`) cũng cần pháp chế xác nhận cùng đợt.
- `[ASSUMPTION]` Chú thích tranh (tên, mô tả, alt vi/en/zh) do dev soạn — chờ Marketing duyệt cùng G-14.
- `[ASSUMPTION]` Tham khảo web Trung Quốc chỉ ở mức nguyên tắc trình bày (nét, khung, khoảng trắng); không dùng chữ Hán, rồng, mái cung điện để web vẫn mang bản sắc Việt.
- ~~`[ASSUMPTION]` Giữ thương hiệu MỘC~~ — thay bởi D-62: tên web và thương hiệu là **LAMVI**.
- Khoảng trống mới: G-33, G-34 (§31.2). Deploy Vercel: G-35, G-36. Dashboard tài khoản: G-40.

---

## Phụ lục A — Nhật ký quyết định

| ID | Quyết định | Trạng thái |
|---|---|---|
| D-01 | Video quá trình làm đèn theo lô, không riêng từng đèn | Hiệu lực |
| D-02 | Người mua chọn giao cho bản thân hoặc người nhận | Hiệu lực |
| D-03 | Giá chưa gồm VAT | Hiệu lực |
| D-04 | Chưa có coupon/giảm giá | **Bị thay bởi D-21** |
| D-05 | Có SEO và Google Analytics | Hiệu lực |
| D-06 | Khách được hủy trước khi gửi hàng | Hiệu lực |
| D-07 | Đổi trả cần video quay từ lúc khui hàng | Hiệu lực |
| D-08 | Bán lẻ từng đèn trong bộ | Hiệu lực |
| D-09 | QR thiệp private, gắn đơn; media lưu 1 tháng, muốn giữ thì tải về | Hiệu lực (mốc tính sửa bởi D-26) |
| D-10 | QR khắc trên đèn: video lưu vĩnh viễn | Hiệu lực |
| D-11 | 1 tháng tính từ lần quét đầu | **Bị thay bởi D-26** |
| D-12 | Lời chúc dạng chữ lưu vĩnh viễn | Hiệu lực |
| D-13 | Không sửa lời chúc sau khi đơn đã gửi | Hiệu lực |
| D-14 | Đơn tự mua có lời chúc nếu tích "Thêm lời chúc" | Hiệu lực |
| D-15 | Mây: nhân vật dẫn tour, trả lời FAQ, tra đơn | Hiệu lực |
| D-16 | Mây đọc từ DB, chỉ thông tin thật | Hiệu lực |
| D-17 | Dùng OpenAI | Hiệu lực |
| D-18 | Chưa đăng nhập thì Mây bị giới hạn câu trả lời | Hiệu lực |
| D-19 | Lịch sử chat cá nhân lưu vĩnh viễn | Hiệu lực |
| D-20 | API lỗi hiện câu kiểu "Mây bị ốm rùi…" | Hiệu lực |
| D-21 | Admin quản lý coupon | Hiệu lực |
| D-22 | Bán và giao quốc tế | **Bị thay bởi D-32** |
| D-23 | Tiếng Trung giản thể | Hiệu lực |
| D-24 | Ngôn ngữ trang QR do người mua chọn; chữ dịch tự động | Hiệu lực (sửa bởi D-27) |
| D-25 | Thiệp viết tay tiếng Việt; thiệp in song ngữ Anh–Việt | Hiệu lực |
| D-26 | Đếm ngược 30 ngày từ lúc người nhận xác nhận nhận hàng và mở link | Hiệu lực |
| D-27 | Hiện bản gốc + nút dịch tự động | Hiệu lực |
| D-28 | Có cả 2 thiệp; thiệp in là thiệp cảm ơn kèm QR đơn hàng | Hiệu lực |
| D-29 | Mây dùng hàm backend; backend kiểm quyền; vãng lai tra đơn bằng mã + SĐT/email | Hiệu lực |
| D-30 | Mây tự bật tour; không thêm giỏ hàng | Hiệu lực |
| D-31 | BA đề xuất hạn mức Mây | Hiệu lực — số liệu ở §22.4 đã duyệt (D-41) |
| D-32 | Tạm chưa bán quốc tế | Hiệu lực |
| D-33 | Mô hình B2C | Hiệu lực |
| D-34 | Không phân tích vận hành; chỉ tập trung web | Hiệu lực |
| D-35 | Thanh toán payOS hoặc COD | Hiệu lực |
| D-36 | Phải có tài khoản mới đặt hàng | Hiệu lực |
| D-37 | Ngôn ngữ nằm trên URL: `/` (vi), `/en/…`, `/zh/…` | Hiệu lực (v0.2) |
| D-38 | Một vai trò Admin duy nhất | Hiệu lực (v0.2) — bổ sung bởi D-51 |
| D-39 | Sản phẩm có trạng thái Draft / Published / Hidden; chỉ Published hiển thị và bán | Hiệu lực (v0.2) |
| D-40 | Thiếu bản dịch thì hiển thị tiếng Việt | Hiệu lực (v0.2) |
| D-41 | PO duyệt toàn bộ mục `[PROPOSAL]` và `[ASSUMPTION]` của v0.1 (gồm BR-PAY-004 chặn COD khi giao người khác — Q-17; BR-MSG-008 khóa chữ khi PACKED — I-10; nút "Tôi đã nhận được quà" không đổi trạng thái đơn — Q-18; 1 coupon/đơn — C-4; C-9; C-10; hạn mức Mây §22.4) | Hiệu lực (v0.2) |
| D-42 | Đăng nhập bằng email + mật khẩu; SĐT chỉ lưu trong hồ sơ | Hiệu lực (v0.2) |
| D-43 | QR khắc trên đèn là mã chung của lô (Q-30) | Hiệu lực (v0.2) |
| D-44 | Trang QR lô đèn đặt `noindex` | Hiệu lực (v0.2) |
| D-45 | Câu chữ: số liệu "lời chúc riêng cho mỗi món quà"; mock điện thoại "Hành trình mẻ đèn của bạn" (Q-34 của nhánh `fix/web-copy-ba-spec`) | Hiệu lực (v0.3) |
| D-46 | Video lô: admin tải file lên Supabase Storage (không dán link ngoài) | Hiệu lực (v0.3) |
| D-47 | Lô đã xuất bản video: được thay video; không được gỡ xuất bản, xoá lô, đổi mã lô | Hiệu lực (v0.3) |
| D-48 | Giao diện admin chỉ tiếng Việt (`/admin`); nội dung sản phẩm/FAQ/lô vẫn nhập đủ vi/en/zh | Hiệu lực (v0.3) |
| D-49 | SEO: SSR trong Express — một server Node phục vụ web + API (không dùng hosting tĩnh) | Hiệu lực (v0.4) |
| D-50 | JSON-LD sản phẩm có giá chưa VAT, ghi `valueAddedTaxIncluded: false` (PO chọn; `[LEGAL]` I-04 vẫn chờ pháp chế) | Hiệu lực (v0.4) |
| D-51 | Thêm vai trò IT: dashboard riêng `/it`; IT có cả quyền Admin; Admin không vào `/it` | Hiệu lực (v0.5) |
| D-52 | Dashboard IT gồm: số liệu API, trạng thái tích hợp, bật/tắt chế độ bảo trì | Hiệu lực (v0.5) |
| D-53 | Số liệu API lưu Supabase | Hiệu lực (v0.5) |
| D-54 | Chế độ bảo trì: web hiện trang bảo trì, API ghi trả 503 | Hiệu lực (v0.5) |
| D-55 | Mây: OpenAI tích hợp đủ nhưng tắt bằng cờ, mặc định tắt (FAQ offline) cho tới khi pháp chế duyệt I-14 | Thay phần "mặc định tắt" bởi D-67; cờ bật/tắt vẫn hiệu lực |
| D-56 | Q-31: kênh hỗ trợ người thật do admin nhập trong cấu hình Mây | Hiệu lực (v0.6) |
| D-57 | US-009: chờ OpenAI tối đa 15 giây rồi hiện câu "ốm" | Hiệu lực (v0.6) |
| D-58 | Ngân sách OpenAI mặc định 20 USD/tháng (admin sửa được) | Hiệu lực (v0.6) |
| D-59 | Q-13: khách vãng lai có giỏ (lưu trình duyệt), gộp vào giỏ tài khoản khi đăng nhập | Hiệu lực (v0.7) |
| D-60 | Tối đa 10 sản phẩm mỗi dòng giỏ | Hiệu lực (v0.7) |
| D-61 | Khi chưa có checkout: nút Thanh toán bắt đăng nhập rồi báo "sắp ra mắt" | Hiệu lực (v0.7) |
| D-62 | Tên web và thương hiệu là **LAMVI** (viết liền, không dấu) ở mọi nơi — logo, tiêu đề trang, câu văn, bản dịch en/zh; không dùng "MỘC" hay "LÂM VỊ" | Hiệu lực (v0.10) |
| D-63 | Bỏ xác nhận email sau khi đăng ký (dự án dùng Supabase gói Free): tài khoản dùng được ngay, không gửi thư xác nhận | Hiệu lực (v0.11) |
| D-64 | Dashboard tài khoản khách dạng tab dọc, không dùng header (và footer) của trang giới thiệu; tối ưu trải nghiệm người dùng | Hiệu lực (v0.12) |
| D-65 | Dashboard tài khoản: phong cách kính mờ (glassmorphism), nền có dải màu như mây khói lơ lửng và đèn trời bay lên khi mới vào trang, thêm giao diện tối | Hiệu lực (v0.14) |
| D-66 | Trang chủ và các trang công khai (sản phẩm, giỏ, đăng nhập/đăng ký, trang lô, 404) có ảnh nền thật cùng chủ đề (đèn trời, sương mây, khói, trời đêm) nhưng khác bộ ảnh của dashboard; không dùng hoạ tiết SVG tự vẽ làm nền | Hiệu lực (v0.16) |
| D-67 | PO duyệt `[LEGAL]` I-14 (gửi nội dung chat của Mây sang OpenAI, máy chủ ngoài VN). Cờ OpenAI của Mây **mặc định bật**; admin vẫn tắt được; không gửi SĐT/email/địa chỉ (NFR-PRV-001) | Hiệu lực (v0.17) |
