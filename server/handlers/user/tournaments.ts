import { clampText, json, rateLimit, reqBody, requireMember, supabaseAdmin } from '../../lib/memberHttp';

const STATUS_AR: Record<string, string> = { draft: 'مسودة', open: 'التسجيل مفتوح', closed: 'التسجيل مغلق', running: 'جارية', completed: 'مكتملة' };

async function loadCard(id: string) {
    const { data } = await supabaseAdmin.from('tournaments').select('*').eq('id', id).maybeSingle();
    return data;
}

export default async function handler(req: any, res: any) {
    const m = await requireMember(req);
    if (!m) return json(res, 401, { ok: false, error: 'سجّل دخولك أولاً' });

    if (req.method === 'GET') {
        const [{ data: tours }, { data: regs }, { data: games }] = await Promise.all([
            supabaseAdmin.from('tournaments').select('*').in('status', ['open', 'closed', 'running']).order('starts_at', { ascending: false }).limit(30),
            supabaseAdmin.from('tournament_registrations').select('tournament_id, username').eq('username', m.username).limit(200),
            supabaseAdmin.from('games').select('view_id, title').limit(100),
        ]);
        const titleOf = new Map((games || []).map((g: any) => [String(g.view_id), g.title]));
        const mine = new Set((regs || []).map((r: any) => String(r.tournament_id)));
        const counts = await Promise.all((tours || []).map(t =>
            supabaseAdmin.from('tournament_registrations').select('username').eq('tournament_id', t.id).limit(500)
        ));
        const tournaments = (tours || []).map((t: any, i: number) => ({
            id: t.id, name: t.name, game: titleOf.get(String(t.game_code)) || t.game_code || '',
            starts_at: t.starts_at, prize: t.prize, note: t.note || '',
            max: t.max_players, registered: (counts[i].data || []).length,
            status: t.status, status_ar: STATUS_AR[t.status] || t.status,
            mine: mine.has(String(t.id)),
        }));
        return json(res, 200, { ok: true, tournaments });
    }

    const id = clampText(reqBody(req).id || req.query?.id, 60);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { ok: false, error: 'معرّف البطولة غير صالح' });

    if (req.method === 'POST') {
        const rl = await rateLimit(`member-tour:${m.username}`, 12, 3600);
        if (!rl.allowed) return json(res, 429, { ok: false, error: 'محاولات كثيرة — انتظر قليلاً' });
        const t = await loadCard(id);
        if (!t) return json(res, 404, { ok: false, error: 'البطولة غير موجودة' });
        if (t.status !== 'open') return json(res, 400, { ok: false, error: 'التسجيل مغلق حالياً' });
        const { data: prof } = await supabaseAdmin.from('profiles').select('is_banned').eq('username', m.username).maybeSingle();
        if (prof?.is_banned) return json(res, 403, { ok: false, error: 'حسابك محظور' });
        const { count } = await supabaseAdmin.from('tournament_registrations')
            .select('username', { count: 'exact', head: true }).eq('tournament_id', id);
        if (t.max_players > 0 && (count || 0) >= t.max_players) return json(res, 409, { ok: false, error: 'اكتمل العدد' });
        const { error } = await supabaseAdmin.from('tournament_registrations').insert({ tournament_id: id, username: m.username });
        if (error) {
            if (/duplicate key/i.test(error.message)) return json(res, 409, { ok: false, error: 'أنت مسجّل مسبقاً' });
            return json(res, 500, { ok: false, error: error.message });
        }
        await supabaseAdmin.from('notifications').insert({
            title: `تسجيل في ${t.name}`, body: `تم تسجيلك في بطولة ${t.name}.`,
            audience: 'player', target_username: m.username, status: 'sent', created_by: 'SYSTEM',
        });
        return json(res, 200, { ok: true, data: { registered: true } });
    }

    if (req.method === 'DELETE') {
        const t = await loadCard(id);
        if (!t) return json(res, 404, { ok: false, error: 'البطولة غير موجودة' });
        if (t.status !== 'open') return json(res, 400, { ok: false, error: 'لا يمكن الانسحاب بعد إغلاق التسجيل' });
        const { error } = await supabaseAdmin.from('tournament_registrations').delete().eq('tournament_id', id).eq('username', m.username);
        if (error) return json(res, 500, { ok: false, error: error.message });
        return json(res, 200, { ok: true, data: { registered: false } });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
}
