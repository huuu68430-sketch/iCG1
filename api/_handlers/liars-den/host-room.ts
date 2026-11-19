// إنشاء غرفة «حانة الكذابين» للمسرح — بلا حساب (نفس عرف المافيا).
// إنشاء الغرفة ليس عملية مميزة: التوكن السري الذي يُرجَع لمنشئ الغرفة هو ما
// يحمي كل عمليات المسرح لاحقاً (ld_host_ok)، وهوية العضو تُطلب فقط من الهواتف
// عند حجز مقعد (mafia_verify). لذلك لا نبوّب الدخول على جلسة إدارة/عضو هنا؛
// جلسة الإدارة تُستخدم للإسناد فقط إن وُجدت، وإلا مستضيف ضيف بمعرّف عشوائي.
import crypto from 'crypto';
import { supabaseAdmin, isSupabaseConfigured } from '../../_lib/supabase';
import { audit, json, requireAdmin } from '../../_lib/adminAuth';
import { verifyOrigin } from '../../_lib/auth';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const randCode = () => Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    if (!isSupabaseConfigured) return json(res, 503, { error: 'تعذّر الاتصال بقاعدة البيانات' });
    if (!verifyOrigin(req)) return json(res, 403, { error: 'bad_origin' });

    // اختيارية: إسناد الغرفة للإداري إن كانت جلسته سليمة — لا تُرفض الاستضافة بغيابها
    const admin = await requireAdmin(req).catch(() => null);
    const hostHandle = admin
        ? `admin:${String(admin.staff.staff_name || '').toLowerCase().trim()}`.slice(0, 60)
        : `guest:${crypto.randomBytes(6).toString('hex')}`;
    const nowIso = new Date().toISOString();

    // أغلق غرف هذا المستضيف القديمة حتى لا تتراكم (كما يفعل ld_create_room)
    if (admin) {
        await supabaseAdmin
            .from('ld_rooms')
            .update({ status: 'closed', updated_at: nowIso })
            .eq('host_handle', hostHandle)
            .neq('status', 'closed');
    }

    let code = '';
    for (let attempt = 0; attempt < 20; attempt++) {
        const cand = randCode();
        const { data } = await supabaseAdmin.from('ld_rooms').select('code').eq('code', cand).maybeSingle();
        if (!data) { code = cand; break; }
    }
    if (!code) return json(res, 500, { error: 'code_exhausted' });

    const hostToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    const { error } = await supabaseAdmin.from('ld_rooms').insert({
        code,
        host_handle: hostHandle,
        host_th: sha256(hostToken),
        status: 'lobby',
        expires_at: expiresAt,
    });
    if (error) return json(res, 500, { error: 'room_create_failed' });

    if (admin) await audit(admin.staff.staff_name, 'LD_HOST_ROOM', { code });
    return json(res, 200, { code, host_token: hostToken, expires_at: expiresAt });
}