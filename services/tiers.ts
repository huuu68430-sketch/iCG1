import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/* ==========================================================================
   الرُتب والعضويات — تُقرأ من جدول tiers (يمنحها SQL ويديرها مركز التحكم)
   السلم هنا هو نفس السلّم المزروع في supabase/admin_center.sql، فيبقى شكلاً
   مطابقاً تماماً لو كان الجدول غير موجود بعد (ما قبل تنفيذ الـ SQL).
   ========================================================================== */

export interface TierRow {
    id: string;
    kind: 'rank' | 'membership';
    name: string;
    min_points: number;
    discount_pct: number;
    duration_days: number | null;
    perk: string | null;
    sort: number;
    is_active: boolean;
}

const FALLBACK_RANKS: [number, string][] = [
    [0, 'مستجد'], [100, 'جندي'], [300, 'عريف'], [600, 'رقيب'], [1000, 'ملازم'],
    [1600, 'ملازم أول'], [2400, 'نقيب'], [3500, 'رائد'], [5000, 'مقدم'], [8000, 'عقيد'],
];

export interface TiersState {
    /** [حد النقاط، الاسم] مرتب تصاعدياً — نفس شكل الرتبة القديمة */
    ranks: [number, string][];
    memberships: TierRow[];
    /** أعلى خصم بين العضويات النشطة؛ القيم الفعليّة تُطبَّق في السيرفر عند الشراء */
    vipDiscount: number;
    /** هل الاسم الحالي رتبة أم عضوية مُمنوحة (VIP…) */
    membershipLabel: (membershipId: string | null | undefined) => string;
}

let ranks: [number, string][] = FALLBACK_RANKS;
let memberships: TierRow[] = [];
let started = false;
const subs = new Set<() => void>();

const num = (v: any) => Math.max(0, Math.round(Number(v) || 0));

const apply = (rows: any[]) => {
    const live = (rows || []).filter((r: any) => r && r.is_active !== false);
    const rankRows = live
        .filter((r: any) => (r.kind || 'rank') === 'rank')
        .sort((a: any, b: any) => num(a.min_points) - num(b.min_points) || num(a.sort) - num(b.sort));
    const rk = rankRows
        .map((r: any) => [num(r.min_points), String(r.name || '')] as [number, string])
        .filter((x: [number, string]) => !!x[1]);
    ranks = rk.length ? rk : FALLBACK_RANKS;
    memberships = live
        .filter((r: any) => r.kind === 'membership')
        .map((r: any) => ({ ...r, min_points: num(r.min_points), discount_pct: num(r.discount_pct) }));
    subs.forEach(fn => fn());
};

const load = () => supabase
    .from('tiers')
    .select('*')
    .then(({ data, error }: any) => { if (!error && data) apply(data); });

const start = () => {
    if (started) return;
    started = true;
    load();
    let retry: any;
    let isActive = true;
    const connect = () => {
        if (!isActive) return;
        supabase
            .channel('tiers_catalog')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tiers' }, () => load())
            .subscribe((status: string) => {
                if (status === 'CHANNEL_ERROR' && isActive) retry = setTimeout(connect, 3000);
            });
    };
    connect();
};

const membershipLabelOf = (id: string | null | undefined) => {
    const key = String(id || '').trim().toLowerCase();
    if (!key || key === 'none' || key === 'عادية') return '';
    const hit = memberships.find(m => String(m.id).toLowerCase() === key)
        || memberships.find(m => String(m.name).toLowerCase() === key);
    return hit ? String(hit.name) : String(id);
};

export const getVipDiscount = (): number => memberships.reduce((mx, m) => Math.max(mx, m.discount_pct), 0);

export const useTiers = (): TiersState => {
    const [, setTick] = useState(0);
    useEffect(() => {
        const fn = () => setTick(t => t + 1);
        subs.add(fn);
        start();
        return () => { subs.delete(fn); };
    }, []);
    return {
        ranks,
        memberships,
        vipDiscount: getVipDiscount(),
        membershipLabel: membershipLabelOf,
    };
};

/** حساب الرتبة من نفس السلم المعروض — بدون نسخة ثانية من الأرقام. */
export const rankIndexOf = (ladder: [number, string][], points: number) => {
    let r = 0;
    ladder.forEach((x, i) => { if (points >= x[0]) r = i; });
    return r;
};
