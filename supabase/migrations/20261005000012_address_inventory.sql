-- G-46 (D-99): địa chỉ chọn từ danh mục hành chính 2 cấp (tỉnh/thành → phường/xã, từ 01/07/2025).
-- Mã lưu kèm tên để nối hãng vận chuyển; đơn cũ để NULL (vẫn có tên dạng tự do).
alter table public.orders add column if not exists province_code text;
alter table public.orders add column if not exists ward_code text;

-- G-44 (D-100, chốt Q-07): tồn kho theo số lượng từng sản phẩm.
-- NULL = không theo dõi tồn kho (luôn đặt được, như trước đây); 0 = tạm hết hàng.
alter table public.products add column if not exists stock integer check (stock is null or stock >= 0);

-- Giữ chỗ nguyên tử cho cả đơn: khoá các dòng sản phẩm (theo id để tránh deadlock), kiểm đủ hàng
-- rồi mới trừ. Trả NULL nếu đã giữ được; trả id sản phẩm đầu tiên thiếu hàng (khi đó không trừ gì).
create or replace function public.reserve_stock(p_items jsonb) returns uuid
language plpgsql as $$
declare
  it record;
  v_stock integer;
begin
  for it in
    select (e->>'product_id')::uuid as pid, sum((e->>'quantity')::integer) as qty
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select stock into v_stock from public.products where id = it.pid for update;
    if v_stock is not null and v_stock < it.qty then
      return it.pid;
    end if;
  end loop;
  for it in
    select (e->>'product_id')::uuid as pid, sum((e->>'quantity')::integer) as qty
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    update public.products set stock = stock - it.qty where id = it.pid and stock is not null;
  end loop;
  return null;
end;
$$;

-- Trả hàng khi đơn huỷ / payOS hết hạn / tạo đơn hỏng giữa chừng
create or replace function public.release_stock(p_items jsonb) returns void
language plpgsql as $$
declare
  it record;
begin
  for it in
    select (e->>'product_id')::uuid as pid, sum((e->>'quantity')::integer) as qty
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    update public.products set stock = stock + it.qty where id = it.pid and stock is not null;
  end loop;
end;
$$;

revoke execute on function public.reserve_stock(jsonb) from public, anon, authenticated;
revoke execute on function public.release_stock(jsonb) from public, anon, authenticated;
