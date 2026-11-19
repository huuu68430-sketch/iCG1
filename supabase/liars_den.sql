-- ============================================================================
--  iCG1 — حانة الكذابين (LIARS_DEN): غرف ومباريات ونقاط
--  يُلصق كاملاً في Supabase → SQL Editor. آمن للتكرار (idempotent).
--
--  المبدأ:
--    • لا تُكتب حركات اللعب في القاعدة إطلاقاً — القناة (Broadcast) تحمل الحالة.
--    • هذه الجداول للهوية والمقاعد ونتيجة المباراة فقط.
--    • الجداول RPC-only: لا صلاحية مباشرة لـ anon، والدوال SECURITY DEFINER.
--    • هوية العضو تُثبت بنفس دالة المافيا mafia_verify (كلمة السر، والحظر).
--    • المقعد يحمل توكن سري يُرجَع مرة واحدة في رد RPC، والقناة الخاصة تُشتق منه.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 1) الغرف (صف واحد لكل غرفة نشطة/مغلقة)
-- ----------------------------------------------------------------------------
create table if not exists public.ld_rooms (
  code        text        primary key,
  host_handle text        not null,
  host_th     text        not null,
  status      text        not null default 'lobby' check (status in ('lobby','playing','closed')),
  seats       jsonb       not null default '[null,null,null,null]'::jsonb,
  match_id    uuid,
  start_uids  text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '6 hours'
);

create index if not exists ld_rooms_host_idx on public.ld_rooms (host_handle, updated_at desc);
create index if not exists ld_rooms_live_idx on public.ld_rooms (status, updated_at desc);

-- ----------------------------------------------------------------------------
-- 2) المباريات المنتهية — مفتاح التكرار (idempotency) لكل نقاط
-- ----------------------------------------------------------------------------
create table if not exists public.ld_matches (
  id          uuid        primary key,
  room_code   text        not null,
  winner_seat integer     not null,
  winner      text,
  players     jsonb       not null default '[]'::jsonb,
  rounds      integer     not null default 0,
  finished_at timestamptz not null default now()
);

create index if not exists ld_matches_room_idx on public.ld_matches (room_code, finished_at desc);

alter table public.ld_rooms   enable row level security;
alter table public.ld_matches enable row level security;

-- لا سياسة ولا صلاحية مباشرة: كل الوصول عبر الدوال فقط
revoke all on public.ld_rooms   from anon, authenticated;
revoke all on public.ld_matches from anon, authenticated;

-- مفتاح الخدمة (الخادم) يكتب الغرف عند استضافة الإداري بلا حساب عضو —
-- نفس عرف مركز التحكم: منح صريح حتى لا يعتمد على صلاحيات افتراضية متغيّرة.
grant all on public.ld_rooms   to service_role;
grant all on public.ld_matches to service_role;

-- ----------------------------------------------------------------------------
-- 3) كشف الغرف النشطة (للّوحة العضو) — أعمدة عامة بلا أسرار
-- ----------------------------------------------------------------------------
create or replace view public.ld_rooms_live as
select
  r.code,
  r.status,
  r.updated_at,
  r.expires_at,
  (select count(*)::int from jsonb_array_elements(r.seats) s where s <> 'null'::jsonb) as players,
  r.host_handle
from public.ld_rooms r
where r.status <> 'closed' and r.expires_at > now();

grant select on public.ld_rooms_live to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) أدوات صغيرة
-- ----------------------------------------------------------------------------
create or replace function public.ld_safe_name(p_raw text, p_fallback text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(left(btrim(regexp_replace(regexp_replace(coalesce(p_raw, ''), '[[:cntrl:]]', '', 'g'),
                                    '[<>&"''/\\]', '', 'g')), 14), ''),
    nullif(left(btrim(coalesce(p_fallback, '')), 14), '')
  )
$$;

create or replace function public.ld_host_ok(p_code text, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.ld_rooms r
    where r.code = upper(btrim(p_code))
      and r.status <> 'closed'
      and r.expires_at > now()
      and r.host_th = encode(digest(btrim(p_token), 'sha256'), 'hex')
  )
$$;

revoke all on function public.ld_safe_name(text, text) from public;
revoke all on function public.ld_host_ok(text, text) from public;
grant execute on function public.ld_host_ok(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) إنشاء الغرفة (هوست مسجّل — تحقّق كلمة السر عبر mafia_verify)
--    التوكن العشوائي غير القابل للتخمين، ومعه UUID للمباراة الأولى.
-- ----------------------------------------------------------------------------
create or replace function public.ld_create_room(
  p_handle text,
  p_nonce  text,
  p_token  text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_token text;
  v_i int;
  attempt int;
begin
  if v_handle = '' or not public.mafia_verify(v_handle, 'LD-CREATE', p_nonce, p_token) then
    raise exception 'bad_identity';
  end if;

  -- تنظيف بسيط: غرف مغلقة قديمة (على دفعات حتى لا يثقل)
  delete from public.ld_rooms
   where ctid in (
     select ctid from public.ld_rooms
      where status = 'closed' and updated_at < now() - interval '1 day'
      limit 20
   );

  update public.ld_rooms
     set status = 'closed', updated_at = now()
   where host_handle = v_handle and status <> 'closed';

  for attempt in 1..20 loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.ld_rooms where code = v_code);
    v_code := null;
  end loop;
  if v_code is null then raise exception 'code_exhausted'; end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.ld_rooms (code, host_handle, host_th, status)
  values (v_code, v_handle, encode(digest(v_token, 'sha256'), 'hex'), 'lobby');

  return jsonb_build_object(
    'code', v_code,
    'host_token', v_token,
    'expires_at', (now() + interval '6 hours')
  );
end;
$$;

revoke all on function public.ld_create_room(text, text, text) from public;
grant execute on function public.ld_create_room(text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) قراءة الغرفة (بدون أسرار) — للهاتف قبل الانضمام وللمشاهد
-- ----------------------------------------------------------------------------
create or replace function public.ld_get_room(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_room public.ld_rooms;
  v_seats jsonb := '[]'::jsonb;
  v_i int;
  v_s jsonb;
begin
  select * into v_room from public.ld_rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'room_not_found'; end if;
  if v_room.status = 'closed' then raise exception 'room_closed'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;

  for v_i in 0..3 loop
    v_s := v_room.seats -> v_i;
    if v_s is null or v_s = 'null'::jsonb then
      v_seats := v_seats || jsonb_build_array(jsonb_build_object('taken', false));
    else
      v_seats := v_seats || jsonb_build_array(
        jsonb_build_object('taken', true, 'n', v_s ->> 'n'));
    end if;
  end loop;

  return jsonb_build_object(
    'code', v_room.code,
    'status', v_room.status,
    'match_id', v_room.match_id,
    'seats', v_seats
  );
end;
$$;

revoke all on function public.ld_get_room(text) from public;
grant execute on function public.ld_get_room(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7) حجز/استعادة مقعد — التوكن يُرجَع في رد RPC فقط (لا يمرّ على القناة)
--    p_seat = -1 تعني «استعد مقعدي إن وُجد» (بعد إعادة تحميل الهاتف).
-- ----------------------------------------------------------------------------
create or replace function public.ld_claim_seat(
  p_code   text,
  p_handle text,
  p_nonce  text,
  p_token  text,
  p_seat   integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_room   public.ld_rooms;
  v_seats  jsonb;
  v_cur    jsonb;
  v_name   text;
  v_seat   int := coalesce(p_seat, -1);
  v_new    text;
  v_th     text;
  v_found  int := -1;
  v_i      int;
  v_s      jsonb;
begin
  if v_handle = '' or not public.mafia_verify(v_handle, v_code, p_nonce, p_token) then
    raise exception 'bad_identity';
  end if;

  select * into v_room from public.ld_rooms where code = v_code for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.status = 'closed' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;

  v_seats := coalesce(v_room.seats, '[null,null,null,null]'::jsonb);

  for v_i in 0..3 loop
    v_s := v_seats -> v_i;
    if v_s is not null and v_s <> 'null'::jsonb and lower(v_s ->> 'u') = v_handle then
      v_found := v_i;
    end if;
  end loop;

  if v_seat < 0 then
    if v_found < 0 then
      return jsonb_build_object('seat', null, 'status', v_room.status);
    end if;
    v_seat := v_found;
  elsif v_seat > 3 then
    raise exception 'bad_seat';
  end if;

  v_cur := v_seats -> v_seat;
  if v_cur is not null and v_cur <> 'null'::jsonb and lower(v_cur ->> 'u') <> v_handle then
    raise exception 'seat_taken';
  end if;

  if v_room.status = 'playing' and v_found < 0 then
    raise exception 'match_started';
  end if;
  if v_room.status = 'playing' and v_found >= 0 and v_found <> v_seat then
    raise exception 'match_started';
  end if;

  select public.ld_safe_name(u.display_name, u.kick_username)
    into v_name
    from public.users u
   where lower(u.kick_username) = v_handle
   limit 1;

  if v_name is null then v_name := public.ld_safe_name(v_handle, 'لاعب'); end if;

  if v_found >= 0 and v_found <> v_seat then
    v_seats := jsonb_set(v_seats, array[v_found::text], 'null'::jsonb, true);
  end if;

  v_new := encode(gen_random_bytes(24), 'hex');
  v_th  := encode(digest(v_new, 'sha256'), 'hex');

  v_seats := jsonb_set(v_seats, array[v_seat::text],
    jsonb_build_object(
      'u', v_handle,
      'n', v_name,
      't', v_new,
      'th', v_th,
      'tp', left(v_th, 24)
    ), true);

  update public.ld_rooms set seats = v_seats, updated_at = now() where code = v_code;

  return jsonb_build_object(
    'seat', v_seat,
    'name', v_name,
    'token', v_new,
    'topic', left(v_th, 24),
    'status', v_room.status,
    'match_id', v_room.match_id
  );
end;
$$;

revoke all on function public.ld_claim_seat(text, text, text, text, integer) from public;
grant execute on function public.ld_claim_seat(text, text, text, text, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8) مغادرة المقعد
-- ----------------------------------------------------------------------------
create or replace function public.ld_leave_seat(
  p_code   text,
  p_handle text,
  p_nonce  text,
  p_token  text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_seats  jsonb;
  v_i      int;
  v_s      jsonb;
  v_left   int := -1;
begin
  if v_handle = '' or not public.mafia_verify(v_handle, v_code, p_nonce, p_token) then
    raise exception 'bad_identity';
  end if;

  select seats into v_seats from public.ld_rooms where code = v_code for update;
  if v_seats is null then raise exception 'room_not_found'; end if;

  for v_i in 0..3 loop
    v_s := v_seats -> v_i;
    if v_s is not null and v_s <> 'null'::jsonb and lower(v_s ->> 'u') = v_handle then
      v_seats := jsonb_set(v_seats, array[v_i::text], 'null'::jsonb, true);
      v_left := v_i;
    end if;
  end loop;

  if v_left >= 0 then
    update public.ld_rooms set seats = v_seats, updated_at = now() where code = v_code;
  end if;

  return jsonb_build_object('ok', true, 'seat', case when v_left >= 0 then v_left end);
end;
$$;

revoke all on function public.ld_leave_seat(text, text, text, text) from public;
grant execute on function public.ld_leave_seat(text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9) أسرار المقاعد للهوست (توكنات الإرسال إلى القنوات الخاصة)
-- ----------------------------------------------------------------------------
create or replace function public.ld_host_secrets(p_code text, p_host_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_room public.ld_rooms;
  v_out  jsonb := '[]'::jsonb;
  v_i    int;
  v_s    jsonb;
begin
  if not public.ld_host_ok(v_code, p_host_token) then raise exception 'bad_host'; end if;

  select * into v_room from public.ld_rooms where code = v_code;
  if not found then raise exception 'room_not_found'; end if;

  for v_i in 0..3 loop
    v_s := v_room.seats -> v_i;
    if v_s is null or v_s = 'null'::jsonb then
      v_out := v_out || jsonb_build_array(jsonb_build_object('seat', v_i, 'taken', false));
    else
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'seat', v_i, 'taken', true, 'u', v_s ->> 'u', 'n', v_s ->> 'n',
        'token', v_s ->> 't', 'topic', v_s ->> 'tp'));
    end if;
  end loop;

  return jsonb_build_object(
    'code', v_room.code,
    'status', v_room.status,
    'match_id', v_room.match_id,
    'seats', v_out
  );
end;
$$;

revoke all on function public.ld_host_secrets(text, text) from public;
grant execute on function public.ld_host_secrets(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10) طرد مقعد من الهوست (تعطّل / انقطاع طويل)
-- ----------------------------------------------------------------------------
create or replace function public.ld_host_drop_seat(
  p_code text, p_host_token text, p_seat integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_seats jsonb;
begin
  if not public.ld_host_ok(v_code, p_host_token) then raise exception 'bad_host'; end if;
  if p_seat is null or p_seat < 0 or p_seat > 3 then raise exception 'bad_seat'; end if;

  select seats into v_seats from public.ld_rooms where code = v_code for update;
  if v_seats is null then raise exception 'room_not_found'; end if;
  v_seats := jsonb_set(v_seats, array[p_seat::text], 'null'::jsonb, true);
  update public.ld_rooms set seats = v_seats, updated_at = now() where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ld_host_drop_seat(text, text, integer) from public;
grant execute on function public.ld_host_drop_seat(text, text, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11) بدء مباراة: لقطةٌ من المقاعد البشرية في هذه اللحظة (start_uids)
-- ----------------------------------------------------------------------------
create or replace function public.ld_start_match(
  p_code text, p_host_token text, p_match_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_room public.ld_rooms;
  v_seats jsonb;
  v_uids text[] := array[null::text, null::text, null::text, null::text];
  v_i int;
  v_s jsonb;
  v_humans int := 0;
begin
  if p_match_id is null then raise exception 'bad_match'; end if;
  if not public.ld_host_ok(v_code, p_host_token) then raise exception 'bad_host'; end if;

  select * into v_room from public.ld_rooms where code = v_code for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.status = 'closed' then raise exception 'room_closed'; end if;

  if v_room.status = 'playing' and v_room.match_id = p_match_id then
    return jsonb_build_object('ok', true, 'match_id', v_room.match_id, 'duplicate', true);
  end if;

  v_seats := coalesce(v_room.seats, '[null,null,null,null]'::jsonb);
  for v_i in 0..3 loop
    v_s := v_seats -> v_i;
    if v_s is not null and v_s <> 'null'::jsonb and coalesce(v_s ->> 'u', '') <> '' then
      v_uids[v_i + 1] := lower(v_s ->> 'u');
      v_humans := v_humans + 1;
    end if;
  end loop;

  update public.ld_rooms
     set status = 'playing', match_id = p_match_id, start_uids = v_uids, updated_at = now()
   where code = v_code;

  return jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'humans', v_humans,
    'start_uids', to_jsonb(v_uids)
  );
end;
$$;

revoke all on function public.ld_start_match(text, text, uuid) from public;
grant execute on function public.ld_start_match(text, text, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12) إنهاء المباراة وحساب النقاط — مرة واحدة لكل match_id
--     p_round_wins: مصفوفة 4 أعداد (نداءات صحيحة لكل مقعد)
-- ----------------------------------------------------------------------------
create or replace function public.ld_finish_match(
  p_code text,
  p_host_token text,
  p_match_id uuid,
  p_winner_seat integer,
  p_round_wins jsonb,
  p_rounds integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_room public.ld_rooms;
  v_uids text[];
  v_humans int := 0;
  v_i int;
  v_name text;
  v_win_name text;
  v_counts int[] := array[0,0,0,0];
  v_total int := 0;
  v_awards jsonb := '[]'::jsonb;
  v_players jsonb := '[]'::jsonb;
  v_pts int;
  v_rounds int := greatest(0, least(coalesce(p_rounds, 0), 60));
  v_ins int;
  v_j int;
begin
  if p_match_id is null then raise exception 'bad_match'; end if;
  if not public.ld_host_ok(v_code, p_host_token) then raise exception 'bad_host'; end if;

  select * into v_room from public.ld_rooms where code = v_code for update;
  if not found then raise exception 'room_not_found'; end if;

  if exists (select 1 from public.ld_matches where id = p_match_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if v_room.status <> 'playing' or v_room.match_id is distinct from p_match_id then
    raise exception 'stale_match';
  end if;

  v_uids := coalesce(v_room.start_uids, array[null::text, null::text, null::text, null::text]);
  for v_i in 1..4 loop
    if coalesce(v_uids[v_i], '') <> '' then v_humans := v_humans + 1; end if;
    v_counts[v_i] := greatest(0, least(coalesce((p_round_wins ->> (v_i - 1))::int, 0), 30));
    v_total := v_total + v_counts[v_i];
  end loop;
  if v_total > 60 then
    -- لا نقاط لسجل مبالغ فيه — تُسجَّل المباراة بلا مكافآت
    v_counts := array[0,0,0,0];
  end if;

  v_win_name := case when p_winner_seat between 0 and 3 then v_uids[p_winner_seat + 1] end;
  if v_win_name = '' then v_win_name := null; end if;

  insert into public.ld_matches (id, room_code, winner_seat, winner, players, rounds)
  values (p_match_id, v_code, coalesce(p_winner_seat, -1), v_win_name, '[]'::jsonb, v_rounds)
  on conflict (id) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if v_humans >= 2 then
    if v_win_name is not null then
      insert into public.game_points (game_code, username, points, kind)
      values ('LIARS_DEN', v_win_name, 200, 'match');
      insert into public.leaderboard (username, score, wins, last_win_at)
      values (v_win_name, 200, 1, now())
      on conflict (username) do update
        set score = public.leaderboard.score + 200,
            wins = public.leaderboard.wins + 1,
            last_win_at = now();
      v_pts := 200;
    else
      v_pts := 0;
    end if;

    for v_i in 1..4 loop
      v_name := v_uids[v_i];
      if coalesce(v_name, '') <> '' then
        for v_j in 1..v_counts[v_i] loop
          insert into public.game_points (game_code, username, points, kind)
          values ('LIARS_DEN', v_name, 35, 'round');
        end loop;
        if v_counts[v_i] > 0 then
          insert into public.leaderboard (username, score, wins, last_win_at)
          values (v_name, v_counts[v_i] * 35, 0, now())
          on conflict (username) do update
            set score = public.leaderboard.score + (v_counts[v_i] * 35),
                last_win_at = now();
        end if;
      end if;
      v_awards := v_awards || jsonb_build_array(jsonb_build_object(
        'u', v_name,
        'rounds', v_counts[v_i],
        'points', (case when v_i = p_winner_seat + 1 then 200 else 0 end) + v_counts[v_i] * 35
      ));
      if coalesce(v_name, '') <> '' then
        v_players := v_players || jsonb_build_array(jsonb_build_object(
          'u', v_name, 's', v_i - 1, 'r', v_counts[v_i],
          'p', (case when v_i = p_winner_seat + 1 then 200 else 0 end) + v_counts[v_i] * 35));
      end if;
    end loop;
  end if;

  update public.ld_matches set players = v_players where id = p_match_id;
  update public.ld_rooms set status = 'lobby', updated_at = now() where code = v_code;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'human_count', v_humans,
    'awards', v_awards
  );
end;
$$;

revoke all on function public.ld_finish_match(text, text, uuid, integer, jsonb, integer) from public;
grant execute on function public.ld_finish_match(text, text, uuid, integer, jsonb, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 13) إغلاق الغرفة
-- ----------------------------------------------------------------------------
create or replace function public.ld_close_room(p_code text, p_host_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not public.ld_host_ok(v_code, p_host_token) then
    return jsonb_build_object('ok', false);
  end if;
  update public.ld_rooms set status = 'closed', updated_at = now() where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ld_close_room(text, text) from public;
grant execute on function public.ld_close_room(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 14) سجل اللعبة في كتالوج الألعاب (مركز التحكم يقرأ منه تلقائياً)
--     «جديد» = is_primary، والظهور = is_visible/is_active.
-- ----------------------------------------------------------------------------
insert into public.games (id, view_id, title, position, is_primary, is_visible, is_active) values
  (gen_random_uuid(), 'LIARS_DEN', 'حانة الكذابين', 3, true, true, true)
on conflict (view_id) do nothing;

-- النقاط في جدول المكافآت المشترك:
--   200 للمباراة (الناجي الوحيد)، 35 لكل نداء «كذّاب» صحيح.
