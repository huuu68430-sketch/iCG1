// نقطة صحة معزولة (بدون أي استيرادات) لعزل مشكلة الدوال في Vercel.
export default function handler(req: any, res: any) {
  try {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, at: new Date().toISOString() }));
  } catch {
    try { res.writeHead(500); res.end('{}'); } catch { /* */ }
  }
}
