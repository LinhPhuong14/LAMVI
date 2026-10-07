-- Disposable PostgreSQL test database only. All fixtures are rolled back.
begin;
select public.record_api_metric_batch('a0170000-0000-4000-8000-000000000001',
 '[{"bucket":"2026-10-07T00:00:00Z","method":"GET","route":"/api/test-metrics-017","status":500,"count":2,"total_ms":10,"max_ms":5,"le_50":2,"le_100":0,"le_250":0,"le_500":0,"le_1000":0,"le_2500":0,"gt_2500":0}]',
 '[{"at":"2026-10-07T00:00:00Z","method":"GET","route":"/api/test-metrics-017","path":"/api/test-metrics-017","status":500,"code":null,"message":"safe"}]');
select public.record_api_metric_batch('a0170000-0000-4000-8000-000000000001',
 '[{"bucket":"2026-10-07T00:00:00Z","method":"GET","route":"/api/test-metrics-017","status":500,"count":2,"total_ms":10,"max_ms":5,"le_50":2,"le_100":0,"le_250":0,"le_500":0,"le_1000":0,"le_2500":0,"gt_2500":0}]',
 '[{"at":"2026-10-07T00:00:00Z","method":"GET","route":"/api/test-metrics-017","path":"/api/test-metrics-017","status":500,"code":null,"message":"safe"}]');
do $$
begin
 if (select count from public.api_metrics where route='/api/test-metrics-017') <> 2 then
   raise exception 'duplicate batch counted twice';
 end if;
 if (select count(*) from public.api_errors where route='/api/test-metrics-017') <> 1 then
   raise exception 'duplicate errors';
 end if;
 begin
   perform public.record_api_metric_batch('a0170000-0000-4000-8000-000000000002',
     '[{"bucket":"invalid date"}]','[]');
   raise exception 'invalid write should fail';
 exception when invalid_datetime_format then null;
 end;
 if exists(select 1 from public.api_metric_batches where id='a0170000-0000-4000-8000-000000000002') then
   raise exception 'receipt survived failed transaction';
 end if;
 if has_function_privilege('anon','public.record_api_metric_batch(uuid,jsonb,jsonb)','execute')
   or has_function_privilege('authenticated','public.aggregate_api_metrics(timestamptz)','execute') then
   raise exception 'public role allowed';
 end if;
end;
$$;
rollback;
