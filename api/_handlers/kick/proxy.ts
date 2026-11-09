// وسيط قراءة آمن لبيانات Kick / Botrix (قائمة أساطير الشات + صور المتصفحين).
// المتصفح قد يُحجب من الاتصال المباشر بهذه الخدمات (CORS)، لذلك يمرّ الطلب من هنا.
// الأمان: GET فقط، مضيفون محدّدون، مسار يبدأ بـ /api/، بلا منافذ أو بيانات اعتماد،
// وحد أقصى لحجم الرد + مهلة زمنية. لا تُمرَّر كوكيز أو ترويسات العميل إطلاقًا.

const ALLOWED_HOSTS = new Set(['kick.com', 'www.kick.com', 'botrix.live', 'www.botrix.live']);
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;

const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = typeof req.query?.endpoint === 'string' ? req.query.endpoint : '';
  if (!raw) {
    return res.status(400).json({ error: 'Missing endpoint' });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  if (target.protocol !== 'https:') {
    return res.status(400).json({ error: 'Invalid protocol' });
  }
  if (target.username || target.password) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }
  if (target.port && target.port !== '443') {
    return res.status(403).json({ error: 'Host not allowed' });
  }
  if (!ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    return res.status(403).json({ error: 'Host not allowed' });
  }

  // botrix يستخدم //api/... لذا نطوي الشرطات المكرّرة قبل التحقّق.
  const path = target.pathname.replace(/^\/+/, '/');
  if (!path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  const upstreamUrl = `https://${target.hostname.toLowerCase()}${path}${target.search}`;
  const refererHost = target.hostname.toLowerCase().includes('kick.com') ? 'https://kick.com/' : `https://${target.hostname}/`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      // لا نتبع التحويلات: يمنع أي محاولة SSRF عبر Location إلى مضيف آخر.
      redirect: 'manual',
      headers: {
        ...BROWSER_HEADERS,
        referer: refererHost,
        origin: refererHost.replace(/\/$/, ''),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: 'Upstream error', status: upstream.status });
    }

    const text = await upstream.text();
    if (text.length > MAX_BYTES) {
      return res.status(502).json({ error: 'Upstream response too large' });
    }

    // نتحقّق أنه JSON فعلاً قبل تمريره — يمنع تمرير صفحات HTML/نصوص غريبة.
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Upstream returned invalid JSON' });
    }

    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json(parsed);
  } catch (e: any) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'Upstream timeout' : 'Bad gateway' });
  }
}
