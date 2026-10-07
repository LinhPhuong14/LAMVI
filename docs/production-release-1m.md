# Bản code production và gate phục vụ 1M users

Nhánh `feat/production-commerce-readiness`, ngày 07/10/2026. Tham chiếu [plan P00–P08](production-feature-plan-2026-10-07.md), [BA v0.38](ba-spec.md) và [runbook deploy](knowledge/deploy-vercel.md).

## Phạm vi đã triển khai

| Plan | Code bàn giao | Chưa thể gọi hoàn tất production |
|---|---|---|
| P00 | Fail-closed production khi thiếu Supabase/HTTPS/salt/rate-limit/proxy; CLI preflight mở rộng | Chưa có binding/deployment/test account để xác minh runtime thật |
| P01 | Footer lấy contact/social hợp lệ; SSR public settings; newsletter disabled rõ ràng; privacy HIBP conditional | Ảnh/spec/legal/support/testimonial thật cần chủ shop và pháp chế |
| P02 | Collection CRUD, product assignment, reward private, FK + audit + admin UI | Migration 014, nội dung bộ/phần thưởng thật và E2E production |
| P03 | Searchable wards, serial cart UI, quote pending/error protection, validation focus; checkout key/fingerprint replay | Migration 018; saved addresses/full-reload recovery và G-32 cart transaction chưa làm |
| P04 | Transactional email event, leases/fencing/retry, provider idempotency, IT panel và scheduler endpoint | Migration 015, phối hợp chuyển tiếp, provider quota/scheduler và hộp thư thật |
| P05 | Giữ các quyền/QR hiện hành | Chờ PO: allocation nhiều lô, quyền đọc thiệp; chưa thay fallback latest batch hoặc ship guard |
| P06 | Private evidence upload, buyer submit, admin approve/reject/manual resolution, cursor queue | Migration 016; gate mặc định 0. PO chốt video/retention; không có tự chuyển tiền |
| P07 | TTL URL media lời chúc không xin dài hơn thời gian còn lại | Các thời hạn hủy/giao thất bại/evidence/orphan và pháp chế chưa được duyệt |
| P08 | Serverless metrics ACK idempotent + DB aggregate, lazy private routes, hydration ổn định, keyboard lookbook; đo web-vitals cục bộ | Migration 017; RUM collector/staging capacity/proactive alerts và nghiệm thu thiết bị thật |

Đây là bản code có kiểm thử; **không phải chứng nhận production phục vụ 1M user**. Không tự thay các quyết định đang mở trong BA.

## “1M user” phải được định nghĩa thành tải

Một triệu tài khoản tích lũy khác một triệu người đồng thời. Trong khi chờ PO chốt, dùng **profile thử tải đề xuất**, không coi là lượng traffic thật hay cam kết kinh doanh:

- 1M tài khoản; DAU 10% = 100k; khoảng 30 request/người/ngày → 3M request/ngày, ~35 RPS trung bình, peak 10× ~350 RPS.
- Gate staging đề xuất: 500 RPS đọc public, 50 RPS authenticated, 10 checkout/s; 30 phút peak + 2 giờ soak, spike ×2 trong 5 phút. Phân bố mix phải lấy từ analytics thật, không cộng tất cả thành benchmark chưa thực hiện.
- Nếu yêu cầu là 1M concurrent hoặc giao hàng quốc tế, cần sizing/phạm vi khác: vùng chạy, phương thức tiền tệ/thanh toán, thuế, vận chuyển, hỗ trợ/ngôn ngữ và legal. BA hiện bán/giao Việt Nam, tiền VND, vi/en/zh.

## Hạ tầng cần xác nhận trước launch

1. CDN cache HTML public/assets đúng, private/account/QR token/API auth `no-store`; không mở cache dữ liệu riêng tư để tăng điểm benchmark. Checkout luôn kiểm giá/tồn/coupon ở DB.
2. Vercel plan có concurrency/duration/regions phù hợp; Express một Function theo T-33; DB/write gần application region. Global CDN phục vụ assets/public HTML, không thể suy ra latency checkout toàn cầu từ latency cache.
3. Supabase compute/storage/connection/auth rate quota, WAL/IO, backup/PITR và restore drill theo RPO/RTO được vận hành chốt. Đánh giá per-user lock contention và hot SKU/coupon bằng tải DB thật.
4. Resend quota/deliverability/SPF/DKIM/reply-to và scheduler thường xuyên. Mỗi lần worker tối đa 5 job; gọi tiếp khi `saturated:true`, giới hạn concurrency theo quota. Daily cron hiện tại không phải email SLA vài phút. Khối lượng thư = confirmed + shipped + cancel/refund/expiry + auth mail, không chỉ số đơn.
5. Storage video tải trực tiếp signed URL; private evidence/media không public. Đo băng thông, signed-URL expiry, cleanup, file quota; gate đổi trả vẫn 0 khi retention chưa chốt.
6. Monitoring ngoài application (uptime/error/runtime/database/queue age) và alert receiver/SLO/cooldown; metrics mới có bounded retry nhưng có thể mất phần chưa ACK khi DB outage rồi process đóng. Queue telemetry không thay pager/incident response.

## Load test và nghiệm thu có ý nghĩa

- Dùng staging riêng và provider sandbox; không load test đơn/email/AI lên production hoặc khách thật.
- Fixture 1M user phải được tạo bằng công cụ Supabase Auth/admin phù hợp schema hiện hành trong staging; không bulk SQL vào project production, không dùng chính credential production để seed. Nhóm 10k–100k tài khoản active dùng dữ liệu tổng hợp, không trích PII khách.
- Test mixes public cached/uncached, authenticated list, cart update, quote, checkout, order tracking; healthy và fault injection provider timeout/429/DB ack loss/replay. Test hai phiên thật cùng khách, hot SKU/coupon và worker đồng thời.
- Gate đề xuất: read API p95≤500ms, write p95≤1s, create-order DB p95≤1s (tách thời gian provider), server 5xx<0,1%; không oversell/coupon double-use/double-refund/duplicate-order. Đây là mục tiêu đề xuất để sizing, chưa được benchmark thật hoặc chốt SLO.
- Browser field metric p75 mobile/desktop: LCP≤2,5s, INP≤200ms, CLS≤0,1. RUM cần traffic đủ và collector durable được duyệt; `window.__LAMVI_WEB_VITALS__` chỉ là tối đa 3 phép đo cục bộ của document, không phải báo cáo p75 thật và không gửi thêm GA event/PII.
- Kiểm browser keyboard, reduced-motion, signed uploads và reader/device thật. Axe automation không thay screen-reader/manual contrast/flow acceptance. Đo trước/sau cùng build/device/network.

Local lab command (chỉ loopback, đọc dữ liệu, không có provider/CDN/Supabase):

```bash
ALLOW_LOCAL_MEMORY=1 PUBLIC_SITE_URL=http://127.0.0.1:5345 PORT=5345 npm start
node scripts/load-smoke.js --requests=1000 --concurrency=20 --output=/tmp/lamvi-load.json
python3 scripts/test-checkout-postgres.py
```

Load smoke ngày 07/10: 1.000 request, concurrency 20, 0 lỗi; 278,1 RPS, p95 149ms, p99 289ms trên memory adapter cùng máy, không CDN. **Không extrapolate số này thành năng lực 1M user.** Chạy lại sau thay đổi build/hạ tầng để đánh giá; hiện chưa có kết quả staging.

## Trình tự rollout không mất/trùng dữ liệu

1. Kiểm backup và lịch sử migration, preflight credential qua environment settings; không gửi key trong chat. Chỉ áp dụng migration còn thiếu, không chạy lại toàn bộ schema/seed.
2. Migration 014 (collection FK NOT VALID): đọc/đối soát legacy refs; không tự đổi reward identity, không drop/xóa dữ liệu để ép validate.
3. Migration 015 (outbox) **bắt đầu capture ngay**. Phối hợp maintenance/pause writes và cutover: pause → chờ in-flight legacy mail hoàn tất → áp dụng 015 → deploy flag `NOTIFICATION_OUTBOX_ENABLED=1` → kiểm Preview/worker/provider → resume. Nếu 015 đã chạy khi legacy direct mail còn active, đối soát job của khoảng chuyển tiếp và đánh dấu đã xử lý theo bằng chứng; không drain mù quáng hoặc đánh dấu cả pending dead dựa vào suy đoán.
4. Migration 016 (private return evidence), 017 (metric RPC/aggregate), 018 (checkout key/RPC) trước code dùng schema. **Không chạy lại 013 sau 018**, vì `create or replace` RPC cũ sẽ bỏ idempotency. Runner disposable chỉ repeat 013 tại đúng thời điểm trước migration tiếp theo.
5. `RETURNS_VIDEO_MAX_MB=0` giữ tắt submit. Chỉ bật giá trị ≤100 sau PO duyệt định dạng/dung lượng, retention/evidence và legal; đây là technical ceiling, không tự duyệt 100MB.
6. Run CLI preflight, Preview E2E real integrations; staging quota/load gate đạt mới merge master. Rollback app theo compatibility, không drop cột/tables; không bật lại legacy direct mail với outbox traffic nếu chưa xử lý capture/duplication. Khi outbox lỗi, giữ pending và sửa/drain, không xóa job để giảm dashboard.
7. Sau deploy: schema+SHA được xác nhận, public GET/SSR/assets và test-account E2E; email accepted/delivered phân biệt, cron last-run/queue lag, provider webhook; theo dõi so sánh baseline.

## Các blocker cụ thể còn lại

- Environment hiện không có Supabase/Vercel/Resend/cron binding; CLI preflight dừng với mã lỗi, chưa kết nối DB thật của production. Local PostgreSQL disposable là bằng chứng transaction, không chứng minh migration đã chạy trên website.
- Các câu hỏi PO đang mở vẫn ở BA: Q-14 quyền đọc thiệp, allocation lô, video đổi trả/retention, newsletter/testimonial, các mốc media hủy/thất bại, phạm vi quốc tế/định nghĩa tải. Không lấy thời gian chờ trả lời làm chấp thuận.
- Dữ liệu: ảnh/spec 3 SKU, collection/reward author approval, thông tin pháp nhân/kênh hỗ trợ và legal policy. Không thay bằng nội dung giả.
- Chưa có rollout production hoặc kiểm tải staging, chưa hoàn tất P05/P07 và các mở rộng P03/P08 nêu trong bảng. Nhánh review được bàn giao để tiếp tục sau khi các prerequisite được cung cấp.
