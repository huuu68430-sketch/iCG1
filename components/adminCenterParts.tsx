import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ذرّات مركز تحكم الإدارة — ملف واحد للأجزاء الصغيرة المتكررة.
 * كل الأشكال منقولة حرفياً من التصميم المرجعي (iCG1 Admin Control Center.html).
 */

const PATHS: Record<string, string> = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
    users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
    id: 'M3 5h18v14H3zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4M5 16a3 3 0 0 1 6 0M14 9h4M14 13h4',
    shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
    flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
    game: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M17 6H7a5 5 0 0 0-5 5v3a3 3 0 0 0 5 2l1-2h8l1 2a3 3 0 0 0 5-2v-3a5 5 0 0 0-5-5z',
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
    coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v12M9 9h5a2 2 0 0 1 0 4H9.5a2 2 0 0 0 0 4H15',
    bag: 'M5 7h14l-1 14H6zM9 7a3 3 0 0 1 6 0',
    box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v9',
    crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
    mega: 'M3 11v3l14 5V6zM17 9a3 3 0 0 1 0 6M6 15v4h3',
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
    life: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4',
    key: 'M15 8a4 4 0 1 1-3.5 6L3 22v-3h3v-3h3l2-2',
    tag: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01',
    monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
    log: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3',
    server: 'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4-4',
    plus: 'M12 5v14M5 12h14',
    edit: 'M4 20h4L19 9l-4-4L4 16z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
    x: 'M6 6l12 12M18 6L6 18',
    menu: 'M3 6h18M3 12h18M3 18h18',
    check: 'M5 12l5 5 9-10',
    copy: 'M9 9h11v11H9zM5 15V4h11',
    ban: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M5 5l14 14',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    power: 'M12 3v9M6.5 6a8 8 0 1 0 11 0',
    chev: 'M6 9l6 6 6-6',
    cal: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
    dl: 'M12 3v12M7 11l5 5 5-5M4 21h16',
    refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
    out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

export const Icon = ({ n, className }: { n: string; className?: string }) => (
    <svg className={className ? `i ${className}` : 'i'} viewBox="0 0 24 24" aria-hidden="true">
        <path d={PATHS[n] || PATHS.box} />
    </svg>
);

/* ------------------------------- تنسيق ------------------------------- */

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
void AR_DIGITS;

export const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-US');

export const fmtTime = (v: any) => {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtDay = (v: any) => {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v ?? '');
    return d.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' });
};

/* ------------------------------ حالة ------------------------------- */

export const Badge = ({ value }: { value: any }) => {
    const s = String(value ?? '');
    if (!s) return null;
    const no = ['محظور', 'مغلقة', 'موقوف', 'مخفي', 'مخفية', 'مرفوض', 'منتهي', 'مسودة', 'ملغي'].includes(s);
    const ok = ['نشط', 'مجهّز', 'تم الحل', 'مكتملة', 'مكتمل', 'منشور', 'جارية', 'التسجيل مفتوح', 'تم الإرسال', 'مقبول', 'مفعّل', 'موثّق'].includes(s);
    return <span className={`icc-bd${no ? ' no' : ok ? ' ok' : ''}`}>{s}</span>;
};

/** عدّاد تصاعدي — نفس لملة التصميم المرجعي، بلا إعادة رسم للوحة كلها. */
export const CountUp = ({ value }: { value: number }) => {
    const [shown, setShown] = useState(0);
    const fromRef = useRef(0);
    useEffect(() => {
        const target = Math.round(Number(value) || 0);
        const from = fromRef.current;
        const t0 = performance.now();
        let raf = 0;
        const step = (now: number) => {
            const k = Math.min((now - t0) / 800, 1);
            const e = 1 - Math.pow(1 - k, 3);
            setShown(Math.round(from + (target - from) * e));
            if (k < 1) raf = requestAnimationFrame(step);
            else fromRef.current = target;
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value]);
    return <b>{fmt(shown)}</b>;
};

export const StatCard = ({ label, value, icon, raw }: { label: string; value: number | string; icon: string; raw?: boolean }) => (
    <div className="icc-card icc-st">
        <small>{label}</small>
        {raw || typeof value === 'string' ? <b>{value}</b> : <CountUp value={value as number} />}
        <Icon n={icon} />
    </div>
);

export const Skeleton = ({ n = 4 }: { n?: number }) => (
    <div className="icc-grid">{Array.from({ length: n }).map((_, k) => <div className="icc-sk" key={k} />)}</div>
);

export const Empty = ({ text }: { text?: string }) => (
    <div className="icc-em">{text || 'لا توجد بيانات لعرضها بعد'}</div>
);

/** أعمدة بيانية SVG — منقولة كما هي من bars() في التصميم المرجعي. */
export const Bars = ({ data, labels, height = 140, unit }: { data: number[]; labels: string[]; height?: number; unit?: string }) => {
    const max = Math.max(...data, 1);
    const w = 100 / Math.max(data.length, 1);
    const top = height / 2;
    return (
        <div>
            <svg viewBox={`0 0 100 ${top}`} preserveAspectRatio="none" style={{ width: '100%', height: `${height}px`, display: 'block' }}>
                <defs>
                    <linearGradient id="icc-gg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f1d08f" />
                        <stop offset="100%" stopColor="#6b4a28" />
                    </linearGradient>
                </defs>
                {data.map((v, k) => {
                    const h = Math.max((v / max) * (top - 4), v > 0 ? 1 : 0);
                    return <rect key={k} x={k * w + w * 0.15} y={top - h} width={w * 0.7} height={h} rx={1} fill="url(#icc-gg)"><title>{`${labels[k] ?? ''}: ${fmt(v)}${unit || ''}`}</title></rect>;
                })}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--m)', fontSize: 11, gap: 4, flexWrap: 'wrap' }}>
                {labels.map((l, k) => <span key={k} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: `${100 / Math.max(labels.length, 1)}%` }}>{l}</span>)}
            </div>
        </div>
    );
};

/** صف تغذية حيّة */
export const FeedRow = ({ text, right, onClick }: { text: string; right?: string; onClick?: () => void }) => (
    <div className="icc-fd" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
        <i />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
        {right ? <small>{right}</small> : null}
    </div>
);

/* ------------------------------ النماذج ----------------------------- */

export type FieldSpec = [string, string, ('text' | 'number' | 'date' | 'sel' | 'area' | 'check')?, string[]?];

export const Field = ({ spec, value, onChange }: { spec: FieldSpec; value: any; onChange: (v: any) => void }) => {
    const [key, label, type, options] = spec;
    if (type === 'check') {
        return (
            <>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--m)', margin: '10px 0 4px' }}>{label}</label>
                <div className="icc-tb" style={{ margin: 0 }}>
                    <span className={`icc-chip${value ? ' a' : ''}`} onClick={() => onChange(value ? 0 : 1)}>{value ? 'نعم' : 'لا'}</span>
                </div>
            </>
        );
    }
    const common = { className: 'icc-f', value: value ?? '' };
    return (
        <>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--m)', margin: '10px 0 4px' }}>{label}</label>
            {type === 'sel' ? (
                <select {...common} onChange={e => onChange(e.target.value)}>
                    {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : type === 'area' ? (
                <textarea {...common} rows={3} onChange={e => onChange(e.target.value)} />
            ) : (
                <input
                    {...common}
                    type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
                    onChange={e => onChange(type === 'number' ? e.target.value : e.target.value)}
                />
            )}
        </>
    );
};

export const formDefaults = (fields: FieldSpec[] = [], extra: Record<string, any> = {}) => {
    const o: Record<string, any> = { ...extra };
    fields.forEach(([k, , type, options]) => {
        if (o[k] !== undefined) return;
        if (type === 'sel') o[k] = options?.[0] ?? '';
        else if (type === 'number') o[k] = 0;
        else if (type === 'check') o[k] = 1;
        else o[k] = '';
    });
    return o;
};

/* ----------------------------- الجسيمات ----------------------------- */

export const Particles = ({ enabled = true }: { enabled?: boolean }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        if (!enabled) return;
        const c = ref.current;
        if (!c) return;
        const x = c.getContext('2d');
        if (!x) return;
        let W = 0, H = 0, raf = 0;
        const ps = Array.from({ length: 70 }).map(() => ({
            x: Math.random() * (window.innerWidth || 1),
            y: Math.random() * (window.innerHeight || 1),
            r: Math.random() * 1.8 + 0.4,
            v: Math.random() * 0.35 + 0.1,
            a: Math.random() * 6,
        }));
        const rs = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
        rs();
        window.addEventListener('resize', rs);
        const loop = () => {
            x.clearRect(0, 0, W, H);
            ps.forEach(p => {
                p.y -= p.v; p.a += 0.02;
                if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
                x.beginPath();
                x.arc(p.x + Math.sin(p.a) * 12, p.y, p.r, 0, 7);
                x.fillStyle = 'rgba(233,194,122,' + (0.25 + Math.sin(p.a) * 0.2) + ')';
                x.shadowBlur = 8; x.shadowColor = '#e9c27a';
                x.fill();
            });
            raf = requestAnimationFrame(loop);
        };
        loop();
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', rs); };
    }, [enabled]);
    if (!enabled) return null;
    return <canvas ref={ref} className="icc-pc" aria-hidden="true" />;
};

/* ------------------------------ مودال ------------------------------- */

export function Modal({ open, title, onClose, children, okText = 'حفظ', onOk, busy, wide }: {
    open: boolean; title: string; onClose: () => void; children: React.ReactNode;
    okText?: string; onOk?: () => void; busy?: boolean; wide?: boolean;
}) {
    useEffect(() => {
        if (!open) return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="icc-mb is-open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="icc-md" style={wide ? { width: 'min(760px,100%)' } : undefined}>
            <h3>{title}</h3>
            <div className="icc-scroll" style={{ maxHeight: '62vh' }}>{children}</div>
            <div className="icc-tb" style={{ marginTop: 16 }}>
                {onOk ? <button className="icc-btn" disabled={busy} onClick={onOk}>{busy ? 'جارٍ…' : okText}</button> : null}
                <button className="icc-btn o" onClick={onClose}>إغلاق</button>
            </div>
          </div>
        </div>
    );
}

/* ------------------------------ توست ------------------------------- */

export interface Toast { id: number; msg: string; bad?: boolean }

export const useToasts = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toast = useCallback((msg: string, bad?: boolean) => {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, msg, bad }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400);
    }, []);
    return { toasts, toast };
};

export const Toasts = ({ items }: { items: Toast[] }) => (
    <div className="icc-ts">
        {items.map(t => <div key={t.id} className={`icc-t${t.bad ? ' e' : ''}`}>{t.msg}</div>)}
    </div>
);
