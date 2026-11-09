// وسيط آمن لقائمة كبار داعمي Creators.
// لماذا وسيط؟ لأن المتصفح قد يُحجب من الاتصال المباشر بـ api.creators.sa (CORS)،
// ولأن المطلوب إظهار الاسم + التاريخ فقط — فالمبلغ يُحذف هنا في الخادم ولا يصل للمتصفح أبدًا.
const ALLOWED = ['lifetime', 'monthly', 'weekly'] as const;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const duration = String(req.query?.duration || 'lifetime');
  if (!(ALLOWED as readonly string[]).includes(duration)) {
    return res.status(400).json({ error: 'Invalid duration' });
  }
  try {
    const upstream = await fetch(
      `https://api.creators.sa/v1/kebab/unified/icg1/leaderboard?limit=5&duration=${duration}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Upstream error' });
    }
    const data = await upstream.json();
    const list = Array.isArray(data) ? data : [];
    // الاسم + التاريخ فقط — حقل `total` (المبلغ) لا يُمرَّر إطلاقًا
    const safe = list.map((x: any) => ({
      uname: String(x?.uname ?? ''),
      last_donation_at: String(x?.last_donation_at ?? ''),
    }));
    return res.status(200).json(safe);
  } catch {
    return res.status(502).json({ error: 'Bad gateway' });
  }
}
