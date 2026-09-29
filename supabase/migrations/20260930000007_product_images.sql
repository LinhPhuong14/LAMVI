-- Ảnh sản phẩm (G-23, G-33). Tải lên Supabase Storage bằng signed upload URL như video lô (D-46).
-- Dùng cho thẻ sản phẩm, trang chi tiết, og:image riêng của trang sản phẩm và JSON-LD Product.
alter table public.products
  add column image_url text,
  -- Đường dẫn trong bucket product-images; giữ để thay/xoá đúng object
  add column image_path text,
  -- Chú thích ảnh đa ngôn ngữ {vi, en, zh} — alt cho trình đọc màn hình và SEO (T-06)
  add column image_alt jsonb;

-- Có đường dẫn thì phải có URL và ngược lại
alter table public.products
  add constraint products_image_pair_check
  check ((image_url is null) = (image_path is null));
