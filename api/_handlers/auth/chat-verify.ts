import { hmacCode, signJwt, setSessionCookies, generateJti, generateCsrf, verifyOrigin } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabase.js';
import { rateLimit } from '../../_lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyOrigin(req, true)) return res.status(403).json({ error: 'Origin invalid' });

  const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rl = await rateLimit(`cv:${ip}`, 10, 60);
  if (rl.unavailable) return res.status(503).json({ error: 'Service unavailable' });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

  const { username, code } = req.body || {};
  if (typeof username !== 'string' || typeof code !== 'string') return res.status(400).json({ error: 'Invalid input' });

  const uname = username.trim().toLowerCase();
  const cleanCode = code.trim().toUpperCase();

  const { data: record } = await supabaseAdmin
    .from('chat_verification_codes')
    .select('*')
    .eq('kick_username', uname)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) return res.status(400).json({ error: 'No active code or expired' });
  if (record.attempts >= record.max_attempts) {
    await supabaseAdmin.from('chat_verification_codes').update({ used: true }).eq('id', record.id).eq('used', false);
    return res.status(429).json({ error: 'Too many attempts' });
  }

  // Atomic attempt increment
  const { data: updated } = await supabaseAdmin
    .from('chat_verification_codes')
    .update({ attempts: record.attempts + 1 })
    .eq('id', record.id)
    .eq('used', false)
    .select('attempts')
    .maybeSingle();

  if (!updated) return res.status(409).json({ error: 'Code already used' });

  if (hmacCode(cleanCode) !== record.code_hmac) {
    return res.status(401).json({ error: 'Invalid code' });
  }

  // Atomic single-use consumption
  const { data: consumed } = await supabaseAdmin
    .from('chat_verification_codes')
    .update({ used: true })
    .eq('id', record.id)
    .eq('used', false)
    .select('id')
    .maybeSingle();
  if (!consumed) return res.status(409).json({ error: 'Code already used' });

  const { data: existing } = await supabaseAdmin.from('users').select('id, kick_username, display_name, avatar, points').eq('kick_username', uname).maybeSingle();
  let user = existing;
  if (!user) {
    const { data: newUser, error: uErr } = await supabaseAdmin
      .from('users')
      .insert({ kick_username: uname, display_name: uname, avatar: '', password_hash: '' })
      .select('id, kick_username, display_name, avatar, points')
      .single();
    if (uErr || !newUser) return res.status(500).json({ error: 'Failed to create user' });
    user = newUser;
    await supabaseAdmin.from('profiles').upsert({ username: uname, avatar_url: '', created_at: new Date().toISOString() });
    await supabaseAdmin.from('leaderboard').insert([{ username: uname, score: 0, wins: 0 }]);
  }

  const jti = generateJti();
  const jwt = signJwt({ sub: user.id, username: user.kick_username, jti });
  const csrf = generateCsrf();
  setSessionCookies(res, jwt, csrf);
  return res.status(200).json({ user });
}
