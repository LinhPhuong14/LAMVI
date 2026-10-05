-- Lời chúc + QR đơn hàng (FR-MSG-001, FR-QR-001…005, D-12, D-26, D-75, D-76)
-- và quản lý người dùng trong admin (G-19: khoá tài khoản).

-- ---------- Người dùng ----------
-- Email đặt ở hồ sơ để admin tìm/hiện danh sách không phải gọi Auth từng người.
alter table public.profiles add column if not exists email text;
-- G-19: khoá tài khoản; NULL = đang hoạt động
alter table public.profiles add column if not exists locked_at timestamptz;
alter table public.profiles add column if not exists locked_reason text;

update public.profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ---------- Đơn hàng ----------
-- BR-QR-001: token ngẫu nhiên (256 bit hex), không chứa dữ liệu đọc được
alter table public.orders add column if not exists qr_token text;
update public.orders
set qr_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where qr_token is null;
alter table public.orders alter column qr_token set not null;
create unique index if not exists orders_qr_token_idx on public.orders (qr_token);
-- D-75: mốc "giao thành công" để tính 90 ngày khi không ai bấm xác nhận
alter table public.orders add column if not exists delivered_at timestamptz;
update public.orders set delivered_at = updated_at where status = 'delivered' and delivered_at is null;

-- ---------- Lời chúc ----------
create table if not exists public.gift_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  -- BR-MSG-003: chữ lưu vô thời hạn. Giới hạn ký tự do server kiểm (domain/message.js).
  text text,
  -- Ngôn ngữ người mua tự khai báo cho phần chữ (Q-29: admin dùng để biết cần dịch thiệp tay)
  text_lang text check (text_lang in ('vi', 'en', 'zh')),
  voice_path text,
  voice_type text,
  video_path text,
  video_type text,
  -- US-004 AC-002: chỉ ghi lần đầu
  confirmed_at timestamptz,
  -- Media đã bị xoá khỏi Storage (D-26, D-75); chữ vẫn còn
  media_deleted_at timestamptz,
  -- BR-MSG-005: bản dịch tự động được cache theo ngôn ngữ đích {"en": "...", "zh": "..."}
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists gift_messages_touch on public.gift_messages;
create trigger gift_messages_touch before update on public.gift_messages
  for each row execute function public.touch_updated_at();

alter table public.gift_messages enable row level security;
-- T-51: chỉ server (service role) truy cập, khoá anon/authenticated tường minh
revoke all on public.gift_messages from anon, authenticated;

-- Bucket RIÊNG TƯ cho giọng nói/video lời chúc: không có URL công khai; server cấp signed URL
-- ngắn hạn khi người nhận đã xác nhận. Giới hạn kích thước/kiểu file ở đây khớp domain/message.js.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-media', 'gift-media', false, 104857600,
  array['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
