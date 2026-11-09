import { supabaseAdmin } from '../../_lib/supabase';
import {
    clientIp, clearMemberCookie, issueMemberToken, json, memberExists,
    requireMember, revokeMemberToken, setMemberCookie, reqBody,
} from '../../_lib/memberAuth';
import { rateLimit } from '../../_lib/rateLimit';

const cleanName = (v: any) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF_\-.\s]/g, '').slice(0, 40);

export default async function handler(req: any, res: any) {
    const method = req.method;

    if (method === 'GET') {
        const m = await requireMember(req);
        if (!m) return json(res, 401, { ok: false, error: 'لا توجد جلسة' });
        const { data } = await supabaseAdmin.from('profiles')
            .select('username, credits, is_banned, membership, membership_expires_at, admin_note, active_frame_id')
            .eq('username', m.username).maybeSingle();
        return json(res, 200, { ok: true, username: m.username, verified: m.verified, profile: data || null });
    }

    if (method === 'POST') {
        const username = cleanName(reqBody(req).username);
        if (!username) return json(res, 400, { ok: false, error: 'اسم اللاعب مطلوب' });
        const ip = clientIp(req);
        const rl = await rateLimit(`member-session:${ip}`, 30, 3600);
        if (!rl.allowed) return json(res, rl.unavailable ? 503 : 429, { ok: false, error: 'حاول لاحقاً' });
        if (!(await memberExists(username))) {
            return json(res, 404, { ok: false, error: 'لا يوجد لاعب بهذا الاسم — لعب لعبة أولاً أو سجّل الدخول' });
        }
        try {
            setMemberCookie(res, await issueMemberToken(username));
        } catch (e: any) {
            clearMemberCookie(res);
            return json(res, 500, { ok: false, error: `تعذّر إنشاء الجلسة: ${e?.message || 'خطأ'}` });
        }
        return json(res, 200, { ok: true, username });
    }

    if (method === 'DELETE') {
        const m = await requireMember(req);
        if (m) await revokeMemberToken(m.jti);
        clearMemberCookie(res);
        return json(res, 200, { ok: true });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
}
