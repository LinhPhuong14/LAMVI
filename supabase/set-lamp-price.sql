-- Chạy MỘT LẦN trong Supabase SQL Editor (D-110): giá 5 đèn thật = 1.499.000 đ (đã gồm VAT).
-- Cần vì supabase/seed.sql dùng `on conflict do nothing` nên không ghi đè giá của dòng đã có.
update public.products
   set price = 1499000
 where slug in ('den-thu-hoach', 'den-tu-linh', 'den-phuc-loc-song-toan',
                'den-ga-tam-duong-khai-thai', 'den-lon-dan')
   and price <> 1499000;
