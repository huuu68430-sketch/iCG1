// Vercel Edge Function — Live Social Counters API
// GET /api/social?platform=tiktok|instagram|youtube|twitter|twitch|discord
// Server-side fetch = no CORS issues, fresh numbers every call.
// Vercel caches success responses for 4 minutes (s-maxage).

export const config = {
  runtime: 'edge',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const BOT_UA = 'Twitterbot/1.0';
const FB_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const HANDLES = {
  tiktok: 'cg1yt',
  instagram: 'CG1YT',
  twitter: 'cg1yt1',
  youtube: 'iiCG1',
  twitch: 'iicg1',
  discord: 'icg1',
} as const;

type Platform = keyof typeof HANDLES;

async function fetchJson(url: string, timeoutMs = 9000, headers: Record<string, string> = {}): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, timeoutMs = 9000, userAgent = UA): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': userAgent, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/** "68,337" | "68.3K" | "1.2M" -> 68337 */
function parseCompact(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input);
  const s = String(input ?? '').replace(/,/g, '').trim();
  const m = s.match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = (m[2] || '').toUpperCase();
  if (u === 'K') n *= 1e3;
  else if (u === 'M') n *= 1e6;
  else if (u === 'B') n *= 1e9;
  const out = Math.round(n);
  return out > 0 ? out : null;
}

async function getTikTok(): Promise<{ count: number; following?: number | null; source: string }> {
  // 1) Direct TikTok meta scrape with crawler UA
  try {
    const html = await fetchText(`https://www.tiktok.com/@${HANDLES.tiktok}`, 7000, FB_UA);
    const ogMatch = html.match(/content="[^"]*?([\d.,]+[KMB]?)\s+Followers/i) ||
                    html.match(/([\d.,]+[KMB]?)\s+Followers/i);
    const n = ogMatch ? parseCompact(ogMatch[1]) : null;
    if (n) {
      const fMatch = html.match(/([\d.,]+[KMB]?)\s+Following/i);
      return { count: n, following: fMatch ? parseCompact(fMatch[1]) : null, source: 'tiktok_crawler' };
    }
  } catch {}
  // 2) Countik
  try {
    const d = await fetchJson(`https://countik.com/api/tiktok/@${HANDLES.tiktok}`);
    const n = parseCompact(d?.followerCount ?? d?.followers ?? d?.follower_count);
    if (n) return { count: n, following: parseCompact(d?.followingCount ?? d?.following_count), source: 'countik' };
  } catch {}
  // Fallback to verified baseline
  return { count: 6055, following: 45, source: 'baseline' };
}

async function getYouTube(): Promise<{ count: number; source: string }> {
  let channelId = '';
  try {
    const page = await fetchText(`https://www.youtube.com/@${HANDLES.youtube}`);
    channelId =
      page.match(/"channelId"\s*:\s*"(UC[\w-]+)"/)?.[1] ||
      page.match(/youtube\.com\/channel\/(UC[\w-]+)/)?.[1] ||
      '';
  } catch {}

  if (channelId) {
    // 1) LemnosLife operational API — exact subscriber count, no key
    try {
      const d = await fetchJson(`https://yt.lemnoslife.com/noKey/channels?part=statistics&id=${channelId}`);
      const n = parseCompact(d?.items?.[0]?.statistics?.subscriberCount);
      if (n) return { count: n, source: 'lemnoslife' };
    } catch {}
    // 2) Mixerno — exact subscriber count
    try {
      const d = await fetchJson(`https://mixerno.space/api/youtube-channel-counter/user/${channelId}`);
      const entry = Array.isArray(d?.counts) ? d.counts.find((c: any) => c?.value === 'subscribers') : null;
      const n = parseCompact(entry?.count);
      if (n) return { count: n, source: 'mixerno' };
    } catch {}
    // 3) Piped mirrors
    const mirrors = [
      'https://pipedapi.adminforge.de',
      'https://pipedapi.reallyaweso.me',
      'https://pipedapi.leptons.xyz',
    ];
    for (const m of mirrors) {
      try {
        const d = await fetchJson(`${m}/channel/${channelId}`);
        const n = parseCompact(d?.subscriberCount);
        if (n) return { count: n, source: `piped:${new URL(m).hostname}` };
      } catch {}
    }
  }
  return { count: 1041, source: 'baseline' };
}

async function getTwitter(): Promise<{ count: number; following?: number | null; source: string }> {
  // 1) FixTweet — exact followers
  try {
    const d = await fetchJson(`https://api.fxtwitter.com/${HANDLES.twitter}`);
    const n = parseCompact(d?.user?.followers);
    if (n) return { count: n, following: parseCompact(d?.user?.following ?? d?.user?.following_count), source: 'fxtwitter' };
  } catch {}
  // 2) X syndication endpoint
  try {
    const d = await fetchJson(
      `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${HANDLES.twitter}`
    );
    const n = parseCompact(Array.isArray(d) ? d[0]?.followers_count : d?.followers_count);
    if (n) return { count: n, following: parseCompact(Array.isArray(d) ? d[0]?.following_count : d?.following_count), source: 'syndication' };
  } catch {}
  return { count: 111, following: 206, source: 'baseline' };
}

async function getInstagram(): Promise<{ count: number; following?: number | null; source: string }> {
  // 1) Direct Instagram meta scrape with Twitterbot UA
  try {
    const html = await fetchText(`https://www.instagram.com/${HANDLES.instagram}/`, 7000, BOT_UA);
    const og = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ||
               html.match(/content="([^"]*Followers[^"]*)"/i)?.[1] || '';
    const mFollowers = og.match(/([\d.,]+[KMB]?)\s+Followers/i);
    const mFollowing = og.match(/([\d.,]+[KMB]?)\s+Following/i);
    const n = mFollowers ? parseCompact(mFollowers[1]) : null;
    if (n) {
      return { count: n, following: mFollowing ? parseCompact(mFollowing[1]) : null, source: 'instagram_crawler' };
    }
  } catch {}
  // 2) Instagram private web API
  try {
    const d = await fetchJson(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${HANDLES.instagram}`);
    const n = parseCompact(d?.data?.user?.edge_followed_by?.count);
    if (n) return { count: n, following: parseCompact(d?.data?.user?.edge_follow?.count), source: 'web_profile_info' };
  } catch {}
  return { count: 4972, following: 58, source: 'baseline' };
}

async function getTwitch(): Promise<{ count: number; source: string }> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 7000);
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query { user(login: "${HANDLES.twitch}") { followers { totalCount } } }`,
      }),
      signal: c.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      const count = data?.data?.user?.followers?.totalCount;
      if (typeof count === 'number' && count > 0) {
        return { count, source: 'twitch_gql' };
      }
    }
  } catch {}
  return { count: 14310, source: 'baseline' };
}

async function getDiscord(): Promise<{ count: number; following?: number | null; source: string }> {
  try {
    const d = await fetchJson(`https://discord.com/api/v9/invites/${HANDLES.discord}?with_counts=true`);
    const count = d?.approximate_member_count;
    if (typeof count === 'number' && count > 0) {
      return { count, following: d?.approximate_presence_count, source: 'discord_invite' };
    }
  } catch {}
  return { count: 380, following: 61, source: 'baseline' };
}

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get('platform') || '').toLowerCase() as Platform;

  if (!platform || !(platform in HANDLES)) {
    return new Response(JSON.stringify({ error: 'Use ?platform=tiktok|instagram|youtube|twitter|twitch|discord' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const loaders: Record<Platform, () => Promise<{ count: number; source: string; following?: number | null }>> = {
      tiktok: getTikTok,
      instagram: getInstagram,
      youtube: getYouTube,
      twitter: getTwitter,
      twitch: getTwitch,
      discord: getDiscord,
    };
    const { count, source, following } = await loaders[platform]();
    return new Response(JSON.stringify({ platform, count, source, following, updatedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=240, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ platform, count: null, error: err?.message || 'failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=60' },
    });
  }
}
