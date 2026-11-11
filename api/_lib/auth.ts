// Shared auth helpers for Vercel serverless functions.
import crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { env, isProduction } from './env';

// 🔒 Fail-closed: في الإنتاج، غياب السر يمنع التوقيع/التحقق — لكنه لا يُسقط وحدة الدالة
// (وإلا عطّل مسارات لا تحتاجه مثل وسيط Creators). لذلك يُرمى عند الاستخدام فقط.
// الأسرار الصريحة لها الأولوية. وإن غابت من بيئة النشر نشتق مفتاحاً من سر خدمة
// Supabase الموجود أصلاً في السيرفر: HMAC لا يكشف الأصل، وفصل التسمية يعطي كل غرض
// مفتاحاً مستقلاً. بلا أي سرّ يبقى الرفض قائماً — لا توقيع بمفتاح تطوير في الإنتاج.
const rootSecret = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
const derived = (label: string) =>
  rootSecret ? crypto.createHmac('sha256', rootSecret).update(`icg1/${label}/v1`).digest('base64url') : '';
const _sessionSecret = env('SESSION_SECRET') || derived('session-jwt');
const _hmacSecret = env('CODE_HMAC_SECRET') || derived('code-hmac');
const SESSION_SECRET = _sessionSecret || 'dev-insecure-secret-change-me';
const CODE_HMAC_SECRET = _hmacSecret || 'dev-insecure-hmac-change-me';

/** السر الفعلي لتوقيع الجلسات — تستعمله مسارات العضو أيضاً كي يبقى التجزئة موحّدة */
export const sessionSecret = (): string => SESSION_SECRET;

function requireSecrets() {
  if (isProduction() && (!_sessionSecret || !_hmacSecret)) {
    throw new Error('Missing SESSION_SECRET / CODE_HMAC_SECRET in production');
  }
}
const ISSUER = 'icg1';
const AUDIENCE = 'icg1-app';

// ---------- JWT (HS256) ----------
export function signJwt(payload: Record<string, unknown>, expiresInSec = 7 * 24 * 3600): string {
  requireSecrets();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iss: ISSUER, aud: AUDIENCE, iat: now, exp: now + expiresInSec };
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc(header)}.${enc(body)}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

export function verifyJwt(token: string): Record<string, unknown> | null {
  requireSecrets();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  let header: any;
  try { header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')); } catch { return null; }
  // Explicit algorithm check
  if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${h}.${b}`).digest('base64url');
  const sigBuf = Buffer.from(s);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  let payload: any;
  try { payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')); } catch { return null; }
  if (payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.iat !== 'number') return null;
  return payload;
}

// ---------- Password hashing ----------
export function legacySha256(pin: string): string {
  return crypto.createHash('sha256').update(pin + 'iABS_salt_2024', 'utf8').digest('hex');
}

export function hashPasswordNew(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

// bcrypt support (optional, requires bcrypt package)
export async function verifyBcrypt(pin: string, hash: string): Promise<boolean> {
  try {
    const bcrypt: any = await import('bcrypt' as any);
    if (!bcrypt) return false;
    return await bcrypt.compare(pin, hash);
  } catch {
    return false; // bcrypt not installed
  }
}

export async function verifyPassword(pin: string, stored: string): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored) return { ok: false, needsUpgrade: false };
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    const ok = await verifyBcrypt(pin, stored);
    return { ok, needsUpgrade: false };
  }
  if (stored.startsWith('scrypt$')) {
    const [, salt, derived] = stored.split('$');
    const check = crypto.scryptSync(pin, salt, 64).toString('hex');
    const ok = crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(derived, 'hex'));
    return { ok, needsUpgrade: false };
  }
  // Legacy SHA-256 (مقارنة ثابتة الزمن)
  const a = Buffer.from(legacySha256(pin));
  const b = Buffer.from(stored);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, needsUpgrade: ok };
}

// ---------- Session helpers (FAIL CLOSED) ----------
export async function requireSession(req: any): Promise<{ userId: string; username: string; jti: string } | null> {
  const cookie = req.headers?.cookie || '';
  const match = cookie.match(/(?:^|;\s*)icg1_session=([^;]+)/);
  if (!match) return null;
  const payload = verifyJwt(decodeURIComponent(match[1]));
  if (!payload || typeof payload.sub !== 'string' || typeof payload.jti !== 'string') return null;
  // DB revocation check — FAIL CLOSED
  try {
    const { data, error } = await supabaseAdmin.from('sessions').select('revoked, expires_at').eq('jti', payload.jti).maybeSingle();
    if (error) return null; // DB error → reject
    if (!data) return null; // no session row → reject
    if (data.revoked) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
  } catch {
    return null; // table missing or any error → reject
  }
  return { userId: payload.sub, username: String(payload.username || ''), jti: payload.jti };
}

export function verifyCsrf(req: any): boolean {
  const cookie = req.headers?.cookie || '';
  const m = cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (!m) return false;
  const header = req.headers?.['x-csrf-token'] || req.headers?.['X-CSRF-Token'];
  if (!header) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(decodeURIComponent(m[1])), Buffer.from(String(header)));
  } catch {
    return false;
  }
}

// Origin check (CSRF hardening) — strict for mutating requests
export function verifyOrigin(req: any, requireOrigin = false): boolean {
  const origin = req.headers?.origin || req.headers?.Origin;
  const host = req.headers?.host || req.headers?.Host;
  if (!origin) {
    // Allow missing origin for same-origin/server-to-server in dev; require in prod for mutating
    if (requireOrigin && isProduction()) return false;
    return true;
  }
  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

export function setSessionCookies(res: any, jwt: string, csrf: string) {
  const secure = isProduction() ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `icg1_session=${encodeURIComponent(jwt)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${7 * 24 * 3600}`,
    `csrf_token=${encodeURIComponent(csrf)}; Path=/; SameSite=Lax${secure}; Max-Age=${7 * 24 * 3600}`,
  ]);
}

export function clearSessionCookies(res: any) {
  res.setHeader('Set-Cookie', [
    'icg1_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'csrf_token=; Path=/; SameSite=Lax; Max-Age=0',
  ]);
}

// ---------- HMAC for chat verification codes ----------
export function hmacCode(code: string): string {
  requireSecrets();
  return crypto.createHmac('sha256', CODE_HMAC_SECRET).update(code, 'utf8').digest('hex');
}

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function generateJti(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function generateCsrf(): string {
  return crypto.randomBytes(32).toString('base64url');
}
