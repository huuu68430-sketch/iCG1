-- ============================================================================
--  iCG1 — المافيا: التحقق من ملكية حساب Kick عند الانضمام (mafia_verify)
--  ينفّذ مرة واحدة من Supabase → SQL Editor. آمن للتكرار.
--
--  كيف يعمل: الشاشة الكبيرة ترسل «تحدياً» قصير العمر لكل هاتف. الهاتف يحسب
--  token = SHA-256(مفتاح العضو | الغرفة | التحدي) — ومفتاح العضو هو نفس
--  password_hash المخزّن له، أي أن معرفته تستلزم معرفة رقمه السري.
--  هذه الدالة تعيد صح/خطأ فقط، ولا تُرجع أي بيانات عن العضو.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  has_ban boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_banned'
  ) into has_ban;

  if has_ban then
    execute $f$
      create or replace function public.mafia_verify(
        p_handle text, p_room text, p_nonce text, p_token text)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public, extensions, pg_temp
      as $g$
        select u.password_hash is not null
           and length(btrim(p_nonce)) between 8 and 40
           and lower(btrim(p_token)) =
               encode(digest(u.password_hash || '|' || upper(btrim(p_room)) || '|' || btrim(p_nonce), 'sha256'), 'hex')
           and not coalesce(pr.is_banned, false)
        from public.users u
        left join public.profiles pr on lower(pr.username) = lower(btrim(p_handle))
        where lower(u.kick_username) = lower(btrim(p_handle))
      $g$;
    $f$;
  else
    execute $f$
      create or replace function public.mafia_verify(
        p_handle text, p_room text, p_nonce text, p_token text)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public, extensions, pg_temp
      as $g$
        select u.password_hash is not null
           and length(btrim(p_nonce)) between 8 and 40
           and lower(btrim(p_token)) =
               encode(digest(u.password_hash || '|' || upper(btrim(p_room)) || '|' || btrim(p_nonce), 'sha256'), 'hex')
        from public.users u
        where lower(u.kick_username) = lower(btrim(p_handle))
      $g$;
    $f$;
  end if;
end $$;

-- الأدوار العامة لا تحتاج صلاحية تنفيذ؛ anon و authenticated نعم
revoke all on function public.mafia_verify(text, text, text, text) from public;
grant execute on function public.mafia_verify(text, text, text, text) to anon, authenticated;

-- الدالة لا تقرأ جداول بتصفية RLS معقدة، لكنها تبقى definer: نتأكد أن المالك postgres
alter function public.mafia_verify(text, text, text, text) owner to postgres;

-- ---------------------------------------------------------------------------
-- ملاحظة أمنية: أعمدة الجلسات في جدول users لا تُعرض لأي دور مباشر
-- (التحقق كله يتم من داخل الدالة وتعيد صح/خطأ فقط).
-- ---------------------------------------------------------------------------
