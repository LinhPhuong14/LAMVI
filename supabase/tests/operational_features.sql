-- T-11 independent checks. Disposable DB only; fixtures rollback.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000099','independent@example.invalid');
insert into orders(id,code,user_id,status,order_kind,has_message,recipient_is_self,recipient_name,recipient_phone,address_line,province,payment_method,payment_status,subtotal,total,qr_token)
values ('90000000-0000-0000-0000-000000000099','INDEPENDENT-99','10000000-0000-0000-0000-000000000099','confirmed','self',false,true,'Test','0912345678','Test','Test','cod','pending',1000,1000,repeat('a',64));
do $$
declare first_job public.notification_jobs; second_job public.notification_jobs; receipt uuid := gen_random_uuid(); m jsonb;
begin
 if (select count(*) from notification_jobs where order_id='90000000-0000-0000-0000-000000000099')<>1 then raise exception 'initial confirmed event absent'; end if;
 update orders set status='confirmed' where id='90000000-0000-0000-0000-000000000099';
 if (select count(*) from notification_jobs where order_id='90000000-0000-0000-0000-000000000099')<>1 then raise exception 'event replay duplicated'; end if;
 select * into first_job from claim_notification_jobs('90000000-0000-0000-0000-000000000099',5);
 if first_job.lease_token is null or first_job.attempts<>1 then raise exception 'claim lease absent'; end if;
 if exists(select 1 from claim_notification_jobs('90000000-0000-0000-0000-000000000099',5)) then raise exception 'active lease reclaimed'; end if;
 update notification_jobs set lease_until=now()-interval '1 second' where id=first_job.id;
 select * into second_job from claim_notification_jobs('90000000-0000-0000-0000-000000000099',5);
 if second_job.lease_token=first_job.lease_token or second_job.attempts<>2 then raise exception 'expired lease not fenced'; end if;
 update notification_jobs set status='sent' where id=first_job.id and lease_token=first_job.lease_token and status='leased';
 if found then raise exception 'stale worker acknowledged new lease'; end if;
 if has_function_privilege('anon','public.claim_notification_jobs(uuid,integer)','execute') or has_function_privilege('authenticated','public.claim_notification_jobs(uuid,integer)','execute') then raise exception 'public outbox access'; end if;
 m:=jsonb_build_array(jsonb_build_object('bucket',date_trunc('minute',now()),'method','GET','route','/independent-test','status',200,'count',1,'total_ms',1,'max_ms',1,'le_50',1,'le_100',0,'le_250',0,'le_500',0,'le_1000',0,'le_2500',0,'gt_2500',0));
 perform record_api_metric_batch(receipt,m,'[]'::jsonb);
 perform record_api_metric_batch(receipt,m,'[]'::jsonb);
 if (select sum(count) from api_metrics where route='/independent-test')<>1 then raise exception 'metric receipt replay duplicated count'; end if;
 if (select (x->>'count')::integer from jsonb_array_elements(aggregate_api_metrics(now()-interval '1 hour')) x where x->>'route'='/independent-test')<>1 then raise exception 'metric aggregate mismatch'; end if;
 if has_function_privilege('anon','public.record_api_metric_batch(uuid,jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.aggregate_api_metrics(timestamptz)','execute') then raise exception 'public metrics access'; end if;
end $$;
rollback;
\echo Operational independent SQL checks passed
