-- D-113: tạm thời chỉ còn COD (không thanh toán trước) → đơn tặng giao người khác cũng dùng COD.
-- Bỏ ràng buộc DB `orders_cod_self_only` (BR-PAY-004). Quy tắc vẫn do ứng dụng áp dụng khi bật payOS
-- (`validateCheckout(..., { onlinePayment })`). Chạy lại an toàn.
alter table public.orders drop constraint if exists orders_cod_self_only;
notify pgrst, 'reload schema';
