-- Disposable DB only; mutations must preserve policy and all-or-nothing validation.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000094','cart-independent@example.invalid');
insert into products(id,slug,kind,status,price,name,stock) values
('20000000-0000-0000-0000-000000000094','cart-a','single','published',1000,'{"vi":"A"}',5),
('20000000-0000-0000-0000-000000000093','cart-hidden','single','hidden',1000,'{"vi":"Hidden"}',5);
do $$
begin
 perform mutate_cart('10000000-0000-0000-0000-000000000094','merge','[{"slug":"cart-a","quantity":1}]');
 perform mutate_cart('10000000-0000-0000-0000-000000000094','merge','[{"slug":"cart-a","quantity":1},{"slug":"cart-hidden","quantity":1}]');
 if (select quantity from cart_items where product_id='20000000-0000-0000-0000-000000000094')<>2 then raise exception 'merge lost increment'; end if;
 if exists(select 1 from cart_items where product_id='20000000-0000-0000-0000-000000000093') then raise exception 'hidden product merged'; end if;
 begin
 perform mutate_cart('10000000-0000-0000-0000-000000000094','merge','[{"slug":"cart-a","quantity":1},{"slug":"cart-hidden","quantity":null}]');
 raise exception 'invalid merge unexpectedly committed';
 exception when raise_exception then if sqlerrm<>'INVALID_CART_MUTATION' then raise; end if;end;
 if (select quantity from cart_items where product_id='20000000-0000-0000-0000-000000000094')<>2 then raise exception 'failed merge leaked prefix writes'; end if;
 update products set status='hidden' where slug='cart-a';
 perform mutate_cart('10000000-0000-0000-0000-000000000094','set','[{"slug":"cart-a","quantity":1}]');
 begin
 perform mutate_cart('10000000-0000-0000-0000-000000000094','set','[{"slug":"cart-a","quantity":2}]');
 raise exception 'hidden quantity increase allowed';
 exception when raise_exception then if sqlerrm<>'PRODUCT_UNAVAILABLE_INCREASE' then raise; end if;end;
 if has_function_privilege('anon','public.mutate_cart(uuid,text,jsonb)','execute') or has_function_privilege('authenticated','public.mutate_cart(uuid,text,jsonb)','execute') then raise exception 'public cart RPC permission'; end if;
end $$;
rollback;
\echo Cart independent SQL checks passed
