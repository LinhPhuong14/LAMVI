-- Disposable PostgreSQL fixtures only. No production cart writes. Rollback at end.
begin;
insert into auth.users(id,email) values ('19000000-0000-0000-0000-000000000001','cart-test@example.invalid');
insert into products(id,slug,kind,status,price,name,stock) values
 ('19000000-0000-0000-0000-000000000002','cart-tracked','single','published',1000,'{"vi":"Cart"}',3),
 ('19000000-0000-0000-0000-000000000003','cart-hidden','single','hidden',1000,'{"vi":"Hidden"}',null);
do $$
declare cart jsonb; user_id uuid := '19000000-0000-0000-0000-000000000001';
begin
 cart := mutate_cart(user_id,'set','[{"slug":"cart-tracked","quantity":1}]');
 if (cart->0->>'quantity')::integer <> 1 then raise exception 'set failed'; end if;
 cart := mutate_cart(user_id,'merge','[{"slug":"cart-tracked","quantity":1},{"slug":"cart-tracked","quantity":1}]');
 if (cart->0->>'quantity')::integer <> 3 then raise exception 'duplicate merge lost quantity'; end if;
 cart := mutate_cart(user_id,'merge','[{"slug":"cart-hidden","quantity":1},{"slug":"missing","quantity":1}]');
 if jsonb_array_length(cart) <> 1 then raise exception 'merge leaked unavailable product'; end if;
 begin
  perform mutate_cart(user_id,'set','[{"slug":"cart-tracked","quantity":4}]');
  raise exception 'overstock accepted';
 exception when raise_exception then if sqlerrm <> 'OUT_OF_STOCK' then raise; end if;
 end;
 begin
  perform mutate_cart(user_id,'set','[{"slug":"cart-hidden","quantity":1}]');
  raise exception 'hidden product accepted';
 exception when raise_exception then if sqlerrm <> 'PRODUCT_UNAVAILABLE' then raise; end if;
 end;
 update products set stock=0 where slug='cart-tracked';
 cart := mutate_cart(user_id,'set','[{"slug":"cart-tracked","quantity":2}]');
 if (cart->0->>'quantity')::integer <> 2 then raise exception 'stock shortage prevented reduction'; end if;
 cart := mutate_cart(user_id,'remove','[{"slug":"cart-tracked"}]');
 if cart <> '[]' then raise exception 'remove failed'; end if;
 if has_function_privilege('anon','public.mutate_cart(uuid,text,jsonb)','execute') or
    has_function_privilege('authenticated','public.mutate_cart(uuid,text,jsonb)','execute') then raise exception 'public cart RPC access'; end if;
end;
$$;
rollback;
