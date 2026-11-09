
import { createClient } from '@supabase/supabase-js';

// Layered approach for environment variables (Vite + Process support)
const getEnv = (key: string) => {
  return (process.env && process.env[key]) || (import.meta.env && import.meta.env[key]) || '';
};

const URL_VAL = getEnv('EXPO_PUBLIC_SUPABASE_URL');
const KEY_VAL = getEnv('EXPO_PUBLIC_SUPABASE_KEY');

const isConfigured = !!(URL_VAL && KEY_VAL && URL_VAL !== 'https://placeholder.supabase.co' && !KEY_VAL.includes('placeholder'));

if (isConfigured) {
  console.log("%c[iCG1] 🟢 System Online: Connected to Supabase", "color: #53fc18; font-weight: bold;");
} else {
  console.warn("%c[iCG1] 🟡 System Offline: Using Fallback Mode", "color: #fbbf24; font-weight: bold;");
}

const SUPABASE_URL = URL_VAL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = KEY_VAL || 'placeholder';

/** إعدادات REST لمكوّنات الـ iframe التي تتواصل مع PostgREST مباشرة (بدون مكتبة). */
export const supabaseRestConfig = () =>
  isConfigured ? { url: SUPABASE_URL, key: SUPABASE_KEY } : null;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'public' },
  global: {
    headers: { 'x-client-info': 'icg1-web' },
    fetch: (...args: any[]) => {
      const [url, options] = args;
      return fetch(url, { ...options, keepalive: true });
    },
  },
  auth: { persistSession: false, autoRefreshToken: true },
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const supabaseQuery = async <T>(
  queryFn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (e) {
      lastError = e;
      console.warn(`[Supabase] Query failed (attempt ${i + 1}/${retries}):`, e);
      if (i < retries - 1) await sleep(delayMs * Math.pow(2, i));
    }
  }
  throw lastError;
};

const safeCall = async (query: any, fallback: any = { data: [], error: null }) => {
  if (!isConfigured) return fallback;
  try {
    return await supabaseQuery(() => query, 3, 800);
  } catch (e) {
    console.warn('Supabase service error after retries:', e);
    return fallback;
  }
};

export const adminService = {
  async getAllProfiles() {
    return safeCall(supabase.from('profiles').select('*').order('created_at', { ascending: false }));
  },
  async getBannedUsers() {
    return safeCall(supabase.from('profiles').select('*').eq('is_banned', true));
  },
  async toggleUserBan(username: string, banStatus: boolean, reason: string = 'Administrative Decision') {
    if (!isConfigured) return { error: null };
    const { error } = await supabase.from('profiles').update({ is_banned: banStatus }).eq('username', username);
    if (!error) {
      if (banStatus) {
        await supabase.from('bans').insert([{ username, reason, banned_by: 'ADMIN_CORE' }]);
        // Delete completely from leaderboard
        await supabase.from('leaderboard').delete().eq('username', username);
        // Reset credits to 0
        await supabase.from('profiles').update({ credits: 0 }).eq('username', username);
      }
      else {
        await supabase.from('bans').delete().eq('username', username);
      }
      await this.logAction('SYSTEM', `BAN_${banStatus ? 'ADDED' : 'REMOVED'}`, { username, reason });
    }
    return { error };
  },
  async adjustCredits(username: string, amount: number) {
    if (!isConfigured) return { error: null };
    const { data: profile } = await supabase.from('profiles').select('credits').ilike('username', username).maybeSingle();
    if (profile) {
      const newCredits = Math.max(0, (profile.credits || 0) + amount);
      const { error } = await supabase.from('profiles').update({ credits: newCredits }).ilike('username', username);
      if (!error) await this.logAction('SYSTEM', 'CREDITS_ADJUST', { username, amount, final: newCredits });
      return { error };
    }
    return { error: 'Profile not found' };
  },
  async getAnnouncements() {
    return safeCall(supabase.from('announcements').select('*').order('created_at', { ascending: false }));
  },
  async addAnnouncement(content: string) {
    if (!isConfigured) return { error: null };
    return await supabase.from('announcements').insert([{ content, is_active: true, created_at: new Date().toISOString() }]);
  },
  async deleteAnnouncement(id: string) {
    if (!isConfigured) return { error: null };
    return await supabase.from('announcements').delete().eq('id', id);
  },
  async getPromoCodes() {
    return safeCall(supabase.from('promo_codes').select('*').order('created_at', { ascending: false }));
  },
  async addPromoCode(code: string, amount: number, maxUses: number) {
    if (!isConfigured) return { error: null };
    return await supabase.from('promo_codes').insert([{ code, reward_amount: amount, max_uses: maxUses, is_active: true, current_uses: 0 }]);
  },
  async deletePromoCode(id: string) {
    if (!isConfigured) return { error: null };
    return await supabase.from('promo_codes').delete().eq('id', id);
  },
  async togglePromoActive(id: string, isActive: boolean) {
    if (!isConfigured) return { error: null };
    return await supabase.from('promo_codes').update({ is_active: isActive }).eq('id', id);
  },
  async getArenaStatus() {
    if (!isConfigured) return { status: {}, error: null };
    const { data, error } = await supabase.from('arena_status').select('*');
    const status: any = {};
    data?.forEach(item => { status[item.key] = item.value; });
    return { status, error };
  },
  // arena_status ما لها مفتاح primary، فـ update وحده ما كان يلمّ صفوف:
  // upsert على مؤشر key الفريد (يُنشأ في supabase/admin_center.sql).
  // الكتابة من المتصفح مرفوضة بأمن الصفوف (select فقط لـ anon) — اللوحة
  // الحالية تحفظ عبر /api/admin/mutate، وهذه للوحة الأرشيفية فقط.
  async updateArenaStatus(key: string, value: any) {
    if (!isConfigured) return { error: null };
    return await supabase
      .from('arena_status')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  },
  async getAuditLogs(limit = 50) {
    return safeCall(supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit));
  },
  async logAction(admin: string, action: string, details: any) {
    if (!isConfigured) return { error: null };
    return await supabase.from('audit_logs').insert([{ admin_username: admin, action, details }]);
  }
};

// `leaderboard` has no FK to `profiles`, so the PostgREST embed fails; profile
// metadata is fetched separately and merged in JS instead.
const mergeProfileMeta = async (rows: any[]) => {
  if (!rows.length) return rows;
  const names = Array.from(new Set(rows.map((r: any) => String(r.username ?? '')))).filter(Boolean);
  const variants = Array.from(new Set([...names, ...names.map(n => n.toLowerCase())]));
  const result = await safeCall(
    supabase.from('profiles').select('username, avatar_url, is_banned, credits, active_frame_url').in('username', variants),
    { data: [], error: null }
  );
  const byUser: Record<string, any> = {};
  (result.data || []).forEach((p: any) => {
    if (p?.username) byUser[String(p.username).toLowerCase()] = p;
  });
  return rows.map((r: any) => {
    const p = byUser[String(r.username ?? '').toLowerCase()];
    return {
      ...r,
      score: r.score || 0,
      wins: r.wins || 0,
      avatar_url: p?.avatar_url || r.avatar_url,
      is_banned: p?.is_banned,
      credits: p?.credits,
      active_frame_url: p?.active_frame_url,
    };
  });
};

export const leaderboardService = {
  async getTopPlayers(limit = 20) {
    if (!isConfigured) return [];
    const result = await safeCall(
      supabase.from('leaderboard').select('*').order('score', { ascending: false }).limit(limit),
      { data: [], error: null }
    );
    return await mergeProfileMeta(result.data || []);
  },
  async getPlayersWithPoints() {
    if (!isConfigured) return [];
    const result = await safeCall(
      supabase.from('leaderboard').select('*').or('score.gt.0,wins.gt.0').order('score', { ascending: false }),
      { data: [], error: null }
    );
    return await mergeProfileMeta(result.data || []);
  },
  async getAllRankedPlayers() {
    if (!isConfigured) return [];
    try {
      const [lbResult, profsResult] = await Promise.all([
        supabaseQuery(() => supabase.from('leaderboard').select('*').order('score', { ascending: false }), 3, 1000),
        supabaseQuery(() => supabase.from('profiles').select('username, credits').gt('credits', 0), 3, 1000),
      ]);
      const rows = await mergeProfileMeta(lbResult.data || []);
      const ranked = rows.filter((r: any) => !r.is_banned);
      const seen: Record<string, boolean> = {};
      ranked.forEach((r: any) => { seen[String(r.username).toLowerCase()] = true; });
      const creditOnly = (profsResult.data || [])
        .filter((p: any) => p?.username && !seen[String(p.username).toLowerCase()])
        .map((p: any) => ({
          username: p.username,
          score: 0,
          wins: 0,
          credits: p.credits,
          avatar_url: p.avatar_url,
          is_banned: p.is_banned,
        }));
      return [...ranked, ...creditOnly];
    } catch (e) {
      return [];
    }
  },
  async checkIsBanned(username: string): Promise<boolean> {
    if (!isConfigured) return false;
    const { data } = await supabase.from('profiles').select('is_banned').ilike('username', username).limit(1);
    return data?.[0]?.is_banned || false;
  },
  async claimPromoCode(username: string, code: string) {
    if (!isConfigured) return { error: 'النظام غير متصل' };
    const normalizedUser = username.toLowerCase();
    
    const { data: promo, error: promoError } = await supabase.from('promo_codes').select('*').eq('code', code).eq('is_active', true).single();
    if (promoError || !promo) return { error: 'كود غير صالح' };
    if (promo.current_uses >= promo.max_uses) return { error: 'انتهت صلاحية الكود' };

    const { data: profile } = await supabase.from('profiles').select('*').eq('username', normalizedUser).maybeSingle();
    if (profile?.is_banned) return { error: 'حسابك محظور نهائياً ولا يمكنك استخدام الأكواد' };

    if (!profile) {
      await supabase.from('profiles').insert([{ username: normalizedUser, credits: promo.reward_amount }]);
    } else {
      await supabase.from('profiles').update({ credits: (profile.credits || 0) + promo.reward_amount }).eq('username', normalizedUser);
    }

    const { data: lbEntry } = await supabase.from('leaderboard').select('*').eq('username', normalizedUser).maybeSingle();
    if (lbEntry) {
      await supabase.from('leaderboard').update({ score: (lbEntry.score || 0) + promo.reward_amount }).eq('id', lbEntry.id);
    } else {
      await supabase.from('leaderboard').insert([{ username: normalizedUser, score: promo.reward_amount, wins: 0 }]);
    }

    await supabase.from('promo_codes').update({ current_uses: promo.current_uses + 1 }).eq('id', promo.id);
    await adminService.logAction('SYSTEM_AUTO', 'PROMO_REDEEM', { username: normalizedUser, code, amount: promo.reward_amount });
    return { success: true, amount: promo.reward_amount };
  },
  async recordWin(username: string, avatarUrl: string, points: number = 10) {
    return await leaderboardService.addScore(username, avatarUrl, points, true);
  },
  // countWin=false credits points for a single round win without inflating the
  // victory counter, so «فوز» always means an actual match won.
  async addScore(username: string, avatarUrl: string, points: number, countWin: boolean = true) {
    if (!isConfigured || !username || username === 'Unknown') return;
    const delta = Math.max(0, Math.round(points || 0));
    if (delta <= 0 && !countWin) return;
    const normalizedUser = username.toLowerCase();

    const { data: profiles } = await supabase.from('profiles').select('*').ilike('username', normalizedUser).limit(1);
    const profile = profiles?.[0];

    if (!profile) {
      await supabase.from('profiles').insert([{ username: normalizedUser, avatar_url: avatarUrl }]);
    } else if (profile.is_banned) return;

    const { data: existingRows } = await supabase.from('leaderboard').select('*').ilike('username', normalizedUser).limit(1);
    const existing = existingRows?.[0];

    if (existing) {
      await supabase.from('leaderboard').update({
        wins: (existing.wins || 0) + (countWin ? 1 : 0),
        score: (existing.score || 0) + delta,
        last_win_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      // Use upsert to be completely safe against race conditions during insert
      await supabase.from('leaderboard').upsert([{
        username: normalizedUser,
        wins: countWin ? 1 : 0,
        score: delta,
        last_win_at: new Date().toISOString()
      }], { onConflict: 'username' });
    }
  },
  async adjustPlayerStats(username: string, scoreDelta: number, winsDelta: number) {
    if (!isConfigured) return { error: null };
    const normalizedUser = username.toLowerCase();

    const { data: existingRows } = await supabase.from('leaderboard').select('*').ilike('username', normalizedUser).limit(1);
    const existing = existingRows?.[0];

    const finalScore = Math.max(0, (existing?.score || 0) + scoreDelta);
    const finalWins = Math.max(0, (existing?.wins || 0) + winsDelta);

    let res;
    if (existing) {
      res = await supabase.from('leaderboard').update({
        score: finalScore,
        wins: finalWins
      }).eq('id', existing.id).select().single();
    } else {
      res = await supabase.from('leaderboard').upsert([{
        username: normalizedUser,
        score: finalScore,
        wins: finalWins
      }], { onConflict: 'username' }).select().single();
    }

    if (!res.error) {
      await adminService.logAction('CORE_ADMIN', 'STATS_ADJUST', {
        username: normalizedUser,
        scoreDelta,
        winsDelta,
        finalScore,
        finalWins
      });
    }
    return res;
  },
  async resetLeaderboard() {
    if (!isConfigured) return { error: null };
    await adminService.logAction('SYSTEM', 'RESET_LEADERBOARD', {});
    return await supabase.from('leaderboard').delete().neq('username', 'SYSTEM_ADMIN');
  }
};

export const storeService = {
  async getFrames() {
    if (!isConfigured) return { data: [], error: null };
    return safeCall(
      supabase
        .from('store_items')
        .select('*')
        .eq('type', 'FRAME')
        .eq('is_active', true)
        .order('price', { ascending: true }),
      { data: [], error: null }
    );
  },
  async getAllItems() {
    if (!isConfigured) return { data: [], error: null };
    return safeCall(
      supabase
        .from('store_items')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true }),
      { data: [], error: null }
    );
  }
};

export const gamesService = {
  async getAllGames() {
    if (!isConfigured) return { data: [], error: null };
    return await supabase
      .from('games')
      .select('*')
      .order('position', { ascending: true });
  },
  async updateGamePosition(id: string, position: number) {
    if (!isConfigured) return { error: null };
    return await supabase
      .from('games')
      .update({ position })
      .eq('id', id);
  },
  async updateAllPositions(games: any[]) {
    if (!isConfigured) return { error: null };
    // We'll use a transaction style or multiple updates
    // Supabase JS doesn't have a built-in batch update for different values easily without RPC
    // But we can do it with a loop for now or a single upsert if we have IDs
    const { error } = await supabase
      .from('games')
      .upsert(games);
    return { error };
  }
};

/**
 * لوحات الصدارة الخاصة بكل لعبة (supabase/game_leaderboard.sql).
 * الكتابة: سطر في game_points — والتركيبي (trigger) يحدّث game_leaderboard.
 * القراءة: دوال RPC فقط، عشان الفلترة بالفترة وحظر اللاعبين تبقى في مكان واحد.
 */
export const gameLeaderboardService = {
  async logEvent(gameCode: string, username: string, points: number, kind: 'round' | 'match') {
    if (!isConfigured || !gameCode || !username) return { error: null };
    return await supabase.from('game_points').insert([{
      game_code: String(gameCode).trim().toUpperCase(),
      username: String(username).trim().toLowerCase(),
      points: Math.max(0, Math.round(points || 0)),
      kind,
    }]);
  },

  async getTop(gameCode: string, since: string | null = null, limit = 200) {
    if (!isConfigured) return [];
    const result = await safeCall(
      supabase.rpc('game_top', { p_game: gameCode, p_since: since, p_limit: limit, p_offset: 0 }),
      { data: [], error: null }
    );
    return result.data || [];
  },

  async getSummary(gameCode: string, since: string | null = null) {
    if (!isConfigured) return null;
    const result = await safeCall(
      supabase.rpc('game_summary', { p_game: gameCode, p_since: since }),
      { data: [], error: null }
    );
    return (result.data || [])[0] || null;
  },

  async getGamesSummary(since: string | null = null) {
    if (!isConfigured) return {};
    const result = await safeCall(
      supabase.rpc('games_board_summary', { p_since: since }),
      { data: [], error: null }
    );
    const byGame: Record<string, any> = {};
    (result.data || []).forEach((r: any) => { if (r?.game_code) byGame[String(r.game_code).toUpperCase()] = r; });
    return byGame;
  },

  async getPosition(gameCode: string, username: string, since: string | null = null) {
    if (!isConfigured || !username) return null;
    const result = await safeCall(
      supabase.rpc('game_position', { p_game: gameCode, p_username: username, p_since: since }),
      { data: [], error: null }
    );
    return (result.data || [])[0] || null;
  },
};
