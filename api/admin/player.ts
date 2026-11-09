import { supabaseAdmin } from '../_lib/supabase';
import { json, requireAdmin } from '../_lib/adminAuth';

const num = (v: any) => Math.round(Number(v) || 0);
const iso = (v: any) => (v ? String(v) : '');
const ok = (v: any) => v === true || v === 1 || v === '1' || v === 'true';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const auth = await requireAdmin(req);
    if (!auth) return json(res, 401, { error: 'غير مصرح' });

    const username = String(req.query?.username || '').trim().toLowerCase();
    if (!username) return json(res, 400, { error: 'اسم اللاعب مطلوب' });

    const [profR, boardR, tiersR, glR, ufR, framesR, txR, usersR, bansR, reportsR, auditR, gamesR] = await Promise.all([
        supabaseAdmin.from('profiles').select('*').eq('username', username).maybeSingle(),
        supabaseAdmin.from('leaderboard').select('*').eq('username', username).maybeSingle(),
        supabaseAdmin.from('tiers').select('*').eq('kind', 'rank').order('min_points', { ascending: true }),
        supabaseAdmin.from('game_leaderboard').select('game_code, plays, score, wins, best_event, last_win_at').eq('username', username),
        supabaseAdmin.from('user_frames').select('frame_id, is_equipped, source, purchased_at').eq('username', username),
        supabaseAdmin.from('frames').select('id, name, rarity'),
        supabaseAdmin.from('transactions').select('user_id, amount, description, type, created_at').order('created_at', { ascending: false }).limit(1000),
        supabaseAdmin.from('users').select('id, kick_username, is_verified, points, created_at').eq('kick_username', username).maybeSingle(),
        supabaseAdmin.from('bans').select('kind, reason, ends_at, status, created_at, banned_by').eq('username', username).order('created_at', { ascending: false }).limit(20),
        supabaseAdmin.from('reports').select('id, status, created_at, record_type, reason').eq('target_username', username).order('created_at', { ascending: false }).limit(20),
        supabaseAdmin.from('audit_logs').select('action, details, created_at, admin_username').order('created_at', { ascending: false }).limit(400),
        supabaseAdmin.from('games').select('view_id, title'),
    ]);

    if (profR.error) return json(res, 500, { error: profR.error.message });
    if (!profR.data && !boardR.data && !usersR.data) return json(res, 404, { error: 'لا يوجد لاعب بهذا الاسم' });

    const profile: any = profR.data || {};
    const board: any = boardR.data || {};
    const pts = num(board.score);

    let rank = '—';
    (tiersR.data || []).forEach((t: any) => { if (pts >= num(t.min_points)) rank = t.name; });

    const frameName = new Map((framesR.data || []).map((f: any) => [String(f.id), f]));
    const gameTitle = new Map((gamesR.data || []).map((g: any) => [String(g.view_id), g.title]));
    const items = (ufR.data || []).map((uf: any) => {
        const f: any = frameName.get(String(uf.frame_id)) || {};
        return {
            name: f.name || String(uf.frame_id), rarity: f.rarity || '—',
            status: ok(uf.is_equipped) ? 'مجهّز' : 'غير مجهّز', source: uf.source || 'purchase', time: iso(uf.purchased_at),
        };
    });
    const games = (glR.data || []).map((g: any) => ({
        name: gameTitle.get(String(g.game_code)) || String(g.game_code),
        plays: num(g.plays), points: num(g.score), wins: num(g.wins), best: String(g.best_event ?? ''), last_play: iso(g.last_win_at),
    })).sort((a, b) => b.points - a.points);

    const accountId = usersR.data?.id || profile.id || null;
    const spend = accountId
        ? (txR.data || []).filter((t: any) => t.user_id === accountId && num(t.amount) < 0).reduce((a: number, t: any) => a + -num(t.amount), 0)
        : 0;

    const history = (auditR.data || [])
        .filter((a: any) => {
            const d = a.details || {};
            const hit = [d.target, d.username, d.code, d.name, d.id].some((v: any) => String(v ?? '').toLowerCase() === username);
            return hit;
        })
        .slice(0, 20)
        .map((a: any) => ({ time: iso(a.created_at), label: a.action, detail: `${a.admin_username}: ${JSON.stringify(a.details || {})}` }));

    const activeSanctions = (bansR.data || [])
        .filter((b: any) => b.status === 'active')
        .map((b: any) => ({ type: b.kind || 'حظر', reason: b.reason || '', end: iso(b.ends_at) }));

    return json(res, 200, {
        id: username, name: username,
        pts, bal: num(profile.credits), wins: num(board.wins),
        rank,
        member: profile.membership === 'vip' && (!profile.membership_expires_at || new Date(profile.membership_expires_at) > new Date()) ? 'VIP' : 'عادية',
        status: profile.is_banned || activeSanctions.length ? 'محظور' : 'نشط',
        note: profile.admin_note || '',
        avatar: board.avatar_url || profile.avatar_url || '',
        last_seen: iso(profile.updated_at || board.last_win_at || usersR.data?.created_at),
        verified: ok(usersR.data?.is_verified),
        accountPoints: num(usersR.data?.points),
        games, spend, items,
        reportsAbout: (reportsR.data || []).length,
        recentReports: (reportsR.data || []).slice(0, 5).map((r: any) => ({
            kind: r.record_type === 'appeal' ? 'اعتراض' : 'بلاغ', reason: r.reason || '', status: r.status, time: iso(r.created_at),
        })),
        sanctions: (bansR.data || []).map((b: any) => ({
            type: b.kind || 'حظر', reason: b.reason || '', end: iso(b.ends_at),
            admin: b.banned_by || '', status: b.status, time: iso(b.created_at),
        })),
        activeSanctions,
        history,
    });
}
