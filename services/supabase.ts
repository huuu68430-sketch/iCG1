
import { createClient } from '@supabase/supabase-js';

// Layered approach for environment variables (Vite + Process support)
const getEnv = (key: string) => {
  return (import.meta.env && import.meta.env[key]) || (process.env && process.env[key]) || '';
};

const URL_VAL = getEnv('EXPO_PUBLIC_SUPABASE_URL');
const KEY_VAL = getEnv('EXPO_PUBLIC_SUPABASE_KEY');

const isConfigured = !!(URL_VAL && KEY_VAL && URL_VAL !== 'https://placeholder.supabase.co' && !KEY_VAL.includes('placeholder'));

if (isConfigured) {
  console.log("%c[iABS] 🟢 System Online: Connected to Supabase", "color: #53fc18; font-weight: bold;");
} else {
  console.warn("%c[iABS] 🟡 System Offline: Using Fallback Mode", "color: #fbbf24; font-weight: bold;");
}

const SUPABASE_URL = URL_VAL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = KEY_VAL || 'placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'public' },
  global: {
    headers: { 'x-client-info': 'iabs-web' },
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
  async updateArenaStatus(key: string, value: any) {
    if (!isConfigured) return { error: null };
    return await supabase.from('arena_status').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
  },
  async getAuditLogs(limit = 50) {
    return safeCall(supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit));
  },
  async logAction(admin: string, action: string, details: any) {
    if (!isConfigured) return { error: null };
    return await supabase.from('audit_logs').insert([{ admin_username: admin, action, details }]);
  }
};

export const leaderboardService = {
  async getTopPlayers(limit = 20) {
    if (!isConfigured) return [];
    const result = await safeCall(
      supabase.from('leaderboard').select('*, profiles(avatar_url, is_banned, credits)').order('score', { ascending: false }).limit(limit),
      { data: [], error: null }
    );
    return (result.data || []).map((item: any) => ({
      ...item,
      avatar_url: item.profiles?.avatar_url || item.avatar_url,
      is_banned: item.profiles?.is_banned,
      credits: item.profiles?.credits
    }));
  },
  async getPlayersWithPoints() {
    if (!isConfigured) return [];
    const result = await safeCall(
      supabase.from('leaderboard').select('*, profiles(avatar_url, is_banned, credits)').or('score.gt.0,wins.gt.0').order('score', { ascending: false }),
      { data: [], error: null }
    );
    return (result.data || []).map((item: any) => ({
      ...item,
      avatar_url: item.profiles?.avatar_url || item.avatar_url,
      is_banned: item.profiles?.is_banned,
      credits: item.profiles?.credits
    }));
  },
  async getAllRankedPlayers() {
    if (!isConfigured) return [];
    try {
      const [lbResult, profsResult] = await Promise.all([
        supabaseQuery(() => supabase.from('leaderboard').select('*, profiles(avatar_url, is_banned, credits, active_frame_url)').order('score', { ascending: false }), 3, 1000),
        supabaseQuery(() => supabase.from('profiles').select('*').gt('credits', 0), 3, 1000),
      ]);
      const lb = lbResult.data;
      const profs = profsResult.data;
      const byUser: Record<string, any> = {};
      (lb || []).forEach(item => {
        byUser[item.username] = {
          ...item,
          score: item.score || 0,
          wins: item.wins || 0,
          avatar_url: item.profiles?.avatar_url || item.avatar_url,
          is_banned: item.profiles?.is_banned,
          credits: item.profiles?.credits,
          active_frame_url: item.profiles?.active_frame_url
        };
      });
      (profs || []).forEach(p => {
        if (byUser[p.username]) {
          byUser[p.username] = {
            ...byUser[p.username],
            credits: p.credits,
            avatar_url: p.avatar_url || byUser[p.username].avatar_url,
            is_banned: p.is_banned,
            active_frame_url: p.active_frame_url
          };
        } else {
          byUser[p.username] = { id: p.id, username: p.username, score: 0, wins: 0, avatar_url: p.avatar_url, is_banned: p.is_banned, credits: p.credits, active_frame_url: p.active_frame_url };
        }
      });
      const combined = Object.values(byUser);
      combined.sort((a: any, b: any) => {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return (b.credits || 0) - (a.credits || 0);
      });
      return combined;
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
    if (!isConfigured || !username || username === 'Unknown') return;
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
        wins: (existing.wins || 0) + 1,
        score: (existing.score || 0) + points,
        last_win_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      // Use upsert to be completely safe against race conditions during insert
      await supabase.from('leaderboard').upsert([{
        username: normalizedUser,
        wins: 1,
        score: points,
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
  async verifyAdminPassword(inputPassword: string): Promise<boolean> {
    // 🔒 لا توجد نسخة محلية من كلمة السر داخل الحزمة — مصدر واحد فقط: Supabase
    if (!isConfigured) return false;
    const { data, error } = await supabase.from('app_config').select('value').eq('key', 'admin_password').single();
    if (error || !data?.value) return false;
    return data.value === inputPassword;
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
