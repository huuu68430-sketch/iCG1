import { clampText, json, reqBody, requireMember, supabaseAdmin } from '../../lib/memberHttp';

export default async function handler(req: any, res: any) {
    const m = await requireMember(req);
    if (!m) return json(res, 401, { ok: false, error: 'سجّل دخولك أولاً' });

    if (req.method === 'GET') {
        const { data: prof } = await supabaseAdmin.from('profiles')
            .select('membership, membership_expires_at').eq('username', m.username).maybeSingle();
        const isVip = prof?.membership === 'vip' && (!prof?.membership_expires_at || new Date(prof.membership_expires_at) > new Date());

        const [{ data: rows }, { data: reads }] = await Promise.all([
            supabaseAdmin.from('notifications')
                .select('id, title, body, audience, target_username, sent_at')
                .eq('status', 'sent')
                .order('sent_at', { ascending: false }).limit(100),
            supabaseAdmin.from('notification_reads').select('notification_id').eq('username', m.username).limit(2000),
        ]);

        const readSet = new Set((reads || []).map((r: any) => String(r.notification_id)));
        const visible = (rows || [])
            .filter((n: any) => n.audience === 'all'
                || (n.audience === 'vip' && isVip)
                || (n.audience === 'player' && String(n.target_username || '').toLowerCase() === m.username))
            .slice(0, 40)
            .map((n: any) => ({ ...n, read: readSet.has(String(n.id)) }));

        return json(res, 200, { ok: true, notifications: visible, unread: visible.filter((n: any) => !n.read).length });
    }

    if (req.method === 'POST') {
        const b = reqBody(req);
        if (b.all) {
            const { data: rows } = await supabaseAdmin.from('notifications').select('id').eq('status', 'sent').limit(200);
            const ids = (rows || []).map((r: any) => r.id);
            if (ids.length) {
                const { data: exist } = await supabaseAdmin.from('notification_reads').select('notification_id').eq('username', m.username).limit(2000);
                const have = new Set((exist || []).map((e: any) => String(e.notification_id)));
                const add = ids.filter((id: string) => !have.has(String(id))).map((id: string) => ({ notification_id: id, username: m.username }));
                if (add.length) await supabaseAdmin.from('notification_reads').insert(add);
            }
            return json(res, 200, { ok: true });
        }
        const id = clampText(b.id, 60);
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { ok: false, error: 'معرّف غير صالح' });
        const { error } = await supabaseAdmin.from('notification_reads')
            .upsert({ notification_id: id, username: m.username }, { onConflict: 'notification_id,username' });
        if (error) return json(res, 500, { ok: false, error: error.message });
        return json(res, 200, { ok: true });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
}
