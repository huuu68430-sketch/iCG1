// دالة موحّدة لجميع مسارات /api.
// السبب: حدّ الخطة المجانية في Vercel = 12 دالة خادم كحد أقصى، والموقع فيه 21 نقطة نهاية.
// بدل 21 ملفًا (كلٌّ دالة)، هنا ملف واحد يستقبل /api/* كلها ويوجّه حسب المسار.
// المعالجات نفسها لم تتغير — سكنت في api/_handlers/ (البادئة _ تمنع Vercel من حسابها دوالًا).
// التحميل كسول (lazy) لكل معالج: فشل استيراد واحد لا يقتل البقية،
// ولا يمنع مسارًا لا يحتاج القاعدة (مثل وسيط Creators) من العمل.

type Handler = (req: any, res: any) => any;

const LOADERS: Record<string, () => Promise<Handler>> = {
  '/me': () => import('./_handlers/me').then(m => m.default),
  '/logout': () => import('./_handlers/logout').then(m => m.default),

  '/admin/data': () => import('./_handlers/admin/data').then(m => m.default),
  '/admin/export': () => import('./_handlers/admin/export').then(m => m.default),
  '/admin/login': () => import('./_handlers/admin/login').then(m => m.default),
  '/admin/logout': () => import('./_handlers/admin/logout').then(m => m.default),
  '/admin/me': () => import('./_handlers/admin/me').then(m => m.default),
  '/admin/mutate': () => import('./_handlers/admin/mutate').then(m => m.default),
  '/admin/player': () => import('./_handlers/admin/player').then(m => m.default),

  '/auth/chat-verify-issue': () => import('./_handlers/auth/chat-verify-issue').then(m => m.default),
  '/auth/chat-verify': () => import('./_handlers/auth/chat-verify').then(m => m.default),
  '/auth/login': () => import('./_handlers/auth/login').then(m => m.default),
  '/auth/register': () => import('./_handlers/auth/register').then(m => m.default),

  '/kick/callback': () => import('./_handlers/kick/callback').then(m => m.default),
  '/kick/login': () => import('./_handlers/kick/login').then(m => m.default),

  '/user/announcements': () => import('./_handlers/user/announcements').then(m => m.default),
  '/user/notifications': () => import('./_handlers/user/notifications').then(m => m.default),
  '/user/promo': () => import('./_handlers/user/promo').then(m => m.default),
  '/user/reports': () => import('./_handlers/user/reports').then(m => m.default),
  '/user/session': () => import('./_handlers/user/session').then(m => m.default),
  '/user/store': () => import('./_handlers/user/store').then(m => m.default),
  '/user/tickets': () => import('./_handlers/user/tickets').then(m => m.default),
  '/user/tournaments': () => import('./_handlers/user/tournaments').then(m => m.default),

  '/creators/leaderboard': () => import('./_handlers/creators/leaderboard').then(m => m.default),
};

export default async function handler(req: any, res: any) {
  // قاعدة vercel.json توجّه /api/(.*) إلى هنا مع ?route=(المسار الفرعي)
  const route = typeof req.query?.route === 'string' ? '/' + req.query.route : '/';
  const load = LOADERS[route];
  if (!load) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const target: Handler = await load();
    return target(req, res);
  } catch (e: any) {
    console.error('[api]', route, e?.message || e);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Service error' });
    }
  }
}
