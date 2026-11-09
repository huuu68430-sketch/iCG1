// Server-side Supabase client (service role). NEVER import in frontend.
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const url = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');

// @supabase/supabase-js يبني RealtimeClient عند الإنشاء ويشترط WebSocket أصلي (Node 22+).
// على بيئات أقدم يجب تمرير transport — ودوال الخادم لا تستعمل Realtime إطلاقًا،
// لذا نكتفي ببديل لا يتصل بأي شيء.
const transport: any = (globalThis as any).WebSocket ?? class MockWebSocket {
  constructor() { /* لا يتصل أبدًا — Realtime غير مستخدم في الخادم */ }
  addEventListener() { /* noop */ }
  removeEventListener() { /* noop */ }
  send() { /* noop */ }
  close() { /* noop */ }
};

function baseOpts(): any {
  return {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'public' },
    realtime: { transport },
  };
}

/**
 * لا نرمي هنا أبدًا: استثناء عند التحميل = 500 لجميع المسارات حتى آخر موقع.
 * نستخدم عميلًا بديلًا يعمل بهدوء — الاستعلامات ستفشل بشكل نظيف بدل إسقاط الدالة.
 */
function makeClient(): any {
  try {
    if (url && key && /^https?:\/\//.test(url)) {
      return createClient(url, key, baseOpts());
    }
  } catch {
    /* يسقط للبديل أدناه */
  }
  try {
    return createClient('https://placeholder.supabase.co', 'placeholder', baseOpts());
  } catch {
    // عميل طارئ بسيط: كل استدعاء يعيد وعدًا مرفوضًا بهدوء
    const fail = () => Promise.resolve({ data: null, error: { message: 'supabase unavailable' } });
    return new Proxy({}, { get: () => fail });
  }
}

// إنشاء كسول: لا يُبنى العميل إلا عند أول استعلام فعلي.
let _client: any = null;
function client(): any {
  if (!_client) _client = makeClient();
  return _client;
}

export const supabaseAdmin: any = new Proxy({}, {
  get(_t, prop) {
    const c = client();
    const v = c[prop];
    return typeof v === 'function' ? v.bind(c) : v;
  },
});

export const isSupabaseConfigured = !!(url && key && /^https?:\/\//.test(url));
