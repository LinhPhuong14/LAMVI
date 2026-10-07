# LAMVI: đối chiếu production, BA và kế hoạch hoàn thiện

Ngày kiểm tra: **07/10/2026, 09:52 giờ Việt Nam**. Production: **https://www.lamvi.com.vn**. BA: [v0.37](ba-spec.md), ngày 06/10/2026.

## 1. Kết luận và phạm vi bằng chứng

LAMVI đã có nền tảng bán hàng đáng kể trong code. Điểm cần hoàn thiện trước mắt là **chứng minh luồng mua hàng chạy thật**, dữ liệu sản phẩm đủ để khách quyết định mua, và quy trình sau mua hoạt động nhất quán. Không cần ưu tiên thêm hiệu ứng hoặc mở rộng AI trước những việc này.

Kiểm tra lần này dùng HTTP GET công khai, đọc HTML SSR/API, đối chiếu source và BA. Không tạo tài khoản/đơn thật, gửi email, gọi AI tính phí, thay dữ liệu hoặc thử hoàn tiền trên production. Vì vậy “trang trả 200” không đồng nghĩa “feature đã nghiệm thu”. Chưa nghiệm thu tương tác trình duyệt hay tài khoản khách/admin/IT trên production.

Commit sửa checkout `99f0d80` đã nằm trong `origin/master` qua merge `be86b2b48955d8bcab51651942e6a708611e0ec4`. **Chưa có bằng chứng deployment đang chạy commit này, hay migration 013 đã chạy thành công.** Lỗi `\set` khi chạy SQL test trong Supabase Editor không xác nhận hoặc phủ nhận trạng thái migration.

Các trạng thái trong báo cáo:

- **Xác minh công khai:** có phản hồi/nội dung production quan sát được.
- **Một phần:** có phần hoạt động, còn thiếu dữ liệu/quy trình.
- **Code có, chưa nghiệm thu:** có implementation nhưng chưa thử tích hợp thật.
- **Thiếu:** BA và source xác nhận chưa có.

## 2. Ma trận feature

| Nhóm BA | Bằng chứng production ngày 07/10 | Đối chiếu code/BA | Việc tiếp theo |
|---|---|---|---|
| Catalog, shop, chi tiết sản phẩm | `/shop` và 3 PDP trả 200; `/api/products` có 3 sản phẩm | Xác minh công khai; chưa phải catalog hoàn chỉnh về nội dung | P01 |
| Ảnh sản phẩm, thông tin mua hàng | Cả 3 sản phẩm có `image:null`; mô tả ngắn | Admin upload đã có; G-33 còn thiếu ảnh thật | P01 |
| Bộ sưu tập, mảnh ghép/phần thưởng | `/api/collections` trả 200 với `items:[]`; `/collections/sum-vay` trả 404 | Đã hết lỗi 500 từng gặp; không chứng minh collection đang được phát hành. G-70 thiếu admin quản lý | P02 |
| Giá và tồn kho | Giá 890.000 / 1.050.000 / 1.680.000 VND; `inStock:true`, `stockLeft:null` | D-68 giá gồm VAT; NULL số tồn có thể là không theo dõi hoặc tồn >5, không suy ra tồn thực | P00, P01 |
| Đa ngôn ngữ | `/`, `/en`, `/zh` và API sản phẩm vi/en/zh trả 200 | Có nội dung đa ngôn ngữ; G-14 còn cần duyệt bản dịch | P01, P08 |
| FAQ | `/api/faq` trả dữ liệu, có mốc khóa chữ/media và thời hạn lời chúc | Xác minh đọc được; cần đồng bộ nội dung với vận hành thật | P01, P05 |
| Đăng nhập/đăng ký/quên mật khẩu | Các URL trả app shell 200; providers báo `google:true` | Google được bật cấu hình; chưa chứng minh OAuth callback, refresh, reset email hoạt động | P00 |
| Giỏ hàng | Trang 200; `/api/cart` trả 401 khi chưa đăng nhập | Có guard; chưa thử merge giỏ, cập nhật đồng thời, phục hồi lỗi | P00, P03; G-32 |
| Checkout, payOS/COD, coupon | `/checkout` trả shell 200; chưa thực hiện POST có auth | Có code và atomic RPC mới; migration/provider/webhook chưa nghiệm thu | P00, P03 |
| Danh mục địa chỉ | `/api/geo/provinces` trả 34 tỉnh/thành | Có dữ liệu công khai; chọn xã còn select thường, G-82 | P03 |
| Theo dõi/hủy/hoàn tiền đơn | `/api/orders` trả 401 | Guard có; lifecycle, stock release và hoàn tiền cần test tích hợp | P00, P04, P06 |
| Email giao dịch | Không gửi thư thử trong audit | 5 sự kiện đã có code; gửi trực tiếp chờ tối đa 3 giây, không retry G-67; deliverability G-52/G-66 chưa nghiệm thu | P04 |
| Lời chúc, media, QR nhận quà | Không dùng token của khách thật để kiểm tra | Có code; G-56 thiệp viết tay chưa có quy trình nội dung; G-58/G-63 retention chưa kín | P05, P07 |
| Video lô và điều kiện SHIPPED | Chưa có lô thật được cung cấp để kiểm tra | G-43 chưa nối dòng hàng với lô; G-60 fallback lô mới nhất có thể sai lô mua | P05 |
| Gallery/sưu tập | `/api/gallery` trả 401 | Guard có; chưa nghiệm thu gallery thật, phần thưởng, nhận quà vào gallery | P02; phần mở rộng G-74 chờ PO |
| Đổi trả | `/returns` trả 200 | Chính sách D-98 có; FR-RET-001/002 form/video/admin chưa có, G-75 | P06 |
| Admin: sản phẩm/FAQ/lô/đơn/coupon/users/Mây/GA | `/admin` 200; API sản phẩm admin 401 | Chỉ xác minh truy cập chưa auth bị chặn; các thao tác và phân quyền chưa nghiệm thu | P00 và từng ticket |
| IT, cảnh báo, cron | API health IT 401; expire-orders GET không auth trả 404 | 404 có thể liên quan cấu hình secret hoặc bản deploy; không đủ kết luận cron hỏng. Metrics theo tiến trình dễ mất trên serverless G-35; alerts G-25 chưa có | P00, P04, P08 |
| Mây | History 401 | Chat/FAQ/tour/tra đơn có code; provider, ngân sách và dịch QR thật chưa nghiệm thu | P00, P08; không ưu tiên thêm capability |
| SEO, analytics, headers | sitemap/robots 200, canonical domain thật, HTML vi/en/zh; bootstrap GA4 `G-R1YL0GTE09`; CSP/HSTS/nosniff có | Không chứng minh GA nhận đủ 11 event hoặc admin realtime được cấp quyền | P08 |
| Footer, newsletter, bằng chứng tin cậy | Social links `href="#"`; testimonial nói đèn làm riêng cho người nhận | Newsletter `preventDefault` không lưu email G-11; testimonial lệch D-01, chờ Q-23; thông tin doanh nghiệp G-68 | P01 |
| Privacy | `/privacy` có nội dung về media và mật khẩu đã lộ | D-91 mặc định tắt HIBP; phải kiểm cấu hình trước khi giữ khẳng định “được kiểm tra”. Chính sách/legal Q-40 chưa được coi đã duyệt | P01, P07 |

Lưu ý: probe GET `/api/checkout` trả 404 không phải lỗi feature; quote đúng là POST `/api/checkout/quote`. Không đưa probe sai phương thức vào backlog lỗi.

Một số dòng lịch sử trong BA/progress vẫn nói domain `lamvi.vercel.app` hoặc “chưa Supabase”. Chúng là ghi nhận cũ, **không dùng để khẳng định production hiện tại**. Public API cũng không đủ chứng minh đang dùng adapter nào.

## 3. Nghiên cứu nguồn chính chủ và cách áp dụng

Đã tải và đọc source chính chủ dưới đây ngày 07/10/2026. Đây là nghiên cứu implementation của nền tảng chuyên nghiệp, **chưa phải audit UX trực tiếp website IKEA/Etsy/Shopify của người mua**. Trang tài liệu Shopify, Baymard, Stripe và các domain bán lẻ yêu cầu mở thêm mạng đang bị proxy chặn; không gán kết luận cho những trang chưa đọc.

| Nguồn đọc được | Pattern quan sát được | Áp dụng vào LAMVI |
|---|---|---|
| [Shopify Hydrogen ProductForm](https://github.com/Shopify/hydrogen/blob/main/templates/skeleton/app/components/ProductForm.tsx) | Add-to-cart bị disable khi variant không available; label Sold out; options có trạng thái selected/exists/available | Giá/tồn/CTA phải nhất quán từ catalog đến checkout; không tự bổ sung variants khi BA chưa yêu cầu |
| [Shopify CartLineItem](https://github.com/Shopify/hydrogen/blob/main/templates/skeleton/app/components/CartLineItem.tsx) | Dòng giỏ có ảnh, tên, giá, option; nút số lượng có accessible label; khóa thao tác khi optimistic chưa được server xác nhận; cùng line dùng cùng fetcher key | P03 quản lý pending/error theo dòng, tránh cộng/trừ nhanh làm phản hồi cũ đè mới; server vẫn là nguồn kiểm tồn. Source này không tự chứng minh có giới hạn tồn client |
| [Shopify CartSummary](https://github.com/Shopify/hydrogen/blob/main/templates/skeleton/app/components/CartSummary.tsx) | Có subtotal, trạng thái mã giảm giá áp dụng được, bỏ mã; chỉ render checkout action khi có checkout URL | P03 hiển thị rõ số tiền và lỗi coupon; chặn submit khi quote chưa hợp lệ. Shopify có gift card nhưng LAMVI chưa cần thêm gift card |
| [Stripe webhook signing example](https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/express/main.ts) và [checkout sample](https://github.com/stripe-samples/checkout-one-time-payments/blob/main/server/node/server.js) | Xác minh chữ ký với payload phù hợp; phân nhánh event được xác thực; lỗi chữ ký không xử lý như thành công | P00/P03 kiểm payOS theo hợp đồng của payOS, không sao chép yêu cầu raw-body riêng của Stripe và không thay provider. Trang success phía khách không tự quyết định PAID; replay không gây effect lặp |
| [W3C ARIA combobox](https://github.com/w3c/aria-practices/blob/main/content/patterns/combobox/combobox-pattern.html) | Down/Up điều hướng, Enter chọn, Escape đóng; label, expanded, controls, active-descendant; giữ hành vi sửa text bản địa | P03 ô tìm phường/xã dùng component có keyboard/screen-reader thật; không chỉ gắn role vào dropdown tự chế |
| [Google web-vitals](https://github.com/GoogleChrome/web-vitals) và source [LCP](https://github.com/GoogleChrome/web-vitals/blob/main/src/onLCP.ts), [INP](https://github.com/GoogleChrome/web-vitals/blob/main/src/onINP.ts), [CLS](https://github.com/GoogleChrome/web-vitals/blob/main/src/onCLS.ts) | Ngưỡng good: LCP ≤2,5s, INP ≤200ms, CLS ≤0,1; cần đo ngoài thực tế | P08 đề xuất mục tiêu p75 theo mobile/desktop; audit này chưa có số đo hiệu năng LAMVI, không kết luận đạt/trượt |

Thiết kế outbox, đổi trả và phân bổ lô bên dưới là **đề xuất kỹ thuật suy ra từ BA và rủi ro source LAMVI**, không giả danh kết quả nghiên cứu Shopify/Baymard. Trước khi chốt UX đổi trả, bổ sung nghiên cứu live: đường vào return từ order detail, chọn item/qty, upload lỗi, trạng thái hồ sơ và hỗ trợ. Trước khi chốt PDP, đối chiếu live: ảnh theo góc, kích thước/ngữ cảnh sử dụng, phí giao và thông tin đổi trả. Các kết luận này cần cập nhật khi domain được mở.

Giữ các quyết định hiện hành: tài khoản bắt buộc D-36, VAT đã gồm D-68, một coupon/đơn, COD theo D-41, email Resend D-93, admin tiếng Việt D-48, media upload trực tiếp signed URL T-12, một Vercel Function T-33. Không tự thêm guest checkout, wishlist, tích điểm, review khách hàng, SMS hoặc đổi nhà cung cấp thanh toán.

## 4. Kế hoạch code theo ticket

Tên endpoint/bảng mới dưới đây là đề xuất để review thiết kế; chưa phải API đã tồn tại. Các quyết định PO/legal được tách rõ khỏi phần kỹ thuật có thể làm.

### P00 — Gate: chứng minh nền tảng chạy thật, trước khi mở rộng checkout

**Ưu tiên:** P0. **Liên quan:** G-16/G-22/G-47/G-48/G-50/G-51/G-52/G-55/G-59/G-78/G-83/G-84.

- Đối chiếu deployment SHA trên Vercel, migration 001–013 theo runbook, schema/RPC/grants bằng `scripts/check-schema.js` với credential được cấu hình qua môi trường. Không yêu cầu dán secret vào chat.
- Trên staging Supabase riêng, chạy migration SQL thuần. `supabase/tests/atomic_checkout.sql` là test psql/disposable database, không dán nguyên file vào Editor production; `\set` không phải SQL.
- Test E2E khách/admin/IT: email login, Google callback domain thật, refresh, reset một lần, account bị khóa; cart → quote → order → payOS sandbox/COD → cancel/expiry. Kiểm RLS/role qua API và storage; khách A không đọc đơn/media khách B.
- Xác nhận email thực nhận, webhook chữ ký/replay, cron có last-run và kết quả, signed upload/download, QR test fixture, GA debug/realtime. Mây và dịch dùng staging budget hữu hạn, không gọi tài khoản khách thật.
- Kiểm atomic RPC: hai checkout tranh món cuối chỉ một thành công; coupon còn một lượt chỉ được dùng một lần; transaction lỗi không có order/stock/cart nửa chừng; cancel/expire lặp trả tồn đúng một lần; legacy `stock_reserved NULL` không tự trả tồn chưa biết.

**Files:** migration 013, `server/adapters/supabase/repo.js`, `server/orders/service.js`, `server/routes/orders.js`, `scripts/check-schema.js`, runbook deploy.

**Nghiệm thu:** có bảng PASS/FAIL kèm fixture và timestamp cho từng integration; chưa tích hợp trả trạng thái cụ thể thay vì chỉ “đã cấu hình”; không đánh dấu feature production done chỉ từ suite local. Không rollback bằng cách drop cột/RPC đang được app dùng; xác minh compatibility trước chuyển traffic.

### P01 — Sản phẩm và lòng tin: đủ thông tin để quyết định mua

**Ưu tiên:** P0. **Liên quan:** G-33/G-68/G-14, §31.3, Q-23/Q-40.

- Trước hết dùng upload ảnh đã có để đặt ảnh thật cho 3 SKU; ảnh minh họa phải được ghi rõ. Chuẩn bị ảnh tổng thể, khi bật đèn, cận chất liệu và ảnh cạnh vật chuẩn kích thước; chủ shop xác nhận quyền sử dụng và thông tin kỹ thuật.
- Review PDP bằng dữ liệu thật: kích thước, chất liệu, nguồn điện/bóng đèn, phụ kiện đi kèm, hướng dẫn dùng/bảo quản, thời gian chuẩn bị, phí/thời gian giao, tóm tắt đổi trả và đường vào hỗ trợ. Không tự bịa watt/IP rating/thời gian bảo hành hoặc cam kết giao.
- Khi BA/content duyệt gallery nhiều ảnh/specs: migration additive `product_images` (product, thứ tự, alt vi/en/zh, storage key) và trường thông số được kiểm chứng; adapter, API catalog, admin upload/reorder/delete, PDP gallery. Không đổi single-image contract cũ đột ngột.
- Footer có hotline/email/địa chỉ/pháp nhân thực được cung cấp. Social chỉ hiển thị URL hợp lệ. Newsletter: PO quyết giữ/bỏ; nếu giữ mới làm opt-in, consent, unsubscribe và provider; không nối email marketing mặc định.
- Testimonial hiện tại chờ Q-23: thay bằng nội dung được duyệt có nguồn/consent hoặc PO duyệt ẩn; không thêm review giả. Đổi claim video theo lô D-01. Privacy sửa theo cấu hình HIBP thực và nội dung được legal duyệt.

**Files:** `src/pages/ProductPage.jsx`, `src/components/ProductImage.jsx`, `src/components/ProductCards.jsx`, `src/admin/ProductsPage.jsx`, `src/components/SiteFooter.jsx`, `src/i18n/messages/*`, catalog adapter/SEO.

**Nghiệm thu:** cả 3 SKU có ảnh thật đúng sản phẩm; lỗi ảnh không làm mất giá/CTA; alt có nghĩa; ảnh có kích thước tránh layout shift; SKU hết hàng không mua được; nội dung vi/en/zh không đưa cam kết khác nhau; không link social giả; Organization/OG lấy dữ liệu duyệt. Phần gallery/spec mới chỉ code sau duyệt phạm vi; upload ảnh hiện có không cần thiết kế lại.

### P02 — Quản lý và phát hành bộ sưu tập thực

**Ưu tiên:** P1, lên P0 nếu chiến dịch bán bộ sưu tập sắp chạy. **Liên quan:** G-70/G-71, D-96/D-97.

- Thêm admin CRUD collection, publish/unpublish theo quy tắc BA, nội dung vi/en/zh, ảnh/cốt truyện/phần thưởng được tác giả duyệt. Product form chọn collection và pieceOrder; backend kiểm slug, thứ tự và quyền cập nhật.
- Đề xuất API `/api/admin/collections`; mở rộng adapter memory/Supabase và audit metadata. Giữ đường public `/api/collections` và collection slug; published rỗng không tạo card dẫn tới 404. Draft không lộ reward bị khóa.
- Thử đủ flow mua đèn lẻ trong bộ, cộng mảnh khi đơn đủ điều kiện, idempotency khi event lặp, unlock phần thưởng, hủy/hoàn theo đúng D-97. Không tự mở rộng gallery nhận quà G-74 khi PO chưa chốt.

**Files:** `server/routes/catalog.js`, `server/routes/admin.js`, `server/routes/gallery.js`, `server/adapters/supabase/repo.js`, `src/admin/ProductsPage.jsx`, `src/pages/CollectionPage.jsx`; thêm admin CollectionsPage.

**Nghiệm thu:** admin tạo/gán/publish được không dùng SQL tay; public chỉ thấy bộ hợp lệ; order piece ổn định; phần thưởng không xem được bằng gọi API trực tiếp khi chưa đủ điều kiện; thao tác đồng thời không đếm hai lần. Nội dung thiếu có checklist rõ cho chủ shop, không seed production bằng fiction.

### P03 — Checkout dễ dùng và phục hồi lỗi chắc chắn

**Ưu tiên:** P0/P1, sau P00. **Liên quan:** G-32/G-82, FR-CART/ORD/PAY/CPN, D-99/D-100.

- Bản đầu đổi select xã thành searchable combobox: lọc có/không dấu, keyboard, no-results, loading/error/retry; đổi tỉnh xóa xã cũ; server kiểm xã thuộc tỉnh. Giữ địa chỉ 2 cấp; không trả lại quận/huyện.
- Sổ địa chỉ là mở rộng riêng: PO duyệt rồi mới thêm bảng private theo user, CRUD authenticated, chọn ở checkout, bản snapshot địa chỉ trong đơn không đổi theo sổ.
- Summary hiển thị item/qty, giá gồm VAT, giảm giá, phí giao và tổng từ quote server; chưa xác định phí phải nói rõ, không trình bày 0 đồng như miễn phí. Submit bị khóa khi quote pending/expired; validation giữ dữ liệu, focus lỗi đầu và có error summary. COD giao cho người khác vẫn bị chặn theo BA.
- Giỏ có trạng thái pending/error theo dòng; phản hồi cũ không đè thao tác mới. Đánh giá G-32 bằng test đồng thời và chuyển merge/limit sang transaction/RPC nếu tái hiện. Đơn đã commit nhưng response timeout: trước hết tra cứu khả năng dùng khóa hiện có; nếu chưa có, thiết kế idempotency key unique theo user/request để retry trả cùng order, không tạo lần hai và không tự hoàn kho.
- Webhook payOS chỉ cập nhật theo xác thực/provider status phù hợp; success redirect phải query trạng thái server; pending/payment failed/expired có màn hình rõ và retry đúng quy tắc, không sửa lifecycle đã chốt.

**Files:** `src/pages/CheckoutPage.jsx`, `src/pages/CartPage.jsx`, `src/cart/*`, `server/routes/geo.js`, `server/routes/cart.js`, `server/routes/orders.js`, order service/repo.

**Nghiệm thu:** cùng key hai request trả cùng order; payload khác cùng key bị reject; stock/price/coupon đổi sau quote báo đúng và không làm mất địa chỉ; double-click không tạo hai đơn; mobile keyboard không che CTA/lỗi; keyboard-only chọn địa chỉ được; API không tin giá/tổng client. Địa chỉ lưu/idempotency chưa có phải migration additive, không gom với chỉnh giao diện nhỏ.

### P04 — Email giao dịch có retry và trạng thái vận hành

**Ưu tiên:** P1. **Liên quan:** G-67/G-45/G-66, D-93.

- Đề xuất transactional outbox: `notification_jobs` với order/event/version, channel, locale, trạng thái pending/leased/sent/dead, attempts, next_attempt_at, lease_until, provider message id và lỗi đã che. Unique(event, entity, version); không ghi body lời chúc/media/QR token vào log.
- Tạo job cùng transaction thay đổi trạng thái; worker claim bằng lease/locking và retry backoff có giới hạn, phân biệt lỗi tạm thời với cấu hình sai. Nếu provider không hỗ trợ idempotency, phải ghi rõ khả năng thư trùng khi gửi thành công nhưng mất acknowledgement; không hứa exactly-once.
- Worker chạy bằng scheduler tương thích một Vercel Function. Cron ngày hiện tại không đủ cho SLA email vài phút: chọn scheduler/gói sau kiểm điều kiện triển khai; chưa có scheduler thì không công bố SLA này.
- Admin/IT xem pending/dead và retry có audit, không resend bất kỳ bằng endpoint public. Nhắc lời chúc cần PO chốt thời điểm/đối tượng; mail đổi trả nối sau P06. Không đổi quy tắc D-92 ở quên mật khẩu bằng suy đoán bảo mật.

**Files:** `server/orders/notify.js`, `server/mail/*`, order transaction/repo, `server/routes/it.js`, `src/it/*`, cron route; migration và `.env.example`/runbook khi thêm config.

**Nghiệm thu:** provider timeout không mất job; hai worker không claim cùng lease; worker chết job phục hồi; trạng thái đơn vẫn đúng khi mail lỗi; replay không sinh job thứ hai; retry không vô hạn; Gmail/Outlook mobile, dark mode và chặn ảnh vẫn đọc được nội dung; có support reply-to đã xác nhận.

### P05 — Đúng lô sản xuất, QR và quy trình gói quà

**Ưu tiên:** P1 về trải nghiệm, P0 trước khi cam kết truy xuất video lô đúng. **Liên quan:** G-43/G-60/G-56, BR-ORD-002, D-01/D-28/D-89.

- Làm rõ cardinality: một dòng qty>1 có thể thuộc nhiều lô; bộ đèn có thể có nhiều thành phần. PO/vận hành xác nhận cách phân bổ trước chọn schema. Đề xuất bảng `order_item_batch_allocations` với item/batch/quantity nếu nhiều lô; không mặc định một batch_id cho mọi trường hợp.
- Admin fulfillment gán lô, xem thiếu allocation/video, xuất QR đúng lô. Transition SHIPPED kiểm tất cả allocation đủ số lượng và lô đã publish trong transaction; có đường xử lý đơn legacy thiếu dữ liệu, không tự gán lô mới nhất.
- QR trên đèn giữ mã lô chung D-43; QR trên thiệp giữ token đơn opaque. Đơn không lời chúc đi đến lô được phân bổ thực; khi nhiều lô trình bày rõ danh sách, không chọn ngẫu nhiên.
- Thiệp viết tay không thể triển khai bằng cách tự mở quyền đọc lời chúc. Chờ Q-14; nếu PO duyệt quyền hẹp: chỉ vai trò fulfillment, chỉ đơn cần xử lý, action xem có audit metadata, không log text, không bulk export; không thay D-89 trước duyệt.

**Files:** `src/admin/OrdersPage.jsx`, `src/admin/BatchesPage.jsx`, `server/routes/admin.js`, `server/routes/qr.js`, order service/repo, `src/pages/GiftPage.jsx`, `src/pages/BatchPage.jsx`.

**Nghiệm thu:** thiếu một lô/video không ship được; qty phân bổ không vượt/thiếu; API không bỏ qua guard qua cập nhật trực tiếp; QR không hiển thị video của lô không mua; customer A không xem greeting B; người mua không tự kích hoạt countdown; confirm recipient không biến đơn thành DELIVERED. Test đổi lô đồng thời với ship/publish.

### P06 — Đổi trả từ đơn hàng đến xử lý của admin

**Ưu tiên:** P1. **Liên quan:** FR-RET-001/002, G-75, D-07/D-98; các câu hỏi hoàn tiền/chi phí/video chưa chốt vẫn giữ mở.

- Entry “Yêu cầu đổi trả” trong order detail khi đủ điều kiện; chọn item/qty, reason thuộc lỗi sản xuất/hư hỏng vận chuyển/giao sai, mô tả, video liên tục; hiển thị điều kiện 7 ngày từ DELIVERED và không nhận đổi ý.
- Đề xuất `return_requests`, `return_items`, `return_attachments`, status history. State machine đề xuất requested → needs_info/approved/rejected → received → resolved; PO duyệt tên/state và nhánh không cần gửi hàng trước code. Đơn/qty đã có claim đang xử lý không tạo claim trùng vượt số lượng.
- API đề xuất `/api/orders/:code/returns` và `/api/admin/returns`; server kiểm owner, delivered_at và hạn theo BA. Chốt cách tính 7 ngày và timezone trước AC biên; không tự lấy ngày đặt đơn.
- Video dùng bucket private và signed direct-upload, limits MIME/kích thước/thời lượng sau PO duyệt; attachment gắn owner/claim, kiểm finalize và cleanup upload mồ côi. Không POST video qua Vercel body 4,5 MB.
- Admin có hàng chờ, chi tiết, yêu cầu bổ sung, quyết định và audit; khách thấy timeline/lý do. Phương án đổi/hoàn, phí gửi và partial refund cần quyết định. Không tự gọi refund tiền thật; tái dùng quy tắc/provider hiện hành sau chốt, lưu reference và đối soát.

**Nghiệm thu:** claim không auth/khác chủ bị chặn; deadline đúng ở biên; thiếu video không submit; upload gián đoạn retry được; hai claim không vượt qty; reject cần lý do; refund replay không hoàn hai lần; nội dung nhạy cảm không lộ public/log. Test admin và khách trên staging, email thông báo dùng P04.

### P07 — Retention và quyền riêng tư phù hợp vận hành

**Ưu tiên:** P1; quyết định thời hạn là dependency. **Liên quan:** G-58/G-63/G-30/G-76, NFR-PRV-003, Q-40/I-15.

- Giữ quy tắc media 30 ngày sau người nhận xác nhận/90 ngày sau giao theo BA. PO chốt media của cancelled/delivery_failed và đơn không bao giờ được đánh dấu DELIVERED; không tự chọn thêm N ngày.
- Tách deadline khỏi việc có người mở QR; scheduled sweep có checkpoint/retry và báo cáo last success. Hết hạn chặn cấp signed URL ngay dù storage cleanup còn chờ; thời gian TTL URL cũ và khả năng revoke phải được kiểm thực.
- Cleanup private orphan uploads, metadata/file xóa nhất quán, job retry được khi storage lỗi; không xóa video lô công khai theo retention lời chúc.
- Quy trình yêu cầu xóa/export dữ liệu, lịch sử Mây và lưu chứng từ đơn chờ legal. Policy chỉ nói những gì hệ thống/cấu hình thực làm; phạm vi audit ghi log phải cụ thể.

**Nghiệm thu:** test timezone/clock ở trước/đúng/sau deadline; storage lỗi không mở lại quyền xem; sweep chạy lặp an toàn; cancelled không giữ vô hạn theo chính sách đã duyệt; báo cáo không chứa text/token/media. Migration không đặt deadline hàng loạt khi PO chưa duyệt.

### P08 — Đo được chất lượng: IT, analytics, accessibility, hiệu năng

**Ưu tiên:** P1 cho giám sát thiết yếu, P2 cho tối ưu sâu. **Liên quan:** G-25/G-26/G-27/G-35/G-50/G-72/G-79, NFR-A11Y/PERF/OBS.

- Metrics durable thay timer RAM: thống kê request/error tích lũy vào kho bền vững/batch thích hợp, lọc secret/PII. IT thấy last cron/mail/webhook success và trạng thái stale, không chỉ configured.
- Alerts 5xx/provider/low stock/budget có threshold, cooldown/dedup và clear; PO chốt người nhận/ngưỡng cho nghiệp vụ, IT chốt SLO kỹ thuật. Không phát email mỗi request lỗi và không ping AI tính phí để “health check”.
- Nối GA service account nếu cần realtime; validate đủ 11 sự kiện bằng DebugView, purchase không lặp; không gửi greeting/email/SĐT vào GA. Funnel đề xuất view_item → add_to_cart → begin_checkout → purchase; metric không có data không hiển thị bằng số 0 giả.
- Browser QA 360/390/768/desktop, keyboard, focus, screen reader, zoom 200%, contrast kính mờ, reduced-motion. Kiểm sticky header không che heading/lỗi/CTA; navigation và cart accessible trên mobile.
- Đo baseline trước tối ưu ảnh/font/blur/animation. Đề xuất p75 LCP≤2,5s/INP≤200ms/CLS≤0,1; RUM cần đủ traffic, Lighthouse lab không thay p75 thực. Đặt budget bundle/ảnh sau baseline, không tự tuyên bố đạt chuẩn.

**Nghiệm thu:** request serverless kết thúc vẫn giữ counters; alert dedup/cooldown có test; GA đo staging không làm bẩn property production; có bằng chứng browser và số đo trước/sau thay đổi. Logs và dashboard không công khai dữ liệu nhạy cảm.

## 5. Thứ tự triển khai và điều kiện bắt đầu

| Đợt | Ticket | Kết quả giao được | Dependency |
|---|---|---|---|
| 0 | P00 | Bảng integration PASS/FAIL, deployment/migration/config được xác minh | Read-only quyền môi trường và staging/test account |
| 1 | P01 + phần combobox/pending của P03 | 3 PDP có ảnh/nội dung thật, footer đáng tin, checkout rõ ràng | Ảnh/spec/company/content duyệt; không cần chờ toàn bộ legal để sửa kỹ thuật riêng |
| 2 | P04 + P02 | Mail không bị mất âm thầm; shop tự quản collection | Scheduler phù hợp, nội dung collection và reward |
| 3 | P05 | Order → allocation → đúng video/QR; quy trình thiệp rõ | PO chốt phân bổ lô và Q-14; gate ship có compatibility đơn cũ |
| 4 | P06 | Khách gửi hồ sơ, admin xử lý và đối soát | Các quyết định return chưa chốt, private upload, P04 |
| 5 | P07 + P08 | Retention đầy đủ và hệ thống đo/giám sát được | Policy/legal; metrics thực hiện song song các đợt trước |

Mỗi ticket chia PR nhỏ: schema/API trước, admin tiếp, storefront sau, verification/rollout cuối. Giữ adapter memory và Supabase tương thích. Không gộp toàn bộ backlog thành một migration/PR. Chưa ước lượng ngày hoàn thành vì staging access, nội dung, scheduler và nghiệp vụ chưa xác nhận; sau P00 có thể estimate từng PR theo scope thực.

Các phần có thể bắt đầu code ngay theo BA đã duyệt: combobox địa chỉ, cart pending/error, collection admin trong quy tắc D-96/D-97, cơ chế outbox với giới hạn scheduler hiện tại, UI quan sát job/cron. Phần cần quyết định trước: quyền đọc thiệp; mô hình allocation và đơn legacy; nhánh/chi phí/partial refund/video limits; retention đơn hủy/thất bại; newsletter và nội dung pháp nhân/testimonial. Không coi plan này là PO đã duyệt những quyết định đó.

## 6. Definition of Done cho một feature

1. Đối chiếu FR/BR/AC và D-xx trước code; đánh dấu chính xác các câu hỏi cần PO/legal, không sửa BA để hợp thức hóa implementation.
2. Schema additive, RLS/grants và API validation; phân quyền customer/admin/IT; có adapter và migration compatibility.
3. UI có empty/loading/pending/success/error/retry, i18n đúng, keyboard/mobile và nội dung duyệt.
4. Test AC/edge case có giá trị, bao gồm concurrency/idempotency nếu đụng stock/payment/jobs; independent test review theo T-11 khi code feature. Lint/test/build xanh.
5. Test integration staging với provider thật/sandbox thích hợp; không lấy mock PASS làm bằng chứng production. SQL test destructive chỉ dùng DB disposable.
6. Cập nhật BA §31.2/31.3, progress, architecture, env/runbook/decisions khi cần. Release checklist có thứ tự migrate→deploy phù hợp compatibility, quan sát lỗi và phương án quay lại; không drop dữ liệu để rollback.
7. Sau deployment, kiểm public và E2E test account được phép; cập nhật ma trận này bằng bằng chứng. Đánh dấu “done production” khi có kết quả, không khi chỉ merge master.

## 7. Bằng chứng và hạn chế nghiên cứu

Trong workspace có `production-evidence.json` (36 public checks), nội dung response và `reference-evidence.json` (12 nguồn chính chủ) tại `/workspace/lamvi-research`. Các snapshot API chỉ gồm dữ liệu public và lỗi chưa auth; không có đơn/media khách.

Yêu cầu mở thêm domain đã được lưu thành `/workspace/lamvi-research/network-proposal.json`. Tool lưu network draft trả **CONFLICT stale_base**, chưa xác nhận lưu. Không phải lỗi của website tham khảo. Cần đối chiếu proposal với cấu hình cloud hiện tại qua setup chat mới/settings; không ghi đè dựa trên draft cũ. Các nguồn live bị chặn chưa được xem và không được dùng như bằng chứng trong kế hoạch.

Giới hạn còn lại: chưa có browser E2E production, chưa có tài khoản test và deployment/database/provider bindings để audit read-only integration. Kế hoạch đủ để mở các ticket kỹ thuật nêu trên; phần benchmark live retailer và các gate chưa xác minh phải hoàn tất trước khi gọi toàn bộ trải nghiệm bán hàng là đã nghiệm thu.
