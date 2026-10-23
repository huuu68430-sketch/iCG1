// Live social counters — 3-layer architecture per platform:
//   1) /api/social (server-side: Vercel Edge in prod, vite middleware in dev)
//   2) Direct client fetch (CORS-open sources)
//   3) Verified static fallback

export interface SocialMediaStats {
  instagram?: number | null;
  instagramFollowing?: number | null;
  tiktok?: number | null;
  tiktokFollowing?: number | null;
  twitter?: number | null;
  twitterFollowing?: number | null;
  youtube?: number | null;
  twitch?: number | null;
  discord?: number | null;
  discordOnline?: number | null;
}

export const FALLBACK: Required<SocialMediaStats> = {
  instagram: 4972,
  instagramFollowing: 58,
  tiktok: 6055,
  tiktokFollowing: 45,
  twitter: 111,
  twitterFollowing: 206,
  youtube: 1041,
  twitch: 14310,
  discord: 380,
  discordOnline: 61,
};

const CACHE_KEY = 'icg1_social_cache_v3';
export const SOCIAL_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface PublicProfileStats {
  count: number | null;
  following?: number | null;
}

async function fetchJson(url: string, timeoutMs = 9000, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Public profile counts from our server API (works in dev + prod, no CORS issues). */
async function viaServerApi(platform: 'tiktok' | 'instagram' | 'twitter' | 'youtube' | 'twitch' | 'discord'): Promise<PublicProfileStats | null> {
  try {
    const j = await fetchJson(`/api/social?platform=${platform}`);
    return {
      count: typeof j?.count === 'number' && j.count > 0 ? j.count : null,
      following: typeof j?.following === 'number' && j.following >= 0 ? j.following : null,
    };
  } catch {
    return null;
  }
}

export async function getInstagramFollowers(username = 'CG1YT'): Promise<number> {
  void username;
  const via = await viaServerApi('instagram');
  return via?.count ?? FALLBACK.instagram;
}

export async function getTikTokFollowers(username = 'cg1yt'): Promise<number> {
  void username;
  const via = await viaServerApi('tiktok');
  return via?.count ?? FALLBACK.tiktok;
}

export async function getTwitterFollowers(username = 'cg1yt1'): Promise<number> {
  void username;
  const via = await viaServerApi('twitter');
  return via?.count ?? FALLBACK.twitter;
}

export async function getYouTubeSubscribers(channelId = ''): Promise<number> {
  void channelId;
  const via = await viaServerApi('youtube');
  return via?.count ?? FALLBACK.youtube;
}

export async function getTwitchFollowers(username = 'iicg1'): Promise<number> {
  const via = await viaServerApi('twitch');
  if (via?.count) return via.count;
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: `query { user(login: "${username}") { followers { totalCount } } }` }),
    });
    const d = await res.json();
    const count = d?.data?.user?.followers?.totalCount;
    if (typeof count === 'number' && count > 0) return count;
  } catch {}
  return FALLBACK.twitch;
}

export async function getDiscordMembers(inviteCode = 'icg1'): Promise<{ count: number; online?: number }> {
  const via = await viaServerApi('discord');
  if (via?.count) return { count: via.count, online: via.following ?? undefined };
  try {
    const d = await fetchJson(`https://discord.com/api/v9/invites/${inviteCode}?with_counts=true`);
    const count = d?.approximate_member_count;
    if (typeof count === 'number' && count > 0) {
      return { count, online: d?.approximate_presence_count };
    }
  } catch {}
  return { count: FALLBACK.discord, online: FALLBACK.discordOnline };
}

export async function getAllSocialMediaStats(): Promise<SocialMediaStats> {
  const [instagram, tiktok, twitter, youtube, twitch, discord] = await Promise.allSettled([
    viaServerApi('instagram'),
    viaServerApi('tiktok'),
    viaServerApi('twitter'),
    viaServerApi('youtube'),
    viaServerApi('twitch'),
    viaServerApi('discord'),
  ]);

  const val = (r: PromiseSettledResult<PublicProfileStats | null>) => (r.status === 'fulfilled' ? r.value : null);

  const stats: SocialMediaStats = {
    instagram: val(instagram)?.count ?? FALLBACK.instagram,
    instagramFollowing: val(instagram)?.following ?? FALLBACK.instagramFollowing,
    tiktok: val(tiktok)?.count ?? FALLBACK.tiktok,
    tiktokFollowing: val(tiktok)?.following ?? FALLBACK.tiktokFollowing,
    twitter: val(twitter)?.count ?? FALLBACK.twitter,
    twitterFollowing: val(twitter)?.following ?? FALLBACK.twitterFollowing,
    youtube: val(youtube)?.count ?? FALLBACK.youtube,
    twitch: val(twitch)?.count ?? (await getTwitchFollowers()),
    discord: val(discord)?.count ?? (await getDiscordMembers()).count,
    discordOnline: val(discord)?.following ?? (await getDiscordMembers()).online,
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), stats }));
  } catch {}
  return stats;
}

/** Instant paint from cache (if fresh), so numbers show before the live fetch lands. */
export function readSocialCache(): (SocialMediaStats & { _fresh: boolean }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, stats } = JSON.parse(raw);
    if (!stats) return null;
    return { ...stats, _fresh: Date.now() - at < SOCIAL_TTL_MS };
  } catch {
    return null;
  }
}

export function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export async function getCachedSocialMediaStats(): Promise<SocialMediaStats> {
  return getAllSocialMediaStats();
}
