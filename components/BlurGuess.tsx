import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
    Award, ChevronLeft, ChevronRight, Eye, EyeOff, Gauge, History, Home, Image as ImageIcon,
    Lightbulb, Play, RotateCcw, Shuffle, SkipForward, Sparkles, Timer, Type, Volume2, Wand2, Zap, ZoomIn,
} from 'lucide-react';
import { chatService } from '../services/chatService';
import { awardPoints } from '../services/points';
import { ProAvatar } from './ProAvatar';
import {
    BLUR_CATEGORIES, BLUR_TIERS, BLUR_TOTAL,
    findBlurByArabic, pickBlurEntry,
    type BlurCategoryId, type BlurEntry, type BlurTier,
} from '../data/blurBank';

interface BlurGuessProps {
    channelConnected: boolean;
    onHome: () => void;
    isOBS?: boolean;
}

type Phase = 'SETUP' | 'COUNTDOWN' | 'PLAYING' | 'WINNER';
type CatSel = BlurCategoryId | 'random';
type TierSel = BlurTier | 0;

interface WinInfo {
    name: string;
    avatar?: string;
    color?: string;
    seconds: number;
    base: number;
    bonus: number;
    penalty: number;
    points: number;
}

interface GuessRow { user: string; text: string; color?: string }
interface RoundRow { ar: string; winner: string; seconds: number; points: number; tier: BlurTier }
interface SessionRow { username: string; avatar: string; points: number; wins: number }

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

const GOLD = '#e8be6e';
const EMBER = '#e8552f';
const LIVE = '#4be07a';
const CREAM = '#fbeccb';

const CLEAR_CHOICES = [30, 45, 60, 90];
/**سلم الضباب: نسبة من مدة الوضوح ← شدة الضباب */
const BLUR_LADDER: Array<[number, number]> = [[0.18, 100], [0.36, 64], [0.55, 38], [0.75, 18], [1, 8]];

const blurFor = (elapsed: number, clearSeconds: number): number => {
    if (clearSeconds <= 0) return 0;
    const p = Math.min(1.5, elapsed / clearSeconds);
    for (const [edge, blur] of BLUR_LADDER) if (p < edge) return blur;
    return 0;
};

const speedBonus = (elapsed: number, clearSeconds: number): number => {
    const p = clearSeconds <= 0 ? 1 : elapsed / clearSeconds;
    if (p <= 0.2) return 150;
    if (p <= 0.4) return 100;
    if (p <= 0.6) return 50;
    return 0;
};

/** توحيد النص: يشيل التشكيل والرموز ويوحّد الهمزات والتاء المربوطة — "الأسد/اسد/أسد" شكل واحد */
const canon = (s: string) => s
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[^ؠ-يA-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const stripArticle = (t: string) => (t.length > 4 && t.startsWith('ال') ? t.slice(2) : t);

const buildForms = (entry: BlurEntry): Set<string> => {
    const out = new Set<string>();
    const add = (raw: string) => {
        const c = canon(raw);
        if (!c) return;
        out.add(c);
        const bare = stripArticle(c);
        if (bare) out.add(bare);
    };
    add(entry.ar);
    entry.alt.forEach(add);
    add(entry.en.replace(/[-/]/g, ' '));
    return out;
};

/** تخمين اللاعب يقبل الإجابة كاملة، أو ككلمة داخل الجملة، أو بدون «ال»، أو المصطلح الإنجليزي */
const matchesGuess = (raw: string, forms: Set<string>): boolean => {
    if (!forms.size) return false;
    const text = canon(raw);
    if (!text) return false;
    if (forms.has(text) || forms.has(stripArticle(text))) return true;
    for (const form of forms) {
        if (form.includes(' ') && text.includes(form)) return true;
    }
    return text.split(' ').some(tok => forms.has(tok) || forms.has(stripArticle(tok)));
};

const shuffleArr = <T,>(arr: T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const USED_KEY = 'blur_used_photo_ids';
const readUsed = (): number[] => {
    try { return JSON.parse(localStorage.getItem(USED_KEY) || '[]'); } catch { return []; }
};
const markUsed = (id: number) => {
    try {
        const used = readUsed();
        if (!used.includes(id)) localStorage.setItem(USED_KEY, JSON.stringify([...used, id].slice(-400)));
    } catch { /* التخزين اختياري */ }
};

/** صور Pexels — مصطلح البحث إنجليزي دائماً، مع تجاوز الصور المستخدَمة recently */
const fetchPhotos = async (en: string): Promise<any[]> => {
    const term = (en || '').trim();
    if (!term || !PEXELS_API_KEY) return [];
    try {
        const page = Math.floor(Math.random() * 3) + 1;
        const res = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=20&page=${page}`,
            { headers: { Authorization: PEXELS_API_KEY } },
        );
        if (!res.ok) return [];
        const data = await res.json();
        const photos: any[] = data?.photos || [];
        if (!photos.length) return [];
        const used = readUsed();
        const fresh = photos.filter(p => !used.includes(p.id));
        return shuffleArr((fresh.length ? fresh : photos).slice(0, 12));
    } catch {
        return [];
    }
};

/** مصدر بديل بدون مفتاح — الصورة لا تُجلب عبر fetch لذلك لا يوجد منع CORS */
const fallbackUrl = (en: string) => {
    const terms = (en || 'nature').trim().split(/\s+/).slice(0, 4).join(',');
    return `https://loremflickr.com/1280/720/${encodeURIComponent(terms)}?lock=${Math.floor(Math.random() * 9999)}`;
};

/** ترجمة احتياطية للكلمة الحرة فقط — كلمات البنك كلها مكتوبة يدوياً */
const translateToEnglish = async (text: string): Promise<string> => {
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        return String(data?.[0]?.[0]?.[0] || text).trim();
    } catch {
        return text;
    }
};

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
    const el = document.getElementById('game-sidebar-portal');
    if (!mounted || !el) return null;
    return createPortal(children, el);
};

const Section: React.FC<{
    title: string;
    icon: React.ElementType;
    color?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, icon: Icon, color = GOLD, right, children }) => (
    <div className="rounded-2xl border border-icg-gold/10 bg-icg-espresso/45 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[9px] font-black text-icg-muted tracking-[0.2em]">
                <Icon size={11} style={{ color }} /> {title}
            </span>
            {right}
        </div>
        {children}
    </div>
);

const OptBtn: React.FC<{
    active: boolean;
    color: string;
    onClick: () => void;
    sub?: string;
    children: React.ReactNode;
}> = ({ active, color, onClick, sub, children }) => (
    <button
        onClick={onClick}
        className="rounded-xl px-2.5 py-2 text-[10px] font-black leading-tight transition-all hover:scale-[1.03] active:scale-95 text-center"
        style={{
            background: active ? `${color}26` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${active ? `${color}66` : 'rgba(255,255,255,0.06)'}`,
            color: active ? color : '#b2a283',
            boxShadow: active ? `0 6px 18px ${color}22` : 'none',
        }}
    >
        {children}
        {sub && <span className="block text-[8px] font-bold opacity-70 mt-0.5">{sub}</span>}
    </button>
);

const SwitchRow: React.FC<{
    label: string;
    value: boolean;
    onChange: () => void;
    icon: React.ElementType;
    color?: string;
}> = ({ label, value, onChange, icon: Icon, color = GOLD }) => (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-icg-gold/5 border border-icg-gold/10">
        <span className="flex items-center gap-1.5 text-[9px] font-black text-icg-cream/80">
            <Icon size={11} style={{ color: value ? color : undefined }} /> {label}
        </span>
        <button
            onClick={onChange}
            className="w-9 h-5 rounded-full relative transition-colors shrink-0"
            style={{ background: value ? color : 'rgba(232,190,110,0.15)' }}
        >
            <span
                className="absolute top-1 left-1 w-3 h-3 rounded-full bg-icg-ink transition-transform"
                style={{ transform: value ? 'translateX(16px)' : 'none' }}
            />
        </button>
    </div>
);

const ZoomPad: React.FC<{ cell: number; onChange: (c: number) => void; color?: string; compact?: boolean }> = ({ cell, onChange, color = GOLD, compact = false }) => (
    <div dir="ltr" className={`grid grid-cols-3 gap-1 shrink-0 ${compact ? 'w-[60px]' : 'w-full max-w-[128px] mx-auto'}`}>
        {Array.from({ length: 9 }, (_, i) => (
            <button
                key={i}
                type="button"
                onClick={() => onChange(i)}
                aria-label={`منطقة الزوم ${i + 1}`}
                className="aspect-square rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
                style={{
                    background: cell === i ? `${color}59` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${cell === i ? color : 'rgba(255,255,255,0.12)'}`,
                    boxShadow: cell === i ? `0 0 12px ${color}66` : 'none',
                }}
            />
        ))}
    </div>
);

const LetterBoard: React.FC<{ word: string; open: boolean; accent: string }> = ({ word, open, accent }) => (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2" dir="rtl">
        {word.split(' ').map((w, wi) => (
            <span key={wi} className="flex gap-1">
                {w.split('').map((ch, ci) => {
                    const shown = open || (ci === 0 && w.length > 2);
                    return (
                        <span
                            key={ci}
                            className="w-7 h-9 grid place-items-center rounded-lg border text-base font-black italic"
                            style={{
                                borderColor: open ? `${accent}66` : 'rgba(232,190,110,0.16)',
                                background: open ? `${accent}14` : 'rgba(255,255,255,0.03)',
                                color: open ? accent : 'rgba(251,236,203,0.45)',
                            }}
                        >
                            {shown ? ch : '؟'}
                        </span>
                    );
                })}
            </span>
        ))}
    </div>
);

export const BlurGuess: React.FC<BlurGuessProps> = ({ channelConnected, onHome, isOBS = false }) => {
    // ---------- الإعدادات ----------
    const [phase, setPhase] = useState<Phase>('SETUP');
    const [catId, setCatId] = useState<CatSel>('random');
    const [tierSel, setTierSel] = useState<TierSel>(0);
    const [clearSeconds, setClearSeconds] = useState(45);
    const [blurMode, setBlurMode] = useState<'auto' | 'fixed'>('auto');
    const [fixedBlur, setFixedBlur] = useState(70);
    const [zoomOn, setZoomOn] = useState(false);
    const [zoomCell, setZoomCell] = useState(4);
    const [zoomScale, setZoomScale] = useState(3);
    const [soundOn, setSoundOn] = useState(true);
    const [autoHint, setAutoHint] = useState(true);
    const [autoNext, setAutoNext] = useState(false);
    const [manualAr, setManualAr] = useState('');
    const [manualEn, setManualEn] = useState('');

    // ---------- الجولة ----------
    const [entry, setEntry] = useState<BlurEntry | null>(null);
    const [photos, setPhotos] = useState<any[]>([]);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isSourceFallback, setIsSourceFallback] = useState(false);
    const [imgReady, setImgReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [showPattern, setShowPattern] = useState(false);
    const [adminReveal, setAdminReveal] = useState(false);
    const [winner, setWinner] = useState<WinInfo | null>(null);
    const [recent, setRecent] = useState<GuessRow[]>([]);
    const [history, setHistory] = useState<RoundRow[]>([]);
    const [session, setSession] = useState<Record<string, SessionRow>>({});

    const phaseRef = useRef<Phase>('SETUP');
    const entryRef = useRef<BlurEntry | null>(null);
    const formsRef = useRef<Set<string>>(new Set());
    const elapsedRef = useRef(0);
    const cfgRef = useRef({ catId, tierSel, clearSeconds, autoHint, autoNext });
    const hintsRef = useRef({ hint: false, pattern: false });
    const resolvingRef = useRef(false);
    const soundRef = useRef(soundOn);
    const audioRef = useRef<AudioContext | null>(null);

    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
    useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
    useEffect(() => { hintsRef.current = { hint: showHint, pattern: showPattern }; }, [showHint, showPattern]);
    useEffect(() => { cfgRef.current = { catId, tierSel, clearSeconds, autoHint, autoNext }; }, [catId, tierSel, clearSeconds, autoHint, autoNext]);

    const tone = useCallback((freq: number, dur = 0.14, type: OscillatorType = 'sine', gain = 0.06) => {
        if (!soundRef.current) return;
        try {
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctx) return;
            if (!audioRef.current) audioRef.current = new Ctx();
            const ctx = audioRef.current;
            if (ctx.state === 'suspended') void ctx.resume();
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            g.gain.setValueAtTime(gain, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + dur);
        } catch { /* الصوت اختياري */ }
    }, []);

    const burst = useCallback(() => {
        try {
            confetti({ particleCount: 110, spread: 82, origin: { x: 0.5, y: 0.45 }, colors: [GOLD, '#f9e0a4', EMBER, LIVE], zIndex: 60 });
            setTimeout(() => confetti({ particleCount: 45, angle: 60, spread: 65, origin: { x: 0.08, y: 0.75 }, colors: [GOLD, '#f9e0a4'], zIndex: 60 }), 170);
            setTimeout(() => confetti({ particleCount: 45, angle: 120, spread: 65, origin: { x: 0.92, y: 0.75 }, colors: [GOLD, '#f9e0a4'], zIndex: 60 }), 320);
        } catch { /* لا شيء */ }
    }, []);

    const resetRoundFlags = useCallback(() => {
        setElapsed(0);
        setShowHint(false);
        setShowPattern(false);
        setAdminReveal(false);
        setWinner(null);
        setRecent([]);
        hintsRef.current = { hint: false, pattern: false };
        elapsedRef.current = 0;
        resolvingRef.current = false;
    }, []);

    const applyEntry = useCallback(async (next: BlurEntry) => {
        entryRef.current = next;
        formsRef.current = buildForms(next);
        setEntry(next);
        setPhotos([]);
        setPhotoIndex(0);
        setImageUrl(null);
        setImgReady(false);
        setIsSourceFallback(false);
        setLoading(true);
        const list = await fetchPhotos(next.en);
        if (entryRef.current !== next) return;
        if (list.length) setPhotos(list);
        else { setIsSourceFallback(true); setImageUrl(fallbackUrl(next.en)); }
        setLoading(false);
    }, []);

    // الصورة الحالية عند تبديل الشريحة
    useEffect(() => {
        if (!photos.length) return;
        const photo = photos[photoIndex];
        if (!photo) return;
        setImgReady(false);
        setImageUrl(photo.src?.large || photo.src?.medium || photo.src?.original || null);
        if (typeof photo.id === 'number') markUsed(photo.id);
    }, [photos, photoIndex]);

    const armCountdown = useCallback(() => {
        resetRoundFlags();
        setPhase('COUNTDOWN');
        setCountdown(3);
    }, [resetRoundFlags]);

    const newRound = useCallback(async (cat?: CatSel, tier?: TierSel) => {
        const cfg = cfgRef.current;
        const next = pickBlurEntry(cat ?? cfg.catId, tier ?? cfg.tierSel);
        setManualAr('');
        setManualEn('');
        await applyEntry(next);
        armCountdown();
    }, [applyEntry, armCountdown]);

    // ---------- كلمة حرة من المشرف ----------
    useEffect(() => {
        if (phase !== 'SETUP') return;
        const ar = manualAr.trim();
        if (ar.length < 2) return;
        if (entryRef.current && canon(entryRef.current.ar) === canon(ar)) return;

        const hit = findBlurByArabic(ar);
        if (hit) { void applyEntry(hit); return; }

        const forced = manualEn.trim();
        if (forced) {
            void applyEntry({ en: forced, ar, alt: [ar], hint: 'كلمة حرة من المشرف', tier: 2 });
            return;
        }

        const id = window.setTimeout(async () => {
            const en = await translateToEnglish(ar);
            if (canon(entryRef.current?.ar || '') === canon(ar)) return;
            void applyEntry({ en, ar, alt: [ar], hint: 'كلمة حرة من المشرف', tier: 2 });
        }, 700);
        return () => window.clearTimeout(id);
    }, [manualAr, manualEn, phase, applyEntry]);

    // ---------- العد التنازلي ----------
    useEffect(() => {
        if (phase !== 'COUNTDOWN') return;
        if (countdown <= 0) { setPhase('PLAYING'); tone(880, 0.22, 'triangle', 0.08); return; }
        tone(520 + (3 - countdown) * 90, 0.12, 'triangle');
        const id = window.setTimeout(() => setCountdown(c => c - 1), 750);
        return () => window.clearTimeout(id);
    }, [phase, countdown, tone]);

    // ---------- مؤقت الجولة ----------
    useEffect(() => {
        if (phase !== 'PLAYING') return;
        const id = window.setInterval(() => setElapsed(e => e + 1), 1000);
        return () => window.clearInterval(id);
    }, [phase]);

    // ---------- تلميح تلقائي ----------
    useEffect(() => {
        if (phase !== 'PLAYING' || !cfgRef.current.autoHint) return;
        if (elapsed >= Math.round(clearSeconds * 0.45)) setShowHint(true);
        if (elapsed >= Math.round(clearSeconds * 0.75)) setShowPattern(true);
    }, [elapsed, phase, clearSeconds]);

    // ---------- الشات ----------
    useEffect(() => {
        if (!channelConnected) return;
        const cleanup = chatService.onMessage(async (msg) => {
            if (phaseRef.current !== 'PLAYING' || resolvingRef.current) return;
            const current = entryRef.current;
            if (!current || msg.user.isBot) return;

            setRecent(prev => [{ user: msg.user.username, text: msg.content, color: msg.user.color }, ...prev].slice(0, 8));
            if (!matchesGuess(msg.content, formsRef.current)) return;

            resolvingRef.current = true;
            const cfg = cfgRef.current;
            const seconds = elapsedRef.current;
            const base = BLUR_TIERS[current.tier].points;
            const bonus = speedBonus(seconds, cfg.clearSeconds);
            const penalty = (hintsRef.current.hint ? 60 : 0) + (hintsRef.current.pattern ? 40 : 0);
            const points = Math.max(50, base + bonus - penalty);
            const username = msg.user.username;
            const avatar = msg.user.avatar || '';

            setWinner({ name: username, avatar, color: msg.user.color, seconds, base, bonus, penalty, points });
            setPhase('WINNER');
            setShowHint(true);
            setShowPattern(true);
            burst();
            tone(660, 0.16, 'triangle', 0.09);
            setTimeout(() => tone(880, 0.18, 'triangle', 0.09), 150);
            setTimeout(() => tone(1180, 0.26, 'triangle', 0.09), 320);

            setSession(prev => {
                const row = prev[username] || { username, avatar, points: 0, wins: 0 };
                return { ...prev, [username]: { ...row, avatar: avatar || row.avatar, points: row.points + points, wins: row.wins + 1 } };
            });
            setHistory(prev => [{ ar: current.ar, winner: username, seconds, points, tier: current.tier }, ...prev].slice(0, 12));

            awardPoints('BLUR_GUESS', username, avatar, 'round', bonus >= 100 ? 1.5 : bonus >= 50 ? 1 : 0.75);
            if (!avatar) {
                void chatService.fetchKickAvatar(username).then(live => {
                    if (!live) return;
                    setWinner(w => (w && w.name === username && !w.avatar ? { ...w, avatar: live } : w));
                    setSession(s => { const row = s[username]; if (!row || row.avatar) return s; return { ...s, [username]: { ...row, avatar: live } }; });
                });
            }
        });
        return cleanup;
    }, [channelConnected, burst, tone]);

    // ---------- جولة تالية تلقائياً ----------
    useEffect(() => {
        if (phase !== 'WINNER' || !autoNext) return;
        const id = window.setTimeout(() => { void newRound(); }, 12000);
        return () => window.clearTimeout(id);
    }, [phase, autoNext, newRound]);

    const category = useMemo(() => BLUR_CATEGORIES.find(c => c.id === catId) || null, [catId]);
    const categoryLabel = category ? category.label : 'عشوائي جداً';
    const accent = category ? category.hex : GOLD;
    const tierMeta = entry ? BLUR_TIERS[entry.tier] : null;
    const autoBlur = phase === 'WINNER' || adminReveal ? 0 : phase === 'PLAYING' ? blurFor(elapsed, clearSeconds) : 100;
    const blur = phase === 'WINNER' || adminReveal ? 0
        : blurMode === 'fixed' ? (phase === 'PLAYING' ? fixedBlur : 100)
            : autoBlur;
    const clarity = Math.max(0, Math.round(100 - blur));
    const zoomActive = zoomOn && (phase === 'PLAYING' || phase === 'COUNTDOWN') && !!imageUrl;
    const zoomOrigin = `${((zoomCell % 3) + 0.5) * (100 / 3)}% ${(Math.floor(zoomCell / 3) + 0.5) * (100 / 3)}%`;
    const sessionRows = useMemo(
        () => Object.values(session).sort((a, b) => b.points - a.points || b.wins - a.wins),
        [session],
    );
    const lettersCount = entry ? entry.ar.replace(/\s/g, '').length : 0;

    const statusLabel = phase === 'SETUP' ? 'استعداد' : phase === 'COUNTDOWN' ? 'استعد' : phase === 'PLAYING' ? 'جارية' : 'اكشفت';
    const statusColor = phase === 'SETUP' ? '#b2a283' : phase === 'PLAYING' ? EMBER : phase === 'COUNTDOWN' ? GOLD : LIVE;

    const showImage = (phase === 'PLAYING' || phase === 'WINNER' || phase === 'COUNTDOWN') && !!imageUrl;

    return (
        <>
            <SidebarPortal>
                <div className="rounded-[1.5rem] border border-icg-gold/12 bg-icg-ink/85 backdrop-blur-2xl overflow-hidden shadow-2xl">
                    <div className="px-3 py-2.5 border-b border-icg-gold/10 bg-icg-gold/5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[11px] font-black text-icg-cream tracking-widest">
                            <ImageIcon size={14} className="text-icg-gold" /> لوحة المشرف
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black shrink-0" style={{ background: `${statusColor}1f`, color: statusColor }}>
                            {statusLabel}
                        </span>
                    </div>

                    <div className="p-2.5 space-y-2.5">
                        {phase === 'SETUP' ? (
                            <>
                                <Section title="الفئة" icon={Shuffle} color={accent}>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <OptBtn active={catId === 'random'} color={GOLD} onClick={() => setCatId('random')} sub={`${BLUR_TOTAL} كلمة`}>عشوائي جداً</OptBtn>
                                        {BLUR_CATEGORIES.map(c => (
                                            <OptBtn key={c.id} active={catId === c.id} color={c.hex} onClick={() => setCatId(c.id)} sub={`${c.entries.length} كلمة`}>
                                                {c.label}
                                            </OptBtn>
                                        ))}
                                    </div>
                                </Section>

                                <Section title="الصعوبة" icon={Gauge}>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <OptBtn active={tierSel === 0} color={GOLD} onClick={() => setTierSel(0)} sub="كل المستويات">الكل</OptBtn>
                                        {([1, 2, 3] as BlurTier[]).map(t => (
                                            <OptBtn key={t} active={tierSel === t} color={BLUR_TIERS[t].hex} onClick={() => setTierSel(t)} sub={`${BLUR_TIERS[t].points} نقطة`}>
                                                {BLUR_TIERS[t].label}
                                            </OptBtn>
                                        ))}
                                    </div>
                                </Section>

                                <Section title="متى تكتمل الصورة" icon={Timer}>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {CLEAR_CHOICES.map(s => (
                                            <OptBtn key={s} active={clearSeconds === s} color={GOLD} onClick={() => setClearSeconds(s)}>{s} ث</OptBtn>
                                        ))}
                                    </div>
                                </Section>

                                <Section title="الغشاوة والزوم" icon={Eye} color={GOLD}>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <OptBtn active={blurMode === 'auto'} color={GOLD} onClick={() => setBlurMode('auto')} sub="تتضح تدريجياً">تلقائي</OptBtn>
                                        <OptBtn active={blurMode === 'fixed'} color={EMBER} onClick={() => setBlurMode('fixed')} sub={`${fixedBlur}% ثابت`}>ثابت</OptBtn>
                                    </div>
                                    {blurMode === 'fixed' && (
                                        <div className="rounded-xl bg-black/40 border border-icg-gold/15 px-3 py-2">
                                            <div className="flex items-center justify-between text-[10px] font-black">
                                                <span className="text-icg-muted">درجة التغبيش</span>
                                                <span className="text-icg-gold tabular-nums">{fixedBlur}%</span>
                                            </div>
                                            <input
                                                type="range" min={5} max={100} step={5} value={fixedBlur}
                                                onChange={e => setFixedBlur(Number(e.target.value))}
                                                className="mt-1.5 w-full accent-[#e8be6e]"
                                            />
                                        </div>
                                    )}
                                    <SwitchRow label="زوم أون — يظهر جزء محدد فقط" value={zoomOn} onChange={() => setZoomOn(v => !v)} icon={ZoomIn} />
                                    {zoomOn && (
                                        <div className="space-y-2 rounded-xl border border-icg-gold/12 bg-black/30 p-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[9px] font-black text-icg-muted">الجزء الظاهر</span>
                                                <div className="flex items-center gap-1">
                                                    {[1.6, 2.2, 3].map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => setZoomScale(s)}
                                                            className="px-2 py-0.5 rounded-lg text-[9px] font-black transition-all"
                                                            style={{
                                                                background: zoomScale === s ? `${GOLD}2e` : 'rgba(255,255,255,0.04)',
                                                                border: `1px solid ${zoomScale === s ? `${GOLD}88` : 'rgba(255,255,255,0.1)'}`,
                                                                color: zoomScale === s ? GOLD : '#b2a283',
                                                            }}
                                                        >
                                                            {s}×
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <ZoomPad cell={zoomCell} onChange={setZoomCell} />
                                            <p className="text-[8px] font-bold text-icg-muted/70 leading-relaxed text-center">اضغط مربعاً لتحديد المنطقة التي ستُعرض وحدها مكبَّرة.</p>
                                        </div>
                                    )}
                                </Section>

                                <Section title="خيارات البث" icon={Sparkles}>
                                    <div className="space-y-1.5">
                                        <SwitchRow label="أصوات اللعبة" value={soundOn} onChange={() => setSoundOn(v => !v)} icon={Volume2} />
                                        <SwitchRow label="تلميح تلقائي" value={autoHint} onChange={() => setAutoHint(v => !v)} icon={Lightbulb} color={LIVE} />
                                        <SwitchRow label="جولة تالية تلقائياً" value={autoNext} onChange={() => setAutoNext(v => !v)} icon={RotateCcw} color={EMBER} />
                                    </div>
                                </Section>

                                <Section title="كلمة حرة (اختياري)" icon={Type} color={EMBER}>
                                    <input
                                        value={manualAr}
                                        onChange={e => setManualAr(e.target.value)}
                                        placeholder="اكتب الكلمة بالعربية..."
                                        className="w-full rounded-xl bg-black/50 border border-icg-gold/15 px-3 py-2 text-[12px] font-black text-icg-cream outline-none focus:border-icg-gold/50 transition-all"
                                    />
                                    <input
                                        value={manualEn}
                                        onChange={e => setManualEn(e.target.value)}
                                        placeholder="مصطلح البحث بالإنجليزي (Pexels إنجليزي فقط)"
                                        dir="ltr"
                                        className="w-full rounded-xl bg-black/50 border border-icg-gold/10 px-3 py-2 text-[10px] font-bold text-icg-muted outline-none focus:border-icg-gold/40 transition-all"
                                    />
                                    <p className="text-[8px] font-bold text-icg-muted/70 leading-relaxed">
                                        لو الكلمة موجودة بالبنك تُستخدم إجابته المكتوبة. غير ذلك تُترجم احتياطياً للبحث فقط.
                                    </p>
                                </Section>

                                <div className="relative rounded-2xl overflow-hidden border border-icg-gold/12 bg-black/50">
                                    <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-md bg-icg-ink/85 border border-icg-gold/25 text-[8px] font-black text-icg-gold">للمشرف فقط</div>
                                    <div className="relative h-32">
                                        {(loading || (imageUrl && !imgReady)) && (
                                            <div className="absolute inset-0 z-10 grid place-items-center bg-icg-ink/70 backdrop-blur-sm">
                                                <div className="w-8 h-8 rounded-full border-2 border-icg-gold/20 border-t-icg-gold animate-spin" />
                                            </div>
                                        )}
                                        {imageUrl ? (
                                            <img
                                                src={imageUrl}
                                                alt=""
                                                onLoad={() => setImgReady(true)}
                                                onError={() => { if (!isSourceFallback) { setIsSourceFallback(true); setImageUrl(fallbackUrl(entry?.en || '')); } }}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full grid place-items-center text-[9px] font-black text-icg-muted/50">اختر فئة أو اكتب كلمة</div>
                                        )}
                                    </div>
                                    {photos.length > 1 && (
                                        <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-icg-espresso/70 border-t border-icg-gold/10">
                                            <button onClick={() => setPhotoIndex(p => (p - 1 + photos.length) % photos.length)} className="p-1 rounded-lg bg-white/5 hover:bg-icg-gold/20 transition-colors"><ChevronRight size={13} className="text-icg-cream" /></button>
                                            <span className="text-[9px] font-black text-icg-muted tabular-nums">{photoIndex + 1} / {photos.length}</span>
                                            <button onClick={() => setPhotoIndex(p => (p + 1) % photos.length)} className="p-1 rounded-lg bg-white/5 hover:bg-icg-gold/20 transition-colors"><ChevronLeft size={13} className="text-icg-cream" /></button>
                                        </div>
                                    )}
                                </div>

                                {entry && (
                                    <div className="rounded-2xl border border-icg-gold/12 bg-icg-espresso/50 p-2.5 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-base font-black italic text-icg-cream">{entry.ar}</span>
                                            {tierMeta && <span className="px-2 py-0.5 rounded-full text-[9px] font-black" style={{ background: `${tierMeta.hex}1f`, color: tierMeta.hex }}>{tierMeta.label} · {tierMeta.points}</span>}
                                        </div>
                                        <p className="text-[9px] font-bold text-icg-muted">{entry.hint}</p>
                                        <p className="text-[9px] font-black text-icg-gold/70" dir="ltr">Pexels: {entry.en}</p>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <button
                                        onClick={() => { if (entry && imageUrl) armCountdown(); }}
                                        disabled={!entry || !imageUrl || loading}
                                        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-black text-sm text-icg-espresso transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                                        style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 12px 30px rgba(232,190,110,0.25)' }}
                                    >
                                        <Play size={16} fill="currentColor" /> ابدأ التحدي
                                    </button>
                                    <button
                                        onClick={() => { void newRound(); }}
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 font-black text-[11px] text-icg-cream bg-icg-gold/10 border border-icg-gold/20 hover:bg-icg-gold/20 transition-all active:scale-95"
                                    >
                                        <Wand2 size={13} /> سلّمني كلمة عشوائية
                                    </button>
                                    {!isOBS && (
                                        <button onClick={onHome} className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 font-black text-[10px] text-icg-muted hover:text-icg-cream hover:bg-white/5 transition-all">
                                            <Home size={12} /> العودة للرئيسية
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <Section title="الإجابة الحالية" icon={Zap} color={accent}
                                    right={tierMeta ? <span className="text-[9px] font-black" style={{ color: tierMeta.hex }}>{tierMeta.points} نقطة</span> : undefined}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-base font-black italic text-icg-cream">
                                            {(phase === 'WINNER' || adminReveal) ? entry?.ar : `${lettersCount} حرفاً`}
                                        </span>
                                        <button
                                            onClick={() => setAdminReveal(v => !v)}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-icg-gold/20 transition-colors"
                                            title={adminReveal ? 'إخفاء الإجابة' : 'كشف الإجابة'}
                                        >
                                            {adminReveal ? <EyeOff size={13} className="text-icg-cream" /> : <Eye size={13} className="text-icg-muted" />}
                                        </button>
                                    </div>
                                    <p className="text-[9px] font-bold text-icg-muted" dir="ltr">{(phase === 'WINNER' || adminReveal) && entry?.en}</p>
                                    <p className="text-[9px] font-bold text-icg-muted/80">{entry?.hint}</p>
                                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black" style={{ background: `${accent}1f`, color: accent }}>{categoryLabel}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] font-black text-icg-muted tabular-nums">{elapsed} ث</span>
                                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] font-black text-icg-muted tabular-nums">وضوح {clarity}%</span>
                                    </div>
                                </Section>

                                <Section title="أدوات الجولة" icon={Lightbulb} color={LIVE}>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <OptBtn active={showHint} color={LIVE} onClick={() => setShowHint(v => !v)}>تلميح <span className="text-[8px] opacity-70">-60</span></OptBtn>
                                        <OptBtn active={showPattern} color={LIVE} onClick={() => setShowPattern(v => !v)}>الحروف <span className="text-[8px] opacity-70">-40</span></OptBtn>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button onClick={() => photos.length > 1 && setPhotoIndex(p => (p + 1) % photos.length)} disabled={photos.length < 2} className="rounded-xl px-2 py-2 text-[10px] font-black text-icg-cream bg-white/5 border border-white/10 hover:bg-icg-gold/15 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-1.5">
                                            <Shuffle size={11} /> صورة أخرى
                                        </button>
                                        <button onClick={() => { void newRound(); }} className="rounded-xl px-2 py-2 text-[10px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95" style={{ background: `${EMBER}1f`, border: `1px solid ${EMBER}44`, color: EMBER }}>
                                            <SkipForward size={11} /> تخطّي
                                        </button>
                                    </div>
                                    <button onClick={() => { resetRoundFlags(); setPhase('SETUP'); setEntry(null); entryRef.current = null; formsRef.current = new Set(); setImageUrl(null); setPhotos([]); }} className="w-full rounded-xl px-2 py-2 text-[10px] font-black text-icg-muted bg-white/5 border border-white/10 hover:text-icg-cream transition-all flex items-center justify-center gap-1.5">
                                        <RotateCcw size={11} /> إعادة الضبط
                                    </button>
                                </Section>

                                {recent.length > 0 && (
                                    <Section title="آخر التخمينات" icon={Sparkles} color={EMBER}>
                                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                            {recent.map((g, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-[10px] rounded-lg bg-black/30 px-2 py-1">
                                                    <span className="font-black truncate max-w-[70px]" style={{ color: g.color || CREAM }}>{g.user}</span>
                                                    <span className="text-icg-muted/50">:</span>
                                                    <span className="text-icg-cream/70 truncate flex-1">{g.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {sessionRows.length > 0 && (
                                    <Section title="نقاط الجلسة" icon={Award} right={<span className="text-[9px] font-black text-icg-muted tabular-nums">{sessionRows.reduce((s, r) => s + r.points, 0)}</span>}>
                                        <div className="space-y-1">
                                            {sessionRows.slice(0, 6).map((r, i) => (
                                                <div key={r.username} className="flex items-center gap-2 rounded-xl px-1.5 py-1 bg-black/25">
                                                    <span className="w-4 text-[10px] font-black text-center shrink-0" style={{ color: i === 0 ? GOLD : '#b2a283' }}>{i + 1}</span>
                                                    <ProAvatar url={r.avatar} username={r.username} size="w-7 h-7" className="shrink-0" />
                                                    <span className="flex-1 text-[10px] font-black text-icg-cream truncate">{r.username}</span>
                                                    <span className="text-[9px] font-black text-icg-gold tabular-nums shrink-0">{r.points}</span>
                                                    <span className="text-[8px] font-bold text-icg-muted tabular-nums shrink-0">×{r.wins}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {history.length > 0 && (
                                    <Section title="سجل الجولات" icon={History}>
                                        <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                                            {history.map((h, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2 text-[9px] rounded-lg bg-black/25 px-2 py-1">
                                                    <span className="font-black text-icg-cream truncate">{h.ar}</span>
                                                    <span className="text-icg-muted truncate max-w-[70px]">{h.winner}</span>
                                                    <span className="shrink-0 tabular-nums" style={{ color: BLUR_TIERS[h.tier].hex }}>{h.points}</span>
                                                    <span className="shrink-0 text-icg-muted/60 tabular-nums">{h.seconds}ث</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {phase === 'WINNER' && (
                                    <button
                                        onClick={() => { void newRound(); }}
                                        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-black text-sm text-icg-espresso transition-all hover:scale-[1.02] active:scale-95"
                                        style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 12px 30px rgba(232,190,110,0.25)' }}
                                    >
                                        <Play size={15} fill="currentColor" /> جولة جديدة
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </SidebarPortal>

            {/* ===================== الشاشة الرئيسية ===================== */}
            <div className="bl-root relative flex-1 w-full h-full flex flex-col items-center overflow-hidden select-none" dir="rtl">
                <div className="bl-wash absolute inset-0 pointer-events-none" />
                <div className="bl-grid absolute inset-0 pointer-events-none" />

                <div className="relative z-10 w-full flex items-center justify-between gap-4 px-5 py-3.5 border-b border-icg-gold/10 bg-icg-ink/70 backdrop-blur-xl shrink-0">
                    <div className="absolute bottom-0 left-1/4 right-1/4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}77, transparent)` }} />
                    <div className="flex items-center gap-3.5 min-w-0">
                        {!isOBS && (
                            <button onClick={onHome} className="shrink-0 p-2.5 rounded-xl bg-icg-gold/10 border border-icg-gold/20 text-icg-cream hover:bg-icg-ember/20 hover:border-icg-ember/40 transition-all active:scale-90">
                                <Home size={18} />
                            </button>
                        )}
                        <div className="min-w-0">
                            <h1 className="bl-title text-2xl md:text-3xl font-black italic tracking-tighter leading-none whitespace-nowrap">تخمين الصورة</h1>
                            <p className="text-[9px] font-black text-icg-muted/70 tracking-[0.45em] mt-1.5 whitespace-nowrap">PICTURE GUESS ARENA</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${accent}1a`, color: accent }}>{categoryLabel}</span>
                        {tierMeta && (
                            <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${tierMeta.hex}1a`, color: tierMeta.hex }}>
                                {tierMeta.label} · {tierMeta.points}
                            </span>
                        )}
                        <span className="px-3 py-1.5 rounded-full bg-icg-gold/10 border border-icg-gold/20 text-[11px] font-black text-icg-cream tabular-nums">{BLUR_TOTAL} كلمة</span>
                        <button onClick={() => setSoundOn(v => !v)} className={`p-2 rounded-xl border transition-all active:scale-90 ${soundOn ? 'bg-icg-gold/15 border-icg-gold/30 text-icg-gold' : 'bg-white/5 border-white/10 text-icg-muted'}`}>
                            <Volume2 size={15} />
                        </button>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-icg-ember/10 border border-icg-ember/25">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor }} />
                            <span className="text-[10px] font-black" style={{ color: statusColor }}>{statusLabel}</span>
                        </span>
                    </div>
                </div>

                {/* ---------- استعداد ---------- */}
                {phase === 'SETUP' && (
                    <div className="relative z-10 flex-1 w-full flex items-center justify-center px-5 py-6 overflow-y-auto custom-scrollbar">
                        <div className="w-full max-w-4xl space-y-5">
                            <div className="text-center">
                                <div className="bl-title text-5xl md:text-7xl font-black italic tracking-tighter leading-none">خَمِّن من الصورة</div>
                                <p className="mt-3 text-sm font-black text-icg-muted tracking-wider">
                                    صورة تُكشف ببطء — أول من يكتب الكلمة في الشات يأخذ النقاط
                                </p>
                            </div>

                            <div className="rounded-[1.75rem] border border-icg-gold/12 bg-icg-espresso/50 backdrop-blur-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="shrink-0 w-11 h-11 rounded-2xl grid place-items-center bg-icg-gold/10 border border-icg-gold/25">
                                        <Zap size={20} className="text-icg-gold" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-icg-cream leading-none">كيف تلعب؟</p>
                                        <p className="text-[11px] font-bold text-icg-muted mt-1.5">اكتب الكلمة العربية كاملة في الشات — بدون علامات ترقيم</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${GOLD}1f`, color: GOLD }}>أول تخمين يفوز</span>
                                    <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${LIVE}1a`, color: LIVE }}>كلما بكّرت زادت النقاط</span>
                                    <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-black text-icg-muted">التلميح يخصم نقاطاً</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {([
                                    { k: 'الفئة', v: categoryLabel, c: accent },
                                    { k: 'الصعوبة', v: tierSel === 0 ? 'كل المستويات' : BLUR_TIERS[tierSel].label, c: tierSel === 0 ? GOLD : BLUR_TIERS[tierSel].hex },
                                    { k: 'اكتمال الصورة', v: `بعد ${clearSeconds} ثانية`, c: GOLD },
                                    { k: 'نقاط الأساس', v: tierSel === 0 ? '100 - 300' : String(BLUR_TIERS[tierSel].points), c: EMBER },
                                ] as const).map(item => (
                                    <div key={item.k} className="rounded-2xl border bg-icg-espresso/55 px-3.5 py-3" style={{ borderColor: `${item.c}22` }}>
                                        <p className="text-[9px] font-black text-icg-muted tracking-widest">{item.k}</p>
                                        <p className="mt-1 text-base font-black italic leading-none" style={{ color: item.c }}>{item.v}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {BLUR_CATEGORIES.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => { setCatId(c.id); }}
                                        className="group relative overflow-hidden rounded-2xl px-3 py-3 text-right transition-all hover:scale-[1.04] active:scale-95"
                                        style={{ background: `${c.hex}0d`, border: `1px solid ${c.hex}2a` }}
                                    >
                                        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(70% 90% at 50% 100%, ${c.hex}33, transparent 70%)` }} />
                                        <p className="relative text-[12px] font-black" style={{ color: c.hex }}>{c.label}</p>
                                        <p className="relative text-[9px] font-bold text-icg-muted mt-0.5">{c.blurb}</p>
                                        <p className="relative text-[8px] font-black text-icg-muted/60 mt-1">{c.entries.length} كلمة</p>
                                    </button>
                                ))}
                                <div className="rounded-2xl px-3 py-3 flex flex-col items-center justify-center gap-1" style={{ background: `${GOLD}0d`, border: `1px dashed ${GOLD}44` }}>
                                    <Wand2 size={16} className="text-icg-gold" />
                                    <p className="text-[10px] font-black text-icg-cream">كلمة حرة</p>
                                    <p className="text-[8px] font-bold text-icg-muted">من لوحة المشرف</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-3 pb-4 flex-wrap">
                                <button
                                    onClick={() => { if (entry && imageUrl) armCountdown(); }}
                                    disabled={!entry || !imageUrl || loading}
                                    className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-black text-sm text-icg-espresso transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                                    style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 14px 36px rgba(232,190,110,0.3)' }}
                                >
                                    <Play size={17} fill="currentColor" /> ابدأ من لوحة المشرف
                                </button>
                                <button
                                    onClick={() => { void newRound(); }}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm text-icg-cream bg-icg-gold/10 border border-icg-gold/20 hover:bg-icg-gold/20 transition-all active:scale-95 disabled:opacity-40"
                                >
                                    <Sparkles size={16} /> كلمة عشوائية
                                </button>
                                {!channelConnected && (
                                    <span className="px-3 py-2 rounded-full bg-icg-ember/10 border border-icg-ember/25 text-[10px] font-black" style={{ color: EMBER }}>
                                        الشات غير متصل — لا يمكن احتساب التخمينات
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------- الجولة ---------- */}
                {(phase === 'COUNTDOWN' || phase === 'PLAYING' || phase === 'WINNER') && (
                    <div className="relative z-10 flex-1 w-full flex flex-col items-center justify-center gap-3.5 px-4 md:px-6 py-4 overflow-hidden">
                        <div className="w-full max-w-5xl flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${accent}1a`, color: accent }}>{categoryLabel}</span>
                                {tierMeta && (
                                    <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${tierMeta.hex}1a`, color: tierMeta.hex }}>
                                        {tierMeta.label} · {tierMeta.points} نقطة
                                    </span>
                                )}
                                {isSourceFallback && (
                                    <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-icg-muted">مصدر صور بديل</span>
                                )}
                            </div>
                            {phase !== 'WINNER' && (
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-icg-ink/70 border border-icg-gold/15">
                                        <Timer size={13} className="text-icg-gold" />
                                        <span className="text-[13px] font-black text-icg-cream tabular-nums leading-none">{elapsed}s</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-icg-ink/70 border border-icg-gold/15">
                                        <span className="text-[9px] font-black text-icg-muted tracking-widest">وضوح</span>
                                        <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: clarity > 60 ? LIVE : clarity > 25 ? GOLD : EMBER }}>{clarity}%</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative w-full max-w-5xl aspect-video rounded-[2.25rem] overflow-hidden border-4 border-icg-gold/15 bg-icg-espresso shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
                            {showImage && (
                                <img
                                    key={imageUrl || 'none'}
                                    src={imageUrl || undefined}
                                    alt=""
                                    onLoad={() => setImgReady(true)}
                                    onError={() => { if (!isSourceFallback) { setIsSourceFallback(true); setImageUrl(fallbackUrl(entry?.en || '')); } }}
                                    className="w-full h-full object-cover"
                                    style={{
                                        filter: `blur(${blur}px) saturate(${blur > 60 ? 1.15 : 1})`,
                                        opacity: imgReady ? 1 : 0.25,
                                        transform: zoomActive ? `scale(${zoomScale})` : 'scale(1)',
                                        transformOrigin: zoomOrigin,
                                        transition: 'filter 1s, opacity 1s, transform .85s cubic-bezier(.2,.8,.2,1)',
                                    }}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-icg-ink/85 via-transparent to-icg-ink/25 pointer-events-none" />

                            {(!imageUrl || !imgReady) && phase !== 'COUNTDOWN' && (
                                <div className="absolute inset-0 grid place-items-center bg-icg-ink/80 backdrop-blur-md">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border-2 border-icg-gold/20 border-t-icg-gold animate-spin" />
                                        <span className="text-[10px] font-black text-icg-muted tracking-widest">تحميل الصورة...</span>
                                    </div>
                                </div>
                            )}

                            {/* عد تنازلي يغطي الصورة تماماً */}
                            {phase === 'COUNTDOWN' && (
                                <div className="absolute inset-0 z-30 grid place-items-center bg-icg-ink/88 backdrop-blur-2xl">
                                    <div className="flex flex-col items-center gap-3">
                                        <span className="text-[10px] font-black text-icg-muted tracking-[0.5em]">استعد</span>
                                        <span key={countdown} className="bl-pop text-8xl md:text-9xl font-black italic leading-none" style={{ color: GOLD, textShadow: `0 0 60px ${GOLD}66` }}>
                                            {countdown > 0 ? countdown : 'ابدأ'}
                                        </span>
                                        <span className="text-[11px] font-black text-icg-cream/70">{lettersCount} حرفاً في الكلمة</span>
                                    </div>
                                </div>
                            )}

                            {phase === 'PLAYING' && (
                                <div className="absolute top-4 inset-x-0 flex justify-center px-4 pointer-events-none z-20">
                                    <div className="px-6 py-2 rounded-full font-black italic text-sm md:text-base border-t-2 border-white/15" style={{ background: `${EMBER}e6`, color: '#fff', boxShadow: `0 14px 34px ${EMBER}55` }}>
                                        اكتب الكلمة في الشات
                                    </div>
                                </div>
                            )}

                            {phase === 'PLAYING' && adminReveal && (
                                <div className="absolute bottom-4 inset-x-0 flex justify-center px-4 z-20 pointer-events-none">
                                    <span className="px-4 py-1.5 rounded-full bg-icg-ink/85 border border-icg-gold/30 text-[11px] font-black text-icg-gold">{entry?.ar}</span>
                                </div>
                            )}

                            {phase === 'PLAYING' && recent.length > 0 && (
                                <div className="absolute bottom-3 left-3 z-20 hidden md:block max-w-[240px] rounded-2xl bg-icg-ink/70 backdrop-blur-xl border border-icg-gold/12 px-3 py-2">
                                    <p className="text-[8px] font-black text-icg-muted tracking-widest mb-1">آخر التخمينات</p>
                                    <div className="space-y-0.5">
                                        {recent.slice(0, 3).map((g, i) => (
                                            <p key={i} className="text-[10px] font-bold truncate">
                                                <span style={{ color: g.color || CREAM }}>{g.user}</span>
                                                <span className="text-icg-muted/60">: </span>
                                                <span className="text-icg-cream/70">{g.text}</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {phase === 'WINNER' && photos[photoIndex]?.photographer && (
                                <p className="absolute bottom-3 left-3 z-20 text-[9px] font-bold text-icg-muted/70">
                                    📷 {photos[photoIndex].photographer} · Pexels
                                </p>
                            )}
                        </div>

                        {/* لوحة المشرف الحية: تغبيش ثابت + زوم أون */}
                        {!isOBS && (phase === 'PLAYING' || phase === 'COUNTDOWN') && (
                            <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-icg-gold/15 bg-icg-ink/80 backdrop-blur-2xl px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1 text-[9px] font-black text-icg-muted tracking-widest"><Eye size={11} /> تغبيش</span>
                                    <div className="flex items-center gap-1">
                                        {(['auto', 'fixed'] as const).map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setBlurMode(m)}
                                                className="px-2.5 py-1 rounded-lg text-[9px] font-black transition-all"
                                                style={{
                                                    background: blurMode === m ? `${m === 'fixed' ? EMBER : GOLD}26` : 'rgba(255,255,255,0.04)',
                                                    border: `1px solid ${blurMode === m ? `${m === 'fixed' ? EMBER : GOLD}88` : 'rgba(255,255,255,0.1)'}`,
                                                    color: blurMode === m ? (m === 'fixed' ? EMBER : GOLD) : '#b2a283',
                                                }}
                                            >
                                                {m === 'auto' ? 'تلقائي' : 'ثابت'}
                                            </button>
                                        ))}
                                    </div>
                                    {blurMode === 'fixed' && (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="range" min={5} max={100} step={5} value={fixedBlur}
                                                onChange={e => setFixedBlur(Number(e.target.value))}
                                                className="w-24 accent-[#e8be6e]"
                                            />
                                            <span className="text-[10px] font-black text-icg-gold tabular-nums w-9">{fixedBlur}%</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setZoomOn(v => !v)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black transition-all"
                                        style={{
                                            background: zoomOn ? `${GOLD}2e` : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${zoomOn ? `${GOLD}` : 'rgba(255,255,255,0.12)'}`,
                                            color: zoomOn ? GOLD : '#b2a283',
                                            boxShadow: zoomOn ? `0 0 16px ${GOLD}44` : 'none',
                                        }}
                                    >
                                        <ZoomIn size={12} /> زوم أون
                                    </button>
                                    {zoomOn && (
                                        <>
                                            <ZoomPad cell={zoomCell} onChange={setZoomCell} compact />
                                            <div className="flex items-center gap-1">
                                                {[1.6, 2.2, 3].map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setZoomScale(s)}
                                                        className="px-1.5 py-0.5 rounded-lg text-[9px] font-black transition-all"
                                                        style={{
                                                            background: zoomScale === s ? `${GOLD}2e` : 'rgba(255,255,255,0.04)',
                                                            border: `1px solid ${zoomScale === s ? `${GOLD}88` : 'rgba(255,255,255,0.1)'}`,
                                                            color: zoomScale === s ? GOLD : '#b2a283',
                                                        }}
                                                    >
                                                        {s}×
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* شريط الوضوح */}
                        <div className="w-full max-w-5xl h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${clarity}%`, background: `linear-gradient(90deg, ${EMBER}, ${GOLD})` }} />
                        </div>

                        {/* تلميح + حروف */}
                        {phase === 'PLAYING' && (
                            <div className="w-full max-w-5xl flex flex-col items-center gap-3">
                                {showHint && entry && (
                                    <div className="bl-pop flex items-center gap-2 px-4 py-2 rounded-2xl border" style={{ background: `${LIVE}12`, borderColor: `${LIVE}33` }}>
                                        <Lightbulb size={15} style={{ color: LIVE }} />
                                        <span className="text-[12px] font-black" style={{ color: LIVE }}>{entry.hint}</span>
                                    </div>
                                )}
                                {showPattern && entry && <LetterBoard word={entry.ar} open={false} accent={GOLD} />}
                            </div>
                        )}

                        {/* ---------- الفائز ---------- */}
                        {phase === 'WINNER' && winner && entry && (
                            <div className="w-full max-w-5xl flex flex-col items-center gap-4 bl-pop">
                                <p className="text-4xl md:text-6xl font-black italic tracking-tighter leading-none bl-title">{entry.ar}</p>
                                <div className="relative w-full flex flex-col md:flex-row items-center justify-center gap-4">
                                    <div className="relative rounded-[1.75rem] border px-6 py-4 bg-icg-espresso/70 backdrop-blur-xl flex items-center gap-4" style={{ borderColor: `${GOLD}44`, boxShadow: `0 20px 60px ${GOLD}22` }}>
                                        <span className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                                        <ProAvatar url={winner.avatar} username={winner.name} size="w-16 h-16" className="shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-black tracking-[0.35em]" style={{ color: GOLD }}>الفائز</p>
                                            <p className="text-2xl md:text-3xl font-black italic text-icg-cream leading-tight truncate">{winner.name}</p>
                                            <p className="text-[10px] font-bold text-icg-muted mt-0.5">بعد {winner.seconds} ثانية من بداية الجولة</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-center">
                                        <span className="px-3.5 py-2 rounded-2xl bg-icg-gold/10 border border-icg-gold/25 text-[11px] font-black text-icg-cream tabular-nums">أساس {winner.base}</span>
                                        <span className="px-3.5 py-2 rounded-2xl border text-[11px] font-black tabular-nums" style={{ background: `${LIVE}14`, borderColor: `${LIVE}33`, color: LIVE }}>سرعة +{winner.bonus}</span>
                                        {winner.penalty > 0 && (
                                            <span className="px-3.5 py-2 rounded-2xl border text-[11px] font-black tabular-nums" style={{ background: `${EMBER}14`, borderColor: `${EMBER}33`, color: EMBER }}>تلميح -{winner.penalty}</span>
                                        )}
                                        <span className="px-4 py-2 rounded-2xl text-[14px] font-black italic tabular-nums text-icg-espresso" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})` }}>
                                            {winner.points} نقطة
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap justify-center">
                                    <button onClick={() => { void newRound(); }} className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-icg-espresso transition-all hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 12px 34px rgba(232,190,110,0.28)' }}>
                                        <RotateCcw size={16} /> جولة جديدة
                                    </button>
                                    <button onClick={() => { void newRound('random', 0); }} className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[13px] text-icg-cream bg-icg-gold/10 border border-icg-gold/20 hover:bg-icg-gold/20 transition-all active:scale-95">
                                        <Shuffle size={15} /> عشوائي تماماً
                                    </button>
                                    {!isOBS && (
                                        <button onClick={onHome} className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[13px] text-icg-muted bg-white/5 border border-white/10 hover:text-icg-cream transition-all active:scale-95">
                                            <Home size={15} /> خروج
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <style>{BLUR_STYLES}</style>
            </div>
        </>
    );
};

const BLUR_STYLES = `
    .bl-root { background: #0a0805; }
    .bl-wash { background: radial-gradient(58% 46% at 80% 14%, rgba(232,190,110,0.15), transparent 68%), radial-gradient(52% 44% at 10% 90%, rgba(169,122,48,0.15), transparent 70%), linear-gradient(180deg, #0d0a06 0%, #0a0805 58%, #12100a 100%); }
    .bl-grid { background: linear-gradient(rgba(232,190,110,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(232,190,110,0.045) 1px, transparent 1px); background-size: 52px 52px; -webkit-mask: radial-gradient(72% 72% at 50% 45%, #000, transparent); mask: radial-gradient(72% 72% at 50% 45%, #000, transparent); }
    .bl-title { background: linear-gradient(180deg, #fff7de 0%, #e8be6e 55%, #a97a30 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
    .bl-pop { animation: bl-pop 0.5s cubic-bezier(0.2, 1.2, 0.3, 1); }
    @keyframes bl-pop { 0% { transform: scale(0.72); opacity: 0; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
    .bl-root .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .bl-root .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .bl-root .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(232,190,110,0.22); border-radius: 10px; }
    .bl-root .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(232,190,110,0.45); }
`;
