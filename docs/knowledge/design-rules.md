# Design rules — LAMVI (web)

Quy tắc thiết kế cho giao diện công khai của LAMVI. Token nằm ở `src/index.css`; component ở `src/styles/App.css`, trang phụ ở `src/styles/pages.css`. Quyết định gốc: T-21…T-28 trong [`decisions.md`](decisions.md).

> Tên thương hiệu: **LAMVI** (viết liền, không dấu) ở mọi nơi — D-62. Không dùng "LAMVI" hay "LÂM VỊ".

## 1. Tinh thần

**Tranh Đông Hồ treo trong một gian đình cũ.** Cổ điển, hoài niệm, tiết chế:

- Nét mảnh, nhiều khoảng trắng; màu phẳng lấy từ bột màu tự nhiên.
- Hoạ tiết Việt: mái đình (nóc, mặt nguyệt, đầu đao), mây cuộn, hoa sen, trống đồng, ấn triện, hoa văn triện, ô hộc cửa bức bàn.
- Tham khảo cách trình bày của web bảo tàng/di sản (Cố Cung, Danh Hoạ Ký, Đôn Hoàng, Thiểm Tây — T-25) **ở mức nguyên tắc**; hoạ tiết giao diện do LAMVI tự vẽ không dùng chữ Hán, rồng, mái cung điện Trung Hoa.
- Tranh tư liệu Việt nguyên bản (Đông Hồ, tranh giấy dó) **giữ nguyên** — kể cả chữ Hán-Nôm và hình rồng vốn có trong tranh; không cắt, không tô lại.

## 2. Màu

### 2.1 Token

| Token | Hex | Tên | Dùng cho |
|---|---|---|---|
| `--diep` | `#f4ede0` | Giấy điệp | Nền trang |
| `--diep-deep` | `#e9dfcb` | Giấy điệp đậm | Nền phần nhấn (lời khách hàng), nhãn |
| `--diep-light` | `#fbf7ef` | Giấy điệp sáng | Mặt thẻ, chữ trên nền tối |
| `--than` | `#2a211b` | Mực than tre | Chữ chính, footer |
| `--than-2` | `#3a2c22` | Mực than nhạt | Dải hoành phi (marquee) |
| `--than-soft` | `#5a4b3e` | Mực loãng | Chữ phụ |
| `--son` | `#a3321f` | Đỏ son | Nút chính, ấn triện, eyebrow, số liệu then chốt |
| `--son-deep` | `#7c2617` | Son đậm | Hover nút, link |
| `--hoe` | `#bf8a3a` | Vàng hoè ngả đồng | Ánh đèn, trống đồng, nét trên nền tối |
| `--hoe-light` | `#e2c68f` | Hoè nhạt | Số liệu/chú thích trên nền chàm |
| `--cham` | `#26374a` | Xanh chàm | Mảng nền tối (Di sản) |
| `--cham-deep` | `#1a2735` | Chàm đêm | Lookbook |
| `--sepia` | `#7a5d3c` | Sepia | Nét, nhãn phụ nhỏ |
| `--la`, `--hong` | `#5b6b4c`, `#c97f66` | Lá, hồng điệp | **Chỉ** trong minh hoạ (đèn, nền tranh) và chỉ số bước |
| `--hair`, `--hair-soft` | sepia 42% / 20% | Nét mảnh | Viền, đường kẻ |

Tên cũ (`--ink`, `--paper`, `--brown`…) là bí danh cho code cũ; code mới dùng tên ở bảng trên.

### 2.2 Tỉ lệ

~70% giấy · ~20% mực (than, chàm) · ~7% son · ~3% hoè. Mỗi màn hình **chỉ một** điểm nhấn son nổi bật (thường là nút chính). Lá và hồng không dùng cho chữ hay nút.

### 2.3 Độ tương phản (đã đo, WCAG)

| Cặp | Tỉ lệ | Mức |
|---|---|---|
| `--than` / `--diep` | 13,5 | AAA |
| `--than-soft` / `--diep` | 7,2 | AAA |
| `--than-soft` / `--diep-deep` | 6,3 | AA |
| `--son` / `--diep` (eyebrow chữ nhỏ) | 6,0 | AA |
| `--diep-light` / `--son` (chữ trên nút) | 6,5 | AA |
| `--hoe-light` / `--cham` | 7,4 | AAA |
| `--diep` / `--cham` | 10,4 | AAA |
| `--sepia` / `--diep` | 5,2 | AA |

Không dùng `--hoe` cho chữ: trên nền sáng và trên `--cham` đều dưới 4,5:1 (4,0 trên chàm). Chữ nhỏ trên nền tối dùng `--hoe-light`.

## 3. Chữ

| Vai trò | Font | Cỡ | Ghi chú |
|---|---|---|---|
| h1 | Fraunces Variable, SOFT 100, 700 | `clamp(2.5rem, 4.6vw, 4.3rem)` | Dòng thứ hai nghiêng, màu son, gạch nền hoè |
| h2 | Fraunces 600 | `clamp(2rem, 3.6vw, 3rem)` | `text-wrap: balance` |
| h3 / tên sản phẩm | Fraunces 600 | 1.45rem | |
| Thân bài | Be Vietnam Pro 400 | 17px / 1.65 | |
| Eyebrow | Be Vietnam Pro 600 | 0.78rem, chữ hoa, `letter-spacing: .18em` | Kẹp giữa hai hoa sen |
| Số liệu | Fraunces 600, `oldstyle-nums` | 1.9–3.2rem | |
| Trích dẫn | Fraunces nghiêng | 1.4rem | Nét dọc mảnh + dấu thoi son |

Font tự host (T-21), preload 6 file. Không thêm font thứ ba.

## 4. Khoảng cách & bố cục

- Phần (section): đệm dọc 110px; ngang 56px (desktop), 24px (≤960px), 16px (≤640px).
- Chiều rộng nội dung: 1240px (hero, sản phẩm), 1160px (lời khách hàng), 1100px (công đoạn), 800px (FAQ).
- Breakpoint: 960px, 640px.
- Nhịp nền: giấy → **mái đình** → chàm → giấy … Chỉ chuyển từ giấy sang mảng tối bằng mái đình (`--roof-mask`, có bản riêng cho màn hẹp).

## 5. Nét, khung, chiều sâu

- **Không** dùng viền dày (≥2px) màu mực, **không** bóng đổ lệch cứng (`4px 4px 0`) — đã bỏ ở T-25.
- Viền: `1px solid var(--hair)`; đường kẻ đôi `3px double var(--hair)` cho thanh điều hướng, dải hoành phi, danh sách.
- Bóng: `--print` (thẻ nhỏ), `--print-lg` (tranh treo, thẻ sản phẩm).
- Góc: 2–3px cho khung/nút; tròn cho chỉ số và avatar; vòm (`999px 999px 16px 16px`) chỉ cho lookbook.
- Khung có sẵn:
  - **Tranh bồi**: nền lụa `--diep-light`, đệm 12px, đường chỉ `inset 6px` (`--hair-soft`) — thẻ sản phẩm, khung ảnh chi tiết, phòng tranh.
  - **Ô hộc góc lõm**: `.product-art::after` khoét 4 góc.
  - **Thiếp thư**: 4 góc hoa văn triện `--corner-*` + khung trong `inset 16px`.

## 6. Hoạ tiết

| Hoạ tiết | Nơi dùng | Component/token |
|---|---|---|
| Ấn triện son | Logo, nhãn "Bán chạy", ấn dọc ở hero | `Seal`, `VerticalSeal` |
| Mái đình | Đường chuyển sang mảng tối | `--roof-mask` |
| Mây cuộn | Hero (nét sepia mảnh), mây chìm trên nền chàm | `Cloud`, `--pat-cloud` |
| Hoa sen | Eyebrow, dấu ngăn marquee | `Lotus` |
| Trống đồng | Sau đèn ở hero | `DrumSun` |
| Hoa văn triện | Góc thiếp thư | `--corner-*` |
| Đèn giấy khắc gỗ | Minh hoạ sản phẩm | `Lantern` |

Hoạ tiết là trang trí → `aria-hidden="true"`.

### 6.1 Cảnh nền ảnh thật (`Scene`, D-66 — thay hoạ tiết lơ lửng T-28)

Người dùng không muốn nền tự vẽ bằng SVG → mỗi phần trang chủ và đầu các trang công khai dùng **ảnh thật CC0** (`public/images/scene/`, nguồn ở `CREDITS.md`). `FloatingMotifs` và `src/data/motifs.js` đã gỡ.

| Nơi | Ảnh |
|---|---|
| Hero | Ruộng bậc thang trong sương + khói mực + 7 đèn trời bay lên một lượt khi vào |
| Di sản (chàm) | Hòn đá trong sương (xám, 11%) + khói hương trắng ngà |
| Nghệ nhân | Khói mực ở góc |
| Sản phẩm | Trời mây vàng (dải trên, mờ dần) |
| Lookbook (đêm) | Trời đêm đầy đèn trời + khói lửa; đèn trời bay lên là ảnh đèn thật tách nền |
| Công đoạn | Thung lũng sương có nắng |
| QR | Mây hoàng hôn (từ phải, mờ về trái) |
| Lời khách | Hồ sương bình minh |
| Hỏi đáp | Biển mây (dưới) |
| Đăng nhập/đăng ký/quên, đặt lại mật khẩu | Biển mây rõ hơn + 4 đèn bay; form trong thẻ kính mờ |
| Chi tiết sản phẩm · Giỏ hàng · Trang lô | Dải ảnh đầu trang mờ dần: trời mây vàng · hồ sương làng · thung lũng sương |
| 404 | Khung trời sao chàm đêm bo 24px + 5 đèn bay |

Quy tắc:
- Ảnh là nền không khí: lọc sepia nhẹ trên nền giấy, độ đậm 20–40%, **mờ dần bằng mask** về phía chữ và ở bốn mép phần (không lộ khung chữ nhật). Không đặt đè làm giảm tương phản chữ.
- Hai cỡ WebP (640/1280) qua `srcset`, `loading="lazy"` (trừ hero: `eager` + `fetchpriority="low"` — chữ hero vẫn là LCP). Tổng ảnh trang chủ < 600 KB.
- Khói: ảnh khói nền đen/trắng tách thành trong suốt; trôi 42s qua lại bằng `transform`. Đèn trời bay lên **một lượt**.
- Giảm chuyển động: khói đứng yên, không đèn bay. Màn ≤640px: bớt khói và đèn.

## 7. Hình ảnh

### 7.1 Nguồn và bản quyền

- Hai bộ ảnh nền: `public/images/dash` (dashboard) và `public/images/scene` (trang công khai) — không dùng lại ảnh giữa hai bộ.

- Ảnh nền trang trí (trời, sương, khói — không phải ảnh tư liệu, không phải ảnh sản phẩm) cũng theo quy tắc này; nguồn tìm: Openverse (lọc `license=cc0,pdm`), Wikimedia Commons. Unsplash/Pexels/Pixabay chặn truy cập tự động từ máy chủ; Canva không dùng (giấy phép chỉ cho dùng trong thiết kế Canva).

- Chỉ dùng ảnh **public domain** hoặc **CC0** (ưu tiên), hoặc giấy phép cho phép dùng thương mại có ghi công. Ghi đầy đủ trong `public/images/folk/CREDITS.md` và `src/data/folkArt.js` (tên file gốc, tác giả, giấy phép, link).
- Không dùng ảnh có **trẻ em** hay người nhận diện được.
- Việc dùng ảnh bên ngoài trên trang bán hàng thuộc `[LEGAL]` — pháp chế duyệt trước go-live (xem spec §31.4).

### 7.2 Không gây hiểu lầm

- Ảnh tư liệu (tranh Đông Hồ, tranh giấy dó cổ) **không** được đặt ở vị trí ảnh sản phẩm, ảnh nghệ nhân hay ảnh xưởng LAMVI.
- Mọi ảnh tư liệu có chú thích nguồn ngay dưới ảnh.
- Minh hoạ SVG (đèn, chân dung nghệ nhân) vẫn là minh hoạ cho tới khi có ảnh thật (G-23, G-33).

### 7.3 Xử lý và hiển thị

- WebP tối đa hai cỡ (480px, 960px) qua `srcset`, **không phóng to** ảnh nguồn nhỏ (ảnh <480px giữ một bản đúng cỡ gốc — `widths` trong `folkArt.js`); `sizes` theo bề rộng hiển thị thật; `loading="lazy"`, `decoding="async"`, luôn có `width`/`height` để tránh nhảy bố cục.
- Tải từ Commons: dùng bản thu nhỏ cỡ chuẩn (`thumb.wikimedia.org`, 330/500/960/1280) với User-Agent riêng — file gốc bị giới hạn tần suất.
- Không lọc màu, không cắt mất chi tiết của tranh; trình bày như tranh treo (khung tranh bồi) trên nền chàm hoặc giấy.
- `alt` qua i18n (vi/en/zh), mô tả nội dung tranh.

## 8. Motion

| Loại | Quy tắc |
|---|---|
| Xuất hiện/biến mất | `Reveal` + biến thể `rise` / `ink` / `stamp` / `group` (`src/lib/motion.js`); hiện khi cuộn tới, tan theo hướng cuộn |
| Thời lượng | vào 0.7–0.9s (`EASE_OUT`), ra 0.4–0.45s (`EASE_IN`); lò xo thẻ `stiffness 170, damping 18` |
| Lặp nền | CSS transform/opacity: đèn đung đưa 5.5s, trống đồng 140s, marquee 34s, đèn trời 22–30s |
| Theo con trỏ (T-24) | Chỉ khi `useFinePointer()` và không giảm chuyển động; qua motion value, không re-render |
| Màn hình đầu | Animation CSS (không chờ JS) |
| Giảm chuyển động | Tắt mọi animation lặp và dịch chuyển; nội dung, số liệu hiện ngay |

## 9. Hiệu năng

- Ngân sách `[ASSUMPTION]` (NFR-PERF-001): LCP ≤ 2,5s, CLS ≤ 0,1.
- Không lớp phủ `position: fixed` có `mix-blend-mode`/`backdrop-filter`. `backdrop-filter` chỉ dùng cho phần tử cuộn cùng trang (dashboard, T-35), không cho phần tử dính/cố định.
- Texture là data-URI SVG nhỏ trong biến CSS.
- Ảnh: WebP, lazy, có kích thước; tổng ảnh tư liệu trên trang chủ < 600 KB ở desktop.

## 10. Tiếp cận

- Tương phản theo §2.3; focus ring `2px solid var(--son)`.
- Trình đọc màn hình đọc giá trị số thật (`.sr-only` trong `CountUp`).
- Hoạ tiết, hiệu ứng: `aria-hidden`.

## 11. Nên / không nên

| Nên | Không nên |
|---|---|
| Nét mảnh sepia, đường kẻ đôi | Viền đen dày, bóng đổ lệch cứng |
| Một điểm nhấn son mỗi màn hình | Nhiều nút son cạnh nhau |
| Mái đình khi chuyển sang mảng tối | Sóng/đường cắt tuỳ ý |
| Ảnh tư liệu có chú thích nguồn | Ảnh tư liệu đặt như ảnh sản phẩm/nghệ nhân |
| Hoạ tiết Việt | Tự vẽ chữ Hán, rồng, mái cung điện Trung Hoa lên giao diện |
| Hiệu ứng tắt khi giảm chuyển động | Animation bằng `filter`/`box-shadow` lặp liên tục |

## 11a. Checkout và trang đơn hàng (v0.19)

Hai trang mới dùng lại đúng hệ khung có sẵn, không tạo kiểu riêng:

| Thành phần | Cách làm |
|---|---|
| Mỗi bước checkout | Khung **tranh bồi** (`.account-card`): nền `--diep-light`, góc 2px, đường chỉ `inset 6px`, bóng `--print` |
| Nhãn bước | Kiểu eyebrow (son, chữ hoa, `letter-spacing .18em`) + số thứ tự trong **ấn son vuông** + hoa sen |
| Nút chọn (loại đơn, người nhận) | Thẻ giấy nét mảnh; thẻ đang chọn viền son + vạch son dưới đáy. `aria-pressed` cho trình đọc màn hình |
| Tóm tắt đơn, trang cảm ơn | Khung **thiếp thư**: bốn góc hoa văn triện `--corner-*`, khung trong `inset 16px`, bóng `--print-lg` |
| Dòng tổng | Đường kẻ đôi `3px double var(--hair)`; nhãn cỡ thân bài, số tiền Fraunces 1.5rem `oldstyle-nums` |
| Tiến độ đơn (C-11) | 5 mốc nối bằng **sợi chỉ**: nét `--hair-soft`, đoạn đã qua chuyển sang son; chấm tròn 11px |
| Cảnh nền | `Scene` như các trang công khai khác: `/checkout` → `mist-terraces`, `/don-hang/:code` → `golden-clouds` + 3 đèn trời bay lên |
| Motion | `Reveal` cho từng bước và từng thẻ; tự tắt khi bật giảm chuyển động |

`.account-card` (dùng chung với giỏ hàng, admin, dashboard IT) đã đổi từ khung bo 18px + bóng mềm
của bản trước T-25 sang khung tranh bồi — nên các trang đó cũng đồng bộ theo.

## 12. Dashboard tài khoản (`/account`)

Trang dạng ứng dụng: `LocaleLayout` bỏ header/footer trang giới thiệu (`APP_PAGES`, class `.page-app`, bỏ cả viền tối quanh khung nhìn). Style ở mục "Dashboard tài khoản" cuối `pages.css`. Tinh thần **thanh thoát**, bo góc mềm, có minh hoạ cho sinh động; lấy nguyên tắc từ dashboard Trung Quốc (T-34): nhiều khoảng trắng, nền giấy sáng, chỉ nét 1px, không bóng đổ, một điểm nhấn son.

| Phần | Cách trình bày |
|---|---|
| Nét | Một token riêng `--dash-line` (sepia 18%) cho mọi đường kẻ, `--dash-soft` (7%) cho nền hover/tab chọn. Không `--print`, không khung viền đôi, không góc triện trong dashboard |
| Thanh bên (264px, dính, cao 100dvh) | Nền `--diep-light`, một nét mảnh bên phải; logo ấn triện nhỏ + đổi ngôn ngữ (gạch chân son ở ngôn ngữ đang chọn) |
| Avatar | Vòng son mảnh (chỉ nét, không tô), chữ cái đầu của tên gọi màu son, Fraunces 500 |
| Tab dọc | Biểu tượng nét 1,2px + nhãn ngắn, không xuống dòng; tab chọn: nền `--dash-soft`, chữ đậm, vạch son 2px ở mép thanh bên; huy hiệu là chữ nhỏ sepia, không viên |
| Bề rộng vùng nội dung | Tối đa 1320px, **căn giữa** trong phần còn lại bên phải thanh bên (không dồn trái để lại khoảng trống); tab một thẻ trải hết cột, riêng Hồ sơ tối đa 980px căn giữa; hai thẻ hàng dưới Tổng quan cao bằng nhau |
| Đầu vùng nội dung | Eyebrow sepia chữ thưa, h1 Fraunces 500, câu phụ theo tab, đèn nhỏ 64px; một nét mảnh bên dưới |
| Số liệu | Dải không khung, ngăn bằng nét dọc (≤640px: nét ngang, số trái chữ phải); số Fraunces **300** 3rem `oldstyle-nums` |
| Thẻ | Nền `--diep-light`, nét `--dash-line`, bo 4px, không bóng; tiêu đề mục có **vạch son 3px** phía trước |
| Liên kết phụ | Chữ son đậm, gạch chân mọc ra khi hover/focus (không gạch sẵn) |
| Chat Mây | Nhãn ngày chữ thưa giữa hai nét mảnh; tin khách nền `--diep-deep`, tin Mây nền trong viền mảnh; bo 12px, góc phía người nói 2px |
| Màn ≤960px | Thanh bên tách (`display: contents`): đầu trang → tab ngang gạch chân son, dính trên cùng (ẩn biểu tượng) → nội dung → chân |
| Màn ≤640px (v0.16) | Kiểu ứng dụng: tab thành **thanh điều hướng cố định ở đáy** (4 mục, biểu tượng + nhãn, nền đục, không làm mờ; huy hiệu chữ thành chấm, huy hiệu số thành viên son nhỏ); 3 ô số liệu một hàng, chạm cả ô; nút Mây dời lên trên thanh |
| Motion | Đổi tab: `dash-in` 0.6s, dịch 6px; ô số liệu lệch 80ms; tắt khi giảm chuyển động |
| Bo góc (v0.13) | Thẻ và dải số liệu 20px (≤640px: 18px), khung đầu trang 24px, tab 12px, liên kết thanh bên 10px, ô nhập 12px, nút và nhãn dạng viên (999px), bong bóng chat 16px (góc phía người nói 4px) |
| Kính mờ (v0.14, T-35) | `.dash-top/.dash-stats/.dash-card/.dash-promo`: nền giấy trong 58%, `backdrop-filter: blur(18px) saturate(150%)`, viền trắng 70% 1px, bóng mềm; thanh bên và thanh tab mobile (phần tử dính) chỉ nền trong, **không** làm mờ (§9). Có `@supports` dự phòng tăng độ đục |
| Nền (v0.15) | `DashSky` dùng **ảnh thật CC0** (`public/images/dash/`, nguồn ở `CREDITS.md`): trời sương núi (sáng, lọc sepia, mờ 38%) / trời đêm đầy đèn trời (tối), phủ màn hình đầu và mờ dần; 3 lớp khói thật (ảnh khói nền đen tách theo độ sáng) trôi 48–60s; 8 đèn trời thật (ảnh tách nền) bay lên **một lượt** khi vào trang. Cảnh đầu trang: ảnh cùng bộ + 3 đèn trời thật trôi nhẹ. Không dùng SVG/gradient tự vẽ cho nền. Giảm chuyển động: khói và đèn đứng yên, không đèn bay |
| Giao diện tối (v0.14) | "Đêm hội đèn": `--diep` #141c27, `--diep-light` #1b2533, chữ `--than` #efe6d6 (12,5:1), `--than-soft` #c7b9a3 (8:1), `--sepia` #c9ab82 (7:1), `--son` #e27a5f / `--son-deep` #f0937a (link 6,7:1); nút chính giữ son đậm #b3402a chữ sáng (5,3:1). Khai báo lại bí danh cũ (`--ink-soft`, `--cream`…) trong `.dash[data-theme='dark']`. Minh hoạ nét mực đặt trên đĩa giấy sáng có quầng như đèn thắp. Nút chuyển ở hàng logo, lưu `moc.dashTheme` |
| Minh hoạ (v0.13) | SVG tự vẽ ở `src/components/DashArt.jsx`, lối khắc gỗ nét 1,5px cùng bảng màu: cảnh đầu trang (dây 3 đèn trước trống đồng mờ, mây), hộp quà, phong thư ấn son, 4 công đoạn (giấy dó, khung tre, phơi nắng, đóng gói QR); kèm đèn và Mây có sẵn. Hình đặt trong nền tròn `--diep`. **Không** dùng ảnh tư liệu trong dashboard (§7.2) |

## 12a. Trang nội bộ: quản trị (`/admin`) và dashboard IT (`/it`) — v0.19

Cùng là **trang ứng dụng** như `/account`, nên dùng lại ngôn ngữ ở §12 chứ không phải khung tranh
bồi của trang công khai. Cả hai chia sẻ `.admin` / `.admin-nav` / `.admin-main` nên sửa một lần
là cả hai theo.

| Phần | Cách trình bày |
|---|---|
| Nét | `--dash-line` (sepia 18%) cho mọi đường kẻ, `--dash-soft` (7%) cho nền hover/mục đang mở. Không `--print`, không khung viền đôi, không góc triện |
| Thanh bên (252px, dính, cao 100dvh) | Ấn triện `Seal` + nhãn khu vực chữ thưa sepia; mục điều hướng có biểu tượng nét 1,2px (`src/admin/NavIcons.jsx`); mục đang mở: nền `--dash-soft`, chữ đậm, vạch son 2px ở mép thanh bên. Chân thanh bên tách bằng một nét mảnh |
| Vùng nội dung | Tối đa 1240px (IT: 1320px), **căn giữa** trong phần còn lại — không dồn trái |
| Đầu trang (`PageHead`) | Tiêu đề Fraunces 500 + một nét mảnh bên dưới; hành động (nút, ô lọc) căn phải. **Chỉ đặt eyebrow khi nó nói thêm điều gì** (trang chi tiết đơn: eyebrow "Đơn hàng" + tiêu đề là mã đơn). Trang cấp một không đặt — thanh bên đã cho biết đang ở đâu |
| Thẻ | `.admin .account-card` ghi đè khung tranh bồi: nét `--dash-line`, bo 20px, **không bóng**; tiêu đề mục có vạch son 3px phía trước |
| Bảng | Đầu bảng chữ hoa thưa sepia; chỉ nét ngang mảnh; hàng cuối không kẻ; hover nền `--dash-soft`. Nút thao tác trong hàng dùng nét mảnh, không mảng tối |
| Nhãn trạng thái | Viên chữ nhỏ **chỉ nét**, màu theo nghĩa (`--la` tốt, `--son` lỗi, `--sepia` chưa cấu hình) — không tô mảng màu đậm |
| Dải số liệu IT | Ngăn bằng nét dọc; số Fraunces **300** 2,1rem `oldstyle-nums`; nhãn chữ hoa thưa |
| Hàng lỗi 5xx | Vạch son ở mép trái + nền son 4% — không tô đỏ cả hàng |
| Màn ≤960px | Thanh bên thành hàng tab ngang trên cùng, vạch son chuyển xuống chân mục đang mở; ≤640px ẩn biểu tượng |

**Cố ý không lấy** phần trang trí của `/account` (ảnh trời `DashSky`, đèn trời bay lên, kính mờ):
đây là công cụ dùng cả ngày — nền ảnh làm rối mắt và tốn tài nguyên mà không giúp gì cho việc
(§9). Điểm nhấn son chỉ dùng cho: vạch mục đang mở, vạch trước tiêu đề mục, nút chính.

## 13. Checklist khi thêm thành phần

1. Dùng token màu; kiểm tra tương phản nếu có chữ.
2. Khung: chọn tranh bồi / thiếp thư / danh sách nét mảnh — không tạo khung mới có viền dày.
3. Chuỗi hiển thị qua `t()` (vi/en/zh), kể cả `alt`.
4. Motion: `Reveal` + biến thể có sẵn; kiểm tra với giảm chuyển động.
5. Ảnh mới: ghi nguồn, giấy phép vào `CREDITS.md` + `folkArt.js`.
