// دالة موحّدة لجميع مسارات /api.
// السبب: حدّ الخطة المجانية في Vercel = 12 دالة خادم كحد أقصى، والموقع فيه 21 نقطة نهاية.
// بدل 21 ملفًا (كلٌّ دالة)، هنا ملف واحد يستقبل /api/* كلها ويوجّه حسب المسار.
// المعالجات نفسها لم تتغير — سكنت في api/_handlers/ (البادئة _ تمنع Vercel من حسابها دوالًا).

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

export default async function handler(req: any, res: any) {
  const seg = req.query?.path;
  const pathname = Array.isArray(seg) ? '/' + seg.join('/') : '/';
  const target = routes[pathname];
  if (!target) {
    return res.status(404).json({ error: 'Not found' });
  }
  return target(req, res);
}
