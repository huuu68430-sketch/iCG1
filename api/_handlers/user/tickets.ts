import { clampText, json, rateLimit, reqBody, requireMember, supabaseAdmin } from '../../_lib/memberHttp';

const CATS = ['مشكلة حساب', 'مشكلة مشتريات', 'مشكلة رصيد', 'مشكلة لعبة', 'بلاغ', 'اقتراح', 'مشكلة تقنية'];
const PRIS = ['منخفضة', 'متوسطة', 'عالية'];
const STATUS_AR: Record<string, string> = { new: 'جديدة', reviewing: 'قيد المراجعة', resolved: 'تم الحل', closed: 'مغلقة' };

export default async function handler(req: any, res: any) {
    const m = await requireMember(req);
    if (!m) return json(res, 401, { ok: false, error: 'سجّل دخولك أولاً' });

    if (req.method === 'GET') {
        const { data, error } = await supabaseAdmin.from('support_tickets')
            .select('id, subject, category, priority, status, reply, created_at, updated_at')
            .eq('username', m.username).order('created_at', { ascending: false }).limit(50);
        if (error) return json(res, 500, { ok: false, error: error.message });
        return json(res, 200, { ok: true, tickets: (data || []).map(t => ({ ...t, status_ar: STATUS_AR[t.status] || t.status })) });
    }

    if (req.method === 'POST') {
        const rl = await rateLimit(`member-ticket:${m.username}`, 8, 3600);
        if (!rl.allowed) return json(res, rl.unavailable ? 503 : 429, { ok: false, error: 'تذاكر كثيرة — انتظر قليلاً' });

        const b = reqBody(req);
        const subject = clampText(b.subject, 120);
        const body = clampText(b.body, 1500);
        if (subject.length < 4) return json(res, 400, { ok: false, error: 'اكتب موضوعاً واضحاً' });
        if (body.length < 10) return json(res, 400, { ok: false, error: 'اشرح التفاصيل (١٠ أحرف على الأقل)' });

        const { data, error } = await supabaseAdmin.from('support_tickets').insert({
            username: m.username,
            subject,
            body,
            category: CATS.includes(String(b.category)) ? String(b.category) : 'مشكلة تقنية',
            priority: PRIS.includes(String(b.priority)) ? String(b.priority) : 'متوسطة',
            status: 'new',
        }).select('id, status, created_at').single();
        if (error) return json(res, 500, { ok: false, error: error.message });
        return json(res, 200, { ok: true, data });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
}
