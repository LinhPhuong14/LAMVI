# Danh sách việc cần bên Business (client) cung cấp / duyệt / quyết định — LAMVI

> Bản lập ngày 2026-10-12; **cập nhật 2026-10-13** sau khi đồng bộ web với tài liệu nhóm (Content Plan, báo cáo GRP490, nội dung tranh Đông Hồ) — xem mục [Đã đồng bộ](#đã-đồng-bộ-từ-tài-liệu-nhóm-13102026). Dữ liệu từ `docs/ba-spec.md` (v0.42) + ảnh chụp web chạy thật.
> Mục đích: để client biết **mỗi đoạn chữ / hình đang thấy trên web thuộc phần nào** và **cần gửi lại gì** để thay bản mẫu bằng nội dung thật.

## Các file đi kèm

| File | Dùng để |
|---|---|
| `LAMVI-checklist-gui-client.pdf` | Bản đọc: toàn bộ checklist + phụ lục ảnh chụp có nhãn mã khối |
| `LAMVI-noi-dung-web-client-sua.xlsx` | Client **sửa nội dung**: tab "Nội dung web" gom toàn bộ chữ của mọi trang (VI/EN/ZH) theo trang → khối, cột vàng để điền nội dung mới; thêm các tab sản phẩm, bộ sưu tập, FAQ, email, Mây. Gửi lại nguyên file |
| `LAMVI-task-tracker-client.xlsx` | Client **theo dõi tiến độ**: 92 việc, trạng thái (Chưa bắt đầu / Đang làm / Chờ duyệt / Bị chặn / Xong), người phụ trách, hạn, tab Tổng quan tự tính % hoàn thành |

## Đã đồng bộ từ tài liệu nhóm (13/10/2026)

Nguồn: `LAMVI_Content_Plan.xlsm`, báo cáo `GRP490 G30 - LAMVI`, `Nội dung tranh Đông Hồ`. Quyết định PO: **D-104** trong `docs/ba-spec.md`.

| Việc đã làm trên web | Client cần xác nhận / bổ sung |
|---|---|
| Danh mục 5 đèn thật (Thu Hoạch, Tứ Linh, Phúc Lộc Song Toàn, Gà Tam Dương Khai Thái, Lợn Đàn) thay 8 sản phẩm mẫu; 1 bộ sưu tập "Bộ sưu tập đầu tiên" | Giá thật từng mẫu (tạm 1.400.000 đ cho cả 5); ảnh thật; mô tả dài từng đèn |
| Thông số: thân đèn cao 20 cm, đường kính 12 cm; đế gỗ cao 5 cm, đường kính 12 cm; LED vàng ấm cắm điện trực tiếp; giấy dó Dương Ổ – Phong Khê phủ điệp, artwork Đông Hồ; làm 5–7 ngày | Cân nặng, cách bảo quản; báo cáo ghi 12×12×20 cm là prototype "chưa phải thông số thương mại cuối cùng" — xác nhận số chốt |
| **QR chỉ ở thiệp/thư cảm ơn, không khắc lên đèn** — đã sửa mọi chỗ chữ trên web (trang chủ, Cửa hàng, Giỏ hàng, tour Mây, FAQ, en/zh); trang lời chúc luôn có nút "Xem video mẻ đèn" | Trang kể chuyện **theo từng mẫu đèn** (Content Plan 30/10) **chưa làm** — cần quyết định phạm vi và nội dung (G-108) |
| Khối Nghệ nhân dùng tên thật; quy trình 4 bước; lookbook = 5 đèn; số liệu trang chủ chỉ giữ số kiểm chứng được; FAQ thêm 4 câu (giấy dó ≠ giấy điệp, nguồn giấy, QR ở đâu, kích thước/nguồn sáng) | Ảnh + đồng ý của nghệ nhân; duyệt các câu mới; bản en/zh do dev dịch |
| Bài "Đàn Lợn Âm Dương" và "Tam Dương Khai Thái" (do nhóm viết) chưa đưa lên web — là nguồn cho mô tả dài/gallery | Phần "Tài liệu tham khảo" trong file là trích nguồn ngoài, **không đưa lên web** khi chưa xin phép |
| **(14/10) Trang kể chuyện theo từng mẫu đèn**: quét QR thiệp → câu chuyện của mẫu → lời chúc; tab "Câu chuyện" ở trang sản phẩm; admin nhập; Mây dùng làm nguồn | Duyệt 5 câu chuyện + bản en/zh; ảnh riêng từng mẫu (mục 7.7) |
| **(14/10) Bảo vệ route**: trang tài khoản, thanh toán, đơn hàng, admin, IT yêu cầu đăng nhập (chuyển tới đăng nhập rồi quay lại); khách đã đăng nhập mở trang đăng nhập/đăng ký thì được chuyển đi | Không cần client làm gì |
| **(14/10) Ảnh từ fanpage chính thức đã vào web**: logo (header/footer/đăng nhập), ảnh bìa (mục Di sản + ảnh chia sẻ), poster 5 đèn (hero, lookbook, trang sản phẩm…) | Ảnh gốc độ phân giải cao; xác nhận quyền dùng poster làm ảnh sản phẩm |
| **(14/10) Ảnh từ fanpage chính thức**: logo đại diện → favicon/apple-touch-icon (thay logo Vite); ảnh bìa lưu ở `public/images/brand/` | Logo vector gốc; ảnh sản phẩm gốc (fanpage chỉ cho ≤206 px khi chưa đăng nhập); xác nhận thông tin liên hệ trên banner (7.8) |

## Cách đọc tài liệu này

- Mỗi vùng nội dung có **mã** (ví dụ `HOME-04`) — mã này cũng in ở góc trái trên của ảnh chụp tương ứng trong thư mục [`screenshots/`](screenshots/). Khi gửi phản hồi, client chỉ cần ghi "HOME-04: đổi thành …".
- Cột **Ưu tiên**: 🔴 chặn go-live (thiếu là không mở bán được / vi phạm pháp lý) · 🟠 nên có trước khi mở bán · 🟡 có thể làm sau.
- Mọi nội dung hiện trên web **đều là bản mẫu do đội dev soạn** trừ khi ghi khác. Nội dung tiếng Anh/Trung do dev dịch, chưa ai duyệt (G-14).
- Ảnh chụp dùng dữ liệu thật đã đồng bộ (5 đèn của bộ sưu tập đầu tiên — nhưng **ảnh sản phẩm vẫn là hình vẽ minh hoạ**, giá là giá tạm 1.400.000 đ, lô video là lô demo `DEMO-2026-01`) ở độ rộng 1366px. Chữ nằm trong ảnh là chữ đang chạy trên web.
- Nơi sửa: nội dung giao diện nằm ở `src/i18n/messages/{vi,en,zh}.js`; sản phẩm / bộ sưu tập / FAQ / lô quản lý trong trang **/admin** (client tự nhập được, không cần dev); thông tin doanh nghiệp là biến môi trường `MAIL_*` (dev đặt giúp).

## Mục lục

1. [Thương hiệu & nhận diện](#1-thương-hiệu--nhận-diện)
2. [Danh mục sản phẩm](#2-danh-mục-sản-phẩm-đèn)
3. [Bộ sưu tập (category)](#3-bộ-sưu-tập-category)
4. [Nội dung trang chủ (landing)](#4-nội-dung-trang-chủ-landing)
5. [Nội dung các trang khác](#5-nội-dung-các-trang-khác)
6. [Mây — trợ lý AI](#6-mây--trợ-lý-ai)
7. [Lô đèn, video, QR, thiệp](#7-lô-đèn-video-qr-thiệp)
8. [Thông tin doanh nghiệp & pháp lý](#8-thông-tin-doanh-nghiệp--pháp-lý)
9. [Chính sách & vận hành bán hàng](#9-chính-sách--vận-hành-bán-hàng)
10. [Email giao dịch](#10-email-giao-dịch)
11. [Tài khoản dịch vụ bên thứ ba](#11-tài-khoản-dịch-vụ-bên-thứ-ba)
12. [Dịch thuật (EN / ZH)](#12-dịch-thuật-en--zh)
13. [Câu hỏi nghiệp vụ còn mở cần client quyết](#13-câu-hỏi-nghiệp-vụ-còn-mở-cần-client-quyết)
14. [Admin & vận hành](#14-admin--vận-hành)
15. [Bảng tóm tắt checklist](#15-bảng-tóm-tắt-checklist)

---

## 1. Thương hiệu & nhận diện

| # | Việc client cần làm | Hiện trạng | Ưu tiên |
|---|---|---|---|
| 1.1 | **Gửi bộ logo chính thức**: SVG (vector) + PNG nền trong, bản ngang / dọc / một màu (trắng, đen) | Logo hiện là chữ "LAMVI" dạng triện đỏ do dev vẽ bằng code (thấy ở thanh menu `HOME-01` và chân trang `FOOT-01`), **chưa phải logo thật** | 🔴 |
| 1.1b | Logo trên **thanh menu / chân trang / trang đăng nhập / dashboard**: từ 14/10 đã thay con dấu chữ bằng **logo tròn nâu–vàng lấy từ fanpage** (200 px, hơi mềm khi phóng to). Cần file vector/PNG lớn để thay bản này | Đã đưa lên web — cần file gốc | 🟠 |
| 1.2 | **Favicon / icon tab trình duyệt** (32×32, 180×180 cho iOS, 512×512) | Từ 14/10 đã dùng **logo đại diện fanpage (200 px)** làm favicon 64 px + apple-touch-icon 180 px, thay logo mặc định của Vite. Cần file gốc độ phân giải cao để làm bản 512 px | 🟠 |
| 1.3 | Xác nhận / cung cấp **brand guideline**: bảng màu, font, quy tắc dùng logo, khoảng trắng tối thiểu | Dev suy ra từ landing cũ, ghi ở `docs/BRAND_GUIDELINE.md` (nền kem giấy, đỏ son chu sa, nâu mực, navy đêm). Cần client xác nhận đúng ý | 🟠 |
| 1.4 | Font chữ: xác nhận dùng **Fraunces** (tiêu đề) + **Be Vietnam Pro** (nội dung) hoặc gửi font bản quyền khác (kèm giấy phép dùng web) | Đang dùng 2 font mã nguồn mở trên | 🟡 |
| 1.5 | **Tagline & thông điệp thương hiệu** chính thức (VI/EN/ZH) | Đang dùng: "Mỗi chiếc đèn, một câu chuyện được thắp lên", "Đèn giấy dó thủ công — giữ lửa ký ức, thắp sáng yêu thương" | 🟠 |
| 1.6 | **Ảnh chia sẻ mạng xã hội (og:image)** 1200×630 | `public/images/og/default.png` do dev dựng tự động — thay bằng ảnh thật khi có | 🟠 |
| 1.7 | **Banner email** (đầu thư giao dịch, ~1200×300) | `public/images/mail/banner.jpg` do dev dựng — xem [mục 10](#10-email-giao-dịch) | 🟡 |
| 1.8 | **Nhân vật Mây** (mascot đám mây): xác nhận hình hiện tại hoặc gửi bản thiết kế chính thức (SVG, biểu cảm: chào, đang nghĩ, ốm, nghỉ) | Hình đám mây dev vẽ (thấy ở nút góc phải dưới mọi trang, `MAY-01`) | 🟡 |
| 1.9 | **Chữ ký / triện / hoạ tiết dân gian** dùng làm điểm nhấn (nếu có bản gốc của xưởng) | Dev dùng hoạ tiết tự vẽ (trống đồng, sen, mây) | 🟡 |
| 1.10 | Giọng văn thương hiệu (tone of voice): 5–10 câu mẫu "nên nói / không nên nói", cách xưng hô (bạn/quý khách), có dùng emoji không | Dev dựa theo guideline: giám tuyển, trầm tĩnh, thơ — không hối thúc/khuyến mãi | 🟠 |

---

## 2. Danh mục sản phẩm (đèn)

Web hiện có **5 đèn của bộ sưu tập đầu tiên** (đã lấy từ Content Plan): **Thu Hoạch, Tứ Linh, Phúc Lộc Song Toàn, Gà Tam Dương Khai Thái, Lợn Đàn**. Tên, mô tả ngắn, thông số kích thước/chất liệu/nguồn sáng/thời gian làm đã điền theo tài liệu nhóm; **giá đang là giá tạm 1.400.000 đ (trung điểm 1,3–1,5 triệu của báo cáo) cho cả 5 mẫu**; ảnh là hình vẽ minh hoạ (xem `SHOP-02`, `PDP-01`).

Client gửi **một bảng (Excel/Google Sheet)** — mỗi dòng một sản phẩm — với các cột:

| Cột | Ghi chú |
|---|---|
| Tên đèn | VI / EN / ZH |
| Mã sản phẩm (SKU) và slug URL | Slug **không đổi được sau khi đã có đơn** (đã khoá trong hệ thống) |
| Loại | Đèn lẻ hay Bộ đèn |
| Thuộc bộ sưu tập nào, thứ tự trong bộ | Xem [mục 3](#3-bộ-sưu-tập-category) |
| **Giá niêm yết đã gồm VAT** (VND) | Hệ thống tính VAT 10% bên trong giá (D-68). Cần kế toán xác nhận thuế suất |
| Mô tả ngắn (1 câu) | Hiện ở thẻ sản phẩm và đầu trang chi tiết (`PDP-01`) |
| Mô tả dài / câu chuyện chiếc đèn | Hiện ở tab "Mô tả" (`PDP-02`) — hiện chỉ có 1 câu |
| **Thông số** (6 mục cố định) | Kích thước · Chất liệu · Nguồn sáng · Cân nặng · Thời gian làm · Cách bảo quản — hiện tab "Thông số" đang **trống** ("Thông số chi tiết đang được cập nhật") |
| Nhãn nổi bật (badge) | Ví dụ "Bán chạy", "Mới" |
| Số lượng tồn kho | Hệ thống có quản lý tồn theo số lượng (D-100); cần số ban đầu và quy tắc "đặt làm theo đơn" hay "có sẵn" |
| Tông màu thẻ | amber / dusk / dawn / moss (chỉ để chọn màu nền thẻ khi chưa có ảnh) |
| Trạng thái | Xuất bản / nháp |

**Ảnh sản phẩm** (🔴 — hiện là hình vẽ, không phải ảnh thật):

- Mỗi đèn: ảnh **vuông**, tối thiểu 1200×1200, nền sạch, ánh sáng đèn **bật** và **tắt**; thêm ảnh bối cảnh, ảnh chi tiết giấy dó/khung tre, ảnh có kích thước tham chiếu (đặt cạnh người/bàn).
- Chú thích ảnh (alt text) tiếng Việt cho từng ảnh (cho người khiếm thị và SEO).
- Ảnh bộ (set): ảnh cả bộ + ảnh từng chiếc.
- Quyền sử dụng ảnh: ai chụp, có cho phép dùng thương mại không.
- Sau khi có ảnh, client tự tải lên ở **/admin → Sản phẩm** (không cần dev). Giới hạn 5 MB/ảnh.

**Còn thiếu cần client chốt**: giá thật từng mẫu · cân nặng và cách bảo quản (2 trong 6 thông số) · ảnh thật · mô tả dài/câu chuyện từng đèn (Content Plan có bài dài, web mới có 1 câu) · tồn kho. *(Q-05 về bộ Sum Vầy không còn áp dụng — D-104.)*

---

## 3. Bộ sưu tập (category)

Hiện có **1 bộ**: *Bộ sưu tập đầu tiên* (5 đèn), câu chuyện bộ "Từ một tờ giấy đến ánh sáng" do dev soạn từ Content Plan — cần duyệt. Hiện ở `HOME-06` (trang chủ), `SHOP-02` (cửa hàng), `COL-01` (trang bộ sưu tập). Hai bộ mẫu cũ (Sum Vầy, Hội Làng) đã bỏ.

Client gửi cho **mỗi bộ sưu tập**:

| Mục | Ghi chú |
|---|---|
| Tên (VI/EN/ZH) | |
| Mô tả ngắn 1–2 câu | Hiện trên thẻ bộ |
| **Câu chuyện của bộ** (tiêu đề + 1 đoạn 60–120 chữ) | Hiện ở trang bộ sưu tập `COL-01` và là phần thưởng Gallery khi đủ 5 đèn. Hiện: "Từ một tờ giấy đến ánh sáng" (dev soạn) |
| Ảnh bìa bộ (ngang, ≥1600px) | Hiện là hình vẽ ghép các đèn |
| Danh sách đèn thuộc bộ + giá mua trọn bộ vs. mua lẻ | Rule hiện tại: mua lẻ từng đèn trong bộ được (D-96) |
| Thứ tự hiển thị | |
| **Có thêm category nào khác không?** (ví dụ theo dịp: Tết, Trung thu, tân gia; theo không gian: bàn trà, phòng ngủ; theo giá) | Cửa hàng `/shop` hiện chỉ lọc "Tất cả / Đèn lẻ / Bộ đèn" và sắp xếp (nổi bật, giá, tên). Nếu client muốn thêm bộ lọc theo dịp/không gian thì cần chốt danh sách để dev bổ sung |

Ngoài ra: **Gallery đèn + chăn Đông Hồ** (D-97, trong tài khoản khách — tab "Gallery"): khách sưu tập đèn đã mua thành "mảnh ghép" chăn Đông Hồ và nhận phần thưởng cốt truyện. Cần client gửi **nội dung phần thưởng cốt truyện** cho từng đèn/bộ (hiện là văn mẫu) và xác nhận ý tưởng gamification này còn muốn giữ.

---

## 4. Nội dung trang chủ (landing)

Toàn bộ trang chủ: ảnh tổng quát từng khối ở thư mục `screenshots/` (`home-01.jpg` … `home-11-*.jpg`). Với mỗi khối, client **duyệt/sửa chữ đang hiện** hoặc **gửi chữ thay thế**. Khối nào có số liệu/ảnh thật thì ghi rõ nguồn.

| Mã | Khối (thấy trên web) | Ảnh chụp | Nội dung hiện tại (VI) | Client cần |
|---|---|---|---|---|
| **HOME-01** | Thanh menu (logo, Câu chuyện · Nghệ nhân · Cửa hàng · Lookbook · Trải nghiệm QR · Hỏi đáp, VI/EN/ZH, Giỏ hàng, Tài khoản, nút **Đặt đèn**) | [home-01](screenshots/home-01.jpg) | Nhãn menu như trên | Duyệt tên các mục menu; logo thật (1.1) |
| **HOME-02** | **Hero** — màn hình đầu: dòng nhỏ + tiêu đề + mô tả + 2 nút | [home-02](screenshots/home-02.jpg) | Dòng nhỏ: "Giấy dó thủ công · Làng nghề trăm năm" · Tiêu đề: "Mỗi chiếc đèn, một câu chuyện được thắp lên" · Mô tả: "Đèn giấy dó thủ công dành tặng người thân — kèm theo hành trình đèn được làm ra và lời chúc của riêng bạn, mở ra chỉ bằng một lần quét mã." · Nút: "Khám phá bộ sưu tập", "Nghe câu chuyện làng nghề" | Duyệt tiêu đề + mô tả; **ảnh/ video hero thật** (hiện là đèn vẽ + tranh phong cảnh). Xác nhận "làng nghề trăm năm" có đúng sự thật không |
| **HOME-03** | Dải chữ chạy ngang (marquee) | [home-03](screenshots/home-03.jpg) | GIẤY DÓ THỦ CÔNG · KỂ CHUYỆN BẰNG ÁNH SÁNG · LÀM QUÀ TẶNG Ý NGHĨA · MỖI LỜI CHÚC, MỘT KỶ NIỆM · LÀNG NGHỀ TRĂM NĂM | Duyệt 5 cụm từ |
| **HOME-04** | **Di sản / Câu chuyện** + 3 con số | [home-04-1](screenshots/home-04-1.jpg) [home-04-2](screenshots/home-04-2.jpg) | Tiêu đề "Từ làng nghề giấy dó trăm năm" · Đoạn: "Giấy dó từng dùng để chép sử, vẽ tranh Đông Hồ…" · **Số liệu (đã đổi 13/10 sang số kiểm chứng được): 5 chiếc đèn trong bộ sưu tập đầu tiên · 3 chặng hành trình (Dương Ổ – Phong Khê → Đông Hồ → LAMVI) · 1 lời chúc riêng cho mỗi món quà** | Duyệt câu chuyện làng nghề/xưởng (nguồn gốc, năm thành lập). Cụm "làng nghề trăm năm" ở tiêu đề: xác nhận còn đúng không |
| **HOME-05** | **Nghệ nhân** — chân dung + mô tả vai trò | [home-05](screenshots/home-05.jpg) | **Đã đổi 13/10 theo Content Plan**: "Nghệ nhân Ưu tú Nguyễn Hữu Quả — Làng tranh Đông Hồ" + mô tả: giấy dó từ Dương Ổ – Phong Khê được đưa tới Đông Hồ, nơi ông trực tiếp phủ điệp và thực hiện phần nghệ thuật. Đã bỏ câu trích và số liệu mẫu | 🔴 Gửi **ảnh chân dung thật** (hiện vẫn là hình minh hoạ chung) + **văn bản đồng ý dùng tên/hình ảnh**; xác nhận chức danh "Nghệ nhân Ưu tú" và nội dung mô tả |
| **HOME-06** | **Bộ sưu tập** — lưới sản phẩm, nút "Xem thêm" | [1](screenshots/home-06-1.jpg) [2](screenshots/home-06-2.jpg) [3](screenshots/home-06-3.jpg) | Tiêu đề "Chọn chiếc đèn bạn muốn thắp" · "Mỗi chiếc đèn có thể thắp cho chính bạn hoặc gửi tặng người thương — bạn chọn “mua tặng” hay “mua cho mình” ở bước thanh toán." | Dữ liệu sản phẩm ở [mục 2–3](#2-danh-mục-sản-phẩm-đèn); duyệt câu giới thiệu |
| **HOME-07** | **Lookbook** — 5 đèn | [1](screenshots/home-07-1.jpg) [2](screenshots/home-07-2.jpg) | "Năm bức tranh, năm ánh sáng": Thu Hoạch · Tứ Linh · Phúc Lộc Song Toàn · Tam Dương Khai Thái · Lợn Đàn (đã đổi 13/10, thay 5 tên màu cũ) | **Ảnh lookbook thật** (đèn bật sáng, trong không gian sống) cho từng mẫu. Hiện chỉ là hình minh hoạ phát sáng |
| **HOME-08** | **Hành trình thủ công** — 4 công đoạn | [home-08](screenshots/home-08.jpg) | Đã đổi 13/10: Giấy dó Dương Ổ – Phong Khê · Phủ điệp & artwork Đông Hồ · Lắp đèn & kiểm tra sáng · Đóng gói & thiệp cảm ơn (mỗi bước 1 câu) | 🟠 Xác nhận 4 bước và câu mô tả đúng quy trình thật; ảnh/video thật cho từng bước (Content Plan đã có kế hoạch quay) |
| **HOME-09** | **Trải nghiệm QR** — mô phỏng điện thoại mở lời chúc | [home-09](screenshots/home-09.jpg) | "Quét mã, thấy cả một câu chuyện" + 3 gạch đầu dòng + mockup "Lời chúc từ Minh Anh: Chúc chị luôn ấm áp như ánh đèn này…" | Duyệt chữ (nhất là câu về thời hạn lưu 30 ngày — đã chốt D-12/D-26); câu lời chúc mẫu |
| **HOME-10** | **Cảm nhận khách hàng** (testimonials) | *(đang không hiển thị)* | 3 câu mẫu: Thu Hà (tặng mẹ 20/10), Minh Quân, Bảo Trân | 🟠 **Đánh giá hiện là giả** nên đã bị ẩn (D-103). Muốn hiện: gửi đánh giá **thật** + tên, bối cảnh, **đồng ý của người đánh giá** (Q-23) |
| **HOME-11** | **Hỏi đáp (FAQ)** | [1](screenshots/home-11-1.jpg) [2](screenshots/home-11-2.jpg) | **9 câu** (13/10 thêm 4 câu): thời hạn lưu video/lời chúc · sửa lời chúc · người nhận cần tải app? · đèn có dễ vỡ? · thời gian làm 5–7 ngày · giấy dó ≠ giấy điệp · nguồn giấy và tranh · QR ở đâu · kích thước và nguồn sáng | Duyệt 9 câu + **thêm câu hỏi thực tế khách hay hỏi** (cách bảo quản, thay bóng, độ an toàn/cháy, đặt số lượng lớn, in logo công ty, đổi trả…). Tự nhập ở **/admin → FAQ** (VI/EN/ZH) |
| **FOOT-01** | **Chân trang** (xuất hiện ở mọi trang) | [foot-01-1](screenshots/foot-01-1.jpg) [2](screenshots/foot-01-2.jpg) | Mô tả thương hiệu, cột Sản phẩm, cột Hỗ trợ (FAQ, Liên hệ, Đổi trả, Vận chuyển, Thanh toán, Điều khoản, Riêng tư, Cài đặt cookie, Theo dõi đơn), ô "Nhận tin tức" (đang **chưa mở**), © 2026 | Thông tin doanh nghiệp ([mục 8](#8-thông-tin-doanh-nghiệp--pháp-lý)) — **hiện chân trang chưa có địa chỉ, MST, hotline, MXH vì chưa được cung cấp**; quyết định có làm **newsletter** không (G-11) |
| — | **Phòng tranh dân gian** (ảnh tư liệu Đông Hồ, 11 tranh, có chú thích nguồn) | *(trong `HOME-04` và chăn Đông Hồ)* | Ảnh Wikimedia Commons CC0/public domain của Bảo tàng Mỹ thuật VN | 🔴 `[LEGAL]` **Q-36**: xác nhận có cần xin phép bảo tàng; hoặc thay bằng ảnh/tranh do chính LAMVI sở hữu |

**Phần chữ ẩn trong code mà client cũng nên duyệt** (xem trong `src/i18n/messages/vi.js`): mô tả SEO của trang (`meta.title`: "LAMVI — Đèn Giấy Dó Thủ Công", `meta.description`) — hiện trên Google khi tìm kiếm; tên các trang; nội dung **Tour hướng dẫn** của Mây ([mục 6](#6-mây--trợ-lý-ai)).

---

## 5. Nội dung các trang khác

| Mã | Trang / URL | Ảnh chụp | Nội dung đang có | Client cần |
|---|---|---|---|---|
| **SHOP-01/02** | **Cửa hàng** `/shop` | [shop-01](screenshots/shop-01.jpg) [shop-02-1](screenshots/shop-02-1.jpg) [2](screenshots/shop-02-2.jpg) | Tiêu đề "Đèn giấy dó thủ công" · đoạn dẫn "Chọn chiếc đèn bạn muốn thắp — cho chính mình hoặc gửi tặng người thương…" · 3 chip "Thiệp cảm ơn có mã QR mở lời chúc / Mã QR khắc trên đèn mở video mẻ đèn / Giá đã gồm VAT, giao trong nước" · bộ lọc + sắp xếp | Duyệt chữ; chốt bộ lọc (xem mục 3) |
| **PDP-01/02** | **Chi tiết sản phẩm** `/products/<slug>` | [pdp-01](screenshots/pdp-01.jpg) [pdp-02-1](screenshots/pdp-02-1.jpg) [2](screenshots/pdp-02-2.jpg) [3](screenshots/pdp-02-3.jpg) · [tab Câu chuyện](screenshots/pdp-story.jpg) | Ảnh, tên, giá "đã gồm VAT", mô tả ngắn, nút "Thêm vào giỏ", dòng freeship, 3 chip lợi ích, 3 tab (**Mô tả · Thông số · Giao hàng & đổi trả**), "Có thể bạn cũng thích" | Dữ liệu sản phẩm (mục 2): ảnh, mô tả dài, **thông số**. Nội dung tab "Giao hàng & đổi trả" lấy từ chính sách ([mục 9](#9-chính-sách--vận-hành-bán-hàng)) |
| **COL-01** | **Trang bộ sưu tập** `/collections/<slug>` | [col-01-1](screenshots/col-01-1.jpg) [2](screenshots/col-01-2.jpg) | Tên, mô tả, câu chuyện bộ, "Mua cả bộ", "Hoặc chọn từng đèn" | Nội dung ở mục 3 |
| **CART-01** | **Giỏ hàng** `/cart` | [cart-01](screenshots/cart-01.jpg) | "Giỏ quà của bạn", các bước Giỏ hàng → Thanh toán → Hoàn tất, nhắc "mỗi món quà đi kèm: thiệp cảm ơn có mã QR…" | Duyệt chữ; giới hạn số lượng tối đa mỗi loại (hiện có mức giới hạn) |
| **CHK-01** | **Thanh toán** `/checkout` | [chk-01](screenshots/chk-01.jpg) | Mua tặng / mua cho mình · tuỳ chọn "Thêm lời chúc gắn mã QR" (tối đa 300 ký tự) · người nhận · địa chỉ (tỉnh → phường/xã, danh mục hành chính 2 cấp mới) · mã giảm giá · phương thức thanh toán · tóm tắt đơn (VAT, phí ship) | Duyệt chữ; phương thức thanh toán thật ([mục 9](#9-chính-sách--vận-hành-bán-hàng)). **Quyết định Q-41**: có cho **mua không cần tài khoản (guest checkout)** không |
| **ORD** | **Trang đơn hàng** `/don-hang/<mã>` (sau khi đặt) | *(cần có đơn thật)* | Trạng thái đơn, mã QR, nhắc soạn lời chúc | Duyệt chữ trạng thái đơn (Chờ thanh toán, Đang làm, Đã đóng gói, Đã gửi, Đã giao, Đã huỷ, Hoàn tiền) |
| **ACC-01** | **Tài khoản** `/account` — 5 tab: Tổng quan · Đơn hàng · Gallery · Trò chuyện (lịch sử Mây) · Hồ sơ | [acc-01](screenshots/acc-01.jpg) | Giao diện kính mờ, nền mây khói | Duyệt chữ; nội dung Gallery (mục 3) |
| **AUTH** | **Đăng nhập / Đăng ký / Quên mật khẩu** | [login 1](screenshots/auth-login-1.jpg) [2](screenshots/auth-login-2.jpg) · [register](screenshots/auth-reg-1.jpg) · [quên MK](screenshots/auth-forgot-1.jpg) | Form + ảnh nền "đèn lụa phản chiếu trên sông Hội An" (CC) | Duyệt chữ; **ảnh nền thật của thương hiệu** (hiện là ảnh stock); quyết định có dùng đăng nhập Google không (đã làm, cần tài khoản Google Cloud — mục 11) |
| **CT-01** | **Liên hệ** `/contact` | [ct-01](screenshots/ct-01.jpg) | Hotline, Zalo, email hỗ trợ, giờ làm việc, địa chỉ xưởng, địa chỉ đơn vị, **form gửi tin nhắn** | 🔴 Hiện **trống kênh liên hệ** ("Thông tin liên hệ đang được cập nhật") — xem mục 8 |
| **POL-*** | **5 trang chính sách** `/privacy` `/returns` `/terms` `/shipping` `/payment` | [riêng tư](screenshots/pol-privacy-1.jpg) · [đổi trả](screenshots/pol-returns-1.jpg) · [điều khoản](screenshots/pol-terms-1.jpg) · [vận chuyển](screenshots/pol-ship-1.jpg) · [thanh toán](screenshots/pol-pay-1.jpg) | Do dev soạn theo hiện trạng hệ thống | 🔴 **Pháp chế duyệt** (Q-40, Q-42, Q-43) — xem mục 9 |
| **QR-BATCH** | **Trang video lô đèn** `/lo/<mã lô>` (mở từ nút "Xem video mẻ đèn" trên trang lời chúc và từ Gallery; **QR không khắc trên đèn** — D-104) | [qr-batch-1](screenshots/qr-batch-1.jpg) [2](screenshots/qr-batch-2.jpg) | "Hành trình làm đèn": video, ngày làm, mã lô, ghi chú "Video ghi lại quá trình làm cả lô đèn, trong đó có chiếc đèn của bạn." | Video thật từng lô (mục 7). Hiện là lô demo |
| **QR-GIFT** | **Trang lời chúc** `/qr/<token>` (người nhận quét mã **trên thiệp cảm ơn**) | [qr-gift](screenshots/qr-gift.jpg) *(mô phỏng đơn mua tặng 2 đèn)* | "Có một lời chúc đang chờ bạn" → nút **"Tôi đã nhận được quà"** → **(14/10) câu chuyện của từng mẫu đèn trong đơn** → hiện lời chúc chữ / giọng nói / video, nút Tải về, đếm ngược 30 ngày, nút Dịch tự động | Duyệt toàn bộ chữ (trang này là **điểm chạm cảm xúc nhất** — nên do copywriter của client viết) |
| **404** | Trang không tìm thấy | [404](screenshots/404.jpg) | "Không tìm thấy trang" + nút về trang chủ + "Cần giúp đỡ? Liên hệ LAMVI" | Duyệt chữ |
| — | **Trang lỗi / bảo trì** | | "LAMVI đang bảo trì — Chúng tôi đang nâng cấp hệ thống…" | Duyệt chữ |
| — | **Banner cookie** (hiện ở lần vào đầu tiên) | | "Cookie & thống kê. LAMVI dùng Google Analytics…" + Đồng ý / Từ chối | Pháp chế duyệt (Q-43) |

> **Ảnh chụp chưa có**: trang đơn hàng (`ORD`) cần đơn thật (payOS đang tắt ở môi trường demo). Ảnh `QR-GIFT` là **mô phỏng** (dữ liệu giả lập từ API thật của 2 đèn); sẽ chụp lại khi có đơn thật.

---

## 6. Mây — trợ lý AI

Mây là chatbot ở góc phải dưới mọi trang ([may-01](screenshots/may-01.jpg)). Mây **chỉ trả lời dựa trên thông tin thật của LAMVI** (FAQ + dữ liệu sản phẩm + tra đơn), không bịa. Nên chất lượng Mây phụ thuộc vào việc client cung cấp **kiến thức đủ và đúng**.

| # | Việc client cần làm | Hiện trạng | Ưu tiên |
|---|---|---|---|
| 6.1 | **Tính cách & giọng nói của Mây**: xưng hô (mình/Mây — bạn), mức độ dễ thương, từ nên dùng / cấm dùng, độ dài câu trả lời | Giọng "Mây ơi/rùi/nha" theo câu mẫu trong BA spec §22.4 | 🟠 |
| 6.2 | **Kho kiến thức** cho Mây: FAQ đầy đủ (≥30 câu), thông tin chất liệu, quy trình, bảo quản, an toàn khi dùng, quà tặng doanh nghiệp, in logo… (nhập ở /admin → FAQ) | Mới 5 câu FAQ | 🔴 |
| 6.3 | **Danh sách chủ đề Mây không được trả lời / phải chuyển nhân viên** (giá đặc biệt, khiếu nại, y tế…) | Mây tự từ chối ngoài phạm vi | 🟠 |
| 6.4 | **Kênh chuyển nhân viên** (Zalo/hotline/email) và giờ trực | Ô cấu hình trống → Mây chỉ nói "xem phần hỏi đáp" | 🔴 |
| 6.5 | **5 nhóm câu báo lỗi** khi Mây ốm / hết hạn mức / nghỉ / không biết (VI/EN/ZH) | Đã có câu mẫu ("Mây bị ốm rùi, chờ Mây khỏe lại xíu nha"…) — duyệt hoặc viết lại | 🟡 |
| 6.6 | **4 câu gợi ý** hiện sẵn: "Đèn làm từ chất liệu gì? / Mã QR trên thiệp dùng để làm gì? / Tôi có thể viết lời chúc sau khi đặt không? / Giao hàng mất bao lâu?" + câu chào | Dev soạn | 🟡 |
| 6.7 | **Tour 5 bước** trên trang chủ (nút "Dẫn tour") | Dev soạn, chỉ chạy khi bấm nút (đã bỏ tự bật — D-103) | 🟡 |
| 6.8 | **Hạn mức & ngân sách**: ngân sách OpenAI/tháng (hiện 20 USD), số tin nhắn khách vãng lai/ngày, thành viên/ngày (hiện 20 / 50 / 100) — chốt hoặc giữ | Đã duyệt D-41/D-58, admin chỉnh được ở /admin/may | 🟡 |
| 6.9 | **Thông báo quyền riêng tư của Mây** ("Nội dung bạn nhắn được xử lý bởi nhà cung cấp AI ở nước ngoài (OpenAI)…") — pháp chế duyệt; quyền xoá lịch sử chat (I-15 `[LEGAL]`) | Dev soạn | 🔴 |

---

## 7. Lô đèn, video, QR, thiệp

| # | Việc client cần làm | Ghi chú | Ưu tiên |
|---|---|---|---|
| 7.1 | **Video quy trình cho từng lô (mẻ) đèn** | Mỗi lô: mã lô (ví dụ `2026-10-A`), ngày làm, tiêu đề (VI/EN/ZH), 1 đoạn câu chuyện, **file video** (MP4/WebM/MOV, ≤500 MB). Tải lên ở **/admin → Lô** (qua signed URL, không cần dev). Hiện chỉ có lô demo | 🔴 |
| 7.2 | **Quy tắc đặt mã lô** (mã in trên thiệp/tem, **không khắc lên đèn** — D-104; `/lo/<mã lô>` là mã **chung của cả lô**) và quy trình in thiệp có QR | Cần xưởng xác nhận quy trình in thiệp + mã lô | 🟠 |
| 7.3 | **Thiết kế thiệp cảm ơn có mã QR** (in kèm đơn mua tặng): kích thước, mặt trước/sau, mẫu viết tay hay in | Thiệp viết tay do xưởng viết bằng tiếng Việt (D-28). Cần mẫu thiệp + câu mẫu | 🟠 |
| 7.4 | **Chính sách lưu trữ**: giọng nói/video lời chúc xoá sau 30 ngày kể từ khi người nhận xác nhận (hoặc 90 ngày sau giao nếu không ai xác nhận); chữ + video lô lưu mãi — client xác nhận còn đúng | Đã chốt D-12/D-26 | 🟡 |
| 7.5 | Quyết định **Q-12** thiệp/lời chúc có tính phí không (đang miễn phí), **Q-14** admin có xem/kiểm duyệt lời chúc không, **Q-27** người mua xem trước trang QR không, **Q-29** lời chúc không phải tiếng Việt xử lý thế nào, **Q-33** có PIN bảo vệ trang lời chúc không, **Q-25** QR của đơn tự mua dẫn tới đâu | Xem [mục 13](#13-câu-hỏi-nghiệp-vụ-còn-mở-cần-client-quyết) | 🟠 |
| 7.6 | **Duyệt câu chuyện 5 đèn** (VI/EN/ZH) — đã làm trang kể chuyện: quét QR trên thiệp → câu chuyện của đúng mẫu đèn → lời chúc; tab "Câu chuyện" ở trang sản phẩm. Nội dung soạn từ Content Plan + hai bài của nhóm. Sửa trực tiếp ở **/admin → Sản phẩm → Câu chuyện của mẫu đèn** hoặc trong file Excel nội dung | Đã lên web (D-105) — chờ duyệt nội dung | 🟠 |
| 7.7 | **Ảnh gốc từng mẫu đèn**: từ 14/10 web đã dùng **poster 5 đèn từ fanpage** (thumbnail 206 px phóng lên) ở hero, lookbook, trang sản phẩm, cửa hàng, giỏ, lời chúc — nên ảnh mềm và có chữ in sẵn. Cần ảnh gốc độ phân giải cao (đèn bật/tắt, cận cảnh) và xác nhận poster được dùng làm ảnh sản phẩm. Hình dựng trông như ảnh tạo bằng công cụ AI hơn là ảnh chụp thật — xác nhận | Đã đưa lên web (tạm) — cần ảnh gốc | 🔴 |
| 7.8 | **Xác nhận thông tin liên hệ** đọc được từ banner fanpage: địa chỉ "Làng Khánh S, Vinhomes Thăng Long, An Khánh, Hà Nội"; hotline 0962 254 128; email lamvi6866@gmail.com (**mục Giới thiệu của fanpage ghi lamvi6886@gmail.com** — khác nhau); website lamvi.com.vn; TikTok @lamvi360. Chưa đưa lên web/email cho tới khi xác nhận | Chờ xác nhận (G-115) | 🔴 |

---

## 8. Thông tin doanh nghiệp & pháp lý

Các thông tin này hiện **để trống** nên chân trang, trang Liên hệ và chân email chưa hiện đầy đủ. Đây là **thông tin thật của công ty** — chỉ client có. Dev sẽ đặt vào cấu hình (`MAIL_*`).

| # | Thông tin | Dùng ở đâu | Ưu tiên |
|---|---|---|---|
| 8.1 | **Tên pháp nhân** đầy đủ + tên thương mại | Chân trang, chân email, điều khoản | 🔴 |
| 8.2 | **Mã số thuế / số ĐKKD**, ngày cấp, nơi cấp | Chân trang (bắt buộc với website TMĐT) | 🔴 |
| 8.3 | **Địa chỉ đơn vị** (trụ sở) + **địa chỉ xưởng** | Trang Liên hệ, chân trang | 🔴 |
| 8.4 | **Hotline**, **Zalo**, **email hỗ trợ**, **giờ làm việc** | Liên hệ, chân trang, email, Mây | 🔴 |
| 8.5 | **Liên kết mạng xã hội** (Facebook, Instagram, TikTok, Zalo OA, YouTube — chỉ https) | Chân trang, email | 🟠 |
| 8.6 | **Thông báo website TMĐT với Bộ Công Thương** (online.gov.vn): đã làm chưa? link xác nhận để gắn biểu tượng "Đã thông báo" | Chân trang. Q-42 | 🔴 |
| 8.7 | Người đại diện / bên kiểm soát dữ liệu cá nhân, email nhận yêu cầu về dữ liệu | Chính sách riêng tư (Q-40) | 🔴 |
| 8.8 | Tên miền chính thức (ví dụ lamvi.vn) và quyền quản lý DNS | Sau mục 11 | 🔴 |
| 8.9 | Duyệt pháp chế: **Chính sách riêng tư, đổi trả, điều khoản, vận chuyển, thanh toán**, banner cookie/GA | Q-40, Q-42, Q-43 — hiện do dev soạn, **chưa qua pháp chế** | 🔴 |
| 8.10 | **Giấy phép dùng ảnh/ nội dung**: ảnh tư liệu Đông Hồ (Q-36), ảnh hưởng nghệ nhân, ảnh sản phẩm, ảnh nền stock (CC — đã ghi nguồn ở `CREDITS.md`) | | 🔴 |

---

## 9. Chính sách & vận hành bán hàng

| # | Việc client cần quyết / cung cấp | Hiện trạng (mặc định dev đặt) | Ưu tiên |
|---|---|---|---|
| 9.1 | **Phí vận chuyển & ngưỡng freeship** | 30.000 đ đồng giá; miễn phí từ 1.000.000 đ `[ASSUMPTION]`. Admin chỉnh được | 🔴 |
| 9.2 | **Đơn vị vận chuyển** + thời gian giao dự kiến (theo vùng) + vùng không giao | Chính sách vận chuyển đang viết chung; chỉ giao trong VN (Q-42) | 🔴 |
| 9.3 | **Thời gian làm đèn** (FAQ ghi 5–7 ngày làm việc) — còn đúng không, đèn có sẵn hay làm theo đơn | | 🔴 |
| 9.4 | **Thuế VAT**: xác nhận 10% và giá niêm yết đã gồm VAT; xuất hoá đơn điện tử thế nào (khách có yêu cầu hoá đơn công ty không) | D-68; hệ thống **chưa có** xuất hoá đơn | 🔴 |
| 9.5 | **Phương thức thanh toán**: payOS (chuyển khoản/QR) — cần mở tài khoản payOS; **COD** (thanh toán khi nhận hàng) chỉ cho đơn giao cho chính người mua. Giới hạn giá trị COD? (Q-37, hiện không giới hạn) | payOS đang **tắt** trên production cho tới khi có khoá | 🔴 |
| 9.6 | **Chính sách đổi trả**: đã chốt 7 ngày từ khi giao, chỉ nhận lỗi/vỡ/sai hàng, đổi hoặc hoàn tiền, không nhận đổi ý (D-98). Còn mở: hoàn tiền khi trả 1 đèn trong bộ (Q-06), **mức hoàn khi huỷ đơn đã thanh toán đang làm/đã đóng gói** (Q-20), thời gian hoàn tiền, ai chịu phí ship đổi trả | | 🟠 |
| 9.7 | **Coupon / khuyến mãi** dự kiến lúc ra mắt: mã, % hoặc số tiền, điều kiện, hạn | Hệ thống coupon đã có (D-71); admin tạo ở /admin/coupons | 🟠 |
| 9.8 | **Quà doanh nghiệp / mua số lượng lớn / in logo**: có bán không? Nếu có cần form riêng hoặc kênh báo giá | Chưa có | 🟡 |
| 9.9 | **Quy trình xử lý đơn nội bộ**: ai xác nhận đơn, ai đóng gói, khi nào chuyển trạng thái "Đã đóng gói / Đã gửi / Đã giao" trong admin (phần vận hành xưởng nằm ngoài phạm vi web — D-34) | | 🟠 |
| 9.10 | **Chính sách bảo hành** (nếu có) | Chưa có | 🟡 |

---

## 10. Email giao dịch

Hệ thống gửi email: xác nhận đơn, hết hạn thanh toán, đã gửi hàng, đã giao, huỷ đơn, hoàn tiền, đặt lại mật khẩu, thông báo đổi mật khẩu (VI/EN/ZH).

| # | Việc client cần làm | Ưu tiên |
|---|---|---|
| 10.1 | **Duyệt nội dung từng email** (hiện là câu ngắn, ví dụ "Cảm ơn bạn đã đặt hàng. Đơn {code} đã được xác nhận và sẽ sớm được làm.") — nên có giọng thương hiệu hơn | 🟠 |
| 10.2 | **Địa chỉ gửi** (ví dụ `no-reply@lamvi.vn`) và hộp thư hỗ trợ trả lời; xác minh tên miền gửi (SPF/DKIM) với Resend/Brevo — cần quyền DNS | 🔴 |
| 10.3 | **Banner email** và chân thư doanh nghiệp (dùng thông tin mục 8) | 🟡 |
| 10.4 | Có gửi **SMS / Zalo** thông báo đơn không (Q-24) và có nhắc khách soạn/khoá lời chúc không | 🟡 |

---

## 11. Tài khoản dịch vụ bên thứ ba

Client tạo tài khoản đứng tên công ty rồi **giao quyền / chia sẻ khoá một cách an toàn** (không gửi mật khẩu qua chat/email thường). Dev đặt khoá vào biến môi trường Vercel, không commit vào code.

| Dịch vụ | Dùng để | Client cần | Ưu tiên |
|---|---|---|---|
| **Tên miền + DNS** | Địa chỉ web, email | Mua/ chuyển tên miền, cấp quyền DNS | 🔴 |
| **Vercel** | Hosting | Tài khoản/team của công ty (hoặc cho phép dev dùng) | 🔴 |
| **Supabase** | Cơ sở dữ liệu, lưu video/ảnh | Project production, gói trả phí phù hợp (sao lưu) | 🔴 |
| **payOS** | Thanh toán chuyển khoản/QR | Đăng ký doanh nghiệp, lấy Client ID / API Key / Checksum Key | 🔴 |
| **Resend** hoặc **Brevo** | Gửi email | Tài khoản + xác minh tên miền | 🔴 |
| **Google Analytics 4** | Thống kê truy cập | Tạo property, cung cấp Measurement ID (`G-…`) + quyền Viewer cho tài khoản dịch vụ để xem realtime trong admin | 🟠 |
| **Google Cloud (OAuth)** | Đăng nhập bằng Google | OAuth Client ID/Secret; màn hình đồng ý OAuth cần logo + chính sách riêng tư + miền thật | 🟠 |
| **OpenAI** | Bộ não của Mây | API key công ty + hạn mức chi tiêu | 🟠 |
| **Google Search Console** | SEO, nộp sitemap | Xác minh quyền sở hữu tên miền | 🟡 |
| **Facebook / TikTok / Zalo OA** | Kênh bán, pixel (nếu muốn) | Tài khoản + quyết định có gắn pixel không (cần cập nhật banner cookie) | 🟡 |

---

## 12. Dịch thuật (EN / ZH)

- Toàn bộ bản **tiếng Anh** và **tiếng Trung giản thể** (giao diện, sản phẩm, FAQ, email, Mây) do dev dịch — **chưa ai duyệt** (G-14).
- Client cần: xác nhận **có thật sự bán/đối tượng khách EN & ZH** không (nếu không, có thể ẩn để giảm chi phí duy trì); nếu có thì thuê **người bản ngữ / biên dịch** duyệt, đặc biệt: tên sản phẩm, câu chuyện làng nghề, chính sách pháp lý, email.
- Quy ước tên riêng khi dịch: "giấy dó", "Đông Hồ", "LAMVI", "Mây" giữ nguyên hay dịch nghĩa — cần chốt.

---

## 13. Câu hỏi nghiệp vụ còn mở cần client quyết

Lấy từ `docs/ba-spec.md` §30 (còn mở tại v0.41). Mỗi câu trả lời sẽ được ghi thành `D-xx` vào Phụ lục A.

| Mã | Câu hỏi | Mức |
|---|---|---|
| **Q-41** | **Cho phép mua không cần tài khoản (guest checkout)?** Feedback kiểm thử đề xuất chỉ cần họ tên + SĐT + email; hiện bắt buộc đăng nhập. Đổi là thay đổi lớn nên cần quyết định rõ | `[BA DECISION REQUIRED]` — P0 |
| ~~**Q-05**~~ | ~~Bộ Sum Vầy gồm đèn nào, giá lẻ~~ — **không còn áp dụng (D-104)**: danh mục thật là 5 đèn lẻ | — |
| Q-06 | Hoàn tiền thế nào khi trả 1 đèn trong bộ | P1 |
| Q-12 | Thiệp/lời chúc có tính phí? | P1 |
| Q-14 | Admin có xem/kiểm duyệt lời chúc? (tạm: không) | P1 |
| Q-20 | Hoàn bao nhiêu khi huỷ đơn đã thanh toán ở bước đang làm/đã đóng gói | P1 |
| Q-24 | Thêm SMS/Zalo? Thời điểm nhắc soạn/khoá lời chúc | P1 |
| Q-25 | QR của đơn tự mua (không có lời chúc) dẫn tới đâu (tạm: trang cảm ơn + video mẻ đèn mới nhất) | P1 |
| Q-27 | Người mua có xem trước trang QR lời chúc? (tạm: không) | P1 |
| Q-29 | Lời chúc không phải tiếng Việt → thiệp viết tay xử lý thế nào | P1 |
| Q-33 | Có thêm PIN bảo vệ trang lời chúc? | P1 |
| Q-35 | Đăng ký bằng email đã tồn tại: báo "đã đăng ký" (tiện nhưng dò được email) hay luôn báo "kiểm tra email"? | P1 |
| Q-36 / Q-40 / Q-42 / Q-43 / I-15 | `[LEGAL]` ảnh tư liệu, chính sách riêng tư/đổi trả, 3 trang chính sách, banner cookie, xoá lịch sử chat | P1 |
| Q-21 | Phiếu giao hàng không in giá | P2 |
| Q-23 | Testimonial thật hay bỏ | P2 |
| Q-37 | Giới hạn giá trị đơn COD | P2 |
| Q-38 | Ngưỡng chống spam (đăng nhập 10 lần/5 phút…) | P2 |
| G-11 | Giữ hay bỏ form newsletter | P2 |
| — | **KPI & chỉ số hiệu năng** mong muốn (số đơn/tháng, tỉ lệ chuyển đổi, thời gian tải) | P2 |

---

## 14. Admin & vận hành

| # | Việc client cần làm | Ưu tiên |
|---|---|---|
| 14.1 | **Danh sách người dùng admin** (email, vai trò: admin hay IT) — hệ thống không tạo sẵn tài khoản demo trên production | 🔴 |
| 14.2 | Chỉ định **người chịu trách nhiệm nội dung** (sửa sản phẩm/FAQ/lô), **người xử lý đơn**, **người xử lý đổi trả/hoàn tiền**, **người trả lời kênh hỗ trợ** | 🔴 |
| 14.3 | Buổi **đào tạo sử dụng /admin** (sản phẩm, bộ sưu tập, FAQ, lô + video, đơn, coupon, đổi trả, người dùng, Mây, Analytics) — admin chỉ có tiếng Việt (D-48) | 🟠 |
| 14.4 | **UAT** (nghiệm thu): client cử người thử đặt đơn thật từ đầu đến cuối (COD + payOS, mua tặng với lời chúc chữ/giọng nói/video, huỷ đơn, đổi trả) và ký biên bản | 🔴 |
| 14.5 | **Lịch ra mắt** (go-live), kế hoạch truyền thông, và ai có quyền quyết định "đạt" | 🟠 |

---

## 15. Bảng tóm tắt checklist

Đánh dấu khi client đã gửi / duyệt. 🔴 phải xong trước go-live.

**🔴 Phải có trước go-live**

- [ ] Bộ logo chính thức + favicon (1.1, 1.2)
- [ ] Bảng sản phẩm đầy đủ (tên, giá, mô tả, thông số, tồn kho) + **ảnh sản phẩm thật** (mục 2)
- [x] ~~Chốt bộ Sum Vầy gồm gì (Q-05)~~ — không còn áp dụng; **thay bằng: chốt giá thật từng mẫu trong 5 đèn (tạm 1.400.000 đ)**
- [ ] Nội dung bộ sưu tập thật (mục 3)
- [ ] Số liệu thật & câu chuyện làng nghề; nghệ nhân thật (hoặc bỏ khối) — `HOME-04`, `HOME-05`
- [ ] FAQ đầy đủ — `HOME-11`, kiến thức cho Mây (6.2)
- [ ] Kênh hỗ trợ cho Mây & trang Liên hệ (6.4, 8.4)
- [ ] Thông tin doanh nghiệp: pháp nhân, MST, địa chỉ, hotline, email, giờ làm việc (8.1–8.4)
- [ ] Thông báo Bộ Công Thương + link xác nhận (8.6)
- [ ] Pháp chế duyệt 5 trang chính sách + banner cookie + thông báo Mây (8.9, 6.9)
- [ ] Giấy phép ảnh tư liệu / ảnh nghệ nhân (8.10, Q-36)
- [ ] Phí ship, vận chuyển, thời gian giao & làm đèn, VAT/hoá đơn (9.1–9.4)
- [ ] Mở payOS + quyết định COD (9.5)
- [ ] Video lô đầu tiên + quy trình in thiệp có QR và mã lô (7.1, 7.2)
- [ ] Tên miền, Vercel, Supabase, email gửi (mục 11, 10.2)
- [ ] Quyết định **Q-41** (guest checkout)
- [ ] Danh sách admin + phân công + UAT (14.1, 14.2, 14.4)

**🟠 Nên có trước khi mở bán**

- [ ] Brand guideline xác nhận, tagline, tone of voice (1.3, 1.5, 1.10)
- [ ] og:image thật (1.6)
- [ ] Ảnh lookbook, ảnh quy trình, ảnh/ video hero (`HOME-02`, `HOME-07`, `HOME-08`)
- [ ] Mẫu thiệp cảm ơn có QR (7.3)
- [ ] Nội dung email giao dịch được duyệt (10.1)
- [ ] Coupon ra mắt (9.7), chính sách đổi trả còn mở Q-06/Q-20 (9.6)
- [ ] Google Analytics, Google OAuth, OpenAI (mục 11)
- [ ] Mạng xã hội (8.5)
- [ ] Đào tạo admin (14.3), lịch go-live (14.5)
- [ ] Các câu hỏi P1 ở mục 13

**🟡 Làm sau được**

- [ ] Font bản quyền, mascot chính thức, hoạ tiết (1.4, 1.8, 1.9)
- [ ] Testimonial thật (`HOME-10`), newsletter (G-11)
- [ ] Duyệt bản dịch EN/ZH (mục 12)
- [ ] Quà doanh nghiệp, bảo hành (9.8, 9.10)
- [ ] SMS/Zalo, Search Console, pixel quảng cáo (10.4, mục 11)

---

*Ghi chú kỹ thuật cho dev*: ảnh trong `screenshots/` chụp bằng Playwright từ bản chạy local (dữ liệu bộ nhớ) ở 1366×900; góc trái trên của mỗi ảnh có nhãn mã khối. Khi nội dung thật thay vào, chụp lại và cập nhật tài liệu này.

