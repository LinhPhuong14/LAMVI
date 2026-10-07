-- T-11 disposable DB only: owner isolation, quantity ledger, denied public RPC.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000098','return-independent@example.invalid');
insert into orders(id,code,user_id,status,order_kind,has_message,recipient_is_self,recipient_name,recipient_phone,address_line,province,payment_method,payment_status,subtotal,total,qr_token,delivered_at)
values ('90000000-0000-0000-0000-000000000098','INDEPENDENT-98','10000000-0000-0000-0000-000000000098','delivered','self',false,true,'Test','0912345678','Test','Test','cod','paid',1000,1000,repeat('b',64),now()-interval '1 day');
insert into order_items(order_id,slug,name,unit_price,quantity,line_total,stock_reserved) values ('90000000-0000-0000-0000-000000000098','return-lamp','{"vi":"Lamp"}',1000,1,1000,0);
insert into return_requests(id,order_id,user_id,status,video_path,video_type,video_bytes) values
('80000000-0000-0000-0000-000000000098','90000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000098','uploading','independent/98','video/mp4',10),
('80000000-0000-0000-0000-000000000097','90000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000098','uploading','independent/97','video/mp4',10);
do $$
begin
 begin
 perform submit_return_request('80000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000097','wrong_item','Wrong lamp','[{"slug":"return-lamp","quantity":1}]');
 raise exception 'owner isolation failed';
 exception when raise_exception then if sqlerrm<>'RETURN_NOT_FOUND' then raise; end if; end;
 begin
 perform submit_return_request('80000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000098','wrong_item','Wrong lamp','[{"slug":"return-lamp"}]');
 raise exception 'NULL quantity accepted';
 exception when raise_exception then if sqlerrm<>'INVALID_RETURN_ITEMS' then raise; end if; end;
 perform submit_return_request('80000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000098','wrong_item','Wrong lamp','[{"slug":"return-lamp","quantity":1}]');
 begin
 perform submit_return_request('80000000-0000-0000-0000-000000000097','10000000-0000-0000-0000-000000000098','wrong_item','Wrong lamp','[{"slug":"return-lamp","quantity":1}]');
 raise exception 'same unit reserved twice';
 exception when raise_exception then if sqlerrm<>'RETURN_QUANTITY_EXCEEDED' then raise; end if; end;
 if (select status from return_requests where id='80000000-0000-0000-0000-000000000097')<>'uploading' then raise exception 'failed submit committed'; end if;
 if has_function_privilege('anon','public.submit_return_request(uuid,uuid,text,text,jsonb)','execute') or has_function_privilege('authenticated','public.submit_return_request(uuid,uuid,text,text,jsonb)','execute') then raise exception 'public returns RPC permission'; end if;
end $$;
rollback;
\echo Returns independent SQL checks passed
