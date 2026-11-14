-- Qualify the inventory frame_id: buy_frame returns a column with that same
-- name, so an unqualified reference inside PL/pgSQL is ambiguous (42702).
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

  if exists (
    select 1 from public.user_frames as uf
    where lower(uf.username) = v_user and uf.frame_id = p_frame_id
  ) then
    raise exception 'تمتلك هذا المقتنى مسبقاً';
  end if;

  if exists (select 1 from public.profiles
             where lower(username) = v_user and membership = 'vip'
               and (membership_expires_at is null or membership_expires_at > now())) then
    select coalesce(discount_pct, 0) into v_disc from public.tiers where id = 'vip';
  end if;

  v_price := greatest(0, round(v_frame.price * (100 - v_disc) / 100.0)::integer);
  if coalesce(v_lb.score, 0) < v_price then
    raise exception 'نقاطك لا تكفي — ينقصك %s نقطة', greatest(0, v_price - coalesce(v_lb.score,0));
  end if;

  v_uid := (select id from public.users where lower(kick_username) = v_user limit 1);

  update public.leaderboard set score = score - v_price, updated_at = now() where id = v_lb.id;
  if v_uid is not null then
    update public.users set points = greatest(0, coalesce(points,0) - v_price), updated_at = now() where id = v_uid;
  end if;
  insert into public.user_frames (user_id, username, frame_id, is_equipped, source)
    values (v_uid, v_user, v_frame.id, false, 'purchase');

  if v_uid is not null then
    insert into public.transactions (user_id, amount, type, description)
      values (v_uid, -v_price, 'PURCHASE', 'شراء: ' || v_frame.name || case when v_disc > 0 then ' (خصم ' || v_disc || '%)' else '' end);
  end if;

  if v_disc > 0 then
    insert into public.audit_logs (admin_username, action, details)
      values ('SYSTEM', 'VIP_DISCOUNT_APPLIED', jsonb_build_object('username', v_user, 'item', v_frame.name, 'discount', v_disc, 'paid', v_price));
  end if;

  return query select v_frame.id, v_price, v_disc, v_lb.score - v_price;
end $$;

grant execute on function public.buy_frame(text, text) to anon, authenticated, service_role;
