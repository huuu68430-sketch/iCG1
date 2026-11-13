// التحقق من كلمات سر البوابات (المستضيف / الموقع) في السيرفر فقط.
// السر لا يُقرأ من app_config في المتصفح أبداً — ولا يُعاد للمتصفح أبداً:
// المتصفح يسأل «هل هذه الكلمة صحيحة؟» فيرد نعم/لا.
import crypto from 'crypto';
import { supabaseAdmin, isSupabaseConfigured } from '../../_lib/supabase';
import { rateLimit } from '../../_lib/rateLimit';
import { clientIp } from '../../_lib/memberAuth';

/** المفاتيح المسموح التحقق منها — أي مفتاح آخر مرفوض. */
const ALLOWED_KEYS = ['host_password', 'site_password', 'admin_password'];

const timingEqual = (a: string, b: string) => {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
};

async function readConfig(key: string): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    try {
        const { data, error } = await supabaseAdmin
            .from('app_config').select('value').eq('key', key).maybeSingle();
        if (error) return null;
        const v = data?.value ? String(data.value).trim() : '';
        return v || null;
    } catch {
        return null;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ip = clientIp(req);
    const rl = await rateLimit(`config-check:${ip}`, 10, 300);
    if (!rl.allowed) {
        return res.status(rl.unavailable ? 503 : 429).json({
            ok: false, error: rl.unavailable ? 'تعذّر التحقق الآن' : 'محاولات كثيرة. انتظر قليلاً.',
        });
    }

    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})) || {};
    const key = String(body.key || '').trim();
    const fallbackKey = String(body.fallback_key || '').trim();
    const password = String(body.password || '');

    if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ ok: false, error: 'طلب غير صالح' });
    if (fallbackKey && !ALLOWED_KEYS.includes(fallbackKey)) return res.status(400).json({ ok: false, error: 'طلب غير صالح' });
    if (!password) return res.status(401).json({ ok: false, error: 'كلمة السر غير صحيحة' });

    const candidates: string[] = [];
    const primary = await readConfig(key);
    if (primary) candidates.push(primary);
    if (fallbackKey && fallbackKey !== key) {
        const fb = await readConfig(fallbackKey);
        if (fb) candidates.push(fb);
    }
    if (!candidates.length) {
        // لا سر في القاعدة ولا احتياطي ⇒ الرفض هو السلوك الآمن
        return res.status(503).json({ ok: false, error: 'تعذّر التحقق الآن، حاول لاحقاً' });
    }

    const ok = candidates.some(c => timingEqual(password, c));
    if (!ok) return res.status(401).json({ ok: false, error: 'كلمة السر غير صحيحة' });
    return res.status(200).json({ ok: true });
}
