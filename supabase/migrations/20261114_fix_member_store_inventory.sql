-- Allow profile-only members to own frames and enforce one equipped frame by username.
alter table public.user_frames alter column user_id drop not null;

drop index if exists public.user_frames_one_equipped;
create unique index user_frames_one_equipped
  on public.user_frames (username)
  where is_equipped;

-- Make the migration safe when applied after the current setup scripts.
create or replace function public.equip_frame(p_username text, p_frame_id text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_user text := lower(btrim(p_username));
begin
  if not exists (select 1 from public.user_frames where lower(username) = v_user and frame_id = p_frame_id) then
    raise exception 'لا تملك هذا المقتنى';
  end if;
  update public.user_frames set is_equipped = false where lower(username) = v_user and is_equipped;
  update public.user_frames set is_equipped = true where lower(username) = v_user and frame_id = p_frame_id;
  update public.profiles set active_frame_id = p_frame_id, active_frame_url = null where lower(username) = v_user;
  return p_frame_id;
end $$;

grant execute on function public.equip_frame(text, text) to anon, authenticated, service_role;
