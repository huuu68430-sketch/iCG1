// هوية العضو لمسارات /api/user.
// العضوية اليوم خلف كلمة سر مشتركة (لا حساب لكل لاعب)، فهنا كود موقع موقّع
// من السيرفر باسم اللاعب: لا يتغيَّر من أدوات المتصفح، ولا يُقرأ密钥ه.
// إذا وُجدت جلسة حساب حقيقي (تسجيل دخول فعلي) تُقدَّم وتُسجَّل البلاغات موثّقة.
import crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { signJwt, verifyJwt, generateJti, requireSession } from './auth';
import { env, isProduction } from './env';

export const MEMBER_COOKIE = 'icg1_member';
const MEMBER_TTL = 7 * 24 * 3600;

export interface Member {
    username: string;
    verified: boolean;
    jti: string;
}

const clean = (v: any) => String(v ?? '').trim().toLowerCase().slice(0, 64);

export function memberSecret(): string {
    return env('SESSION_SECRET') || 'dev-insecure-secret-change-me';
}

export async function requireMember(req: any): Promise<Member | null> {
    // 1) جلسة حساب حقيقي
    const real = await requireSession(req);
    if (real && real.username) return { username: clean(real.username), verified: true, jti: real.jti };

    // 2) كود موقع موقّع
    const cookie = req.headers?.cookie || '';
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${MEMBER_COOKIE}=([^;]+)`));
    if (!m) return null;
    let payload: Record<string, any> | null = null;
    try { payload = verifyJwt(decodeURIComponent(m[1])); } catch { return null; }
    if (!payload || payload.mem !== 1 || typeof payload.jti !== 'string') return null;
    const username = clean(payload.u);
    if (!username) return null;
    try {
        const { data, error } = await supabaseAdmin.from('sessions').select('revoked, expires_at').eq('jti', payload.jti).maybeSingle();
        if (error || !data || data.revoked) return null;
        if (new Date(data.expires_at).getTime() < Date.now()) return null;
    } catch { return null; }
    return { username, verified: false, jti: payload.jti };
}

/** اسم لازم يكون لاعباً موجوداً — وإلاAnyone يستطيع إغراق قاعدة البلاغات. */
export async function memberExists(username: string): Promise<boolean> {
    const { data } = await supabaseAdmin.from('profiles').select('username').eq('username', username).maybeSingle();
    if (data) return true;
    const { data: u } = await supabaseAdmin.from('users').select('kick_username').eq('kick_username', username).maybeSingle();
    return !!u;
}

export async function issueMemberToken(username: string): Promise<string> {
    const jti = generateJti();
    const token = signJwt({ jti, u: username, mem: 1 }, MEMBER_TTL);
    const expiresAt = new Date(Date.now() + MEMBER_TTL * 1000).toISOString();
    const { error } = await supabaseAdmin.rpc('register_session', {
        p_jti: jti, p_user_id: null, p_username: `member:${username}`, p_expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    return token;
}

export async function revokeMemberToken(jti: string) {
    await supabaseAdmin.from('sessions').update({ revoked: true }).eq('jti', jti);
}

export function setMemberCookie(res: any, token: string) {
    const secure = isProduction() ? '; Secure' : '';
    const prev = res.getHeader('Set-Cookie');
    const arr = prev ? (Array.isArray(prev) ? prev : [String(prev)]) : [];
    res.setHeader('Set-Cookie', [
        ...arr,
        `${MEMBER_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${MEMBER_TTL}`,
    ]);
}

export function clearMemberCookie(res: any) {
    res.setHeader('Set-Cookie', [`${MEMBER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`]);
}

export const json = (res: any, status: number, bodyValue: any) => res.status(status).json(bodyValue);
export const reqBody = (req: any) => (typeof req.body === 'string' ? safeParse(req.body) : (req.body || {}));
function safeParse(s: string) { try { return JSON.parse(s || '{}'); } catch { return {}; } }

export function clientIp(req: any): string {
    const fwd = String(req.headers?.['x-forwarded-for'] || '');
    return (fwd.split(',')[0] || '').trim() || req.socket?.remoteAddress || 'unknown';
}

/** نص نظيف بلاغات/تذاكر: حدّ الطول ومنع الترميز الغريب */
export const clampText = (v: any, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

export const hashIp = (ip: string) => crypto.createHash('sha256').update(ip + memberSecret()).digest('hex').slice(0, 16);
