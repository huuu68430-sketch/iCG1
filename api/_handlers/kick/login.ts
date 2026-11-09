import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.KICK_CLIENT_ID;
  const redirectUri = process.env.KICK_REDIRECT_URI;
  if (!clientId || !redirectUri) return res.status(500).json({ error: 'KICK not configured' });

  // Generate state + PKCE
  const state = crypto.randomBytes(32).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Store state + code_verifier in httpOnly cookie (encrypted)
  const secret = (process.env.SERVER_SECRET || 'dev-secret').padEnd(32, '0').slice(0, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret), iv);
  let enc = cipher.update(JSON.stringify({ state, codeVerifier }), 'utf8', 'base64url');
  enc += cipher.final('base64url');
  const tag = cipher.getAuthTag().toString('base64url');
  const cookieVal = `${iv.toString('base64url')}.${tag}.${enc}`;

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `oauth_cv=${encodeURIComponent(cookieVal)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=300`);

  const url = new URL('https://id.kick.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'user:read');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return res.redirect(302, url.toString());
}
