// دالة موحّدة لجميع مسارات /api (دالة واحدة فقط — حدّ الخطة المجانية 12).
// قاعدة vercel.json توجّه /api/(.*) إلى هنا مع ?route=(المسار الفرعي).
// كل الواردات ثابتة داخل api/ (Vercel لا يضمّن ملفات خارج api/).
//
// تحميل المعالجات يتم بشكل كسول (dynamic import) — يمنع أي خطأ في وحدة
// مشتركة من إسقاط كل المسارات، ويكشف الخطأ الحقيقي في استجابة JSON.

type Loader = () => Promise<any>;

const loaders: Record<string, Loader> = {
  '/me': () => import('./_handlers/me'),
  '/logout': () => import('./_handlers/logout'),

  '/admin/data': () => import('./_handlers/admin/data'),
  '/admin/export': () => import('./_handlers/admin/export'),
  '/admin/login': () => import('./_handlers/admin/login'),
  '/admin/logout': () => import('./_handlers/admin/logout'),
  '/admin/me': () => import('./_handlers/admin/me'),
  '/admin/mutate': () => import('./_handlers/admin/mutate'),
  '/admin/player': () => import('./_handlers/admin/player'),

  '/auth/chat-verify-issue': () => import('./_handlers/auth/chat-verify-issue'),
  '/auth/chat-verify': () => import('./_handlers/auth/chat-verify'),
  '/auth/login': () => import('./_handlers/auth/login'),
  '/auth/register': () => import('./_handlers/auth/register'),

  '/kick/callback': () => import('./_handlers/kick/callback'),
  '/kick/login': () => import('./_handlers/kick/login'),

  '/user/announcements': () => import('./_handlers/user/announcements'),
  '/user/notifications': () => import('./_handlers/user/notifications'),
  '/user/promo': () => import('./_handlers/user/promo'),
  '/user/reports': () => import('./_handlers/user/reports'),
  '/user/session': () => import('./_handlers/user/session'),
  '/user/store': () => import('./_handlers/user/store'),
  '/user/tickets': () => import('./_handlers/user/tickets'),
  '/user/tournaments': () => import('./_handlers/user/tournaments'),

  '/creators/leaderboard': () => import('./_handlers/creators/leaderboard'),
};

export default async function handler(req: any, res: any) {
  const wrapped = wrapRes(res);
  const route = typeof req.query?.route === 'string' ? '/' + req.query.route : '/';
  const loader = loaders[route];
  if (!loader) {
    return wrapped.status(404).json({ error: 'Not found' });
  }

  let target: any;
  try {
    const mod: any = await loader();
    target = mod?.default ?? mod;
  } catch (e: any) {
    console.error('[api:import]', route, e?.message || e);
    return wrapped.status(500).json({
      error: 'Import failed',
      route,
      detail: String(e?.message || e),
    });
  }

  try {
    return await target(req, wrapped);
  } catch (e: any) {
    console.error('[api]', route, e?.message || e);
    if (!(res as any).headersSent) return wrapped.status(500).json({ error: 'Service error', detail: String(e?.message || e) });
  }
}

/**
 * Totally-safe res.status().json() for handlers — عبر Proxy، دون إسناد على
 * كائن الرد الأصلي إطلاقًا (قد يكون مقفلًا في بعض البيئات). وإن وُجدت
 * الأدوات الأصلية لا نمسّ شيئًا.
 */
function wrapRes(res: any) {
  if (!res || typeof res !== 'object' || res.__icg1Shim) return res;
  if (typeof res.json === 'function' && typeof res.status === 'function') return res;
  const proxied: any = new Proxy(res, {
    get(t, k) {
      if (k === '__icg1Shim') return true;
      if (k === 'status') return (code: number) => { t.statusCode = code; return proxied; };
      if (k === 'json') return (obj: any) => {
        try {
          if (!t.headersSent) t.writeHead(t.statusCode || 200, { 'Content-Type': 'application/json; charset=utf-8' });
          t.end(JSON.stringify(obj));
        } catch { /* انتهى الرد */ }
        return proxied;
      };
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  return proxied;
}
