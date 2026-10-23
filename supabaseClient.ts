import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ============================================================
//  عميل آمن: لو مفاتيح Supabase ناقصة (مثلاً بناء بدون .env في
//  Vercel)، لا نرمي خطأ أبداً — نرجع عميلاً وهمياً يمتص كل
//  الاستدعاءات (from/auth/...) ويحل بنتيجة فارغة.
//  هذا يمنع الشاشة السوداء: الموقع يعمل بمحتوى افتراضي.
//  (قبل هذا الإصلاح: createClient('', '') كان يرمي
//  "supabaseUrl is required" لحظة الاستيراد فيموت التطبيق كله)
// ============================================================
function createDisabledClient(): SupabaseClient {
  const result = {
    data: null,
    error: { message: 'Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)' },
  };
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      // thenable حتى يعمل await supabase.from(...)... بدون تعليق
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result);
      if (typeof prop === 'symbol') return undefined;
      return proxy;
    },
    apply() {
      return proxy;
    },
  };
  const proxy: any = new Proxy(() => {}, handler);
  return proxy as SupabaseClient;
}

export const supabase: SupabaseClient =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : createDisabledClient();

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — running without database (defaults shown, no black screen).',
  );
}
