-- G-32: all customer cart writes share checkout's user lock. No policy changes.
begin;
create or replace function public.mutate_cart(p_user uuid, p_mode text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 line jsonb;
 product public.products%rowtype;
 current_quantity integer;
 next_quantity integer;
 result jsonb;
begin
 if p_mode is null or p_mode not in ('set','remove','merge') or jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines) > 100 or (p_mode <> 'merge' and jsonb_array_length(p_lines) <> 1) then
   raise exception 'INVALID_CART_MUTATION';
 end if;
 perform 1 from auth.users where id=p_user for update;
 if not found then raise exception 'INVALID_CART_MUTATION'; end if;
 -- Lock every involved product in checkout's canonical order to avoid reversed-cart deadlocks.
 perform 1 from public.products where slug in (select value->>'slug' from jsonb_array_elements(p_lines)) order by id for update;
 for line in select value from jsonb_array_elements(p_lines) loop
   select * into product from public.products where slug=line->>'slug';
   if p_mode='remove' then
     if found then delete from public.cart_items where user_id=p_user and product_id=product.id; end if;
     continue;
   end if;
   if not found then
     if p_mode='merge' then continue; end if;
     raise exception 'PRODUCT_UNAVAILABLE';
   end if;
   next_quantity := (line->>'quantity')::integer;
   if next_quantity is null or next_quantity not between 1 and 10 then raise exception 'INVALID_CART_MUTATION'; end if;
   select quantity into current_quantity from public.cart_items where user_id=p_user and product_id=product.id;
   if p_mode='set' then
     if product.status <> 'published' and current_quantity is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
     if product.status <> 'published' and next_quantity > current_quantity then raise exception 'PRODUCT_UNAVAILABLE_INCREASE'; end if;
     if product.stock is not null and next_quantity > coalesce(current_quantity,0) and next_quantity > product.stock then
       raise exception 'OUT_OF_STOCK' using detail=greatest(0,product.stock)::text;
     end if;
     if current_quantity is null and (select count(*) from public.cart_items where user_id=p_user)>=50 then raise exception 'CART_FULL'; end if;
   else
     if product.status <> 'published' then continue; end if;
     if current_quantity is null and (select count(*) from public.cart_items where user_id=p_user)>=50 then continue; end if;
     next_quantity := least(10,coalesce(current_quantity,0)+next_quantity);
     if product.stock is not null then next_quantity := least(next_quantity,product.stock); end if;
     if next_quantity < 1 then continue; end if;
   end if;
   insert into public.cart_items(user_id,product_id,quantity) values(p_user,product.id,next_quantity)
     on conflict(user_id,product_id) do update set quantity=excluded.quantity;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(ci) order by added_at,product_id),'[]'::jsonb) into result
   from public.cart_items ci where user_id=p_user;
 return result;
end;
$$;
revoke all on function public.mutate_cart(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mutate_cart(uuid,text,jsonb) to service_role;
commit;
