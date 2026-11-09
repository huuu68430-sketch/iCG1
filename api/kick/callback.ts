import crypto from 'crypto';
import { supabaseAdmin } from '../_lib/supabase.js';
import { signJwt, setSessionCookies, generateJti, generateCsrf } from '../_lib/auth.js';

const SECRET = (process.env.SERVER_SECRET || 'dev-secret').padEnd(32, '0').slice(0, 32);

function decryptCookie(val: string): { state: string; codeVerifier: string } | null {
  try {
    const [ivB64, tagB64, encB64] = val.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(SECRET), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    let dec = decipher.update(encB64, 'base64url', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  const { code, state, error } = req.query || {};

  if (error) {
    return res.redirect(302, `/?kick_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(302, '/?kick_error=missing_params');
  }

  const cookie = req.headers?.cookie || '';
  const m = cookie.match(/(?:^|;\s*)oauth_cv=([^;]+)/);
  if (!m) return res.redirect(302, '/?kick_error=no_session');
  const data = decryptCookie(decodeURIComponent(m[1]));
  if (!data || data.state !== state) {
    return res.redirect(302, '/?kick_error=state_mismatch');
  }

  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  const redirectUri = process.env.KICK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(302, '/?kick_error=not_configured');
  }

  try {
    const tokenRes = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: data.codeVerifier,
      }),
    });
    if (!tokenRes.ok) return res.redirect(302, '/?kick_error=token_failed');
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return res.redirect(302, '/?kick_error=no_token');

    const userRes = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) return res.redirect(302, '/?kick_error=userinfo_failed');
    const userData = await userRes.json();
    const kickUser = userData?.data?.[0] || userData;
    const kickUserId = String(kickUser?.user_id || kickUser?.id || '');
    const kickUsername = kickUser?.name || kickUser?.username || kickUser?.slug || '';
    const avatar = kickUser?.profile_picture || kickUser?.avatar || '';

    if (!kickUserId || !kickUsername) {
      return res.redirect(302, '/?kick_error=invalid_user');
    }

    let user: any = null;
    const { data: byKickId } = await supabaseAdmin
      .from('users')
      .select('id, kick_username, display_name, avatar, points, password_hash')
      .eq('kick_user_id', kickUserId)
      .maybeSingle();

    if (byKickId) {
      user = byKickId;
    } else {
      const { data: byUsername } = await supabaseAdmin
        .from('users')
        .select('id, kick_username, display_name, avatar, points, password_hash, kick_user_id')
        .ilike('kick_username', kickUsername)
        .maybeSingle();

      if (byUsername) {
        if (!byUsername.kick_user_id) {
          await supabaseAdmin.from('users').update({ kick_user_id: kickUserId, avatar: avatar || byUsername.avatar }).eq('id', byUsername.id);
        }
        user = { ...byUsername, kick_user_id: kickUserId };
      } else {
        const { data: newUser, error: uErr } = await supabaseAdmin
          .from('users')
          .insert({ kick_user_id: kickUserId, kick_username: kickUsername.toLowerCase(), display_name: kickUsername, avatar: avatar, password_hash: '', is_verified: true })
          .select('id, kick_username, display_name, avatar, points')
          .single();
        if (uErr || !newUser) return res.redirect(302, '/?kick_error=create_failed');
        user = newUser;
        await supabaseAdmin.from('profiles').upsert({ username: kickUsername.toLowerCase(), avatar_url: avatar, created_at: new Date().toISOString() });
        await supabaseAdmin.from('leaderboard').insert([{ username: kickUsername.toLowerCase(), score: 0, wins: 0 }]);
      }
    }

    const jti = crypto.randomBytes(16).toString('hex');
    const jwt = signJwt({ sub: user.id, username: user.kick_username, jti });
    const csrf = generateCsrf();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', [
      `icg1_session=${encodeURIComponent(jwt)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${7 * 24 * 3600}`,
      `csrf_token=${encodeURIComponent(csrf)}; Path=/; SameSite=Lax${secure}; Max-Age=${7 * 24 * 3600}`,
      'oauth_cv=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);

    return res.redirect(302, '/?kick_login=success');
  } catch (e) {
    return res.redirect(302, '/?kick_error=server_error');
  }
}
