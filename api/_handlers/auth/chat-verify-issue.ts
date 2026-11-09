import { generateCode, hmacCode, verifyOrigin } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabase.js';
import { rateLimit } from '../../_lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyOrigin(req, true)) return res.status(403).json({ error: 'Origin invalid' });

  const { username } = req.body || {};
  if (typeof username !== 'string' || username.trim().length < 2) return res.status(400).json({ error: 'Invalid username' });

  const uname = username.trim().toLowerCase();
  const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  const rl1 = await rateLimit(`cvi:ip:${ip}`, 3, 3600);
  if (rl1.unavailable) return res.status(503).json({ error: 'Service unavailable' });
  if (!rl1.allowed) return res.status(429).json({ error: 'Too many requests' });

  const rl2 = await rateLimit(`cvi:user:${uname}`, 3, 3600);
  if (rl2.unavailable) return res.status(503).json({ error: 'Service unavailable' });
  if (!rl2.allowed) return res.status(429).json({ error: 'Too many requests' });
  // Invalidate old codes
  await supabaseAdmin.from('chat_verification_codes').update({ used: true }).eq('kick_username', uname).eq('used', false);

  const code = generateCode();
  const codeHmac = hmacCode(code);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from('chat_verification_codes').insert({
    kick_username: uname,
    code_hmac: codeHmac,
    expires_at: expiresAt,
    used: false,
    attempts: 0,
  });
  if (error) return res.status(500).json({ error: 'Failed to issue code' });

  // Return code to display (user must send iCG1-<code> in Kick chat)
  return res.status(200).json({ code, expires_in: 120, instruction: `Send iCG1-${code} in Kick chat` });
}
