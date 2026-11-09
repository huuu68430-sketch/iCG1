import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './AdminControlCenter.css';
import {
    adminApi, SECTIONS, SECTION_ROWS,
    type AdminData, type MutateResult, type RowAction, type SectionDef, type SectionId,
    type StatRow, type UserRow,
} from '../services/adminCenter';
import type { Col, Field as FieldSpec } from '../services/adminCenter';
import {
    Bars, Badge, Empty, FeedRow, Field, fmt, fmtDay, fmtTime, formDefaults,
    Icon, Modal, Particles, Skeleton, StatCard, Toasts, useToasts,
} from './adminCenterParts';
import { startPromoWatcher } from '../services/promoWatcher';

/* ==========================================================================
   مركز تحكم الإدارة — نسخة React من iCG1 Admin Control Center.html
   كل الأرقام من /api/admin/data، وكل كتابة من /api/admin/mutate.
   ========================================================================== */

const THEME_LABELS: [string, string][] = [
    ['default', 'الافتراضي'], ['neon', 'الأزرق النيون'], ['gold', 'ساحة الذهب'], ['stealth', 'الظل الخفي'],
];
const FX_LABELS: [string, string][] = [
    ['none', 'بلا جزيئات'], ['snow', 'ثلج'], ['ember', 'شرر'], ['celeb', 'احتفال'],
];

type ModalState =
    | null
    | { kind: 'form'; title: string; fields: FieldSpec[]; values: Record<string, any>; section: string; id?: string }
    | { kind: 'confirm'; title: string; text: string; okText?: string; run: () => Promise<any> }
    | { kind: 'stats'; row: UserRow }
    | { kind: 'member'; row: UserRow }
    | { kind: 'crm'; row: UserRow; detail?: UserRow; note: string }
    | { kind: 'reply'; row: StatRow }
    | { kind: 'mass' }
    | { kind: 'search'; q: string; hits: { section: SectionDef; row: any }[] }
    | { kind: 'integrity'; data: Record<string, number> };

const fieldKey = (f: FieldSpec) => f[0];
const firstField = (s: SectionDef) => s.fields?.[0]?.[0] || '';

export default function AdminControlCenter({ staffName, onLogout }: { staffName: string; onLogout: () => void }) {
    const [data, setData] = useState<AdminData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cur, setCur] = useState<SectionId>('home');
    const [secQ, setSecQ] = useState('');
    const [gq, setGq] = useState('');
    const [collapsed, setCollapsed] = useState(false);
    const [drawer, setDrawer] = useState(false);
    const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
    const [period, setPeriod] = useState(7);
    const [modal, setModal] = useState<ModalState>(null);
    const [busy, setBusy] = useState(false);
    const [arenaDraft, setArenaDraft] = useState<{ theme: string; particles: string; enabled: boolean; volume: number; url: string } | null>(null);
    const [statsForm, setStatsForm] = useState<{ field: string; delta: number; reason: string }>({ field: 'pts', delta: 0, reason: '' });
    const [memberForm, setMemberForm] = useState<{ tier: string; reason: string }>({ tier: 'vip', reason: '' });
    const [massForm, setMassForm] = useState({ amount: 50, reason: '' });
    const [replyText, setReplyText] = useState('');
    const { toasts, toast } = useToasts();
    const searchRef = useRef<HTMLInputElement | null>(null);
    const secSearchRef = useRef<HTMLInputElement | null>(null);

    const section = useMemo(() => SECTIONS.find(s => s.id === cur)!, [cur]);

    const reload = useCallback(async (silent?: boolean) => {
        if (!silent) { setLoading(true); setError(null); }
        const d = await adminApi.data();
        if (!d) { setError('تعذّر تحميل البيانات. إما أن الجلسة انتهت أو أن supabase/admin_center.sql لم يُنفَّذ بعد.'); setLoading(false); return; }
        setData(d);
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const dataRef = useRef<AdminData | null>(null);
    useEffect(() => { dataRef.current = data; }, [data]);

    useEffect(() => {
        if (!data?.arena) return;
        setArenaDraft(prev => prev ?? {
            theme: data.arena.theme || 'default', particles: data.arena.particles || 'none',
            enabled: !!data.arena.audio?.enabled, volume: Number(data.arena.audio?.volume ?? 50), url: data.arena.audio?.url || '',
        });
    }, [data]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            const typing = /INPUT|TEXTAREA|SELECT/.test(t?.tagName || '');
            if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    // كودات الترويج تُستخدم من الدردشة نفسها — نفس السلوك القديم، لكن بالسيرفر
    useEffect(() => {
        const stop = startPromoWatcher(
            () => (dataRef.current?.promos || []).map(p => ({ code: String(p.code || ''), active: p.status === 'نشط' })),
            (message, bad) => toast(message, bad),
        );
        return stop;
    }, [toast]);

    /* ---------------------------- كتابة ---------------------------- */

    const run = useCallback(async (command: string, payload: Record<string, any> = {}, opts: { close?: boolean; silent?: boolean } = {}): Promise<MutateResult> => {
        setBusy(true);
        const r = await adminApi.run(command, payload);
        setBusy(false);
        if (!r.ok) { toast(r.error || 'فشلت العملية', true); return r; }
        if (!opts.silent) toast(r.audit || 'تم التنفيذ');
        if (opts.close) setModal(null);
        await reload(true);
        return r;
    }, [reload, toast]);

    /* --------------------------- صفوف الأقسام --------------------------- */

    const rowsOf = (s: SectionDef): StatRow[] => {
        if (!data) return [];
        const key = SECTION_ROWS[s.id];
        if (!key) return [];
        const v = (data as any)[key];
        return Array.isArray(v) ? v : [];
    };

    const filtered = (s: SectionDef) => {
        const rows = rowsOf(s);
        if (!secQ.trim()) return rows;
        const q = secQ.trim().toLowerCase();
        return rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    };

    const newReportCount = data ? data.reports.filter(r => r.status === 'جديد').length : 0;

    /* ------------------------- إجراءات الصف ------------------------- */

    const doDelete = (s: SectionDef, row: any) => setModal({
        kind: 'confirm',
        title: 'تأكيد الحذف',
        text: `هل تريد حذف «${row[firstField(s)] ?? row[s.cols?.[0]?.[0] ?? '']}» نهائياً؟ لا تراجع بعد الحذف.`,
        okText: 'حذف',
        run: () => run('rows.delete', { section: s.id, id: row.id, label: String(row.name || row.title || row.code || row.player || '') }, { close: true }),
    });

    const openForm = (s: SectionDef, row?: any) => {
        if (!s.fields) return;
        const values = row
            ? { ...formDefaults(s.fields, row), ...pickKnown(row, s.fields) }
            : formDefaults(s.fields, s.defaults || {});
        setModal({ kind: 'form', title: (row ? 'تعديل — ' : 'إضافة — ') + s.title, fields: s.fields, values, section: s.id, id: row?.id });
    };

    const onRowAction = async (s: SectionDef, row: any, act: RowAction) => {
        const [, , kind, target] = act;
        if (kind === 'copy') {
            const text = String(row.code ?? row.id ?? '');
            try { await navigator.clipboard.writeText(text); toast('تم النسخ: ' + text); }
            catch { toast('تعذّر النسخ', true); }
            return;
        }
        if (kind === 'modal') {
            if (target === 'stats') { setStatsForm({ field: 'pts', delta: 0, reason: '' }); setModal({ kind: 'stats', row }); }
            else if (target === 'member') { setMemberForm({ tier: row.member === 'VIP' ? 'vip' : 'none', reason: '' }); setModal({ kind: 'member', row }); }
            else if (target === 'crm') {
                setModal({ kind: 'crm', row, note: row.note || '' });
                const d = await adminApi.crm(String(row.name));
                setModal(m => (m && m.kind === 'crm' && m.row === row ? { ...m, detail: d || undefined } : m));
                if (!d) toast('تعذّر تحميل ملف اللاعب', true);
            } else if (target === 'reply') { setReplyText(String(row.reply || '')); setModal({ kind: 'reply', row }); }
            return;
        }
        const cmd = String(target);
        const payload: Record<string, any> = { section: s.id, id: row.id };
        if (s.id === 'users') payload.username = row.name;
        if (s.id === 'staff') payload.name = row.name;
        if (cmd === 'ban.apply') {
            setModal({
                kind: 'confirm',
                title: row.status === 'محظور' ? 'فك الحظر' : 'حظر اللاعب',
                text: row.status === 'محظور'
                    ? `سيصبح «${row.name}» نشطاً again وتُلغى عقوباته النشطة. النقاط والرصيد والمقتنيات لا تتغير.`
                    : `سيُمنع «${row.name}» من الاستخدام وستُسجَّل عقوبة حظر في السجل. النقاط والرصيد والمقتنيات لا تُمسّ.`,
                okText: 'تأكيد',
                run: () => run('ban.apply', { username: row.name }),
            });
            return;
        }
        if (cmd === 'inv.revoke') {
            setModal({
                kind: 'confirm', title: 'سحب المقتنى', okText: 'سحب',
                text: `سحب «${row.item}» من «${row.player}» نهائي، وسيُعطَّل تجهيزه إن كان مجهّزاً.`,
                run: () => run('inv.revoke', { id: row.id, section: 'inv' }),
            });
            return;
        }
        if (cmd === 'report.status') {
            setModal({
                kind: 'confirm', title: 'قبول البلاغ',
                text: `سيُعلَّم البلاغ مقبولاً ومغلقاً، ويرى صاحبُه النتيجة في إعداداته.`,
                run: () => run('report.status', { id: row.id, section: 'reports' }),
            });
            return;
        }
        await run(cmd, payload);
    };

    /* --------------------------- البحث الشامل --------------------------- */

    const globalSearch = async () => {
        const q = gq.trim().toLowerCase();
        if (!q || !data) return;
        const hits: { section: SectionDef; row: any }[] = [];
        SECTIONS.forEach(s => {
            if (!SECTION_ROWS[s.id]) return;
            rowsOf(s).forEach(r => {
                if (JSON.stringify(r).toLowerCase().includes(q)) hits.push({ section: s, row: r });
            });
        });
        setModal({ kind: 'search', q: gq.trim(), hits: hits.slice(0, 24) });
    };

    const exportCsv = async (s: SectionDef) => {
        const rows = filtered(s);
        const cols: Col[] = s.cols || [];
        const head = cols.map(c => c[1]).join(',');
        const body = rows.map(r => cols.map(c => JSON.stringify(r[c[0]] ?? '')).join(',')).join('\n');
        try {
            await navigator.clipboard.writeText(`${head}\n${body}`);
            toast(`نُسخت ${rows.length} صفة بصيغة CSV`);
        } catch { toast('تعذّر النسخ من المتصفح', true); }
    };

    /* ---------------------------- العرض ---------------------------- */

    const groups = useMemo(() => [...new Set(SECTIONS.map(s => s.group))], []);

    const cardMouse = (e: React.MouseEvent) => {
        const el = (e.target as HTMLElement).closest?.('.icc-card') as HTMLElement | null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    };

    return (
        <div className="icc" dir="rtl" onMouseMove={cardMouse}>
            <Particles />
            <div className="icc-app">
                {/* الشريط الجانبي */}
                <aside className={`icc-sd${collapsed ? ' is-c' : ''}${drawer ? ' is-open' : ''}`}>
                    <div className="icc-logo"><b>C</b><span className="icc-tx">iCG1 ADM</span></div>
                    {groups.map(g => (
                        <div key={g}>
                            <div className="icc-gh" onClick={() => setClosedGroups(c => ({ ...c, [g]: !c[g] }))}>
                                <span className="icc-tx">{g}</span><span className="icc-tx"><Icon n="chev" /></span>
                            </div>
                            {!closedGroups[g] && SECTIONS.filter(s => s.group === g).map(s => (
                                <div key={s.id} className={`icc-nv${s.id === cur ? ' is-a' : ''}`} title={s.title}
                                    onClick={() => { setCur(s.id); setSecQ(''); setDrawer(false); scrollTo({ top: 0 }); }}>
                                    <Icon n={s.icon} /><span className="icc-tx">{s.title}</span>
                                    {s.id === 'reports' && newReportCount > 0 && <span className="icc-dot">{newReportCount}</span>}
                                </div>
                            ))}
                        </div>
                    ))}
                    <div className="icc-nv" style={{ marginTop: 14, color: '#fca5a5' }} onClick={onLogout}>
                        <Icon n="out" /><span className="icc-tx">خروج من اللوحة</span>
                    </div>
                </aside>

                <main className="icc-main">
                    <header className="icc-header">
                        <div className="icc-ib icc-mt" onClick={() => setDrawer(d => !d)}><Icon n="menu" /></div>
                        <div className="icc-ib" onClick={() => setCollapsed(c => !c)}><Icon n="menu" /></div>
                        <div className="icc-sr">
                            <Icon n="search" />
                            <input
                                ref={searchRef}
                                value={gq}
                                placeholder="بحث شامل: لاعب، منتج، معاملة، بطولة، تذكرة، كود…"
                                onChange={e => setGq(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && gq.trim()) globalSearch(); }}
                            />
                        </div>
                        <div className="icc-ib" title="البلاغات الجديدة" onClick={() => setCur('reports')}>
                            <Icon n="bell" />{newReportCount > 0 && <span className="icc-dot">{newReportCount}</span>}
                        </div>
                        <div className="icc-ib" title="تحديث البيانات" onClick={() => reload()}><Icon n="refresh" /></div>
                        <div className="icc-av"><span>{staffName}</span><i>{(staffName || 'A').slice(0, 1)}</i></div>
                    </header>

                    <div className="icc-view">
                        <div className="icc-bc">الرئيسية / {section.group} / <b>{section.title}</b></div>
                        <h1>{section.title}</h1>

                        {loading && <><Skeleton n={6} /><div className="icc-sk" style={{ height: 220 }} /></>}

                        {!loading && error && (
                            <div className="icc-err">
                                {error}
                                <div className="icc-tb" style={{ marginTop: 10 }}>
                                    <button className="icc-btn" onClick={() => { setError(null); reload(); }}><Icon n="refresh" /> إعادة المحاولة</button>
                                </div>
                            </div>
                        )}

                        {!loading && !error && data && (
                            <>
                                {section.custom === 'home' && <HomeView data={data} period={period} setPeriod={setPeriod} go={setCur} />}
                                {section.custom === 'analytics' && <AnalyticsView data={data} period={period} />}
                                {section.custom === 'economy' && <EconomyView data={data} onMass={() => { setMassForm({ amount: 50, reason: '' }); setModal({ kind: 'mass' }); }} />}
                                {section.custom === 'arena' && (
                                    <ArenaView
                                        data={data} draft={arenaDraft!} setDraft={setArenaDraft}
                                        busy={busy} onSave={() => run('arena.save', {
                                            theme: arenaDraft?.theme, particles: arenaDraft?.particles,
                                            audio_enabled: arenaDraft?.enabled, audio_volume: arenaDraft?.volume, audio_url: arenaDraft?.url,
                                        })}
                                        onReset={() => setArenaDraft({
                                            theme: data.arena.theme || 'default', particles: data.arena.particles || 'none',
                                            enabled: !!data.arena.audio?.enabled, volume: Number(data.arena.audio?.volume ?? 50), url: data.arena.audio?.url || '',
                                        })}
                                        onDefault={() => {
                                            const d = { theme: 'default', particles: 'none', enabled: false, volume: 50, url: '' };
                                            setArenaDraft(d);
                                            return run('arena.save', {
                                                theme: d.theme, particles: d.particles,
                                                audio_enabled: d.enabled, audio_volume: d.volume, audio_url: d.url,
                                            });
                                        }}
                                    />
                                )}
                                {section.custom === 'system' && <SystemView data={data} busy={busy} run={run} toast={toast} />}
                                {!section.custom && (
                                    <TableView
                                        section={section} rows={filtered(section)} total={rowsOf(section).length}
                                        q={secQ} setQ={setSecQ} searchRef={secSearchRef}
                                        onData={data}
                                        onAdd={() => openForm(section)}
                                        onEdit={r => openForm(section, r)}
                                        onDelete={r => doDelete(section, r)}
                                        onRowAction={(r, a) => onRowAction(section, r, a)}
                                        onCsv={() => exportCsv(section)}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>

            <ModalHost
                modal={modal} setModal={setModal} busy={busy} run={run} toast={toast} data={data}
                statsForm={statsForm} setStatsForm={setStatsForm}
                memberForm={memberForm} setMemberForm={setMemberForm}
                massForm={massForm} setMassForm={setMassForm}
                replyText={replyText} setReplyText={setReplyText}
                goSection={(id) => { setCur(id); setModal(null); }}
            />
            <Toasts items={toasts} />
        </div>
    );
}

/* --------------------------- أدوات صغيرة --------------------------- */

function pickKnown(row: any, fields: FieldSpec[]) {
    const out: Record<string, any> = {};
    fields.forEach(f => { const k = fieldKey(f); if (row[k] !== undefined && row[k] !== null) out[k] = row[k]; });
    return out;
}

/* ----------------------------- جدول عام ----------------------------- */

function TableView(props: {
    section: SectionDef; rows: StatRow[]; total: number; q: string; setQ: (v: string) => void;
    searchRef: React.RefObject<HTMLInputElement | null>;
    onData: AdminData;
    onAdd: () => void; onEdit: (r: any) => void; onDelete: (r: any) => void;
    onRowAction: (r: any, a: RowAction) => void; onCsv: () => void;
}) {
    const { section: s, rows, total, onData } = props;
    const cols: Col[] = s.cols || [];
    const canCreate = !!s.fields && s.creatable !== false;
    const canEdit = !!s.fields && s.editable !== false;
    const canDelete = !!s.fields && s.deletable !== false;
    const hasActions = !s.readOnly && ((s.actions || []).length > 0 || canEdit || canDelete);
    const selectableOptions = (f: FieldSpec) => {
        if (s.id === 'inv' && f[0] === 'item') return onData.options.frames;
        if (s.id === 'users' && f[0] === 'rank') return onData.tiers.filter(t => t.kind === 'رتبة').map(t => String(t.name));
        return f[3];
    };
    return (
        <>
            {s.note && <div className="icc-card is-flat" style={{ marginBottom: 12, color: 'var(--g)', fontSize: 13 }}>{s.note}</div>}
            <div className="icc-grid">
                <StatCard label="العدد" value={total} icon={s.icon} />
                <StatCard label="النتائج" value={rows.length} icon="search" />
            </div>
            <div className="icc-tb">
                <div className="icc-sr" style={{ maxWidth: 320 }}>
                    <Icon n="search" />
                    <input ref={props.searchRef} value={props.q} placeholder="بحث في القسم…" onChange={e => props.setQ(e.target.value)} />
                </div>
                {canCreate && <button className="icc-btn" onClick={props.onAdd}><Icon n="plus" /> {s.createLabel || 'إضافة'}</button>}
                <button className="icc-btn o" onClick={props.onCsv}><Icon n="copy" /> نسخ CSV</button>
            </div>
            <div className="icc-card icc-tw">
                <table>
                    <thead>
                        <tr>{cols.map(c => <th key={c[0]}>{c[1]}</th>)}{hasActions && <th>إجراءات</th>}</tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={String(r.id ?? i)} style={{ ['--d' as any]: `${Math.min(i * 30, 500)}ms` }}>
                                {cols.map(c => (
                                    <td key={c[0]}>
                                        {c[2] === 'status' ? <Badge value={r[c[0]]} />
                                            : c[2] === 'time' ? <span style={{ whiteSpace: 'nowrap' }}>{fmtTime(r[c[0]])}</span>
                                                : c[2] === 'num' ? fmt(Number(r[c[0]]))
                                                    : c[2] === 'mono' ? <code style={{ fontSize: 12, color: 'var(--m)' }}>{String(r[c[0]] ?? '')}</code>
                                                        : String(r[c[0]] ?? '—')}
                                    </td>
                                ))}
                                {hasActions && (
                                    <td>
                                        <div className="icc-ac">
                                            {(s.actions || []).map((a, k) => (
                                                <div key={k} className="icc-ib" title={a[1]} onClick={() => props.onRowAction(r, a)}><Icon n={a[0]} /></div>
                                            ))}
                                            {canEdit && <div className="icc-ib" title="تعديل" onClick={() => props.onEdit(r)}><Icon n="edit" /></div>}
                                            {canDelete && <div className="icc-ib" title="حذف" onClick={() => props.onDelete(r)}><Icon n="trash" /></div>}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {!rows.length && <tr><td colSpan={cols.length + (hasActions ? 1 : 0)}><Empty /></td></tr>}
                    </tbody>
                </table>
            </div>
            {(canCreate || canEdit) && (
                <div className="icc-card is-flat" style={{ marginTop: 12, fontSize: 12, color: 'var(--m)' }}>
                    حقول {canCreate ? 'الإضافة' : 'التعديل'}{canEdit ? ' والتعديل' : ''}: {(s.fields || []).map(f => `${f[1]}${selectableOptions(f) ? ` (${selectableOptions(f)!.length} خيار)` : ''}`).join(' · ')}
                </div>
            )}
        </>
    );
}

/* ---------------------------- لوحة البيانات ---------------------------- */

function HomeView({ data, period, setPeriod, go }: { data: AdminData; period: number; setPeriod: (n: number) => void; go: (id: SectionId) => void }) {
    const o = data.overview as any;
    const series = data.analytics.series.slice(-period);
    return (
        <>
            <div className="icc-grid">
                <StatCard label="إجمالي المستخدمين" value={o.players} icon="users" />
                <StatCard label="حسابات مسجّلة" value={o.accounts} icon="id" />
                <StatCard label="المحظورون" value={o.banned} icon="ban" />
                <StatCard label="عقوبات نشطة" value={o.sanctions} icon="shield" />
                <StatCard label="إجمالي الأرصدة" value={o.credits} icon="coin" />
                <StatCard label="إجمالي النقاط" value={o.points} icon="trophy" />
                <StatCard label="الانتصارات" value={o.wins} icon="crown" />
                <StatCard label="منتجات نشطة" value={o.store_active} icon="bag" />
                <StatCard label={`الألعاب المفعّلة (${o.games_active}/${o.games_total})`} value={o.games_active} icon="game" />
                <StatCard label="البطولات" value={o.tournaments} icon="mega" />
                <StatCard label="تذاكر مفتوحة" value={o.tickets_open} icon="life" />
                <StatCard label="بلاغات جديدة" value={o.reports_new} icon="flag" />
                <StatCard label="مرات اللعب" value={o.plays} icon="chart" />
                <StatCard label="زيارات الموقع" value={o.visits} icon="monitor" />
            </div>
            <div className="icc-tb">
                {[7, 30].map(n => (
                    <span key={n} className={`icc-chip${period === n ? ' a' : ''}`} onClick={() => setPeriod(n)}>
                        {n === 7 ? '٧ أيام' : '٣٠ يوماً'}
                    </span>
                ))}
            </div>
            <div className="icc-two">
                <div className="icc-card">
                    <span className="icc-h3">نشاط اللاعبين — مرات اللعب اليومية</span>
                    <Bars data={series.map(s => Number(s.plays))} labels={series.map(s => fmtDay(s.day))} height={170} />
                    <div style={{ color: 'var(--m)', fontSize: 12, marginTop: 8 }}>
                        من جدول game_points الحقيقي: كل حدث نقاط = لعبة واحدة مكتملة.
                    </div>
                </div>
                <div className="icc-card">
                    <span className="icc-h3">النشاط المباشر</span>
                    {data.audit.slice(0, 8).map(a => (
                        <FeedRow key={String(a.id)} text={`${a.type}${a.target ? ' · ' + a.target : ''}`} right={fmtTime(a.time)} />
                    ))}
                    {!data.audit.length && <Empty text="لا توجد عمليات بعد — أوّل كتابة تسجَّل هنا" />}
                    <div className="icc-tb" style={{ marginTop: 10, marginBottom: 0 }}>
                        <button className="icc-btn o" onClick={() => go('audit')}>سجل العمليات</button>
                        {newBad(data) > 0 && <button className="icc-btn d" onClick={() => go('reports')}>بلاغات جديدة ({newBad(data)})</button>}
                    </div>
                </div>
            </div>
            <div className="icc-card">
                <span className="icc-h3">ملخص سريع</span>
                <div className="icc-grid" style={{ marginBottom: 0 }}>
                    <StatCard label="الإنفاق (نقاط)" value={o.spend} icon="coin" />
                    <StatCard label="مقتنيات مملوكة" value={o.inventory} icon="box" />
                    <StatCard label="أكواد نشطة" value={o.promos_active} icon="tag" />
                    <StatCard label="لاعب نشط (٧ أيام)" value={data.analytics.dau.week} icon="users" />
                </div>
            </div>
        </>
    );
}

const newBad = (d: AdminData) => d.reports.filter(r => r.status === 'جديد').length;

function AnalyticsView({ data, period }: { data: AdminData; period: number }) {
    const o = data.overview as any;
    const series = data.analytics.series.slice(-period);
    const ranks = [...data.analytics.rankings].sort((a, b) => b.plays - a.plays);
    const sellers = data.analytics.topSellers;
    const least = [...ranks].reverse().slice(0, 4);
    return (
        <>
            <div className="icc-grid">
                <StatCard label="نشط اليوم" value={data.analytics.dau.today} icon="users" />
                <StatCard label="نشط ٧ أيام" value={data.analytics.dau.week} icon="users" />
                <StatCard label="نشط ٣٠ يوماً" value={data.analytics.dau.month} icon="users" />
                <StatCard label="إجمالي مرات اللعب" value={o.plays} icon="game" />
                <StatCard label="نقاط مُنحت" value={o.points} icon="trophy" />
                <StatCard label="نقاط مصروفة في المتجر" value={o.spend} icon="coin" />
            </div>
            <div className="icc-tb">{[7, 30].map(n => <span key={n} className={`icc-chip${period === n ? ' a' : ''}`}>{n === 7 ? '٧ أيام' : '٣٠ يوماً'}</span>)}</div>
            <div className="icc-two">
                <div className="icc-card">
                    <span className="icc-h3">النقاط الممنوحة يومياً</span>
                    <Bars data={series.map(s => Number(s.points))} labels={series.map(s => fmtDay(s.day))} height={170} />
                </div>
                <div className="icc-card">
                    <span className="icc-h3">الأكثر مبيعاً</span>
                    {sellers.slice(0, 6).map((x, k) => <FeedRow key={k} text={String(x.name)} right={fmt(Number(x.sold))} />)}
                    {!sellers.length && <Empty text="لا مبيعات بعد" />}
                </div>
            </div>
            <div className="icc-two">
                <div className="icc-card">
                    <span className="icc-h3">أكثر الألعاب لعباً</span>
                    <Bars data={ranks.slice(0, 8).map(x => Number(x.plays))} labels={ranks.slice(0, 8).map(x => String(x.name).slice(0, 5))} height={180} />
                </div>
                <div className="icc-card">
                    <span className="icc-h3">الأقل لعباً — راجعها</span>
                    {least.map((x, k) => <FeedRow key={k} text={String(x.name)} right={`${fmt(Number(x.plays))} لعبة`} />)}
                    {!least.length && <Empty text="لا بيانات لعب بعد" />}
                    <div style={{ color: 'var(--m)', fontSize: 12, marginTop: 8 }}>
                        الأرقام من مجمّع game_leaderboard لكل لعبة، ولا شيء مقدّر.
                    </div>
                </div>
            </div>
            <div className="icc-card icc-tw">
                <table>
                    <thead><tr><th>اللعبة</th><th>مرات اللعب</th><th>النقاط</th><th>لاعبون</th><th>آخر فوز</th></tr></thead>
                    <tbody>
                        {ranks.map((r, i) => (
                            <tr key={r.game_code + i}>
                                <td>{r.name}</td><td>{fmt(r.plays)}</td><td>{fmt(r.points)}</td><td>{fmt(r.players)}</td>
                                <td>{fmtTime(r.last_play)}</td>
                            </tr>
                        ))}
                        {!ranks.length && <tr><td colSpan={5}><Empty text="لم تُلعَب لعبة بعد" /></td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function EconomyView({ data, onMass }: { data: AdminData; onMass: () => void }) {
    const o = data.overview as any;
    const players = Math.max(Number(o.players) || 0, 1);
    const tx = data.economy.transactions;
    return (
        <>
            <div className="icc-grid">
                <StatCard label="إجمالي الأرصدة" value={o.credits} icon="coin" />
                <StatCard label="متوسط الرصيد" value={Math.round(o.credits / players)} icon="chart" />
                <StatCard label="إجمالي النقاط" value={o.points} icon="trophy" />
                <StatCard label="نقاط مصروفة" value={o.spend} icon="bag" />
                <StatCard label="مقتنيات مملوكة" value={o.inventory} icon="box" />
                <StatCard label="عمليات مسجّلة" value={tx.length} icon="log" />
            </div>
            <div className="icc-tb">
                <button className="icc-btn" onClick={onMass}><Icon n="coin" /> مكافأة جماعية</button>
                <span style={{ color: 'var(--m)', fontSize: 12 }}>تُصرف لكل لاعب غير محظور، وتُسجَّل عملية عملية في السجل.</span>
            </div>
            <div className="icc-card icc-tw">
                <span className="icc-h3">سجل المعاملات</span>
                <table>
                    <thead><tr><th>الوقت</th><th>اللاعب</th><th>التفاصيل</th><th>المبلغ</th></tr></thead>
                    <tbody>
                        {tx.map((t, i) => (
                            <tr key={i}>
                                <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(t.time)}</td>
                                <td>{t.player}</td><td>{t.detail}</td>
                                <td style={{ color: Number(t.amount) < 0 ? 'var(--no)' : 'var(--ok)', fontWeight: 800 }}>{fmt(Number(t.amount))}</td>
                            </tr>
                        ))}
                        {!tx.length && <tr><td colSpan={4}><Empty text="لا معاملات بعد" /></td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function ArenaView(props: {
    data: AdminData;
    draft: { theme: string; particles: string; enabled: boolean; volume: number; url: string } | null;
    setDraft: any; busy: boolean; onSave: () => void; onReset: () => void; onDefault: () => void;
}) {
    const { draft, setDraft, busy } = props;
    if (!draft) return <Empty text="تعذّر تحميل إعدادات الساحة" />;
    const live = props.data.arena;
    const same = draft.theme === (live.theme || 'default') && draft.particles === (live.particles || 'none')
        && !!draft.enabled === !!live.audio?.enabled && Number(draft.volume) === Number(live.audio?.volume ?? 50)
        && String(draft.url || '') === String(live.audio?.url || '');
    return (
        <div className="icc-card" style={{ maxWidth: 780 }}>
            <span className="icc-h3">السمة العامة</span>
            <div className="icc-tb">
                {THEME_LABELS.map(([k, label]) => (
                    <span key={k} className={`icc-chip${draft.theme === k ? ' a' : ''}`} onClick={() => setDraft((d: any) => ({ ...d, theme: k }))}>{label}</span>
                ))}
            </div>
            <span className="icc-h3" style={{ marginTop: 12 }}>المؤثرات البصرية</span>
            <div className="icc-tb">
                {FX_LABELS.map(([k, label]) => (
                    <span key={k} className={`icc-chip${draft.particles === k ? ' a' : ''}`} onClick={() => setDraft((d: any) => ({ ...d, particles: k }))}>{label}</span>
                ))}
            </div>
            <span className="icc-h3" style={{ marginTop: 12 }}>الصوت العام</span>
            <div className="icc-tb">
                <span className={`icc-chip${draft.enabled ? ' a' : ''}`} onClick={() => setDraft((d: any) => ({ ...d, enabled: !d.enabled }))}>
                    {draft.enabled ? 'مفعّل' : 'موقوف'}
                </span>
                <span style={{ color: 'var(--m)', fontSize: 12 }}>مستوى الصوت: {Math.round(draft.volume)}</span>
            </div>
            <input type="range" min={0} max={100} value={draft.volume} style={{ width: '100%' }}
                onChange={e => setDraft((d: any) => ({ ...d, volume: Number(e.target.value) }))} />
            <label>رابط المصدر (mp3/m3u8)</label>
            <input className="icc-f" placeholder="https://" value={draft.url} onChange={e => setDraft((d: any) => ({ ...d, url: e.target.value }))} />
            <div className="icc-tb" style={{ marginTop: 14 }}>
                <button className="icc-btn" disabled={busy || same} onClick={props.onSave}><Icon n="check" /> حفظ وتطبيق</button>
                <button className="icc-btn o" onClick={props.onReset}>استعادة المحفوظ</button>
                <button className="icc-btn o" disabled={busy} onClick={props.onDefault}>الافتراضي</button>
            </div>
            {!same && <div style={{ color: 'var(--g)', fontSize: 12, marginTop: 8 }}>تغييرات غير محفوظة — الساحة تعرض المحفوظ حالياً.</div>}
            <div style={{ color: 'var(--m)', fontSize: 12, marginTop: 8 }}>
                تُقرأ هذه القيم مباشرة في ساحة المتصدرين عبر realtime، فتتغيّر عند المشاهدين فور الحفظ.
            </div>
        </div>
    );
}

function SystemView({ data, busy, run, toast }: {
    data: AdminData; busy: boolean;
    run: (c: string, p?: Record<string, any>, o?: any) => Promise<MutateResult>; toast: (m: string, b?: boolean) => void;
}) {
    const integ = data.system.integrity || {};
    const badCount = Object.values(integ).reduce((a: number, v: any) => a + (Number(v) > 0 ? 1 : 0), 0);
    const health = data.system.health || [];
    const download = async (format: 'json' | 'csv') => {
        try {
            const r = await fetch(`/api/admin/export?format=${format}`, { credentials: 'include' });
            if (!r.ok) { toast('تعذّر التصدير: ' + (await r.text().catch(() => r.status)), true); return; }
            const blob = await r.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `icg1-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${format}`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            await run('sys.export', { format }, { silent: true });
            toast('نُزّلت النسخة الاحتياطية');
        } catch (e: any) { toast('تعذّر التصدير: ' + (e?.message || ''), true); }
    };
    return (
        <>
            <div className="icc-grid">
                <StatCard label="جداول القاعدة" value={health.length} icon="server" raw={false} />
                <StatCard label="بنود تفحصها السلامة" value={Object.keys(integ).length} icon="shield" />
                <StatCard label="بنود تحتاج انتباهاً" value={badCount} icon="flag" />
            </div>
            <div className="icc-tb">
                <button className="icc-btn" disabled={busy} onClick={() => download('json')}><Icon n="dl" /> نسخة احتياطية JSON</button>
                <button className="icc-btn o" disabled={busy} onClick={() => download('csv')}><Icon n="dl" /> نسخة CSV</button>
                <button className="icc-btn o" disabled={busy} onClick={async () => {
                    const r = await run('sys.integrity', {}, { silent: true });
                    if (r.ok) setIntegrityToast(toast, r.data);
                }}><Icon n="shield" /> فحص السلامة الآن</button>
            </div>
            <div className="icc-two">
                <div className="icc-card icc-tw">
                    <span className="icc-h3">حجم الجداول وأعدادها (من القاعدة نفسها)</span>
                    <table>
                        <thead><tr><th>الجدول</th><th>الأسطر</th><th>الحجم</th></tr></thead>
                        <tbody>
                            {health.slice(0, 24).map((h, i) => (
                                <tr key={h.table_name + i}>
                                    <td>{h.table_name}</td><td>{fmt(Number(h.rows))}</td><td>{h.size}</td>
                                </tr>
                            ))}
                            {!health.length && <tr><td colSpan={3}><Empty text="لا يمكن قراءة pg_class" /></td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="icc-card">
                    <span className="icc-h3">فحص سلامة البيانات</span>
                    {Object.entries(integ).map(([k, v]) => (
                        <FeedRow key={k} text={`${LABELS[k] || k}: ${fmt(Number(v))}`} right={Number(v) > 0 ? 'انتبه' : 'سليم'} />
                    ))}
                    {!Object.keys(integ).length && <Empty text="لم تُنفَّذ دوال الفحص بعد" />}
                    <div style={{ color: 'var(--m)', fontSize: 12, marginTop: 8 }}>
                        آخر تصدير: {data.system.lastExport ? fmtTime(data.system.lastExport) : 'لم يُصدَّر بعد'}
                    </div>
                    <div style={{ color: data.system.migrationsApplied ? 'var(--ok)' : 'var(--no)', fontSize: 12 }}>
                        {data.system.migrationsApplied ? 'توسعة مركز التحكم مطبَّقة في القاعدة.' : 'توسعة مركز التحكم غير مطبَّقة — نفّذ supabase/admin_center.sql.'}
                    </div>
                </div>
            </div>
        </>
    );
}

const LABELS: Record<string, string> = {
    negative_credits: 'أرصدة سالبة', negative_scores: 'نقاط سالبة', orphan_frames: 'مقتنيات يتيمة',
    banned_in_board: 'محظورون في اللوحة', dup_usernames: 'أسماء مكرّرة', expired_sanctions: 'عقوبات منتهية لم تُغلق',
    codes_past_expiry: 'أكواد منتهية نشطة', stale_sessions: 'جلسات منتهية لم تُنظَّف',
};

const setIntegrityToast = (toast: (m: string, b?: boolean) => void, data: any) => {
    const bad = Object.entries(data || {}).filter(([, v]) => Number(v) > 0);
    if (!bad.length) toast('لا بنود تحتاج انتباهاً');
    else toast(bad.map(([k, v]) => `${LABELS[k] || k}: ${v}`).join(' · '), true);
};

/* ----------------------------- مودالات ----------------------------- */

function ModalHost(props: {
    modal: ModalState; setModal: (m: ModalState) => void; busy: boolean;
    run: (c: string, p?: Record<string, any>, o?: any) => Promise<any>;
    toast: (m: string, b?: boolean) => void; data: AdminData | null;
    statsForm: any; setStatsForm: any; memberForm: any; setMemberForm: any; massForm: any; setMassForm: any;
    replyText: string; setReplyText: any; goSection: (id: SectionId) => void;
}) {
    const { modal, setModal, run, busy } = props;
    if (!modal) return null;
    const close = () => setModal(null);

    if (modal.kind === 'form') {
        const values = modal.values;
        const setValue = (k: string, v: any) => setModal({ ...modal, values: { ...values, [k]: v } });
        return (
            <Modal open title={modal.title} onClose={close} busy={busy} onOk={() => {
                const first = modal.fields[0];
                if (first && !modal.id && !String(values[first[0]] ?? '').trim() && !['reports', 'sup', 'notif'].includes(modal.section)) {
                    props.toast('الحقل الأول مطلوب', true); return;
                }
                run(modal.id ? 'rows.update' : 'rows.create', modal.id ? { section: modal.section, id: modal.id, values } : { section: modal.section, values }, { close: true });
            }}>
                {modal.fields.map(f => <Field key={f[0]} spec={f} value={values[f[0]]} onChange={(v) => setValue(f[0], v)} />)}
            </Modal>
        );
    }

    if (modal.kind === 'confirm') {
        return (
            <Modal open title={modal.title} onClose={close} busy={busy} okText={modal.okText || 'تأكيد'} onOk={() => modal.run()}>
                <p style={{ color: 'var(--t)', fontSize: 14, lineHeight: 1.9 }}>{modal.text}</p>
            </Modal>
        );
    }

    if (modal.kind === 'stats') {
        const r = modal.row;
        const opts = [['pts', 'النقاط'], ['bal', 'الرصيد'], ['wins', 'الانتصارات']] as const;
        return (
            <Modal open title={`تعديل إحصائيات ${r.name}`} onClose={close} busy={busy} okText="تأكيد التنفيذ" onOk={() => {
                const f = props.statsForm;
                if (!String(f.reason || '').trim() || !Number(f.delta)) { props.toast('السبب والقيمة مطلوبان', true); return; }
                if (Math.abs(Number(f.delta)) > 10000) { props.toast('تجاوز حد العملية (١٠٠٠٠)', true); return; }
                const cur = Number((r as any)[f.field]) || 0;
                if (cur + Number(f.delta) < 0) { props.toast('لا يمكن أن تصبح القيمة سالبة', true); return; }
                run('user.stats', { username: r.name, field: f.field, delta: Number(f.delta), reason: String(f.reason).trim() }, { close: true });
            }}>
                <div className="icc-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <StatCard label="النقاط" value={r.pts} icon="trophy" raw />
                    <StatCard label="الرصيد" value={r.bal} icon="coin" raw />
                    <StatCard label="الفوز" value={r.wins} icon="crown" raw />
                </div>
                <label>الحقل</label>
                <div className="icc-tb">
                    {opts.map(([k, l]) => <span key={k} className={`icc-chip${props.statsForm.field === k ? ' a' : ''}`}
                        onClick={() => props.setStatsForm({ ...props.statsForm, field: k })}>{l}</span>)}
                </div>
                <label>القيمة (موجبة للإضافة، سالبة للخصم)</label>
                <input className="icc-f" type="number" value={props.statsForm.delta}
                    onChange={e => props.setStatsForm({ ...props.statsForm, delta: Number(e.target.value) })} />
                <label>سبب التعديل (إجباري — يظهر في سجل العمليات)</label>
                <textarea className="icc-f" rows={2} value={props.statsForm.reason}
                    onChange={e => props.setStatsForm({ ...props.statsForm, reason: e.target.value })} />
            </Modal>
        );
    }

    if (modal.kind === 'member') {
        const r = modal.row;
        const memberships = (props.data?.tiers || []).filter(t => t.kind === 'عضوية');
        const picked = memberships.find(t => String(t.id) === props.memberForm.tier);
        return (
            <Modal open title={`عضوية ${r.name}`} onClose={close} busy={busy} okText="تطبيق" onOk={() => {
                if (props.memberForm.tier !== 'none' && !String(props.memberForm.reason || '').trim()) {
                    props.toast('السبب إجباري عند منح عضوية', true); return;
                }
                run('user.membership', { username: r.name, tier: props.memberForm.tier, reason: String(props.memberForm.reason || '').trim() }, { close: true });
            }}>
                <div className="icc-tb">
                    <span className={`icc-chip${props.memberForm.tier === 'none' ? ' a' : ''}`}
                        onClick={() => props.setMemberForm({ ...props.memberForm, tier: 'none' })}>بلا عضوية</span>
                    {memberships.map(t => (
                        <span key={String(t.id)} className={`icc-chip${props.memberForm.tier === String(t.id) ? ' a' : ''}`}
                            onClick={() => props.setMemberForm({ ...props.memberForm, tier: String(t.id) })}>{String(t.name)}</span>
                    ))}
                </div>
                <div style={{ color: 'var(--m)', fontSize: 12, lineHeight: 1.9 }}>
                    الحالية: {r.member || 'عادية'}{r.member === 'VIP' ? ' — العضوية نشطة' : ''}.
                    {picked ? ` المزايا: ${picked.perk || '—'} · الخصم ${Number(picked.discount) || 0}% · المدة ${Number(picked.duration) || 0} يوماً.` : ' «بلا عضوية» تُنهي أي عضوية سارية.'}
                    الخصم يُطبَّق عند الشراء مباشرة، والعضوية تُقرأ في لوحة العضو.
                </div>
                <label>السبب (يظهر في سجل العمليات)</label>
                <textarea className="icc-f" rows={2} value={props.memberForm.reason}
                    onChange={e => props.setMemberForm({ ...props.memberForm, reason: e.target.value })} />
            </Modal>
        );
    }

    if (modal.kind === 'crm') {
        const d = modal.detail;
        const r = d || modal.row;
        return (
            <Modal open wide title={`ملف اللاعب: ${modal.row.name}`} onClose={close} busy={busy}
                okText="حفظ الملاحظة" onOk={() => run('user.note', { username: modal.row.name, note: modal.note }, { close: true })}>
                <div className="icc-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <StatCard label="النقاط" value={(r as any).pts} icon="trophy" raw />
                    <StatCard label="الرصيد" value={(r as any).bal} icon="coin" raw />
                    <StatCard label="الإنفاق" value={(r as any).spend ?? 0} icon="bag" raw />
                    <StatCard label="بلاغات عنه" value={(r as any).reportsAbout ?? 0} icon="flag" raw />
                </div>
                <div className="icc-tb">
                    <Badge value={(r as any).status} />
                    <span className="icc-bd">{(r as any).rank}</span>
                    <span className="icc-bd">{(r as any).member}</span>
                    {(r as any).verified ? <span className="icc-bd ok">موثّق</span> : <span className="icc-bd">غير موثّق</span>}
                </div>
                <label>ملاحظة داخلية (لا تظهر للاعب)</label>
                <textarea className="icc-f" rows={3} value={modal.note} onChange={e => setModal({ ...modal, note: e.target.value })} />
                <div className="icc-two" style={{ marginTop: 12 }}>
                    <div>
                        <label>الألعاب</label>
                        {((r as any).games || []).slice(0, 8).map((g: any, i: number) => <FeedRow key={i} text={g.name} right={`${fmt(g.plays)} · ${fmt(g.points)}`} />)}
                        {!((r as any).games || []).length && <Empty text="لا لعب مسجّل" />}
                    </div>
                    <div>
                        <label>المقتنيات</label>
                        {((r as any).items || []).map((it: any, i: number) => <FeedRow key={i} text={it.name} right={it.status} />)}
                        {!((r as any).items || []).length && <Empty text="لا مقتنيات" />}
                        <label>عقوبات نشطة</label>
                        {((r as any).activeSanctions || []).map((s: any, i: number) => <FeedRow key={i} text={`${s.type}: ${s.reason}`} right={fmtTime(s.end)} />)}
                        {!((r as any).activeSanctions || []).length && <div style={{ color: 'var(--m)', fontSize: 12 }}>لا عقوبات نشطة</div>}
                    </div>
                </div>
                <label>آخر عمليات تخصّه</label>
                {((r as any).history || []).slice(0, 8).map((h: any, i: number) => <FeedRow key={i} text={`${h.label} · ${h.detail.slice(0, 60)}`} right={fmtTime(h.time)} />)}
                {!((r as any).history || []).length && <Empty text="لا عمليات تخصّه في السجل" />}
            </Modal>
        );
    }

    if (modal.kind === 'reply') {
        return (
            <Modal open title={`رد على: ${modal.row.subj}`} onClose={close} busy={busy} okText="إرسال الرد وإغلاق"
                onOk={() => {
                    if (props.replyText.trim().length < 3) { props.toast('اكتب رداً قبل الإغلاق', true); return; }
                    run('ticket.reply', { section: 'sup', id: modal.row.id, reply: props.replyText }, { close: true });
                }}>
                <div className="icc-card is-flat" style={{ fontSize: 13, marginBottom: 10 }}>
                    من: {String(modal.row.from)} · {String(modal.row.cat)} · {String(modal.row.pri)}
                </div>
                <label>نص الرد (يصل اللاعب في إعداداته وفي الجرس)</label>
                <textarea className="icc-f" rows={4} value={props.replyText} onChange={e => props.setReplyText(e.target.value)} />
            </Modal>
        );
    }

    if (modal.kind === 'mass') {
        return (
            <Modal open title="مكافأة جماعية" onClose={close} busy={busy} okText="تنفيذ"
                onOk={() => {
                    const f = props.massForm;
                    if (!String(f.reason || '').trim() || !(Number(f.amount) > 0) || Number(f.amount) > 1000) {
                        props.toast('أدخل سبباً ومبلغاً بين ١ و١٠٠٠', true); return;
                    }
                    run('eco.mass_reward', { section: 'eco', amount: Number(f.amount), reason: String(f.reason).trim() }, { close: true });
                }}>
                <label>المبلغ لكل لاعب غير محظور (رصيد)</label>
                <input className="icc-f" type="number" value={props.massForm.amount}
                    onChange={e => props.setMassForm({ ...props.massForm, amount: Number(e.target.value) })} />
                <label>السبب (إجباري)</label>
                <textarea className="icc-f" rows={2} value={props.massForm.reason}
                    onChange={e => props.setMassForm({ ...props.massForm, reason: e.target.value })} />
                <div style={{ color: 'var(--m)', fontSize: 12, marginTop: 8 }}>
                    تُضاف الأرصدة كلها في عملية واحدة وتُسجَّل في السجل باسمك.
                </div>
            </Modal>
        );
    }

    if (modal.kind === 'search') {
        return (
            <Modal open title={`نتائج البحث عن «${modal.q}» (${modal.hits.length})`} onClose={close} onOk={close} okText="إغلاق">
                {modal.hits.map((h, i) => {
                    const first = h.section.cols?.[0]?.[0];
                    return <FeedRow key={i} text={`${String(h.row[first] ?? h.row.id ?? '')}`} right={h.section.title} onClick={() => props.goSection(h.section.id)} />;
                })}
                {!modal.hits.length && <Empty text="لا نتائج" />}
            </Modal>
        );
    }

    return null;
}
