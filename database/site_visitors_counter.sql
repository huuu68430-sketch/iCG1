-- ============================================================
--  iCG1 Official — عداد زوار الموقع الدقيق (Site Visitors Counter)
--  مشروع Supabase: https://zhbpiylfogflizpwadhr.supabase.co
-- ============================================================

-- 1) إنشاء جدول إحصائيات الموقع
CREATE TABLE IF NOT EXISTS public.site_stats (
    id INT PRIMARY KEY,
    visits BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2) تصفير العداد من الصفر تماماً (مصفر)
INSERT INTO public.site_stats (id, visits, updated_at)
VALUES (1, 0, timezone('utc'::text, now()))
ON CONFLICT (id) DO UPDATE 
SET visits = 0, 
    updated_at = timezone('utc'::text, now());

-- 3) دالة زيادة العداد التلقائية بدقة ذرية تمنع أي تضارب (Atomic Function)
CREATE OR REPLACE FUNCTION public.increment_site_visitors()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_count BIGINT;
BEGIN
    INSERT INTO public.site_stats (id, visits, updated_at)
    VALUES (1, 1, timezone('utc'::text, now()))
    ON CONFLICT (id) DO UPDATE
    SET visits = public.site_stats.visits + 1,
        updated_at = timezone('utc'::text, now())
    RETURNING visits INTO current_count;

    RETURN current_count;
END;
$$;

-- 4) تفعيل نظام أمان الصفوف (RLS) والسماح للزوار بالقراءة والاستدعاء بأمان
ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;

-- سماح بالقراءة العامة لجميع الزوار
DROP POLICY IF EXISTS "Allow public read on site_stats" ON public.site_stats;
CREATE POLICY "Allow public read on site_stats"
ON public.site_stats FOR SELECT
TO anon, authenticated
USING (true);

-- سماح بالتحديث للعداد
DROP POLICY IF EXISTS "Allow public update on site_stats" ON public.site_stats;
CREATE POLICY "Allow public update on site_stats"
ON public.site_stats FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5) منح الصلاحيات لمفتاح الزوار (anon) والمستخدمين المسجلين (authenticated)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_site_visitors() TO anon, authenticated;
GRANT SELECT, UPDATE, INSERT ON public.site_stats TO anon, authenticated;
