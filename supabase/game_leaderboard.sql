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
