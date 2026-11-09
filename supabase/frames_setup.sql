-- ============================================================================
--  iCG1 — إعداد المتجر الجديد للإطارات (Frames)
--  نفّذ هذا الملف مرة واحدة من Supabase → SQL Editor.
--  آمن للتشغيل أكثر من مرة (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) كتالوج الإطارات الـ16 (نفس معرض الإطارات بالحرف)
-- ----------------------------------------------------------------------------
create table if not exists public.frames (
  id          text primary key,
  name        text not null,
  description text,
  rarity      text not null default 'c' check (rarity in ('c', 'r', 'e', 'l')),
  price       integer not null default 0 check (price >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table  public.frames is 'كتالوج إطارات iCG1 — 16 إطاراً مرسومة بـ SVG';
comment on column public.frames.rarity is 'c = عادي، r = نادر، e = ملحمي، l = أسطوري';

-- ----------------------------------------------------------------------------
-- 2) ملكية الأعضاء للإطارات + الإطار المجهّز
-- ----------------------------------------------------------------------------
create table if not exists public.user_frames (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  username     text not null,
  frame_id     text not null references public.frames(id) on delete cascade,
  is_equipped  boolean not null default false,
  purchased_at timestamptz not null default now(),
  unique (user_id, frame_id)
);

comment on table public.user_frames is 'الإطارات التي اشتراها كل عضو';

create index if not exists user_frames_user_idx  on public.user_frames (user_id);
create index if not exists user_frames_frame_idx on public.user_frames (frame_id);

-- إطار واحد مجهّز كحد أقصى لكل عضو
create unique index if not exists user_frames_one_equipped
  on public.user_frames (user_id)
  where is_equipped;

-- ----------------------------------------------------------------------------
-- 3) ربط الملف الشخصي بالإطار الجديد + المكافأة اليومية
--    (active_frame_url يبقى للإطارات القديمة بصيغة PNG)
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists active_frame_id  text;
alter table public.profiles add column if not exists daily_streak     integer not null default 0;
alter table public.profiles add column if not exists last_daily_claim date;

comment on column public.profiles.active_frame_id is 'معرّف الإطار المجهّز من جدول frames — يظهر في كل الألعاب';

-- ----------------------------------------------------------------------------
-- 4) تعبئة الإطارات الـ16 (نفس الأسماء والأسعار والندرة في المعرض)
-- ----------------------------------------------------------------------------
insert into public.frames (id, name, description, rarity, price, sort_order, is_active) values
  ('basic',    'الإطار الأساسي',    'إطار مجاني لكل عضو جديد',                    'c',     0,  1, true),
  ('ramadan',  'إطار رمضان',        'إطار رمضاني مميز بأجواء الشهر الفضيل',        'r',     0,  2, true),
  ('dark',     'إطار الظلام',       'إطار الغموض المرعب',                          'r',     0,  3, true),
  ('crown',    'تاج الملوك',        'تاج الملوك الذهبي الفاخر',                    'e',  5000,  4, true),
  ('fire',     'إطار النيران',      'إطار محاط بلهيب لا ينطفئ',                    'e',  6000,  5, true),
  ('crystal',  'إطار الكريستال',    'كريستال وردي لامع يخطف الأنظار',              'e',  6000,  6, true),
  ('emerald',  'إطار الزمرد',       'زمرد أخضر مشع وطاقة نقية',                    'e', 10000,  7, true),
  ('neon',     'إطار النيون',       'إضاءة نيون قوية للمحترفين فقط',               'e', 10500,  8, true),
  ('galaxy',   'إطار المجرة',       'يعكس اتساع الكون والفضاء',                    'l',  5500,  9, true),
  ('diamond',  'الإطار الماسي',     'إطار الألماس النادر والمبهر',                 'l',  9000, 10, true),
  ('gold',     'الإطار الذهبي',     'إطار الذهب الفاخر للأعضاء المتألقين',         'l',  8000, 11, true),
  ('imperial', 'الإطار الإمبراطوري','إطار إمبراطوري حصري على المنصة',              'l', 11000, 12, true),
  ('thunder',  'إطار الرعد',        'طاقة كهربائية مرعبة ومخيفة',                  'l', 12000, 13, true),
  ('royal',    'الإطار الملكي',     'مخصص للأباطرة والملوك في المنصة',             'l', 14000, 14, true),
  ('astral',   'الإطار الفلكي',     'نسخة محدودة من الإطار الفلكي',                'l', 20000, 15, true),
  ('vip',      'الإطار الأسطوري',   'الإطار المتحرك الأسطوري (VIP)',               'l', 25000, 16, true)
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  rarity      = excluded.rarity,
  price       = excluded.price,
  sort_order  = excluded.sort_order,
  is_active   = excluded.is_active;

-- ----------------------------------------------------------------------------
-- 5) الصلاحيات وسياسات RLS
--    الكتالوج للقراءة فقط، والملكية يكتبها التطبيق بمفتاح anon كما في بقية
--    جداول المتجر الحالية. إن أضفت تسجيل دخول حقيقياً لاحقاً، اربطها بـ auth.uid().
-- ----------------------------------------------------------------------------
alter table public.frames      enable row level security;
alter table public.user_frames enable row level security;

drop policy if exists frames_read on public.frames;
create policy frames_read on public.frames
  for select using (true);

drop policy if exists user_frames_read on public.user_frames;
create policy user_frames_read on public.user_frames
  for select using (true);

drop policy if exists user_frames_insert on public.user_frames;
create policy user_frames_insert on public.user_frames
  for insert with check (true);

drop policy if exists user_frames_update on public.user_frames;
create policy user_frames_update on public.user_frames
  for update using (true) with check (true);

drop policy if exists user_frames_delete on public.user_frames;
create policy user_frames_delete on public.user_frames
  for delete using (true);

grant select on public.frames to anon, authenticated;
grant select, insert, update, delete on public.user_frames to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) تحقق سريع بعد التشغيل
-- ----------------------------------------------------------------------------
-- select count(*) from public.frames;                          -- المتوقع 16
-- select username, active_frame_id from public.profiles where active_frame_id is not null;
-- select * from public.user_frames order by purchased_at desc;
