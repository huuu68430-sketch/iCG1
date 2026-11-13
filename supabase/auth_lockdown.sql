-- ============================================================================
--  iCG1 — إغلاق باب قاعدة البيانات أمام المتصفح (هامش الأمان)
--  شغّل هذا الملف مرة واحدة في: Supabase → SQL Editor → New query → Run
--
--  لماذا؟ المفتاح المنشور في حزمة الموقع (VITE_SUPABASE_ANON_KEY / publishable)
--  كان يقرأ ويكتب جداول حسّاسة كأنه مفتاح إداري:
--    • app_config: كلمة سر الإدارة كانت تُقرأ من المتصفح — وتُكتب منه أيضاً!
--    • users: تجزئات كلمات سر كل الأعضاء (200 حساب) كانت تُقرأ وتُكتب،
--      وأي زائر كان يستطيع تغيير كلمة سر أي عضو أو حذف حسابه.
--    • profiles: حقول الإشراف (حظر/رصيد/عضوية) كانت قابلة للتعديل من المتصفح.
--
--  بعد هذا الإغلاق: المتصفح يقرأ ما يراه فقط، وكل كتابة حسّاسة تمرّ عبر
--  /api/* في السيرفر (service key). الشيفرة في المستودع معدّة أصلاً لذلك.
--
--  ملاحظة: هذا الملف آمن للتشغيل المتكرّر (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) جدول الأسرار: app_config (كلمة سر الإدارة، كلمة سر المضيف…)
--    كان ANY زائر يقرأه بالمفتاح المنشور، بل يغيّر كلمة سر الإدارة.
--    من الآن: service_role وحده.
-- ---------------------------------------------------------------------------
revoke all on table public.app_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) جدول الحسابات: users
--    المتصفح يحتاج: الملف العام (الاسم والصورة والنقاط) وتحديث الصورة/النقاط/الاسم.
--    لا يحتاج أبداً: التجزئات (password_hash) ولا الإدراج (التسجيل صار في
--    /api/auth/register) ولا الحذف.
-- ---------------------------------------------------------------------------
revoke all on table public.users from anon, authenticated;

grant select (id, kick_username, display_name, discord, avatar, is_verified, points, created_at, updated_at)
  on public.users to anon, authenticated;
grant update (avatar, points, display_name)
  on public.users to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) جدول الملفات الشخصية: profiles
--    حقول الإشراف (is_banned, credits, admin_note, membership) صارت للسيرفر وحده:
--    المنع والرصيد والعضوية يكتبها مركز التحكم عبر /api/admin/mutate.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant insert (username, avatar_url, credits)
  on public.profiles to anon, authenticated;
grant update (avatar_url, daily_streak, last_daily_claim, active_frame_id, active_frame_url)
  on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) فحص سريع (اختياري): يجب أن يعيد الاستعلام следу القيم
--    ولا شيء غيره.
-- ---------------------------------------------------------------------------
-- select table_name, grantee, privilege_type, string_agg(column_name, ',')
--   from information_schema.column_privileges
--  where table_schema = 'public' and table_name in ('users','app_config','profiles')
--    and grantee in ('anon','authenticated')
--  group by 1,2,3 order by 1,2,3;

-- ============================================================================
--  ملاحظات لما لم يُقفل هنا (خارج نطاق الحساب) — للاطلاع:
--  • جدول leaderboard: المتصفح ما زال يحدّث نقطته (POST من المتصفح).
--    نقترح نقلها إلى /api/game/score مثل restoeconomy.
--  • جدول transactions: يكتبه المتصفح أيضاً (المكافأة اليومية).
--  • جدول sessions/app_config: يقرأهما السيرفر فقط ✔
-- ============================================================================
