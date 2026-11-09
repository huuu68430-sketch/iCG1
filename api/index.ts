// دالة موحّدة لجميع مسارات /api — دالة واحدة فقط (الخطة المجانية: 12 كحد أقصى).
// المعالجات تسكن في server/handlers/ (خارج api/، فلا تُحسب دوالًا، ولا تدخل في استثناء
// الملفات التي تبدأ بـ _ التي تستبعدها Vercel من الحزم — سبب 500 سابقًا).

import me from '../server/handlers/me';
import logout from '../server/handlers/logout';

import adminData from '../server/handlers/admin/data';
import adminExport from '../server/handlers/admin/export';
import adminLogin from '../server/handlers/admin/login';
import adminLogout from '../server/handlers/admin/logout';
import adminMe from '../server/handlers/admin/me';
import adminMutate from '../server/handlers/admin/mutate';
import adminPlayer from '../server/handlers/admin/player';

import chatVerifyIssue from '../server/handlers/auth/chat-verify-issue';
import chatVerify from '../server/handlers/auth/chat-verify';
import authLogin from '../server/handlers/auth/login';
import authRegister from '../server/handlers/auth/register';

import kickCallback from '../server/handlers/kick/callback';
import kickLogin from '../server/handlers/kick/login';

import announcements from '../server/handlers/user/announcements';
import notifications from '../server/handlers/user/notifications';
import promo from '../server/handlers/user/promo';
import reports from '../server/handlers/user/reports';
import session from '../server/handlers/user/session';
import store from '../server/handlers/user/store';
import tickets from '../server/handlers/user/tickets';
import tournaments from '../server/handlers/user/tournaments';

import creatorsLeaderboard from '../server/handlers/creators/leaderboard';

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
  ensureRes(res);
  // قاعدة vercel.json توجّه /api/(.*) إلى هنا مع ?route=(المسار الفرعي)
  const route = typeof req.query?.route === 'string' ? '/' + req.query.route : '/';
  const target = routes[route];
  if (!target) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    return target(req, res);
  } catch (e: any) {
    console.error('[api]', route, e?.message || e);
    if (!res.headersSent) return res.status(500).json({ error: 'Service error' });
  }
}

/**
 * طبقة توافق كاملة لـ Node res (منصة واحدة لا توفّر res.status/json):
 * نكتب ترويسة + JSON صراحةً، وإن وُجدت الأدوات أصلًا لا نمسّها.
 */
function ensureRes(res: any) {
  if (!res || typeof res !== 'object' || res.__icg1Shim) return res;
  if (typeof res.json !== 'function') {
    const origSetHeader = typeof res.setHeader === 'function' ? res.setHeader.bind(res) : null;
    const origWriteHead = typeof res.writeHead === 'function' ? res.writeHead.bind(res) : null;
    res.status = function (code: number) { res.statusCode = code; return res; };
    res.json = function (obj: any) {
      try {
        if (!res.headersSent) {
          if (origWriteHead) res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json; charset=utf-8' });
          else { res.statusCode = res.statusCode || 200; if (origSetHeader) origSetHeader('Content-Type', 'application/json; charset=utf-8'); }
        }
        res.end(JSON.stringify(obj));
      } catch { /* انتهى الرد */ }
      return res;
    };
    if (!origSetHeader) {
      res.setHeader = function (k: string, v: any) {
        try { res[k] = v; } catch { /* */ }
        return res;
      };
    }
  }
  res.__icg1Shim = true;
  return res;
}
