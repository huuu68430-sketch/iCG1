import { clampText, json, rateLimit, reqBody, requireMember, supabaseAdmin } from '../_lib/memberHttp';

/** استخدام كود ترويجي — التنفيذ الذرّي كله داخل redeem_promo في القاعدة. */
export default async function handler(req: any, res: any) {
    const m = await requireMember(req);
    if (!m) return json(res, 401, { ok: false, error: 'سجّل دخولك أولاً' });

    if (req.method === 'GET') {
        const { data } = await supabaseAdmin.from('promo_redemptions')
            .select('amount, redeemed_at, promo_id, via')
            .eq('username', m.username).order('redeemed_at', { ascending: false }).limit(20);
        return json(res, 200, { ok: true, redemptions: data || [] });
    }

    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

    const rl = await rateLimit(`member-promo:${m.username}`, 10, 600);
    if (!rl.allowed) return json(res, rl.unavailable ? 503 : 429, { ok: false, error: 'محاولات كثيرة — انتظر دقائق' });

    const code = clampText(reqBody(req).code, 40).toUpperCase();
    if (code.length < 3) return json(res, 400, { ok: false, error: 'اكتب الكود كاملاً' });

    const { data, error } = await supabaseAdmin.rpc('redeem_promo', {
        p_username: m.username, p_code: code, p_via: 'site',
    });
    if (error) {
        const msg = String(error.message || '');
        // أخطاء redeem_promo رسائل عربية مقصودة؛ ما عداها خطأ تقني
        const readable = /كود|الكود|صلاحية|سابق|محظور|مطلوب|استُهلك/.test(msg);
        return json(res, readable ? 400 : 500, { ok: false, error: readable ? msg : 'تعذّر استخدام الكود الآن' });
    }
    return json(res, 200, { ok: true, amount: Number(data) || 0 });
}
