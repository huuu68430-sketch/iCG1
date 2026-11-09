-- ============================================================================
-- مثبِّت واحد: شغّل هذا الملف كاملاً في Supabase > SQL Editor
-- (1) supabase/game_leaderboard.sql — نقاط الألعاب + دوال الترتيب الناقصة
-- (2) supabase/admin_center.sql     — قاعدة مركز تحكم الإدارة + الجلسات + البلاغات
-- كل الفقرات idempotent: إعادة التشغيل لا تكسر شيئاً ولا تكرّر الصفوف.
-- ============================================================================

-- ============================================================================
--  iCG1 — لوحات الصدارة الخاصة بكل لعبة
--  يلصق كامل في: Supabase Dashboard → SQL Editor → New query → Run
--  الملف idempotent: ينفّذ أكثر من مرة بدون ما يكسر أي شي.
--
--  الفكرة:
--    game_points       ← سجل كل مكافأة (سطر لكل فوز جولة/مباراة في لعبة معينة)
--    game_leaderboard  ← مجمّع لكل لعبة ولاعب (يُحدَّث تلقائياً بالـ trigger)
--    الدوال game_top / game_summary / games_board_summary / game_position
--    تقرأ لوحات الصدارة الخاصة بكل لعبة + فلترة الفترة (كل الوقت / أسبوع / شهر)
--
--  ملاحظة: النقاط السابقة في جدول leaderboard ما كانت تُخزَّن مع اسم اللعبة،
--  فتاريخ كل لعبة يبدأ من لحظة تنفيذ هذا الملف. لوحة الصدارة العامة تشتغل
--  كما هي بدون أي تغيير.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) سجل نقاط الألعاب
-- ----------------------------------------------------------------------------
create table if not exists public.game_points (
  id          bigserial    primary key,
  game_code   text         not null,               -- SPIN_WHEEL, BLUR_GUESS, MAHMAH_GAME …
  username    text         not null,               -- lowercase
  points      integer      not null default 0 check (points >= 0),
  kind        text         not null default 'round',  -- round | match
  created_at  timestamptz  not null default now()
);

comment on table  public.game_points           is 'كل مكافأة نقطة أعطتها لعبة — المصدر التاريخي للوحات الصدارة الخاصة';
comment on column public.game_points.game_code is 'معرّف اللعبة (ViewState) بحروف كبيرة';
comment on column public.game_points.kind      is 'match = فوز كامل باللعبة، round = فوز بجولة واحدة';

create index if not exists game_points_game_user_idx on public.game_points (game_code, username);
create index if not exists game_points_game_time_idx on public.game_points (game_code, created_at desc);
create index if not exists game_points_time_idx      on public.game_points (created_at desc);

-- ----------------------------------------------------------------------------
-- 2) المجمّع: سطر واحد لكل (لعبة، لاعب)
-- ----------------------------------------------------------------------------
create table if not exists public.game_leaderboard (
  game_code   text         not null,
  username    text         not null,
  score       bigint       not null default 0,
  wins        bigint       not null default 0,   -- عدد الانتصارات الكاملة
  rounds      bigint       not null default 0,   -- عدد جولات الفوز
  plays       bigint       not null default 0,   -- عدد المكافآت المسجّلة
  best_event  integer      not null default 0,   -- أكبر مكافأة واحدة
  last_win_at timestamptz,
  updated_at  timestamptz  not null default now(),
  primary key (game_code, username)
);

comment on table public.game_leaderboard is 'لوحة الصدارة الخاصة بكل لعبة — مجمّعة من game_points';

create index if not exists game_leaderboard_rank_idx on public.game_leaderboard (game_code, score desc, wins desc);

-- ----------------------------------------------------------------------------
-- 3) Trigger: كل سطر في game_points يحدّث المجمّع فوراً
--    لازم يبقى security definer: المتصفح يكتب بصلاحية anon وهي للقراءة فقط
--    على game_leaderboard، وبدون هذا يفشل الـ insert ويرتد كله.
-- ----------------------------------------------------------------------------
create or replace function public.game_points_credit() returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_game   text    := upper(btrim(NEW.game_code));
  v_user   text    := lower(btrim(NEW.username));
  v_points integer := greatest(coalesce(NEW.points, 0), 0);
  v_kind   text    := lower(btrim(coalesce(NEW.kind, 'round')));
  v_is_match integer := case when lower(btrim(coalesce(NEW.kind, 'round'))) = 'match' then 1 else 0 end;
begin
  if v_game = '' or v_user = '' then
    return NEW;
  end if;

  insert into public.game_leaderboard as gl
        (game_code, username, score, wins, rounds, plays, best_event, last_win_at, updated_at)
  values (v_game, v_user, v_points, v_is_match, 1 - v_is_match, 1, v_points, NEW.created_at, now())
  on conflict (game_code, username) do update
     set score       = gl.score + v_points,
         wins        = gl.wins + v_is_match,
         rounds      = gl.rounds + (1 - v_is_match),
         plays       = gl.plays + 1,
         best_event  = greatest(gl.best_event, v_points),
         last_win_at = coalesce(NEW.created_at, gl.last_win_at, now()),
         updated_at  = now();

  return NEW;
end;
$$;

drop trigger if exists game_points_credit_trg on public.game_points;
create trigger game_points_credit_trg
  after insert on public.game_points
  for each row execute function public.game_points_credit();

-- ----------------------------------------------------------------------------
-- 4) الدالة الرئيسية: ترتيب لاعبي لعبة واحدة
--    p_since = null  → كل الوقت (من المجمّع)
--    p_since = timestamp → الفترة فقط (يُحسب من السجل مباشرة)
-- ----------------------------------------------------------------------------
create or replace function public.game_top(
  p_game   text,
  p_since  timestamptz default null,
  p_limit  integer     default 60,
  p_offset integer     default 0
) returns table (
  username    text,
  score       bigint,
  wins        bigint,
  rounds      bigint,
  plays       bigint,
  best_event  integer,
  last_win_at timestamptz,
  avatar_url  text,
  pos         bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_game text := upper(btrim(p_game));
begin
  if v_game = '' then
    return;
  end if;

  if p_since is null then
    return query
      with ranked as (
        select gl.username,
               gl.score,
               gl.wins,
               gl.rounds,
               gl.plays,
               gl.best_event,
               gl.last_win_at,
               coalesce(p.avatar_url, '') as avatar_url,
               row_number() over (order by gl.score desc, gl.wins desc, gl.last_win_at asc nulls last, gl.username asc) as pos
        from public.game_leaderboard gl
        left join public.profiles p on lower(p.username) = gl.username
        where gl.game_code = v_game
          and gl.score > 0
          and not coalesce(p.is_banned, false)
      )
      select r.username, r.score, r.wins, r.rounds, r.plays, r.best_event, r.last_win_at, r.avatar_url, r.pos
      from ranked r
      order by r.pos
      limit greatest(coalesce(p_limit, 60), 1)
      offset greatest(coalesce(p_offset, 0), 0);
  else
    return query
      with agg as (
        select lower(btrim(gp.username)) as username,
               sum(gp.points)::bigint                                     as score,
               sum(case when gp.kind = 'match' then 1 else 0 end)::bigint as wins,
               sum(case when gp.kind = 'round' then 1 else 0 end)::bigint as rounds,
               count(*)::bigint                                           as plays,
               max(gp.points)                                             as best_event,
               max(gp.created_at)                                         as last_win_at,
               max(coalesce(pr.avatar_url, ''))                           as avatar_url,
               bool_or(coalesce(pr.is_banned, false))                     as banned
        from public.game_points gp
        left join public.profiles pr on lower(pr.username) = lower(btrim(gp.username))
        where gp.game_code = v_game
          and gp.created_at >= p_since
        group by lower(btrim(gp.username))
      ),
      ranked as (
        select a.username, a.score, a.wins, a.rounds, a.plays, a.best_event, a.last_win_at, a.avatar_url,
               row_number() over (order by a.score desc, a.wins desc, a.last_win_at asc nulls last, a.username asc) as pos
        from agg a
        where a.score > 0
          and not a.banned
      )
      select r.username, r.score, r.wins, r.rounds, r.plays, r.best_event, r.last_win_at, r.avatar_url, r.pos
      from ranked r
      order by r.pos
      limit greatest(coalesce(p_limit, 60), 1)
      offset greatest(coalesce(p_offset, 0), 0);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) ملخّص لعبة واحدة (عدد اللاعبين، النقاط الموزّعة، أعلى نتيجة…)
-- ----------------------------------------------------------------------------
create or replace function public.game_summary(
  p_game  text,
  p_since timestamptz default null
) returns table (
  players      bigint,
  total_points bigint,
  total_wins   bigint,
  total_events bigint,
  top_score    bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_game text := upper(btrim(p_game));
begin
  if v_game = '' then
    return;
  end if;

  if p_since is null then
    return query
      select count(*)::bigint,
             coalesce(sum(gl.score), 0)::bigint,
             coalesce(sum(gl.wins), 0)::bigint,
             coalesce(sum(gl.plays), 0)::bigint,
             coalesce(max(gl.score), 0)::bigint
      from public.game_leaderboard gl
      left join public.profiles p on lower(p.username) = gl.username
      where gl.game_code = v_game
        and gl.score > 0
        and not coalesce(p.is_banned, false);
  else
    return query
      with agg as (
        select lower(btrim(gp.username)) as username,
               sum(gp.points)::bigint                                     as score,
               sum(case when gp.kind = 'match' then 1 else 0 end)::bigint as wins,
               count(*)::bigint                                           as plays,
               bool_or(coalesce(pr.is_banned, false))                     as banned
        from public.game_points gp
        left join public.profiles pr on lower(pr.username) = lower(btrim(gp.username))
        where gp.game_code = v_game
          and gp.created_at >= p_since
        group by lower(btrim(gp.username))
        having sum(gp.points) > 0
      )
      select count(*)::bigint,
             coalesce(sum(score), 0)::bigint,
             coalesce(sum(wins), 0)::bigint,
             coalesce(sum(plays), 0)::bigint,
             coalesce(max(score), 0)::bigint
      from agg
      where not banned;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) ملخّص كل الألعاب — يعبّي تبويبات اللوحة (عدد اللاعبين + نقاط كل لعبة)
-- ----------------------------------------------------------------------------
create or replace function public.games_board_summary(
  p_since timestamptz default null
) returns table (
  game_code    text,
  players      bigint,
  total_points bigint,
  top_username text,
  top_score    bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_since is null then
    return query
      select gl.game_code,
             count(*)::bigint,
             sum(gl.score)::bigint,
             (array_agg(gl.username order by gl.score desc))[1],
             max(gl.score)::bigint
      from public.game_leaderboard gl
      left join public.profiles p on lower(p.username) = gl.username
      where gl.score > 0
        and not coalesce(p.is_banned, false)
      group by gl.game_code;
  else
    return query
      with agg as (
        select gp.game_code,
               lower(btrim(gp.username)) as username,
               sum(gp.points)::bigint                 as score,
               bool_or(coalesce(pr.is_banned, false)) as banned
        from public.game_points gp
        left join public.profiles pr on lower(pr.username) = lower(btrim(gp.username))
        where gp.created_at >= p_since
        group by gp.game_code, lower(btrim(gp.username))
        having sum(gp.points) > 0
      )
      select a.game_code,
             count(*)::bigint,
             sum(a.score)::bigint,
             (array_agg(a.username order by a.score desc))[1],
             max(a.score)::bigint
      from agg a
      where not a.banned
      group by a.game_code;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) موقع لاعب واحد نفسه في لعبة معينة (حتى لو خارج أول 60)
-- ----------------------------------------------------------------------------
create or replace function public.game_position(
  p_game     text,
  p_username text,
  p_since    timestamptz default null
) returns table (
  pos    bigint,
  score  bigint,
  wins   bigint,
  plays  bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_game text := upper(btrim(p_game));
  v_user text := lower(btrim(p_username));
begin
  if v_game = '' or v_user = '' then
    return;
  end if;

  if p_since is null then
    return query
      select r.pos, r.score, r.wins, r.plays
      from (
        select gl.username, gl.score, gl.wins, gl.plays,
               row_number() over (order by gl.score desc, gl.wins desc, gl.last_win_at asc nulls last, gl.username asc) as pos
        from public.game_leaderboard gl
        left join public.profiles p on lower(p.username) = gl.username
        where gl.game_code = v_game
          and gl.score > 0
          and not coalesce(p.is_banned, false)
      ) r
      where r.username = v_user;
  else
    return query
      with agg as (
        select lower(btrim(gp.username)) as username,
               sum(gp.points)::bigint                                     as score,
               sum(case when gp.kind = 'match' then 1 else 0 end)::bigint as wins,
               count(*)::bigint                                           as plays,
               bool_or(coalesce(pr.is_banned, false))                     as banned
        from public.game_points gp
        left join public.profiles pr on lower(pr.username) = lower(btrim(gp.username))
        where gp.game_code = v_game
          and gp.created_at >= p_since
        group by lower(btrim(gp.username))
        having sum(gp.points) > 0
      ),
      clean as (
        select a.username, a.score, a.wins, a.plays
        from agg a
        where not a.banned
      )
      select r.pos, r.score, r.wins, r.plays
      from (
        select c.username, c.score, c.wins, c.plays,
               row_number() over (order by c.score desc, c.wins desc, c.username asc) as pos
        from clean c
      ) r
      where r.username = v_user;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) الصلاحيات — نفس نهج بقية جداول iCG1 (مفتاح anon، بدون جلسات Auth)
--    الكتابة من المتصفح عبر السجل فقط، والقراءة كلها عبر الدوال.
-- ----------------------------------------------------------------------------
alter table public.game_points      enable row level security;
alter table public.game_leaderboard enable row level security;

drop policy if exists game_points_insert on public.game_points;
create policy game_points_insert on public.game_points for insert to anon, authenticated with check (true);

drop policy if exists game_points_select on public.game_points;
create policy game_points_select on public.game_points for select to anon, authenticated using (true);

drop policy if exists game_leaderboard_select on public.game_leaderboard;
create policy game_leaderboard_select on public.game_leaderboard for select to anon, authenticated using (true);

grant usage, select on sequence public.game_points_id_seq to anon, authenticated;
grant select, insert on public.game_points to anon, authenticated;
grant select on public.game_leaderboard to anon, authenticated;
grant execute on function public.game_top(text, timestamptz, integer, integer)          to anon, authenticated;
grant execute on function public.game_summary(text, timestamptz)                         to anon, authenticated;
grant execute on function public.games_board_summary(timestamptz)                        to anon, authenticated;
grant execute on function public.game_position(text, text, timestamptz)                  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9) تنظيف اختياري: يحذف السجل الأقدم من عدد الأيام (حد أدنى 90 يوم)، والمجمّع يبقى دائم
--    (الدالة يدوية — شغّلها وقت ما تحتاج، ما عليها جدول مجدول)
-- ----------------------------------------------------------------------------
create or replace function public.game_points_prune(p_keep_days integer default 400)
returns bigint
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  with del as (
    delete from public.game_points
    where created_at < now() - make_interval(days => greatest(coalesce(p_keep_days, 400), 90))
    returning 1
  )
  select count(*)::bigint from del;
$$;

grant execute on function public.game_points_prune(integer) to authenticated, service_role;

-- ============================================================================
--  فحص سريع بعد التنفيذ:
--    select * from games_board_summary();
--    select * from game_top('SPIN_WHEEL', null, 10, 0);
-- ============================================================================


-- ============================================================================
--  iCG1 — Admin Control Center: مخطط البيانات الكامل
--  يلصق كامل في: Supabase Dashboard → SQL Editor → New query → Run
--  الملف idempotent: ينفّذ أكثر من مرة بدون ما يكسر أي شي.
--
--  الفكرة:
--    كل قسم في لوحة الإدارة الجديدة لازم يكون له مصدر حقيقي في القاعدة،
--    وكل قسم إداري كان بلا مقابل عند العضو (بلاغات، دعم، عقوبات، بطولات،
--    إشعارات، أكواد) يصير له جدول + واجهة للعضو يغلّى منها البيانات.
--
--  الصلاحيات: كل جدول جديد RLS مفعّل وبدون أي سياسة، وanon/authenticated
--    ممنوعين منه بالكلّي — القراءة والكتابة حصرياً عبر دوال /api التي
--    تستخدم service_role. ما في أي مسار للمتصفح يكتب بيانات إدارية.
--
--  ملاحظة: هذا الملف ما يحذف ولا يغيّر أي جدول يشتغل عليه الموقع اليوم.
--  كل الإضافات IF NOT EXISTS، والزرع ON CONFLICT DO NOTHING فما يمسح
--  تعديلاتك لو نفذته مرة ثانية.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) البلاغات (قسم الأمان: إدارة المجتمع والبلاغات + واجهة العضو في الإعدادات)
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_username text         not null,                 -- من رفع البلاغ (lowercase)
  target_username   text,                                  -- المبلغ عنه
  kind              text         not null default 'سلوك مخالف',
  reason            text         not null,
  detail            text,
  record_type       text         not null default 'report', -- report | appeal
  sanction_id       uuid,                                   -- الاعتراض يرتبط بعقوبة
  status            text         not null default 'new',     -- new|reviewing|accepted|rejected|closed
  resolution        text,
  handled_by        text,
  verified          boolean      not null default false,     -- صاحب البلاغ حساب موثّق
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

comment on table  public.reports                is 'بلاغات الأعضاء عن سلوك مخالف + اعتراضات على العقوبات';
comment on column public.reports.record_type    is 'report = بلاغ من عضو، appeal = اعتراض على عقوبة';
comment on column public.reports.status         is 'new|reviewing|accepted|rejected|closed';

create index if not exists reports_status_time_idx  on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx     on public.reports (reporter_username, created_at desc);
create index if not exists reports_target_idx       on public.reports (target_username);

-- ----------------------------------------------------------------------------
-- 2) تذاكر الدعم (قسم المجتمع: مركز الدعم + واجهة العضو في الإعدادات)
-- ----------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  username    text         not null,
  subject     text         not null,
  body        text,
  category    text         not null default 'مشكلة تقنية',
  priority    text         not null default 'متوسطة',      -- منخفضة|متوسطة|عالية
  status      text         not null default 'new',         -- new|reviewing|resolved|closed
  reply       text,                                        -- رد الإدارة (يظهر للعضو)
  handled_by  text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_user_idx   on public.support_tickets (username, created_at desc);

-- ----------------------------------------------------------------------------
-- 3) الإشعارات (قسم المجتمع: مركز الإشعارات + جرس في رأس لوحة العضو)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  title           text         not null,
  body            text,
  audience        text         not null default 'all',     -- all | vip | player
  target_username text,                                      -- عندما audience = player
  status          text         not null default 'sent',     -- draft|scheduled|sent
  scheduled_at    timestamptz,
  sent_at         timestamptz  not null default now(),
  created_by      text,
  created_at      timestamptz  not null default now()
);

create table if not exists public.notification_reads (
  notification_id uuid         not null references public.notifications(id) on delete cascade,
  username        text         not null,
  read_at         timestamptz  not null default now(),
  primary key (notification_id, username)
);

create index if not exists notifications_sent_idx on public.notifications (sent_at desc);
create index if not exists notification_reads_user_idx on public.notification_reads (username);

-- ----------------------------------------------------------------------------
-- 4) البطولات (قسم الألعاب: البطولات والفعاليات + بطاقة التسجيل في الرئيسية)
-- ----------------------------------------------------------------------------
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text         not null,
  game_code   text,
  starts_at   timestamptz,
  max_players integer      not null default 32,
  prize       integer      not null default 0,
  status      text         not null default 'draft',  -- draft|open|closed|running|completed
  note        text,
  created_by  text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create table if not exists public.tournament_registrations (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  username      text not null,
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, username)
);

create index if not exists tournaments_status_idx on public.tournaments (status, starts_at);
create index if not exists tournament_reg_user_idx on public.tournament_registrations (username);

-- ----------------------------------------------------------------------------
-- 5) الرُتب والعضويات (قسم الاقتصاد: العضويات والرتب)
--    الرُتب العشر مزروعة بنفس السلّم المستخدم في لوحة العضو، فما ينكسر شي.
--    العضوية (VIP) تُمنح من اللوحة وتطبق خصم نقاط عند الشراء.
-- ----------------------------------------------------------------------------
create table if not exists public.tiers (
  id            text primary key,
  kind          text    not null default 'rank',   -- rank | membership
  name          text    not null,
  min_points    integer not null default 0,
  discount_pct  integer not null default 0,
  duration_days integer,                           -- للعضويات: كم يوم صالحة
  perk          text,
  sort          integer not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

insert into public.tiers (id, kind, name, min_points, sort) values
  ('rank_0',  'rank', 'مستجد',      0,    0),
  ('rank_1',  'rank', 'جندي',       100,  1),
  ('rank_2',  'rank', 'عريف',       300,  2),
  ('rank_3',  'rank', 'رقيب',       600,  3),
  ('rank_4',  'rank', 'ملازم',      1000, 4),
  ('rank_5',  'rank', 'ملازم أول',  1600, 5),
  ('rank_6',  'rank', 'نقيب',       2400, 6),
  ('rank_7',  'rank', 'رائد',       3500, 7),
  ('rank_8',  'rank', 'مقدم',       5000, 8),
  ('rank_9',  'rank', 'عقيد',       8000, 9)
on conflict (id) do nothing;

insert into public.tiers (id, kind, name, min_points, discount_pct, duration_days, perk, sort) values
  ('vip', 'membership', 'VIP', 0, 10, 30, 'خصم 10% بالمتجر', 100)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 6) المشرفون والصلاحيات — صف واحد حقيقي: أنت. الباقي تضيفه من اللوحة.
-- ----------------------------------------------------------------------------
create table if not exists public.admin_staff (
  id            uuid primary key default gen_random_uuid(),
  staff_name    text    not null unique,
  role          text    not null default 'Support Agent',
  permissions   text[]  not null default '{}',   -- معرّفات الأقسام، أو '*' لكل شي
  is_active     boolean not null default true,
  last_login    timestamptz,
  created_at    timestamptz not null default now()
);

insert into public.admin_staff (staff_name, role, permissions) values
  ('المشرف العام', 'Super Admin', array['*'])
on conflict (staff_name) do nothing;

-- ----------------------------------------------------------------------------
-- 7) توسعة الجداول الموجودة — بدون حذف ولا تغيير في الأعمدة القديمة
-- ----------------------------------------------------------------------------

-- العقوبات: جدول bans موجود لكن بلا نوع ولا مدة ولا حالة
alter table public.bans add column if not exists kind      text        not null default 'حظر دائم';
alter table public.bans add column if not exists status    text        not null default 'active';  -- active|expired|lifted
alter table public.bans add column if not exists starts_at timestamptz default now();
alter table public.bans add column if not exists ends_at   timestamptz;
alter table public.bans add column if not exists note      text;
alter table public.bans add column if not exists updated_at timestamptz default now();
create index if not exists bans_status_idx on public.bans (status, created_at desc);

-- الملفات: ملاحظة إدارية داخلية + عضوية aktif
alter table public.profiles add column if not exists admin_note           text;
alter table public.profiles add column if not exists membership           text;   -- 'vip' أو NULL
alter table public.profiles add column if not exists membership_expires_at timestamptz;

-- الإعلانات: عنوان + نوع + حالة + جدولة (content/is_active الحاليان يشتغلان كما هما)
alter table public.announcements add column if not exists title        text;
alter table public.announcements add column if not exists kind         text not null default 'عام';
alter table public.announcements add column if not exists status       text not null default 'published'; -- draft|scheduled|published
alter table public.announcements add column if not exists scheduled_at timestamptz;
alter table public.announcements add column if not exists published_at timestamptz;
alter table public.announcements add column if not exists created_by   text;
alter table public.announcements add column if not exists updated_at   timestamptz;

create table if not exists public.announcement_dismissals (
  username        text not null,
  announcement_id uuid not null,
  dismissed_at    timestamptz not null default now(),
  primary key (username, announcement_id)
);

-- الأكواد الترويجية: نهاية صلاحية + ملاحظة
alter table public.promo_codes add column if not exists expires_at timestamptz;
alter table public.promo_codes add column if not exists note       text;
alter table public.promo_codes add column if not exists created_by text;

-- المقتنيات: من أين جاء المقتنى (شراء عضو / منح إداري / مكافأة بطولة)
alter table public.user_frames add column if not exists source     text not null default 'purchase';
alter table public.user_frames add column if not exists granted_by text;

-- الساحة: is_active = موقوفة، is_visible المخفي الموجود أصلاً
alter table public.games add column if not exists is_active  boolean not null default true;
alter table public.games add column if not exists updated_at timestamptz default now();

-- arena_status: ما لها مفتاح، فلهذا الكتابة القديمة ما كانت تنجح (update بلا صفوف)
create unique index if not exists arena_status_key_key on public.arena_status (key);
alter table public.arena_status add column if not exists updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- 8) زرع بيانات حقيقية: كتالوج الألعاب المستخدم فعلياً في الصفحة الرئيسية
--    (components/Home435242.tsx: ALLOWED_HOT_IDS + ALLOWED_REGULAR_IDS)
-- ----------------------------------------------------------------------------
create unique index if not exists games_view_id_key on public.games (view_id);

insert into public.games (id, view_id, title, position, is_primary, is_visible, is_active) values
  (gen_random_uuid(), 'MAHMAH_GAME',       'المافيا',         1,  true,  true, true),
  (gen_random_uuid(), 'EMOJI_CODE',        'كود نيمز',        2,  true,  true, true),
  (gen_random_uuid(), 'LETTER_GAME',       'حروف مع منصور',   3,  false, true, true),
  (gen_random_uuid(), 'TIME_BOMB',         'قنبلة موقوتة',    4,  false, true, true),
  (gen_random_uuid(), 'MAP_GUESSER',       'خمن الدولة',      5,  false, true, true),
  (gen_random_uuid(), 'TYPING_RACE',       'سباق الكتابة',    6,  false, true, true),
  (gen_random_uuid(), 'SAFE_CODE',         'فك الشفرة',       7,  false, true, true),
  (gen_random_uuid(), 'TRUTH_OR_LIE',      'صادق أم كذاب',    8,  false, true, true),
  (gen_random_uuid(), 'MUSICAL_CHAIRS',    'الكرسي الموسيقي', 9,  false, true, true),
  (gen_random_uuid(), 'SPIN_WHEEL',        'الروليت',        10,  false, true, true),
  (gen_random_uuid(), 'FLAG_QUIZ',         'الأعلام',        11,  false, true, true),
  (gen_random_uuid(), 'HIGHER_LOWER',      'أعلى أم أقل',    12,  false, true, true),
  (gen_random_uuid(), 'BLUR_GUESS',        'تخمين الصورة',   13,  false, true, true),
  (gen_random_uuid(), 'CUP_SHUFFLE',       'تحدي الأكواب',   14,  false, true, true),
  (gen_random_uuid(), 'DRAWING_CHALLENGE', 'تحدي الرسم',     15,  false, true, true),
  (gen_random_uuid(), 'GLASS_BRIDGE_V2',   'جسر الزجاج',    16,  false, true, true)
on conflict (view_id) do nothing;

-- إعدادات الساحة: القيم الافتراضية التي يعرفها الموقع
insert into public.arena_status (key, value, updated_at) values
  ('global_mood',   '{"theme":"default","particles":"none"}'::jsonb, now()),
  ('audio_overlay', '{"enabled":false,"volume":50,"url":""}'::jsonb, now())
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 9) جداول يستهلكها الكود لكنها ما أُنشئت قط — بدونها كل مسار /api يفشل
--    • sessions: requireSession يرفض أي طلب إذا الجدول غائب أو الصف مفقود،
--      فكان /api/me يرجّع 401 دائماً ومصادقة الأعضاء معطّلة بالكامل.
--    • chat_verification_codes: تأكيد الشات عند التسجيل
--    • sponsors: ودجت الرعاة
--    • higher_lower_questions: بنك أسئلة «أعلى أم أقل»
-- ----------------------------------------------------------------------------
create table if not exists public.sessions (
  jti        text primary key,
  user_id    uuid,
  username   text,
  revoked    boolean    not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on public.sessions (user_id, expires_at desc);

create table if not exists public.chat_verification_codes (
  id            uuid primary key default gen_random_uuid(),
  kick_username text        not null,
  code_hmac     text        not null,
  attempts      integer     not null default 0,
  max_attempts  integer     not null default 5,
  used          boolean     not null default false,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists chat_codes_user_idx on public.chat_verification_codes (kick_username, used, expires_at desc);

create table if not exists public.sponsors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kick_username text,
  avatar_url    text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.higher_lower_questions (
  id            bigint generated always as identity primary key,
  stage_number  integer not null,
  question_text text    not null,
  is_higher     boolean not null default true,
  fact          text,
  created_at    timestamptz not null default now()
);
create index if not exists higher_lower_stage_idx on public.higher_lower_questions (stage_number, id);

-- register_user: كانت api/auth/register.ts تناديها وهي ما موجودة
create or replace function public.register_user(
  p_username text, p_display_name text, p_password_hash text, p_discord text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  v_name := lower(btrim(p_username));
  if v_name = '' then raise exception 'username required'; end if;
  select id into v_id from public.users where kick_username = v_name limit 1;
  if found then raise exception 'username already exists'; end if;

  insert into public.users (kick_username, display_name, avatar, password_hash, discord, points, is_verified)
    values (v_name, coalesce(nullif(btrim(p_display_name),''), v_name), '', p_password_hash, p_discord, 0, false)
    returning id into v_id;

  insert into public.profiles (username, credits, daily_streak, is_banned)
    values (v_name, 0, 0, false) on conflict do nothing;
  insert into public.leaderboard (username, score, wins, avatar_url)
    values (v_name, 0, 0, '') on conflict do nothing;

  insert into public.audit_logs (admin_username, action, details)
    values ('SYSTEM', 'ACCOUNT_REGISTERED', jsonb_build_object('username', v_name));
  return v_id;
end $$;

-- إنشاء جلسة قابلة للتحقق: تُستدعى من دوال الدخول بدل ما تُترك الجلسة معلّقة
create or replace function public.register_session(
  p_jti text, p_user_id uuid, p_username text, p_expires_at timestamptz
) returns void
language sql security definer set search_path = public as $$
  insert into public.sessions (jti, user_id, username, revoked, expires_at)
  values (p_jti, p_user_id, p_username, false, p_expires_at)
  on conflict (jti) do update set revoked = false, expires_at = excluded.expires_at;
$$;

-- • api_rate_limits + check_rate_limit: api/_lib/rateLimit.ts تناديها، وبدونها
--   ترفض الإنتاج كل طلب (fail-closed) وترجع 503 — أي أن كل مسارات /api معطّلة.
create table if not exists public.api_rate_limits (
  key          text        primary key,
  count        integer     not null default 1,
  window_start timestamptz not null default now()
);

create or replace function public.check_rate_limit(
  p_key text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.api_rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
  set count = case
        when public.api_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
        then 1 else public.api_rate_limits.count + 1 end,
      window_start = case
        when public.api_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
        then v_now else public.api_rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end $$;

-- تنظيف النوافذ المنتهية حتى لا يكبر الجدول بلا حد (اختياري، من جدول مهام)
delete from public.api_rate_limits
 where window_start < now() - interval '1 day';

-- ----------------------------------------------------------------------------
-- 9ب) عمليات الأعضاء الحساسة للمال — ذرّية في القاعدة
--     كانت تُنفَّذ في المتصفح كسلسلة قراءات وكتابات، فيقدر لاعب يستخدم الكود
--     مرتين أو يشتري مرتين بنفس الرصيد قبل أن تُكتب الثانية. هنا قفل الصف.
-- ----------------------------------------------------------------------------
create table if not exists public.promo_redemptions (
  promo_id     uuid        not null references public.promo_codes(id) on delete cascade,
  username     text        not null,
  amount       integer     not null,
  redeemed_at  timestamptz not null default now(),
  via          text        not null default 'site',   -- site | chat
  primary key (promo_id, username)
);
create index if not exists promo_redemptions_user_idx on public.promo_redemptions (username, redeemed_at desc);

-- استخدام كود ترويجي: يتحقّق من الصلاحية والحدّ والم repeats، ثم يضيف
-- الرصيد والنقاط ويسجّل المعاملة والعملية الإدارية — في معاملة واحدة.
create or replace function public.redeem_promo(p_username text, p_code text, p_via text default 'site')
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_user  text := lower(btrim(p_username));
  v_code  text := upper(btrim(p_code));
  v_promo public.promo_codes%rowtype;
  v_prof  public.profiles%rowtype;
  v_amount integer;
begin
  if v_user = '' then raise exception 'اسم اللاعب مطلوب'; end if;
  select * into v_promo from public.promo_codes where upper(code) = v_code for update;
  if not found then raise exception 'كود غير صالح'; end if;
  if not v_promo.is_active then raise exception 'الكود متوقف'; end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then raise exception 'انتهت صلاحية الكود'; end if;
  if v_promo.max_uses > 0 and v_promo.current_uses >= v_promo.max_uses then raise exception 'استُهلك كامل الكود'; end if;
  if exists (select 1 from public.promo_redemptions where promo_id = v_promo.id and username = v_user) then
    raise exception 'استخدمت هذا الكود مسبقاً';
  end if;

  select * into v_prof from public.profiles where username = v_user for update;
  if found and v_prof.is_banned then raise exception 'حسابك محظور'; end if;
  v_amount := coalesce(v_promo.reward_amount, 0);
  if v_amount <= 0 then raise exception 'قيمة الكود غير معروفة'; end if;

  if found then
    update public.profiles set credits = coalesce(credits,0) + v_amount where username = v_user;
  else
    insert into public.profiles (username, credits, daily_streak, is_banned) values (v_user, v_amount, 0, false);
  end if;

  insert into public.leaderboard (username, score, wins, avatar_url)
    values (v_user, v_amount, 0, '')
    on conflict (username) do update set score = leaderboard.score + excluded.score, updated_at = now();

  update public.promo_codes set current_uses = current_uses + 1 where id = v_promo.id;
  insert into public.promo_redemptions (promo_id, username, amount, via) values (v_promo.id, v_user, v_amount, p_via);
  insert into public.transactions (user_id, amount, type, description)
    values ((select id from public.users where kick_username = v_user limit 1), v_amount, 'PROMO', 'كود ترويجي ' || v_promo.code);
  insert into public.audit_logs (admin_username, action, details)
    values ('SYSTEM_AUTO', 'PROMO_REDEEM', jsonb_build_object('username', v_user, 'code', v_promo.code, 'amount', v_amount, 'via', p_via));
  return v_amount;
end $$;

-- شراء من المتجر (إطار): العملة هي النقاط (leaderboard.score) كما في المتجر
-- الحالي تماماً — الرصيد (profiles.credits) عمود آخر لا يمس الشراء.
-- خصم VIP مطبَّق هنا، والنقطة تُخصم والمقتنى يُضاف ذرّياً.
create or replace function public.buy_frame(p_username text, p_frame_id text)
returns table (frame_id text, price_paid integer, discount integer, points_left integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user  text := lower(btrim(p_username));
  v_frame public.frames%rowtype;
  v_lb    public.leaderboard%rowtype;
  v_disc  integer := 0;
  v_price integer;
  v_uid   uuid;
begin
  select * into v_frame from public.frames where id = p_frame_id for update;
  if not found then raise exception 'المنتج غير موجود'; end if;
  if not v_frame.is_active then raise exception 'المنتج غير معروض حالياً'; end if;

  select * into v_lb from public.leaderboard where lower(username) = v_user for update;
  if not found then raise exception 'لا يوجد سجل نقاط لهذا الحساب'; end if;

  if exists (select 1 from public.user_frames where username = v_user and frame_id = p_frame_id) then
    raise exception 'تمتلك هذا المقتنى مسبقاً';
  end if;

  if exists (select 1 from public.profiles
             where username = v_user and membership = 'vip'
               and (membership_expires_at is null or membership_expires_at > now())) then
    select coalesce(discount_pct, 0) into v_disc from public.tiers where id = 'vip';
  end if;

  v_price := greatest(0, round(v_frame.price * (100 - v_disc) / 100.0)::integer);
  if coalesce(v_lb.score, 0) < v_price then
    raise exception 'نقاطك لا تكفي — ينقصك %s نقطة', greatest(0, v_price - coalesce(v_lb.score,0));
  end if;

  v_uid := (select id from public.users where kick_username = v_user limit 1);

  update public.leaderboard set score = score - v_price, updated_at = now() where id = v_lb.id;
  if v_uid is not null then
    update public.users set points = greatest(0, coalesce(points,0) - v_price), updated_at = now() where id = v_uid;
  end if;
  insert into public.user_frames (user_id, username, frame_id, is_equipped, source)
    values (v_uid, v_user, v_frame.id, false, 'purchase');
  insert into public.transactions (user_id, amount, type, description)
    values (v_uid, -v_price, 'PURCHASE', 'شراء: ' || v_frame.name || case when v_disc > 0 then ' (خصم ' || v_disc || '%)' else '' end);
  if v_disc > 0 then
    insert into public.audit_logs (admin_username, action, details)
      values ('SYSTEM', 'VIP_DISCOUNT_APPLIED', jsonb_build_object('username', v_user, 'item', v_frame.name, 'discount', v_disc, 'paid', v_price));
  end if;

  return query select v_frame.id, v_price, v_disc, v_lb.score - v_price;
end $$;

-- تجهيز إطار مملوك: سطر واحد مجهّز دائماً، والملف يتبعه.
create or replace function public.equip_frame(p_username text, p_frame_id text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_user text := lower(btrim(p_username));
begin
  if not exists (select 1 from public.user_frames where username = v_user and frame_id = p_frame_id) then
    raise exception 'لا تملك هذا المقتنى';
  end if;
  update public.user_frames set is_equipped = (frame_id = p_frame_id) where username = v_user;
  update public.profiles set active_frame_id = p_frame_id, active_frame_url = null where username = v_user;
  return p_frame_id;
end $$;

-- ----------------------------------------------------------------------------
-- 10) دوال اللوحة: الأرقام كلها محسوبة من بيانات موجودة، لا عيّنات
-- ----------------------------------------------------------------------------

-- نظرة عامة + الاقتصاد: نفس الأرقام في بطاقات الرئيسية ومركز الاقتصاد
create or replace function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'players',        (select count(*) from public.profiles),
    'accounts',       (select count(*) from public.users),
    'banned',         (select count(*) from public.profiles where is_banned),
    'sanctions',      (select count(*) from public.bans where status = 'active'),
    'credits',        coalesce((select sum(credits) from public.profiles), 0),
    'points',         coalesce((select sum(score) from public.leaderboard), 0),
    'wins',           coalesce((select sum(wins) from public.leaderboard), 0),
    'store_active',   (select count(*) from public.frames where is_active),
    'games_active',   (select count(*) from public.games where is_active and is_visible),
    'games_total',    (select count(*) from public.games),
    'tournaments',    (select count(*) from public.tournaments),
    'tickets_open',   (select count(*) from public.support_tickets where status in ('new','reviewing')),
    'reports_new',    (select count(*) from public.reports where status = 'new'),
    'plays',          coalesce((select sum(plays) from public.game_leaderboard), 0),
    'visits',         coalesce((select max(visits) from public.site_stats), 0),
    'spend',          coalesce((select sum(-amount) from public.transactions where amount < 0), 0),
    'inventory',      (select count(*) from public.user_frames),
    'promos_active',  (select count(*) from public.promo_codes where is_active)
  ) into r;
  return r;
end $$;

-- سلسلة النشاط اليومية: نقاط الألعاب + اللاعبين الجدد + الإنفاق، من التاريخ الحقيقي
create or replace function public.admin_activity(p_days integer default 30)
returns table (day date, plays bigint, points bigint, new_players bigint, spend bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series(
      (current_date - (p_days - 1))::date, current_date::date, '1 day'
    )::date as day
  ),
  gp as (
    select created_at::date as day, count(*) as plays, sum(points) as points
    from public.game_points
    where created_at::date >= current_date - (p_days - 1)
    group by 1
  ),
  np as (
    select created_at::date as day, count(*) as new_players
    from public.profiles
    where created_at::date >= current_date - (p_days - 1)
    group by 1
  ),
  sp as (
    select created_at::date as day, sum(-amount) as spend
    from public.transactions
    where amount < 0 and created_at::date >= current_date - (p_days - 1)
    group by 1
  )
  select s.day,
         coalesce(gp.plays, 0), coalesce(gp.points, 0),
         coalesce(np.new_players, 0), coalesce(sp.spend, 0)
  from span s
  left join gp on gp.day = s.day
  left join np on np.day = s.day
  left join sp on sp.day = s.day
  order by s.day;
$$;

-- أكثر الألعاب لعباً / الأقل، من المجمّع الحقيقي لكل لعبة
create or replace function public.admin_game_rankings()
returns table (game_code text, plays bigint, points bigint, players bigint, last_play timestamptz)
language sql security definer set search_path = public as $$
  select g.game_code,
         sum(g.plays)::bigint,
         sum(g.score)::bigint,
         count(distinct g.username)::bigint,
         max(g.last_win_at)
  from public.game_leaderboard g
  group by g.game_code
  order by sum(g.plays) desc;
$$;

-- فحص سلامة البيانات — يستبدل زر «فحص السلامة» التجريبي في اللوحة القديمة
create or replace function public.admin_integrity_check() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'negative_credits',  (select count(*) from public.profiles where credits < 0),
    'negative_scores',   (select count(*) from public.leaderboard where score < 0 or wins < 0),
    'orphan_frames',     (select count(*) from public.user_frames uf
                          where not exists (select 1 from public.frames f where f.id = uf.frame_id)),
    'banned_in_board',   (select count(*) from public.leaderboard l
                          join public.profiles p on lower(p.username) = lower(l.username)
                          where p.is_banned),
    'dup_usernames',     (select count(*) from (
                            select lower(username) u, count(*) from public.profiles
                            group by 1 having count(*) > 1) x),
    'expired_sanctions', (select count(*) from public.bans
                          where status = 'active' and ends_at is not null and ends_at < now()),
    'codes_past_expiry', (select count(*) from public.promo_codes
                          where is_active and expires_at is not null and expires_at < now()),
    'stale_sessions',    (select count(*) from public.sessions where expires_at < now() and revoked = false)
  ) into r;
  return r;
end $$;

-- حالة القاعدة: عدد الأسطر وحجم كل جدول حقيقيًا من pg_class
create or replace function public.admin_db_health()
returns table (table_name text, rows bigint, size text)
language sql security definer set search_path = public as $$
  select c.relname::text,
         greatest(coalesce(n_live_tup, 0)::bigint, 0),
         pg_size_pretty(pg_total_relation_size(c.oid))
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where ns.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;

-- ----------------------------------------------------------------------------
-- 11) الصلاحيات: الجداول الجديدة والدوال مقفلة على service_role فقط
-- ----------------------------------------------------------------------------
do $$
declare t text;
declare fx text;
begin
  foreach t in array array[
    'reports','support_tickets','notifications','notification_reads',
    'tournaments','tournament_registrations','tiers','admin_staff',
    'announcement_dismissals','sessions','chat_verification_codes',
    'api_rate_limits','promo_redemptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;

  foreach fx in array array[
    'admin_overview','admin_activity(int)','admin_game_rankings()',
    'admin_integrity_check()','admin_db_health()','register_user(text,text,text,text)',
    'register_session(text,uuid,text,timestamptz)',
    'check_rate_limit(text,integer,integer)',
    'redeem_promo(text,text,text)','buy_frame(text,text)','equip_frame(text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fx);
    execute format('grant execute on function public.%s to service_role', fx);
  end loop;
end $$;

-- الجداول التي يقرأها المتصفح مباشرة تبقى كما هي (frames/leaderboard/announcements…)
-- الكتابة عليها كلها تمشي عبر /api بمفتاح السر؛ هنا قراءة فقط.
grant select on public.tiers         to anon, authenticated;
grant select on public.games         to anon, authenticated;
grant select on public.arena_status  to anon, authenticated;

-- tiers عليها RLS، والمتصفح يقرأها مباشرة في services/tiers.ts (سلّم الرتب + خصم VIP):
-- بلا سياسة قراءة عامة يرجع السلّم فارغاً في الواجهة.
drop policy if exists tiers_read_public on public.tiers;
create policy tiers_read_public on public.tiers
  for select to anon, authenticated using (true);

-- games و arena_status تُقرأ من المتصفح أيضاً (بطاقات الألعاب + حالة الساحة)
drop policy if exists games_read_public on public.games;
create policy games_read_public on public.games
  for select to anon, authenticated using (true);

drop policy if exists arena_status_read_public on public.arena_status;
create policy arena_status_read_public on public.arena_status
  for select to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- 12) البث اللحظي (realtime) — بدون هذه الفقرة القراءة الأولى تنجح لكن
--     التحديث التلقائي ما يوصل: المتصفح مشترك على pgoutput عبر supabase_realtime
--     والجداول الجديدة ما تكون داخل النشر إلا إذا أضفناها هنا.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['arena_status','games','tiers'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    -- البث يحتاج الهوية الكاملة للصف، وإلا أحداث UPDATE ترسل المفتاح فقط
    execute format('alter table public.%I replica identity full', t);
  end loop;
exception when others then
  -- النشر غير موجود أو الصلاحيات مقيدة: الموقع يشتغل بدون تحديث لحظي، لا أكثر
  raise notice 'realtime publication skipped: %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- 13) تنظيف اختياري — شغّله يدويًا فقط إذا تأكدت
--     cn_users تحمل كلمات سر بمفردها النص (مسار كود نيمز القديم، لم يعد مستخدماً)
-- ----------------------------------------------------------------------------
-- drop table if exists public.cn_users;
-- drop table if exists public.user_inventory;   -- نسخة قديمة فارغة من user_frames

-- ============================================================================
--  تم. تحقّق بتنفيذ:
--    select count(*) from public.reports;          -- 0 (فارغ وحقيقي)
--    select public.admin_overview();               -- أرقام اللوحة
--    select public.admin_integrity_check();
--    select * from public.admin_db_health();
--    select view_id, title from public.games order by position;   -- 16 لعبة
--    select tablename from pg_publication_tables
--      where pubname='supabase_realtime' and tablename in ('arena_status','games','tiers');  -- 3 صفوف
-- ============================================================================
