// مصادقة مركز تحكم الإدارة وصلاحياته. كل كتابة إدارية تمر من هنا.
// كلمة السر لا تُطبع في حزمة المتصفح إطلاقاً — تُقرأ من app_config بمفتاح السر.
import crypto from 'crypto';
import { supabaseAdmin, isSupabaseConfigured } from './supabase';
import { signJwt, verifyJwt, generateJti } from './auth';
import { env, isProduction } from './env';

export const ADMIN_COOKIE = 'icg1_admin';
const ADMIN_TTL_SEC = 12 * 3600;

export interface AdminStaff {
    staff_name: string;
    role: string;
    permissions: string[];
}

/** أدوار اللوحة → معرّفات الأقسام المسموح بها. '*' = كل الأقسام. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
    'Super Admin': ['*'],
    'Admin': ['*'],
    'Game Manager': ['home', 'games', 'tour', 'arena', 'ann', 'notif', 'audit'],
    'Store Manager': ['home', 'eco', 'store', 'inv', 'mem', 'promo', 'audit'],
    'Community Moderator': ['home', 'reports', 'sup', 'ann', 'notif', 'audit', 'users'],
    'Support Agent': ['home', 'sup', 'reports', 'users'],
    'Events Manager': ['home', 'tour', 'ann', 'notif', 'games'],
    'Analyst': ['home', 'an', 'eco', 'sys', 'audit'],
};

const timingEqual = (a: string, b: string) => {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
};

/**
 * كلمة السر المشتركة: مصدرها app_config في القاعدة، و ADMIN_FALLBACK_PASSWORD احتياطي من البيئة.
 * dbFailed يعني أن التحقق من القاعدة لم يكتمل (غير موصولة أو الصف فارغ) — حتى لا يُقال
 * «كلمة المرور غير صحيحة» لمن يكتب الكلمة الصحيحة وخادمه متصل بمشروع غلط.
 */
export async function checkAdminPassword(input: string): Promise<{ ok: boolean; dbFailed: boolean }> {
    if (!input || input.length < 4) return { ok: false, dbFailed: false };
    let dbFailed = !isSupabaseConfigured;
    if (isSupabaseConfigured) {
        try {
            const { data, error } = await supabaseAdmin
                .from('app_config').select('value').eq('key', 'admin_password').maybeSingle();
            if (error) dbFailed = true;
            else if (data?.value && timingEqual(String(input), String(data.value))) return { ok: true, dbFailed: false };
        } catch { /* يسقط للنسخة الاحتياطية من البيئة */
            dbFailed = true;
        }
    }
    const fallback = env('ADMIN_FALLBACK_PASSWORD');
    return { ok: !!fallback && timingEqual(String(input), fallback), dbFailed };
}

/** التحقق من الجلسات يتم في القاعدة حتى يعمل Logout فعلاً. */
export async function requireAdmin(req: any): Promise<{ staff: AdminStaff; jti: string } | null> {
    if (!isSupabaseConfigured) return null;
    const cookie = req.headers?.cookie || '';
    const match = cookie.match(/(?:^|;\s*)icg1_admin=([^;]+)/);
    if (!match) return null;
    let payload: Record<string, unknown> | null = null;
    try { payload = verifyJwt(decodeURIComponent(match[1])); } catch { return null; }
    if (!payload || payload.adm !== 1) return null;
    if (typeof payload.jti !== 'string') return null;
    const staffName = String(payload.staff || '');
    if (!staffName) return null;

    try {
        const [{ data: sess }, { data: row }] = await Promise.all([
            supabaseAdmin.from('sessions').select('revoked, expires_at').eq('jti', payload.jti).maybeSingle(),
            supabaseAdmin.from('admin_staff').select('staff_name, role, permissions, is_active').eq('staff_name', staffName).maybeSingle(),
        ]);
        if (!sess || sess.revoked) return null;
        if (new Date(sess.expires_at).getTime() < Date.now()) return null;
        if (!row || !row.is_active) return null;
        return {
            staff: {
                staff_name: row.staff_name,
                role: row.role,
                permissions: Array.isArray(row.permissions) ? row.permissions : [],
            },
            jti: payload.jti,
        };
    } catch {
        return null; // أي خطأ = رفض (fail closed)
    }
}

/** '*' يسمح بكل شيء؛ دور معروف يضيف صلاحياته؛ الباقي صلاحيات الصف حرفياً. */
export function canAccess(staff: AdminStaff, sectionId: string): boolean {
    const perms = staff.permissions || [];
    if (perms.includes('*')) return true;
    if (perms.includes(sectionId)) return true;
    const fromRole = ROLE_PERMISSIONS[staff.role] || [];
    return fromRole.includes('*') || fromRole.includes(sectionId);
}

export async function issueAdminSession(staff: AdminStaff): Promise<string> {
    const jti = generateJti();
    const token = signJwt({ jti, staff: staff.staff_name, role: staff.role, adm: 1 }, ADMIN_TTL_SEC);
    const expiresAt = new Date(Date.now() + ADMIN_TTL_SEC * 1000).toISOString();
    const { error } = await supabaseAdmin.rpc('register_session', {
        p_jti: jti, p_user_id: null, p_username: `admin:${staff.staff_name}`, p_expires_at: expiresAt,
    });
    // الجلسات عمودها user_id قابل للت null؛ خطأ تسجيل الجلسة يعني جلسة ميتة → نرفض
    if (error) throw new Error(error.message);
    await supabaseAdmin.from('admin_staff').update({ last_login: new Date().toISOString() }).eq('staff_name', staff.staff_name);
    return token;
}

export async function revokeAdminSession(jti: string) {
    await supabaseAdmin.from('sessions').update({ revoked: true }).eq('jti', jti);
}

export function setAdminCookie(res: any, token: string) {
    const secure = isProduction() ? '; Secure' : '';
    const prev = res.getHeader('Set-Cookie');
    const arr = prev ? (Array.isArray(prev) ? prev : [String(prev)]) : [];
    res.setHeader('Set-Cookie', [
        ...arr,
        `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${ADMIN_TTL_SEC}`,
    ]);
}

export function clearAdminCookie(res: any) {
    res.setHeader('Set-Cookie', [`${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`]);
}

/** سجل العمليات — لا يحذف ولا يعدَّل من الواجهة. */
export async function audit(adminName: string, action: string, details: Record<string, any>) {
    if (!isSupabaseConfigured) return;
    try {
        await supabaseAdmin.from('audit_logs').insert({
            admin_username: adminName || 'UNKNOWN',
            action,
            details: details || {},
        });
    } catch (e) {
        console.error('[adminAuth] audit write failed', action, e);
    }
}

export const json = (res: any, status: number, body: any) => res.status(status).json(body);

export function body(req: any): any {
    if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    return {};
}

/** العنوان الذي يضيفه المنصة نفسه فقط — رأس XFF الذي يرسله العميل لا يُوثق به في حدّ المحاولات. */
export function clientIp(req: any): string {
    const h = req.headers || {};
    const trusted = String(h['x-real-ip'] || h['x-vercel-forwarded-for'] || '').trim();
    if (trusted) return trusted.split(',')[0].trim();
    const chain = String(h['x-forwarded-for'] || '').split(',').map((x: string) => x.trim()).filter(Boolean);
    return chain[chain.length - 1] || req.socket?.remoteAddress || 'unknown';
}
