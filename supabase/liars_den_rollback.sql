-- ============================================================================
--  iCG1 — تراجع كامل عن حانة الكذابين (اختياري)
--  يحذف الدوال والجداول والـview، ويسحب لعبة LIARS_DEN من الكتالوج.
--  لا يمس أي جدول آخر. نفّذه فقط إذا أردت إزالة الميزة بالكامل.
-- ============================================================================

drop function if exists public.ld_close_room(text, text);
drop function if exists public.ld_finish_match(text, text, uuid, integer, jsonb, integer);
drop function if exists public.ld_start_match(text, text, uuid);
drop function if exists public.ld_host_drop_seat(text, text, integer);
drop function if exists public.ld_host_secrets(text, text);
drop function if exists public.ld_leave_seat(text, text, text, text);
drop function if exists public.ld_claim_seat(text, text, text, text, integer);
drop function if exists public.ld_get_room(text);
drop function if exists public.ld_create_room(text, text, text);
drop function if exists public.ld_host_ok(text, text);
drop function if exists public.ld_safe_name(text, text);

drop view if exists public.ld_rooms_live;
drop table if exists public.ld_matches;
drop table if exists public.ld_rooms;

delete from public.games where view_id = 'LIARS_DEN';

-- ملاحظة: صفوف game_points/game_leaderboard/leaderboard الخاصة باللعبة تبقى
-- كتاريخ نقاط اللاعبين. لحذفها أيضاً:
-- delete from public.game_points where game_code = 'LIARS_DEN';
-- delete from public.game_leaderboard where game_code = 'LIARS_DEN';
