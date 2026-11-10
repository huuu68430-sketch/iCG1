import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Home, ShoppingBag, Box, Trophy, Settings, Gem, Crown, Medal, Gift,
    Zap, Wallet, User, Shield, LogOut, Check, Lock,
    X as XIcon, Target, Star, Ban, ShieldAlert, Loader2, Save,
    Clock, Volume2, Wand2, ShoppingCart,
    Bell, Flag, LifeBuoy, Send, Megaphone, TriangleAlert, Tag, Gavel
} from 'lucide-react';
import { supabase, leaderboardService } from '../services/supabase';
import { adminApi } from '../services/adminCenter';
import { useTiers, rankIndexOf } from '../services/tiers';
import {
    memberApi, type MemberReport, type MemberSanction, type MemberTicket,
    type MemberNotification, type MemberAnnouncement, type MemberTournament
} from '../services/memberApi';
import { chatService } from '../services/chatService';
import { getAssetUrl } from '../utils/assets';
import { FrameArt } from './FrameArt';
import {
    FRAMES, FREE_FRAME_IDS, RARITY, FrameDef, FrameRarity, frameById, isFrameId
} from '../data/frames';
import './MemberDashboard.css';

interface UserDashboardProps {
    userData: {
        id: string;
        kick_username: string;
        display_name: string;
        avatar?: string;
        points?: number;
    };
    onLogout?: () => void;
}

type DashView = 'home' | 'store' | 'locker' | 'rank' | 'settings';
type Filter = 'all' | 'free' | FrameRarity;

/* التبويب من الرابط: /user-dashboard?tab=store أو /#store — لتُفتح صفحة المتجر مباشرةً */
const TABS: DashView[] = ['home', 'store', 'locker', 'rank', 'settings'];
const readDashTab = (): DashView | null => {
    try {
        const q = (new URLSearchParams(window.location.search).get('tab') || '').toLowerCase() as DashView;
        const h = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase() as DashView;
        return TABS.includes(q) ? q : TABS.includes(h) ? h : null;
    } catch { return null; }
};

const NAV: { id: DashView; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'store', label: 'المتجر', icon: ShoppingBag },
    { id: 'locker', label: 'الخزانة', icon: Box },
    { id: 'rank', label: 'الصدارة', icon: Trophy },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
];

const DAILY_REWARDS = [20, 30, 40, 60, 80, 100, 250];

/* القوائم نفسها التي يقبلها السيرفر (api/user/reports.ts و api/user/tickets.ts) */
const REPORT_KINDS = ['سلوك مخالف', 'تعليق مسيء', 'غش في لعبة', 'انتحال حساب', 'محتوى غير لائق', 'إساءة لمستخدم', 'أخرى'];
const TICKET_CATS = ['مشكلة حساب', 'مشكلة مشتريات', 'مشكلة رصيد', 'مشكلة لعبة', 'بلاغ', 'اقتراح', 'مشكلة تقنية'];
const TICKET_PRIS = ['منخفضة', 'متوسطة', 'عالية'];

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-US');

/** تاريخ مختصر (dd/mm/yyyy) — نفس أسلوب اللوحة، ويحمي من قيمة غير صالحة */
const shortDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
};

/** لون حالة بلاغ/تذكرة/بطولة */
const pillClass = (status?: string) => {
    const s = String(status || '');
    if (['resolved', 'accepted', 'completed', 'مكتملة', 'تم الحل', 'مقبول'].includes(s)) return 'good';
    if (['rejected', 'closed', 'مرفوض', 'مغلقة', 'مغلق'].includes(s)) return 'mute';
    if (['new', 'reviewing', 'جديد', 'قيد المراجعة'].includes(s)) return 'wait';
    return 'open';
};

/** شارة الحالة قصيرة: مفتوحة/جارية/مغلقة بدل «التسجيل مفتوح» التي تكسر الصف */
const tourLabel = (t: { status?: string; status_ar?: string }) =>
    ({ open: 'مفتوحة', running: 'جارية', closed: 'مغلقة' } as Record<string, string>)[String(t.status)] || String(t.status_ar || t.status || '');

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** غرفة مباشرة ما زالت حيّة: آخر تحديث خلال هذه المدة */
const LIVE_ROOM_TTL = 30 * 60 * 1000;

/** مقارنة اسم لاعب بحساب كيك بدون تشكيل ولا فرق حالة */
const sameUser = (a: any, b: string) => {
    const n = (x: any) => String(x ?? '').trim().toLowerCase()
        .replace(new RegExp('[\\u064B-\\u065F\\u0640]', 'g'), '')
        .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    const x = n(a), y = n(b);
    return !!x && !!y && x === y;
};

const rarityOf = (v: any): FrameRarity =>
    v === 'r' || v === 'e' || v === 'l' ? v : 'c';

/* جلب صورة Kick مرة واحدة لكل اسم ومشاركتها بين كل الصور */
const frameLookups: Record<string, Promise<string | null>> = {};
const frameFor = (name: string): Promise<string | null> => {
    const key = String(name || '').toLowerCase().trim().replace(/^@+/, '');
    if (!key) return Promise.resolve(null);
    if (!frameLookups[key]) {
        frameLookups[key] = (async () => {
            try {
                const u = await supabase
                    .from('users')
                    .select('id')
                    .in('kick_username', nameVariants(key))
                    .limit(1);
                const uid = u.data?.[0]?.id;
                if (!uid) return null;
                const f = await supabase
                    .from('user_frames')
                    .select('frame_id')
                    .eq('user_id', uid)
                    .eq('is_equipped', true)
                    .limit(1);
                const id = f.data?.[0]?.frame_id;
                return id && isFrameId(id) ? id : null;
            } catch {
                return null;
            }
        })();
    }
    return frameLookups[key];
};

const kickLookups: Record<string, Promise<string>> = {};
const kickAvatarFor = (name: string): Promise<string> => {
    const key = String(name || '').toLowerCase().trim().replace(/^@+/, '');
    if (!key) return Promise.resolve('');
    if (!kickLookups[key]) {
        kickLookups[key] = chatService.fetchKickAvatar(key)
            .catch(() => '')
            .then(url => {
                // لا نخزّن فشلاً دائماً حتى تُعاد المحاولة لاحقاً
                if (!url) delete kickLookups[key];
                return url;
            });
    }
    return kickLookups[key];
};

/** أشكال اسم الحساب المحتملة (حساسية الأحرف في قاعدة البيانات) */
const nameVariants = (name: string): string[] => {
    const n = String(name || '').trim();
    if (!n) return [];
    return Array.from(new Set([
        n,
        n.toLowerCase(),
        n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(),
    ]));
};

/* غلاف صورة عضو: صورة Kick تلقائياً، ثم الإطار الجديد إن وُجد */
const MemberAvatar: React.FC<{
    name: string;
    /** اسم حساب Kick الحقيقي إن كان الاسم المعروض مختلفاً */
    kickName?: string;
    src?: string;
    frameId?: string | null;
    boxClass?: string;
    className?: string;
}> = ({ name, kickName, src, frameId, boxClass = 'md-avbox-sm', className = '' }) => {
    const [autoFrame, setAutoFrame] = useState<string | undefined>(undefined);
    const lookupName = kickName || name;
    const [photo, setPhoto] = useState<string | undefined>(() => {
        if (src) return src;
        try {
            const key = String(lookupName || '').toLowerCase().trim().replace(/^@+/, '');
            return localStorage.getItem(`kick_av_${key}`) || undefined;
        } catch {
            return undefined;
        }
    });

    // إذا لم يصل إطار اللاعب ضمن بيانات الصدارة، اجلبه مباشرة باسم الحساب
    useEffect(() => {
        setAutoFrame(undefined);
        if (frameId || !lookupName) return;
        let alive = true;
        frameFor(lookupName).then(id => {
            if (alive && id) setAutoFrame(id);
        });
        return () => { alive = false; };
    }, [frameId, lookupName]);

    useEffect(() => {
        if (src) {
            setPhoto(src);
            try {
                const key = String(lookupName || '').toLowerCase().trim().replace(/^@+/, '');
                if (src) localStorage.setItem(`kick_av_${key}`, src);
            } catch {}
        }
        if (!lookupName) return;
        // جلب صورة Kick دائماً لجميع الحسابات
        let alive = true;
        // جلب فورياً
        kickAvatarFor(lookupName).then(url => {
            if (alive && url) {
                setPhoto(url);
                try {
                    const key = String(lookupName || '').toLowerCase().trim().replace(/^@+/, '');
                    localStorage.setItem(`kick_av_${key}`, url);
                } catch {}
            }
        });
        // إعادة المحاولة بعد فترة قصيرة لضمان الظهور بعد hard refresh
        const t1 = setTimeout(() => {
            if (!alive) return;
            kickAvatarFor(lookupName).then(url => {
                if (alive && url) {
                    setPhoto(prev => prev || url);
                    try {
                        const key = String(lookupName || '').toLowerCase().trim().replace(/^@+/, '');
                        localStorage.setItem(`kick_av_${key}`, url);
                    } catch {}
                }
            });
        }, 500);
        const t2 = setTimeout(() => {
            if (!alive) return;
            kickAvatarFor(lookupName).then(url => {
                if (alive && url) {
                    setPhoto(url);
                    try {
                        const key = String(lookupName || '').toLowerCase().trim().replace(/^@+/, '');
                        localStorage.setItem(`kick_av_${key}`, url);
                    } catch {}
                }
            });
        }, 1500);
        return () => { alive = false; clearTimeout(t1); clearTimeout(t2); };
    }, [src, lookupName, kickName]);

    const valid = frameId && isFrameId(frameId)
        ? frameId
        : (autoFrame && isFrameId(autoFrame) ? autoFrame : null);

    const recoverPhoto = () => {
        if (!lookupName) return;
        kickAvatarFor(lookupName).then(url => {
            if (url && url !== photo) {
                setPhoto(url);
                try {
                    const key = String(lookupName || '').toLowerCase().trim().replace(/^@+/, '');
                    localStorage.setItem(`kick_av_${key}`, url);
                } catch {}
            }
        });
    };

    const inner = valid ? (
        <FrameArt frameId={valid} src={photo} initial={name} title={name} onAvatarError={recoverPhoto} />
    ) : (
        <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-900 border border-white/25 grid place-items-center">
            {photo ? (
                <img
                    src={photo}
                    alt={name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={recoverPhoto}
                />
            ) : (
                <span className="text-white font-black text-sm uppercase">{(name || '?').slice(0, 2)}</span>
            )}
        </div>
    );

    return <div className={`md-avbox ${boxClass} ${className}`}>{inner}</div>;
};

const Spark: React.FC<{ seed?: number }> = ({ seed = 3 }) => {
    let y = 34;
    let d = 'M0 36';
    for (let i = 1; i <= 10; i++) {
        y = Math.max(8, Math.min(38, y + ((((seed * (i + 3) * 37) % 19) - 9))));
        d += ` L${i * 30} ${y}`;
    }
    return <svg className="sp" viewBox="0 0 300 44" preserveAspectRatio="none"><path d={d} /></svg>;
};

export const UserDashboard: React.FC<UserDashboardProps> = ({ userData, onLogout }) => {
    const username = String(userData.kick_username || (userData as any).kickUsername || '').toLowerCase();
    const userId = userData.id;

    const [view, setView] = useState<DashView>(() => readDashTab() || 'home');
    const [points, setPoints] = useState(Number(userData.points) || 0);
    const [displayName, setDisplayName] = useState(userData.display_name || username);
    const [nameDraft, setNameDraft] = useState(userData.display_name || username);
    const [avatarSrc, setAvatarSrc] = useState<string | undefined>(userData.avatar || undefined);
    const [activeFrameId, setActiveFrameId] = useState<string | undefined>(undefined);
    const [board, setBoard] = useState<any[]>([]);
    const [ownedFrames, setOwnedFrames] = useState<string[]>([...FREE_FRAME_IDS]);
    const [frames, setFrames] = useState<FrameDef[]>(FRAMES);
    const [history, setHistory] = useState<any[]>([]);
    const [daily, setDaily] = useState({ streak: 0, claimed: false });
    const [filter, setFilter] = useState<Filter>('all');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'bad' } | null>(null);
    const [confirm, setConfirm] = useState<{ title: string; body: string; ok: string; danger?: boolean; onOk: () => void } | null>(null);
    const [ban, setBan] = useState<{ active: boolean; reason: string }>({ active: false, reason: '' });
    const [isAdmin, setIsAdmin] = useState(false);
    // العضوية الممنوحة من مركز التحكم (VIP…) — تُقرأ من profiles وتُعرض بدل الرتبة عند فعاليتها
    const [membership, setMembership] = useState<{ id: string | null; expires: string | null }>({ id: null, expires: null });

    /* ----- بيانات العضو من /api/user/* (كتابة مشروطة بجلسة موقّعة على السيرفر) ----- */
    const [memberReady, setMemberReady] = useState(false);
    const [notifs, setNotifs] = useState<MemberNotification[]>([]);
    const [unread, setUnread] = useState(0);
    const [bellOpen, setBellOpen] = useState(false);
    const [annos, setAnnos] = useState<MemberAnnouncement[]>([]);
    const [tours, setTours] = useState<MemberTournament[]>([]);
    const [reports, setReports] = useState<MemberReport[]>([]);
    const [sanctions, setSanctions] = useState<MemberSanction[]>([]);
    const [tickets, setTickets] = useState<MemberTicket[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [vipStore, setVipStore] = useState<{ vip: boolean; discount_pct: number }>({ vip: false, discount_pct: 0 });
    const [support, setSupport] = useState<{ tab: 'report' | 'ticket' | 'sanction' | 'promo'; busy: string }>({ tab: 'report', busy: '' });
    const [reportDraft, setReportDraft] = useState({ kind: REPORT_KINDS[0], target: '', reason: '' });
    const [ticketDraft, setTicketDraft] = useState({ subject: '', category: TICKET_CATS[0], priority: TICKET_PRIS[1], body: '' });
    const [appealDraft, setAppealDraft] = useState({ sanctionId: '', reason: '' });
    const [promoDraft, setPromoDraft] = useState('');
    const [prefs, setPrefs] = useState<{ sound: boolean; calm: boolean }>(() => {
        try {
            const raw = localStorage.getItem('icg1_dash_prefs');
            return raw ? { sound: true, calm: false, ...JSON.parse(raw) } : { sound: true, calm: false };
        } catch {
            return { sound: true, calm: false };
        }
    });

    const toastTimer = useRef<number | null>(null);

    const notify = useCallback((msg: string, type: 'ok' | 'bad' = 'ok') => {
        setToast({ msg, type });
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 3200);
    }, []);

    /* ===== دخول الألعاب المباشرة: يتحقق من آخر غرفة ومن أن العضو ليدر فيها ===== */
    const [live, setLive] = useState<{ checking: boolean; cn: string; mafia: string }>({ checking: false, cn: '', mafia: '' });

    const checkLive = useCallback(async () => {
        setLive(s => ({ ...s, checking: true }));
        const alive = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < LIVE_ROOM_TTL;
        let cn = '', mafia = '';
        try {
            const { data } = await supabase
                .from('cn_rooms')
                .select('room_code,state,updated_at')
                .order('updated_at', { ascending: false })
                .limit(1);
            const row: any = data?.[0];
            const st: any = row?.state ?? {};
            const isLeader = [st.leaders?.red, st.leaders?.blue].some(x => sameUser(x, username));
            if (row && isLeader && !st.over && alive(row.updated_at)) cn = String(row.room_code).toUpperCase();
        } catch { /* الشبكة مقطوعة — يبقى الدخول مقفلاً */ }
        try {
            const { data } = await supabase
                .from('mafia_rooms')
                .select('code,state,updated_at')
                .order('updated_at', { ascending: false })
                .limit(1);
            const row: any = data?.[0];
            const st: any = row?.state ?? {};
            if (row && !st.res && !st.win && alive(row.updated_at)) mafia = String(row.code).toUpperCase();
        } catch { /* الشبكة مقطوعة */ }
        const next = { checking: false, cn, mafia };
        setLive(next);
        return next;
    }, [username]);

    useEffect(() => {
        if (view === 'home' && username) checkLive();
    }, [view, username, checkLive]);

    const enterLive = async (kind: 'cn' | 'mafia') => {
        const cur = (live.cn || live.mafia) ? live : await checkLive();
        const code = kind === 'cn' ? cur.cn : cur.mafia;
        if (code) {
            window.location.assign(`${window.location.origin}/${kind === 'cn' ? 'cn' : 'm'}=${code}`);
            return;
        }
        notify(
            kind === 'cn'
                ? 'ما أنت ليدر في آخر غرفة كود نيمز، أو أن اللعبة انتهت'
                : 'لا توجد غرفة مافيا نشطة الآن',
            'bad'
        );
    };

    useEffect(() => {
        // صفة المدير تُقرأ من السيرفر (جلسة حقيقية) — لا مخزون محلي يمنح صلاحيات
        let alive = true;
        if (sessionStorage.getItem('icg1_admin_session') === '1') setIsAdmin(true);
        else adminApi.me().then(r => {
            if (!alive || !r.ok) return;
            sessionStorage.setItem('icg1_admin_session', '1');
            setIsAdmin(true);
        }).catch(() => { /* لا شيء */ });
        return () => {
            alive = false;
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
        };
    }, []);

    /* ===== بيانات العضو: جلسة موقّعة على السيرفر، ثم كل الأقسام ===== */
    const refreshMember = useCallback(async () => {
        const [n, a, r, t, st, tu, pr] = await Promise.all([
            memberApi.notifications(), memberApi.announcements(), memberApi.reports(),
            memberApi.tickets(), memberApi.store(), memberApi.tournaments(), memberApi.promoHistory(),
        ]);
        if (n.ok) { setNotifs(n.notifications || []); setUnread(Number(n.unread) || 0); }
        if (a.ok) setAnnos(a.announcements || []);
        if (r.ok) { setReports(r.reports || []); setSanctions(r.sanctions || []); }
        if (t.ok) setTickets(t.tickets || []);
        if (pr.ok) setRedemptions(pr.redemptions || []);
        if (st.ok) {
            setVipStore({ vip: !!st.vip, discount_pct: Number(st.discount_pct) || 0 });
            const ids = (st.owned || []).map((o: any) => String(o.frame_id)).filter((x: string) => isFrameId(x));
            if (ids.length) setOwnedFrames((prev: string[]) => Array.from(new Set([...prev, ...ids])));
        }
        if (tu.ok) setTours(tu.tournaments || []);
    }, []);

    const ensureMember = useCallback(async (): Promise<boolean> => {
        if (memberReady) return true;
        const p = await memberApi.profile();
        if (p.ok && String(p.username || '').toLowerCase() === username) { setMemberReady(true); return true; }
        const s = await memberApi.start(username);
        if (!s.ok) return false;
        setMemberReady(true);
        return true;
    }, [memberReady, username]);

    useEffect(() => {
        if (!username) return;
        (async () => {
            if (await ensureMember()) await refreshMember();
        })().catch(() => { /* الجلسة اختيارية — الأقسام تبقى فارغة بلا خطأ */ });
    }, [username, ensureMember, refreshMember]);

    // الإشعارات تُجلب من السيرفر فقط (ممنوع قراءتها من المتصفح)، فأقرب بديل للنشر اللحظي دورة هادئة
    useEffect(() => {
        if (!memberReady) return;
        const id = window.setInterval(() => {
            memberApi.notifications().then(r => {
                if (r.ok) { setNotifs(r.notifications || []); setUnread(Number(r.unread) || 0); }
            });
        }, 60000);
        return () => window.clearInterval(id);
    }, [memberReady]);

    const didLoad = useRef(false);

    const load = useCallback(async () => {
        if (!username) { setLoading(false); return; }
        setLoading(true);
        try {
            // صورة Kick تُجلب دائماً باسم الحساب الصحيح (لا باسم العرض)
            chatService.fetchKickAvatar(username)
                .then(url => { if (url) { setAvatarSrc(url); try { localStorage.setItem(`kick_av_${username}`, url); } catch {} } })
                .catch(() => { /* ignore */ });
            // محاولة إضافية مباشرة
            setTimeout(() => {
                chatService.fetchKickAvatar(username)
                    .then(url => { if (url) setAvatarSrc(url); })
                    .catch(() => { /* ignore */ });
            }, 800);

            const empty = Promise.resolve({ data: [], error: null } as any);
            const base: any[] = await Promise.all([
                supabase.from('leaderboard').select('username, score, wins').order('score', { ascending: false }).limit(60),
                supabase.from('users').select('id, kick_username, display_name, avatar').in('kick_username', nameVariants(username)),
                supabase.from('profiles').select('id, username, active_frame_id, daily_streak, last_daily_claim').in('username', nameVariants(username)),
                userId ? supabase.from('user_frames').select('frame_id, is_equipped').eq('user_id', userId) : empty,
                supabase.from('frames').select('id, name, description, rarity, price, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true }),
                userId ? supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(6) : empty,
            ] as any[]);
            const [lb, meRes, profRes, inv, fr, tx] = base;

            /* تحميل المكافأة اليومية من profiles */
            const t = todayISO();
            let claimedToday = false;
            let currentStreak = 0;
            try {
                const k = `icg1_daily_${username}_${t}`;
                if (localStorage.getItem(k) === '1') claimedToday = true;
            } catch {}
            const profRow = (profRes.data || [])[0];
            if (profRow) {
                const streak = Number(profRow.daily_streak) || 0;
                const last = profRow.last_daily_claim ? String(profRow.last_daily_claim).slice(0, 10) : '';
                currentStreak = streak;
                if (last === t) {
                    claimedToday = true;
                } else if (last) {
                    const d = new Date(t + 'T00:00:00');
                    d.setDate(d.getDate() - 1);
                    const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    if (last === y) {
                        currentStreak = streak;
                    } else {
                        currentStreak = 0;
                    }
                } else {
                    currentStreak = 0;
                }
                if (profRow.active_frame_id && isFrameId(profRow.active_frame_id) && !activeFrameId) {
                    setActiveFrameId(profRow.active_frame_id);
                }
            } else {
                try {
                    const k = `icg1_daily_${username}_${t}`;
                    if (localStorage.getItem(k) === '1') claimedToday = true;
                } catch {}
            }
            setDaily({ streak: currentStreak, claimed: claimedToday });

            /* العضوية الممنوحة من اللوحة: استعلام منفصل — أعمدتها تُضاف مع SQL، فغيّرها لا يعطّل بقية التحميل */
            Promise.resolve(
                supabase
                    .from('profiles')
                    .select('membership, membership_expires_at')
                    .in('username', nameVariants(username))
            )
                .then(({ data, error }: any) => {
                    if (error) return;
                    const r = (data || [])[0];
                    if (r) setMembership({ id: r.membership || null, expires: r.membership_expires_at || null });
                })
                .catch(() => { /* قبل تنفيذ SQL تبقى بدون عضوية، وهذا صحيح */ });

            /* 1) الترتيب والنقاط */
            const rows: any[] = lb.data || [];
            const me = rows.find(r => String(r.username || '').toLowerCase() === username);
            if (me) setPoints(Number(me.score) || 0);
            else setPoints(Number(userData.points) || 0);

            /* 2) صورة العضو من جدول users (بديل احتياطي) */
            const meUser = (meRes.data || [])[0];
            if (meUser?.avatar) setAvatarSrc(prev => prev || meUser.avatar);

            /* 3) الملكية */
            if (!inv.error && inv.data) {
                const ids = inv.data.map((r: any) => r.frame_id).filter((id: string) => isFrameId(id));
                setOwnedFrames(Array.from(new Set([...FREE_FRAME_IDS, ...ids])));
                const equipped = inv.data.find((r: any) => r.is_equipped);
                if (equipped?.frame_id && isFrameId(equipped.frame_id)) setActiveFrameId(equipped.frame_id);
            }

            /* 4) كتالوج الإطارات (قاعدة البيانات أولاً ثم الاحتياط المحلي) */
            if (!fr.error && fr.data && fr.data.length) {
                const local = new Map(FRAMES.map(f => [f.id, f]));
                const merged: FrameDef[] = fr.data
                    .filter((r: any) => local.has(r.id))
                    .map((r: any) => ({
                        ...(local.get(r.id) as FrameDef),
                        name: r.name || local.get(r.id)!.name,
                        description: r.description || local.get(r.id)!.description,
                        rarity: rarityOf(r.rarity),
                        price: Number.isFinite(Number(r.price)) ? Number(r.price) : local.get(r.id)!.price,
                        sortOrder: Number(r.sort_order) || local.get(r.id)!.sortOrder,
                    }))
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                if (merged.length) setFrames(merged);
            }

            /* 5) آخر النشاطات */
            setHistory(tx?.data || []);

            /* 6) صور وإطارات كل المتصدرين (users + user_frames) */
            const names = Array.from(new Set(rows.map(r => String(r.username || '')).filter(Boolean)));
            const usersById: Record<string, any> = {};
            const usersByName: Record<string, any> = {};
            if (names.length) {
                const variants = Array.from(new Set(names.flatMap(nameVariants)));
                const ur = await supabase
                    .from('users')
                    .select('id, kick_username, display_name, avatar')
                    .in('kick_username', variants);
                (ur.data || []).forEach((u: any) => {
                    usersById[String(u.id)] = u;
                    usersByName[String(u.kick_username || '').toLowerCase()] = u;
                });
            }
            const equippedByUser: Record<string, string> = {};
            const userIds = Object.keys(usersById);
            if (userIds.length) {
                const uf = await supabase
                    .from('user_frames')
                    .select('user_id, frame_id, is_equipped')
                    .in('user_id', userIds)
                    .eq('is_equipped', true);
                (uf.data || []).forEach((r: any) => {
                    if (isFrameId(r.frame_id)) equippedByUser[String(r.user_id)] = r.frame_id;
                });
            }
            setBoard(rows.map(r => {
                const u = usersByName[String(r.username || '').toLowerCase()] || {};
                return {
                    ...r,
                    avatar_url: u.avatar || r.avatar_url || '',
                    active_frame_id: u.id ? (equippedByUser[String(u.id)] || null) : null,
                };
            }));
        } catch (e) {
            console.warn('[Dashboard] load failed', e);
        } finally {
            setLoading(false);
        }
    }, [username, userId, userData.points]);

    useEffect(() => {
        if (didLoad.current) return;
        didLoad.current = true;
        load();
    }, [load]);

    useEffect(() => {
        try { localStorage.setItem('icg1_dash_prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
    }, [prefs]);

    /* ---------- الحسابات ---------- */
    const tiers = useTiers();
    const RANKS = tiers.ranks;

    const myRank = useMemo(() => {
        const i = board.findIndex(r => String(r.username || '').toLowerCase() === username);
        return i >= 0 ? i + 1 : 0;
    }, [board, username]);

    const rankIdx = rankIndexOf(RANKS, points);
    const nextRank = RANKS[rankIdx + 1];
    const progress = nextRank
        ? Math.min(100, Math.max(2, ((points - RANKS[rankIdx][0]) / Math.max(1, nextRank[0] - RANKS[rankIdx][0])) * 100))
        : 100;

    const activeMembership = useMemo(() => {
        const exp = membership.expires ? new Date(membership.expires).getTime() : 0;
        if (!membership.id || (exp && exp < Date.now())) return null;
        const label = tiers.membershipLabel(membership.id);
        return label ? { id: String(membership.id), label, expires: membership.expires } : null;
    }, [membership, tiers]);

    const ownedList = useMemo(
        () => frames.filter(f => ownedFrames.includes(f.id)),
        [frames, ownedFrames]
    );

    const storeList = useMemo(() => {
        if (filter === 'all') return frames;
        if (filter === 'free') return frames.filter(f => f.price === 0);
        return frames.filter(f => f.rarity === filter);
    }, [frames, filter]);

    const nextReward = DAILY_REWARDS[Math.min(daily.streak, 6) % 7];

    const recoverAvatar = useCallback(() => {
        if (!username) return;
        chatService.fetchKickAvatar(username)
            .then(url => { if (url) setAvatarSrc(url); })
            .catch(() => { /* ignore */ });
    }, [username]);

    /* ---------- الإجراءات ---------- */
    /** السعر بعد خصم العضوية — للعرض فقط، والخصم يُحسب فعلياً داخل القاعدة */
    const priceOf = useCallback(
        (frame: FrameDef) => (vipStore.vip ? Math.max(0, Math.round(frame.price * (100 - vipStore.discount_pct) / 100)) : frame.price),
        [vipStore]
    );

    /** الرصيد مرجعه قاعدة النقاط دائماً — لا يُحسب من حالة المتصفح */
    const refreshPoints = useCallback(async () => {
        const { data } = await supabase.from('leaderboard').select('score').ilike('username', username).limit(1);
        const s = Number((data || [])[0]?.score);
        if (Number.isFinite(s)) setPoints(s);
    }, [username]);

    const reloadHistory = useCallback(async () => {
        if (!userId) return;
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(6);
        setHistory(data || []);
    }, [userId]);

    const doBuy = async (frame: FrameDef) => {
        if (busy) return;
        if (ownedFrames.includes(frame.id)) return;
        const cost = priceOf(frame);
        if (points < cost) return notify(`نقاطك لا تكفي — ينقصك ${fmt(cost - points)} نقطة`, 'bad');
        setBusy(frame.id);
        try {
            if (!(await ensureMember())) return notify('تعذّر فتح جلسة العضو — جرّب بعد قليل', 'bad');
            const r = await memberApi.buyFrame(frame.id);
            if (!r.ok) return notify(r.error || 'تعذّر إتمام الشراء، حاول مرة أخرى', 'bad');
            const left = Number(r.points_left);
            if (Number.isFinite(left)) setPoints(left);
            setOwnedFrames(prev => Array.from(new Set([...prev, frame.id])));
            const discount = Number(r.discount) || 0;
            notify(
                frame.price === 0
                    ? `تم تفعيل ${frame.name} — جهّزه من الخزانة`
                    : discount > 0
                        ? `تم شراء ${frame.name} بـ ${fmt(Number(r.paid) || 0)} بعد خصم ${discount}%`
                        : `تم شراء ${frame.name} — جهّزه من الخزانة`,
                'ok'
            );
            reloadHistory();
        } finally {
            setBusy(null);
        }
    };

    const buy = (frame: FrameDef) => {
        const cost = priceOf(frame);
        setConfirm({
            title: 'تأكيد الشراء',
            body: frame.price === 0
                ? `تفعيل «${frame.name}» المجاني بدون نقاط؟`
                : cost < frame.price
                    ? `شراء «${frame.name}» مقابل ${fmt(cost)} نقطة بعد خصم العضوية (سعره ${fmt(frame.price)})؟`
                    : `شراء «${frame.name}» مقابل ${fmt(cost)} نقطة؟`,
            ok: frame.price === 0 ? 'فعّله الآن' : 'اشترِ الآن',
            onOk: () => doBuy(frame),
        });
    };

    const equip = async (frame: FrameDef) => {
        if (busy) return;
        setBusy(frame.id);
        try {
            if (!(await ensureMember())) return notify('تعذّر فتح جلسة العضو — جرّب بعد قليل', 'bad');
            let r = await memberApi.equipFrame(frame.id);
            // المجاني ملكيته في الواجهة فقط: الشراء بسعر ٠ يمنحه صفاً في القاعدة ثم يُجهَّز
            if (!r.ok && frame.price === 0) {
                const grant = await memberApi.buyFrame(frame.id);
                if (grant.ok || /تمتلك/.test(String(grant.error))) r = await memberApi.equipFrame(frame.id);
            }
            if (!r.ok) return notify(r.error || 'حدث خطأ أثناء تجهيز الإطار', 'bad');
            setOwnedFrames(prev => Array.from(new Set([...prev, frame.id])));
            setActiveFrameId(frame.id);
            notify(`تم تجهيز ${frame.name} — سيظهر في كل الألعاب`, 'ok');
        } finally {
            setBusy(null);
        }
    };

        const claimDaily = async () => {
        const today = todayISO();
        try {
            const k = `icg1_daily_${username}_${today}`;
            if (localStorage.getItem(k) === '1') {
                setDaily(d => ({ ...d, claimed: true }));
                return notify('استلمت مكافأة اليوم — عد غداً', 'bad');
            }
        } catch {}
        if (daily.claimed) return notify('استلمت مكافأة اليوم — عد غداً', 'bad');
        if (busy) return;
        setBusy('daily');
        try {
            const newStreak = Math.min((daily.streak || 0) + 1, 7);
            const reward = DAILY_REWARDS[(newStreak - 1) % 7] || DAILY_REWARDS[0];
            try { await supabase.from('profiles').update({ daily_streak: newStreak, last_daily_claim: today }).in('username', nameVariants(username)); } catch {}
            try { await supabase.from('profiles').update({ daily_streak: newStreak, last_daily_claim: today }).ilike('username', username); } catch {}
            // يُضاف فوق الرصيد الحالي في السيرفر — الكتابة من حالة محلية قديمة كانت تمحو نقاط الألعاب
            try { await leaderboardService.addScore(username, '', reward, false); } catch {}
            const { data: scored } = await supabase.from('leaderboard').select('score').ilike('username', username).limit(1);
            const serverScore = Number(scored?.[0]?.score);
            const newPoints = Number.isFinite(serverScore) && serverScore > 0 ? serverScore : points + reward;
            if (userId) {
                try { await supabase.from('users').update({ points: newPoints }).eq('id', userId); } catch {}
                try { await supabase.from('transactions').insert({ user_id: userId, amount: reward, type: 'DAILY', description: 'مكافأة يومية' }); } catch {}
            }
            try { localStorage.setItem(`icg1_daily_${username}_${today}`, '1'); } catch {}
            setPoints(newPoints);
            setDaily({ streak: newStreak, claimed: true });
            notify(`حصلت على +${reward} نقطة`, 'ok');
        } catch (e) {
            console.error('[Dashboard] claim failed', e);
            notify('تعذّر استلام المكافأة', 'bad');
        } finally {
            setBusy(null);
        }
    };;

    const saveName = async () => {
        const name = nameDraft.trim();
        if (name.length < 2) return notify('الاسم قصير جداً', 'bad');
        setDisplayName(name);
        if (userId) {
            await supabase.from('users').update({ display_name: name }).eq('id', userId);
        }
        notify('تم حفظ التعديلات', 'ok');
    };

    const go = (v: DashView, fromUrl = false) => {
        setView(v);
        if (!fromUrl) {
            try {
                const q = new URLSearchParams(window.location.search);
                q.set('tab', v);
                window.history.pushState({}, '', `${window.location.pathname}?${q.toString()}`);
            } catch { /* رابط غير قابل للتعديل */ }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /* التبويب جزء من العنوان: رجوع المتصفح يبدّل التبويب، ونداء الموقع يفتحه مباشرةً */
    useEffect(() => {
        /* بدون باراميتر التبويب = الرئيسية، حتى يبدّل زر رجوع المتصفح التبويب فعلاً */
        const sync = () => go(readDashTab() || 'home', true);
        const pick = (e: Event) => { const v = (e as CustomEvent).detail as DashView; if (TABS.includes(v)) go(v, true); };
        window.addEventListener('popstate', sync);
        window.addEventListener('hashchange', sync);
        window.addEventListener('icg:dashtab', pick as EventListener);
        return () => {
            window.removeEventListener('popstate', sync);
            window.removeEventListener('hashchange', sync);
            window.removeEventListener('icg:dashtab', pick as EventListener);
        };
    }, []);

    /* ---------- البلاغات والدعم والبطولات ---------- */
    const setSupBusy = (k: string) => setSupport(s => ({ ...s, busy: k }));

    const failNote = (r: { ok: boolean; error?: string }, fallback: string) => {
        notify(r.error && r.error !== 'سجّل دخولك أولاً' ? r.error : fallback, 'bad');
    };

    const sendReport = async () => {
        const target = reportDraft.target.trim().toLowerCase();
        if (!target) return notify('اكتب اسم المخالف', 'bad');
        if (reportDraft.reason.trim().length < 5) return notify('اشرح البلاغ في سطر على الأقل', 'bad');
        setSupBusy('report');
        try {
            if (!(await ensureMember())) return notify('تعذّر إرسال البلاغ الآن — أعد المحاولة', 'bad');
            const r = await memberApi.submitReport({ kind: reportDraft.kind, target_username: target, reason: reportDraft.reason });
            if (!r.ok) return failNote(r, 'تعذّر إرسال البلاغ');
            setReportDraft(d => ({ ...d, target: '', reason: '' }));
            notify('وصل بلاغك — تحت المراجعة', 'ok');
            const list = await memberApi.reports();
            if (list.ok) { setReports(list.reports || []); setSanctions(list.sanctions || []); }
        } finally { setSupBusy(''); }
    };

    const sendTicket = async () => {
        if (ticketDraft.subject.trim().length < 4) return notify('اكتب موضوعاً واضحاً', 'bad');
        if (ticketDraft.body.trim().length < 10) return notify('اشرح التفاصيل (١٠ أحرف على الأقل)', 'bad');
        setSupBusy('ticket');
        try {
            if (!(await ensureMember())) return notify('تعذّر فتح التذكرة الآن — أعد المحاولة', 'bad');
            const r = await memberApi.openTicket(ticketDraft);
            if (!r.ok) return failNote(r, 'تعذّر فتح التذكرة');
            setTicketDraft({ subject: '', category: TICKET_CATS[0], priority: TICKET_PRIS[1], body: '' });
            notify('تم فتح تذكرة الدعم — تجد ردّها هنا', 'ok');
            const list = await memberApi.tickets();
            if (list.ok) setTickets(list.tickets || []);
        } finally { setSupBusy(''); }
    };

    const sendAppeal = async () => {
        if (!appealDraft.sanctionId) return notify('اختر العقوبة التي تعترض عليها', 'bad');
        if (appealDraft.reason.trim().length < 5) return notify('اكتب سبب الاعتراض', 'bad');
        setSupBusy('appeal');
        try {
            if (!(await ensureMember())) return notify('تعذّر إرسال الاعتراض الآن — أعد المحاولة', 'bad');
            const r = await memberApi.submitAppeal({ sanction_id: appealDraft.sanctionId, reason: appealDraft.reason });
            if (!r.ok) return failNote(r, 'تعذّر إرسال الاعتراض');
            setAppealDraft({ sanctionId: '', reason: '' });
            notify('تم إرسال اعتراضك', 'ok');
            const list = await memberApi.reports();
            if (list.ok) setReports(list.reports || []);
        } finally { setSupBusy(''); }
    };

    const usePromo = async () => {
        const code = promoDraft.trim().toUpperCase();
        if (code.length < 3) return notify('اكتب الكود كاملاً', 'bad');
        setSupBusy('promo');
        try {
            if (!(await ensureMember())) return notify('تعذّر استخدام الكود الآن — أعد المحاولة', 'bad');
            const r = await memberApi.redeemPromo(code);
            if (!r.ok) return failNote(r, 'تعذّر استخدام الكود');
            setPromoDraft('');
            notify(`أُضيف ${fmt(Number(r.amount) || 0)} نقطة لرصيدك`, 'ok');
            refreshPoints();
            const his = await memberApi.promoHistory();
            if (his.ok) setRedemptions(his.redemptions || []);
        } finally { setSupBusy(''); }
    };

    const toggleBell = async () => {
        const next = !bellOpen;
        setBellOpen(next);
        if (!next) return;
        if (!(await ensureMember())) return;
        const r = await memberApi.notifications();
        if (r.ok) { setNotifs(r.notifications || []); setUnread(Number(r.unread) || 0); }
    };

    const markRead = async (id: string, already: boolean) => {
        if (already) return;
        setNotifs(prev => prev.map(n => (String(n.id) === id ? { ...n, read: true } : n)));
        setUnread(u => Math.max(0, u - 1));
        const r = await memberApi.readNotification(id);
        if (!r.ok) setNotifs(prev => prev.map(n => (String(n.id) === id ? { ...n, read: false } : n)));
    };

    const markAllRead = async () => {
        setNotifs(prev => prev.map(n => ({ ...n, read: true })));
        setUnread(0);
        await memberApi.readAllNotifications();
    };

    const dismissAnno = async (id: string) => {
        setAnnos(prev => prev.filter(a => String(a.id) !== id));
        await memberApi.dismissAnnouncement(id);
    };

    const toggleTour = async (t: MemberTournament) => {
        setSupBusy(`tour-${t.id}`);
        try {
            if (!(await ensureMember())) return notify('تعذّر التسجيل الآن — أعد المحاولة', 'bad');
            const r = t.mine ? await memberApi.leaveTournament(t.id) : await memberApi.joinTournament(t.id);
            if (!r.ok) return failNote(r, t.mine ? 'تعذّر الانسحاب' : 'تعذّر التسجيل');
            notify(t.mine ? 'تم الانسحاب من البطولة' : `تم تسجيلك في ${t.name}`, 'ok');
            const list = await memberApi.tournaments();
            if (list.ok) setTours(list.tournaments || []);
        } finally { setSupBusy(''); }
    };

    /* ---------- المحتوى ---------- */
    const HomeView = () => {
        const top3 = board.slice(0, 3);
        const myFrame = activeFrameId;
        const achievements = [
            { t: 'أول عملية شراء', icon: ShoppingBag, ok: history.some(h => h.type === 'PURCHASE') || ownedList.length > 3 },
            { t: '1,000 نقطة', icon: Gem, ok: points >= 1000 },
            { t: 'نخبة المتصدرين', icon: Trophy, ok: myRank > 0 && myRank <= 5 },
            { t: 'ملك الإطارات', icon: Crown, ok: ownedList.some(f => f.rarity === 'l') },
            { t: '7 إطارات', icon: Star, ok: ownedList.length >= 7 },
            { t: 'عضو منذ البداية', icon: Shield, ok: true },
        ];

        return (
            <div className="md-pg">
                <section className="md-card md-hero md-s8" style={{ ['--i' as any]: 0 }}>
                    <MemberAvatar name={displayName} kickName={username} src={avatarSrc} frameId={myFrame} boxClass="md-avbox-lg" />
                    <div className="md-hero-tx">
                        <div className="md-eyb">MEMBER DASHBOARD</div>
                        <h1 className="md-ttl">أهلاً بك، {displayName}</h1>
                        <div className="md-rk">
                            {activeMembership
                                ? <><Crown size={14} /> {activeMembership.label}{activeMembership.expires ? ` · حتى ${new Date(activeMembership.expires).toLocaleDateString('en-GB')}` : ''}</>
                                : <><Medal size={14} /> الرتبة: {RANKS[rankIdx][1]}</>}
                        </div>
                        <div className="md-xp"><i style={{ width: `${progress}%` }} /></div>
                        <div className="md-xpl">
                            <span>{fmt(points)} نقطة</span>
                            <span>{nextRank ? `الرتبة القادمة: ${nextRank[1]} (${fmt(nextRank[0])})` : 'أعلى رتبة'}</span>
                        </div>
                        <div className="md-acts">
                            <button className="md-btn md-gold" onClick={() => go('store')}><ShoppingBag size={17} /> تصفّح المتجر</button>
                            <button className="md-btn md-ghost" onClick={() => go('rank')}><Trophy size={17} /> لوحة الصدارة</button>
                        </div>
                    </div>
                </section>

                {annos.length > 0 && (
                    <section className="md-card md-anno md-s12" style={{ ['--i' as any]: 1 }}>
                        <h2><Megaphone size={18} /> إعلانات الموقع</h2>
                        <div className="md-lst">
                            {annos.map(a => (
                                <div className="md-row" key={a.id}>
                                    <div className="md-ico"><Megaphone size={17} /></div>
                                    <div className="md-row-tx">
                                        <b>{a.title}</b>
                                        <small>{a.body}</small>
                                    </div>
                                    <span className="md-st open">{a.kind}</span>
                                    <button className="md-btn md-ghost md-xs" onClick={() => dismissAnno(a.id)}>
                                        <Check size={15} /> فهمت
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="md-card md-s4" style={{ ['--i' as any]: 2 }}>
                    <h2><Target size={18} /> دخول الألعاب المباشرة</h2>
                    <div className="md-lst">
                        <div className="md-row">
                            <div className="md-ico"><Target size={17} /></div>
                            <div className="md-row-tx">
                                <b>كود نيمز</b>
                                <small>{live.cn ? `أنت ليدر في الغرفة ${live.cn}` : live.checking ? 'جارٍ التحقق…' : 'ما لك غرفة كود نيمز نشطة'}</small>
                            </div>
                            <button className="md-btn md-gold" onClick={() => enterLive('cn')} disabled={live.checking}>دخول</button>
                        </div>
                        <div className="md-row">
                            <div className="md-ico"><Shield size={17} /></div>
                            <div className="md-row-tx">
                                <b>المافيا</b>
                                <small>{live.mafia ? `الغرفة النشطة ${live.mafia}` : live.checking ? 'جارٍ التحقق…' : 'لا توجد غرفة مافيا نشطة'}</small>
                            </div>
                            <button className="md-btn md-gold" onClick={() => enterLive('mafia')} disabled={live.checking}>دخول</button>
                        </div>
                    </div>
                </section>

                <section className="md-card md-s4" style={{ ['--i' as any]: 1 }}>
                    <h2><Gift size={18} /> المكافأة اليومية</h2>
                    <div className="md-days">
                        {DAILY_REWARDS.map((v, i) => (
                            <div
                                key={i}
                                className={`md-day ${i < daily.streak ? 'done' : i === daily.streak && !daily.claimed ? 'now' : ''} ${i === 6 ? 'big' : ''}`}
                            >
                                {i < daily.streak ? <Check size={14} /> : v}
                            </div>
                        ))}
                    </div>
                    <button
                        className="md-btn md-gold w-full"
                        style={{ width: '100%' }}
                        onClick={claimDaily}
                        disabled={daily.claimed || busy === 'daily'}
                    >
                        {busy === 'daily'
                            ? <Loader2 size={17} className="animate-spin" />
                            : daily.claimed ? 'تم الاستلام — عد غداً' : `استلم +${nextReward} نقطة`}
                    </button>
                </section>

                <section className="md-card md-s4" style={{ ['--i' as any]: 3 }}>
                    <h2><Trophy size={18} /> البطولات</h2>
                    <div className="md-lst">
                        {tours.length === 0 ? (
                            <div className="md-row">
                                <div className="md-ico"><Trophy size={17} /></div>
                                <div className="md-row-tx"><b>لا توجد بطولات الآن</b><small>أول ما تُفتح بطولة توصل هنا تلقائياً</small></div>
                            </div>
                        ) : tours.map(t => (
                            <div className="md-row" key={t.id}>
                                <div className="md-ico"><Trophy size={17} /></div>
                                <div className="md-row-tx">
                                    <b>{t.name}</b>
                                    <small>{t.game || 'بطولة عامة'} · {shortDate(t.starts_at)}</small>
                                    <small>الجائزة {fmt(t.prize)} نقطة · {t.max > 0 ? `${fmt(t.registered)}/${fmt(t.max)}` : `${fmt(t.registered)} مسجّل`}</small>
                                    {t.note ? <small className="md-res">{t.note}</small> : null}
                                </div>
                                <span className={`md-st ${pillClass(t.status)}`}>{tourLabel(t)}</span>
                                <button
                                    className={`md-btn md-xs ${t.mine ? 'md-ghost' : 'md-gold'}`}
                                    onClick={() => toggleTour(t)}
                                    disabled={support.busy === `tour-${t.id}` || (t.mine ? false : t.status !== 'open')}
                                >
                                    {support.busy === `tour-${t.id}`
                                        ? <Loader2 size={15} className="animate-spin" />
                                        : t.mine ? 'انسحاب' : 'سجّل'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="md-card md-stat md-s4" style={{ ['--i' as any]: 2 }}>
                    <div className="md-top">
                        <div className="md-ico"><Wallet size={22} /></div>
                        <div><span className="md-mut">إجمالي النقاط</span><br /><b>{fmt(points)}</b></div>
                    </div>
                    <Spark seed={points % 7 + 2} />
                    <span className="md-up"><Zap size={12} /> رصيدك الحالي</span>
                </div>

                <div className="md-card md-stat md-s4" style={{ ['--i' as any]: 3 }}>
                    <div className="md-top">
                        <div className="md-ico"><Trophy size={22} /></div>
                        <div><span className="md-mut">المرتبة الحالية</span><br /><b>{myRank ? `#${myRank}` : '—'}</b></div>
                    </div>
                    <Spark seed={5} />
                    <span className="md-up"><Crown size={12} /> بين {fmt(board.length)} عضواً</span>
                </div>

                <div className="md-card md-stat md-s4" style={{ ['--i' as any]: 4 }}>
                    <div className="md-top">
                        <div className="md-ico"><Box size={22} /></div>
                        <div><span className="md-mut">إطاراتك</span><br /><b>{ownedList.length}</b></div>
                    </div>
                    <Spark seed={9} />
                    <span className="md-up"><Gem size={12} /> من أصل {frames.length} إطاراً</span>
                </div>

                <section className="md-card md-s8" style={{ ['--i' as any]: 5 }}>
                    <h2><Zap size={18} /> آخر النشاطات</h2>
                    <div className="md-lst">
                        {history.length === 0 ? (
                            <div className="md-row"><div className="md-ico"><Clock size={17} /></div><div className="md-row-tx"><b>لا يوجد نشاط بعد</b><small>ستظهر مشترياتك ومكافآتك هنا</small></div></div>
                        ) : history.map((h, i) => {
                            const amount = Number(h.amount) || 0;
                            return (
                                <div className="md-row" key={h.id || i}>
                                    <div className="md-ico">{amount < 0 ? <ShoppingBag size={17} /> : <Gift size={17} />}</div>
                                    <div className="md-row-tx">
                                        <b>{h.description || (amount < 0 ? 'عملية شراء' : 'مكافأة')}</b>
                                        <small>{h.type === 'PURCHASE' ? 'مشتريات' : h.type || 'نشاط'}</small>
                                    </div>
                                    <em className={amount < 0 ? 'md-neg' : 'md-pos'}>{amount > 0 ? `+${fmt(amount)}` : fmt(amount)}</em>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="md-card md-s5" style={{ ['--i' as any]: 6 }}>
                    <h2><Crown size={18} /> أفضل 3 الآن</h2>
                    <div className="md-lst">
                        {top3.length === 0 ? (
                            <div className="md-row"><div className="md-row-tx"><b>لا يوجد متصدرون بعد</b><small>كن أول من يجمع النقاط</small></div></div>
                        ) : top3.map((u, i) => (
                            <div className="md-row md-top3" key={u.username || i}>
                                <span className={`md-medal m${i + 1}`}>{i + 1}</span>
                                <MemberAvatar
                                    name={u.username}
                                    kickName={u.username}
                                    src={u.avatar_url}
                                    frameId={u.active_frame_id}
                                    boxClass="md-avbox-sm"
                                />
                                <div className="md-row-tx">
                                    <b>{u.username}{i === 0 ? <Crown size={13} className="md-crown" /> : null}</b>
                                    <small>{fmt(u.score)} نقطة</small>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="md-btn md-ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => go('rank')}>عرض الكل</button>
                </section>

                <section className="md-card md-s7" style={{ ['--i' as any]: 7 }}>
                    <h2><Medal size={18} /> الإنجازات</h2>
                    <div className="md-ach">
                        {achievements.map((a, i) => {
                            const Icon = a.icon;
                            return (
                                <div className={`md-bd ${a.ok ? '' : 'lk'}`} key={i}>
                                    <div className="md-ico"><Icon size={18} /></div>
                                    <b>{a.t}</b>
                                    <small>{a.ok ? 'مفتوح' : 'مقفل'}</small>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        );
    };

    const StoreView = () => (
        <div className="md-pg">
            <div className="md-head">
                <div>
                    <h1 className="md-ttl">المتجر الحصري</h1>
                    <div className="md-eyb">PREMIUM FRAMES & ITEMS</div>
                </div>
                <div className="md-bal">
                    <div className="md-ico"><Gem size={22} /></div>
                    <div><small>رصيدك الحالي</small><b>{fmt(points)}</b></div>
                </div>
            </div>

            <div className="md-flt">
                {([['all', 'الكل'], ['free', 'مجاني'], ['r', 'نادر'], ['e', 'ملحمي'], ['l', 'أسطوري']] as [Filter, string][]).map(([k, label]) => (
                    <button key={k} className={`md-fc ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
                ))}
            </div>

            {vipStore.vip && vipStore.discount_pct > 0 && (
                <div className="md-vip">
                    <Crown size={16} /> خصم العضوية {vipStore.discount_pct}% يُحسب تلقائياً عند الدفع — الأسعار المعروضة بعد الخصم
                </div>
            )}

            <div className="md-grid">
                {storeList.map((f, i) => {
                    const owned = ownedFrames.includes(f.id);
                    const equipped = activeFrameId === f.id;
                    const rar = RARITY[f.rarity];
                    const cost = priceOf(f);
                    const canAfford = points >= cost;
                    return (
                        <div className="md-card md-it" key={f.id} style={{ ['--rc' as any]: rar.color, ['--i' as any]: i }}>
                            <span className="md-rar">{rar.label}</span>
                            <div className="md-avbox md-avbox-md">
                                <FrameArt frameId={f.id} src={avatarSrc} initial={displayName} title={f.name} onAvatarError={recoverAvatar} />
                            </div>
                            <h3>{f.name}</h3>
                            <p>{f.description}</p>
                            {equipped ? (
                                <button className="md-buy eq"><Check size={16} /> مجهّز</button>
                            ) : owned ? (
                                <button className="md-buy own" onClick={() => equip(f)} disabled={busy === f.id}>
                                    {busy === f.id ? <Loader2 size={16} className="animate-spin" /> : <><User size={16} /> تجهيز</>}
                                </button>
                            ) : (
                                <button
                                    className={`md-buy ${canAfford ? '' : 'dim'}`}
                                    onClick={() => buy(f)}
                                    disabled={!canAfford || busy === f.id}
                                >
                                    {busy === f.id
                                        ? <Loader2 size={16} className="animate-spin" />
                                        : <>
                                            {canAfford ? <ShoppingCart size={16} /> : <Lock size={16} />}
                                            {f.price === 0 ? 'مجاني' : `${fmt(cost)} نقطة`}
                                            {vipStore.vip && cost < f.price && <s>{fmt(f.price)}</s>}
                                        </>}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const LockerView = () => (
        <div className="md-pg">
            <div className="md-head">
                <div>
                    <h1 className="md-ttl">الخزانة الخاصة</h1>
                    <div className="md-eyb">MY COLLECTION / INVENTORY</div>
                </div>
                <div className="md-bal">
                    <div className="md-ico"><Box size={22} /></div>
                    <div><small>مجموعتك</small><b>{ownedList.length}/{frames.length}</b></div>
                </div>
            </div>

            {ownedList.length === 0 ? (
                <div className="md-empty">
                    <div className="md-ico"><Box size={32} /></div>
                    <h2>خزانتك فارغة</h2>
                    <p className="md-mut" style={{ margin: '6px 0 16px' }}>توجه إلى المتجر للحصول على الإطارات الحصرية.</p>
                    <button className="md-btn md-gold" onClick={() => go('store')}><ShoppingBag size={17} /> إلى المتجر</button>
                </div>
            ) : (
                <div className="md-grid">
                    {ownedList.map((f, i) => {
                        const equipped = activeFrameId === f.id;
                        const rar = RARITY[f.rarity];
                        return (
                            <div className="md-card md-it" key={f.id} style={{ ['--rc' as any]: rar.color, ['--i' as any]: i }}>
                                <span className="md-rar">{rar.label}</span>
                                <div className="md-avbox md-avbox-md">
                                    <FrameArt frameId={f.id} src={avatarSrc} initial={displayName} title={f.name} onAvatarError={recoverAvatar} />
                                </div>
                                <h3>{f.name}</h3>
                                <p>{f.description}</p>
                                {equipped ? (
                                    <button className="md-buy eq"><Check size={16} /> مجهّز</button>
                                ) : (
                                    <button className="md-buy own" onClick={() => equip(f)} disabled={busy === f.id}>
                                        {busy === f.id ? <Loader2 size={16} className="animate-spin" /> : <><User size={16} /> تجهيز</>}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const RankView = () => {
        const podium = [board[1], board[0], board[2]];
        const max = Number(board[0]?.score) || 1;
        return (
            <div className="md-pg">
                <div className="md-head">
                    <div>
                        <h1 className="md-ttl">لوحة الصدارة</h1>
                        <div className="md-eyb">GLOBAL MEMBER RANKINGS</div>
                    </div>
                    <div className="md-bal">
                        <div className="md-ico"><Trophy size={22} /></div>
                        <div><small>مرتبتك</small><b>{myRank ? `#${myRank}` : '—'}</b></div>
                    </div>
                </div>

                {loading ? (
                    <div className="md-card md-s12" style={{ textAlign: 'center', padding: 40 }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--g1)', margin: '0 auto' }} />
                    </div>
                ) : board.length === 0 ? (
                    <div className="md-empty">
                        <div className="md-ico"><Trophy size={32} /></div>
                        <h2>لا توجد نتائج بعد</h2>
                        <p className="md-mut">العب أول لعبة لتظهر في الصدارة.</p>
                    </div>
                ) : (
                    <>
                        <div className={`md-pod md-pod-${Math.min(board.length, 3)}`}>
                            {podium.map((u, i) => {
                                if (!u) return <div key={i} />;
                                const n = [2, 1, 3][i];
                                return (
                                    <div className={`md-pd p${n}`} key={u.username || i} style={{ ['--i' as any]: n }}>
                                        {n === 1 && <div className="md-cr"><Crown size={30} /></div>}
                                        <span className="md-n">{n}</span>
                                        <MemberAvatar
                                            name={u.username}
                                            kickName={u.username}
                                            src={u.avatar_url}
                                            frameId={u.active_frame_id}
                                            boxClass="md-pod-av"
                                        />
                                        <b>{u.username}</b>
                                        <em>{fmt(u.score)}</em>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="md-rl">
                            {board.slice(3).map((u, i) => {
                                const isMe = String(u.username || '').toLowerCase() === username;
                                return (
                                    <div className={`md-rr ${isMe ? 'me' : ''}`} key={u.username || i} style={{ animation: 'md-up .5s var(--ease) both', animationDelay: `${i * 35}ms` }}>
                                        <span className="md-no">{i + 4}</span>
                                        <MemberAvatar name={u.username} kickName={u.username} src={u.avatar_url} frameId={u.active_frame_id} boxClass="md-avbox-sm" />
                                        <b>{u.username}{isMe ? ' (أنت)' : ''}</b>
                                        <div className="md-pw"><i style={{ width: `${Math.max(3, (Number(u.score) / max) * 100)}%` }} /></div>
                                        <em>{fmt(u.score)}</em>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        );
    };

    const SUP_TABS: { id: 'report' | 'ticket' | 'sanction' | 'promo'; label: string; icon: React.ElementType }[] = [
        { id: 'report', label: 'بلاغ', icon: Flag },
        { id: 'ticket', label: 'تذاكر الدعم', icon: LifeBuoy },
        { id: 'sanction', label: 'عقوباتي', icon: ShieldAlert },
        { id: 'promo', label: 'كود ترويجي', icon: Gift },
    ];

    const SupportPanel = () => (
        <section className="md-card md-s12" style={{ ['--i' as any]: 3 }}>
            <h2><LifeBuoy size={18} /> البلاغات والدعم</h2>
            <div className="md-sub">
                {SUP_TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id} className={support.tab === t.id ? 'on' : ''} onClick={() => setSupport(s => ({ ...s, tab: t.id }))}>
                            <Icon size={15} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {support.tab === 'report' && (
                <div className="md-pane">
                    <div className="md-form">
                        <label className="md-fld">
                            <span>نوع البلاغ</span>
                            <div className="md-inp">
                                <Flag size={18} />
                                <select value={reportDraft.kind} onChange={e => setReportDraft(d => ({ ...d, kind: e.target.value }))}>
                                    {REPORT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                        </label>
                        <label className="md-fld">
                            <span>اسم الحساب المخالف</span>
                            <div className="md-inp">
                                <User size={18} />
                                <input
                                    value={reportDraft.target}
                                    maxLength={40}
                                    dir="ltr"
                                    placeholder="kick username"
                                    onChange={e => setReportDraft(d => ({ ...d, target: e.target.value }))}
                                />
                            </div>
                        </label>
                    </div>
                    <label className="md-fld">
                        <span>التفاصيل</span>
                        <textarea
                            className="md-txa"
                            rows={3}
                            maxLength={600}
                            placeholder="وش صار، وفين، وبأي لعبة؟"
                            value={reportDraft.reason}
                            onChange={e => setReportDraft(d => ({ ...d, reason: e.target.value }))}
                        />
                    </label>
                    <button className="md-btn md-gold" onClick={sendReport} disabled={support.busy === 'report'}>
                        {support.busy === 'report' ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} إرسال البلاغ
                    </button>

                    <div className="md-lst md-mt">
                        {reports.filter(r => r.record_type !== 'appeal').length === 0 ? (
                            <div className="md-row"><div className="md-ico"><Flag size={17} /></div><div className="md-row-tx"><b>ما لك بلاغات سابقة</b><small>كل بلاغ يُرسل مرة واحدة للفريق المعني</small></div></div>
                        ) : reports.filter(r => r.record_type !== 'appeal').map((r, i) => (
                            <div className="md-row" key={r.id || i}>
                                <div className="md-ico"><Flag size={17} /></div>
                                <div className="md-row-tx">
                                    <b>{r.kind} — {r.target_username}</b>
                                    <small>{r.reason}</small>
                                    {r.resolution ? <small className="md-res">النتيجة: {r.resolution}</small> : null}
                                </div>
                                <span className={`md-st ${pillClass(r.status)}`}>{r.status_ar}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {support.tab === 'ticket' && (
                <div className="md-pane">
                    <div className="md-form">
                        <label className="md-fld" style={{ flex: 2, minWidth: 220 }}>
                            <span>الموضوع</span>
                            <div className="md-inp">
                                <LifeBuoy size={18} />
                                <input
                                    value={ticketDraft.subject}
                                    maxLength={120}
                                    placeholder="مثال: نقاطي ما ظهرت بعد لعبة كود نيمز"
                                    onChange={e => setTicketDraft(d => ({ ...d, subject: e.target.value }))}
                                />
                            </div>
                        </label>
                        <label className="md-fld">
                            <span>التصنيف</span>
                            <div className="md-inp">
                                <Tag size={18} />
                                <select value={ticketDraft.category} onChange={e => setTicketDraft(d => ({ ...d, category: e.target.value }))}>
                                    {TICKET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </label>
                        <label className="md-fld">
                            <span>الأولوية</span>
                            <div className="md-inp">
                                <Zap size={18} />
                                <select value={ticketDraft.priority} onChange={e => setTicketDraft(d => ({ ...d, priority: e.target.value }))}>
                                    {TICKET_PRIS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </label>
                    </div>
                    <label className="md-fld">
                        <span>التفاصيل</span>
                        <textarea
                            className="md-txa"
                            rows={3}
                            maxLength={1500}
                            placeholder="اشرح المشكلة بالتفصيل مع اللقطة والوقت"
                            value={ticketDraft.body}
                            onChange={e => setTicketDraft(d => ({ ...d, body: e.target.value }))}
                        />
                    </label>
                    <button className="md-btn md-gold" onClick={sendTicket} disabled={support.busy === 'ticket'}>
                        {support.busy === 'ticket' ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} فتح تذكرة
                    </button>

                    <div className="md-lst md-mt">
                        {tickets.length === 0 ? (
                            <div className="md-row"><div className="md-ico"><LifeBuoy size={17} /></div><div className="md-row-tx"><b>لا توجد تذاكر</b><small>الرد يظهر هنا داخل التذكرة نفسها</small></div></div>
                        ) : tickets.map((t, i) => (
                            <div className="md-row" key={t.id || i}>
                                <div className="md-ico"><LifeBuoy size={17} /></div>
                                <div className="md-row-tx">
                                    <b>{t.subject}</b>
                                    <small>{t.category} · {shortDate(t.created_at)}</small>
                                    {t.reply ? <small className="md-res">رد الدعم: {t.reply}</small> : null}
                                </div>
                                <span className={`md-st ${pillClass(t.status)}`}>{t.status_ar}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {support.tab === 'sanction' && (
                <div className="md-pane">
                    {sanctions.length === 0 ? (
                        <div className="md-sess"><i /> سجلّك نظيف — لا توجد عقوبات نشطة على حسابك</div>
                    ) : (
                        <div className="md-lst">
                            {sanctions.map((s, i) => (
                                <div className="md-row" key={s.id || i}>
                                    <div className="md-ico"><TriangleAlert size={17} /></div>
                                    <div className="md-row-tx">
                                        <b>{s.type || 'حظر'}</b>
                                        <small>{s.reason || 'بدون سبب مذكور'} · {shortDate(s.created_at)}{s.ends_at ? ` · ينتهي ${shortDate(s.ends_at)}` : ''}</small>
                                    </div>
                                    <button
                                        className="md-btn md-ghost"
                                        style={{ height: 38, padding: '0 14px' }}
                                        onClick={() => setAppealDraft(a => ({ ...a, sanctionId: s.id }))}
                                    >
                                        <Gavel size={15} /> اعتراض
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="md-form md-mt">
                        <label className="md-fld">
                            <span>العقوبة المعترض عليها</span>
                            <div className="md-inp">
                                <Gavel size={18} />
                                <select
                                    value={appealDraft.sanctionId}
                                    onChange={e => setAppealDraft(a => ({ ...a, sanctionId: e.target.value }))}
                                >
                                    <option value="">اختر عقوبة…</option>
                                    {sanctions.map(s => <option key={s.id} value={s.id}>{s.type || 'حظر'} — {shortDate(s.created_at)}</option>)}
                                </select>
                            </div>
                        </label>
                        <label className="md-fld" style={{ flex: 2, minWidth: 240 }}>
                            <span>سبب الاعتراض</span>
                            <div className="md-inp">
                                <Send size={18} />
                                <input
                                    value={appealDraft.reason}
                                    maxLength={600}
                                    placeholder="ليش ترى العقوبة غير مناسبة؟"
                                    onChange={e => setAppealDraft(a => ({ ...a, reason: e.target.value }))}
                                />
                            </div>
                        </label>
                        <button className="md-btn md-gold" onClick={sendAppeal} disabled={support.busy === 'appeal'} style={{ alignSelf: 'flex-end' }}>
                            {support.busy === 'appeal' ? <Loader2 size={17} className="animate-spin" /> : <Gavel size={17} />} إرسال الاعتراض
                        </button>
                    </div>

                    {reports.some(r => r.record_type === 'appeal') && (
                        <div className="md-lst md-mt">
                            {reports.filter(r => r.record_type === 'appeal').map((r, i) => (
                                <div className="md-row" key={r.id || i}>
                                    <div className="md-ico"><Gavel size={17} /></div>
                                    <div className="md-row-tx">
                                        <b>اعتراض {shortDate(r.created_at)}</b>
                                        <small>{r.reason}</small>
                                        {r.resolution ? <small className="md-res">النتيجة: {r.resolution}</small> : null}
                                    </div>
                                    <span className={`md-st ${pillClass(r.status)}`}>{r.status_ar}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {support.tab === 'promo' && (
                <div className="md-pane">
                    <div className="md-form">
                        <label className="md-fld" style={{ flex: 2, minWidth: 240 }}>
                            <span>الكود الترويجي</span>
                            <div className="md-inp">
                                <Gift size={18} />
                                <input
                                    value={promoDraft}
                                    maxLength={40}
                                    dir="ltr"
                                    placeholder="ICG1-XXXX"
                                    onChange={e => setPromoDraft(e.target.value.toUpperCase())}
                                />
                            </div>
                        </label>
                        <button className="md-btn md-gold" onClick={usePromo} disabled={support.busy === 'promo'} style={{ alignSelf: 'flex-end' }}>
                            {support.busy === 'promo' ? <Loader2 size={17} className="animate-spin" /> : <Zap size={17} />} استخدم الكود
                        </button>
                    </div>
                    <p className="md-mut">الكود يُضاف مرة واحدة لكل عضو، والنقاط توصل لرصيدك مباشرة.</p>

                    <div className="md-lst md-mt">
                        {redemptions.length === 0 ? (
                            <div className="md-row"><div className="md-ico"><Gift size={17} /></div><div className="md-row-tx"><b>ما استلمت أكواد</b><small>ستظهر أكوادك المستخدمة هنا</small></div></div>
                        ) : redemptions.map((p, i) => (
                            <div className="md-row" key={`${p.promo_id}-${i}`}>
                                <div className="md-ico"><Gift size={17} /></div>
                                <div className="md-row-tx">
                                    <b>كود مُستخدم</b>
                                    <small>{p.via || 'site'} · {shortDate(p.redeemed_at)}</small>
                                </div>
                                <em className="md-pos">+{fmt(Number(p.amount) || 0)}</em>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );

    const SettingsView = () => (
        <div className="md-pg">
            <div className="md-head">
                <div>
                    <h1 className="md-ttl">إعدادات الحساب</h1>
                    <div className="md-eyb">PROFILE & SECURITY SETTINGS</div>
                </div>
            </div>

            {isAdmin && (
                <div className="md-card md-s12" style={{ ['--i' as any]: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="md-ico"><ShieldAlert size={20} /></div>
                    <div style={{ flex: 1 }}>
                        <b style={{ fontSize: 14 }}>أنت مسجّل أيضاً كمدير</b>
                        <div className="md-mut">يمكنك الرجوع إلى لوحة الإدارة في أي وقت.</div>
                    </div>
                    <button
                        className="md-btn md-ghost"
                        onClick={() => { window.location.href = '/admin-panel'; }}
                    >
                        الرجوع للإدارة
                    </button>
                </div>
            )}

            <section className="md-card md-s7" style={{ ['--i' as any]: 1 }}>
                <h2><User size={18} /> المعلومات الشخصية</h2>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18 }}>
                    <MemberAvatar name={displayName} kickName={username} src={avatarSrc} frameId={activeFrameId} boxClass="md-avbox-md" />
                    <div>
                        <b style={{ fontSize: 19 }}>{displayName}</b>
                        <div className="md-mut">إطارك المجهّز يظهر في كل الألعاب والصدارة.</div>
                    </div>
                </div>
                <label className="md-fld">
                    <span>الاسم المعروض</span>
                    <div className="md-inp">
                        <User size={18} />
                        <input value={nameDraft} maxLength={16} onChange={e => setNameDraft(e.target.value)} />
                    </div>
                </label>
                <label className="md-fld">
                    <span>حساب Kick (لا يمكن تغييره)</span>
                    <div className="md-inp lkd">
                        <Lock size={18} />
                        <input value={username} disabled dir="ltr" />
                    </div>
                </label>
                <button className="md-btn md-gold" style={{ width: '100%' }} onClick={saveName}>
                    <Save size={17} /> حفظ التعديلات
                </button>
            </section>

            <section className="md-card md-s5" style={{ ['--i' as any]: 2 }}>
                <h2><Shield size={18} /> الأمان والمصادقة</h2>
                <div className="md-sess"><i /> ACTIVE SESSION — جلسة نشطة</div>
                <p className="md-mut" style={{ marginBottom: 14 }}>
                    حسابك محمي بنظام iCG1 للمصادقة المتقدمة. تم ربط جهازك بنجاح.
                </p>
                <div className="md-acts" style={{ margin: 0 }}>
                    <button className="md-btn md-ghost" style={{ flex: 1 }} onClick={() => onLogout?.()}>
                        <LogOut size={17} /> تسجيل خروج
                    </button>
                </div>
            </section>

            {SupportPanel()}

            <section className="md-card md-s12" style={{ ['--i' as any]: 4 }}>
                <h2><Settings size={18} /> التفضيلات</h2>
                <div className="md-tg">
                    <div className="md-ico"><Volume2 size={18} /></div>
                    <div className="md-tg-tx"><b>المؤثرات الصوتية</b><small>أصوات عند الشراء والمكافآت</small></div>
                    <button
                        className={`md-sw ${prefs.sound ? 'on' : ''}`}
                        aria-label="المؤثرات الصوتية"
                        onClick={() => setPrefs(p => ({ ...p, sound: !p.sound }))}
                    />
                </div>
                <div className="md-tg">
                    <div className="md-ico"><Wand2 size={18} /></div>
                    <div className="md-tg-tx"><b>تقليل الحركة</b><small>إيقاف الأنيميشن والتأثيرات</small></div>
                    <button
                        className={`md-sw ${prefs.calm ? 'on' : ''}`}
                        aria-label="تقليل الحركة"
                        onClick={() => setPrefs(p => ({ ...p, calm: !p.calm }))}
                    />
                </div>
            </section>
        </div>
    );

    /* ---------- الحظر ---------- */
    if (ban.active) {
        return (
            <div className="mdash" dir="rtl">
                <div className="md-aur"><i /><i /><i /></div>
                <div className="md-main" style={{ maxWidth: 680 }}>
                    <div className="md-card" style={{ marginTop: 60, textAlign: 'center', padding: 40, borderColor: 'rgba(255,93,77,.35)' }}>
                        <div className="md-ico" style={{ width: 76, height: 76, margin: '0 auto 16px', color: 'var(--bad)' }}>
                            <Ban size={38} />
                        </div>
                        <h1 className="md-ttl" style={{ fontSize: 40 }}>تم حظر حسابك نهائياً</h1>
                        <div className="md-eyb" style={{ marginBottom: 20 }}>SYSTEM ACCESS DENIED</div>
                        <div className="md-card" style={{ background: 'rgba(255,93,77,.07)', borderColor: 'rgba(255,93,77,.25)', marginBottom: 20 }}>
                            <div className="md-mut" style={{ marginBottom: 6 }}>سبب الحظر</div>
                            <b style={{ fontSize: 18 }}>{ban.reason}</b>
                        </div>
                        <button className="md-btn md-danger" onClick={() => onLogout?.()}>
                            <LogOut size={17} /> تسجيل الخروج
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`mdash ${prefs.calm ? 'calm' : ''}`}
            dir="rtl"
            onMouseMove={e => {
                const card = (e.target as HTMLElement).closest?.('.md-card') as HTMLElement | null;
                if (!card) return;
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                card.style.setProperty('--my', `${e.clientY - r.top}px`);
            }}
        >
            <div className="md-aur"><i /><i /><i /></div>
            <div className="md-grid-lines" />

            <header className="md-dock">
                <div className="md-brand">
                    <img src={getAssetUrl('logo-435242.png') || ''} alt="iCG1" />
                    <span>ICG1</span>
                </div>
                <nav className="md-nav">
                    {NAV.map(n => {
                        const Icon = n.icon;
                        return (
                            <button key={n.id} className={view === n.id ? 'on' : ''} onClick={() => go(n.id)}>
                                <Icon size={17} /> {n.label}
                            </button>
                        );
                    })}
                </nav>
                <div className="md-chips">
                    <div className="md-bellwrap">
                        <button className="md-chip md-bell" onClick={toggleBell} aria-label="الإشعارات" aria-expanded={bellOpen}>
                            <Bell size={18} />
                            {unread > 0 && <span className="md-badge">{unread > 9 ? '9+' : unread}</span>}
                        </button>
                        {bellOpen && (
                            <>
                                <div className="md-bellscrim" onClick={() => setBellOpen(false)} />
                                <div className="md-bellpanel" role="dialog" aria-label="الإشعارات">
                                    <div className="md-bellhead">
                                        <b>إشعاراتك</b>
                                        <button onClick={markAllRead} disabled={unread === 0}>تعليم الكل كمقروء</button>
                                    </div>
                                    <div className="md-bellbody">
                                        {notifs.length === 0 ? (
                                            <div className="md-bellone">
                                                <Bell size={20} />
                                                <span>لا إشعارات لك الآن</span>
                                            </div>
                                        ) : notifs.map(n => (
                                            <button
                                                key={n.id}
                                                className={`md-br ${n.read ? '' : 'un'}`}
                                                onClick={() => markRead(String(n.id), !!n.read)}
                                            >
                                                <b>{n.title}</b>
                                                <small>{n.body}</small>
                                                <em>{shortDate(n.sent_at)}</em>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <button className="md-chip" onClick={() => go('store')} aria-label="رصيد النقاط">
                        <Gem size={18} /> <span>{fmt(points)}</span>
                    </button>
                    <button className="md-chip md-mini" onClick={() => go('settings')} aria-label="الحساب">
                        <span className="md-mini-av">
                            <MemberAvatar name={displayName} kickName={username} src={avatarSrc} frameId={activeFrameId} boxClass="md-avbox-xs" />
                        </span>
                    </button>
                </div>
            </header>

            {/* دوال عرض لا مكوّنات: لو نُودّيت <HomeView/> لتكرّر تركيب الصفحة مع كل ضغطة حرف وطار التركيز */}
            <main className="md-main">
                {view === 'home' && HomeView()}
                {view === 'store' && StoreView()}
                {view === 'locker' && LockerView()}
                {view === 'rank' && RankView()}
                {view === 'settings' && SettingsView()}
            </main>

            <nav className="md-tabs">
                {NAV.map(n => {
                    const Icon = n.icon;
                    return (
                        <button key={n.id} className={view === n.id ? 'on' : ''} onClick={() => go(n.id)}>
                            <Icon size={21} /> {n.label}
                        </button>
                    );
                })}
            </nav>

            {toast && (
                <div className={`md-toast show ${toast.type}`} role="status">
                    {toast.type === 'bad' ? <XIcon size={17} /> : <Check size={17} />} {toast.msg}
                </div>
            )}

            {confirm && (
                <div className="md-md" onClick={() => setConfirm(null)}>
                    <div className="md-card" onClick={e => e.stopPropagation()}>
                        <div className="md-ico"><ShoppingBag size={26} /></div>
                        <h2>{confirm.title}</h2>
                        <p>{confirm.body}</p>
                        <div className="md-acts">
                            <button
                                className={`md-btn ${confirm.danger ? 'md-danger' : 'md-gold'}`}
                                onClick={() => { const fn = confirm.onOk; setConfirm(null); fn(); }}
                            >
                                {confirm.ok}
                            </button>
                            <button className="md-btn md-ghost" onClick={() => setConfirm(null)}>إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
