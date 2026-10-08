-- Thông số sản phẩm (feedback 08/10, mục 8 và 33.5): kích thước, chất liệu, nguồn sáng, cân nặng,
-- thời gian làm, bảo quản. Mỗi khoá là văn bản đa ngôn ngữ {vi, en, zh}; null = chưa nhập.
alter table public.products
  add column if not exists specs jsonb;

alter table public.products
  drop constraint if exists products_specs_object_check;
alter table public.products
  add constraint products_specs_object_check
  check (specs is null or jsonb_typeof(specs) = 'object');
