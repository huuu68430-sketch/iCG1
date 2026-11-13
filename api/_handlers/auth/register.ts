import { hashPasswordNew, signJwt, setSessionCookies, generateJti, generateCsrf, verifyOrigin } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabase.js';
import { rateLimit } from '../../_lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyOrigin(req, true)) return res.status(403).json({ error: 'Origin invalid' });

  const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rl = await rateLimit(`register:${ip}`, 5, 60);
  if (rl.unavailable) return res.status(503).json({ error: 'Service unavailable' });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

  const { name, username, password, discord } = req.body || {};
  if (typeof name !== 'string' || typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' });
  if (name.trim().length < 1 || username.trim().length < 2 || password.length < 6) return res.status(400).json({ error: 'Invalid input' });

  const uname = username.trim().toLowerCase();
  const password_hash = hashPasswordNew(password);

  // Atomic registration via RPC
  const { data: userId, error: rpcErr } = await supabaseAdmin.rpc('register_user', {
    p_username: uname,
    p_display_name: name.trim(),
    p_password_hash: password_hash,
    p_discord: discord || '',
  });

  if (rpcErr) {
    if (rpcErr.message?.includes('username already exists')) return res.status(409).json({ error: 'Account already exists' });
    return res.status(500).json({ error: 'Failed to create user' });
  }

  // Best-effort profile upsert (service role)
  await supabaseAdmin.from('profiles').upsert({ username: uname, avatar_url: '', created_at: new Date().toISOString() });
  // الحساب الجديد وصل بعد تحقّق شات كيك → موثّق
  await supabaseAdmin.from('users').update({ is_verified: true }).eq('id', userId);

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, kick_username, display_name, avatar, points')
    .eq('id', userId)
    .single();

  const jti = generateJti();
  const jwt = signJwt({ sub: user.id, username: user.kick_username, jti });
  const csrf = generateCsrf();
  setSessionCookies(res, jwt, csrf);

  /* الجلسة تُسجَّل في القاعدة — وإلا رفضها /api/me بعد الدخول */
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { error: sessErr } = await supabaseAdmin.rpc('register_session', {
    p_jti: jti, p_user_id: user.id, p_username: user.kick_username, p_expires_at: expiresAt,
  });
  if (sessErr) return res.status(500).json({ error: 'تعذّر إنشاء الجلسة' });
  // مفتاح اللعبة (تجزئة كلمة السر) يعود لصاحب الحساب الجديد فقط — هو من برهن
  // كلمة السر في هذه اللحظة، ولا يُقرأ من قاعدة البيانات في المتصفح أبداً.
  return res.status(201).json({ user, game_key: password_hash });
}
