-- ============================================================================
--  iCG1 — لعبة المافيا v4 (تخزين كامل: الغرف، الأدوار، الأحداث، الشات، النتائج)
--  نفّذ هذا الملف مرة واحدة من Supabase → SQL Editor.
--  آمن للتشغيل أكثر من مرة (idempotent).
-- ============================================================================

-- 1) الغرف: عمود state يحمل الحالة الحيّة للعبة (المرحلة، اللاعبون، المؤقت...)
create table if not exists public.mafia_rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  host_handle text,
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) أدوار اللاعبين (منفصلة عن الحالة حتى لا يراها كل اللاعبين)
create table if not exists public.mafia_roles (
  room_code   text not null,
  user_id     text not null,
  username    text,
  role        text not null check (role in ('mafia', 'doctor', 'elder', 'citizen', 'detective', 'joker')),
  created_at  timestamptz not null default now(),
  primary key (room_code, user_id)
);

-- الأدوار الجديدة (الجوكر + المحقق): إعادة تشغيل هذا الجزء فقط يحدّث القيد في قاعدة موجودة
alter table public.mafia_roles drop constraint if exists mafia_roles_role_check;
alter table public.mafia_roles add constraint mafia_roles_role_check
  check (role in ('mafia', 'doctor', 'elder', 'citizen', 'detective', 'joker'));

-- 3) صندوق أوامر اللاعبين: كل ضغطة (انضمام، قتل، حماية، تحقيق، تصويت، محادثة) تُسجّل هنا
create table if not exists public.mafia_actions (
  id          bigserial primary key,
  room_code   text not null,
  user_id     text,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists mafia_actions_room_idx on public.mafia_actions (room_code, id);

-- 4) كل رسائل الشات: شات القرية + شات المافيا + رسائل النظام
create table if not exists public.mafia_messages (
  id          bigserial primary key,
  room_code   text not null,
  channel     text not null default 'village' check (channel in ('village', 'mafia', 'system')),
  user_id     text,
  username    text,
  body        text not null,
  round       integer not null default 0,
  phase       text,
  created_at  timestamptz not null default now()
);
create index if not exists mafia_messages_room_idx on public.mafia_messages (room_code, id);

-- 5) سجل الأحداث: من قُتل، من أُقصي، من صوّت لمن، توزيع الأدوار، الفائز...
create table if not exists public.mafia_events (
  id          bigserial primary key,
  room_code   text not null,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists mafia_events_room_idx on public.mafia_events (room_code, id);

-- 6) نتائج المباريات الكاملة
create table if not exists public.mafia_matches (
  id          bigserial primary key,
  room_code   text not null,
  winner      text,
  rounds      integer not null default 0,
  players     jsonb not null default '[]'::jsonb,
  ended_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- صلاحيات الوصول (الموقع يستخدم مفتاح anon بدون جلسات Auth)
-- ---------------------------------------------------------------------------
alter table public.mafia_rooms    enable row level security;
alter table public.mafia_roles    enable row level security;
alter table public.mafia_actions  enable row level security;
alter table public.mafia_messages enable row level security;
alter table public.mafia_events   enable row level security;
alter table public.mafia_matches  enable row level security;

drop policy if exists mafia_rooms_all on public.mafia_rooms;
create policy mafia_rooms_all on public.mafia_rooms for all using (true) with check (true);

drop policy if exists mafia_roles_all on public.mafia_roles;
create policy mafia_roles_all on public.mafia_roles for all using (true) with check (true);

drop policy if exists mafia_actions_all on public.mafia_actions;
create policy mafia_actions_all on public.mafia_actions for all using (true) with check (true);

drop policy if exists mafia_messages_all on public.mafia_messages;
create policy mafia_messages_all on public.mafia_messages for all using (true) with check (true);

drop policy if exists mafia_events_all on public.mafia_events;
create policy mafia_events_all on public.mafia_events for all using (true) with check (true);

drop policy if exists mafia_matches_all on public.mafia_matches;
create policy mafia_matches_all on public.mafia_matches for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- تحديث ختم الوقت تلقائياً
-- ---------------------------------------------------------------------------
create or replace function public.mafia_touch_room() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists mafia_rooms_touch on public.mafia_rooms;
create trigger mafia_rooms_touch before update on public.mafia_rooms
  for each row execute function public.mafia_touch_room();
