import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/* ==========================================================================
   حالة الساحة — تُقرأ من arena_status (قيم حقيقية، لا افتراضيات مخفية)
   المشرف يكتبها من مركز التحكم عبر /api/admin/mutate (arena.save)،
   والمتصفح يقرأها مباشرة (grant select) ويتحدّث فوراً عبر realtime.
   ========================================================================== */

export type ArenaTheme = 'default' | 'neon' | 'gold' | 'stealth';
export type ArenaFx = 'none' | 'snow' | 'ember' | 'celeb';

export interface ArenaStatus {
    theme: ArenaTheme;
    particles: ArenaFx;
    audio: { enabled: boolean; volume: number; url: string };
}

/** نفس القيم المزروعة في supabase/admin_center.sql — قبل أول قراءة ناجحة. */
export const ARENA_DEFAULT: ArenaStatus = {
    theme: 'default',
    particles: 'none',
    audio: { enabled: false, volume: 50, url: '' },
};

const clamp = (v: any, lo: number, hi: number, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/** الصفّان مستقلان، فنخمّن كل واحد من قيمته الخام فقط. */
const moodOf = (raw: any): Pick<ArenaStatus, 'theme' | 'particles'> => ({
    theme: (['default', 'neon', 'gold', 'stealth'] as string[]).includes(raw?.theme) ? raw.theme : 'default',
    particles: (['none', 'snow', 'ember', 'celeb'] as string[]).includes(raw?.particles) ? raw.particles : 'none',
});

const audioOf = (raw: any): ArenaStatus['audio'] => ({
    enabled: !!raw?.enabled && !!String(raw?.url || '').trim(),
    volume: clamp(raw?.volume, 0, 100, 50),
    url: String(raw?.url || '').trim(),
});

let moodRaw: any = {};
let audioRaw: any = {};
let current: ArenaStatus = ARENA_DEFAULT;
let loading = false;
let started = false;
const subs = new Set<() => void>();

const recompose = () => {
    current = { ...moodOf(moodRaw), audio: audioOf(audioRaw) };
    subs.forEach(fn => fn());
};

const connect = () => {
    if (started) return;
    started = true;
    loading = true;

    // Promise.resolve: مبنيّ استعلام supabase-js هو PromiseLike، والتسلسل مع catch يحتاج Promise حقيقيًا
    Promise.resolve(supabase
        .from('arena_status')
        .select('key, value'))
        .then(({ data, error }: any) => {
            loading = false;
            if (error || !data?.length) return subs.forEach(fn => fn());
            data.forEach((r: any) => {
                if (r.key === 'global_mood') moodRaw = r.value || {};
                else if (r.key === 'audio_overlay') audioRaw = r.value || {};
            });
            recompose();
        })
        .catch(() => { loading = false; subs.forEach(fn => fn()); });

    let retry: any;
    let alive = true;
    const subscribe = () => {
        if (!alive) return;
        supabase
            .channel('arena_status_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_status' }, (payload: any) => {
                const row: any = payload.new || payload.old;
                if (!row?.key) return;
                if (row.key === 'global_mood') moodRaw = row.value || {};
                else if (row.key === 'audio_overlay') audioRaw = row.value || {};
                else return;
                recompose();
            })
            .subscribe((status: string) => {
                if (status === 'CHANNEL_ERROR' && alive) retry = setTimeout(subscribe, 3000);
            });
    };
    subscribe();

    // القناة تبقى مفتوحة بعد فكّ آخر مكوّن: المشاهد يتنقّل بين الساحة
    //والألعاب، ويريد أحدث سمة محفوظة لحظة العودة بدون إعادة تحميل.
};

const useStore = () => {
    const [, setTick] = useState(0);
    useEffect(() => {
        const fn = () => setTick(t => t + 1);
        subs.add(fn);
        connect();
        return () => { subs.delete(fn); };
    }, []);
    return { status: current, loading };
};

export const getArenaStatus = (): ArenaStatus => current;

export const useArenaStatus = (): { status: ArenaStatus; loading: boolean } => useStore();
