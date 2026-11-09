import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
    Award, Eye, EyeOff, Gauge, History, Home, Layers, Play, RotateCcw, Sparkles, Trophy,
    Users, Volume2, Zap, Hash, Timer, SkipForward, Lock, Shuffle,
} from 'lucide-react';
import { chatService } from '../services/chatService';
import { awardPoints } from '../services/points';
import { ProAvatar } from './ProAvatar';

interface CupShuffleProps {
    channelConnected: boolean;
    onHome: () => void;
    isOBS?: boolean;
}

type Phase = 'IDLE' | 'COUNTDOWN' | 'SHUFFLE' | 'VOTING' | 'REVEAL' | 'BREAK' | 'FINISHED';

interface BallVote { cup: number; avatar: string; color?: string; host?: boolean }
interface ScoreRow { username: string; avatar: string; points: number; wins: number }
interface RoundRow { round: number; cup: number; winners: number; points: number; lead: string }

const GOLD = '#e8be6e';
const EMBER = '#e8552f';
const LIVE = '#4be07a';
const CREAM = '#fbeccb';

const CUP_CHOICES = [3, 4, 5, 6, 8];
const ROUND_CHOICES = [3, 5, 7, 10];
const VOTE_CHOICES = [8, 12, 15, 20];
const SWAP_CHOICES = [10, 16, 24];
const SPEED_CHOICES: Array<{ label: string; ms: number }> = [
    { label: 'هادئ', ms: 340 },
    { label: 'سريع', ms: 220 },
    { label: 'جنوني', ms: 130 },
];
const REVEAL_MS = 5000;
const BREAK_MS = 6000;
/** أعلى مكافأة مخاطرة — تُدفع عندما يصيب شخص واحد فقط */
const RISK_MAX = 100;

const normDigits = (s: string) => s
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48))
    .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 48));

const canon = (s: string) => s
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^ؠ-يa-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** الأرقام والرسائل: «3» و «كوب ٣» و «1️⃣» و «الثاني» و «ب» كلها تفهم */
const LETTER_CUPS = ['ا', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي'];
const ORDINALS: string[] = ['اول', 'تاني', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس', 'سابع', 'ثامن', 'تاسع', 'عاشر'];

const parseCup = (raw: string, cupCount: number): number => {
    const digits = normDigits(raw || '');
    const lowered = digits.toLowerCase();
    const text = canon(digits);

    const explicit = lowered.match(/[1-9]\uFE0F?\u20E3|كوب\s*(\d+)|cup\s*(\d+)|(\d+)/);
    if (explicit) {
        const n = Number(explicit[0].replace(/\D/g, ''));
        if (n >= 1 && n <= cupCount) return n - 1;
    }

    if (text.length === 1) {
        const li = LETTER_CUPS.indexOf(text);
        if (li >= 0 && li < cupCount) return li;
    }
    if (text === 'a' && cupCount >= 1) return 0;
    if (text === 'b' && cupCount >= 2) return 1;
    if (text === 'c' && cupCount >= 3) return 2;
    if (text === 'd' && cupCount >= 4) return 3;

    const words = text.split(' ');
    for (const w of words) {
        const oi = ORDINALS.indexOf(w);
        if (oi >= 0 && oi < cupCount) return oi;
    }
    return -1;
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
    disabled?: boolean;
    children: React.ReactNode;
}> = ({ active, color, onClick, sub, disabled, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="rounded-xl px-2 py-2 text-[10px] font-black leading-tight transition-all hover:scale-[1.03] active:scale-95 text-center disabled:opacity-40 disabled:hover:scale-100"
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
        <button onClick={onChange} className="w-9 h-5 rounded-full relative transition-colors shrink-0" style={{ background: value ? color : 'rgba(232,190,110,0.15)' }}>
            <span className="absolute top-1 left-1 w-3 h-3 rounded-full bg-icg-ink transition-transform" style={{ transform: value ? 'translateX(16px)' : 'none' }} />
        </button>
    </div>
);

const TimerRing: React.FC<{ left: number; total: number; size?: number; color: string; label?: string; pulse?: boolean }> = ({
    left, total, size = 88, color, label, pulse,
}) => {
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

/** الكوب مقلوب على الطاولة — فمه لأعلى وجسمه يتلوى للأسفل */
const Cup: React.FC<{
    index: number;
    lifted: boolean;
    isBall: boolean;
    dim: boolean;
    highlighted: boolean;
    moving: boolean;
}> = ({ index, lifted, isBall, dim, highlighted, moving }) => {
    const gold = 'linear-gradient(158deg, #fff7de 0%, #f9e0a4 18%, #e8be6e 46%, #a97a30 78%, #5a3a14 100%)';
    return (
        <div className="relative flex flex-col items-center">
            {/* الكرة الذهبية */}
            <div className="relative h-16 w-16 md:h-20 md:w-20 grid place-items-end justify-center">
                {isBall && (
                    <div
                        className={`absolute bottom-1 w-9 h-9 md:w-11 md:h-11 rounded-full transition-all duration-300 ${lifted ? 'cs-ball' : 'opacity-0 scale-50'}`}
                        style={{
                            background: 'radial-gradient(circle at 32% 28%, #fff7de, #e8be6e 45%, #a97a30 80%, #5a3a14)',
                            boxShadow: `0 0 26px ${GOLD}bb, inset -4px -6px 10px rgba(90,58,20,0.5)`,
                            zIndex: 1,
                        }}
                    />
                )}
                <div
                    className={`relative w-14 h-[72px] md:w-[74px] md:h-[96px] transition-all duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)] ${moving ? 'cs-shake' : ''}`}
                    style={{
                        transform: lifted ? 'translateY(-46px) rotate(-16deg)' : 'translateY(0) rotate(0)',
                        opacity: dim ? 0.45 : 1,
                        zIndex: 2,
                    }}
                >
                    <div
                        className="absolute inset-0"
                        style={{
                            clipPath: 'polygon(8% 0%, 92% 0%, 79% 100%, 21% 100%)',
                            background: highlighted ? gold : 'linear-gradient(158deg, #f4e3bf 0%, #e0c48a 20%, #b98c45 52%, #7a5220 82%, #422a10 100%)',
                            boxShadow: 'inset 0 3px 8px rgba(255,255,255,0.5), inset 0 -14px 26px rgba(42,26,8,0.55)',
                        }}
                    />
                    <div className="absolute top-[42%] left-0 right-0 h-3 -skew-y-12 bg-icg-ink/25" />
                    <div className="absolute top-[58%] left-0 right-0 h-1.5 -skew-y-12 bg-icg-ink/15" />
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-[92%] h-4 rounded-[100%]" style={{ background: 'linear-gradient(180deg,#fff7de,#e8be6e)', boxShadow: `0 0 16px ${GOLD}66` }} />
                    <div className="absolute inset-0 grid place-items-center">
                        <span className="text-2xl md:text-[27px] font-black italic text-icg-bronze/85 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]" style={{ marginTop: 4 }}>{index + 1}</span>
                    </div>
                </div>
            </div>
            {/* ظل الطاولة */}
            <div className="w-[64px] h-2.5 rounded-[100%] bg-black/55 blur-[3px] -mt-2" />
        </div>
    );
};

export const CupShuffle: React.FC<CupShuffleProps> = ({ channelConnected, onHome, isOBS = false }) => {
    const [phase, setPhase] = useState<Phase>('IDLE');
    // إعدادات
    const [cupCount, setCupCount] = useState(4);
    const [totalRounds, setTotalRounds] = useState(5);
    const [voteSeconds, setVoteSeconds] = useState(12);
    const [swapCount, setSwapCount] = useState(16);
    const [speedMs, setSpeedMs] = useState(220);
    const [soundOn, setSoundOn] = useState(true);
    const [showTally, setShowTally] = useState(true);
    const [allowChange, setAllowChange] = useState(true);
    const [hostVote, setHostVote] = useState(true);
    const [autoNext, setAutoNext] = useState(true);

    // حالة اللعب
    const [slots, setSlots] = useState<number[]>([0, 1, 2, 3]);
    const [movingCups, setMovingCups] = useState<number[]>([]);
    const [ballCup, setBallCup] = useState(0);
    const [votes, setVotes] = useState<Record<string, BallVote>>({});
    const [recent, setRecent] = useState<Array<{ user: string; cup: number; color?: string }>>([]);
    const [scores, setScores] = useState<Record<string, ScoreRow>>({});
    const [history, setHistory] = useState<RoundRow[]>([]);
    const [round, setRound] = useState(1);
    const [countdown, setCountdown] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [lastRound, setLastRound] = useState<RoundRow | null>(null);

    const phaseRef = useRef<Phase>('IDLE');
    const cfgRef = useRef({ cupCount, totalRounds, voteSeconds, swapCount, speedMs, showTally, allowChange, autoNext });
    const votesRef = useRef<Record<string, BallVote>>({});
    const roundRef = useRef(1);
    const scoresRef = useRef<Record<string, ScoreRow>>({});
    const ballRef = useRef(0);
    const slotsRef = useRef<number[]>([0, 1, 2, 3]);
    const timerRef = useRef<number | null>(null);
    const soundRef = useRef(soundOn);
    const audioRef = useRef<AudioContext | null>(null);
    const hostVoteRef = useRef(hostVote);

    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
    useEffect(() => { hostVoteRef.current = hostVote; }, [hostVote]);
    useEffect(() => { roundRef.current = round; }, [round]);
    useEffect(() => { scoresRef.current = scores; }, [scores]);
    useEffect(() => {
        cfgRef.current = { cupCount, totalRounds, voteSeconds, swapCount, speedMs, showTally, allowChange, autoNext };
        if (phaseRef.current === 'IDLE') {
            slotsRef.current = Array.from({ length: cupCount }, (_, i) => i);
            setSlots(slotsRef.current);
        }
    }, [cupCount, totalRounds, voteSeconds, swapCount, speedMs, showTally, allowChange, autoNext]);

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

    const fireConfetti = useCallback((ms = 2200) => {
        const end = Date.now() + ms;
        const id = window.setInterval(() => {
            if (Date.now() > end) { window.clearInterval(id); return; }
            const count = 40 * ((end - Date.now()) / ms);
            const base = { startVelocity: 32, spread: 340, ticks: 70, zIndex: 60, colors: [GOLD, '#f9e0a4', EMBER, LIVE] };
            confetti({ ...base, particleCount: Math.max(2, count / 2), origin: { x: Math.random() * 0.3 + 0.05, y: Math.random() - 0.25 } });
            confetti({ ...base, particleCount: Math.max(2, count / 2), origin: { x: Math.random() * 0.3 + 0.65, y: Math.random() - 0.25 } });
        }, 150);
        window.setTimeout(() => window.clearInterval(id), ms + 400);
    }, []);

    const castVote = useCallback((user: string, cup: number, avatar = '', color?: string, fromHost = false) => {
        if (phaseRef.current !== 'VOTING') return;
        if (cup < 0 || cup >= cfgRef.current.cupCount) return;
        const prev = votesRef.current[user];
        if (prev && !cfgRef.current.allowChange) return;
        if (prev && prev.cup === cup) return;

        const next = { ...votesRef.current, [user]: { cup, avatar: avatar || prev?.avatar || '', color: color || prev?.color, host: fromHost } };
        votesRef.current = next;
        setVotes(next);
        setRecent(prevList => [{ user, cup, color }, ...prevList].slice(0, 10));
        tone(fromHost ? 720 : 540 + cup * 60, 0.1, 'triangle', 0.05);
    }, [tone]);

    // ---------- الشات: مستمع واحد مدى الحياة ----------
    useEffect(() => {
        const cleanup = chatService.onMessage((msg) => {
            if (phaseRef.current !== 'VOTING') return;
            const user = msg.user.username;
            if (!user || msg.user.isBot) return;
            const cup = parseCup(msg.content, cfgRef.current.cupCount);
            if (cup < 0) return;
            castVote(user, cup, msg.user.avatar || '', msg.user.color);
        });
        return cleanup;
    }, [castVote]);

    const tally = useMemo(() => {
        const counts = new Array(cupCount).fill(0) as number[];
        Object.values(votes).forEach(v => { if (v.cup < counts.length) counts[v.cup] += 1; });
        return counts;
    }, [votes, cupCount]);

    const voteAvatars = useMemo(() => {
        const groups: Array<Array<{ username: string; avatar: string; color?: string }>> = Array.from({ length: cupCount }, () => []);
        Object.entries(votes).forEach(([username, v]) => {
            if (v.cup < groups.length) groups[v.cup].push({ username, avatar: v.avatar, color: v.color });
        });
        return groups;
    }, [votes, cupCount]);

    const totalVoters = Object.keys(votes).length;
    const scoreRows = useMemo(
        () => Object.values(scores).sort((a, b) => b.points - a.points || b.wins - a.wins),
        [scores],
    );
    const leader = scoreRows[0] || null;

    // ---------- تدفّق الجولات ----------
    const clearTimers = useCallback(() => {
        if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    }, []);

    const beginVoting = useCallback(() => {
        votesRef.current = {};
        setVotes({});
        setRecent([]);
        setTimeLeft(cfgRef.current.voteSeconds);
        setPhase('VOTING');
        tone(760, 0.16, 'triangle', 0.07);
    }, [tone]);

    const runShuffle = useCallback(() => {
        const cfg = cfgRef.current;
        const n = cfg.cupCount;
        const arr = Array.from({ length: n }, (_, i) => i);
        slotsRef.current = arr;
        setSlots([...arr]);
        ballRef.current = Math.floor(Math.random() * n);
        setBallCup(ballRef.current);
        setPhase('SHUFFLE');

        let done = 0;
        const step = () => {
            if (done >= cfg.swapCount) {
                setMovingCups([]);
                timerRef.current = window.setTimeout(() => beginVoting(), 520);
                return;
            }
            const a = Math.floor(Math.random() * n);
            let b = Math.floor(Math.random() * n);
            if (b === a) b = (b + 1) % n;
            const cur = slotsRef.current;
            [cur[a], cur[b]] = [cur[b], cur[a]];
            slotsRef.current = [...cur];
            setSlots([...cur]);
            setMovingCups([a, b]);
            tone(240 + Math.random() * 220, 0.05, 'square', 0.025);
            done += 1;
            timerRef.current = window.setTimeout(step, cfg.speedMs);
            window.setTimeout(() => setMovingCups([]), Math.max(60, cfg.speedMs - 70));
        };
        timerRef.current = window.setTimeout(step, 380);
    }, [beginVoting, tone]);

    const beginRound = useCallback(() => {
        clearTimers();
        setPhase('COUNTDOWN');
        setCountdown(3);
    }, [clearTimers]);

    /** الجولة التالية — رقم الجولة يُحدَّث هنا فقط مرة واحدة */
    const advanceRound = useCallback(() => {
        clearTimers();
        const next = roundRef.current + 1;
        roundRef.current = next;
        setRound(next);
        beginRound();
    }, [beginRound, clearTimers]);

    const revealRound = useCallback(() => {
        const cfg = cfgRef.current;
        const winners = Object.entries(votesRef.current).filter(([, v]) => v.cup === ballRef.current);
        const base = 100 + (cfg.cupCount - 3) * 25;
        const risk = winners.length <= 1 ? RISK_MAX : winners.length <= 2 ? 60 : winners.length <= 4 ? 25 : 0;
        const points = base + risk;

        setBallCup(ballRef.current);
        setSlots([...slotsRef.current]);
        setPhase('REVEAL');
        tone(300, 0.2, 'square', 0.05);
        window.setTimeout(() => tone(900, 0.3, 'triangle', 0.08), 220);
        fireConfetti(1600);

        if (winners.length) {
            const merged = { ...scoresRef.current };
            winners.forEach(([username, v]) => {
                const row = merged[username] || { username, avatar: v.avatar, points: 0, wins: 0 };
                merged[username] = { ...row, avatar: v.avatar || row.avatar, points: row.points + points, wins: row.wins + 1 };
                // تصويت المشرف بالضغط للاختبار فقط — لا يُسجَّل في اللوحة
                if (username !== 'host') {
                    awardPoints('CUP_SHUFFLE', username, v.avatar || '', 'round');
                    if (!v.avatar) {
                        void chatService.fetchKickAvatar(username).then(live => {
                            if (!live) return;
                            setScores(s => { const r = s[username]; if (!r || r.avatar) return s; return { ...s, [username]: { ...r, avatar: live } }; });
                        });
                    }
                }
            });
            setScores(merged);
        }

        const row: RoundRow = {
            round: roundRef.current,
            cup: ballRef.current + 1,
            winners: winners.length,
            points,
            lead: winners.length ? winners[0][0] : '—',
        };
        setLastRound(row);
        setHistory(prev => [row, ...prev].slice(0, 12));

        clearTimers();
        timerRef.current = window.setTimeout(() => {
            if (roundRef.current >= cfg.totalRounds) {
                setPhase('FINISHED');
                fireConfetti(3000);
                tone(660, 0.2, 'triangle', 0.09);
                window.setTimeout(() => tone(880, 0.24, 'triangle', 0.09), 180);
                window.setTimeout(() => tone(1180, 0.34, 'triangle', 0.09), 380);
            } else {
                setPhase('BREAK');
                if (cfg.autoNext) timerRef.current = window.setTimeout(() => advanceRound(), BREAK_MS);
            }
        }, REVEAL_MS);
    }, [advanceRound, clearTimers, fireConfetti, tone]);

    const startGame = useCallback(() => {
        clearTimers();
        setScores({});
        scoresRef.current = {};
        setHistory([]);
        setRound(1);
        roundRef.current = 1;
        votesRef.current = {};
        setVotes({});
        beginRound();
    }, [beginRound, clearTimers]);

    // عدّ تنازلي قبل الخلط
    useEffect(() => {
        if (phase !== 'COUNTDOWN') return;
        if (countdown <= 0) { runShuffle(); return; }
        tone(500 + (3 - countdown) * 100, 0.12, 'triangle');
        const id = window.setTimeout(() => setCountdown(c => c - 1), 720);
        return () => window.clearTimeout(id);
    }, [phase, countdown, runShuffle, tone]);

    // مؤقت التصويت — مصدر واحد للحقيقة
    useEffect(() => {
        if (phase !== 'VOTING') return;
        const id = window.setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
        return () => window.clearInterval(id);
    }, [phase]);

    useEffect(() => {
        if (phase === 'VOTING' && timeLeft === 0) revealRound();
    }, [phase, timeLeft, revealRound]);

    // تنظيف المؤقتات عند الخروج
    useEffect(() => () => clearTimers(), [clearTimers]);

    const nextRoundManually = () => advanceRound();

    const skipToReveal = () => { if (phaseRef.current === 'VOTING') { setTimeLeft(0); } };
    const abortToSetup = () => { clearTimers(); setPhase('IDLE'); votesRef.current = {}; setVotes({}); setRecent([]); };

    const statusLabel = phase === 'IDLE' ? 'استعداد' : phase === 'COUNTDOWN' ? 'استعد' : phase === 'SHUFFLE' ? 'خلط!' : phase === 'VOTING' ? 'صوّت' : phase === 'REVEAL' ? 'كشف' : phase === 'BREAK' ? 'بين الجولات' : 'انتهت';
    const statusColor = phase === 'VOTING' ? LIVE : phase === 'SHUFFLE' ? EMBER : phase === 'REVEAL' || phase === 'FINISHED' ? GOLD : '#b2a283';

    const slotWidthPct = 100 / cupCount;
    const liftedCup = phase === 'REVEAL' || phase === 'BREAK' || phase === 'FINISHED';
    const showBall = liftedCup;

    return (
        <>
            <SidebarPortal>
                <div className="rounded-[1.5rem] border border-icg-gold/12 bg-icg-ink/85 backdrop-blur-2xl overflow-hidden shadow-2xl">
                    <div className="px-3 py-2.5 border-b border-icg-gold/10 bg-icg-gold/5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[11px] font-black text-icg-cream tracking-widest">
                            <Layers size={14} className="text-icg-gold" /> لوحة الأكواب
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black shrink-0" style={{ background: `${statusColor}1f`, color: statusColor }}>{statusLabel}</span>
                    </div>

                    <div className="p-2.5 space-y-2.5">
                        {phase === 'IDLE' || phase === 'FINISHED' ? (
                            <>
                                <Section title="عدد الأكواب" icon={Hash}>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {CUP_CHOICES.map(c => <OptBtn key={c} active={cupCount === c} color={GOLD} onClick={() => setCupCount(c)}>{c}</OptBtn>)}
                                    </div>
                                </Section>

                                <Section title="عدد الجولات" icon={Trophy}>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {ROUND_CHOICES.map(r => <OptBtn key={r} active={totalRounds === r} color={GOLD} onClick={() => setTotalRounds(r)}>{r}</OptBtn>)}
                                    </div>
                                </Section>

                                <Section title="وقت التصويت" icon={Timer} color={LIVE}>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {VOTE_CHOICES.map(s => <OptBtn key={s} active={voteSeconds === s} color={LIVE} onClick={() => setVoteSeconds(s)}>{s} ث</OptBtn>)}
                                    </div>
                                </Section>

                                <Section title="الخلط" icon={Shuffle} color={EMBER}>
                                    <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                                        {SWAP_CHOICES.map(s => <OptBtn key={s} active={swapCount === s} color={EMBER} onClick={() => setSwapCount(s)} sub="تبديل">{s}</OptBtn>)}
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {SPEED_CHOICES.map(s => <OptBtn key={s.ms} active={speedMs === s.ms} color={EMBER} onClick={() => setSpeedMs(s.ms)}>{s.label}</OptBtn>)}
                                    </div>
                                </Section>

                                <Section title="خيارات البث" icon={Sparkles}>
                                    <div className="space-y-1.5">
                                        <SwitchRow label="أصوات اللعبة" value={soundOn} onChange={() => setSoundOn(v => !v)} icon={Volume2} />
                                        <SwitchRow label="إظهار عدّ الأصوات" value={showTally} onChange={() => setShowTally(v => !v)} icon={showTally ? Eye : EyeOff} color={LIVE} />
                                        <SwitchRow label="تغيير التصويت" value={allowChange} onChange={() => setAllowChange(v => !v)} icon={allowChange ? Shuffle : Lock} />
                                        <SwitchRow label="تصويت بالضغط" value={hostVote} onChange={() => setHostVote(v => !v)} icon={Zap} color={EMBER} />
                                        <SwitchRow label="جولة تلقائية" value={autoNext} onChange={() => setAutoNext(v => !v)} icon={RotateCcw} color={EMBER} />
                                    </div>
                                </Section>

                                <div className="rounded-2xl border border-icg-gold/12 bg-icg-espresso/50 p-2.5 space-y-1.5">
                                    <p className="text-[9px] font-black text-icg-muted tracking-widest">نقاط الجولة</p>
                                    <div className="flex items-center justify-between text-[11px] font-black text-icg-cream">
                                        <span>أساس {100 + (cupCount - 3) * 25}</span>
                                        <span style={{ color: LIVE }}>مخاطرة +{RISK_MAX}</span>
                                    </div>
                                    <p className="text-[8px] font-bold text-icg-muted/80">مخاطرة: كلما قلّت الأصوات على الكوب الصحيح زادت النقاط</p>
                                </div>

                                <button
                                    onClick={startGame}
                                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-black text-sm text-icg-espresso transition-all hover:scale-[1.02] active:scale-95"
                                    style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 12px 30px rgba(232,190,110,0.25)' }}
                                >
                                    <Play size={16} fill="currentColor" /> {phase === 'FINISHED' ? 'العب مرة أخرى' : 'ابدأ التحدي'}
                                </button>
                                {!isOBS && (
                                    <button onClick={onHome} className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 font-black text-[10px] text-icg-muted hover:text-icg-cream hover:bg-white/5 transition-all">
                                        <Home size={12} /> العودة للرئيسية
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <Section title="الحالة" icon={Zap} color={statusColor}
                                    right={<span className="text-[9px] font-black text-icg-muted tabular-nums">جولة {round}/{totalRounds}</span>}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-base font-black italic" style={{ color: statusColor }}>{statusLabel}</span>
                                        <span className="text-[11px] font-black text-icg-cream tabular-nums">{totalVoters} مصوّت</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {Array.from({ length: cupCount }).map((_, i) => (
                                            <div key={i} className="flex items-center justify-between rounded-xl px-2 py-1.5 bg-black/30 border" style={{ borderColor: showBall && ballCup === i ? `${GOLD}66` : 'rgba(255,255,255,0.05)' }}>
                                                <span className="text-[10px] font-black text-icg-cream">كوب {i + 1}</span>
                                                <span className="text-[10px] font-black tabular-nums" style={{ color: showBall && ballCup === i ? LIVE : GOLD }}>{showTally || liftedCup ? tally[i] : '?'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Section>

                                {(phase === 'VOTING' || phase === 'BREAK') && (
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button onClick={skipToReveal} disabled={phase !== 'VOTING'} className="rounded-xl px-2 py-2 text-[10px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-30" style={{ background: `${GOLD}1f`, border: `1px solid ${GOLD}44`, color: GOLD }}>
                                            <Eye size={11} /> اكشف الآن
                                        </button>
                                        <button onClick={abortToSetup} className="rounded-xl px-2 py-2 text-[10px] font-black flex items-center justify-center gap-1.5 text-icg-cream bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95">
                                            <RotateCcw size={11} /> إيقاف
                                        </button>
                                    </div>
                                )}

                                {phase === 'BREAK' && !autoNext && (
                                    <button onClick={nextRoundManually} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-black text-sm text-icg-espresso transition-all hover:scale-[1.02] active:scale-95" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})` }}>
                                        <SkipForward size={15} /> ابدأ الجولة {round + 1}
                                    </button>
                                )}

                                {recent.length > 0 && (
                                    <Section title="أصوات الواردة" icon={Users} color={EMBER}>
                                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                            {recent.map((r, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-[10px] rounded-lg bg-black/30 px-2 py-1">
                                                    <span className="font-black truncate max-w-[80px]" style={{ color: r.color || CREAM }}>{r.user}</span>
                                                    <span className="text-icg-muted/50">←</span>
                                                    <span className="font-black text-icg-gold">كوب {r.cup + 1}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {scoreRows.length > 0 && (
                                    <Section title="نقاط الجلسة" icon={Award} right={<span className="text-[9px] font-black text-icg-muted tabular-nums">{scoreRows.length} لاعب</span>}>
                                        <div className="space-y-1">
                                            {scoreRows.slice(0, 8).map((r, i) => (
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
                                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                            {history.map((h, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2 text-[9px] rounded-lg bg-black/25 px-2 py-1">
                                                    <span className="font-black text-icg-muted tabular-nums">#{h.round}</span>
                                                    <span className="font-black text-icg-cream">كوب {h.cup}</span>
                                                    <span className="text-icg-muted truncate max-w-[70px]">{h.lead}</span>
                                                    <span className="shrink-0 tabular-nums" style={{ color: LIVE }}>{h.winners}</span>
                                                    <span className="shrink-0 tabular-nums text-icg-gold">{h.points}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </SidebarPortal>

            {/* ===================== الشاشة الرئيسية ===================== */}
            <div className="cs-root relative flex-1 w-full h-full flex flex-col items-center overflow-hidden select-none" dir="rtl">
                <div className="cs-wash absolute inset-0 pointer-events-none" />
                <div className="cs-grid absolute inset-0 pointer-events-none" />

                <div className="relative z-20 w-full flex items-center justify-between gap-4 px-5 py-3.5 border-b border-icg-gold/10 bg-icg-ink/70 backdrop-blur-xl shrink-0">
                    <div className="absolute bottom-0 left-1/4 right-1/4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}77, transparent)` }} />
                    <div className="flex items-center gap-3.5 min-w-0">
                        {!isOBS && (
                            <button onClick={onHome} className="shrink-0 p-2.5 rounded-xl bg-icg-gold/10 border border-icg-gold/20 text-icg-cream hover:bg-icg-ember/20 hover:border-icg-ember/40 transition-all active:scale-90">
                                <Home size={18} />
                            </button>
                        )}
                        <div className="min-w-0">
                            <h1 className="cs-title text-2xl md:text-3xl font-black italic tracking-tighter leading-none whitespace-nowrap">تحدي الأكواب</h1>
                            <p className="text-[9px] font-black text-icg-muted/70 tracking-[0.45em] mt-1.5 whitespace-nowrap">CUP SHUFFLE ARENA</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {phase !== 'IDLE' && phase !== 'FINISHED' && (
                            <div className="flex items-center gap-1.5">
                                {Array.from({ length: totalRounds }).map((_, i) => (
                                    <span key={i} className="w-2 h-2 rounded-full transition-all" style={{ background: i < round - 1 ? GOLD : i === round - 1 ? EMBER : 'rgba(232,190,110,0.18)', boxShadow: i === round - 1 ? `0 0 10px ${EMBER}` : 'none' }} />
                                ))}
                                <span className="text-[11px] font-black text-icg-cream tabular-nums mr-1">{round}/{totalRounds}</span>
                            </div>
                        )}
                        <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${GOLD}1a`, color: GOLD }}>{cupCount} أكواب</span>
                        {leader && (
                            <span className="px-3 py-1.5 rounded-full bg-icg-espresso/70 border border-icg-gold/20 text-[11px] font-black text-icg-cream truncate max-w-[160px]">
                                المتصدر {leader.username} · {leader.points}
                            </span>
                        )}
                        <button onClick={() => setSoundOn(v => !v)} className={`p-2 rounded-xl border transition-all active:scale-90 ${soundOn ? 'bg-icg-gold/15 border-icg-gold/30 text-icg-gold' : 'bg-white/5 border-white/10 text-icg-muted'}`}>
                            <Volume2 size={15} />
                        </button>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: `${statusColor}14`, border: `1px solid ${statusColor}33` }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor }} />
                            <span className="text-[10px] font-black" style={{ color: statusColor }}>{statusLabel}</span>
                        </span>
                    </div>
                </div>

                {/* ---------- الطاولة ---------- */}
                <div className="relative z-10 flex-1 w-full flex flex-col items-center justify-center gap-4 px-4 md:px-8 py-4 overflow-hidden">
                    {phase === 'IDLE' ? (
                        <div className="w-full max-w-4xl space-y-5 text-center">
                            <div>
                                <div className="cs-title text-5xl md:text-7xl font-black italic tracking-tighter leading-none">أين الكرة؟</div>
                                <p className="mt-3 text-sm font-black text-icg-muted tracking-wider">
                                    {cupCount} أكواب تتبادل الأماكن في ثوانٍ — صوّت برقم الكوب، ومن يصيب يأخذ النقاط
                                </p>
                            </div>
                            <div className="rounded-[1.75rem] border border-icg-gold/12 bg-icg-espresso/50 backdrop-blur-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="shrink-0 w-11 h-11 rounded-2xl grid place-items-center bg-icg-gold/10 border border-icg-gold/25"><Zap size={20} className="text-icg-gold" /></span>
                                    <div className="min-w-0 text-right">
                                        <p className="text-sm font-black text-icg-cream leading-none">كيف تلعب؟</p>
                                        <p className="text-[11px] font-bold text-icg-muted mt-1.5">اكتب رقم الكوب في الشات: <span className="text-icg-gold">3</span> أو <span className="text-icg-gold">كوب ٣</span> أو <span className="text-icg-gold">الثاني</span></p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${LIVE}1a`, color: LIVE }}>صوت واحد لكل جولة</span>
                                    <span className="px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: `${GOLD}1a`, color: GOLD }}>تغيير الصوت مسموح</span>
                                    <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-black text-icg-muted">{voteSeconds} ثانية تصويت</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {([
                                    { k: 'الأكواب', v: String(cupCount), c: GOLD },
                                    { k: 'الجولات', v: String(totalRounds), c: EMBER },
                                    { k: 'نقاط الأساس', v: String(100 + (cupCount - 3) * 25), c: LIVE },
                                    { k: 'مكافأة المخاطرة', v: `+${RISK_MAX}`, c: '#f9e0a4' },
                                ] as const).map(item => (
                                    <div key={item.k} className="rounded-2xl border bg-icg-espresso/55 px-3.5 py-3 text-right" style={{ borderColor: `${item.c}22` }}>
                                        <p className="text-[9px] font-black text-icg-muted tracking-widest">{item.k}</p>
                                        <p className="mt-1 text-base font-black italic leading-none" style={{ color: item.c }}>{item.v}</p>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={startGame}
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-base text-icg-espresso transition-all hover:scale-105 active:scale-95"
                                style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 16px 42px rgba(232,190,110,0.32)' }}
                            >
                                <Play size={18} fill="currentColor" /> ابدأ التحدي
                            </button>
                            {!channelConnected && (
                                <p className="text-[10px] font-black" style={{ color: EMBER }}>الشات غير متصل — لا يمكن احتساب الأصوات</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* شريط الحالة العلوي */}
                            <div className="w-full max-w-5xl flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {phase === 'VOTING' && (
                                        <span className="px-4 py-2 rounded-full font-black italic text-[13px] border-t-2 border-white/15" style={{ background: `${LIVE}e6`, color: '#06210f', boxShadow: `0 14px 34px ${LIVE}44` }}>
                                            صوّت برقم الكوب في الشات
                                        </span>
                                    )}
                                    {phase === 'SHUFFLE' && (
                                        <span className="px-4 py-2 rounded-full font-black italic text-[13px] animate-pulse" style={{ background: `${EMBER}e6`, color: '#fff', boxShadow: `0 14px 34px ${EMBER}55` }}>
                                            الأكواب تتبادل الأماكن...
                                        </span>
                                    )}
                                    {phase === 'REVEAL' && (
                                        <span className="px-4 py-2 rounded-full font-black italic text-[13px]" style={{ background: `${GOLD}f0`, color: '#2a1a08', boxShadow: `0 14px 34px ${GOLD}55` }}>
                                            الكرة تحت كوب {ballCup + 1}
                                        </span>
                                    )}
                                    {phase === 'BREAK' && (
                                        <span className="px-4 py-2 rounded-full bg-icg-espresso/80 border border-icg-gold/25 font-black text-[12px] text-icg-cream">
                                            {lastRound?.winners ? `${lastRound.winners} مصيب — ${lastRound.points} نقطة لكل منهم` : 'لا مصيبين في هذه الجولة'}
                                        </span>
                                    )}
                                    {phase === 'COUNTDOWN' && (
                                        <span className="px-4 py-2 rounded-full bg-icg-gold/15 border border-icg-gold/30 font-black text-[12px] text-icg-gold">استعد للجولة {round}</span>
                                    )}
                                </div>
                                {phase === 'VOTING' ? (
                                    <TimerRing left={timeLeft} total={voteSeconds} size={78} color={timeLeft <= 4 ? EMBER : LIVE} label="ثانية" pulse={timeLeft <= 4} />
                                ) : (
                                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-icg-ink/70 border border-icg-gold/15">
                                        <Users size={13} className="text-icg-gold" />
                                        <span className="text-[13px] font-black text-icg-cream tabular-nums leading-none">{totalVoters}</span>
                                        <span className="text-[9px] font-black text-icg-muted">مصوّت</span>
                                    </div>
                                )}
                            </div>

                            {/* منطقة الأكواب */}
                            <div className="relative w-full max-w-5xl">
                                <div className="relative h-[240px] md:h-[300px]">
                                    {Array.from({ length: cupCount }).map((_, cupIdx) => {
                                        const slotIndex = slots[cupIdx] ?? cupIdx;
                                        const isBall = showBall && ballCup === cupIdx;
                                        return (
                                            <div
                                                key={cupIdx}
                                                onClick={() => { if (phase === 'VOTING' && hostVoteRef.current) castVote('host', cupIdx, '', GOLD, true); }}
                                                className={`absolute bottom-10 flex flex-col items-center gap-1 transition-all ease-[cubic-bezier(0.45,0.05,0.35,1)] ${phase === 'VOTING' && hostVote ? 'cursor-pointer' : ''}`}
                                                style={{
                                                    left: `${(slotIndex + 0.5) * slotWidthPct}%`,
                                                    transform: 'translateX(-50%)',
                                                    transitionDuration: `${Math.max(140, speedMs - 40)}ms`,
                                                    zIndex: liftedCup && isBall ? 5 : 2,
                                                }}
                                            >
                                                {/* عدّاد الأصوات */}
                                                <div className="mb-1 px-3 py-1 rounded-full flex items-center gap-1.5 border backdrop-blur-md transition-all"
                                                    style={{
                                                        background: showTally || liftedCup ? 'rgba(10,8,5,0.72)' : 'rgba(10,8,5,0.5)',
                                                        borderColor: showBall && isBall ? `${GOLD}66` : 'rgba(232,190,110,0.14)',
                                                    }}>
                                                    <span className="text-[9px] font-black tracking-widest text-icg-muted">كوب {cupIdx + 1}</span>
                                                    <span className="text-[13px] font-black tabular-nums" style={{ color: showTally || liftedCup ? GOLD : '#b2a283' }}>
                                                        {showTally || liftedCup ? tally[cupIdx] : '•'}
                                                    </span>
                                                </div>

                                                <Cup
                                                    index={cupIdx}
                                                    lifted={showBall && isBall}
                                                    isBall={isBall}
                                                    dim={liftedCup && !isBall}
                                                    highlighted={showBall && isBall}
                                                    moving={phase === 'SHUFFLE' && movingCups.includes(cupIdx)}
                                                />

                                                {/* المصوّتون */}
                                                <div className="mt-1.5 flex flex-wrap items-start justify-center gap-1 max-w-[150px] min-h-[26px]">
                                                    {(showTally || liftedCup) && voteAvatars[cupIdx].slice(0, 4).map(v => (
                                                        <ProAvatar key={v.username} url={v.avatar} username={v.username} size="w-6 h-6" className="overflow-visible" />
                                                    ))}
                                                    {(showTally || liftedCup) && voteAvatars[cupIdx].length > 4 && (
                                                        <span className="px-1.5 py-0.5 rounded-full bg-icg-ink/80 border border-icg-gold/25 text-[8px] font-black text-icg-cream">+{voteAvatars[cupIdx].length - 4}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {/* سطح الطاولة */}
                                    <div className="absolute bottom-[72px] left-4 right-4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)` }} />
                                    <div className="absolute bottom-0 left-0 right-0 h-[70px] rounded-t-[1.5rem]" style={{ background: 'linear-gradient(180deg, rgba(42,26,8,0.55), rgba(10,8,5,0.9))', borderTop: `1px solid ${GOLD}22` }} />
                                </div>
                            </div>

                            {/* أسفل الطاولة: الجائزة والتوزيع */}
                            <div className="w-full max-w-5xl flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-3 py-1.5 rounded-full bg-icg-espresso/70 border border-icg-gold/15 text-[10px] font-black text-icg-muted">
                                        جائزة الجولة <span className="text-icg-gold tabular-nums">{100 + (cupCount - 3) * 25}+</span>
                                    </span>
                                    <span className="px-3 py-1.5 rounded-full bg-icg-espresso/70 border border-icg-gold/15 text-[10px] font-black text-icg-muted">
                                        الأصوات <span className="text-icg-cream tabular-nums">{totalVoters}</span>
                                    </span>
                                    {!showTally && phase === 'VOTING' && (
                                        <span className="px-3 py-1.5 rounded-full bg-icg-ember/10 border border-icg-ember/25 text-[10px] font-black" style={{ color: EMBER }}>العدّ مخفي عن البث</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    {recent.slice(0, 4).map((r, i) => (
                                        <span key={i} className="px-2.5 py-1 rounded-full bg-icg-ink/70 border border-icg-gold/12 text-[10px] font-black text-icg-cream truncate max-w-[110px]">
                                            {r.user} <span className="text-icg-gold">·{r.cup + 1}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* ---------- عدّ تنازلي ---------- */}
                {phase === 'COUNTDOWN' && (
                    <div className="absolute inset-0 z-40 grid place-items-center bg-icg-ink/85 backdrop-blur-md pointer-events-none">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-icg-muted tracking-[0.5em]">استعد</span>
                            <span key={countdown} className="cs-pop text-8xl md:text-9xl font-black italic leading-none" style={{ color: GOLD, textShadow: `0 0 60px ${GOLD}66` }}>
                                {countdown > 0 ? countdown : 'امزج'}
                            </span>
                        </div>
                    </div>
                )}

                {/* ---------- النتائج النهائية ---------- */}
                {phase === 'FINISHED' && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center px-4 py-6 bg-icg-ink/92 backdrop-blur-2xl cs-fade" dir="rtl">
                        <div className="w-full max-w-3xl">
                            <div className="text-center mb-5">
                                <Trophy size={54} className="mx-auto mb-2" style={{ color: GOLD, filter: `drop-shadow(0 0 26px ${GOLD}88)` }} />
                                <h2 className="cs-title text-4xl md:text-5xl font-black italic tracking-tighter leading-none">انتهى التحدي</h2>
                                <p className="mt-2 text-[11px] font-black text-icg-muted tracking-widest">{totalRounds} جولات · {scoreRows.length} لاعب</p>
                            </div>

                            {scoreRows.length === 0 ? (
                                <p className="text-center text-sm font-black text-icg-muted py-8">لا أصوات مسجّلة هذه الجلسة</p>
                            ) : (
                                <>
                                    <div className="flex items-end justify-center gap-3 mb-5">
                                        {[1, 0, 2].map((placeIdx, i) => {
                                            const row = scoreRows[placeIdx];
                                            if (!row) return null;
                                            const podium = [
                                                { h: 'h-24', c: GOLD, size: 'w-16 h-16', label: '١' },
                                                { h: 'h-16', c: '#b2a283', size: 'w-12 h-12', label: '٢' },
                                                { h: 'h-12', c: '#a97a30', size: 'w-11 h-11', label: '٣' },
                                            ][i];
                                            return (
                                                <div key={placeIdx} className="flex flex-col items-center gap-2">
                                                    <ProAvatar url={row.avatar} username={row.username} size={podium.size} className="overflow-visible" />
                                                    <span className="text-[11px] font-black text-icg-cream truncate max-w-[110px]">{row.username}</span>
                                                    <span className="text-[10px] font-black tabular-nums" style={{ color: podium.c }}>{row.points}</span>
                                                    <div className={`${podium.h} w-24 rounded-t-xl border-t-2 flex items-start justify-center pt-2`} style={{ background: `${podium.c}14`, borderColor: `${podium.c}66` }}>
                                                        <span className="text-xl font-black italic" style={{ color: podium.c }}>{podium.label}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="max-h-52 overflow-y-auto custom-scrollbar rounded-2xl border border-icg-gold/12 bg-icg-espresso/50 p-2 space-y-1">
                                        {scoreRows.map((r, i) => (
                                            <div key={r.username} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 bg-black/25">
                                                <span className="w-5 text-[11px] font-black text-center shrink-0" style={{ color: i === 0 ? GOLD : '#b2a283' }}>{i + 1}</span>
                                                <ProAvatar url={r.avatar} username={r.username} size="w-8 h-8" className="shrink-0" />
                                                <span className="flex-1 text-[12px] font-black text-icg-cream truncate">{r.username}</span>
                                                <span className="text-[10px] font-bold text-icg-muted tabular-nums">{r.wins} إصابة</span>
                                                <span className="text-[13px] font-black text-icg-gold tabular-nums w-12 text-left">{r.points}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
                                <button onClick={startGame} className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-icg-espresso transition-all hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, #f9e0a4, ${GOLD})`, boxShadow: '0 12px 34px rgba(232,190,110,0.28)' }}>
                                    <RotateCcw size={16} /> جولة جديدة
                                </button>
                                <button onClick={abortToSetup} className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[13px] text-icg-cream bg-icg-gold/10 border border-icg-gold/20 hover:bg-icg-gold/20 transition-all active:scale-95">
                                    <Gauge size={15} /> غيّر الإعدادات
                                </button>
                                {!isOBS && (
                                    <button onClick={onHome} className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[13px] text-icg-muted bg-white/5 border border-white/10 hover:text-icg-cream transition-all active:scale-95">
                                        <Home size={15} /> خروج
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <style>{CS_STYLES}</style>
            </div>
        </>
    );
};

const CS_STYLES = `
    .cs-root { background: #0a0805; }
    .cs-wash { background: radial-gradient(56% 44% at 50% 8%, rgba(232,190,110,0.16), transparent 68%), radial-gradient(50% 40% at 12% 92%, rgba(169,122,48,0.16), transparent 70%), linear-gradient(180deg, #0d0a06 0%, #0a0805 56%, #141009 100%); }
    .cs-grid { background: linear-gradient(rgba(232,190,110,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(232,190,110,0.045) 1px, transparent 1px); background-size: 52px 52px; -webkit-mask: radial-gradient(74% 74% at 50% 42%, #000, transparent); mask: radial-gradient(74% 74% at 50% 42%, #000, transparent); }
    .cs-title { background: linear-gradient(180deg, #fff7de 0%, #e8be6e 55%, #a97a30 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
    .cs-ball { animation: cs-ball 1.1s ease-in-out infinite; }
    @keyframes cs-ball { 0%,100% { transform: translateY(0) scale(1); } 45% { transform: translateY(-22px) scale(1.04); } }
    .cs-shake { animation: cs-shake 0.32s ease-in-out; }
    @keyframes cs-shake { 0%,100% { transform: translateY(0) rotate(0); } 30% { transform: translateY(-6px) rotate(-4deg); } 70% { transform: translateY(-3px) rotate(3deg); } }
    .cs-pop { animation: cs-pop 0.5s cubic-bezier(0.2,1.2,0.3,1); }
    @keyframes cs-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); } }
    .cs-fade { animation: cs-fade 0.4s ease-out; }
    @keyframes cs-fade { from { opacity: 0; } to { opacity: 1; } }
    .cs-root .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .cs-root .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .cs-root .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(232,190,110,0.22); border-radius: 10px; }
    .cs-root .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(232,190,110,0.45); }
`;
