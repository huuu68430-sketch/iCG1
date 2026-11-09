import { clampText, json, reqBody, requireMember, supabaseAdmin } from '../../lib/memberHttp';

export default async function handler(req: any, res: any) {
    const m = await requireMember(req);
    if (!m) return json(res, 401, { ok: false, error: 'سجّل دخولك أولاً' });

    if (req.method === 'GET') {
        // ترقية المجَدول الذي حان وقته، ثم عرض المنشور فقط
        const { data: due } = await supabaseAdmin.from('announcements')
            .select('id').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString()).limit(20);
        if (due?.length) {
            await supabaseAdmin.from('announcements')
                .update({ status: 'published', is_active: true, published_at: new Date().toISOString() })
                .in('id', due.map((d: any) => d.id));
        }

        const [{ data: rows }, { data: dismissed }] = await Promise.all([
            supabaseAdmin.from('announcements')
                .select('id, title, content, kind, published_at, created_at')
                .eq('status', 'published').eq('is_active', true)
                .order('published_at', { ascending: false }).limit(20),
            supabaseAdmin.from('announcement_dismissals').select('announcement_id').eq('username', m.username).limit(200),
        ]);
        const gone = new Set((dismissed || []).map((d: any) => String(d.announcement_id)));
        return json(res, 200, {
            ok: true,
            announcements: (rows || [])
                .filter(r => !gone.has(String(r.id)))
                .map(r => ({
                    id: r.id, title: r.title || String(r.content || '').slice(0, 40),
                    body: r.content || '', kind: r.kind || 'عام', at: r.published_at || r.created_at,
                })),
        });
    }

    if (req.method === 'POST') {
        const id = clampText(reqBody(req).id, 60);
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { ok: false, error: 'معرّف غير صالح' });
        const { error } = await supabaseAdmin.from('announcement_dismissals')
            .upsert({ username: m.username, announcement_id: id }, { onConflict: 'username,announcement_id' });
        if (error) return json(res, 500, { ok: false, error: error.message });
        return json(res, 200, { ok: true });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
}
