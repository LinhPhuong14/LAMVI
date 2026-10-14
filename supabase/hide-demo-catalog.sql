-- Chạy MỘT LẦN trong Supabase SQL Editor, SAU supabase/seed.sql (D-104, G-112).
-- Ẩn (không xoá) danh mục demo cũ để web chỉ còn 5 đèn thật; đơn cũ vẫn giữ nguyên tham chiếu.
update public.products
   set status = 'hidden'
 where slug in ('den-nguyet', 'den-vong', 'den-sum-vay', 'den-tinh',
                'den-hoi-xuan', 'den-hoi-ha', 'den-hoi-thu', 'den-hoi-dong')
   and status <> 'hidden';

update public.collections
   set status = 'hidden'
 where slug in ('sum-vay', 'hoi-lang')
   and status <> 'hidden';
