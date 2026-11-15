-- D-142: admin tạo phong thư không cần đơn hàng (thư lẻ). order_id thành tuỳ chọn; unique(order_id)
-- vẫn giữ "mỗi đơn tối đa một thư" (Postgres cho nhiều dòng NULL). Thêm ghi chú nội bộ để admin
-- nhận ra thư lẻ trong thư viện QR (người nhận không thấy). Chạy lại an toàn.
alter table public.order_letters alter column order_id drop not null;
alter table public.order_letters add column if not exists label text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_letters_label_len') then
    alter table public.order_letters add constraint order_letters_label_len check (label is null or char_length(label) <= 120);
  end if;
end $$;
create index if not exists order_letters_standalone_idx on public.order_letters (updated_at desc) where order_id is null;

notify pgrst, 'reload schema';
