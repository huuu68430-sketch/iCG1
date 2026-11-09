// مؤقت: الوسيط مدمج مباشرة (بدون استيرادات) لعزل سبب 500 في Vercel.
export default async function handler(req: any, res: any) {
  const route = typeof req.query?.route === 'string' ? '/' + req.query.route : '/';
  if (route !== '/creators/leaderboard') {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const duration = String(req.query?.duration || 'lifetime');
  if (!['lifetime', 'monthly', 'weekly'].includes(duration)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Invalid duration' }));
    return;
  }
  try {
    const upstream = await fetch(
      `https://api.creators.sa/v1/kebab/unified/icg1/leaderboard?limit=5&duration=${duration}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Upstream error' }));
      return;
    }
    const data = await upstream.json();
    const list = Array.isArray(data) ? data : [];
    const safe = list.map((x: any) => ({
      uname: String(x?.uname ?? ''),
      last_donation_at: String(x?.last_donation_at ?? ''),
    }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(safe));
  } catch (e: any) {
    if (!(res as any).headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Bad gateway', detail: String(e?.message || e) }));
    }
  }
}
