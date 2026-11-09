import { requireSession } from './_lib/auth.js';
import { supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await requireSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, kick_username, display_name, avatar, points')
    .eq('id', session.userId)
    .maybeSingle();
  if (error || !data) return res.status(401).json({ error: 'User not found' });
  return res.status(200).json({ user: data });
}
