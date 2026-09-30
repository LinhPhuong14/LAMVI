-- Giá niêm yết đã gồm VAT (D-68, thay D-03 / I-04) + cấu hình tính giá (D-69 Q-09, D-70 Q-11).
--
-- Trước D-68 cột này là giá CHƯA VAT. Web chưa go-live, bảng products mới chỉ có dữ liệu seed
-- nên giá trị hiện có được diễn giải lại thành giá ĐÃ gồm VAT, không quy đổi.
-- Nếu chạy trên dữ liệu thật đã bán hàng thì phải quy đổi: price = round(price_excl_vat * 1.1).
alter table public.products rename column price_excl_vat to price;
alter table public.products rename constraint products_price_excl_vat_check to products_price_check;
comment on column public.products.price is 'Giá niêm yết ĐÃ gồm VAT, số nguyên VND (D-68, T-09)';

-- Cấu hình tính giá do admin sửa (không hard-code): thuế suất, phí ship, ngưỡng miễn phí ship.
-- Lưu ở app_settings (đã có từ 20260928000003_it.sql) với key 'pricing'.
insert into public.app_settings (key, value)
values ('pricing', '{"vatRate":0.1,"shippingFee":30000,"freeShippingFrom":1000000}'::jsonb)
on conflict (key) do nothing;
