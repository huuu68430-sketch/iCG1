import { clampText, json, rateLimit, reqBody, requireMember, supabaseAdmin } from '../../lib/memberHttp';

const SAFE_ID = /^[A-Za-z0-9_\-]{1,64}$/;

export default async function handler(req: any, res: any) {
    const m = await requireMember(req);
    if (!m) return json(res, 401, { ok: false, error: 'سجّل دخولك أولاً' });

    if (req.method === 'GET') {
        const [{ data: owned }, { data: prof }, { data: vip }] = await Promise.all([
            supabaseAdmin.from('user_frames').select('frame_id, is_equipped, purchased_at').eq('username', m.username).limit(300),
            supabaseAdmin.from('profiles').select('membership, membership_expires_at, active_frame_id').eq('username', m.username).maybeSingle(),
            supabaseAdmin.from('tiers').select('discount_pct').eq('id', 'vip').maybeSingle(),
        ]);
        const isVip = prof?.membership === 'vip' && (!prof?.membership_expires_at || new Date(prof.membership_expires_at) > new Date());
        return json(res, 200, {
            ok: true,
            owned: (owned || []).map(o => ({ frame_id: o.frame_id, is_equipped: o.is_equipped, purchased_at: o.purchased_at })),
            equipped: prof?.active_frame_id || (owned || []).find((o: any) => o.is_equipped)?.frame_id || null,
            vip: isVip,
            discount_pct: isVip ? Math.max(0, Math.min(90, Number(vip?.discount_pct) || 0)) : 0,
        });
    }

    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

    const b = reqBody(req);
    const frameId = clampText(b.frame_id, 64);
    if (!SAFE_ID.test(frameId)) return json(res, 400, { ok: false, error: 'معرّف منتج غير صالح' });
    const action = String(b.action || 'buy');

    const rl = await rateLimit(`member-store:${m.username}`, 30, 600);
    if (!rl.allowed) return json(res, rl.unavailable ? 503 : 429, { ok: false, error: 'محاولات كثيرة — انتظر قليلاً' });

    if (action === 'equip') {
        const { data, error } = await supabaseAdmin.rpc('equip_frame', { p_username: m.username, p_frame_id: frameId });
        if (error) return json(res, /تملك|لا تملك/.test(error.message) ? 400 : 500, { ok: false, error: error.message || 'تعذّر التجهيز' });
        return json(res, 200, { ok: true, equipped: data });
    }

    if (action !== 'buy') return json(res, 400, { ok: false, error: 'عملية غير معروفة' });

    const { data, error } = await supabaseAdmin.rpc('buy_frame', { p_username: m.username, p_frame_id: frameId });
    if (error) {
        const msg = String(error.message || '');
        const readable = /منتج|نقاطك|تمتلك|سجل|غير موجود/.test(msg);
        return json(res, readable ? 400 : 500, { ok: false, error: readable ? msg : 'تعذّر إتمام الشراء' });
    }
    const row: any = Array.isArray(data) ? data[0] : data;
    return json(res, 200, {
        ok: true,
        paid: Number(row?.price_paid) || 0,
        discount: Number(row?.discount) || 0,
        points_left: Number(row?.points_left) || 0,
        frame_id: row?.frame_id,
    });
}
