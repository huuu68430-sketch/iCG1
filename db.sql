
-- 1. مسح الجداول القديمة (Clean Start)
drop table if exists leaderboard cascade;
drop table if exists app_config cascade;
drop table if exists profiles cascade;
drop table if exists announcements cascade;
drop table if exists arena_status cascade;
drop table if exists audit_logs cascade;
drop table if exists promo_codes cascade;
drop table if exists bans cascade;

-- 2. جدول الحسابات والملفات الشخصية (Profiles)
create table profiles (
  id uuid default gen_random_uuid() primary key,
  username text not null unique,
  avatar_url text,
  is_banned boolean default false,
  role text default 'user',
  credits int default 0,
  created_at timestamptz default now()
);

-- 3. جدول لوحة الصدارة (Leaderboard)
create table leaderboard (
  id uuid default gen_random_uuid() primary key,
  username text not null unique references profiles(username) on delete cascade,
  wins int default 0,
  score int default 0,
  last_win_at timestamptz default now()
);

-- 4. جدول إعلانات الأدمن (Global Announcements)
create table announcements (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 5. جدول الأكواد الترويجية (Promo Codes)
create table promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  reward_amount int default 100,
  max_uses int default 1,
  current_uses int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 6. جدول حالة الساحة (Arena Status)
create table arena_status (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 7. جدول سجل العمليات (Audit Logs)
create table audit_logs (
  id uuid default gen_random_uuid() primary key,
  admin_username text,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- 8. جدول الحظر التفصيلي (Detailed Bans)
create table bans (
  id uuid default gen_random_uuid() primary key,
  username text not null references profiles(username) on delete cascade,
  reason text,
  banned_by text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- 9. جدول إعدادات الأدمن (Admin Config)
create table app_config (
  key text primary key,
  value text not null
);

-- إدخال البيانات الافتراضية
-- Set admin_password through a secure admin setup flow. Do not seed a default credential.
insert into arena_status (key, value) values ('global_mood', '{"theme": "default", "ambient": "standard", "particles": "none"}');
insert into arena_status (key, value) values ('viewer_override', '{"enabled": false, "count": 0}');
insert into arena_status (key, value) values ('audio_overlay', '{"enabled": false, "url": "", "volume": 0.5}');
insert into arena_status (key, value) values ('tournament_config', '{"active": false, "multiplier": 1, "win_goal": 5000}');

-- سياسات الأمان العامة (لغرض التجربة حالياً)
alter table profiles enable row level security;
create policy "Public Manage Profiles" on profiles for all using (true);
alter table leaderboard enable row level security;
create policy "Public Manage Leaderboard" on leaderboard for all using (true);
alter table announcements enable row level security;
create policy "Public Manage Announcements" on announcements for all using (true);
alter table promo_codes enable row level security;
create policy "Public Manage Promo" on promo_codes for all using (true);
alter table arena_status enable row level security;
create policy "Public Manage Status" on arena_status for all using (true);
alter table audit_logs enable row level security;
create policy "Public Manage Logs" on audit_logs for all using (true);
alter table bans enable row level security;
create policy "Public Manage Bans" on bans for all using (true);
alter table app_config enable row level security;
create policy "Public Manage Config" on app_config for all using (true);
