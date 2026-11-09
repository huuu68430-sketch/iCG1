-- ============================================================================
--  iCG1 — لعبة المافيا v5: صندوق الرسائل بين الأجهزة (mafia_bus)
--  نفّذ هذا الملف مرة واحدة من Supabase → SQL Editor.
--  بدونه اللعبة تعمل على الجهاز الواحد فقط (بدون شات/تصويت بين الهواتف).
--  آمن للتشغيل أكثر من مرة (idempotent).
-- ============================================================================

create table if not exists public.mafia_bus (
  id          bigserial primary key,
  room_code   text not null,
  src         text,                       -- معرّف الجهاز المُرسل
  dst         text,                       -- stage | host | معرّف اللاعب | null = للكل
  msg         jsonb not null,             -- جسم الرسالة كاملًا
  created_at  timestamptz not null default now()
);

-- قراءة الرسائل حسب الغرفة + المعرّف، وتنظيف الرسائل القديمة
create index if not exists mafia_bus_room_idx on public.mafia_bus (room_code, id);
create index if not exists mafia_bus_clean_idx on public.mafia_bus (room_code, created_at);

-- ---------------------------------------------------------------------------
-- صلاحيات الوصول (نفس نهج بقية جداول اللعبة: مفتاح anon بدون جلسات Auth)
-- ---------------------------------------------------------------------------
alter table public.mafia_bus enable row level security;

drop policy if exists mafia_bus_all on public.mafia_bus;
create policy mafia_bus_all on public.mafia_bus for all using (true) with check (true);

grant usage, select, update on sequence public.mafia_bus_id_seq to anon, authenticated;
grant select, insert, delete on public.mafia_bus to anon, authenticated;

-- ---------------------------------------------------------------------------
-- بقاء الجداول نظيفة: حذف رسائل أي غرفة أقدم من 10 دقائق (اختياري لكن مفضّل)
-- ---------------------------------------------------------------------------
delete from public.mafia_bus where created_at < now() - interval '10 minutes';

-- ملاحظة: إن كانت قاعدة البيانات قديمة ولا تحتوي دورَي الجوكر والمحقق،
-- شغّل هذا الجزء لتحديث قيد الأدوار:
alter table public.mafia_roles drop constraint if exists mafia_roles_role_check;
alter table public.mafia_roles add constraint mafia_roles_role_check
  check (role in ('mafia', 'doctor', 'elder', 'citizen', 'detective', 'joker'));
