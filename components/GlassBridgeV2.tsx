import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
    Settings, Play, Users, Trophy, Skull, Sparkles, ShieldCheck, Heart,
    Copy, Check, ShieldAlert, Monitor, Gauge, Volume2, RefreshCw, Eye,
    Swords as SwordsIcon, Ban, Home,
    LogOut, Footprints, Gem, Activity, X, Zap, Flame, Crown,
    ChevronRight, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import { ChatUser } from '../types';
import { chatService } from '../services/chatService';
import { supabase } from '../services/supabase';
import { awardPoints } from '../services/points';

/* ============================================================================
   جسر الزجاج — نسخة البث
   الجمهور يصوّت على لوح آمن من كل زوج، اللوح الغلط ينكسر ومن يسقط يفقد حياة.
   ========================================================================== */

type Side = 'left' | 'right';
type GamePhase = 'SETUP' | 'LOBBY' | 'VOTING' | 'REVEAL' | 'VICTORY' | 'GAME_OVER';

interface GBConfig {
    joinKeyword: string;
    maxPlayers: number;
    steps: number;
    voteTime: number;
    lives: number;
    pointsPerStep: number;
    nonVotersFall: boolean;
    autoJoinOnVote: boolean;
    autoNext: boolean;
    sound: boolean;
}

interface GBStep { safe: Side; revealed: boolean; hint: boolean; }
interface GBPlayer { user: ChatUser; alive: boolean; lives: number; score: number; crossed: number; streak: number; }
interface GBLog { step: number; safe: Side; pts: number; crossed: number; fallen: number; out: number; }

const GOLD = '#e8be6e';
const GOLD_LT = '#f9e0a4';
const CREAM = '#fbeccb';
const EMBER = '#e8552f';
const LIVE = '#4be07a';
const ICE = '#9fe8ff';

const STEPS_CHOICES = [5, 7, 9, 12, 15];
const VOTE_CHOICES = [8, 12, 15, 20, 30];
const LIVES_CHOICES = [1, 2, 3];
const POINTS_CHOICES = [50, 100, 150];
const PLAYER_CHOICES = [50, 100, 200, 500];

const REVEAL_MS = 4200;
const STREAK_EVERY = 3;
const STREAK_BONUS = 1.5;

const LEFT_WORDS = ['يسار', 'شمال', 'يسرى', '1', 'l', 'left'];
const RIGHT_WORDS = ['يمين', 'يمينى', 'جنوب', '2', 'r', 'right'];

const normDigits = (s: string) => s
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48));

const canon = (s: string) => normDigits(String(s || ''))
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[!؟?.،,]+/g, ' ')
    .replace(/[^ؠ-يa-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** يفهم «يسار» و «!يسار» و «1» و « left » و «أروح يسار» */
function parseSide(raw: string): Side | null {
    const text = canon(raw);
    if (!text) return null;
    const tokens = text.split(' ');
    const check = (words: string[]) => words.some(w => tokens.includes(w) || tokens.some(t => t === w || (w.length > 2 && t.startsWith(w))));
    if (check(LEFT_WORDS)) return 'left';
    if (check(RIGHT_WORDS)) return 'right';
    return null;
}

/** رابط البث لا يُرسم على الشاشة: يُفكّ لحظة النسخ فقط */
const OBS_FRAG = 'P29icz10cnVlJnZpZXc9R0xBU1NfQlJJREdFX1Yy';
const buildObsLink = () => `${window.location.origin}/${atob(OBS_FRAG)}`;

async function copySilently(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* نجرب البديل */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch { return false; }
}

/** مضاعف الخطوة: كل ما تقدمت، زاد الخطر وزادت النقاط */
const stepMult = (i: number, total: number) => {
    const base = 1 + i * 0.15;
    return i === total - 1 ? base * 2 : base;
};
const stepPoints = (cfg: GBConfig, i: number, hinted: boolean) =>
    Math.max(10, Math.round(cfg.pointsPerStep * stepMult(i, cfg.steps) * (hinted ? 0.5 : 1)));

/* ------------------------------ عناصر مشتركة ------------------------------ */

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
    const el = document.getElementById('game-sidebar-portal');
    if (!mounted || !el) return null;
    return createPortal(children, el);
};

const Section: React.FC<{
    title: string; icon: React.ElementType; color?: string; right?: React.ReactNode; children: React.ReactNode;
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

const OptBtn: React.FC<{ active: boolean; color?: string; onClick: () => void; sub?: string; disabled?: boolean; children: React.ReactNode }> = ({
    active, color = GOLD, onClick, sub, disabled, children,
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="rounded-xl px-2 py-2 text-[10px] font-black leading-tight transition-all hover:scale-[1.03] active:scale-95 text-center disabled:opacity-40"
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

const SwitchRow: React.FC<{ label: string; value: boolean; onChange: () => void; icon: React.ElementType; hint?: string; color?: string }> = ({
    label, value, onChange, icon: Icon, hint, color = GOLD,
}) => (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-icg-gold/5 border border-icg-gold/10">
        <span className="flex flex-col min-w-0">
            <span className="flex items-center gap-1.5 text-[9px] font-black text-icg-cream/80">
                <Icon size={11} style={{ color: value ? color : undefined }} /> {label}
            </span>
            {hint && <span className="text-[8px] font-bold text-icg-muted/70">{hint}</span>}
        </span>
        <button onClick={onChange} className="w-9 h-5 rounded-full relative transition-colors shrink-0" style={{ background: value ? color : 'rgba(232,190,110,0.15)' }}>
            <span className="absolute top-1 left-1 w-3 h-3 rounded-full bg-icg-ink transition-transform" style={{ transform: value ? 'translateX(16px)' : 'none' }} />
        </button>
    </div>
);

const TimerRing: React.FC<{ left: number; total: number; size?: number; color: string; label?: string; pulse?: boolean }> = ({
    left, total, size = 92, color, label, pulse,
}) => {
    const stroke = 7;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, left / total));
    return (
        <div className={`relative shrink-0 ${pulse ? 'gb-breathe' : ''}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(232,190,110,0.12)" strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - ratio)}
                    style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 8px ${color}99)` }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-black leading-none tabular-nums" style={{ color, fontSize: size * 0.34 }}>{Math.max(0, Math.ceil(left))}</span>
                {label && <span className="text-[8px] font-black text-icg-muted tracking-widest">{label}</span>}
            </div>
        </div>
    );
};

/* --------------------------------- المكوّن --------------------------------- */

interface GBViewState {
    phase: GamePhase;
    step: number;
    total: number;
    voteTime: number;
    mult: number;
    points: number;
    left: string[];
    right: string[];
    alive: number;
    totalPlayers: number;
    safe: Side | null;
    map: Array<{ revealed: boolean; safe: Side | null; hint: boolean }>;
    fallenNames: string[];
    outNames: string[];
    crossed: number;
    gained: number;
    survivors: { name: string; score: number; lives: number; streak: number }[];
    ranked: { name: string; score: number; crossed: number; alive: boolean }[];
}

const GlassBridgeV2: React.FC<{ onHome: () => void; isOBS?: boolean }> = ({ onHome, isOBS }) => {
    const defaultCfg: GBConfig = {
        joinKeyword: 'عبور',
        maxPlayers: 200,
        steps: 7,
        voteTime: 15,
        lives: 2,
        pointsPerStep: 100,
        nonVotersFall: true,
        autoJoinOnVote: true,
        autoNext: true,
        sound: true,
    };

    const [config, setConfig] = useState<GBConfig>(defaultCfg);
    const [phase, setPhase] = useState<GamePhase>('SETUP');
    const [participants, setParticipants] = useState<ChatUser[]>([]);
    const [board, setBoard] = useState<Record<string, GBPlayer>>({});
    const [bridge, setBridge] = useState<GBStep[]>([]);
    const [step, setStep] = useState(0);
    const [votes, setVotes] = useState<{ left: string[]; right: string[] }>({ left: [], right: [] });
    const [timeLeft, setTimeLeft] = useState(0);
    const [lastFallen, setLastFallen] = useState<string[]>([]);
    const [lastSaved, setLastSaved] = useState<string[]>([]);
    const [lastOut, setLastOut] = useState<string[]>([]);
    const [lastGained, setLastGained] = useState(0);
    const [log, setLog] = useState<GBLog[]>([]);
    const [flash, setFlash] = useState<{ id: string; name: string; pts: number; fire: boolean }[]>([]);
    const [copied, setCopied] = useState(false);
    const [shake, setShake] = useState(false);

    const [obs, setObs] = useState<GBViewState>({
        phase: 'SETUP', step: 0, total: 1, voteTime: 15, mult: 1, points: 0,
        left: [], right: [], alive: 0, totalPlayers: 0, safe: null,
        map: [], fallenNames: [], outNames: [], crossed: 0, gained: 0,
        survivors: [], ranked: [],
    });

    const phaseRef = useRef(phase);
    const cfgRef = useRef(config);
    const boardRef = useRef(board);
    const bridgeRef = useRef(bridge);
    const stepRef = useRef(step);
    const votesRef = useRef(votes);
    const partRef = useRef(participants);
    const resolveRef = useRef<() => void>(() => {});
    const advanceRef = useRef<number | null>(null);
    const doneRef = useRef(false);
    const channelRef = useRef<any>(null);

    useEffect(() => { phaseRef.current = phase; cfgRef.current = config; boardRef.current = board; bridgeRef.current = bridge; stepRef.current = step; votesRef.current = votes; partRef.current = participants; },
        [phase, config, board, bridge, step, votes, participants]);

    /* ------------------------------- الصوت ------------------------------- */
    const tone = useCallback((freq: number, dur = 0.14, type: OscillatorType = 'sine', gain = 0.05) => {
        if (!cfgRef.current.sound) return;
        try {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type; osc.frequency.value = freq;
            g.gain.setValueAtTime(gain, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + dur);
            setTimeout(() => ctx.close(), (dur + 0.1) * 1000);
        } catch { /* لا شيء */ }
    }, []);

    const crash = useCallback(() => {
        if (!cfgRef.current.sound) return;
        try {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            const ctx = new Ctx();
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
            const src = ctx.createBufferSource();
            const f = ctx.createBiquadFilter();
            f.type = 'highpass'; f.frequency.value = 900;
            src.buffer = buf; src.connect(f); f.connect(ctx.destination);
            src.start();
            setTimeout(() => ctx.close(), 700);
        } catch { /* لا شيء */ }
    }, []);

    /* ------------------------------ البث ------------------------------ */
    useEffect(() => {
        if (isOBS || !channelRef.current) return;
        const cur = bridge[step];
        const revealed = phase === 'REVEAL' || phase === 'VICTORY' || phase === 'GAME_OVER';
        channelRef.current.send({
            type: 'broadcast',
            event: 'state_sync',
            payload: {
                phase,
                step,
                total: cfgRef.current.steps,
                voteTime: cfgRef.current.voteTime,
                mult: stepMult(step, cfgRef.current.steps),
                points: stepPoints(cfgRef.current, step, !!cur?.hint),
                left: votes.left,
                right: votes.right,
                alive: Object.values(board).filter(p => p.alive).length,
                totalPlayers: participants.length,
                safe: revealed && cur ? cur.safe : null,
                map: bridge.map(b => ({ revealed: b.revealed, safe: b.revealed ? b.safe : null, hint: b.hint })),
                fallenNames: phase === 'REVEAL' ? lastFallen : [],
                outNames: phase === 'REVEAL' ? lastOut : [],
                crossed: phase === 'REVEAL' ? lastSaved.length : 0,
                gained: phase === 'REVEAL' ? lastGained : 0,
                survivors: Object.values(board).filter(p => p.alive).map(p => ({ name: p.user.username, score: p.score, lives: p.lives, streak: p.streak })).sort((a, b) => b.score - a.score),
                ranked: Object.values(board).sort((a, b) => b.score - a.score || b.crossed - a.crossed).map(p => ({ name: p.user.username, score: p.score, crossed: p.crossed, alive: p.alive })).slice(0, 12),
            } as GBViewState,
        });
    }, [isOBS, phase, step, votes, board, bridge, participants.length, lastFallen, lastOut, lastSaved, lastGained]);

    useEffect(() => {
        const channel = supabase.channel('glass_bridge_sync', { config: { broadcast: { self: true } } });
        channel
            .on('broadcast', { event: 'state_sync' }, ({ payload }: any) => { if (isOBS && payload) setObs(payload); })
            .subscribe((status: string) => { if (status === 'SUBSCRIBED') channelRef.current = channel; });
        return () => { channel.unsubscribe(); channelRef.current = null; };
    }, [isOBS]);

    /* ------------------------------ الشات ------------------------------ */
    useEffect(() => {
        const unsub = chatService.onMessage(msg => {
            if (isOBS) return;
            const raw = String(msg.content || '').trim();
            if (!raw) return;
            const cfg = cfgRef.current;
            const name = msg.user.username;
            const key = name.toLowerCase();

            if (phaseRef.current === 'LOBBY') {
                const t = canon(raw);
                if (t === canon(cfg.joinKeyword) || t.split(' ').includes(canon(cfg.joinKeyword))) {
                    setParticipants(prev => {
                        if (prev.length >= cfg.maxPlayers || prev.some(p => p.username.toLowerCase() === key)) return prev;
                        chatService.fetchKickAvatar(name).then(av => {
                            if (av) setParticipants(c => c.map(p => p.username.toLowerCase() === key ? { ...p, avatar: av } : p));
                        }).catch(() => { });
                        return [...prev, msg.user];
                    });
                }
                return;
            }

            if (phaseRef.current !== 'VOTING') return;
            const side = parseSide(raw);
            if (!side) return;

            const isMember = partRef.current.some(p => p.username.toLowerCase() === key);
            if (!isMember && !cfg.autoJoinOnVote) return;
            if (!boardRef.current[key] || !boardRef.current[key]?.alive) {
                if (!isMember && cfg.autoJoinOnVote && phaseRef.current === 'VOTING' && partRef.current.length < cfg.maxPlayers) {
                    setParticipants(prev => prev.some(p => p.username.toLowerCase() === key) ? prev : [...prev, msg.user]);
                    setBoard(b => ({ ...b, [key]: { user: msg.user, alive: true, lives: cfg.lives, score: 0, crossed: 0, streak: 0 } }));
                } else return;
            }

            setVotes(prev => {
                const stripped = {
                    left: prev.left.filter(u => u !== key),
                    right: prev.right.filter(u => u !== key),
                };
                return { ...stripped, [side]: [...stripped[side], key] };
            });
            tone(side === 'left' ? 520 : 620, 0.07, 'triangle', 0.025);
        });
        return () => unsub();
    }, [isOBS, tone]);

    /* ----------------------------- المؤقّت ----------------------------- */
    useEffect(() => {
        if (isOBS || phase !== 'VOTING') return;
        if (timeLeft <= 0) { resolveRef.current(); return; }
        if (timeLeft <= 3) tone(880, 0.1, 'sine', 0.045);
        const id = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
        return () => window.clearTimeout(id);
    }, [isOBS, phase, timeLeft, tone]);

    useEffect(() => () => { if (advanceRef.current) window.clearTimeout(advanceRef.current); }, []);

    /* ----------------------------- الإجراءات ----------------------------- */
    const makeBridge = (n: number): GBStep[] =>
        Array.from({ length: n }, () => ({ safe: (Math.random() > 0.5 ? 'left' : 'right') as Side, revealed: false, hint: false }));

    const openVoting = useCallback((index: number) => {
        setStep(index);
        setVotes({ left: [], right: [] });
        setLastFallen([]);
        setLastSaved([]);
        setLastOut([]);
        setLastGained(0);
        setFlash([]);
        setTimeLeft(cfgRef.current.voteTime);
        setPhase('VOTING');
    }, []);

    const resolveStep = useCallback(() => {
        if (phaseRef.current !== 'VOTING') return;
        const cfg = cfgRef.current;
        const b = bridgeRef.current;
        const i = stepRef.current;
        const cur = b[i];
        if (!cur) return;

        const safeSide = cur.safe;
        const danger: Side = safeSide === 'left' ? 'right' : 'left';
        const v = votesRef.current;
        const onSafe = new Set(v[safeSide]);
        const onDanger = new Set(v[danger]);
        const voters = new Set([...v.left, ...v.right]);

        const nextBoard: Record<string, GBPlayer> = { ...boardRef.current };
        const fallen: string[] = [];
        const saved: string[] = [];
        const out: string[] = [];
        const pts = stepPoints(cfg, i, cur.hint);
        const flashes: { id: string; name: string; pts: number; fire: boolean }[] = [];
        let gainedTotal = 0;

        Object.values(nextBoard).forEach(p => {
            if (!p.alive) return;
            const key = p.user.username.toLowerCase();
            const choseDanger = onDanger.has(key);
            const skipped = !voters.has(key);
            if (choseDanger || (skipped && cfg.nonVotersFall)) {
                const lives = p.lives - 1;
                const alive = lives > 0;
                nextBoard[key] = { ...p, lives, alive, streak: 0 };
                fallen.push(p.user.username);
                if (!alive) out.push(p.user.username);
            } else if (onSafe.has(key)) {
                const streak = p.streak + 1;
                const fire = streak % STREAK_EVERY === 0;
                const worth = Math.round(pts * (fire ? STREAK_BONUS : 1));
                nextBoard[key] = { ...p, score: p.score + worth, crossed: p.crossed + 1, streak };
                saved.push(p.user.username);
                gainedTotal += worth;
                flashes.push({ id: `${Date.now()}_${key}`, name: p.user.username, pts: worth, fire });
            }
        });

        const newBridge = b.map((s, idx) => idx === i ? { ...s, revealed: true } : s);
        setBoard(nextBoard);
        setBridge(newBridge);
        setLastFallen(fallen);
        setLastSaved(saved);
        setLastOut(out);
        setLastGained(gainedTotal);
        setFlash(flashes.slice(0, 6));
        setLog(prev => [...prev, { step: i + 1, safe: safeSide, pts, crossed: saved.length, fallen: fallen.length, out: out.length }]);
        setPhase('REVEAL');

        if (fallen.length) { crash(); setShake(true); window.setTimeout(() => setShake(false), 620); }
        else { tone(700, 0.2, 'triangle'); window.setTimeout(() => tone(900, 0.22, 'triangle'), 150); }

        if (advanceRef.current) window.clearTimeout(advanceRef.current);
        advanceRef.current = window.setTimeout(() => {
            const aliveNow = Object.values(nextBoard).filter(p => p.alive);
            if (!aliveNow.length) { setPhase('GAME_OVER'); return; }
            if (i + 1 >= newBridge.length) { setPhase('VICTORY'); return; }
            if (cfg.autoNext) openVoting(i + 1);
        }, REVEAL_MS);
    }, [crash, tone, openVoting]);
    resolveRef.current = resolveStep;

    const startGame = () => {
        const alive = participants.slice(0, cfgRef.current.maxPlayers);
        const b = makeBridge(cfgRef.current.steps);
        const init: Record<string, GBPlayer> = {};
        alive.forEach(u => { init[u.username.toLowerCase()] = { user: u, alive: true, lives: cfgRef.current.lives, score: 0, crossed: 0, streak: 0 }; });
        doneRef.current = false;
        setBridge(b);
        bridgeRef.current = b;
        setBoard(init);
        boardRef.current = init;
        setFlash([]);
        setLog([]);
        openVoting(0);
        tone(600, 0.16, 'triangle');
    };

    const revealNow = () => { if (phaseRef.current === 'VOTING') resolveStep(); };
    const nextStep = () => { if (phaseRef.current === 'REVEAL') openVoting(stepRef.current + 1); };

    const useHint = () => {
        if (phaseRef.current !== 'VOTING') return;
        const i = stepRef.current;
        const cur = bridgeRef.current[i];
        if (!cur || cur.hint) return;
        setBridge(prev => prev.map((s, idx) => idx === i ? { ...s, hint: true } : s));
        tone(360, 0.2, 'sawtooth', 0.04);
    };

    const resetGame = () => {
        if (advanceRef.current) window.clearTimeout(advanceRef.current);
        doneRef.current = false;
        setPhase('SETUP');
        setParticipants([]);
        setBoard({});
        setBridge([]);
        setStep(0);
        setVotes({ left: [], right: [] });
        setTimeLeft(0);
        setLastFallen([]);
        setLastSaved([]);
        setLastOut([]);
        setLastGained(0);
        setFlash([]);
        setLog([]);
    };

    /* ------------------------------ الختام ------------------------------ */
    const ranked = useMemo(() => Object.values(board).sort((a, b) => b.score - a.score || b.crossed - a.crossed), [board]);
    const aliveList = useMemo(() => ranked.filter(p => p.alive), [ranked]);
    const deadList = useMemo(() => ranked.filter(p => !p.alive), [ranked]);
    const champion = aliveList[0] || ranked[0] || null;

    useEffect(() => {
        if (isOBS || phase !== 'VICTORY' || doneRef.current) return;
        doneRef.current = true;
        tone(523, 0.2, 'triangle'); setTimeout(() => tone(659, 0.2, 'triangle'), 160); setTimeout(() => tone(784, 0.34, 'triangle'), 320);
        if (champion) {
            awardPoints('GLASS_BRIDGE_V2', champion.user.username, champion.user.avatar || '', 'match');
        }
        let n = 0;
        const iv = setInterval(() => { confetti({ particleCount: 70, spread: 100, origin: { x: Math.random(), y: 0.3 } }); if (++n > 6) clearInterval(iv); }, 480);
        return () => clearInterval(iv);
    }, [isOBS, phase, champion, tone]);

    const copyObs = async () => {
        if (await copySilently(buildObsLink())) {
            setCopied(true);
            tone(760, 0.14);
            window.setTimeout(() => setCopied(false), 2600);
        }
    };

    const curStep = bridge[step];
    const mult = stepMult(step, config.steps);
    const gain = stepPoints(config, step, !!curStep?.hint);
    const votersTotal = votes.left.length + votes.right.length;
    const aliveCount = Object.values(board).filter(p => p.alive).length;
    const timeColor = timeLeft <= 3 ? EMBER : timeLeft <= Math.max(4, config.voteTime * 0.34) ? GOLD : LIVE;

    /* =============================== شاشة البث =============================== */
    if (isOBS) {
        const o = obs;
        const isRevealing = o.phase === 'REVEAL';
        const isVoting = o.phase === 'VOTING';
        const isEndObs = o.phase === 'VICTORY' || o.phase === 'GAME_OVER';
        const cast = o.left.length + o.right.length;
        const top = o.survivors.slice(0, 5);
        return (
            <div className="gb-obs" dir="rtl">
                <div className="gb-obs-top">
                    <div className="gb-obs-pill"><Footprints size={15} style={{ color: GOLD }} /> خطوة <b>{Math.min(o.step + 1, o.total)}</b><i>/{o.total}</i></div>
                    <div className="gb-obs-pill"><Sparkles size={15} style={{ color: ICE }} /> <b>{o.points}</b> نقطة <i>×{o.mult.toFixed(2)}</i></div>
                    <div className="gb-obs-pill"><Heart size={15} style={{ color: LIVE }} /> <b>{o.alive}</b> على الجسر<i> من {o.totalPlayers}</i></div>
                </div>

                <div className="gb-obs-arena">
                    {(['left', 'right'] as Side[]).map(side => {
                        const names = side === 'left' ? o.left : o.right;
                        const pct = cast ? Math.round((names.length / cast) * 100) : 50;
                        const isSafe = isRevealing && o.safe === side;
                        const isBroken = isRevealing && o.safe !== null && o.safe !== side;
                        const rival = side === 'left' ? o.right.length : o.left.length;
                        const lead = isVoting && names.length > 0 && names.length > rival;
                        return (
                            <div key={side} className={`gb-obs-panel ${side} ${isSafe ? 'safe' : ''} ${isBroken ? 'broken' : ''} ${isVoting ? 'live' : ''}`}>
                                <div className="gb-obs-glass" />
                                <div className="gb-obs-fill" style={{ height: `${isVoting ? pct : (isSafe ? 100 : 18)}%`, opacity: isVoting ? 0.45 : (isSafe ? 0.5 : 0.16) }} />
                                <div className="gb-obs-side-label">{side === 'left' ? 'يسار' : 'يمين'}</div>
                                <div className="gb-obs-icon">{isBroken ? <Skull size={54} /> : <ShieldCheck size={54} className={isSafe ? '' : 'dim'} />}</div>
                                <div className="gb-obs-num"><b>{names.length}</b><em>{pct}%</em></div>
                                {lead && <div className="gb-obs-lead">الأغلب هنا</div>}
                                {isBroken && <div className="gb-obs-shards">{Array.from({ length: 12 }).map((_, i) => <i key={i} style={{ ['--a' as any]: `${-95 + i * 17}deg`, ['--d' as any]: `${50 + (i % 4) * 34}px` }} />)}</div>}
                                {isSafe && <div className="gb-obs-sweep" />}
                            </div>
                        );
                    })}

                    <div className="gb-obs-core">
                        {isVoting && <TimerRing left={o.voteTime} total={o.voteTime} size={138} color={GOLD} label="ثانية" />}
                        {isRevealing && (
                            <div className="gb-obs-verdict">
                                <b>{o.safe === 'left' ? 'اليسار آمن' : 'اليمين آمن'}</b>
                                <span>{o.crossed} عبروا • +{o.gained} نقطة</span>
                            </div>
                        )}
                    </div>

                    {isVoting && top.length > 0 && (
                        <div className="gb-obs-board">
                            <div className="gb-obs-board-head"><Trophy size={13} style={{ color: GOLD }} /> المتصدرون</div>
                            {top.map((p, i) => (
                                <div key={p.name} className="gb-obs-board-row">
                                    <span>{i + 1}</span><b>{p.name}</b>
                                    {p.streak >= STREAK_EVERY - 1 && <Flame size={11} style={{ color: EMBER }} fill="currentColor" />}
                                    <em>{p.score}</em>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isRevealing && (o.fallenNames.length > 0 || o.outNames.length > 0) && (
                    <div className="gb-obs-fallen">
                        {o.outNames.length > 0 && <span className="out">خرج {o.outNames.length}</span>}
                        {o.fallenNames.slice(0, 12).map(n => <b key={n} className={o.outNames.includes(n) ? 'gone' : ''}>{n}</b>)}
                        {o.fallenNames.length > 12 && <b>+{o.fallenNames.length - 12}</b>}
                    </div>
                )}

                {o.map.length > 0 && !isEndObs && (
                    <div className="gb-obs-map">
                        {o.map.map((m, i) => (
                            <div key={i} className={`gb-obs-pair ${i === o.step && isVoting ? 'now' : ''} ${i === o.map.length - 1 ? 'last' : ''}`}>
                                <span className="gb-obs-pair-n">{i + 1}</span>
                                <span className="gb-obs-pair-tiles">
                                    <span className={`gb-obs-tile ${m.revealed && m.safe === 'left' ? 'safe' : ''} ${m.revealed && m.safe === 'right' ? 'gone' : ''}`} />
                                    <span className={`gb-obs-tile ${m.revealed && m.safe === 'right' ? 'safe' : ''} ${m.revealed && m.safe === 'left' ? 'gone' : ''}`} />
                                </span>
                            </div>
                        ))}
                        <div className="gb-obs-flag"><Trophy size={15} style={{ color: GOLD }} /></div>
                    </div>
                )}

                {isEndObs && (
                    <div className="gb-obs-end">
                        <div className="gb-obs-end-title">
                            {o.phase === 'VICTORY' ? <Trophy size={40} /> : <Skull size={40} />}
                            <b>{o.phase === 'VICTORY' ? 'عبروا الجسر' : 'الهاوية ابتلعت الجميع'}</b>
                        </div>
                        <div className="gb-obs-end-list">
                            {o.ranked.slice(0, 8).map((p, i) => (
                                <div key={p.name} className={`gb-obs-end-row ${i === 0 && p.alive ? 'champ' : ''}`}>
                                    <span>{i + 1}</span>
                                    {i === 0 && p.alive && <Crown size={14} style={{ color: GOLD }} />}
                                    <b>{p.name}</b>
                                    <i>{p.crossed}/{o.total}</i>
                                    {!p.alive && <Skull size={13} style={{ color: EMBER }} />}
                                    <em>{p.score}</em>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(o.phase === 'LOBBY' || o.phase === 'SETUP') && (
                    <div className="gb-obs-lobby">
                        <Footprints size={44} style={{ color: GOLD }} />
                        <b>جسر الزجاج</b>
                        <span>بانتظار العابرين… اكتبوا كلمة الانضمام في الشات</span>
                    </div>
                )}
                <style>{GB_STYLES}</style>
            </div>
        );
    }

    /* =============================== التحضير =============================== */
    if (phase === 'SETUP') {
        return (
            <div className="gb-root" dir="rtl">
                <div className="gb-bg" />
                <div className="gb-scroll">
                    <div className="gb-inner">
                        <header className="gb-hero">
                            <div className="gb-hero-icon"><Gem size={28} /></div>
                            <div className="gb-hero-text">
                                <h1 className="gb-title">جسر الزجاج</h1>
                                <p className="gb-sub">زوج ألواح في كل خطوة — واحد زجاج عادي والثاني مقوّى. اختر غلط وتسقط للهاوية</p>
                            </div>
                            <div className="gb-hero-stats">
                                <div className="gb-stat"><b>{config.steps}</b><span>خطوة</span></div>
                                <div className="gb-stat"><b>{config.lives}</b><span>حياة</span></div>
                                <div className="gb-stat"><b>{config.voteTime}ث</b><span>تصويت</span></div>
                            </div>
                        </header>

                        <div className="gb-grid">
                            <div className="gb-card">
                                <div className="gb-card-head"><Settings size={14} style={{ color: GOLD }} /> <span>إعدادات الجسر</span></div>
                                <div className="gb-field">
                                    <label>كلمة الانضمام</label>
                                    <input value={config.joinKeyword} onChange={e => setConfig(c => ({ ...c, joinKeyword: e.target.value }))} className="gb-input" />
                                    <p className="gb-help">من يكتبها في الشات يدخل قائمة العابرين</p>
                                </div>
                                <div className="gb-field">
                                    <label>عدد الخطوات</label>
                                    <div className="gb-choices">{STEPS_CHOICES.map(s => <OptBtn key={s} active={config.steps === s} onClick={() => setConfig(c => ({ ...c, steps: s }))}>{s}</OptBtn>)}</div>
                                </div>
                                <div className="gb-field">
                                    <label>وقت التصويت</label>
                                    <div className="gb-choices">{VOTE_CHOICES.map(v => <OptBtn key={v} active={config.voteTime === v} onClick={() => setConfig(c => ({ ...c, voteTime: v }))}>{v}ث</OptBtn>)}</div>
                                </div>
                                <div className="gb-field">
                                    <label>حبال النجاة</label>
                                    <div className="gb-choices">{LIVES_CHOICES.map(l => <OptBtn key={l} active={config.lives === l} color={EMBER} onClick={() => setConfig(c => ({ ...c, lives: l }))} sub={l === 1 ? 'سقوط واحد يُنهي' : l === 2 ? 'فرصة ثانية' : 'ثلاث محاولات'}>{l}</OptBtn>)}</div>
                                </div>
                                <div className="gb-field">
                                    <label>نقاط الخطوة</label>
                                    <div className="gb-choices">{POINTS_CHOICES.map(p => <OptBtn key={p} active={config.pointsPerStep === p} onClick={() => setConfig(c => ({ ...c, pointsPerStep: p }))}>{p}</OptBtn>)}</div>
                                    <p className="gb-help">تتضاعف مع كل خطوة، والخطوة الأخيرة ×2</p>
                                </div>
                                <div className="gb-field">
                                    <label>حد المشاركين</label>
                                    <div className="gb-choices">{PLAYER_CHOICES.map(p => <OptBtn key={p} active={config.maxPlayers === p} onClick={() => setConfig(c => ({ ...c, maxPlayers: p }))}>{p}</OptBtn>)}</div>
                                </div>
                            </div>

                            <div className="gb-card">
                                <div className="gb-card-head"><Sparkles size={14} style={{ color: GOLD }} /> <span>قوانين اللعب</span></div>
                                <ol className="gb-rules">
                                    <li><b>1</b><span>اكتب <em>{config.joinKeyword}</em> للانضمام، ثم صوّت بـ<b>يسار</b> أو <b>يمين</b> (أو 1 و 2)</span></li>
                                    <li><b>2</b><span>يمكنك تغيير اختيارك في أي وقت قبل انتهاء العد</span></li>
                                    <li><b>3</b><span>اللوح الغلط ينكسر، ومن فوقه يسقط للهاوية ويخسر حياة</span></li>
                                    <li><b>4</b><span>من لم يصوّت يسقط أيضاً — من ينجو بأعجوبة يحافظ على نقاطه</span></li>
                                    <li><b>5</b><span>كل ٣ عبورات متتالية = مكافأة <em>×1.5</em> والنار تشتعل</span></li>
                                    <li><b>6</b><span>من يعبر كل الخطوات يتوّج، والنقاط تُسجّل في لوحة الشرف</span></li>
                                </ol>

                                <div className="gb-field" style={{ marginTop: 14 }}>
                                    <label>خيارات</label>
                                    <div className="gb-switches">
                                        <SwitchRow label="سقوط بدون تصويت" hint="من لم يختر يسقط" value={config.nonVotersFall} onChange={() => setConfig(c => ({ ...c, nonVotersFall: !config.nonVotersFall }))} icon={Skull} color={EMBER} />
                                        <SwitchRow label="انضمام بالتصويت" hint="أي مصوّت يدخل تلقائياً" value={config.autoJoinOnVote} onChange={() => setConfig(c => ({ ...c, autoJoinOnVote: !config.autoJoinOnVote }))} icon={Users} />
                                        <SwitchRow label="خطوة تلقائية" hint="ينتقل وحده بعد الكشف" value={config.autoNext} onChange={() => setConfig(c => ({ ...c, autoNext: !config.autoNext }))} icon={RefreshCw} />
                                        <SwitchRow label="أصوات" hint="كسر الزجاج والتنبيه" value={config.sound} onChange={() => setConfig(c => ({ ...c, sound: !config.sound }))} icon={Volume2} />
                                    </div>
                                </div>

                                <div className="gb-preview">
                                    <div className="gb-preview-head">
                                        <span className="gb-preview-label">مخطط الجسر</span>
                                        <span className="gb-preview-note">الخطوة الأخيرة ×2 — والنقاط تزيد مع كل عبور</span>
                                    </div>
                                    <div className="gb-preview-track">
                                        {Array.from({ length: config.steps }).map((_, i) => {
                                            const last = i === config.steps - 1;
                                            return (
                                                <div key={i} className={`gb-preview-step ${last ? 'last' : ''}`}>
                                                    <b>{i + 1}</b>
                                                    <div className="gb-preview-pair"><span /><span /></div>
                                                    <em style={{ color: last ? EMBER : GOLD_LT }}>×{stepMult(i, config.steps).toFixed(2)}</em>
                                                    {last && <Trophy size={11} style={{ color: GOLD }} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => { setPhase('LOBBY'); tone(600, 0.14); }} className="gb-cta">
                            <Play size={20} fill="currentColor" /> افتح الجسر
                        </button>
                        <button onClick={onHome} className="gb-back"><LogOut size={14} /> العودة للرئيسية</button>
                    </div>
                </div>

                <SidebarPortal><GbSidebar {...{ phase: 'التحضير', players: participants.length, alive: participants.length, step, config, setConfig, copied, copyObs, stepCount: config.steps, log, votesLeft: votes.left.length, votesRight: votes.right.length }} /></SidebarPortal>
                <style>{GB_STYLES}</style>
            </div>
        );
    }

    /* =============================== اللوبي =============================== */
    if (phase === 'LOBBY') {
        return (
            <div className="gb-root" dir="rtl">
                <div className="gb-bg" />
                <div className="gb-scroll">
                    <div className="gb-inner">
                        <header className="gb-stage-head">
                            <div>
                                <h2 className="gb-h2">بانتظار العابرين</h2>
                                <p className="gb-p">اكتب كلمة الانضمام في الشات لتقف أول الطابور</p>
                            </div>
                            <div className="gb-pill"><Users size={14} /> {participants.length}/{config.maxPlayers}</div>
                        </header>

                        <div className="gb-keyword">
                            <span className="gb-keyword-label">اكتب في الشات</span>
                            <span className="gb-keyword-word">{config.joinKeyword}</span>
                        </div>

                        <div className="gb-people">
                            {participants.map(p => (
                                <div key={p.username} className="gb-person">
                                    <ProAvatar url={p.avatar} username={p.username} size="w-11 h-11" className="overflow-visible" />
                                    <span>{p.username}</span>
                                </div>
                            ))}
                            {!participants.length && (
                                <div className="gb-empty"><Activity size={20} style={{ color: GOLD }} /> لا أحد على الشاطئ بعد — الجسر ينتظر</div>
                            )}
                        </div>

                        <div className="gb-btn-row">
                            <button onClick={resetGame} className="gb-ghost"><X size={15} /> رجوع</button>
                            <button onClick={startGame} disabled={participants.length < 1} className="gb-solid">
                                <Footprints size={18} /> ابدأ العبور ({participants.length})
                            </button>
                        </div>
                    </div>
                </div>
                <SidebarPortal><GbSidebar {...{ phase: 'اللوبي', players: participants.length, alive: participants.length, step, config, setConfig, copied, copyObs, stepCount: config.steps, log, votesLeft: votes.left.length, votesRight: votes.right.length }} /></SidebarPortal>
                <style>{GB_STYLES}</style>
            </div>
        );
    }

    /* =============================== اللعب =============================== */
    const isReveal = phase === 'REVEAL';
    const isEnd = phase === 'VICTORY' || phase === 'GAME_OVER';

    return (
        <div className={`gb-root ${shake ? 'gb-shake' : ''}`} dir="rtl">
            <div className="gb-bg" />
            <div className="gb-abyss" />

            {/* شريط علوي */}
            <div className="gb-topbar">
                <div className="gb-topbar-grp">
                    <div className="gb-round-pill"><Footprints size={12} style={{ color: GOLD }} /> خطوة {Math.min(step + 1, config.steps)}/{config.steps}</div>
                    <div className="gb-mult-pill">×{mult.toFixed(2)} <span>+{gain}</span></div>
                </div>
                <div className="gb-topbar-grp">
                    {!isEnd && !isReveal && <button onClick={useHint} disabled={!curStep || curStep.hint} className="gb-tool hint" title="كشف لوح خطر — ينصّف نقاط الخطوة"><Eye size={14} /> {curStep?.hint ? 'الاستطلاع مستخدم' : 'استطلاع 50/50'}</button>}
                    {!isEnd && !isReveal && <button onClick={revealNow} className="gb-tool finish"><SwordsIcon size={14} /> اكشف الآن</button>}
                    {isReveal && !config.autoNext && <button onClick={nextStep} className="gb-tool finish"><ChevronRight size={14} /> الخطوة التالية</button>}
                    <button onClick={resetGame} className="gb-tool danger"><Ban size={14} /> إنهاء</button>
                </div>
            </div>

            {/* خريطة الجسر */}
            <div className="gb-map">
                {bridge.map((b, i) => {
                    const done = b.revealed;
                    const isNow = i === step && !done;
                    return (
                        <div key={i} className={`gb-pair ${isNow ? 'now' : ''} ${i === bridge.length - 1 ? 'last' : ''}`}>
                            <div className="gb-pair-n">{i + 1}</div>
                            <div className="gb-pair-tiles">
                                <span className={`gb-tile ${done && b.safe === 'left' ? 'safe' : ''} ${done && b.safe === 'right' ? 'broken' : ''}`} />
                                <span className={`gb-tile ${done && b.safe === 'right' ? 'safe' : ''} ${done && b.safe === 'left' ? 'broken' : ''}`} />
                            </div>
                        </div>
                    );
                })}
                <div className="gb-end-flag"><Trophy size={13} style={{ color: GOLD }} /></div>
            </div>

            {/* المسارح */}
            <div className="gb-stage">
                {/* يسار */}
                <SidePanel
                    side="left" label="يسار" hint="1"
                    names={votes.left}
                    tone={timeColor}
                    revealed={isReveal || isEnd}
                    isSafe={isReveal ? curStep?.safe === 'left' : (isEnd ? true : false)}
                    active={!isReveal && !isEnd}
                    count={votes.left.length}
                    total={votersTotal}
                    rival={votes.right.length}
                />

                <div className="gb-mid">
                    {isReveal || isEnd ? (
                        <div className="gb-verdict">
                            {isEnd ? <Trophy size={30} style={{ color: GOLD }} /> : <Footprints size={30} style={{ color: curStep?.safe === 'left' ? ICE : GOLD_LT }} />}
                            <b>{isEnd ? 'انتهى الجسر' : (curStep?.safe === 'left' ? 'اليسار آمن' : 'اليمين آمن')}</b>
                            {!isEnd && (
                                <div className="gb-verdict-nums">
                                    <span className="up">{lastSaved.length} عبر • +{lastGained}</span>
                                    <span className="dn">{lastFallen.length ? `${lastFallen.length} سقط` : 'لا خسائر'}</span>
                                    {lastOut.length > 0 && <span className="out">{lastOut.length} خرج</span>}
                                </div>
                            )}
                            <span>{aliveCount} على الجسر</span>
                        </div>
                    ) : (
                        <>
                            <TimerRing left={timeLeft} total={config.voteTime} size={112} color={timeColor} label="ثانية" pulse={timeLeft <= 3} />
                            <div className="gb-mid-hint">
                                <span>{aliveCount} حيّ من {participants.length}</span>
                                <span className="gb-mid-sep">•</span>
                                <span>{votersTotal} صوّت</span>
                            </div>
                            {curStep?.hint && (
                                <div className="gb-hint-badge"><Eye size={12} /> للعرض عليك فقط — الآمن <b>{curStep.safe === 'left' ? 'يسار' : 'يمين'}</b> • النقاط نصف</div>
                            )}
                        </>
                    )}
                </div>

                {/* يمين */}
                <SidePanel
                    side="right" label="يمين" hint="2"
                    names={votes.right}
                    tone={timeColor}
                    revealed={isReveal || isEnd}
                    isSafe={isReveal ? curStep?.safe === 'right' : (isEnd ? true : false)}
                    active={!isReveal && !isEnd}
                    count={votes.right.length}
                    total={votersTotal}
                    rival={votes.left.length}
                />
            </div>

            {/* شريط الأصوات */}
            <div className="gb-tallybar">
                <div className="gb-tally left" style={{ width: `${votersTotal ? (votes.left.length / votersTotal) * 100 : 50}%` }}>
                    <span>{votes.left.length}</span>
                </div>
                <div className="gb-tally right" style={{ width: `${votersTotal ? (votes.right.length / votersTotal) * 100 : 50}%` }}>
                    <span>{votes.right.length}</span>
                </div>
            </div>

            {/* نقاط طائرة */}
            {flash.length > 0 && (
                <div className="gb-flashes">
                    {flash.map(f => <div key={f.id} className={`gb-flash ${f.fire ? 'fire' : ''}`}>+{f.pts} {f.fire && <Zap size={12} fill="currentColor" />} <b>{f.name}</b></div>)}
                </div>
            )}

            {/* اللوحات الجانبية: الأحياء والساقطون */}
            <div className="gb-boards">
                <div className="gb-board">
                    <div className="gb-board-head"><Heart size={12} style={{ color: LIVE }} /> على الجسر <em>{aliveList.length}</em></div>
                    <div className="gb-board-body">
                        {aliveList.map(p => (
                            <div key={p.user.username} className="gb-row">
                                <ProAvatar url={p.user.avatar} username={p.user.username} size="w-7 h-7" className="overflow-visible" />
                                <b>{p.user.username}</b>
                                <span className="gb-hearts">{Array.from({ length: p.lives }).map((_, i) => <Heart key={i} size={9} fill={EMBER} style={{ color: EMBER }} />)}</span>
                                {p.streak >= STREAK_EVERY - 1 && <span className="gb-streak"><Flame size={10} fill="currentColor" />{p.streak}</span>}
                                <em>{p.score}</em>
                            </div>
                        ))}
                        {!aliveList.length && <div className="gb-board-empty">أفادتنا فارغة… مؤلم</div>}
                    </div>
                </div>
                <div className="gb-board dead">
                    <div className="gb-board-head"><Skull size={12} style={{ color: EMBER }} /> الهاوية <em>{deadList.length}</em></div>
                    <div className="gb-board-body">
                        {deadList.map(p => (
                            <div key={p.user.username} className={`gb-row dead ${isReveal && lastFallen.includes(p.user.username) ? 'falling' : ''}`}>
                                <ProAvatar url={p.user.avatar} username={p.user.username} size="w-7 h-7" className="overflow-visible grayscale" />
                                <b>{p.user.username}</b>
                                <span className="gb-crossed">{p.crossed} خطوة</span>
                                <em>{p.score}</em>
                            </div>
                        ))}
                        {!deadList.length && <div className="gb-board-empty">لا ساقطين بعد</div>}
                    </div>
                </div>
            </div>

            {/* شاشات النهاية */}
            {isEnd && (
                <div className="gb-endcover">
                    <div className="gb-endcard">
                        <div className="gb-endcard-icon">
                            {phase === 'VICTORY' ? <Trophy size={40} /> : <Skull size={40} />}
                        </div>
                        <h3>{phase === 'VICTORY' ? 'عبروا الجسر!' : 'الجميع سقطوا'}</h3>
                        <p>
                            {phase === 'VICTORY'
                                ? `${aliveList.length} ناجٍ من أصل ${participants.length} — آخر خطوة كانت ×${stepMult(config.steps - 1, config.steps).toFixed(2)}`
                                : `لم يبقَ أحد على الزجاج بعد ${step + 1} خطوة`}
                        </p>

                        <div className="gb-podium">
                            {ranked.slice(0, 8).map((p, i) => (
                                <div key={p.user.username} className={`gb-pod ${i === 0 && p.alive ? 'champ' : ''}`}>
                                    <span className="gb-pod-i">{i + 1}</span>
                                    <ProAvatar url={p.user.avatar} username={p.user.username} size="w-9 h-9" className="overflow-visible" />
                                    <b>{p.user.username}</b>
                                    <span className="gb-pod-c">{p.crossed}/{config.steps}</span>
                                    <em>{p.score}</em>
                                    {!p.alive && <Skull size={11} style={{ color: EMBER }} />}
                                </div>
                            ))}
                        </div>

                        <div className="gb-btn-row center">
                            <button onClick={startGame} className="gb-solid"><RefreshCw size={16} /> جسر جديد بنفس العابرين</button>
                            <button onClick={resetGame} className="gb-ghost"><Settings size={14} /> إعدادات جديدة</button>
                            <button onClick={onHome} className="gb-ghost"><Home size={14} /> الرئيسية</button>
                        </div>
                    </div>
                </div>
            )}

            <SidebarPortal>
                <GbSidebar
                    {...{ phase: isEnd ? 'الختام' : isReveal ? 'الكشف' : 'التصويت', players: participants.length, alive: aliveCount, step, config, setConfig, copied, copyObs, stepCount: config.steps, log, votesLeft: votes.left.length, votesRight: votes.right.length }}
                    word={isReveal && curStep ? (curStep.safe === 'left' ? 'اليسار آمن' : 'اليمين آمن') : undefined}
                    onReveal={revealNow}
                    onNext={config.autoNext ? undefined : nextStep}
                    onHint={useHint}
                    hintUsed={!!curStep?.hint}
                    canReferee={!isEnd && !isReveal}
                    timeLeft={timeLeft}
                    log={log}
                    votesLeft={votes.left.length}
                    votesRight={votes.right.length}
                    hintSafe={!isReveal && !isEnd && curStep?.hint ? curStep.safe : null}
                />
            </SidebarPortal>
            <style>{GB_STYLES}</style>
        </div>
    );
};

/* --------------------------- لوح جهة واحدة --------------------------- */

const SidePanel: React.FC<{
    side: Side; label: string; hint: string; names: string[]; tone: string;
    revealed: boolean; isSafe: boolean; active: boolean; count: number; total: number; rival: number;
}> = ({ side, label, hint, names, tone, revealed, isSafe, active, count, total, rival }) => {
    const broken = revealed && !isSafe;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const leading = active && count > 0 && count > rival;
    return (
        <div className={`gb-panel ${side} ${revealed ? (isSafe ? 'safe' : 'broken') : ''} ${active ? 'live' : ''}`}>
            <div className="gb-panel-glass" />
            <div className="gb-panel-fill" style={{ height: `${active ? pct : (isSafe ? 100 : 0)}%`, opacity: active ? 0.5 : 0.22 }} />
            <div className="gb-panel-top">
                <span className="gb-panel-key">{hint}</span>
                {broken ? <Skull size={22} style={{ color: '#ffb59a' }} /> : <ShieldCheck size={22} style={{ color: revealed ? LIVE : 'rgba(251,236,203,.35)' }} />}
                <span className="gb-panel-arrow">{side === 'left' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}</span>
            </div>
            <div className="gb-panel-name">{label}</div>
            <div className="gb-panel-count" style={{ color: active ? tone : undefined }}>
                {count}<em>/{total}</em>
                {active && <span className="gb-panel-pct">{pct}%</span>}
            </div>
            {leading && <div className="gb-panel-lead">الأغلب هنا</div>}
            <div className="gb-panel-voters">
                {names.slice(0, 10).map(u => <span key={u}>{u}</span>)}
                {names.length > 10 && <span className="more">+{names.length - 10}</span>}
                {!names.length && <span className="none">لم يختر أحد بعد</span>}
            </div>
            {broken && (
                <div className="gb-shards">{Array.from({ length: 10 }).map((_, i) => <i key={i} style={{ ['--a' as any]: `${-100 + i * 22}deg`, ['--d' as any]: `${50 + (i % 4) * 30}px` }} />)}</div>
            )}
            {revealed && isSafe && <div className="gb-sweep" />}
        </div>
    );
};

/* --------------------------- لوحة تحكم المذيع --------------------------- */

const GbSidebar: React.FC<{
    phase: string; players: number; alive: number; step: number; stepCount: number;
    config: GBConfig; setConfig: React.Dispatch<React.SetStateAction<GBConfig>>;
    copied: boolean; copyObs: () => void; word?: string;
    onReveal?: () => void; onNext?: () => void; onHint?: () => void; hintUsed?: boolean; canReferee?: boolean;
    timeLeft?: number; log?: GBLog[]; votesLeft?: number; votesRight?: number; hintSafe?: Side | null;
}> = ({ phase, players, alive, step, stepCount, config, setConfig, copied, copyObs, word, onReveal, onNext, onHint, hintUsed, canReferee, timeLeft, log = [], votesLeft = 0, votesRight = 0, hintSafe = null }) => (
    <>
        <Section title="حالة الجسر" icon={Gauge}>
            <div className="flex items-center justify-between text-[9px] font-black text-icg-cream/80">
                <span>{phase}</span>
                <span className="text-icg-gold">خطوة {Math.min(step + 1, stepCount)}/{stepCount}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded-lg bg-icg-gold/5 border border-icg-gold/10 py-1">
                    <b className="block text-[13px] font-black text-icg-gold tabular-nums">{typeof timeLeft === 'number' ? timeLeft : '—'}</b>
                    <span className="text-[7px] font-black text-icg-muted tracking-widest">ثانية</span>
                </div>
                <div className="rounded-lg bg-icg-gold/5 border border-icg-gold/10 py-1">
                    <b className="block text-[13px] font-black text-icg-cream tabular-nums">{players}</b>
                    <span className="text-[7px] font-black text-icg-muted tracking-widest">مسجل</span>
                </div>
                <div className="rounded-lg bg-icg-gold/5 border border-icg-gold/10 py-1">
                    <b className="block text-[13px] font-black text-[#4be07a] tabular-nums">{alive}</b>
                    <span className="text-[7px] font-black text-icg-muted tracking-widest">حي</span>
                </div>
            </div>
            {word && (
                <div className="rounded-xl bg-icg-gold/10 border border-icg-gold/20 px-2 py-1.5 text-center">
                    <span className="block text-[7px] font-black text-icg-muted tracking-[0.2em]">اللوح الآمن</span>
                    <span className="block text-[13px] font-black text-icg-gold">{word}</span>
                </div>
            )}
            {hintSafe && (
                <div className="rounded-xl px-2 py-1.5 text-center" style={{ background: 'rgba(232,85,47,.12)', border: '1px dashed rgba(232,85,47,.4)' }}>
                    <span className="block text-[7px] font-black text-icg-muted tracking-[0.2em]">استطلاع — لا يظهر على البث</span>
                    <span className="block text-[13px] font-black" style={{ color: EMBER }}>الآمن: {hintSafe === 'left' ? 'يسار' : 'يمين'}</span>
                </div>
            )}
            {canReferee && (
                <div className="grid grid-cols-2 gap-1">
                    <OptBtn color="#4be07a" active={false} onClick={() => onReveal?.()}>اكشف الآن</OptBtn>
                    <OptBtn color="#e8552f" active={!!hintUsed} onClick={() => onHint?.()}>{hintUsed ? 'استُخدم الاستطلاع' : 'استطلاع'}</OptBtn>
                </div>
            )}
            {onNext && (
                <OptBtn active color={GOLD} onClick={onNext}>الخطوة التالية</OptBtn>
            )}
        </Section>

        <Section title="توزيع التصويت" icon={Activity}>
            <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-icg-cream/70 w-7">يسار</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/5 flex">
                    <i className="block h-full" style={{ width: `${(votesLeft + votesRight) ? (votesLeft / (votesLeft + votesRight)) * 100 : 50}%`, background: '#9fe8ff' }} />
                    <i className="block h-full flex-1" style={{ background: 'rgba(232,190,110,.55)' }} />
                </div>
                <span className="text-[9px] font-black text-icg-cream/70 w-7">يمين</span>
            </div>
            <div className="flex justify-between text-[10px] font-black tabular-nums">
                <span style={{ color: '#9fe8ff' }}>{votesLeft}</span>
                <span className="text-icg-muted">{votesLeft + votesRight} مصوّت</span>
                <span style={{ color: GOLD }}>{votesRight}</span>
            </div>
        </Section>

        {log.length > 0 && (
            <Section title="تاريخ الجسر" icon={Footprints}>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {log.slice(-8).reverse().map(l => (
                        <div key={l.step} className="flex items-center justify-between gap-1 rounded-lg px-2 py-1 bg-icg-gold/5 border border-icg-gold/10 text-[8.5px] font-black">
                            <span className="text-icg-muted">خطوة {l.step}</span>
                            <span className="text-icg-gold">{l.safe === 'left' ? 'يسار آمن' : 'يمين آمن'}</span>
                            <span className="text-[#4be07a]">{l.crossed} عبر</span>
                            {l.out > 0 && <span style={{ color: EMBER }}>{l.out} خرج</span>}
                        </div>
                    ))}
                </div>
            </Section>
        )}

        <Section title="رابط البث" icon={Monitor} color="#4be07a">
            <button
                onClick={copyObs}
                className="w-full rounded-xl py-2.5 text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                    background: copied ? 'rgba(75,224,122,0.18)' : 'linear-gradient(135deg,#f9e0a4,#a97a30)',
                    border: `1px solid ${copied ? 'rgba(75,224,122,.6)' : 'rgba(232,190,110,.45)'}`,
                    color: copied ? '#4be07a' : '#1a1006',
                    boxShadow: copied ? 'none' : '0 8px 22px rgba(232,190,110,.22)',
                }}
            >
                {copied ? <><Check size={13} /> تم نسخ الرابط</> : <><Copy size={13} /> نسخ رابط OBS</>}
            </button>
            <p className="text-[8px] font-bold text-icg-muted/80 leading-relaxed">
                مشفّر وغير معروض على الشاشة — يُضاف في OBS كمصدر متصفح، وتظهر الجسر والنتائج فقط بدون أدوات تحكم.
            </p>
            <div className="flex items-start gap-1.5 rounded-xl px-2 py-1.5" style={{ background: 'rgba(232,85,47,0.12)', border: '1px solid rgba(232,85,47,0.35)' }}>
                <ShieldAlert size={12} style={{ color: EMBER, marginTop: 1, flexShrink: 0 }} />
                <span className="text-[8.5px] font-black leading-relaxed" style={{ color: '#ffb59a' }}>
                    ممنوع ينتشر! الرابط للمذيع فقط — نشره يكشف اللوح الآمن على البث.
                </span>
            </div>
        </Section>

        <Section title="إعدادات سريعة" icon={Settings}>
            <div className="space-y-1">
                <SwitchRow label="سقوط بدون تصويت" value={config.nonVotersFall} onChange={() => setConfig(c => ({ ...c, nonVotersFall: !c.nonVotersFall }))} icon={Skull} color={EMBER} />
                <SwitchRow label="انضمام بالتصويت" value={config.autoJoinOnVote} onChange={() => setConfig(c => ({ ...c, autoJoinOnVote: !c.autoJoinOnVote }))} icon={Users} />
                <SwitchRow label="خطوة تلقائية" value={config.autoNext} onChange={() => setConfig(c => ({ ...c, autoNext: !c.autoNext }))} icon={RefreshCw} />
                <SwitchRow label="أصوات" value={config.sound} onChange={() => setConfig(c => ({ ...c, sound: !c.sound }))} icon={Volume2} />
            </div>
            <div className="grid grid-cols-4 gap-1">
                {VOTE_CHOICES.slice(0, 4).map(v => (
                    <OptBtn key={v} active={config.voteTime === v} onClick={() => setConfig(c => ({ ...c, voteTime: v }))}>{v}ث</OptBtn>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
                {LIVES_CHOICES.map(l => (
                    <OptBtn key={l} color={EMBER} active={config.lives === l} onClick={() => setConfig(c => ({ ...c, lives: l }))}>{l} حياة</OptBtn>
                ))}
            </div>
        </Section>
    </>
);

/* =============================== التنسيقات =============================== */

const GB_STYLES = `
.gb-root, .gb-obs {
  --g:#e8be6e; --gl:#f9e0a4; --gd:#a97a30; --bz:#5a3a14; --bw:#2a1a08;
  --ink:#0a0805; --cr:#fbeccb; --mu:#b2a283; --em:#e8552f; --lv:#4be07a; --ice:#9fe8ff;
}
.gb-root { position:relative; flex:1 1 auto; width:100%; min-height:0; display:flex; flex-direction:column;
  background: linear-gradient(180deg, #1b1207 0%, #100a05 45%, #050403 100%); color:var(--cr); overflow:hidden; }
.gb-bg { position:absolute; inset:0; pointer-events:none; opacity:.5;
  background: radial-gradient(70% 45% at 50% 0%, rgba(232,190,110,.18), transparent 70%),
              radial-gradient(50% 40% at 15% 100%, rgba(159,232,255,.08), transparent 70%); }
.gb-abyss { position:absolute; left:0; right:0; bottom:0; height:26%; pointer-events:none;
  background: linear-gradient(180deg, transparent, rgba(232,85,47,.10) 55%, rgba(0,0,0,.85)); }
.gb-scroll { position:relative; flex:1 1 auto; min-height:0; overflow-y:auto; }
.gb-scroll::-webkit-scrollbar{width:8px} .gb-scroll::-webkit-scrollbar-thumb{background:rgba(232,190,110,.22);border-radius:99px}
.gb-inner { width:min(1180px,100%); margin:0 auto; padding:20px 20px 40px; }

.gb-hero { display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:16px 18px; border-radius:22px;
  background:linear-gradient(135deg, rgba(232,190,110,.1), rgba(10,8,5,.6)); border:1px solid rgba(232,190,110,.18); }
.gb-hero-icon { width:54px; height:54px; border-radius:18px; display:grid; place-items:center; color:#1a1006;
  background:linear-gradient(135deg,var(--gl),var(--gd)); box-shadow:0 0 32px rgba(232,190,110,.4); }
.gb-hero-text { flex:1 1 250px; }
.gb-title { font-size:29px; font-weight:900; font-style:italic; color:#fff; margin:0; letter-spacing:-.02em; text-shadow:0 0 24px rgba(232,190,110,.32); }
.gb-sub { font-size:11.5px; font-weight:700; color:rgba(251,236,203,.6); margin:4px 0 0; }
.gb-hero-stats { display:flex; gap:9px; }
.gb-stat { min-width:70px; padding:8px 10px; border-radius:14px; text-align:center; background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.14); }
.gb-stat b { display:block; font-size:18px; font-weight:900; color:var(--g); }
.gb-stat span { font-size:8px; font-weight:900; color:var(--mu); letter-spacing:.14em; }

.gb-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(350px,1fr)); gap:16px; margin-top:16px; }
.gb-card { padding:16px; border-radius:22px; background:linear-gradient(180deg, rgba(42,26,8,.48), rgba(10,8,5,.74));
  border:1px solid rgba(232,190,110,.13); box-shadow:inset 0 1px 0 rgba(249,224,164,.06), 0 18px 40px rgba(0,0,0,.4); }
.gb-card-head { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:900; color:var(--cr);
  padding-bottom:10px; margin-bottom:12px; border-bottom:1px solid rgba(232,190,110,.12); }
.gb-field { margin-bottom:13px; }
.gb-field label { display:block; font-size:9px; font-weight:900; color:rgba(178,162,131,.85); letter-spacing:.18em; margin-bottom:6px; }
.gb-help { font-size:9px; font-weight:700; color:rgba(178,162,131,.55); margin:5px 0 0; }
.gb-input { width:100%; background:rgba(10,8,5,.7); border:1px solid rgba(232,190,110,.22); border-radius:14px;
  padding:10px 14px; font-size:15px; font-weight:900; color:var(--cr); outline:none; text-align:center; }
.gb-input:focus { border-color:var(--g); box-shadow:0 0 0 3px rgba(232,190,110,.14); }
.gb-choices { display:grid; grid-template-columns:repeat(auto-fit,minmax(50px,1fr)); gap:6px; }
.gb-switches { display:flex; flex-direction:column; gap:6px; }

.gb-rules { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.gb-rules li { display:flex; align-items:flex-start; gap:9px; font-size:11px; font-weight:700; color:rgba(251,236,203,.72); }
.gb-rules li b { width:20px; height:20px; flex-shrink:0; display:grid; place-items:center; border-radius:7px; font-size:10px; font-weight:900;
  color:#1a1006; background:linear-gradient(135deg,var(--gl),var(--gd)); }
.gb-rules li em { font-style:normal; color:var(--g); font-weight:900; }
.gb-rules li span b { display:inline; width:auto; height:auto; background:none; color:var(--ice); font-size:11px; }

.gb-preview { margin-top:14px; padding:12px; border-radius:18px; background:rgba(10,8,5,.5); border:1px solid rgba(159,232,255,.14); }
.gb-preview-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:9px; flex-wrap:wrap; }
.gb-preview-label { font-size:9px; font-weight:900; letter-spacing:.2em; color:var(--mu); }
.gb-preview-note { font-size:8.5px; font-weight:700; color:rgba(178,162,131,.6); }
.gb-preview-track { display:flex; gap:5px; overflow-x:auto; padding-bottom:5px; }
.gb-preview-track::-webkit-scrollbar{height:5px} .gb-preview-track::-webkit-scrollbar-thumb{background:rgba(232,190,110,.2);border-radius:99px}
.gb-preview-step { flex-shrink:0; width:42px; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px 2px; border-radius:11px;
  background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.12); }
.gb-preview-step b { font-size:9px; font-weight:900; color:var(--mu); }
.gb-preview-step em { font-style:normal; font-size:8.5px; font-weight:900; }
.gb-preview-step.last { background:rgba(232,190,110,.12); border-color:rgba(232,190,110,.45); box-shadow:0 0 18px rgba(232,190,110,.2); }
.gb-preview-pair { display:flex; gap:2px; }
.gb-preview-pair span { width:13px; height:22px; border-radius:3px; background:linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.13); }

.gb-cta { width:100%; margin-top:18px; padding:19px; border:none; border-radius:22px; cursor:pointer; font-size:18px; font-weight:900;
  font-style:italic; color:#1a1006; display:flex; align-items:center; justify-content:center; gap:11px;
  background:linear-gradient(135deg,var(--gl),var(--g) 45%,var(--gd)); box-shadow:0 22px 50px rgba(232,190,110,.3); transition:.22s; }
.gb-cta:hover { transform:translateY(-2px); filter:brightness(1.06); }
.gb-cta:active { transform:scale(.98); }
.gb-back { display:flex; align-items:center; gap:5px; margin:14px auto 0; background:none; border:none; cursor:pointer;
  font-size:10px; font-weight:900; letter-spacing:.16em; color:rgba(178,162,131,.5); }
.gb-back:hover { color:var(--cr); }

.gb-stage-head { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:16px; flex-wrap:wrap; }
.gb-h2 { font-size:23px; font-weight:900; font-style:italic; color:#fff; margin:0; }
.gb-p { font-size:11px; font-weight:700; color:rgba(251,236,203,.55); margin:4px 0 0; }
.gb-pill { display:flex; align-items:center; gap:7px; padding:8px 14px; border-radius:99px; font-size:11px; font-weight:900;
  color:var(--g); background:rgba(232,190,110,.1); border:1px solid rgba(232,190,110,.26); }
.gb-keyword { display:flex; align-items:center; justify-content:center; gap:14px; padding:18px; border-radius:22px; margin-bottom:16px;
  background:linear-gradient(135deg, rgba(232,190,110,.12), rgba(10,8,5,.6)); border:1px solid rgba(232,190,110,.2); }
.gb-keyword-label { font-size:11px; font-weight:900; color:var(--mu); letter-spacing:.14em; }
.gb-keyword-word { font-size:29px; font-weight:900; font-style:italic; color:var(--g); padding:6px 26px; border-radius:16px;
  background:rgba(232,190,110,.12); border:2px solid rgba(232,190,110,.4); box-shadow:0 0 40px rgba(232,190,110,.18); }
.gb-people { display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:10px; }
.gb-person { display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 6px; border-radius:16px;
  background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.12); animation:gbPop .35s ease-out; }
.gb-person span { font-size:10px; font-weight:900; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gb-empty { grid-column:1/-1; display:flex; align-items:center; justify-content:center; gap:9px; padding:40px 0;
  font-size:11px; font-weight:900; color:rgba(178,162,131,.55); }
@keyframes gbPop { from{opacity:0; transform:scale(.86)} to{opacity:1; transform:scale(1)} }

.gb-btn-row { display:flex; gap:11px; margin-top:20px; flex-wrap:wrap; }
.gb-btn-row.center { justify-content:center; }
.gb-solid { display:flex; align-items:center; gap:9px; padding:15px 30px; border:none; border-radius:18px; cursor:pointer;
  font-size:14px; font-weight:900; color:#1a1006; background:linear-gradient(135deg,var(--gl),var(--gd)); box-shadow:0 18px 38px rgba(232,190,110,.26); transition:.2s; }
.gb-solid:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.06); }
.gb-solid:disabled { opacity:.35; cursor:not-allowed; }
.gb-ghost { display:flex; align-items:center; gap:7px; padding:14px 20px; border-radius:18px; cursor:pointer; font-size:11px; font-weight:900;
  color:var(--mu); background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.14); transition:.2s; }
.gb-ghost:hover { color:var(--cr); border-color:rgba(232,190,110,.34); }

/* لعب */
.gb-topbar { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 14px; flex-wrap:wrap;
  background:rgba(16,11,6,.86); border-bottom:1px solid rgba(232,190,110,.16); backdrop-filter:blur(12px); z-index:40; flex-shrink:0; }
.gb-topbar-grp { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.gb-round-pill { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:99px; font-size:10px; font-weight:900;
  color:var(--g); background:rgba(232,190,110,.1); border:1px solid rgba(232,190,110,.26); }
.gb-mult-pill { display:flex; align-items:center; gap:7px; padding:6px 12px; border-radius:99px; font-size:10px; font-weight:900;
  color:var(--ice); background:rgba(159,232,255,.08); border:1px solid rgba(159,232,255,.22); }
.gb-mult-pill span { color:var(--g); }
.gb-tool { display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:12px; cursor:pointer; font-size:10px; font-weight:900;
  color:rgba(251,236,203,.6); background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); transition:.18s; }
.gb-tool:hover:not(:disabled) { color:var(--cr); background:rgba(232,190,110,.12); border-color:rgba(232,190,110,.32); }
.gb-tool.finish { color:var(--lv); border-color:rgba(75,224,122,.34); background:rgba(75,224,122,.1); }
.gb-tool.hint { color:var(--g); border-color:rgba(232,190,110,.3); background:rgba(232,190,110,.08); border-style:dashed; }
.gb-tool:disabled { opacity:.4; cursor:default; }
.gb-tool.danger:hover { color:#ff9a7a; background:rgba(232,85,47,.16); border-color:rgba(232,85,47,.42); }

.gb-map { display:flex; align-items:center; gap:6px; padding:10px 14px; overflow-x:auto; z-index:30; flex-shrink:0;
  background:linear-gradient(180deg, rgba(10,8,5,.5), transparent); border-bottom:1px solid rgba(232,190,110,.08); }
.gb-map::-webkit-scrollbar{height:5px} .gb-map::-webkit-scrollbar-thumb{background:rgba(232,190,110,.2);border-radius:99px}
.gb-pair { position:relative; display:flex; flex-direction:column; align-items:center; gap:3px; padding:5px 6px; border-radius:12px;
  background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06); flex-shrink:0; transition:.25s; }
.gb-pair-n { font-size:8px; font-weight:900; color:rgba(178,162,131,.6); }
.gb-pair-tiles { display:flex; gap:3px; }
.gb-tile { width:15px; height:24px; border-radius:3px; background:linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.14); }
.gb-tile.safe { background:linear-gradient(180deg, rgba(75,224,122,.55), rgba(75,224,122,.12)); border-color:rgba(75,224,122,.7);
  box-shadow:0 0 12px rgba(75,224,122,.45); }
.gb-tile.broken { background:linear-gradient(180deg, rgba(232,85,47,.3), rgba(232,85,47,.05)); border-color:rgba(232,85,47,.5); opacity:.65; }
.gb-pair.now { border-color:rgba(232,190,110,.55); background:rgba(232,190,110,.1); animation:gbBreathe 1.5s infinite; }
.gb-pair.last { border-color:rgba(232,190,110,.3); }
.gb-end-flag { display:grid; place-items:center; width:26px; height:34px; border-radius:9px; background:rgba(232,190,110,.14);
  border:1px solid rgba(232,190,110,.4); flex-shrink:0; }
@keyframes gbBreathe { 0%,100%{box-shadow:0 0 0 rgba(232,190,110,0)} 50%{box-shadow:0 0 20px rgba(232,190,110,.35)} }

.gb-stage { flex:1 1 auto; min-height:0; display:flex; align-items:center; justify-content:center; gap:clamp(10px,4vw,48px);
  padding:10px 14px 0; position:relative; z-index:20; }
.gb-mid { display:flex; flex-direction:column; align-items:center; gap:10px; min-width:150px; }
.gb-mid-hint { display:flex; align-items:center; gap:8px; font-size:10px; font-weight:900; color:var(--mu); }
.gb-mid-sep { opacity:.35; }
.gb-hint-badge { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:99px; font-size:9px; font-weight:900;
  color:var(--g); background:rgba(232,190,110,.12); border:1px dashed rgba(232,190,110,.4); }
.gb-hint-badge b { color:#fff; font-size:11px; padding:0 4px; }

.gb-panel { position:relative; width:clamp(150px,24vw,230px); aspect-ratio:3/4; border-radius:20px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:6px; padding:14px; overflow:hidden; transition:.3s cubic-bezier(.4,0,.2,1);
  background:linear-gradient(160deg, rgba(180,235,255,.12), rgba(255,255,255,.02) 55%, rgba(0,0,0,.3));
  border:2px solid rgba(159,232,255,.3);
  box-shadow:inset 0 0 40px rgba(159,232,255,.06), inset 0 1px 0 rgba(255,255,255,.22), 0 18px 40px rgba(0,0,0,.45); }
.gb-panel.right { background:linear-gradient(160deg, rgba(232,190,110,.14), rgba(255,255,255,.02) 55%, rgba(0,0,0,.3));
  border-color:rgba(232,190,110,.34); }
.gb-panel-glass { position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(115deg, rgba(255,255,255,.14) 0%, transparent 22%, transparent 76%, rgba(255,255,255,.06) 100%),
             repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 26px); }
.gb-panel-fill { position:absolute; left:0; right:0; bottom:0; pointer-events:none; transition:height .6s cubic-bezier(.4,0,.2,1);
  background:linear-gradient(180deg, rgba(232,190,110,.6), rgba(232,190,110,.04)); }
.gb-panel.left .gb-panel-fill { background:linear-gradient(180deg, rgba(159,232,255,.55), rgba(159,232,255,.04)); }
.gb-panel.safe .gb-panel-fill { background:linear-gradient(180deg, rgba(75,224,122,.5), rgba(75,224,122,.04)); }
.gb-panel.broken .gb-panel-fill { background:linear-gradient(180deg, rgba(232,85,47,.4), rgba(232,85,47,.03)); }
.gb-panel.live { animation:gbGlass 3s ease-in-out infinite; }
.gb-panel.left.live { border-color:rgba(159,232,255,.45); }
.gb-panel.right.live { border-color:rgba(232,190,110,.45); }
@keyframes gbGlass { 0%,100%{box-shadow:inset 0 0 30px rgba(159,232,255,.05), 0 14px 30px rgba(0,0,0,.4)} 50%{box-shadow:inset 0 0 55px rgba(232,190,110,.12), 0 20px 48px rgba(0,0,0,.5)} }
.gb-panel-top { display:flex; align-items:center; justify-content:space-between; width:100%; z-index:2; }
.gb-panel-key { width:24px; height:24px; display:grid; place-items:center; border-radius:8px; font-size:11px; font-weight:900;
  color:rgba(251,236,203,.6); background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.12); }
.gb-panel-arrow { opacity:.5; }
.gb-panel-name { font-size:26px; font-weight:900; font-style:italic; color:#fff; letter-spacing:-.01em; text-shadow:0 0 22px rgba(0,0,0,.6); z-index:2; }
.gb-panel-count { position:relative; z-index:2; display:flex; align-items:baseline; gap:7px; font-size:22px; font-weight:900; font-style:italic; color:var(--cr); }
.gb-panel-count em { font-size:11px; font-style:normal; font-weight:900; opacity:.45; margin-inline-start:2px; }
.gb-panel-pct { font-size:12px; font-style:normal; font-weight:900; color:var(--gl); opacity:.85; }
.gb-panel-lead { z-index:2; padding:2px 10px; border-radius:99px; font-size:8.5px; font-weight:900; color:#1a1006;
  background:linear-gradient(135deg,var(--gl),var(--gd)); box-shadow:0 6px 16px rgba(232,190,110,.3); }
.gb-panel-voters { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; max-height:74px; overflow:hidden; z-index:2; }
.gb-panel-voters span { font-size:8.5px; font-weight:900; padding:2px 7px; border-radius:99px;
  background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.1); color:rgba(251,236,203,.75); }
.gb-panel-voters span.more { color:var(--g); border-color:rgba(232,190,110,.35); }
.gb-panel-voters span.none { opacity:.4; border-style:dashed; }
.gb-panel.safe { border-color:rgba(75,224,122,.7); background:linear-gradient(160deg, rgba(75,224,122,.2), rgba(75,224,122,.03));
  box-shadow:0 0 60px rgba(75,224,122,.35), inset 0 0 40px rgba(75,224,122,.1); transform:translateY(-4px); }
.gb-panel.broken { border-color:rgba(232,85,47,.75); background:linear-gradient(160deg, rgba(232,85,47,.2), rgba(0,0,0,.5));
  box-shadow:0 0 50px rgba(232,85,47,.35); animation:gbBreak .6s ease-out; }
@keyframes gbBreak { 0%{transform:scale(1)} 25%{transform:scale(1.04) rotate(-1.2deg)} 60%{transform:scale(.98) rotate(.8deg)} 100%{transform:scale(1)} }
.gb-sweep { position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(100deg, transparent 30%, rgba(249,224,164,.5) 50%, transparent 70%);
  transform:translateX(-100%); animation:gbSweep 1.2s ease-out .1s; }
@keyframes gbSweep { to { transform:translateX(100%); } }
.gb-shards { position:absolute; inset:0; pointer-events:none; }
.gb-shards i { position:absolute; top:50%; left:50%; width:9px; height:14px; border-radius:2px;
  background:linear-gradient(160deg, rgba(255,255,255,.75), rgba(232,85,47,.5));
  animation:gbShard 1.3s ease-out forwards; }
@keyframes gbShard { to { transform:translate(calc(cos(var(--a)) * var(--d) * -1), calc(sin(var(--a)) * var(--d) + 140px)) rotate(220deg); opacity:0; } }

.gb-tallybar { display:flex; height:10px; margin:10px 16px 0; border-radius:99px; overflow:hidden;
  background:rgba(10,8,5,.7); border:1px solid rgba(232,190,110,.14); flex-shrink:0; }
.gb-tally { position:relative; display:flex; align-items:center; justify-content:center; transition:width .6s cubic-bezier(.4,0,.2,1); min-width:34px; }
.gb-tally.left { background:linear-gradient(90deg, rgba(159,232,255,.55), rgba(159,232,255,.2)); }
.gb-tally.right { background:linear-gradient(90deg, rgba(232,190,110,.2), rgba(232,190,110,.6)); }
.gb-tally span { font-size:8px; font-weight:900; color:#0a0805; }

.gb-flashes { position:absolute; top:110px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; gap:5px; z-index:35; pointer-events:none; }
.gb-flash { display:flex; align-items:center; gap:4px; font-size:13px; font-weight:900; font-style:italic; color:var(--lv); text-shadow:0 0 18px rgba(75,224,122,.5); animation:gbFloatUp 2.2s ease-out forwards; }
.gb-flash.fire { color:var(--gl); text-shadow:0 0 20px rgba(232,190,110,.7); }
.gb-flash b { color:var(--cr); font-size:11px; font-style:normal; margin-inline-start:4px; }
.gb-streak { display:flex; align-items:center; gap:2px; font-size:8px; font-weight:900; color:var(--gl);
  background:rgba(232,190,110,.14); border:1px solid rgba(232,190,110,.32); padding:1px 6px; border-radius:99px; }
@keyframes gbFloatUp { 0%{opacity:0; transform:translateY(14px)} 20%{opacity:1} 100%{opacity:0; transform:translateY(-26px)} }

.gb-boards { display:flex; gap:12px; padding:12px 16px 14px; z-index:25; flex-shrink:0; }
.gb-board { flex:1 1 0; min-width:0; border-radius:18px; padding:10px; background:rgba(10,8,5,.55); border:1px solid rgba(232,190,110,.12); }
.gb-board.dead { border-color:rgba(232,85,47,.18); }
.gb-board-head { display:flex; align-items:center; gap:6px; font-size:9px; font-weight:900; letter-spacing:.16em; color:var(--mu); margin-bottom:8px; }
.gb-board-head em { font-style:normal; margin-inline-start:auto; color:var(--g); }
.gb-board-body { display:flex; flex-wrap:wrap; gap:6px; max-height:96px; overflow-y:auto; }
.gb-board-body::-webkit-scrollbar{width:5px} .gb-board-body::-webkit-scrollbar-thumb{background:rgba(232,190,110,.2);border-radius:99px}
.gb-row { display:flex; align-items:center; gap:6px; padding:4px 9px 4px 5px; border-radius:99px; font-size:10px; font-weight:900;
  background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.07); animation:gbPop .3s ease-out; }
.gb-row b { color:var(--cr); max-width:96px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gb-row em { color:var(--g); font-style:normal; }
.gb-row .gb-hearts, .gb-row .gb-crossed { opacity:.85; }
.gb-row .gb-crossed { font-size:8px; color:var(--mu); }
.gb-row.dead { background:rgba(232,85,47,.07); border-color:rgba(232,85,47,.18); }
.gb-row.dead b { color:rgba(251,236,203,.45); text-decoration:line-through; text-decoration-color:rgba(232,85,47,.6); }
.gb-row.dead em { color:rgba(232,190,110,.4); }
.gb-row.falling { animation:gbFall 1.1s ease-in forwards; }
@keyframes gbFall { to { transform:translateY(28px) rotate(-6deg); opacity:0; } }
.gb-board-empty { font-size:9px; font-weight:900; color:rgba(178,162,131,.4); padding:6px 2px; }

.gb-shake { animation:gbShake .6s ease-in-out; }
@keyframes gbShake { 0%,100%{transform:translate(0)} 20%{transform:translate(-5px,3px)} 40%{transform:translate(4px,-3px)} 60%{transform:translate(-3px,-2px)} 80%{transform:translate(3px,2px)} }
.gb-breathe { animation:gbBreathe 1s ease-in-out infinite; }

.gb-endcover { position:absolute; inset:0; z-index:900; display:grid; place-items:center; padding:18px;
  background:radial-gradient(60% 50% at 50% 40%, rgba(232,190,110,.14), rgba(5,4,3,.9) 70%); backdrop-filter:blur(6px); animation:gbPop .4s ease-out; }
.gb-endcard { width:min(720px,100%); max-height:100%; overflow-y:auto; padding:24px; border-radius:28px; text-align:center;
  background:linear-gradient(180deg, rgba(42,26,8,.92), rgba(10,8,5,.96)); border:1px solid rgba(232,190,110,.28);
  box-shadow:0 40px 90px rgba(0,0,0,.6); }
.gb-endcard-icon { width:76px; height:76px; margin:0 auto 12px; border-radius:24px; display:grid; place-items:center; color:#1a1006;
  background:linear-gradient(135deg,var(--gl),var(--gd)); box-shadow:0 0 46px rgba(232,190,110,.5); animation:gbBreathe 2.4s infinite; }
.gb-endcard h3 { font-size:28px; font-weight:900; font-style:italic; color:#fff; margin:0 0 6px; }
.gb-endcard p { font-size:11px; font-weight:700; color:var(--mu); margin:0 0 16px; }
.gb-podium { display:flex; flex-direction:column; gap:6px; margin-bottom:6px; }
.gb-pod { display:flex; align-items:center; gap:9px; padding:8px 11px; border-radius:14px; text-align:start;
  background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.1); animation:gbSlideUp .4s ease-out backwards; }
.gb-pod:nth-child(1){animation-delay:.05s} .gb-pod:nth-child(2){animation-delay:.12s} .gb-pod:nth-child(3){animation-delay:.19s} .gb-pod:nth-child(4){animation-delay:.26s}
.gb-pod.champ { background:linear-gradient(90deg, rgba(232,190,110,.2), rgba(232,190,110,.03)); border-color:rgba(232,190,110,.5); box-shadow:0 0 30px rgba(232,190,110,.18); }
.gb-pod-i { width:20px; font-size:11px; font-weight:900; color:var(--mu); }
.gb-pod b { flex:1; font-size:12px; font-weight:900; color:var(--cr); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gb-pod-c { font-size:9px; font-weight:900; color:rgba(159,232,255,.7); }
.gb-pod em { font-style:normal; min-width:44px; text-align:end; font-size:13px; font-weight:900; color:var(--g); }
@keyframes gbSlideUp { from{opacity:0; transform:translateY(12px)} to{opacity:1; transform:none} }
.gb-verdict { display:flex; flex-direction:column; align-items:center; gap:7px; padding:16px 22px; border-radius:22px; text-align:center;
  background:rgba(10,8,5,.72); border:1px solid rgba(232,190,110,.32); box-shadow:0 0 46px rgba(232,190,110,.16); animation:gbPop .4s ease-out; }
.gb-verdict b { font-size:19px; font-weight:900; font-style:italic; color:#fff; }
.gb-verdict span { font-size:10px; font-weight:900; color:var(--mu); }
.gb-verdict-nums { display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:center; }
.gb-verdict-nums span { padding:3px 9px; border-radius:99px; font-size:9.5px; font-weight:900; }
.gb-verdict-nums .up { color:#0a0805; background:linear-gradient(135deg,var(--gl),var(--gd)); }
.gb-verdict-nums .dn { color:#ffb59a; background:rgba(232,85,47,.16); border:1px solid rgba(232,85,47,.4); }
.gb-verdict-nums .out { color:#fff; background:rgba(232,85,47,.5); }

/* OBS */
.gb-obs { position:relative; width:100%; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:22px; background:transparent; overflow:hidden; color:var(--cr); font-family:'Cairo',sans-serif; }
.gb-obs-top { position:absolute; top:22px; display:flex; gap:12px; z-index:5; }
.gb-obs-pill { display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:18px; font-size:17px; font-weight:900;
  color:var(--cr); background:rgba(10,8,5,.72); border:1px solid rgba(232,190,110,.3); backdrop-filter:blur(12px);
  box-shadow:0 12px 34px rgba(0,0,0,.5); }
.gb-obs-pill b { color:var(--gl); font-size:21px; }
.gb-obs-pill i { font-style:normal; opacity:.5; font-size:13px; }

.gb-obs-arena { position:relative; display:flex; align-items:center; justify-content:center; gap:clamp(16px,4vw,54px); width:100%; padding-top:40px; }
.gb-obs-panel { position:relative; width:clamp(200px,28vw,340px); aspect-ratio:3/4; border-radius:26px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:10px; overflow:hidden;
  background:linear-gradient(160deg, rgba(180,235,255,.16), rgba(255,255,255,.03) 55%, rgba(0,0,0,.35));
  border:3px solid rgba(159,232,255,.34);
  box-shadow:0 30px 70px rgba(0,0,0,.6), inset 0 0 70px rgba(159,232,255,.07), inset 0 1px 0 rgba(255,255,255,.25); }
.gb-obs-panel.right { background:linear-gradient(160deg, rgba(232,190,110,.18), rgba(255,255,255,.03) 55%, rgba(0,0,0,.35));
  border-color:rgba(232,190,110,.4); box-shadow:0 30px 70px rgba(0,0,0,.6), inset 0 0 70px rgba(232,190,110,.08), inset 0 1px 0 rgba(255,255,255,.25); }
.gb-obs-panel.live { animation:gbObsGlass 3.4s ease-in-out infinite; }
@keyframes gbObsGlass { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
.gb-obs-glass { position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(115deg, rgba(255,255,255,.16) 0%, transparent 20%, transparent 74%, rgba(255,255,255,.07) 100%),
             repeating-linear-gradient(90deg, rgba(255,255,255,.045) 0 2px, transparent 2px 34px); }
.gb-obs-fill { position:absolute; left:0; right:0; bottom:0; transition:height .7s cubic-bezier(.4,0,.2,1); pointer-events:none;
  background:linear-gradient(180deg, rgba(232,190,110,.55), rgba(232,190,110,.05)); }
.gb-obs-panel.left .gb-obs-fill { background:linear-gradient(180deg, rgba(159,232,255,.5), rgba(159,232,255,.05)); }
.gb-obs-side-label { position:absolute; top:16px; font-size:15px; font-weight:900; letter-spacing:.28em; color:rgba(251,236,203,.5); }
.gb-obs-icon { position:relative; z-index:2; color:#fff; filter:drop-shadow(0 0 22px rgba(255,255,255,.35)); }
.gb-obs-icon .dim { color:rgba(251,236,203,.28); filter:none; }
.gb-obs-panel b { font-size:40px; font-weight:900; font-style:italic; color:#fff; }
.gb-obs-num { position:relative; z-index:2; display:flex; align-items:baseline; gap:10px; }
.gb-obs-num b { font-size:44px; color:var(--gl); text-shadow:0 0 26px rgba(232,190,110,.5); }
.gb-obs-num em { font-style:normal; font-size:19px; font-weight:900; color:rgba(251,236,203,.6); }
.gb-obs-lead { position:absolute; bottom:18px; z-index:2; padding:5px 14px; border-radius:99px; font-size:13px; font-weight:900;
  color:#1a1006; background:linear-gradient(135deg,var(--gl),var(--gd)); box-shadow:0 8px 22px rgba(232,190,110,.35); }
.gb-obs-panel.safe { border-color:rgba(75,224,122,.8); transform:translateY(-10px);
  background:linear-gradient(160deg, rgba(75,224,122,.26), rgba(75,224,122,.04) 60%, rgba(0,0,0,.3));
  box-shadow:0 0 90px rgba(75,224,122,.45), inset 0 0 70px rgba(75,224,122,.14); }
.gb-obs-panel.safe .gb-obs-icon { color:#c9ffdd; filter:drop-shadow(0 0 26px rgba(75,224,122,.7)); }
.gb-obs-panel.broken { border-color:rgba(232,85,47,.85); background:linear-gradient(160deg, rgba(232,85,47,.24), rgba(0,0,0,.65));
  box-shadow:0 0 70px rgba(232,85,47,.4); animation:gbBreak .6s ease-out; }
.gb-obs-panel.broken .gb-obs-icon { color:#ffb59a; }
.gb-obs-sweep { position:absolute; inset:0; z-index:3; pointer-events:none;
  background:linear-gradient(100deg, transparent 32%, rgba(249,224,164,.55) 50%, transparent 68%);
  transform:translateX(-110%); animation:gbSweep 1.3s ease-out .1s; }
.gb-obs-shards { position:absolute; inset:0; z-index:3; }
.gb-obs-shards i { position:absolute; top:50%; left:50%; width:13px; height:20px; border-radius:2px;
  background:linear-gradient(160deg, rgba(255,255,255,.85), rgba(232,85,47,.5)); animation:gbShard 1.4s ease-out forwards; }

.gb-obs-core { display:flex; flex-direction:column; align-items:center; gap:12px; min-width:150px; z-index:4; }
.gb-obs-verdict { display:flex; flex-direction:column; align-items:center; gap:8px; padding:18px 24px; border-radius:24px; text-align:center;
  background:rgba(10,8,5,.78); border:1px solid rgba(232,190,110,.4); box-shadow:0 0 60px rgba(232,190,110,.2); animation:gbPop .4s ease-out; }
.gb-obs-verdict b { font-size:26px; font-weight:900; font-style:italic; color:#fff; }
.gb-obs-verdict span { font-size:15px; font-weight:900; color:var(--gl); }

.gb-obs-board { position:absolute; inset-inline-start:26px; top:96px; width:212px; padding:12px; border-radius:18px; z-index:5;
  background:rgba(10,8,5,.7); border:1px solid rgba(232,190,110,.24); backdrop-filter:blur(12px); }
.gb-obs-board-head { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:900; letter-spacing:.14em;
  color:var(--mu); margin-bottom:8px; }
.gb-obs-board-row { display:flex; align-items:center; gap:8px; padding:5px 7px; border-radius:10px; font-size:14px; font-weight:900; }
.gb-obs-board-row:nth-child(2) { background:rgba(232,190,110,.12); }
.gb-obs-board-row span { color:var(--mu); width:14px; font-size:12px; }
.gb-obs-board-row b { flex:1; color:var(--cr); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gb-obs-board-row em { font-style:normal; color:var(--g); }

.gb-obs-map { position:absolute; bottom:28px; display:flex; align-items:flex-end; gap:8px; z-index:5; }
.gb-obs-pair { position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; padding:7px 8px; border-radius:14px;
  background:rgba(10,8,5,.5); border:1px solid rgba(255,255,255,.08); }
.gb-obs-pair-n { font-size:10px; font-weight:900; color:rgba(178,162,131,.6); }
.gb-obs-pair-tiles { display:flex; gap:4px; }
.gb-obs-tile { width:22px; height:34px; border-radius:5px; background:linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.04));
  border:1px solid rgba(255,255,255,.16); }
.gb-obs-tile.safe { background:linear-gradient(180deg, rgba(75,224,122,.7), rgba(75,224,122,.15)); border-color:rgba(75,224,122,.8);
  box-shadow:0 0 16px rgba(75,224,122,.5); }
.gb-obs-tile.gone { background:linear-gradient(180deg, rgba(232,85,47,.35), rgba(232,85,47,.05)); border-color:rgba(232,85,47,.55); opacity:.6; }
.gb-obs-pair.now { border-color:rgba(232,190,110,.6); background:rgba(232,190,110,.14); animation:gbBreathe 1.5s infinite; }
.gb-obs-pair.last { border-color:rgba(232,190,110,.34); }
.gb-obs-flag { display:grid; place-items:center; width:34px; height:46px; border-radius:12px; background:rgba(232,190,110,.16);
  border:1px solid rgba(232,190,110,.45); }

.gb-obs-fallen { position:absolute; bottom:104px; display:flex; align-items:center; gap:9px; flex-wrap:wrap; justify-content:center;
  padding:11px 20px; border-radius:20px; max-width:82vw; background:rgba(232,85,47,.16); border:1px solid rgba(232,85,47,.45);
  backdrop-filter:blur(10px); animation:gbPop .35s ease-out; }
.gb-obs-fallen .out { font-size:14px; font-weight:900; color:#ffb59a; letter-spacing:.08em; padding-inline-end:6px; border-inline-end:1px solid rgba(255,181,154,.3); }
.gb-obs-fallen b { font-size:16px; font-weight:900; color:var(--cr); background:rgba(0,0,0,.45); padding:4px 12px; border-radius:99px; }
.gb-obs-fallen b.gone { color:#ffb59a; border:1px solid rgba(232,85,47,.5); text-decoration:line-through; }

.gb-obs-end { display:flex; flex-direction:column; align-items:center; gap:18px; animation:gbPop .5s ease-out; z-index:6; }
.gb-obs-end-title { display:flex; align-items:center; gap:14px; padding:14px 26px; border-radius:22px;
  background:linear-gradient(135deg, rgba(232,190,110,.22), rgba(10,8,5,.8)); border:1px solid rgba(232,190,110,.45);
  box-shadow:0 0 60px rgba(232,190,110,.25); }
.gb-obs-end-title b { font-size:34px; font-weight:900; font-style:italic; color:#fff; }
.gb-obs-end-list { display:flex; flex-direction:column; gap:7px; min-width:420px; }
.gb-obs-end-row { display:flex; align-items:center; gap:13px; padding:10px 16px; border-radius:16px;
  background:rgba(10,8,5,.76); border:1px solid rgba(232,190,110,.26); font-size:19px; font-weight:900; backdrop-filter:blur(10px); }
.gb-obs-end-row.champ { background:linear-gradient(90deg, rgba(232,190,110,.26), rgba(10,8,5,.8)); border-color:rgba(232,190,110,.65);
  box-shadow:0 0 40px rgba(232,190,110,.25); }
.gb-obs-end-row span { color:var(--mu); width:20px; font-size:15px; }
.gb-obs-end-row b { flex:1; color:var(--cr); }
.gb-obs-end-row i { font-style:normal; font-size:14px; color:rgba(159,232,255,.75); }
.gb-obs-end-row em { font-style:normal; color:var(--g); min-width:64px; text-align:end; }
.gb-obs-lobby { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; }
.gb-obs-lobby b { font-size:52px; font-weight:900; font-style:italic; color:#fff; text-shadow:0 0 40px rgba(232,190,110,.5); }
.gb-obs-lobby span { font-size:20px; font-weight:900; color:var(--gl); }
`;

export { GlassBridgeV2 };
export default GlassBridgeV2;
