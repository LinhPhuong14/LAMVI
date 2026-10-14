-- Câu chuyện từng mẫu đèn (G-108, D-105): văn bản dài đa ngôn ngữ {vi, en, zh}, các đoạn cách nhau
-- bằng dòng trống. Hiện ở tab "Câu chuyện" của trang sản phẩm và ở trang lời chúc (QR trên thiệp cảm ơn).
-- null = chưa nhập.
alter table public.products
  add column if not exists story jsonb;

alter table public.products
  drop constraint if exists products_story_object_check;
alter table public.products
  add constraint products_story_object_check
  check (story is null or jsonb_typeof(story) = 'object');
