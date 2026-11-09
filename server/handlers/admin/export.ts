import { supabaseAdmin, isSupabaseConfigured } from '../../lib/supabase';
import { audit, json, requireAdmin } from '../../lib/adminAuth';

const TABLES = [
    'profiles', 'leaderboard', 'users', 'bans', 'reports', 'support_tickets',
    'notifications', 'tournaments', 'tournament_registrations', 'games',
    'frames', 'user_frames', 'tiers', 'announcements', 'promo_codes',
    'admin_staff', 'arena_status', 'audit_logs', 'game_leaderboard', 'game_points',
];

const csvCell = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(table: string, rows: any[]) {
    if (!rows.length) return `${table},(فارغة)`;
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const head = [table, ...cols].join(',');
    const body = rows.map(r => [table, ...cols.map(c => csvCell(r[c]))].join(','));
    return [head, ...body].join('\n');
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const auth = await requireAdmin(req);
    if (!auth) return json(res, 401, { error: 'غير مصرح' });
    if (!isSupabaseConfigured) return json(res, 500, { error: 'لم تُهيَّأ قاعدة البيانات' });

    const format = String(req.query?.format || 'json') === 'csv' ? 'csv' : 'json';
    const table = req.query?.table ? String(req.query.table) : null;
    const wanted = table ? [table] : TABLES;

    const dumps: Record<string, any[]> = {};
    for (const t of wanted) {
        if (!TABLES.includes(t)) return json(res, 400, { error: `جدول غير مسموح بتصديره: ${t}` });
        const { data, error } = await supabaseAdmin.from(t).select('*').limit(10000);
        if (error) return json(res, 500, { error: `${t}: ${error.message}` });
        dumps[t] = data || [];
    }

    await audit(auth.staff.staff_name, 'ADMIN_EXPORT', { format, tables: wanted.length });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="icg1-backup-${stamp}.csv"`);
        return res.status(200).end(wanted.map(t => toCsv(t, dumps[t])).join('\n\n'));
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="icg1-backup-${stamp}.json"`);
    return res.status(200).end(JSON.stringify({
        exported_at: new Date().toISOString(),
        exported_by: auth.staff.staff_name,
        counts: Object.fromEntries(wanted.map(t => [t, dumps[t].length])),
        tables: dumps,
    }));
}
