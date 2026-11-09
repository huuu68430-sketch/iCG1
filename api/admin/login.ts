import { rateLimit } from '../_lib/rateLimit';
import { supabaseAdmin } from '../_lib/supabase';
import {
    audit, body, checkAdminPassword, clientIp, clearAdminCookie, issueAdminSession,
    json, setAdminCookie,
} from '../_lib/adminAuth';

/** كلمة سر واحدة تفتح اللوحة: هوية المشرف تُقرأ من القاعدة، لا من المتصفح. */
const OWNER_NAME = 'المشرف العام';

/** أولوية من يمثّل اللوحة: مالك ثم أي سوبر‑أدن نشط ثم الأقدم نشط. */
const pickStaff = (rows: any[]): any | null => {
    const active = (rows || []).filter(r => r?.is_active);
    if (!active.length) return null;
    return (
        active.find(r => r.staff_name === OWNER_NAME) ||
        active.find(r => r.role === 'Super Admin' || (Array.isArray(r.permissions) && r.permissions.includes('*'))) ||
        active[0]
    );
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

    // ٥ محاولات كل ١٥ دقيقة لكل عنوان — وأيّ انقطاع في القاعدة يمنع الدخول (fail closed)
    const ip = clientIp(req);
    const rl = await rateLimit(`admin-login:${ip}`, 5, 900);
    if (!rl.allowed) {
        return json(res, rl.unavailable ? 503 : 429, {
            error: rl.unavailable ? 'تعذّر التحقق الآن، حاول لاحقاً' : 'محاولات كثيرة. انتظر خمس عشرة دقيقة.'
        });
    }

    const check = await checkAdminPassword(String(body(req).password || ''));
    if (!check.ok) {
        await audit('UNKNOWN', 'ADMIN_LOGIN_FAILED', { ip });
        return json(res, 401, {
            error: check.dbFailed
                ? 'لم تُوصَل قاعدة البيانات، فالتحقق مستحيل. أعد تشغيل خادم التطوير من مجلد المشروع.'
                : 'كلمة المرور غير صحيحة'
        });
    }

    const { data: rows, error } = await supabaseAdmin
        .from('admin_staff')
        .select('staff_name, role, permissions, is_active, created_at')
        .order('created_at', { ascending: true })
        .limit(200);

    if (error) return json(res, 500, { error: 'لم تُنفَّذ قاعدة بيانات مركز التحكم بعد (admin_center.sql)' });

    const row = pickStaff(rows || []);
    if (!row) {
        await audit('UNKNOWN', 'ADMIN_LOGIN_NO_STAFF', { ip });
        return json(res, (rows || []).length ? 403 : 500, {
            error: (rows || []).length
                ? 'كل حسابات المشرفين معطّلة من اللوحة'
                : 'لم تُنفَّذ قاعدة بيانات مركز التحكم بعد (admin_center.sql)'
        });
    }

    const staff = {
        staff_name: row.staff_name,
        role: row.role,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
    };

    try {
        const token = await issueAdminSession(staff);
        setAdminCookie(res, token);
    } catch (e: any) {
        clearAdminCookie(res);
        return json(res, 500, { error: `تعذّر إنشاء الجلسة: ${e?.message || 'خطأ'}` });
    }

    await audit(staff.staff_name, 'ADMIN_LOGIN', { ip, role: staff.role });
    return json(res, 200, { ok: true, staff });
}
