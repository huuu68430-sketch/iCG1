-- ============================================================================
--  iCG1 — إصلاح سريع: الترايجر ما كان يكتب جدول المجمّع بصلاحية anon
--  يلصق كامل في Supabase → SQL Editor → Run (وحده، بدون باقي الملف)
--
--  العَرَض: النقاط تروح للوحة العامة بس، وتبويب اللعبة يبقى فاضي.
--  السبب: game_points_credit() كان security invoker، فـ insert game_leaderboard
--  داخل الترايجر كان يُرفض بـ 42501 ويرجّع كل سطر game_points معه.
-- ============================================================================

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

-- فحص بعد التنفيذ (لازم يطلع definer):
--   select provname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='game_points_credit';
