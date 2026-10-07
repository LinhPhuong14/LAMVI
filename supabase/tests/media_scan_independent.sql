-- Disposable DB only. More than 1000 active records must not starve later eligible media.
\set ON_ERROR_STOP on
begin;
set local timezone='America/New_York';
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000092','media-independent@example.invalid');
insert into orders(id,code,user_id,status,order_kind,has_message,recipient_is_self,recipient_name,recipient_phone,address_line,province,payment_method,payment_status,subtotal,total,qr_token,delivered_at)
select md5('media-order-'||i)::uuid,'MEDIA-INDEPENDENT-'||i,'10000000-0000-0000-0000-000000000092','delivered','gift',true,true,'Test','0912345678','Test','Test','cod','paid',1000,1000,md5('qr-'||i)||md5('qr-'||i),'2026-03-28T12:00:00Z'::timestamptz
from generate_series(1,1107) i;
insert into gift_messages(id,order_id,voice_path,confirmed_at)
select md5('media-message-'||i)::uuid,md5('media-order-'||i)::uuid,'private/'||i||'.mp3',
 case when i<=1000 then '2026-03-28T12:00:00Z'::timestamptz
 when i=1106 then '2026-03-29T12:00:00Z'::timestamptz-interval '720 hours'
 when i=1107 then '2026-03-29T12:00:00Z'::timestamptz-interval '720 hours'+interval '1 second'
 else '2026-02-25T12:00:00Z'::timestamptz end
from generate_series(1,1107) i;
do $$
declare batch jsonb; last_id uuid; seen integer:=0; before_at timestamptz:='2026-03-29T12:00:00Z';
begin
 batch:=list_expired_gift_media(before_at);
 if jsonb_array_length(batch)<>10 then raise exception 'default batch must be 10'; end if;
 loop
   batch:=list_expired_gift_media(before_at,last_id,100);
   exit when jsonb_array_length(batch)=0;
   if jsonb_array_length(batch)>100 then raise exception 'batch unbounded'; end if;
   if exists(select 1 from jsonb_array_elements(batch) x where (x->'message'->>'voice_path')='private/1107.mp3') then raise exception 'DST/subsecond deadline exposed unexpired media'; end if;
   if exists(select 1 from jsonb_array_elements(batch) x where substring(x->'message'->>'voice_path' from '[0-9]+')::integer<=1000) then raise exception 'unexpired record selected'; end if;
   seen:=seen+jsonb_array_length(batch);
   last_id:=(batch->(jsonb_array_length(batch)-1)->'message'->>'id')::uuid;
 end loop;
 if seen<>106 then raise exception 'eligible records starved or duplicated: %',seen; end if;
 if has_function_privilege('anon','public.list_expired_gift_media(timestamptz,uuid,integer)','execute') or has_function_privilege('authenticated','public.list_expired_gift_media(timestamptz,uuid,integer)','execute') then raise exception 'public media scan access'; end if;
end $$;
rollback;
\echo Media scan independent SQL checks passed
