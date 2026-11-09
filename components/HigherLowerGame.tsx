import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { supabase } from '../services/supabase';
import { awardPoints } from '../services/points';
import { chatService } from '../services/chatService';
import {
    ArrowUp, ArrowDown, Trophy, Crown, Star, Flame, Skull, Gem, Home, Play,
    RotateCcw, SkipForward, Zap, Volume2, Users, Lightbulb, CheckCircle2,
    Shuffle, Timer, Sparkles, LogOut, Award,
} from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import {
    HL_TIERS, HL_STAGES, questionsForStage, tierFor,
    HL_TOTAL_QUESTIONS, HL_QUESTIONS_PER_STAGE,
    type HLQuestion, type TierMeta,
} from '../data/higherLowerBank';

interface HigherLowerGameProps {
    onHome: () => void;
    isOBS?: boolean;
}

interface LoadedQuestion extends HLQuestion {
    key: string;
    fromAdmin: boolean;
}

interface ScoreRow {
    username: string;
    display: string;
    avatar: string;
    points: number;
    correct: number;
    rounds: number;
}

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
    const el = document.getElementById('game-sidebar-portal');
    if (!mounted || !el) return null;
    return createPortal(children, el);
};

const GOLD = '#e8be6e';
const EMBER = '#e8552f';

const TIMER_CHOICES = [10, 15, 20, 30, 45];
const REVEAL_SECONDS = 10;

const TIER_ICON: Record<string, React.ElementType> = {
    easy: Star, medium: Trophy, hard: Flame, brutal: Skull, legend: Gem,
};

/** هل جدول أسئلة الأدمن متاح؟ يُحدَّد من أول محاولة فقط لتفادي طلبات فاشلة متكررة */
let adminTableAvailable: boolean | null = null;

/**
 * توحيد شكل النص: يحذف التشكيل والرموز، ويوحّد الهمزات والألف المقصورة
 * والتاء المربوطة — لذلك "أعلى / اعلى / اعلا / اعلة" كلها تصبح نفس الشكل.
 */
const canon = (s: string) => s
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^ؠ-ي٠-٩A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normText = canon;

const ARROW_HIGHER = ['↑', '▲', '⬆', '🔼', '⤴'];
const ARROW_LOWER = ['↓', '▼', '⬇', '🔽', '⤵'];
const HIGHER_FORMS = new Set(
    ['أعلى', 'الأعلى', 'اعلي', 'فوق', 'هاير', 'higher', 'up'].map(canon),
);
const LOWER_FORMS = new Set(
    ['أقل', 'الأقل', 'اسفل', 'الأسفل', 'تحت', 'نزل', 'lower', 'down'].map(canon),
);

const stripArticle = (t: string) => (t.length > 4 && t.startsWith('ال') ? t.slice(2) : t);

const readVote = (raw: string): 'higher' | 'lower' | null => {
    const text = raw || '';
    if (ARROW_HIGHER.some(a => text.includes(a))) return 'higher';
    if (ARROW_LOWER.some(a => text.includes(a))) return 'lower';

    for (const token of canon(text).split(' ')) {
        if (!token) continue;
        const t = stripArticle(token);
        if (HIGHER_FORMS.has(t) || /^اعل[يهاء]?$/.test(t)) return 'higher';
        if (LOWER_FORMS.has(t) || /^اقل[يهاءل]?$/.test(t)) return 'lower';
    }
    return null;
};

/** صورة العضو المحفوظة محلياً — الشات لا يرسل الصورة دائماً مع كل رسالة */
const cachedAvatar = (username: string): string => {
    try {
        return localStorage.getItem(`av_${username}`) || localStorage.getItem(`kick_av_${username}`) || '';
    } catch {
        return '';
    }
};

const shuffleArr = <T,>(arr: T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const NumberedText: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(\d[\d.,]*)/g);
    return (
        <>
            {parts.map((part, i) => (
                /^\d/.test(part)
                    ? <span key={i} className="hl-num">{part}</span>
                    : <React.Fragment key={i}>{part}</React.Fragment>
            ))}
        </>
    );
};

// ==========================================
// حلقة المؤقت (SVG)
// ==========================================
const TimerRing: React.FC<{
    left: number;
    total: number;
    size?: number;
    color: string;
    label?: string;
    pulse?: boolean;
}> = ({ left, total, size = 96, color, label, pulse }) => {
    const stroke = 7;
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, left / total));
    return (
        <div className={`relative shrink-0 ${pulse ? 'animate-pulse' : ''}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(232,190,110,0.12)" strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - ratio)}
                    style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 8px ${color}88)` }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-black leading-none tabular-nums" style={{ color, fontSize: size * 0.32 }}>{Math.max(0, Math.ceil(left))}</span>
                {label && <span className="text-[9px] font-black text-icg-muted tracking-widest mt-0.5">{label}</span>}
            </div>
        </div>
    );
};

// ==========================================
// المكوّن الرئيسي
// ==========================================
export const HigherLowerGame: React.FC<HigherLowerGameProps> = ({ onHome, isOBS = false }) => {
    const [gameState, setGameState] = useState<'stage_select' | 'playing' | 'stage_complete'>('stage_select');
    const [selectedStage, setSelectedStage] = useState<number | null>(null);
    const [questions, setQuestions] = useState<LoadedQuestion[]>([]);
    const [index, setIndex] = useState(0);

    // إعدادات البث
    const [roundSeconds, setRoundSeconds] = useState(20);
    const [autoNext, setAutoNext] = useState(true);
    const [soundOn, setSoundOn] = useState(true);
    const [doShuffle, setDoShuffle] = useState(false);

    // حالة الجولة
    const [timeLeft, setTimeLeft] = useState(20);
    const [voting, setVoting] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [revealLeft, setRevealLeft] = useState(REVEAL_SECONDS);
    const [higherVotes, setHigherVotes] = useState<Set<string>>(new Set());
    const [lowerVotes, setLowerVotes] = useState<Set<string>>(new Set());
    const [voters, setVoters] = useState<Record<string, { avatar: string; display: string }>>({});
    const [winners, setWinners] = useState<ScoreRow[]>([]);
    const [scores, setScores] = useState<Record<string, ScoreRow>>({});
    const [adminCount, setAdminCount] = useState(0);

    const higherRef = useRef<Set<string>>(new Set());
    const lowerRef = useRef<Set<string>>(new Set());
    const votersRef = useRef<Record<string, { avatar: string; display: string }>>({});
    const resolvingRef = useRef(false);
    const votingRef = useRef(false);
    const revealedRef = useRef(false);
    const questionsRef = useRef<LoadedQuestion[]>([]);
    const indexRef = useRef(0);
    const questionRef = useRef<LoadedQuestion | null>(null);
    const tierRef = useRef<TierMeta>(HL_TIERS[0]);
    const stageRef = useRef<number | null>(null);
    const scoresRef = useRef<Record<string, ScoreRow>>({});
    const soundRef = useRef(true);
    const audioRef = useRef<AudioContext | null>(null);

    useEffect(() => { votingRef.current = voting; }, [voting]);
    useEffect(() => { revealedRef.current = revealed; }, [revealed]);
    useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

    const currentQ = questions[index] || null;
    useEffect(() => { questionRef.current = currentQ; }, [currentQ]);
    const tier = useMemo(() => (selectedStage ? tierFor(selectedStage) : HL_TIERS[0]), [selectedStage]);
    useEffect(() => { tierRef.current = tier; }, [tier]);

    const totalVotes = higherVotes.size + lowerVotes.size;
    const higherPct = totalVotes === 0 ? 50 : Math.round((higherVotes.size / totalVotes) * 100);
    const lowerPct = totalVotes === 0 ? 50 : 100 - higherPct;

    const scoreRows = useMemo<ScoreRow[]>(
        () => Object.values(scores).sort((a, b) => b.points - a.points || b.correct - a.correct),
        [scores],
    );
    const stagePoints = useMemo(() => scoreRows.reduce((sum, r) => sum + r.points, 0), [scoreRows]);

    // ---------- الصوت ----------
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

    // ---------- أسئلة الأدمن (Supabase) كإضافات فوق بنك الأسئلة ----------
    const clearVotes = useCallback(() => {
        higherRef.current = new Set();
        lowerRef.current = new Set();
        votersRef.current = {};
        setHigherVotes(new Set());
        setLowerVotes(new Set());
        setVoters({});
    }, []);

    const beginRound = useCallback(() => {
        clearVotes();
        resolvingRef.current = false;
        setWinners([]);
        setRevealed(false);
        revealedRef.current = false;
        setTimeLeft(roundSeconds);
        setVoting(true);
        votingRef.current = true;
    }, [clearVotes, roundSeconds]);

    const startStage = useCallback((stage: number) => {
        const base: LoadedQuestion[] = questionsForStage(stage)
            .map((q, i) => ({ ...q, key: `bank-${stage}-${i}`, fromAdmin: false }));
        const initial = doShuffle ? shuffleArr(base) : base;

        stageRef.current = stage;
        setSelectedStage(stage);
        setIndex(0);
        indexRef.current = 0;
        setQuestions(initial);
        questionsRef.current = initial;
        setScores({});
        scoresRef.current = {};
        setAdminCount(0);
        setGameState('playing');
        beginRound();

        // أسئلة الأدمن الإضافية لنفس المرحلة تُضاف بعد بنك الأسئلة المحلي
        if (adminTableAvailable === false) return;
        void (async () => {
            try {
                const { data, error } = await supabase
                    .from('higher_lower_questions')
                    .select('*')
                    .eq('stage_number', stage)
                    .order('id', { ascending: true });
                if (error) {
                    adminTableAvailable = false;
                    return;
                }
                adminTableAvailable = true;
                if (stageRef.current !== stage || !data?.length) return;
                const bankKeys = new Set(initial.map(q => normText(q.text)));
                const extras: LoadedQuestion[] = data
                    .filter(row => row.question_text && !bankKeys.has(normText(row.question_text)))
                    .map((row, i) => ({
                        key: `db-${row.id ?? i}`,
                        text: row.question_text,
                        isHigher: !!row.is_higher,
                        fact: row.fact || '',
                        fromAdmin: true,
                    }));
                if (!extras.length) return;
                const merged = [...questionsRef.current, ...extras];
                questionsRef.current = merged;
                setQuestions(merged);
                setAdminCount(extras.length);
            } catch {
                adminTableAvailable = false;
            }
        })();
    }, [beginRound, doShuffle]);

    const backToStages = useCallback(() => {
        setGameState('stage_select');
        setVoting(false);
        votingRef.current = false;
        setRevealed(false);
        revealedRef.current = false;
        setSelectedStage(null);
        stageRef.current = null;
        setQuestions([]);
        questionsRef.current = [];
        setIndex(0);
        indexRef.current = 0;
        setWinners([]);
        clearVotes();
    }, [clearVotes]);

    const resolveRound = useCallback(async () => {
        if (resolvingRef.current) return;
        resolvingRef.current = true;

        const q = questionRef.current;
        if (!q) return;

        const meta = tierRef.current;
        const correctSet = q.isHigher ? higherRef.current : lowerRef.current;

        const rows: ScoreRow[] = Array.from(correctSet).map(username => ({
            username,
            display: votersRef.current[username]?.display || username,
            avatar: votersRef.current[username]?.avatar || cachedAvatar(username),
            points: meta.points,
            correct: 1,
            rounds: 1,
        }));

        setWinners(rows);
        setScores(prev => {
            const next = { ...prev };
            rows.forEach(row => {
                const existing = next[row.username];
                next[row.username] = existing
                    ? { ...existing, points: existing.points + row.points, correct: existing.correct + 1, rounds: existing.rounds + 1, avatar: row.avatar || existing.avatar }
                    : { ...row };
            });
            scoresRef.current = next;
            return next;
        });

        rows.forEach(row => {
            awardPoints('HIGHER_LOWER', row.username, row.avatar, 'round', meta.points / 10);
        });

        setVoting(false);
        votingRef.current = false;
        setRevealed(true);
        revealedRef.current = true;
        setRevealLeft(REVEAL_SECONDS);
        tone(q.isHigher ? 720 : 420, 0.28, 'triangle', 0.09);
    }, [tone]);

    const nextQuestion = useCallback(() => {
        const next = indexRef.current + 1;
        if (questionsRef.current.length === 0 || next >= questionsRef.current.length) {
            setVoting(false);
            votingRef.current = false;
            setGameState('stage_complete');
            return;
        }
        indexRef.current = next;
        setIndex(next);
        beginRound();
    }, [beginRound]);

    // ---------- المؤقت ----------
    useEffect(() => {
        if (gameState !== 'playing' || !voting) return;
        if (timeLeft > 0) {
            if (timeLeft <= 3) tone(880, 0.06, 'square', 0.03);
            const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(t);
        }
        void resolveRound();
    }, [gameState, voting, timeLeft, resolveRound, tone]);

    useEffect(() => {
        if (gameState !== 'playing' || !revealed || !autoNext) return;
        if (revealLeft > 0) {
            const t = setTimeout(() => setRevealLeft(prev => prev - 1), 1000);
            return () => clearTimeout(t);
        }
        nextQuestion();
    }, [gameState, revealed, autoNext, revealLeft, nextQuestion]);

    // ---------- تصويت الشات ----------
    useEffect(() => {
        const unsubscribe = chatService.onMessage((msg) => {
            if (!votingRef.current) return;
            const username = (msg.user?.username || '').toLowerCase().trim();
            if (!username) return;
            if (higherRef.current.has(username) || lowerRef.current.has(username)) return;

            const vote = readVote(msg.content || '');
            if (!vote) return;

            const entry = { avatar: msg.user?.avatar || cachedAvatar(username), display: msg.user?.username || username };
            votersRef.current = { ...votersRef.current, [username]: entry };
            if (vote === 'higher') higherRef.current = new Set(higherRef.current).add(username);
            else lowerRef.current = new Set(lowerRef.current).add(username);

            setVoters({ ...votersRef.current });
            setHigherVotes(new Set(higherRef.current));
            setLowerVotes(new Set(lowerRef.current));
            tone(vote === 'higher' ? 620 : 340, 0.06, 'sine', 0.03);

            // صور الأعضاء لا تصل دائماً مع رسالة الشات — تُجلب من كيك وتُحدَّث في القائمة
            if (!entry.avatar) {
                void chatService.fetchKickAvatar(username).then((live) => {
                    const current = votersRef.current[username];
                    if (!live || !current || current.avatar) return;
                    votersRef.current = {
                        ...votersRef.current,
                        [username]: { ...current, avatar: live },
                    };
                    setVoters({ ...votersRef.current });
                    setScores(prev => {
                        const row = prev[username];
                        if (!row || row.avatar === live) return prev;
                        return { ...prev, [username]: { ...row, avatar: live } };
                    });
                });
            }
        });
        return () => unsubscribe();
    }, [tone]);

    // ---------- احتفال نهاية المرحلة ----------
    useEffect(() => {
        if (gameState !== 'stage_complete') return;
        tone(560, 0.5, 'triangle', 0.1);
        setTimeout(() => tone(840, 0.6, 'triangle', 0.08), 180);
        try {
            confetti({ particleCount: 120, spread: 75, origin: { y: 0.45 }, colors: [GOLD, '#fbeccb', EMBER] });
        } catch { /* تجاهل */ }
    }, [gameState, tone]);

    const randomStage = () => startStage(HL_STAGES[Math.floor(Math.random() * HL_STAGES.length)]);
    const goNextStage = () => {
        const next = (selectedStage ?? 0) + 1;
        if (HL_STAGES.includes(next)) startStage(next);
        else backToStages();
    };

    // ==========================================
    // شاشة اختيار المراحل
    // ==========================================
    if (gameState === 'stage_select') {
        return (
            <div className="hl-root relative flex-1 w-full h-full flex flex-col overflow-hidden" dir="rtl">
                <div className="hl-wash absolute inset-0 pointer-events-none" />
                <div className="hl-grid absolute inset-0 pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between gap-4 px-5 py-3.5 border-b border-icg-gold/10 bg-icg-ink/70 backdrop-blur-xl shrink-0">
                    <div className="absolute bottom-0 left-1/4 right-1/4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}77, transparent)` }} />
                    <div className="flex items-center gap-3.5 min-w-0">
                        {!isOBS && (
                            <button onClick={onHome} className="shrink-0 p-2.5 rounded-xl bg-icg-gold/10 border border-icg-gold/20 text-icg-cream hover:bg-icg-ember/20 hover:border-icg-ember/40 transition-all active:scale-90">
                                <Home size={18} />
                            </button>
                        )}
                        <div className="min-w-0">
                            <h1 className="hl-title text-2xl md:text-3xl font-black italic tracking-tighter leading-none whitespace-nowrap">أعلى أم أقل</h1>
                            <p className="text-[9px] font-black text-icg-muted/70 tracking-[0.45em] mt-1.5 whitespace-nowrap">HIGHER OR LOWER</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="px-3 py-1.5 rounded-full bg-icg-gold/10 border border-icg-gold/20 text-[11px] font-black text-icg-cream tabular-nums">
                            {HL_STAGES.length} مرحلة
                        </span>
                        <span className="px-3 py-1.5 rounded-full bg-icg-gold/10 border border-icg-gold/20 text-[11px] font-black text-icg-cream tabular-nums">
                            {HL_TOTAL_QUESTIONS} سؤال
                        </span>
                        <span className="px-3 py-1.5 rounded-full bg-icg-gold/10 border border-icg-gold/20 text-[11px] font-black text-icg-cream tabular-nums">
                            {HL_QUESTIONS_PER_STAGE} لكل مرحلة
                        </span>
                    </div>
                </div>

                <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-5">
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="rounded-[1.75rem] border border-icg-gold/12 bg-icg-espresso/50 backdrop-blur-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="shrink-0 w-11 h-11 rounded-2xl grid place-items-center bg-icg-gold/10 border border-icg-gold/25">
                                    <Zap size={20} className="text-icg-gold" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-icg-cream leading-none">كيف تلعب؟</p>
                                    <p className="text-[11px] font-bold text-icg-muted mt-1.5">جاوب: الرقم الصحيح أعلى ولا أقل من الرقم المعروض</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: 'rgba(232,190,110,0.12)', color: GOLD }}>اكتب «أعلى»</span>
                                <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: 'rgba(232,85,47,0.12)', color: EMBER }}>اكتب «أقل»</span>
                                <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-black text-icg-muted">كلما صعبت المرحلة زادت النقاط</span>
                            </div>
                        </div>

                        {HL_TIERS.map((t) => {
                            const Icon = TIER_ICON[t.id] || Trophy;
                            const stages = HL_STAGES.filter(s => s >= t.from && s <= t.to);
                            return (
                                <section key={t.id} className="rounded-[1.75rem] border bg-icg-espresso/60 backdrop-blur-xl p-4" style={{ borderColor: `${t.hex}22` }}>
                                    <header className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${t.hex}1f`, border: `1px solid ${t.hex}44` }}>
                                                <Icon size={18} style={{ color: t.hex }} />
                                            </span>
                                            <div>
                                                <p className="font-black text-sm leading-none" style={{ color: t.hex }}>{t.label}</p>
                                                <p className="text-[10px] font-bold text-icg-muted mt-1">{t.hint}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-icg-muted">مرحلة {t.from} - {t.to}</span>
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black" style={{ background: `${t.hex}18`, color: t.hex }}>
                                                {t.points} نقطة / إجابة
                                            </span>
                                        </div>
                                    </header>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                                        {stages.map(stage => (
                                            <button
                                                key={stage}
                                                onClick={() => startStage(stage)}
                                                className="group relative overflow-hidden rounded-2xl py-5 px-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.05] active:scale-95"
                                                style={{ background: `${t.hex}0d`, border: `1px solid ${t.hex}2e` }}
                                            >
                                                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(60% 80% at 50% 100%, ${t.hex}33, transparent 70%)` }} />
                                                <span className="relative font-black italic text-2xl leading-none" style={{ color: t.hex }}>{stage}</span>
                                                <span className="relative text-[10px] font-black text-icg-cream/70 tracking-widest">مرحلة</span>
                                                <span className="relative text-[9px] font-bold text-icg-muted">{HL_QUESTIONS_PER_STAGE} أسئلة</span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}

                        <div className="flex items-center justify-center gap-3 pb-6 flex-wrap">
                            <button onClick={randomStage} className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-icg-espresso transition-all hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 12px 34px rgba(232,190,110,0.28)' }}>
                                <Sparkles size={16} /> مرحلة عشوائية
                            </button>
                            <p className="text-[11px] font-bold text-icg-muted">
                                اكتب <span className="text-icg-gold">أعلى</span> أو <span style={{ color: EMBER }}>أقل</span> في الشات للتصويت
                            </p>
                        </div>
                    </div>
                </div>

                <style>{HL_STYLES}</style>
            </div>
        );
    }

    // ==========================================
    // شاشة انتهاء المرحلة
    // ==========================================
    if (gameState === 'stage_complete') {
        const Icon = TIER_ICON[tier.id] || Trophy;
        return (
            <div className="hl-root relative flex-1 w-full h-full flex flex-col items-center justify-center overflow-hidden px-6" dir="rtl">
                <div className="hl-wash absolute inset-0 pointer-events-none" />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(60% 60% at 50% 50%, ${tier.hex}22, transparent 70%)` }} />

                <div className="relative z-10 w-full max-w-3xl flex flex-col items-center">
                    <div className="w-28 h-28 rounded-full flex items-center justify-center mb-5" style={{ background: `${tier.hex}1a`, border: `2px solid ${tier.hex}66`, boxShadow: `0 0 60px ${tier.hex}55` }}>
                        <Icon size={58} style={{ color: tier.hex }} className="animate-bounce" />
                    </div>
                    <h2 className="hl-title text-5xl md:text-6xl font-black italic tracking-tighter leading-none mb-3">اكتملت المرحلة {selectedStage}</h2>
                    <p className="text-sm font-black tracking-widest mb-1" style={{ color: tier.hex }}>
                        مستوى {tier.label.replace(/­|ـ/g, '')} · {questions.length} سؤال · {tier.points} نقطة لكل إجابة
                    </p>
                    <p className="text-[11px] font-bold text-icg-muted mb-6">
                        {scoreRows.length} مشارك · {stagePoints} نقطة ممنوحة في هذه المرحلة
                    </p>

                    <div className="w-full rounded-[1.75rem] border border-icg-gold/15 bg-icg-espresso/70 backdrop-blur-xl overflow-hidden mb-6">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-icg-gold/10 bg-icg-gold/5">
                            <span className="flex items-center gap-2 text-[11px] font-black text-icg-cream tracking-widest"><Award size={15} className="text-icg-gold" /> أبطال المرحلة</span>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black text-icg-espresso" style={{ background: GOLD }}>{scoreRows.length}</span>
                        </div>
                        <div className="max-h-56 overflow-y-auto custom-scrollbar p-2.5 space-y-2.5">
                            {scoreRows.slice(0, 12).map((row, i) => (
                                <div key={row.username} className="flex items-center justify-between gap-3 px-3 py-3 rounded-2xl bg-icg-gold/5 border border-icg-gold/10">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`min-w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${i === 0 ? 'text-icg-espresso' : 'text-icg-muted'}`} style={i === 0 ? { background: GOLD } : { background: 'rgba(232,190,110,0.12)' }}>
                                            #{i + 1}
                                        </span>
                                        <ProAvatar url={row.avatar} username={row.username} size="w-10 h-10" className="overflow-visible" />
                                        <span className="text-[12px] font-bold text-icg-cream truncate">{row.display}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-black text-icg-muted">{row.correct} صحيحة</span>
                                        <span className="text-sm font-black italic" style={{ color: GOLD }}>{row.points}</span>
                                    </div>
                                </div>
                            ))}
                            {scoreRows.length === 0 && (
                                <div className="py-8 flex flex-col items-center justify-center text-icg-muted/50">
                                    <Users size={22} className="mb-2" />
                                    <span className="text-[11px] font-black">ما أحد جاوب صح في هذه المرحلة</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-center">
                        <button onClick={goNextStage} className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-black text-base text-icg-espresso transition-all hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 12px 34px rgba(232,190,110,0.3)' }}>
                            <Play size={18} fill="currentColor" /> المرحلة التالية
                        </button>
                        <button onClick={backToStages} className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-black text-base text-icg-cream bg-icg-gold/10 border border-icg-gold/25 hover:bg-icg-gold/20 transition-all active:scale-95">
                            <Home size={18} /> كل المراحل
                        </button>
                    </div>
                </div>
                <style>{HL_STYLES}</style>
            </div>
        );
    }

    // ==========================================
    // شاشة اللعب
    // ==========================================
    const isLast = questions.length > 0 && index + 1 >= questions.length;

    return (
        <div className="hl-root relative flex-1 w-full h-full flex flex-col items-center overflow-hidden" dir="rtl">
            <div className="hl-wash absolute inset-0 pointer-events-none" />
            <div className="hl-grid absolute inset-0 pointer-events-none" />

            <SidebarPortal>
                <div className="bg-icg-ink/85 backdrop-blur-2xl rounded-[1.5rem] border border-icg-gold/12 p-3.5 space-y-3 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                    <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-[12px] font-black text-icg-cream tracking-widest">
                            <Timer size={15} style={{ color: tier.hex }} /> تحكم المرحلة
                        </h4>
                        <button onClick={onHome} className="p-2 rounded-xl bg-icg-gold/5 text-icg-muted hover:text-icg-ember hover:bg-icg-ember/15 border border-icg-gold/10 transition-all">
                            <LogOut size={14} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2" style={{ background: `${tier.hex}12`, border: `1px solid ${tier.hex}33` }}>
                        <span className="text-[11px] font-black" style={{ color: tier.hex }}>{tier.label}</span>
                        <span className="text-[10px] font-bold text-icg-muted">مرحلة {selectedStage} · {tier.points} نقطة</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {voting ? (
                            <button onClick={() => void resolveRound()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black text-icg-espresso transition-all active:scale-95" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})` }}>
                                <CheckCircle2 size={13} /> اكشف الإجابة
                            </button>
                        ) : (
                            <button onClick={beginRound} className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black transition-all active:scale-95 border border-icg-gold/25 text-icg-cream bg-icg-gold/10 hover:bg-icg-gold/20">
                                <RotateCcw size={13} /> جولة تصويت
                            </button>
                        )}
                        <button onClick={nextQuestion} className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black text-icg-cream bg-icg-ember/15 border border-icg-ember/30 hover:bg-icg-ember/25 transition-all active:scale-95">
                            <SkipForward size={13} /> تخطي السؤال
                        </button>
                        <button onClick={() => startStage(HL_STAGES[Math.floor(Math.random() * HL_STAGES.length)])} className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black text-icg-cream bg-icg-gold/5 border border-icg-gold/15 hover:bg-icg-gold/15 transition-all active:scale-95">
                            <Sparkles size={13} /> مرحلة عشوائية
                        </button>
                        <button onClick={backToStages} className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black text-icg-muted bg-white/5 border border-icg-gold/10 hover:text-icg-cream transition-all active:scale-95">
                            <Home size={13} /> كل المراحل
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-[9px] font-black text-icg-muted tracking-widest px-1">مدة السؤال</p>
                        <div className="grid grid-cols-5 gap-1.5">
                            {TIMER_CHOICES.map(sec => (
                                <button
                                    key={sec}
                                    onClick={() => { setRoundSeconds(sec); if (voting) setTimeLeft(sec); }}
                                    className={`py-1.5 rounded-xl text-[10px] font-black transition-all ${roundSeconds === sec ? 'text-icg-espresso' : 'text-icg-muted bg-icg-gold/5 border border-icg-gold/10 hover:text-icg-cream'}`}
                                    style={roundSeconds === sec ? { background: GOLD } : undefined}
                                >
                                    {sec}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {[
                            { label: 'التالي تلقائياً', value: autoNext, set: () => setAutoNext(v => !v), color: GOLD, icon: Zap },
                            { label: 'أصوات اللعبة', value: soundOn, set: () => setSoundOn(v => !v), color: GOLD, icon: Volume2 },
                            { label: 'خلط الأسئلة (للمرحلة القادمة)', value: doShuffle, set: () => setDoShuffle(v => !v), color: EMBER, icon: Shuffle },
                        ].map(toggle => (
                            <div key={toggle.label} className="flex items-center justify-between px-3 py-2 rounded-2xl bg-icg-gold/5 border border-icg-gold/10">
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-icg-cream/80">
                                    <toggle.icon size={12} style={{ color: toggle.value ? toggle.color : undefined }} />
                                    {toggle.label}
                                </span>
                                <button onClick={toggle.set} className="w-9 h-5 rounded-full relative transition-colors" style={{ background: toggle.value ? toggle.color : 'rgba(232,190,110,0.15)' }}>
                                    <span className="absolute top-1 left-1 w-3 h-3 rounded-full bg-icg-ink transition-transform" style={{ transform: toggle.value ? 'translateX(16px)' : 'none' }} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-icg-ink/85 backdrop-blur-2xl rounded-[1.5rem] border border-icg-gold/12 mt-3 flex flex-col overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-icg-gold/10 bg-icg-gold/5">
                        <span className="flex items-center gap-2 text-[11px] font-black text-icg-cream tracking-widest"><Award size={14} className="text-icg-gold" /> نقاط المرحلة</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-icg-espresso" style={{ background: GOLD }}>{scoreRows.length}</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-2.5 space-y-3">
                        {scoreRows.slice(0, 15).map((row, i) => (
                            <div key={row.username} className="flex items-center justify-between gap-2 px-2 py-2.5 rounded-xl bg-icg-gold/5 border border-icg-gold/10">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`min-w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black ${i === 0 ? 'text-icg-espresso' : 'text-icg-muted'}`} style={i === 0 ? { background: GOLD } : { background: 'rgba(232,190,110,0.12)' }}>#{i + 1}</span>
                                    <ProAvatar url={row.avatar} username={row.username} size="w-9 h-9" className="overflow-visible" />
                                    <span className="text-[11px] font-bold text-icg-cream truncate">{row.display}</span>
                                </div>
                                <span className="text-[12px] font-black italic shrink-0" style={{ color: GOLD }}>{row.points}</span>
                            </div>
                        ))}
                        {scoreRows.length === 0 && (
                            <div className="py-6 flex flex-col items-center text-icg-muted/40">
                                <Crown size={20} className="mb-1.5" />
                                <span className="text-[10px] font-black">لا نقاط بعد</span>
                            </div>
                        )}
                    </div>
                </div>
            </SidebarPortal>

            {/* شريط علوي */}
            <div className="relative z-20 w-full flex items-center justify-between gap-3 px-5 py-2.5 border-b border-icg-gold/10 bg-icg-ink/60 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {!isOBS && (
                        <button onClick={onHome} className="p-2 rounded-xl bg-icg-gold/10 border border-icg-gold/20 text-icg-cream hover:bg-icg-ember/20 hover:border-icg-ember/40 transition-all active:scale-90">
                            <Home size={16} />
                        </button>
                    )}
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${tier.hex}14`, border: `1px solid ${tier.hex}38`, color: tier.hex }}>
                        <Trophy size={13} /> مرحلة {selectedStage}
                    </span>
                    <span className="text-[11px] font-black text-icg-muted">{tier.label}</span>
                </div>
                <div className="flex items-center gap-3">
                    {currentQ?.fromAdmin && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-icg-ember/15 border border-icg-ember/30 text-icg-ember">
                            سؤال الأدمن
                        </span>
                    )}
                    {adminCount > 0 && !currentQ?.fromAdmin && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-icg-ember/10 border border-icg-ember/20 text-icg-ember/80">
                            +{adminCount} أدمن
                        </span>
                    )}
                    <span className="text-[11px] font-black text-icg-cream/80">سؤال {index + 1} / {questions.length}</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-black text-icg-muted"><Users size={13} style={{ color: GOLD }} /> {totalVotes} صوت</span>
                </div>
            </div>

            {/* منطقة اللعب */}
            <div className="relative z-10 flex-1 w-full flex flex-col items-center justify-center px-4 md:px-8 py-4 min-h-0">
                <div className="relative w-full max-w-5xl flex flex-col items-center">
                    {/* نقاط التقدم */}
                    <div className="flex items-center gap-1.5 mb-4">
                        {questions.map((_, i) => (
                            <span
                                key={i}
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                    width: i === index ? 26 : 12,
                                    background: i < index ? `${tier.hex}88` : i === index ? GOLD : 'rgba(232,190,110,0.18)',
                                }}
                            />
                        ))}
                    </div>

                    {/* توهّج مستوى المرحلة */}
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[78%] h-56 blur-[80px] pointer-events-none opacity-80" style={{ background: `radial-gradient(circle, ${tier.hex}44, transparent 68%)` }} />

                    {/* بطاقة السؤال */}
                    <div className="relative w-full rounded-[2.5rem] border border-icg-gold/15 bg-icg-espresso/75 backdrop-blur-2xl px-8 pt-14 pb-10 md:px-14 text-center shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 rounded-full p-2.5" style={{ background: '#0a0805', border: '1px solid rgba(232,190,110,0.22)', boxShadow: '0 14px 40px rgba(0,0,0,0.7)' }}>
                            <TimerRing left={voting ? timeLeft : roundSeconds} total={roundSeconds} size={88} color={voting && timeLeft <= 5 ? EMBER : GOLD} label="ثانية" pulse={voting && timeLeft <= 5} />
                        </div>

                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

                        <p className="text-[10px] font-black tracking-[0.4em] text-icg-muted mb-4">أعلى ─ أم ─ أقل</p>

                        <h2 className="hl-question text-2xl md:text-4xl font-black text-icg-cream leading-snug tracking-tight">
                            <NumberedText text={currentQ?.text || 'جارِ التحميل...'} />
                        </h2>

                        <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
                            <span className="px-3 py-1.5 rounded-full text-[10px] font-black" style={{ background: 'rgba(232,190,110,0.1)', color: GOLD }}>صوّت بـ "أعلى"</span>
                            <span className="px-3 py-1.5 rounded-full text-[10px] font-black" style={{ background: 'rgba(232,85,47,0.12)', color: EMBER }}>صوّت بـ "أقل"</span>
                            <span className="px-3 py-1.5 rounded-full text-[10px] font-black text-icg-muted bg-white/5">معلومة بعد الكشف</span>
                        </div>
                    </div>

                    {/* حلبة التصويت */}
                    <div className="relative w-full mt-7 h-[30vh] min-h-[240px] max-h-[380px] grid grid-cols-2 gap-10 items-stretch">
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#0a0805', border: `1px solid ${GOLD}44`, boxShadow: `0 0 30px rgba(232,190,110,0.25)` }}>
                            <span className="hl-title text-2xl font-black italic leading-none">VS</span>
                        </span>

                        {([
                            { side: 'higher', label: 'أعلى', pct: higherPct, count: higherVotes.size, color: GOLD, Icon: ArrowUp, votes: higherVotes },
                            { side: 'lower', label: 'أقل', pct: lowerPct, count: lowerVotes.size, color: EMBER, Icon: ArrowDown, votes: lowerVotes },
                        ] as const).map(col => (
                            <div key={col.side} className="relative h-full min-h-0 flex flex-col items-center justify-end gap-2">
                                {/* منطقة نمو العمود — لا تخرج عن حدود الحلبة مهما ارتفعت النسبة */}
                                <div className="relative w-full flex-1 min-h-0">
                                    <div className="absolute inset-x-0 bottom-0 transition-all duration-700 ease-out" style={{ height: `${Math.max(16, col.pct)}%` }}>
                                        <div
                                            className="absolute inset-0 rounded-t-[1.75rem] overflow-hidden hl-bar"
                                            style={{
                                                background: `linear-gradient(180deg, ${col.color}dd, ${col.color}33 70%, transparent)`,
                                                border: `1px solid ${col.color}66`,
                                                borderBottom: 'none',
                                                boxShadow: `0 0 34px ${col.color}44`,
                                            }}
                                        >
                                            <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: col.color }} />
                                            {revealed && currentQ && (currentQ.isHigher ? col.side === 'higher' : col.side === 'lower') && (
                                                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black text-icg-espresso whitespace-nowrap" style={{ background: GOLD }}>
                                                    الإجابة الصحيحة
                                                </span>
                                            )}
                                        </div>

                                        {/* المصوّتون عند قاعدة العمود — خارج الطبقة المقصوصة حتى يظهر الإطار كاملاً */}
                                        <div className="absolute inset-x-0 bottom-0 z-10 pb-1 px-1 flex flex-wrap items-end content-end justify-center gap-x-1 gap-y-2">
                                            {Array.from(col.votes).slice(0, 14).map(username => (
                                                <ProAvatar key={username} url={voters[username]?.avatar} username={username} size="w-12 h-12" className="overflow-visible" />
                                            ))}
                                            {col.count > 14 && (
                                                <span className="self-center px-2.5 py-1 rounded-full bg-icg-ink/80 border border-icg-gold/25 text-[10px] font-black text-icg-cream">+{col.count - 14}</span>
                                            )}
                                        </div>

                                        <div className="absolute inset-x-0 top-2 z-20 text-center pointer-events-none">
                                            <span className="text-3xl md:text-4xl font-black italic text-icg-cream drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">{col.pct}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 shrink-0">
                                    <col.Icon size={30} className={voting ? 'animate-bounce' : ''} style={{ color: col.color, filter: `drop-shadow(0 0 12px ${col.color}99)` }} />
                                    <span className="text-xl md:text-2xl font-black italic tracking-tighter" style={{ color: col.color }}>{col.label}</span>
                                    <span className="text-[11px] font-bold text-icg-muted">{col.count} صوت</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* كشف الإجابة */}
            {revealed && currentQ && (
                <div className="hl-reveal absolute inset-0 z-50 flex flex-col items-center justify-center px-6 bg-icg-ink/92 backdrop-blur-2xl">
                    <p className="text-[11px] font-black tracking-[0.4em] text-icg-muted mb-3">الإجابة الصحيحة</p>
                    <div className="flex items-center gap-4 mb-5">
                        {currentQ.isHigher ? <ArrowUp size={54} style={{ color: GOLD }} /> : <ArrowDown size={54} style={{ color: EMBER }} />}
                        <span className="text-6xl md:text-8xl font-black italic tracking-tighter hl-pop" style={{ color: currentQ.isHigher ? GOLD : EMBER, textShadow: `0 0 50px ${currentQ.isHigher ? GOLD : EMBER}66` }}>
                            {currentQ.isHigher ? 'أعلى' : 'أقل'}
                        </span>
                    </div>

                    <p className="text-2xl md:text-3xl font-black text-icg-cream text-center max-w-3xl leading-snug mb-5">
                        <NumberedText text={currentQ.text} />
                    </p>

                    {currentQ.fact && (
                        <div className="w-full max-w-2xl rounded-[1.75rem] border p-5 mb-6" style={{ borderColor: `${GOLD}44`, background: 'rgba(232,190,110,0.07)' }}>
                            <p className="flex items-center gap-2 text-[10px] font-black tracking-widest mb-2" style={{ color: GOLD }}>
                                <Lightbulb size={14} /> الحقيقة
                            </p>
                            <p className="text-base md:text-lg font-bold text-icg-cream leading-relaxed">{currentQ.fact}</p>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-4 flex-wrap mb-6">
                        <span className="px-4 py-2 rounded-full text-[11px] font-black flex items-center gap-2" style={{ background: 'rgba(232,190,110,0.1)', color: GOLD }}>
                            <CheckCircle2 size={14} /> {winners.length} جاوبوا صح · +{tier.points} نقطة
                        </span>
                        <span className="px-4 py-2 rounded-full text-[11px] font-black flex items-center gap-2" style={{ background: 'rgba(232,85,47,0.12)', color: EMBER }}>
                            <Users size={14} /> {totalVotes} صوت
                        </span>
                    </div>

                    {winners.length > 0 && (
                        <div className="flex items-center justify-center gap-x-1.5 gap-y-3 flex-wrap max-w-3xl mb-7">
                            {winners.slice(0, 16).map(w => (
                                <div key={w.username} className="hl-pop" title={w.display}>
                                    <ProAvatar url={w.avatar} username={w.username} size="w-14 h-14" />
                                </div>
                            ))}
                            {winners.length > 16 && (
                                <span className="px-3 py-2 rounded-full bg-icg-gold/10 text-[11px] font-black text-icg-cream">+{winners.length - 16}</span>
                            )}
                        </div>
                    )}

                    {!isOBS && (
                        <div className="flex items-center gap-3">
                            <button onClick={nextQuestion} className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-lg text-icg-espresso transition-all hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 14px 40px rgba(232,190,110,0.3)' }}>
                                {isLast ? <><Trophy size={18} /> إنهاء المرحلة</> : <><Play size={18} fill="currentColor" /> السؤال التالي</>}
                                {autoNext && <span className="w-6 h-6 grid place-items-center rounded-full bg-icg-ink/25 text-[12px] font-black tabular-nums">{revealLeft}</span>}
                            </button>
                            {!autoNext && (
                                <button onClick={beginRound} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm text-icg-cream bg-icg-gold/10 border border-icg-gold/20 hover:bg-icg-gold/20 transition-all active:scale-95">
                                    <RotateCcw size={15} /> أعد التصويت
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <style>{HL_STYLES}</style>
        </div>
    );
};

const HL_STYLES = `
    .hl-root { background: #0a0805; }
    .hl-wash { background: radial-gradient(58% 46% at 78% 18%, rgba(232,190,110,0.14), transparent 68%), radial-gradient(52% 44% at 12% 92%, rgba(169,122,48,0.14), transparent 70%), linear-gradient(180deg, #0d0a06 0%, #0a0805 60%, #12100a 100%); }
    .hl-grid { background: linear-gradient(rgba(232,190,110,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(232,190,110,0.045) 1px, transparent 1px); background-size: 52px 52px; -webkit-mask: radial-gradient(72% 72% at 50% 45%, #000, transparent); mask: radial-gradient(72% 72% at 50% 45%, #000, transparent); }
    .hl-title { background: linear-gradient(180deg, #fff7de 0%, #e8be6e 55%, #a97a30 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
    .hl-question .hl-num { color: #e8be6e; font-size: 1.25em; padding: 0 0.08em; text-shadow: 0 0 22px rgba(232,190,110,0.55); }
    .hl-bar { background-blend-mode: screen; }
    .hl-reveal { animation: hl-fade 0.45s ease-out; }
    .hl-pop { animation: hl-pop 0.5s cubic-bezier(0.2, 1.2, 0.3, 1); }
    @keyframes hl-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes hl-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); } }
    .hl-root .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .hl-root .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .hl-root .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(232,190,110,0.22); border-radius: 10px; }
    .hl-root .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(232,190,110,0.45); }
`;
