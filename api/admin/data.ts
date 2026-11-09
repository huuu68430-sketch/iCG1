import { supabaseAdmin, isSupabaseConfigured } from '../_lib/supabase';
import { json, requireAdmin } from '../_lib/adminAuth';
import { GAME_POINTS } from '../../services/gameRewards';

/* تسميات عربية جاهزة للعرض — السيرفر يحوّل، والواجهة تعرض فقط. */
const BAN_STATUS: Record<string, string> = { active: 'نشط', expired: 'منتهي', lifted: 'مرفوعة' };
const REPORT_STATUS: Record<string, string> = { new: 'جديد', reviewing: 'قيد المراجعة', accepted: 'مقبول', rejected: 'مرفوض', closed: 'مغلق' };
const TICKET_STATUS: Record<string, string> = { new: 'جديدة', reviewing: 'قيد المراجعة', resolved: 'تم الحل', closed: 'مغلقة' };
const TOUR_STATUS: Record<string, string> = { draft: 'مسودة', open: 'التسجيل مفتوح', closed: 'التسجيل مغلق', running: 'جارية', completed: 'مكتملة' };
const ANN_STATUS: Record<string, string> = { draft: 'مسودة', scheduled: 'مجدول', published: 'منشور' };
const NOTIF_STATUS: Record<string, string> = { draft: 'مسودة', scheduled: 'مجدول', sent: 'تم الإرسال' };
const AUDIENCE: Record<string, string> = { all: 'جميع اللاعبين', vip: 'أعضاء VIP', player: 'لاعب محدد' };
const KIND_AR: Record<string, string> = {
    'سلوك مخالف': 'سلوك مخالف', 'تعليق مسيء': 'تعليق مسيء', 'غش في لعبة': 'غش في لعبة',
    'انتحال حساب': 'انتحال حساب', 'محتوى غير لائق': 'محتوى غير لائق', 'إساءة لمستخدم': 'إساءة لمستخدم', 'أخرى': 'أخرى',
};

const ok = (v: any) => (v === true || v === 1 || v === 'true' || v === '1');
const num = (v: any) => Math.round(Number(v) || 0);
const iso = (v: any) => (v ? String(v) : '');

/** سلّم الرُتب من القاعدة — لا سلّم مكتوب في الكود. */
const rankFromPoints = (tiers: any[], points: number) => {
    let name = '—';
    tiers
        .filter(t => t.kind === 'rank' && ok(t.is_active))
        .sort((a, b) => num(a.min_points) - num(b.min_points))
        .forEach(t => { if (points >= num(t.min_points)) name = t.name; });
    return name;
};

async function buildData() {
    const [
        ov, activity, rankings,
        profilesR, boardR, bansR, reportsR, gamesR, glR, tourR, regR,
        framesR, ufR, txR, usersR, tiersR, annR, notifR, readsR,
        ticketsR, staffR, promoR, arenaR, auditR, healthR, integR, exportR,
    ] = await Promise.all([
        supabaseAdmin.rpc('admin_overview'),
        supabaseAdmin.rpc('admin_activity', { p_days: 30 }),
        supabaseAdmin.rpc('admin_game_rankings'),
        supabaseAdmin.from('profiles').select('id, username, credits, is_banned, admin_note, membership, membership_expires_at, active_frame_id, avatar_url, updated_at, created_at').order('created_at', { ascending: false }).limit(1000),
        supabaseAdmin.from('leaderboard').select('username, score, wins, avatar_url, last_win_at').limit(1000),
        supabaseAdmin.from('bans').select('*').order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.from('games').select('*').order('position', { ascending: true }).limit(100),
        supabaseAdmin.from('game_leaderboard').select('game_code, username, plays, score, wins').limit(5000),
        supabaseAdmin.from('tournaments').select('*').order('starts_at', { ascending: false }).limit(100),
        supabaseAdmin.from('tournament_registrations').select('tournament_id, username').limit(5000),
        supabaseAdmin.from('frames').select('*').order('sort_order', { ascending: true }).limit(200),
        supabaseAdmin.from('user_frames').select('id, username, frame_id, is_equipped, source, purchased_at').limit(1000),
        supabaseAdmin.from('transactions').select('amount, type, description, user_id, created_at').order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('users').select('id, kick_username, display_name, is_verified').limit(500),
        supabaseAdmin.from('tiers').select('*').order('sort', { ascending: true }).limit(100),
        supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('notifications').select('*').order('sent_at', { ascending: false }).limit(200),
        supabaseAdmin.from('notification_reads').select('notification_id, username').limit(5000),
        supabaseAdmin.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.from('admin_staff').select('*').order('created_at', { ascending: true }).limit(100),
        supabaseAdmin.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('arena_status').select('key, value'),
        supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.rpc('admin_db_health'),
        supabaseAdmin.rpc('admin_integrity_check'),
        supabaseAdmin.from('audit_logs').select('created_at').eq('action', 'ADMIN_EXPORT').order('created_at', { ascending: false }).limit(1),
    ]);

    if (ov.error) throw new Error(`admin_overview: ${ov.error.message}`);

    const profiles: any[] = profilesR.data || [];
    const board: any[] = boardR.data || [];
    const tiers: any[] = tiersR.data || [];
    const frames: any[] = framesR.data || [];
    const games: any[] = gamesR.data || [];
    const gl: any[] = glR.data || [];
    const userFrames: any[] = ufR.data || [];
    const staff: any[] = staffR.data || [];
    const audit: any[] = auditR.data || [];
    const users: any[] = usersR.data || [];

    const boardBy = new Map(board.map(b => [String(b.username).toLowerCase(), b]));
    const verifiedSet = new Set(users.filter(u => ok(u.is_verified)).map(u => String(u.kick_username).toLowerCase()));
    const activeBanSet = new Set((bansR.data || []).filter((b: any) => b.status === 'active').map((b: any) => String(b.username).toLowerCase()));

    /* ---- اللاعبون: ملفات حقيقية من profiles + leaderboard ---- */
    const seen = new Map<string, any>();
    profiles.forEach((p: any) => {
        const key = String(p.username || '').toLowerCase();
        if (!key) return;
        const b = boardBy.get(key);
        const pts = num(b?.score);
        seen.set(key, {
            id: key, name: String(p.username), pts,
            bal: num(p.credits), wins: num(b?.wins),
            rank: rankFromPoints(tiers, pts),
            member: p.membership === 'vip' && (!p.membership_expires_at || new Date(p.membership_expires_at) > new Date()) ? 'VIP' : 'عادية',
            status: ok(p.is_banned) || activeBanSet.has(key) ? 'محظور' : 'نشط',
            note: p.admin_note || '',
            avatar: b?.avatar_url || p.avatar_url || '',
            last_seen: iso(p.updated_at || p.created_at),
            spend: 0,
            items: [], reportsAbout: 0, activeSanctions: [], history: [],
        });
    });
    // أسماء في اللوحة بلا ملف (لاعبون قداما) — تظهر حتى لا تضيع نقاطها
    board.forEach((b: any) => {
        const key = String(b.username).toLowerCase();
        if (seen.has(key) || !key) return;
        const pts = num(b.score);
        seen.set(key, {
            id: key, name: String(b.username), pts, bal: 0, wins: num(b.wins),
            rank: rankFromPoints(tiers, pts), member: 'عادية', status: 'نشط',
            note: '', avatar: b.avatar_url || '', last_seen: iso(b.last_win_at),
            spend: 0, items: [], reportsAbout: 0, activeSanctions: [], history: [],
        });
    });
    const frameName = new Map(frames.map((f: any) => [String(f.id), f.name]));
    const byUserFrames = new Map<string, any[]>();
    userFrames.forEach((uf: any) => {
        const k = String(uf.username).toLowerCase();
        byUserFrames.set(k, [...(byUserFrames.get(k) || []), uf]);
    });
    const spendByUser = new Map<string, number>();
    (txR.data || []).forEach((t: any) => {
        if (num(t.amount) >= 0) return;
        const u = users.find(x => x.id === t.user_id);
        const k = String(u?.kick_username || '').toLowerCase();
        if (k) spendByUser.set(k, (spendByUser.get(k) || 0) + -num(t.amount));
    });
    (reportsR.data || []).forEach((r: any) => {
        const k = String(r.target_username || '').toLowerCase();
        const row = seen.get(k);
        if (row) row.reportsAbout += 1;
    });
    (bansR.data || []).filter((b: any) => b.status === 'active').forEach((b: any) => {
        const row = seen.get(String(b.username).toLowerCase());
        if (row) row.activeSanctions.push({ type: b.kind || 'حظر', reason: b.reason || '', end: iso(b.ends_at) });
    });
    const playsByUser = new Map<string, number>();
    gl.forEach((g: any) => {
        const k = String(g.username).toLowerCase();
        playsByUser.set(k, (playsByUser.get(k) || 0) + num(g.plays));
    });
    const usersOut = [...seen.values()]
        .map((u: any) => {
            const owned = byUserFrames.get(u.id) || [];
            const perGame = new Map<string, { plays: number; points: number }>();
            gl.filter(g => String(g.username).toLowerCase() === u.id).forEach((g: any) => {
                const name = games.find((x: any) => x.view_id === g.game_code)?.title || g.game_code;
                const cur = perGame.get(name) || { name, plays: 0, points: 0 };
                cur.plays += num(g.plays); cur.points += num(g.score);
                perGame.set(name, cur);
            });
            return {
                ...u,
                spend: spendByUser.get(u.id) || 0,
                items: owned.map((uf: any) => ({
                    name: frameName.get(String(uf.frame_id)) || String(uf.frame_id),
                    rarity: frames.find((f: any) => String(f.id) === String(uf.frame_id))?.rarity || '—',
                    status: ok(uf.is_equipped) ? 'مجهّز' : 'غير مجهّز',
                })),
                history: audit.filter(a => String(a.details?.username || a.details?.target || '').toLowerCase() === u.id)
                    .slice(0, 12)
                    .map(a => ({ time: iso(a.created_at), label: a.action, detail: JSON.stringify(a.details || {}) })),
                totalPlays: playsByUser.get(u.id) || 0,
            };
        })
        .sort((a: any, b: any) => b.pts - a.pts);

    /* ---- التحليلات ---- */
    const series: any[] = (activity.data || []).map((r: any) => ({
        day: String(r.day), plays: num(r.plays), points: num(r.points),
        new_players: num(r.new_players), spend: num(r.spend),
    }));
    const gameNameByCode = new Map(games.map((g: any) => [String(g.view_id), g.title]));
    const rankingsOut: any[] = (rankings.data || []).map((r: any) => ({
        game_code: String(r.game_code),
        name: gameNameByCode.get(String(r.game_code)) || String(r.game_code),
        plays: num(r.plays), points: num(r.points), players: num(r.players),
        last_play: iso(r.last_play),
    }));
    const soldByFrame = new Map<string, number>();
    userFrames.forEach((uf: any) => {
        const k = String(uf.frame_id);
        soldByFrame.set(k, (soldByFrame.get(k) || 0) + 1);
    });
    const topSellers = frames
        .map((f: any) => ({ name: f.name, sold: soldByFrame.get(String(f.id)) || 0, revenue: (soldByFrame.get(String(f.id)) || 0) * num(f.price) }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 8);

    // اللاعبون النشطون محسوبون من game_points فعلياً: كل حدث نقاط يحمل اسم اللاعب وتاريخه
    const recentPoints = await supabaseAdmin.from('game_points').select('username, created_at').order('created_at', { ascending: false }).limit(10000);
    const nowMs = Date.now();
    const activeWithin = (days: number) => {
        const cutoff = nowMs - days * 86400000;
        const set = new Set<string>();
        (recentPoints.data || []).forEach((p: any) => {
            if (new Date(p.created_at).getTime() >= cutoff) set.add(String(p.username).toLowerCase());
        });
        return set.size;
    };

    /* ---- بقية الأقسام ---- */
    const sanctions = (bansR.data || []).map((b: any) => ({
        id: b.id, player: b.username, type: b.kind || 'حظر دائم', reason: b.reason || '',
        end: iso(b.ends_at), admin: b.banned_by || 'المشرف العام',
        status: BAN_STATUS[b.status] || 'نشط',
    }));

    const reports = (reportsR.data || []).map((r: any) => ({
        id: r.id, from: r.reporter_username, target: r.target_username || '—',
        kind: r.record_type === 'appeal' ? 'اعتراض على عقوبة' : (KIND_AR[r.kind] || r.kind || 'سلوك مخالف'),
        reason: r.reason || '', time: iso(r.created_at),
        status: REPORT_STATUS[r.status] || 'جديد',
    }));

    const glAgg = new Map<string, { plays: number; players: Set<string> }>();
    gl.forEach((g: any) => {
        const cur = glAgg.get(g.game_code) || { plays: 0, players: new Set<string>() };
        cur.plays += num(g.plays); cur.players.add(String(g.username).toLowerCase());
        glAgg.set(g.game_code, cur);
    });
    const gamesOut = games.map((g: any) => {
        const agg = glAgg.get(String(g.view_id));
        return {
            id: g.id, code: g.view_id, name: g.title,
            plays: agg ? agg.plays : 0, players: agg ? agg.players.size : 0,
            reward: num(GAME_POINTS[String(g.view_id)]?.match ?? 0),
            position: num(g.position),
            status: !ok(g.is_active) ? 'موقوف' : (!ok(g.is_visible) ? 'مخفية' : 'نشط'),
        };
    });

    const regCount = new Map<string, number>();
    (regR.data || []).forEach((r: any) => {
        regCount.set(String(r.tournament_id), (regCount.get(String(r.tournament_id)) || 0) + 1);
    });
    const tournaments = (tourR.data || []).map((t: any) => ({
        id: t.id, name: t.name, game: gameNameByCode.get(String(t.game_code)) || t.game_code || '—',
        start: iso(t.starts_at), registered: regCount.get(String(t.id)) || 0,
        max: num(t.max_players), prize: num(t.prize),
        status: TOUR_STATUS[t.status] || 'مسودة', note: t.note || '',
    }));

    const nameByUserId = new Map(users.map(u => [String(u.id), u.kick_username]));
    const transactions = (txR.data || []).map((t: any) => ({
        time: iso(t.created_at),
        player: nameByUserId.get(String(t.user_id)) || String(t.user_id).slice(0, 8),
        detail: `${t.description || t.type || ''}`,
        amount: num(t.amount),
    }));

    const store = frames.map((f: any) => ({
        id: f.id, name: f.name, description: f.description || '', rarity: f.rarity || 'عادي',
        price: num(f.price), sold: soldByFrame.get(String(f.id)) || 0,
        sort: num(f.sort_order), is_active: ok(f.is_active) ? 1 : 0,
        status: ok(f.is_active) ? 'نشط' : 'مخفي',
    }));

    const inventory = userFrames.map((uf: any) => {
        const f = frames.find((x: any) => String(x.id) === String(uf.frame_id));
        return {
            id: uf.id, player: uf.username, item: f?.name || String(uf.frame_id),
            frame_id: String(uf.frame_id), rarity: f?.rarity || '—',
            source: uf.source === 'admin' ? 'منح إداري' : uf.source === 'tournament' ? 'جائزة بطولة' : 'شراء',
            status: ok(uf.is_equipped) ? 'مجهّز' : 'غير مجهّز', time: iso(uf.purchased_at),
        };
    });

    const tiersOut = tiers.map((t: any) => ({
        id: t.id, name: t.name, kind: t.kind === 'membership' ? 'عضوية' : 'رتبة',
        min: num(t.min_points), discount: num(t.discount_pct), duration: num(t.duration_days),
        perk: t.perk || (t.kind === 'membership' ? '—' : 'رتبة'),
        status: ok(t.is_active) ? 'نشط' : 'موقوف',
    }));

    const announcements = (annR.data || []).map((a: any) => ({
        id: a.id, title: a.title || String(a.content || '').slice(0, 40), body: a.content || '',
        kind: a.kind || 'عام', when: a.scheduled_at ? 'جدولة' : 'نشر فوري',
        scheduled_at: iso(a.scheduled_at), time: iso(a.published_at || a.created_at),
        status: a.status && ANN_STATUS[a.status] ? ANN_STATUS[a.status] : (ok(a.is_active) ? 'منشور' : 'مسودة'),
    }));

    const readCount = new Map<string, number>();
    (readsR.data || []).forEach((r: any) => readCount.set(String(r.notification_id), (readCount.get(String(r.notification_id)) || 0) + 1));
    const notifications = (notifR.data || []).map((n: any) => ({
        id: n.id, title: n.title, body: n.body || '',
        to: AUDIENCE[n.audience] || 'جميع اللاعبين',
        target: n.target_username || '', time: iso(n.sent_at),
        read: readCount.get(String(n.id)) || 0,
        status: NOTIF_STATUS[n.status] || 'تم الإرسال',
    }));

    const tickets = (ticketsR.data || []).map((t: any) => ({
        id: t.id, subj: t.subject, cat: t.category || 'مشكلة تقنية',
        pri: t.priority || 'متوسطة', from: t.username, body: t.body || '', reply: t.reply || '',
        time: iso(t.created_at), status: TICKET_STATUS[t.status] || 'جديدة',
    }));

    const staffOut = staff.map((s: any) => ({
        id: s.id, name: s.staff_name, role: s.role,
        perm: Array.isArray(s.permissions) && s.permissions.includes('*') ? 'كل الصلاحيات' : (s.permissions || []).join('، ') || 'قراءة فقط',
        permissions: s.permissions || [], last: iso(s.last_login),
        status: ok(s.is_active) ? 'نشط' : 'موقوف',
    }));

    const promos = (promoR.data || []).map((p: any) => {
        const expired = p.expires_at && new Date(p.expires_at) < new Date();
        const maxed = num(p.max_uses) > 0 && num(p.current_uses) >= num(p.max_uses);
        return {
            id: p.id, code: p.code, val: num(p.reward_amount), used: num(p.current_uses),
            max: num(p.max_uses), end: iso(p.expires_at), note: p.note || '',
            status: !ok(p.is_active) ? 'موقوف' : expired ? 'منتهي' : maxed ? 'مكتمل' : 'نشط',
        };
    });

    const arenaVals: Record<string, any> = {};
    (arenaR.data || []).forEach((a: any) => { arenaVals[a.key] = typeof a.value === 'string' ? JSON.parse(a.value || '{}') : (a.value || {}); });
    const mood = arenaVals.global_mood || {};
    const audio = arenaVals.audio_overlay || {};
    const arena = {
        theme: mood.theme || 'default',
        particles: mood.particles || 'none',
        audio: { enabled: ok(audio.enabled), volume: num(audio.volume ?? 50), url: audio.url || '' },
    };

    const auditOut = audit.map((a: any) => ({
        id: a.id, time: iso(a.created_at), admin: a.admin_username, type: a.action,
        target: String(a.details?.target ?? a.details?.username ?? a.details?.code ?? a.details?.name ?? ''),
        detail: JSON.stringify(a.details || {}),
    }));

    const integrity = integR.data && !integR.error ? integR.data : {};
    const health = (healthR.data || []).map((h: any) => ({
        table_name: h.table_name, rows: num(h.rows), size: String(h.size ?? '—'),
    }));

    const overview = {
        ...(ov.data || {}),
        plays: num((ov.data as any)?.plays), points: num((ov.data as any)?.points),
        credits: num((ov.data as any)?.credits), wins: num((ov.data as any)?.wins),
        spend: num((ov.data as any)?.spend), visits: num((ov.data as any)?.visits),
    };

    return {
        overview,
        analytics: {
            series,
            rankings: rankingsOut,
            topSellers,
            dau: { today: activeWithin(1), week: activeWithin(7), month: activeWithin(30) },
        },
        users: usersOut,
        sanctions, reports, games: gamesOut, tournaments,
        economy: { transactions },
        store, inventory,
        tiers: tiersOut,
        announcements, notifications, tickets,
        staff: staffOut, promos, arena,
        audit: auditOut,
        system: {
            health,
            integrity,
            lastExport: exportR.data?.[0]?.created_at || null,
            migrationsApplied: usersOut.length >= 0 && (staffOut.length > 0),
        },
        options: {
            frames: frames.map((f: any) => String(f.id)),
            tiers: tiers.map((t: any) => t.name),
            staffNames: staff.map((s: any) => s.staff_name),
        },
    };
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const auth = await requireAdmin(req);
    if (!auth) return json(res, 401, { error: 'غير مصرح' });
    if (!isSupabaseConfigured) return json(res, 500, { error: 'لم تُهيَّأ قاعدة البيانات' });
    try {
        const data = await buildData();
        return json(res, 200, data);
    } catch (e: any) {
        console.error('[admin/data]', e?.message || e);
        return json(res, 500, { error: `تعذّر تحميل البيانات: ${e?.message || 'خطأ غير معروف'}` });
    }
}
