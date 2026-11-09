import { clampText, json, rateLimit, reqBody, requireMember, supabaseAdmin } from '../../lib/memberHttp';

const KINDS = ['سلوك مخالف', 'تعليق مسيء', 'غش في لعبة', 'انتحال حساب', 'محتوى غير لائق', 'إساءة لمستخدم', 'أخرى'];
const STATUS_AR: Record<string, string> = { new: 'جديد', reviewing: 'قيد المراجعة', accepted: 'مقبول', rejected: 'مرفوض', closed: 'مغلق' };

export default async function handler(req: any, res: any) {
    const m = await requireMember(req);
    if (!m) return json(res, 401, { ok: false, error: 'سجّل دخولك أولاً' });

    if (req.method === 'GET') {
        const [{ data: mine }, { data: sanctions }] = await Promise.all([
            supabaseAdmin.from('reports')
                .select('id, record_type, target_username, kind, reason, status, resolution, created_at, sanction_id')
                .eq('reporter_username', m.username).order('created_at', { ascending: false }).limit(50),
            supabaseAdmin.from('bans')
                .select('id, username, kind, reason, ends_at, status, created_at')
                .eq('username', m.username).order('created_at', { ascending: false }).limit(10),
        ]);
        return json(res, 200, {
            ok: true,
            reports: (mine || []).map(r => ({ ...r, status_ar: STATUS_AR[r.status] || r.status })),
            sanctions: (sanctions || []).filter(s => s.status === 'active').map(s => ({
                id: s.id, type: s.kind || 'حظر', reason: s.reason || '', ends_at: s.ends_at, created_at: s.created_at,
            })),
            banned: (sanctions || []).some(s => s.status === 'active'),
        });
    }

    if (req.method === 'POST') {
        const rl = await rateLimit(`member-report:${m.username}`, 6, 3600);
        if (!rl.allowed) return json(res, rl.unavailable ? 503 : 429, { ok: false, error: 'بلاغات كثيرة في ساعة — انتظر قليلاً' });

        const b = reqBody(req);
        const reason = clampText(b.reason, 600);
        if (reason.length < 5) return json(res, 400, { ok: false, error: 'اشرح المشكلة في سطر على الأقل' });

        const isAppeal = b.record_type === 'appeal';
        let sanctionId: string | null = null;
        if (isAppeal) {
            sanctionId = clampText(b.sanction_id, 60) || null;
            if (!sanctionId) return json(res, 400, { ok: false, error: 'اختر العقوبة التي تعترض عليها' });
            const { data: ban } = await supabaseAdmin.from('bans').select('id, username, status').eq('id', sanctionId).maybeSingle();
            if (!ban || ban.username !== m.username) return json(res, 400, { ok: false, error: 'العقوبة غير موجودة لهذا الحساب' });
            const { data: dup } = await supabaseAdmin.from('reports').select('id').eq('sanction_id', sanctionId).eq('record_type', 'appeal').limit(1);
            if (dup?.length) return json(res, 409, { ok: false, error: 'لك اعتراض واحد على كل عقوبة' });
        } else {
            const target = clampText(b.target_username, 40).toLowerCase();
            if (!target || target === m.username) return json(res, 400, { ok: false, error: 'اسم المبلغ عنه غير صالح' });
        }

        const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : KINDS[0];
        const { data, error } = await supabaseAdmin.from('reports').insert({
            reporter_username: m.username,
            target_username: isAppeal ? m.username : clampText(b.target_username, 40).toLowerCase(),
            kind: isAppeal ? 'اعتراض على عقوبة' : kind,
            reason,
            detail: clampText(b.detail, 1200) || null,
            record_type: isAppeal ? 'appeal' : 'report',
            sanction_id: sanctionId,
            status: 'new',
            verified: m.verified,
        }).select('id, status, created_at').single();

        if (error) return json(res, 500, { ok: false, error: error.message });
        return json(res, 200, { ok: true, data });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
}
