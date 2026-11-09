import { supabaseAdmin } from '../../lib/supabase';
import { audit, body, canAccess, json, requireAdmin } from '../../lib/adminAuth';
import { rateLimit } from '../../lib/rateLimit';
import { clientIp } from '../../lib/adminAuth';

/**
 * كل كتابة إدارية في اللوحة تمر من هنا. القاعدة الصارمة:
 *  • لا تنفيذ قبل فحص صلاحية المشرف على القسم.
 *  • كل عملية تُكتب في audit_logs بعد نجاحها.
 *  • لا أمر يمس البيانات الشخصية للاعب غير الملاحظة الإدارية.
 */

const SECTIONS_WITH_WRITE = ['sanc', 'reports', 'games', 'tour', 'store', 'inv', 'mem', 'ann', 'notif', 'sup', 'staff', 'promo', 'users'] as const;

/** مفتاح الحقل في النموذج → عمود في القاعدة */
const FIELD_COL: Record<string, Record<string, string>> = {
    sanc: { player: 'username', type: 'kind', reason: 'reason', end: 'ends_at', admin: 'banned_by' },
    reports: { from: 'reporter_username', target: 'target_username', kind: 'kind', reason: 'reason' },
    games: { name: 'title', position: 'position' },
    tour: { name: 'name', game: 'game_code', start: 'starts_at', max: 'max_players', prize: 'prize', note: 'note' },
    store: { name: 'name', description: 'description', rarity: 'rarity', price: 'price', sort: 'sort_order', is_active: 'is_active' },
    inv: { player: 'username', item: 'frame_id' },
    mem: { name: 'name', kind: 'kind', min: 'min_points', discount: 'discount_pct', duration: 'duration_days', perk: 'perk' },
    ann: { title: 'title', body: 'content', kind: 'kind', when: 'when', scheduled_at: 'scheduled_at' },
    notif: { title: 'title', body: 'body', to: 'audience', target: 'target_username' },
    sup: { subj: 'subject', cat: 'category', pri: 'priority', from: 'username', body: 'body' },
    staff: { name: 'staff_name', role: 'role', perm: 'perm' },
    promo: { code: 'code', val: 'reward_amount', max: 'max_uses', end: 'expires_at', note: 'note' },
};

const NUMBER_COLS: Record<string, string[]> = {
    games: ['position'], tour: ['max_players', 'prize'], store: ['price', 'sort_order'],
    mem: ['min_points', 'discount_pct', 'duration_days'], promo: ['reward_amount', 'max_uses'],
    notif: [], ann: [],
};
const BOOL_COLS: Record<string, string[]> = {
    store: ['is_active'],
};
const AR_TO_EN: Record<string, string> = {
    'نشط': 'active', 'منتهي': 'expired', 'مرفوعة': 'lifted',
    'جديد': 'new', 'قيد المراجعة': 'reviewing', 'مقبول': 'accepted', 'مرفوض': 'rejected', 'مغلق': 'closed',
    'جديدة': 'new', 'تم الحل': 'resolved', 'مغلقة': 'closed',
    'مسودة': 'draft', 'التسجيل مفتوح': 'open', 'التسجيل مغلق': 'closed', 'جارية': 'running', 'مكتملة': 'completed',
    'منشور': 'published', 'مجدول': 'scheduled', 'تم الإرسال': 'sent',
    'رتبة': 'rank', 'عضوية': 'membership',
    'جميع اللاعبين': 'all', 'أعضاء VIP': 'vip', 'لاعب محدد': 'player',
    'كل الصلاحيات': '*',
    'شراء': 'purchase', 'منح إداري': 'admin', 'جائزة بطولة': 'tournament',
    'نشر فوري': 'now', 'جدولة': 'schedule',
};
const norm = (v: any) => (typeof v === 'string' && AR_TO_EN[v] !== undefined ? AR_TO_EN[v] : v);

const isDate = (col: string) => ['ends_at', 'starts_at', 'scheduled_at', 'expires_at', 'published_at'].includes(col);
const isMemberCol = (col: string) => ['membership'].includes(col);

function translateValues(section: string, values: Record<string, any>) {
    const map = FIELD_COL[section] || {};
    const nums = NUMBER_COLS[section] || [];
    const bools = BOOL_COLS[section] || [];
    const out: Record<string, any> = {};
    Object.entries(values || {}).forEach(([k, raw]) => {
        const col = map[k];
        if (!col) return;
        let v = norm(raw);
        if (k === 'perm') {
            v = Array.isArray(raw) ? raw : (String(raw || '').trim() === '*' || raw === 'كل الصلاحيات' ? ['*'] : String(raw || '').split(/[،,]/).map((x: string) => x.trim()).filter(Boolean));
        } else if (bools.includes(col)) {
            v = raw === true || raw === 1 || raw === '1' || raw === 'on';
        } else if (nums.includes(col)) {
            v = Math.round(Number(v) || 0);
        } else if (isDate(col)) {
            v = v ? new Date(v).toISOString() : null;
        } else if (isMemberCol(col)) {
            v = String(v || '').toUpperCase() === 'VIP' ? 'vip' : null;
        } else if (typeof v === 'string') {
            v = v.trim();
        }
        out[col] = v;
    });
    return out;
}

const fail = (res: any, msg: string) => json(res, 400, { ok: false, error: msg });
const num = (v: any) => Math.round(Number(v) || 0);

/** أنواع الأخطاء التي تعني أن التوسعة لم تُنفَّذ بعد، لا خطأ إدخال. */
const isMissingSchema = (e: any) => /column .*(does not exist|not exist)|42703|schema cache|Could not find the table|relation .* does not exist/i.test(String(e?.message || ''));

async function frameIdByName(name: string) {
    const { data } = await supabaseAdmin.from('frames').select('id, name').ilike('name', name).maybeSingle();
    if (data?.id) return String(data.id);
    return null;
}

/** user_frames.user_id عمود إجباري بلا قيمة افتراضية — لازم يُحل قبل المنح. */
async function resolveUserId(username: string): Promise<string | null> {
    const { data: u } = await supabaseAdmin.from('users').select('id').eq('kick_username', username).maybeSingle();
    if (u?.id) return String(u.id);
    const { data: p } = await supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle();
    return p?.id ? String(p.id) : null;
}

/** التجهيز في الملف = العمود الذي تقرأه الواجهة فعلاً (active_frame_id). */
async function applyFrameEquip(username: string, frameId: string, equip: boolean) {
    await supabaseAdmin.from('profiles')
        .update({ active_frame_id: equip ? frameId : null, active_frame_url: null })
        .eq('username', username);
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const auth = await requireAdmin(req);
    if (!auth) return json(res, 401, { ok: false, error: 'انتهت الجلسة، سجّل دخولك من جديد' });

    const rl = await rateLimit(`admin-mutate:${auth.staff.staff_name}:${clientIp(req)}`, 60, 60);
    if (!rl.allowed) return json(res, rl.unavailable ? 503 : 429, { ok: false, error: 'طلبات كثيرة جداً، خفّف السرعة' });

    const { command, payload } = body(req) || {};
    const cmd = String(command || '');
    const p = payload || {};

    // القسم المطلوب للصلاحية
    let section = String(p.section || '');
    if (!section) {
        if (cmd.startsWith('ban.') || cmd.startsWith('report.')) section = 'sanc';
        else if (cmd.startsWith('game.')) section = 'games';
        else if (cmd.startsWith('tour.')) section = 'tour';
        else if (cmd.startsWith('store.')) section = 'store';
        else if (cmd.startsWith('inv.')) section = 'inv';
        else if (cmd.startsWith('promo.')) section = 'promo';
        else if (cmd.startsWith('ann.')) section = 'ann';
        else if (cmd.startsWith('ticket.')) section = 'sup';
        else if (cmd.startsWith('staff.')) section = 'staff';
        else if (cmd.startsWith('user.')) section = 'users';
        else if (cmd.startsWith('eco.')) section = 'eco';
        else if (cmd.startsWith('arena.')) section = 'arena';
    }
    if (!section) return fail(res, 'أمر غير معروف');
    if (!canAccess(auth.staff, section)) return json(res, 403, { ok: false, error: 'صلاحيتك لا تسمح بهذا القسم' });

    try {
        /* ============ جداول: إضافة / تعديل / حذف ============ */
        if (cmd === 'rows.create' || cmd === 'rows.update' || cmd === 'rows.delete') {
            const s = String(p.section || '');
            if (!(SECTIONS_WITH_WRITE as readonly string[]).includes(s)) return fail(res, 'هذا القسم لا يقبل التعديل المباش');
            const table = ({ sanc: 'bans', reports: 'reports', games: 'games', tour: 'tournaments', store: 'frames', inv: 'user_frames', mem: 'tiers', ann: 'announcements', notif: 'notifications', sup: 'support_tickets', staff: 'admin_staff', promo: 'promo_codes' } as any)[s];
            if (!table) return fail(res, 'جدول غير محدَّد');

            if (cmd === 'rows.delete') {
                if (!p.id) return fail(res, 'المعرّف مطلوب');
                if (s === 'inv') {
                    const { data: row } = await supabaseAdmin.from('user_frames').select('username, frame_id, is_equipped').eq('id', p.id).maybeSingle();
                    if (row?.is_equipped) await applyFrameEquip(String(row.username).toLowerCase(), String(row.frame_id), false);
                }
                const { error } = await supabaseAdmin.from(table).delete().eq('id', p.id);
                if (error) return fail(res, error.message);
                await audit(auth.staff.staff_name, 'ADMIN_ROW_DELETE', { section: s, id: p.id, target: p.label || null });
                return json(res, 200, { ok: true, audit: `حذف من ${s}` });
            }

            const values = translateValues(s, p.values || {});
            if (s === 'users') return fail(res, 'عدّل اللاعب من أزرار القسم نفسها');

            if (cmd === 'rows.create') {
                if (s === 'sanc') {
                    if (!values.username) return fail(res, 'اسم اللاعب مطلوب');
                    values.username = String(values.username).toLowerCase();
                    values.status = 'active';
                    values.kind = values.kind || 'تحذير';
                    values.banned_by = auth.staff.staff_name;
                    const { data, error } = await supabaseAdmin.from('bans').insert(values).select();
                    if (error) return fail(res, error.message);
                    if (String(values.kind).startsWith('حظر')) {
                        await supabaseAdmin.from('profiles').update({ is_banned: true }).eq('username', values.username);
                    }
                    await audit(auth.staff.staff_name, 'SANCTION_APPLIED', { target: values.username, kind: values.kind, reason: values.reason || '' });
                    return json(res, 200, { ok: true, data: data?.[0] || null, audit: 'عقوبة جديدة' });
                }
                if (s === 'reports') {
                    values.reporter_username = String(values.reporter_username || '').toLowerCase();
                    values.target_username = values.target_username ? String(values.target_username).toLowerCase() : null;
                    values.status = 'new';
                    const { data, error } = await supabaseAdmin.from('reports').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'REPORT_CREATED_BY_ADMIN', { target: values.target_username });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'inv') {
                    let frameId = String(values.frame_id || '');
                    const named = await frameIdByName(frameId);
                    if (named) frameId = named;
                    if (!frameId) return fail(res, 'اختر مقتنى موجوداً');
                    const username = String(values.username || '').toLowerCase();
                    if (!username) return fail(res, 'اسم اللاعب مطلوب');
                    const userId = await resolveUserId(username);
                    if (!userId) return fail(res, 'لا يوجد حساب بهذا الاسم');
                    const { error: e1 } = await supabaseAdmin.from('user_frames').insert({ user_id: userId, username, frame_id: frameId, is_equipped: false, source: 'admin', granted_by: auth.staff.staff_name });
                    if (e1) return fail(res, e1.message);
                    await audit(auth.staff.staff_name, 'ITEM_GRANTED', { target: username, item: frameId });
                    return json(res, 200, { ok: true, audit: 'منح مقتنى' });
                }
                if (s === 'notif') {
                    values.audience = values.audience || 'all';
                    values.status = 'sent';
                    values.sent_at = new Date().toISOString();
                    values.created_by = auth.staff.staff_name;
                    if (values.audience === 'player' && !values.target_username) return fail(res, 'اسم اللاعب مطلوب');
                    values.target_username = values.target_username ? String(values.target_username).toLowerCase() : null;
                    const { data, error } = await supabaseAdmin.from('notifications').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'NOTIFICATION_SENT', { title: values.title, to: values.audience });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'ann') {
                    const when = values.when || 'now';
                    delete values.when;
                    values.status = when === 'schedule' && values.scheduled_at ? 'scheduled' : when === 'draft' ? 'draft' : 'published';
                    values.is_active = values.status === 'published';
                    values.published_at = values.status === 'published' ? new Date().toISOString() : null;
                    values.created_by = auth.staff.staff_name;
                    if (!values.content) return fail(res, 'نص الإعلان مطلوب');
                    const { data, error } = await supabaseAdmin.from('announcements').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'ANNOUNCEMENT_PUBLISHED', { title: values.title, status: values.status });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'sup') {
                    values.username = String(values.username || '').toLowerCase();
                    values.status = 'new';
                    const { data, error } = await supabaseAdmin.from('support_tickets').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'TICKET_OPENED_BY_ADMIN', { target: values.username });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'staff') {
                    if (!values.staff_name) return fail(res, 'اسم المشرف مطلوب');
                    if (Array.isArray(values.perm)) { values.permissions = values.perm; delete values.perm; }
                    else values.permissions = ['*'];
                    delete values.perm;
                    values.is_active = true;
                    const { data, error } = await supabaseAdmin.from('admin_staff').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'STAFF_ADDED', { name: values.staff_name, role: values.role });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'promo') {
                    values.code = String(values.code || '').trim().toUpperCase();
                    if (!values.code) return fail(res, 'الكود مطلوب');
                    values.created_by = auth.staff.staff_name;
                    values.is_active = true;
                    values.current_uses = 0;
                    const { data, error } = await supabaseAdmin.from('promo_codes').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'PROMO_CREATED', { code: values.code, reward: values.reward_amount });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'mem') {
                    if (!values.name) return fail(res, 'الاسم مطلوب');
                    values.id = values.id || `${String(values.kind || 'rank')}_${Date.now().toString(36)}`;
                    values.is_active = true;
                    values.sort = values.sort ?? 50;
                    const { error } = await supabaseAdmin.from('tiers').insert(values);
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'TIER_ADDED', { name: values.name, kind: values.kind });
                    return json(res, 200, { ok: true });
                }
                if (s === 'tour') {
                    values.status = 'draft';
                    values.created_by = auth.staff.staff_name;
                    if (!values.name) return fail(res, 'اسم البطولة مطلوب');
                    const { data, error } = await supabaseAdmin.from('tournaments').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'TOURNAMENT_CREATED', { name: values.name });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'store') {
                    if (!values.name) return fail(res, 'اسم المنتج مطلوب');
                    values.is_active = values.is_active !== false;
                    const { data, error } = await supabaseAdmin.from('frames').insert(values).select();
                    if (error) return fail(res, error.message);
                    await audit(auth.staff.staff_name, 'STORE_ITEM_ADDED', { name: values.name, price: values.price });
                    return json(res, 200, { ok: true, data: data?.[0] || null });
                }
                if (s === 'games') {
                    if (!values.view_id && !values.title) return fail(res, 'لا تُضاف لعبة جديدة من هنا — الأزرار مربوطة بالكود');
                    return fail(res, 'كتالوج الألعاب ثابت؛ استعمل تشغيل/إيقاف وإظهار/إخفاء');
                }
                const { data, error } = await supabaseAdmin.from(table).insert(values).select();
                if (error) return fail(res, error.message);
                await audit(auth.staff.staff_name, 'ROW_INSERT', { section: s });
                return json(res, 200, { ok: true, data: data?.[0] || null });
            }

            // rows.update
            if (!p.id) return fail(res, 'المعرّف مطلوب');
            if (s === 'inv') return fail(res, 'المقتنيات تتحكم بها من الأزرار فقط');
            if (s === 'notif') return fail(res, 'الإشعارات لا تعدَّل بعد الإرسال');
            if (s === 'staff' && Array.isArray(values.perm)) { values.permissions = values.perm; delete values.perm; }
            if (s === 'ann' && values.when) {
                const when = values.when; delete values.when;
                values.status = when === 'schedule' && values.scheduled_at ? 'scheduled' : when === 'draft' ? 'draft' : 'published';
                values.is_active = values.status === 'published';
                values.published_at = values.status === 'published' ? new Date().toISOString() : values.published_at || null;
            }
            if (s === 'sanc') { values.updated_at = new Date().toISOString(); if (values.username) values.username = String(values.username).toLowerCase(); }
            const { data, error } = await supabaseAdmin.from(table).update(values).eq('id', p.id).select();
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'ROW_UPDATE', { section: s, id: p.id, fields: Object.keys(values) });
            return json(res, 200, { ok: true, data: data?.[0] || null });
        }

        /* ============ العقوبة: تنفيذ الحظر من قسم اللاعبين ============ */
        if (cmd === 'ban.apply') {
            const username = String(p.username || '').toLowerCase();
            if (!username) return fail(res, 'اسم اللاعب مطلوب');
            const { data: prof } = await supabaseAdmin.from('profiles').select('username, is_banned').eq('username', username).maybeSingle();
            const toBan = !prof?.is_banned;
            const { error: e1 } = await supabaseAdmin.from('profiles').update({ is_banned: toBan }).eq('username', username);
            if (e1) return fail(res, e1.message);
            if (toBan) {
                await supabaseAdmin.from('bans').insert({ username, reason: String(p.reason || 'حظر من اللوحة'), banned_by: auth.staff.staff_name, kind: 'حظر مؤقت', status: 'active', ends_at: null });
            } else {
                await supabaseAdmin.from('bans').update({ status: 'lifted', updated_at: new Date().toISOString() }).eq('username', username).eq('status', 'active');
            }
            await audit(auth.staff.staff_name, toBan ? 'PLAYER_BANNED' : 'PLAYER_UNBANNED', { target: username });
            return json(res, 200, { ok: true, data: { status: toBan ? 'محظور' : 'نشط' } });
        }
        if (cmd === 'ban.lift') {
            const id = p.id;
            if (!id) return fail(res, 'معرّف العقوبة مطلوب');
            const { data: row } = await supabaseAdmin.from('bans').select('username').eq('id', id).maybeSingle();
            const { error } = await supabaseAdmin.from('bans').update({ status: 'lifted', updated_at: new Date().toISOString() }).eq('id', id);
            if (error) return fail(res, error.message);
            if (row?.username) {
                const { data: left } = await supabaseAdmin.from('bans').select('id').eq('username', row.username).eq('status', 'active').limit(1);
                if (!left?.length) await supabaseAdmin.from('profiles').update({ is_banned: false }).eq('username', row.username);
            }
            await audit(auth.staff.staff_name, 'SANCTION_LIFTED', { target: row?.username || id });
            return json(res, 200, { ok: true });
        }

        /* ============ البلاغات ============ */
        if (cmd === 'report.status' || cmd === 'report.reject') {
            const status = cmd === 'report.status' ? 'accepted' : 'rejected';
            const { error } = await supabaseAdmin.from('reports').update({
                status, handled_by: auth.staff.staff_name,
                resolution: String(p.resolution || (status === 'accepted' ? 'تم قبول البلاغ' : 'تم رفض البلاغ')),
                updated_at: new Date().toISOString(),
            }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'REPORT_HANDLED', { id: p.id, status });
            return json(res, 200, { ok: true });
        }

        /* ============ الألعاب ============ */
        if (cmd === 'game.toggle' || cmd === 'game.visible') {
            const col = cmd === 'game.toggle' ? 'is_active' : 'is_visible';
            const { data: row } = await supabaseAdmin.from('games').select(col).eq('id', p.id).maybeSingle();
            const next = !(row as any)?.[col];
            const { error } = await supabaseAdmin.from('games').update({ [col]: next, updated_at: new Date().toISOString() }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, cmd === 'game.toggle' ? 'GAME_STATE_CHANGED' : 'GAME_VISIBILITY_CHANGED', { id: p.id, value: next });
            return json(res, 200, { ok: true, data: { value: next } });
        }

        /* ============ البطولات: المرحلة التالية ============ */
        if (cmd === 'tour.advance') {
            const flow = ['draft', 'open', 'closed', 'running', 'completed'];
            const { data: row } = await supabaseAdmin.from('tournaments').select('status, name').eq('id', p.id).maybeSingle();
            if (!row) return fail(res, 'البطولة غير موجودة');
            const i = flow.indexOf(String(row.status || 'draft'));
            if (i >= flow.length - 1) return fail(res, 'البطولة اكتملت أصلاً');
            const next = flow[i + 1];
            if (next === 'closed') {
                const { count } = await supabaseAdmin.from('tournament_registrations').select('id', { count: 'exact', head: true }).eq('tournament_id', p.id);
                const { data: t } = await supabaseAdmin.from('tournaments').select('max_players').eq('id', p.id).maybeSingle();
                if ((count || 0) > num(t?.max_players)) return fail(res, 'عدد المسجلين تجاوز الحد الأقصى — عدّله قبل الإغلاق');
            }
            const { error } = await supabaseAdmin.from('tournaments').update({ status: next, updated_at: new Date().toISOString() }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'TOURNAMENT_ADVANCED', { name: row.name, status: next });
            return json(res, 200, { ok: true });
        }

        /* ============ المتجر ============ */
        if (cmd === 'store.toggle') {
            const { data: row } = await supabaseAdmin.from('frames').select('is_active, name').eq('id', p.id).maybeSingle();
            const next = !(row as any)?.is_active;
            const { error } = await supabaseAdmin.from('frames').update({ is_active: next }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'STORE_ITEM_TOGGLED', { name: row?.name, is_active: next });
            return json(res, 200, { ok: true, data: { value: next } });
        }

        /* ============ المقتنيات ============ */
        if (cmd === 'inv.toggle') {
            const { data: row } = await supabaseAdmin.from('user_frames').select('username, frame_id, is_equipped').eq('id', p.id).maybeSingle();
            if (!row) return fail(res, 'السطر غير موجود');
            const next = !row.is_equipped;
            if (next) {
                await supabaseAdmin.from('user_frames').update({ is_equipped: false }).eq('username', row.username).neq('id', p.id);
            }
            const { error } = await supabaseAdmin.from('user_frames').update({ is_equipped: next }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await applyFrameEquip(String(row.username).toLowerCase(), String(row.frame_id), next);
            await audit(auth.staff.staff_name, 'ITEM_EQUIP_CHANGED', { target: row.username, item: row.frame_id, equipped: next });
            return json(res, 200, { ok: true, data: { value: next } });
        }
        if (cmd === 'inv.revoke') {
            const { data: row } = await supabaseAdmin.from('user_frames').select('username, frame_id, is_equipped').eq('id', p.id).maybeSingle();
            if (!row) return fail(res, 'السطر غير موجود');
            if (row.is_equipped) await applyFrameEquip(String(row.username).toLowerCase(), String(row.frame_id), false);
            const { error } = await supabaseAdmin.from('user_frames').delete().eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'ITEM_REVOKED', { target: row.username, item: row.frame_id });
            return json(res, 200, { ok: true });
        }

        /* ============ الأكواد الترويجية ============ */
        if (cmd === 'promo.toggle') {
            const { data: row } = await supabaseAdmin.from('promo_codes').select('is_active, code').eq('id', p.id).maybeSingle();
            const next = !(row as any)?.is_active;
            const { error } = await supabaseAdmin.from('promo_codes').update({ is_active: next }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'PROMO_TOGGLED', { code: row?.code, is_active: next });
            return json(res, 200, { ok: true, data: { value: next } });
        }

        /* ============ الإعلانات ============ */
        if (cmd === 'ann.unpublish') {
            const { error } = await supabaseAdmin.from('announcements').update({ status: 'draft', is_active: false }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'ANNOUNCEMENT_UNPUBLISHED', { id: p.id });
            return json(res, 200, { ok: true });
        }

        /* ============ الدعم ============ */
        if (cmd === 'ticket.reply') {
            const reply = String(p.reply || '').trim();
            if (reply.length < 2) return fail(res, 'اكتب رداً قبل الإغلاق');
            const { data: row } = await supabaseAdmin.from('support_tickets').select('username, subject').eq('id', p.id).maybeSingle();
            const { error } = await supabaseAdmin.from('support_tickets').update({ status: 'resolved', reply, handled_by: auth.staff.staff_name, updated_at: new Date().toISOString() }).eq('id', p.id);
            if (error) return fail(res, error.message);
            if (row?.username) {
                await supabaseAdmin.from('notifications').insert({
                    title: `رد الدعم: ${row.subject}`, body: reply, audience: 'player',
                    target_username: String(row.username).toLowerCase(), status: 'sent', created_by: auth.staff.staff_name,
                });
            }
            await audit(auth.staff.staff_name, 'TICKET_RESOLVED', { target: row?.username, id: p.id });
            return json(res, 200, { ok: true });
        }
        if (cmd === 'ticket.reopen') {
            const { error } = await supabaseAdmin.from('support_tickets').update({ status: 'new', updated_at: new Date().toISOString() }).eq('id', p.id);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'TICKET_REOPENED', { id: p.id });
            return json(res, 200, { ok: true });
        }

        /* ============ المشرفون ============ */
        if (cmd === 'staff.toggle') {
            if (String(p.name || '') === auth.staff.staff_name) return fail(res, 'لا تعطّل حسابك نفسه وأنت داخله');
            const { data: row } = await supabaseAdmin.from('admin_staff').select('is_active').eq('staff_name', p.name).maybeSingle();
            if (!row) return fail(res, 'المشرف غير موجود');
            const next = !row.is_active;
            const { error } = await supabaseAdmin.from('admin_staff').update({ is_active: next }).eq('staff_name', p.name);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'STAFF_TOGGLED', { name: p.name, is_active: next });
            return json(res, 200, { ok: true, data: { value: next } });
        }

        /* ============ إحصائيات اللاعب (تتطلب سبباً) ============ */
        if (cmd === 'user.stats') {
            const username = String(p.username || '').toLowerCase();
            const field = String(p.field || '');
            const delta = Math.round(Number(p.delta) || 0);
            const why = String(p.reason || '').trim();
            if (!username || !delta) return fail(res, 'اللاعب والقيمة مطلوبان');
            if (!why) return fail(res, 'السبب إجباري');
            if (Math.abs(delta) > 10000) return fail(res, 'تجاوز حد العملية الإدارية (١٠٠٠٠)');

            let before = 0, after = 0, table = '';
            if (field === 'pts' || field === 'wins') {
                table = 'leaderboard';
                const col = field === 'pts' ? 'score' : 'wins';
                const { data: row } = await supabaseAdmin.from('leaderboard').select(col).eq('username', username).maybeSingle();
                if (!row) return fail(res, 'لا يوجد هذا اللاعب في اللوحة');
                before = num((row as any)[col]);
                after = Math.max(0, before + delta);
                const { error } = await supabaseAdmin.from('leaderboard').update({ [col]: after, updated_at: new Date().toISOString() }).eq('username', username);
                if (error) return fail(res, error.message);
            } else if (field === 'bal') {
                table = 'profiles';
                const { data: row } = await supabaseAdmin.from('profiles').select('credits').eq('username', username).maybeSingle();
                if (!row) return fail(res, 'لا يوجد ملف لهذا اللاعب');
                before = num(row.credits);
                after = Math.max(0, before + delta);
                const { error } = await supabaseAdmin.from('profiles').update({ credits: after }).eq('username', username);
                if (error) return fail(res, error.message);
                const txUserId = await resolveUserId(username);
                const { error: txErr } = await supabaseAdmin.from('transactions').insert({
                    user_id: txUserId, amount: after - before, type: 'ADMIN',
                    description: `تعديل إداري (${why}) — ${username}`,
                });
                if (txErr) console.error('[admin/mutate] transactions:', txErr.message);
            } else return fail(res, 'حقل غير معروف');
            await audit(auth.staff.staff_name, 'STATS_ADJUST', { target: username, field, before, after, reason: why, table });
            return json(res, 200, { ok: true, data: { field, value: after } });
        }
        if (cmd === 'user.note') {
            const username = String(p.username || '').toLowerCase();
            const { error } = await supabaseAdmin.from('profiles').update({ admin_note: String(p.note || '') }).eq('username', username);
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'ADMIN_NOTE_UPDATED', { target: username });
            return json(res, 200, { ok: true });
        }

        /* ============ عضوية اللاعب (VIP…) ============ */
        if (cmd === 'user.membership') {
            const username = String(p.username || '').toLowerCase();
            const tierId = String(p.tier || 'none');
            const why = String(p.reason || '').trim();
            if (!username) return fail(res, 'اسم اللاعب مطلوب');
            const { data: prof } = await supabaseAdmin.from('profiles').select('username').eq('username', username).maybeSingle();
            if (!prof) return fail(res, 'لا يوجد ملف لهذا اللاعب');

            if (tierId === 'none') {
                const { error } = await supabaseAdmin.from('profiles')
                    .update({ membership: null, membership_expires_at: null }).eq('username', username);
                if (error) return fail(res, error.message);
                await audit(auth.staff.staff_name, 'MEMBERSHIP_REVOKED', { target: username, reason: why || 'بلا سبب' });
                return json(res, 200, { ok: true, audit: `أُلغيت عضوية ${username}` });
            }

            if (!why) return fail(res, 'السبب إجباري عند منح عضوية');
            const { data: tier } = await supabaseAdmin.from('tiers')
                .select('id, name, discount_pct, duration_days, is_active').eq('id', tierId).eq('kind', 'membership').maybeSingle();
            if (!tier) return fail(res, 'عضوية غير معرَّفة في سلّم الرُتب');
            if (tier.is_active === false) return fail(res, 'هذه العضوية موقوفة');

            const days = Math.max(1, num(tier.duration_days) || 30);
            const expires = new Date(Date.now() + days * 864e5).toISOString();
            const { error } = await supabaseAdmin.from('profiles')
                .update({ membership: String(tier.id), membership_expires_at: expires }).eq('username', username);
            if (error) return fail(res, error.message);

            await supabaseAdmin.from('notifications').insert({
                title: `تهانينا — صرت ${tier.name}`,
                body: `خصم ${num(tier.discount_pct)}% في المتجر لمدة ${days} يوماً. ${why}`,
                audience: 'player', target_username: username, status: 'sent',
                sent_at: new Date().toISOString(), created_by: auth.staff.staff_name,
            });
            await audit(auth.staff.staff_name, 'MEMBERSHIP_GRANTED', { target: username, tier: tierId, days, reason: why });
            return json(res, 200, { ok: true, audit: `مُنحت ${username} عضوية ${tier.name} (${days} يوماً)` });
        }

        /* ============ مكافأة جماعية ============ */
        if (cmd === 'eco.mass_reward') {
            const amount = Math.round(Number(p.amount) || 0);
            const why = String(p.reason || '').trim();
            if (!why) return fail(res, 'السبب إجباري');
            if (amount <= 0 || amount > 1000) return fail(res, 'المبلغ بين ١ و١٠٠٠');
            const { data: rows } = await supabaseAdmin.from('profiles').select('id, username, credits').eq('is_banned', false).limit(1000);
            const targets = rows || [];
            if (!targets.length) return fail(res, 'لا لاعبين نشطين');
            const tx: any[] = [];
            for (const t of targets) {
                const after = num(t.credits) + amount;
                const { error } = await supabaseAdmin.from('profiles').update({ credits: after }).eq('username', t.username);
                if (!error) tx.push({ user_id: t.id, amount, type: 'ADMIN', description: `مكافأة جماعية: ${why}` });
            }
            if (tx.length) {
                const { error: txErr } = await supabaseAdmin.from('transactions').insert(tx);
                if (txErr) console.error('[admin/mutate] mass reward ledger:', txErr.message);
            }
            await audit(auth.staff.staff_name, 'MASS_REWARD', { count: targets.length, amount, reason: why });
            return json(res, 200, { ok: true, data: { count: targets.length } });
        }

        /* ============ الساحة ============ */
        if (cmd === 'arena.save') {
            const theme = String(p.theme || 'default');
            const particles = String(p.particles || 'none');
            const moodRes = await supabaseAdmin.from('arena_status').upsert({ key: 'global_mood', value: { theme, particles }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (moodRes.error) return fail(res, moodRes.error.message);
            const audio = { enabled: !!p.audio_enabled, volume: num(p.audio_volume), url: String(p.audio_url || '') };
            const audioRes = await supabaseAdmin.from('arena_status').upsert({ key: 'audio_overlay', value: audio, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (audioRes.error) return fail(res, audioRes.error.message);
            await audit(auth.staff.staff_name, 'ARENA_CONFIG_SAVED', { theme, particles, audio });
            return json(res, 200, { ok: true, data: { theme, particles, audio } });
        }

        /* ============ استخدام كود من الشات (بالنيابة عن لاعب) ============ */
        if (cmd === 'promo.claimChat') {
            const username = String(p.username || '').trim().toLowerCase();
            const code = String(p.code || '').trim().toUpperCase();
            if (!username || !code) return fail(res, 'اسم اللاعب والكود مطلوبان');
            const { data, error } = await supabaseAdmin.rpc('redeem_promo', {
                p_username: username, p_code: code, p_via: 'chat',
            });
            if (error) return json(res, 400, { ok: false, error: error.message || 'تعذّر استخدام الكود' });
            await audit(auth.staff.staff_name, 'PROMO_REDEEMED_FROM_CHAT', { target: username, code, amount: data });
            return json(res, 200, { ok: true, data: { username, code, amount: Number(data) || 0 } });
        }

        /* ============ النسخ الاحتياطي والفحص ============ */
        if (cmd === 'sys.export') {
            await audit(auth.staff.staff_name, 'ADMIN_EXPORT', { format: String(p.format || 'json') });
            return json(res, 200, { ok: true });
        }
        if (cmd === 'sys.integrity') {
            const { data, error } = await supabaseAdmin.rpc('admin_integrity_check');
            if (error) return fail(res, error.message);
            await audit(auth.staff.staff_name, 'INTEGRITY_CHECK', data || {});
            return json(res, 200, { ok: true, data });
        }

        return fail(res, 'أمر غير معروف');
    } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (isMissingSchema(e)) {
            return json(res, 500, { ok: false, error: 'لم تُنفَّذ admin_center.sql بعد — الأعمدة الجديدة غير موجودة في القاعدة.' });
        }
        console.error('[admin/mutate]', cmd, msg);
        return json(res, 500, { ok: false, error: msg || 'خطأ في السيرفر' });
    }
}
