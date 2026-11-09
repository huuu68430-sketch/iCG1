// Server-side Supabase client (service role). NEVER import in frontend.
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const url = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');

// لا نرمي هنا أبدًا: استثناء عند التحميل = 500 لجميع المسارات حتى آخر موقع.
// نستخدم عميلًا بديلًا يعمل بهدوء — الاستعلامات ستفشل بشكل نظيف بدل إسقاط الدالة.
function makeClient(): any {
  try {
    if (url && key && /^https?:\/\//.test(url)) {
      return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: 'public' },
      });
    }
  } catch {
    /* يسقط للبديل أدناه */
  }
  return createClient('https://placeholder.supabase.co', 'placeholder', {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
}

export const supabaseAdmin: any = makeClient();

export const isSupabaseConfigured = !!(url && key && /^https?:\/\//.test(url));
