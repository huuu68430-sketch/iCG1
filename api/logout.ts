import { requireSession, verifyCsrf, clearSessionCookies } from './_lib/auth.js';
import { supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyCsrf(req)) return res.status(403).json({ error: 'CSRF invalid' });
  const session = await requireSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  // Revoke on server — fail closed
  try {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update({ revoked: true })
      .eq('jti', session.jti)
      .select('jti')
      .maybeSingle();
    if (error) throw error;
    // If row not found (already revoked or table missing), treat as idempotent success only if no error
    // but if table doesn't exist, fail closed
  } catch (e) {
    // DB error or table missing → fail closed
    return res.status(500).json({ error: 'Failed to revoke session' });
  }

  clearSessionCookies(res);
  return res.status(204).end();
}
