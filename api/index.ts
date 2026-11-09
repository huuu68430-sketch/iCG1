// مؤقت: عزل — مسار واحد فقط، استيراد واحد، كتابة خام (بدون res.json).
import creatorsLeaderboard from '../server/handlers/creators/leaderboard';

export default function handler(req: any, res: any) {
  const route = typeof req.query?.route === 'string' ? '/' + req.query.route : '/';
  if (route !== '/creators/leaderboard') {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  try {
    const maybe = creatorsLeaderboard(req, res);
    if (maybe && typeof (maybe as any).catch === 'function') {
      (maybe as any).catch((e: any) => {
        try {
          if (!(res as any).headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Service error', detail: String(e?.message || e) }));
          }
        } catch { /* */ }
      });
    }
  } catch (e: any) {
    if (!(res as any).headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Service error', detail: String(e?.message || e) }));
    }
  }
}
