-- Rà soát RLS (2026-10-02). Frontend không gọi PostgREST trực tiếp (T-05); mọi truy cập bảng qua
-- server bằng service role. Tất cả bảng public đã bật RLS và không có policy (khoá anon/authenticated).
-- Migration này thêm lớp phòng thủ thứ hai và vá các chỗ còn hở:

-- 1) claim_coupon / release_coupon chưa thu hồi EXECUTE như các hàm khác (record_api_metrics, may_*).
--    Mặc định PUBLIC được gọi RPC qua PostgREST.
revoke execute on function public.claim_coupon(uuid) from public, anon, authenticated;
revoke execute on function public.release_coupon(uuid) from public, anon, authenticated;

-- 2) Thu hồi quyền bảng/hàm/sequence mặc định của anon & authenticated: nếu sau này có người lỡ tắt RLS
--    hoặc thêm policy rộng tay, dữ liệu vẫn không lộ. service_role không bị ảnh hưởng.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- EXECUTE mặc định nằm ở role PUBLIC, không phải anon/authenticated → thu hồi cả ở PUBLIC (hàm tương lai cũng vậy).
-- Hàm trigger không cần EXECUTE lúc kích hoạt nên không bị ảnh hưởng.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

-- 3) Bucket ảnh sản phẩm trước đây không có migration tạo (chỉ tạo tay) → môi trường mới thiếu bucket.
--    Công khai để đọc; ghi chỉ qua signed upload URL của server. Khớp IMAGE_TYPES ở server/domain/admin.js.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('product-images', 'product-images', true, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types;
