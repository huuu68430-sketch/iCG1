-- ============================================================================
--  iCG1 — كود نيمز: جدولا المزامنة (cn_rooms + cn_presence)
--  نفّذ هذا الملف مرة واحدة من Supabase → SQL Editor.
--  آمن للتشغيل أكثر من مرة (idempotent) ولا يحذف أي جدول أو عمود موجود.
--  بدونه: الليدر يكتب حالته بصمت (الـ upsert يفشل) فمن يدخل متأخراً لا يجد الطاولة،
--  و"أكمل اللعب" في لوحة المستخدم يبقى معطّلاً.
-- ============================================================================

-- 1) الطاولة الحيّة: الكود + البذرة + جسم الحالة (يكتبه الليدر كل ~5ث)
create table if not exists public.cn_rooms (
  room_code  text primary key,
  seed       bigint,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- الأعمدة التي يقرأها الموقع: seed في upsert و updated_at في "أكمل اللعب"
alter table public.cn_rooms add column if not exists seed       bigint;
alter table public.cn_rooms add column if not exists updated_at timestamptz not null default now();

-- قاعدة موجودة بعمود seed من نوع آخر (integer/varchar): وحّده إلى bigint
-- وإن لم يكن room_code مفتاحاً أساسياً نضيف فهرساً فريداً عليه (الـ upsert يحتاجه).
-- كل هذا مشروط حتى لا يفشل الملف على قاعدة شكلها مختلف.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'cn_rooms' and column_name = 'seed'
               and data_type <> 'bigint') then
    begin
      execute 'alter table public.cn_rooms alter column seed type bigint using seed::bigint';
    exception when others then
      raise notice 'عمود seed في cn_rooms لم يتحوّل إلى bigint: %', sqlerrm;
    end;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'cn_rooms' and column_name = 'room_code')
     and not exists (select 1 from pg_constraint
             where connamespace = 'public'::regnamespace
               and conrelid = 'public.cn_rooms'::regclass and contype in ('p', 'u')) then
    execute 'create unique index cn_rooms_code_uidx on public.cn_rooms (room_code)';
  end if;
end $$;

-- الطلب هو .order('updated_at', desc).limit(1) — بلا فهرس يمرّ على الجدول كله
create index if not exists cn_rooms_updated_idx on public.cn_rooms (updated_at desc);

-- ---------------------------------------------------------------------------
-- 2) حضور الليدرَين: الكود + المستخدم + الفريق + آخر ظهور
--    الكتابة: upsert({room_code, username, team, role, last_seen}) بلا onConflict
--    → بلا قيد فريد على (room_code, username) يفشل الـ upsert ولا يظهر "الليدر دخل".
-- ---------------------------------------------------------------------------
create table if not exists public.cn_presence (
  room_code text not null,
  username  text not null,
  team      text,
  role      text,
  last_seen timestamptz not null default now()
);
-- القيد الفريد يفشل إن كان في الجدول المكرر من زمن سابق — لا نحذف شيئاً لأن
-- الحذف قرار المالك؛ نحاول ونُبلغ بالضبط ما لازم تتأكد منه.
do $$
begin
  create unique index cn_presence_room_user_uidx on public.cn_presence (room_code, username);
exception when others then
  raise notice 'لم يُنشأ القيد الفريد على cn_presence (مكرر موجود؟): %', sqlerrm;
  raise notice 'تحقّق: select room_code, username, count(*) from public.cn_presence group by 1,2 having count(*) > 1;';
end $$;
create index if not exists cn_presence_room_idx on public.cn_presence (room_code);

-- ---------------------------------------------------------------------------
-- 3) صلاحيات الوصول (نفس نهج بقية جداول اللعبة: مفتاح publishable بلا جلسات Auth)
-- ---------------------------------------------------------------------------
alter table public.cn_rooms    enable row level security;
alter table public.cn_presence enable row level security;

drop policy if exists cn_rooms_all on public.cn_rooms;
create policy cn_rooms_all on public.cn_rooms for all to anon, authenticated using (true) with check (true);

drop policy if exists cn_presence_all on public.cn_presence;
create policy cn_presence_all on public.cn_presence for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.cn_rooms    to anon, authenticated;
grant select, insert, update, delete on public.cn_presence to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) تحديث updated_at تلقائياً — "أكمل اللعب" يعتمد عليه للتأكد أن الغرفة حيّة
-- ---------------------------------------------------------------------------
create or replace function public.cn_touch_room() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cn_rooms_touch on public.cn_rooms;
create trigger cn_rooms_touch before update on public.cn_rooms
  for each row execute function public.cn_touch_room();

-- ---------------------------------------------------------------------------
-- 5) البث اللحظي: الغرفة باسم cn:<الكود>، والرسائل broadcast + presence
--    في Supabase الحديث لا يحتاج الجدول إلى نشر pgoutput هنا (لا جدول realtime)،
--    لكن إن كان المشروع على "Require Channel Authorization" فبدون سياسة على
--    realtime.messages يرفض الخادم القناة ولا تصل تحديثات الهواتف إطلاقاً.
--    لذلك: سياسة على قنوات cn:% فقط، ومغلّفة حتى لا يفشل الملف إن لم يوجد الجدول.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'realtime' and c.relname = 'messages') then
    execute 'alter table realtime.messages enable row level security';
    execute 'drop policy if exists cn_realtime_channel on realtime.messages';
    execute $p$create policy cn_realtime_channel on realtime.messages
             for all to anon, authenticated
             using (channel like 'cn:%') with check (channel like 'cn:%')$p$;
    execute 'grant select, insert, delete on realtime.messages to anon, authenticated';
  else
    raise notice 'realtime.messages غير موجود — القنوات تعمل بإعداد Legacy Authorization في لوحة Supabase';
  end if;
exception when others then
  raise notice 'تعذّر ضبط صلاحيات القناة: %', sqlerrm;
end $$;

-- ============================================================================
--  تحقّق بعد التنفيذ:
--    select room_code, seed, updated_at from public.cn_rooms order by updated_at desc limit 3;
--    select room_code, username, team, last_seen from public.cn_presence order by last_seen desc limit 5;
--    select policyname, permissive, roles, cmd from pg_policies where tablename in ('cn_rooms','cn_presence');
--    select indexname from pg_indexes where tablename in ('cn_rooms','cn_presence');
--
--  ملاحظات لم تُحذف لأن الحذف قرار مالك القاعدة (وليست قرار ملف SQL):
--    public.cn_users   — كلمات مرور.members نصاً، ولاشارة لها في الكود: حذفها آمن
--                        بعد التأكد أن لا شاشة قديمة تستعملها.
--    public.cn_votes   — لا يقرأه ولا يكتبه أي ملف في المستودع (جدول مهجور).
-- ============================================================================
