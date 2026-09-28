-- AI Mây (FR-AI-001…007, D-55…D-58). Cấu hình Mây lưu ở app_settings (key 'may').

-- D-19, BR-AI-008: lịch sử chat chỉ lưu cho người đã đăng nhập
create table public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  kind text not null default 'answer',
  content text not null,
  lang text not null default 'vi',
  created_at timestamptz not null default now()
);
create index chat_messages_user_idx on public.chat_messages (user_id, created_at desc);

-- §22.4: bộ đếm hạn mức tin nhắn (key đã băm, không lưu IP thô)
create table public.may_counters (
  key text primary key,
  count integer not null default 0,
  expires_at timestamptz not null
);

-- FR-AI-007: chi phí OpenAI theo tháng (giờ Việt Nam)
create table public.may_usage (
  month text primary key,
  requests integer not null default 0,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  cost_usd numeric(12, 6) not null default 0
);

-- Tăng bộ đếm nguyên tử; hết hạn thì đếm lại từ 1
create or replace function public.may_increment(p_key text, p_ttl_seconds integer) returns integer
language sql as $$
  insert into public.may_counters as c (key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_ttl_seconds))
  on conflict (key) do update set
    count = case when c.expires_at <= now() then 1 else c.count + 1 end,
    expires_at = case when c.expires_at <= now() then excluded.expires_at else c.expires_at end
  returning count;
$$;

create or replace function public.may_add_usage(p_month text, p_prompt bigint, p_completion bigint, p_cost numeric)
returns public.may_usage
language sql as $$
  insert into public.may_usage as u (month, requests, prompt_tokens, completion_tokens, cost_usd)
  values (p_month, 1, p_prompt, p_completion, p_cost)
  on conflict (month) do update set
    requests = u.requests + 1,
    prompt_tokens = u.prompt_tokens + excluded.prompt_tokens,
    completion_tokens = u.completion_tokens + excluded.completion_tokens,
    cost_usd = u.cost_usd + excluded.cost_usd
  returning *;
$$;

revoke execute on function public.may_increment(text, integer) from public, anon, authenticated;
revoke execute on function public.may_add_usage(text, bigint, bigint, numeric) from public, anon, authenticated;

alter table public.chat_messages enable row level security;
alter table public.may_counters enable row level security;
alter table public.may_usage enable row level security;
