import { verifyPassword, signJwt, setSessionCookies, generateJti, generateCsrf, verifyCsrf, verifyOrigin, hashPasswordNew } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { rateLimit } from '../../lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyOrigin(req, true)) return res.status(403).json({ error: 'Origin invalid' });

  const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rl = await rateLimit(`login:${ip}`, 10, 60);
  if (rl.unavailable) return res.status(503).json({ error: 'Service unavailable' });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' });
  if (username.length < 2 || password.length < 1) return res.status(400).json({ error: 'Invalid credentials' });

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, kick_username, display_name, avatar, points, password_hash')
    .ilike('kick_username', username.trim())
    .maybeSingle();

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.password_hash) return res.status(401).json({ error: 'Invalid credentials' }); // KICK-only accounts cannot login via password

  const { ok, needsUpgrade } = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Lazy upgrade: SHA-256 legacy → scrypt
  if (needsUpgrade) {
    const newHash = hashPasswordNew(password);
    await supabaseAdmin.from('users').update({ password_hash: newHash }).eq('id', user.id);
  }

  const jti = generateJti();
  const jwt = signJwt({ sub: user.id, username: user.kick_username, jti });
  const csrf = generateCsrf();
  setSessionCookies(res, jwt, csrf);
  return res.status(200).json({ user: { id: user.id, kick_username: user.kick_username, display_name: user.display_name, avatar: user.avatar, points: user.points } });
}
