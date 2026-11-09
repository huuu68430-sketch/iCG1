// دالة موحّدة لجميع مسارات /api (دالة واحدة فقط — حدّ الخطة المجانية 12).
// قاعدة vercel.json توجّه /api/(.*) إلى هنا مع ?route=(المسار الفرعي).
// كل الواردات ثابتة داخل api/ (Vercel لا يضمّن ملفات خارج api/).

import me from './_handlers/me';
import logout from './_handlers/logout';

import adminData from './_handlers/admin/data';
import adminExport from './_handlers/admin/export';
import adminLogin from './_handlers/admin/login';
import adminLogout from './_handlers/admin/logout';
import adminMe from './_handlers/admin/me';
import adminMutate from './_handlers/admin/mutate';
import adminPlayer from './_handlers/admin/player';

import chatVerifyIssue from './_handlers/auth/chat-verify-issue';
import chatVerify from './_handlers/auth/chat-verify';
import authLogin from './_handlers/auth/login';
import authRegister from './_handlers/auth/register';

import kickCallback from './_handlers/kick/callback';
import kickLogin from './_handlers/kick/login';

import announcements from './_handlers/user/announcements';
import notifications from './_handlers/user/notifications';
import promo from './_handlers/user/promo';
import reports from './_handlers/user/reports';
import session from './_handlers/user/session';
import store from './_handlers/user/store';
import tickets from './_handlers/user/tickets';
import tournaments from './_handlers/user/tournaments';

import creatorsLeaderboard from './_handlers/creators/leaderboard';

const routes: Record<string, (req: any, res: any) => any> = {
  '/me': me,
  '/logout': logout,

  '/admin/data': adminData,
  '/admin/export': adminExport,
  '/admin/login': adminLogin,
  '/admin/logout': adminLogout,
  '/admin/me': adminMe,
  '/admin/mutate': adminMutate,
  '/admin/player': adminPlayer,

  '/auth/chat-verify-issue': chatVerifyIssue,
  '/auth/chat-verify': chatVerify,
  '/auth/login': authLogin,
  '/auth/register': authRegister,

  '/kick/callback': kickCallback,
  '/kick/login': kickLogin,

  '/user/announcements': announcements,
  '/user/notifications': notifications,
  '/user/promo': promo,
  '/user/reports': reports,
  '/user/session': session,
  '/user/store': store,
  '/user/tickets': tickets,
  '/user/tournaments': tournaments,

  '/creators/leaderboard': creatorsLeaderboard,
};

export default function handler(req: any, res: any) {
  const wrapped = wrapRes(res);
  const route = typeof req.query?.route === 'string' ? '/' + req.query.route : '/';
  const target = routes[route];
  if (!target) {
    return wrapped.status(404).json({ error: 'Not found' });
  }
  try {
    return target(req, wrapped);
  } catch (e: any) {
    console.error('[api]', route, e?.message || e);
    if (!(res as any).headersSent) return wrapped.status(500).json({ error: 'Service error' });
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
