-- FR-RET-001/002: private evidence, manual review. No monetary/refund policy.
create table public.return_requests (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 user_id uuid not null references auth.users(id), status text not null check(status in ('uploading','requested','approved','rejected','resolved')),
 reason text check(reason in ('manufacturing_defect','shipping_damage','wrong_item')), description text not null default '',
 items jsonb not null default '[]', video_path text not null unique, video_type text not null,
 video_bytes bigint not null check(video_bytes between 1 and 104857600), created_at timestamptz not null default now(),
 submitted_at timestamptz, decision_note text, decided_at timestamptz, decided_by uuid references auth.users(id),
 resolution text check(resolution in ('replacement','refund')), resolution_note text, resolved_at timestamptz, resolved_by uuid references auth.users(id),
 check(status<>'resolved' or (resolution is not null and resolution_note is not null and length(trim(resolution_note))>=3 and resolved_at is not null and resolved_by is not null)),
 check(length(resolution_note)<=2000),
 check(jsonb_typeof(items)='array'), check(length(description)<=2000), check(length(decision_note)<=2000)
);
create index return_requests_owner_order on public.return_requests(user_id,order_id,created_at desc);
create index return_requests_review on public.return_requests(status,created_at desc,id desc);
alter table public.return_requests enable row level security;
revoke all on public.return_requests from anon,authenticated;
grant all on public.return_requests to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('return-evidence','return-evidence',false,104857600,array['video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Lock order so concurrent requests cannot reserve the same purchased units twice.
create function public.submit_return_request(p_id uuid,p_user_id uuid,p_reason text,p_description text,p_items jsonb)
returns public.return_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.return_requests; o public.orders; item jsonb; bought integer; claimed integer;
begin
 select * into r from public.return_requests where id=p_id and user_id=p_user_id;
 if not found then raise exception 'RETURN_NOT_FOUND'; end if;
 select * into o from public.orders where id=r.order_id and user_id=p_user_id for update;
 if not found or o.status<>'delivered' or o.delivered_at is null or now()<o.delivered_at or now()>o.delivered_at+interval '7 days' then raise exception 'RETURN_WINDOW_CLOSED'; end if;
 select * into r from public.return_requests where id=p_id for update;
 if r.status<>'uploading' then raise exception 'RETURN_ALREADY_SUBMITTED'; end if;
 if p_reason is null or p_reason not in ('manufacturing_defect','shipping_damage','wrong_item') or p_description is null or length(trim(p_description))<3 or length(p_description)>2000 or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'INVALID_RETURN_REQUEST'; end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'slug') from jsonb_array_elements(p_items) x) then raise exception 'INVALID_RETURN_ITEMS'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
   select sum(quantity) into bought from public.order_items where order_id=o.id and slug=item->>'slug';
   if bought is null or item->>'quantity' is null or (item->>'quantity') !~ '^[1-9][0-9]*$' then raise exception 'INVALID_RETURN_ITEMS'; end if;
   select coalesce(sum((x->>'quantity')::integer),0) into claimed from public.return_requests rr cross join lateral jsonb_array_elements(rr.items) x where rr.order_id=o.id and rr.status in ('requested','approved','resolved') and x->>'slug'=item->>'slug';
   if claimed+(item->>'quantity')::integer>bought then raise exception 'RETURN_QUANTITY_EXCEEDED'; end if;
 end loop;
 update public.return_requests set status='requested',reason=p_reason,description=trim(p_description),items=p_items,submitted_at=now() where id=p_id returning * into r;
 return r;
end $$;
revoke all on function public.submit_return_request(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_return_request(uuid,uuid,text,text,jsonb) to service_role;
