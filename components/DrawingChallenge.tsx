import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
    Settings, Play, Users, Trophy, Clock, ChevronLeft, Trash2, Sparkles, Loader2,
    Palette, Undo2, Redo2, Grid3X3, RotateCcw, Home, Crown, Eye, EyeOff, Monitor,
    FlipHorizontal, FlipVertical, FileImage, FileText, Image as ImageIcon, Wand2,
    ChevronDown, ChevronUp, PaintBucket, Copy, Check, ShieldAlert, Lightbulb,
    Shuffle, Volume2, Gauge, Swords, Medal, Timer as TimerIcon, RefreshCw, Ban,
} from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import { ChatUser } from '../types';
import { chatService } from '../services/chatService';
import { supabase } from '../services/supabase';
import { awardPoints } from '../services/points';
import { DrawingEngine, ToolType, BrushSettings, Layer } from './drawing/DrawingEngine';
import { DrawingToolbar } from './drawing/DrawingToolbar';
import { LayersPanel } from './drawing/LayersPanel';
import {
    DRAW_CATEGORIES, DRAW_TIERS, DRAW_TOTAL, DRAW_ALL, pickDrawWords, canon,
    matchDrawGuess, drawCategoryById,
    type DrawEntry, type DrawCategoryId, type DrawTier,
} from '../data/drawBank';
import './drawing/DrawingStudio.css';

/* ============================================================================
   تحدي الرسم — نسخة البث
   المذيع يرسم، الجمهور يخمّن في الشات، والكلمة لا تُبث أبداً قبل نهاية الجولة.
   ========================================================================== */

interface DrawingChallengeProps { onHome: () => void; isOBS?: boolean; }

interface GameConfig {
    joinKeyword: string;
    maxPlayers: number;
    roundDuration: number;
    totalRounds: number;
    firstWins: number;
    pointsForWinner: number;
    autoProgress: boolean;
    openGuessing: boolean;
    sound: boolean;
    syncMs: number;
    categories: DrawCategoryId[];
    tiers: DrawTier[];
}

type GamePhase = 'SETUP' | 'LOBBY' | 'SELECT_WORD' | 'DRAWING' | 'RESULTS' | 'FINALE';
interface PlayerScore { user: ChatUser; score: number; wins: number; }
interface RoundWinner { user: ChatUser; place: number; earned: number; }

const DUR_CHOICES = [60, 90, 120, 180, 240, 300];
const ROUND_CHOICES = [3, 5, 7, 10, 15];
const PLAYER_CHOICES = [20, 50, 100, 200];
const SYNC_CHOICES: { label: string; ms: number }[] = [
    { label: 'سريع', ms: 600 },
    { label: 'متزن', ms: 1000 },
    { label: 'خفيف', ms: 2000 },
];

const PLACE_MULT = [1, 0.6, 0.35];
const HINT_PENALTY = 30;
const RESULTS_MS = 7000;
const WINNER_RESULTS_MS = 3000;

const GOLD = '#e8be6e';
const CREAM = '#fbeccb';
const EMBER = '#e8552f';
const LIVE = '#4be07a';

/** لوحة ألوان سريعة تناسب البث */
const COLORS = [
    '#ffffff', '#000000', '#e8552f', '#e8be6e', '#4be07a', '#06b6d4', '#3b82f6',
    '#8b5cf6', '#ec4899', '#f9e0a4', '#78716c', '#1e3a5f', '#ff9a3c', '#a3e635',
];

const SHAPES: ToolType[] = ['line', 'rect', 'circle', 'triangle', 'pentagon', 'hexagon', 'star', 'arrow', 'heart', 'diamond'];

/** رابط البث لا يُرسم على الشاشة إطلاقاً: يُفكّ لحظة النسخ فقط */
const OBS_FRAG = 'P29icz10cnVlJnZpZXc9RFJBV0lOR19DSEFMTEVOR0U=';
const buildObsLink = () => `${window.location.origin}/${atob(OBS_FRAG)}`;

async function copySilently(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* نجرب الطريقة القديمة */ }
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
    } catch {
        return false;
    }
}

const fmtMmr = (s: number) => `${Math.max(0, Math.floor(s / 60))}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

/* ----------------------------- عناصر مشتركة ----------------------------- */

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
    hint?: string;
}> = ({ label, value, onChange, icon: Icon, color = GOLD, hint }) => (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-icg-gold/5 border border-icg-gold/10">
        <span className="flex flex-col min-w-0">
            <span className="flex items-center gap-1.5 text-[9px] font-black text-icg-cream/80">
                <Icon size={11} style={{ color: value ? color : undefined }} /> {label}
            </span>
            {hint && <span className="text-[8px] font-bold text-icg-muted/70 truncate">{hint}</span>}
        </span>
        <button
            onClick={onChange}
            className="w-9 h-5 rounded-full relative transition-colors shrink-0"
            style={{ background: value ? color : 'rgba(232,190,110,0.15)' }}
        >
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
                <span className="font-black leading-none tabular-nums" style={{ color, fontSize: size * 0.3 }}>{fmtMmr(left)}</span>
                {label && <span className="text-[8px] font-black text-icg-muted tracking-widest mt-0.5">{label}</span>}
            </div>
        </div>
    );
};

/** مربعات الحروف: لا يظهر منها إلا قدر ما كُشف */
const PatternBoxes: React.FC<{ word: string; revealed: number; color?: string; size?: number }> = ({
    word, revealed, color = GOLD, size = 34,
}) => {
    const chars = [...word];
    return (
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {chars.map((ch, i) => {
                if (ch === ' ') return <span key={i} className="w-2.5" />;
                const shown = i < revealed;
                return (
                    <span
                        key={i}
                        className="grid place-items-center rounded-lg font-black"
                        style={{
                            width: size, height: size, fontSize: size * 0.5,
                            background: shown ? 'rgba(232,190,110,0.16)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${shown ? `${color}66` : 'rgba(255,255,255,0.08)'}`,
                            color: shown ? color : 'rgba(251,236,203,0.22)',
                        }}
                    >
                        {shown ? ch : '•'}
                    </span>
                );
            })}
        </div>
    );
};

/* -------------------------------- المكوّن -------------------------------- */

export const DrawingChallenge: React.FC<DrawingChallengeProps> = ({ onHome, isOBS }) => {
    const defaultCfg: GameConfig = {
        joinKeyword: 'رسم',
        maxPlayers: 100,
        roundDuration: 120,
        totalRounds: 7,
        firstWins: 1,
        pointsForWinner: 100,
        autoProgress: true,
        openGuessing: true,
        sound: true,
        syncMs: 1000,
        categories: DRAW_CATEGORIES.map(c => c.id),
        tiers: [1, 2, 3],
    };

    const [config, setConfig] = useState<GameConfig>(defaultCfg);
    const [phase, setPhase] = useState<GamePhase>('SETUP');
    const [participants, setParticipants] = useState<ChatUser[]>([]);
    const [scores, setScores] = useState<Record<string, PlayerScore>>({});
    const [timer, setTimer] = useState(0);
    const [round, setRound] = useState(1);
    const [options, setOptions] = useState<DrawEntry[]>([]);
    const [entry, setEntry] = useState<DrawEntry | null>(null);
    const [hintLevel, setHintLevel] = useState(0);
    const [winners, setWinners] = useState<RoundWinner[]>([]);
    const [feed, setFeed] = useState<{ id: string; text: string; ok: boolean; user: string; player?: ChatUser }[]>([]);
    const [isShuffling, setIsShuffling] = useState(false);
    const [copied, setCopied] = useState(false);

    /* أدوات المرسم */
    const [activeTool, setActiveTool] = useState<ToolType>('pencil');
    const [brush, setBrush] = useState<BrushSettings>({ color: '#000000', size: 8, opacity: 1, hardness: 1, fillShape: false, stabilizer: 4 });
    const [zoom, setZoom] = useState(50);
    const [showGrid, setShowGrid] = useState(false);
    const [showUI, setShowUI] = useState(true);
    const [showExport, setShowExport] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [mirrorMode, setMirrorMode] = useState(false);

    /* حالة البث المستقبَلة (OBS لا يملك منطق لعبة إطلاقاً) */
    const [obsState, setObsState] = useState<{
        phase: GamePhase; round: number; timer: number; totalRounds: number;
        players: number; word: string; category: string; tier: DrawTier; winners: RoundWinner[];
        scores: Record<string, PlayerScore>;
    }>({ phase: 'SETUP', round: 1, timer: 0, totalRounds: config.totalRounds, players: 0, word: '', category: '', tier: 1, winners: [], scores: {} });
    const [syncConnected, setSyncConnected] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const obsCanvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<DrawingEngine | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);

    const phaseRef = useRef(phase);
    const cfgRef = useRef(config);
    const entryRef = useRef(entry);
    const hintRef = useRef(hintLevel);
    const roundRef = useRef(round);
    const participantsRef = useRef(participants);
    const winnersRef = useRef<RoundWinner[]>([]);
    const guessedRef = useRef<Set<string>>(new Set());
    const usedRef = useRef<Set<string>>(new Set());
    const advanceTimer = useRef<number | null>(null);
    const finaleDone = useRef(false);

    useEffect(() => {
        phaseRef.current = phase; cfgRef.current = config; entryRef.current = entry;
        hintRef.current = hintLevel; roundRef.current = round; participantsRef.current = participants;
    }, [phase, config, entry, hintLevel, round, participants]);

    /* ------------------------------ الصوت ------------------------------ */
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

    const burst = useCallback((color = GOLD) => {
        confetti({ particleCount: 42, spread: 68, origin: { y: 0.7 }, colors: [color, CREAM, '#f9e0a4'] });
    }, []);

    /* --------------------------- قناة البث --------------------------- */
    // البث المباشر: لا يُرسل الاسم إلا بعد كشفه (نهاية الجولة أو كشف كامل)
    useEffect(() => {
        if (isOBS || !syncConnected || !channelRef.current) return;
        const revealed = phase === 'RESULTS' || phase === 'FINALE' || hintLevel >= 3 || winners.length > 0;
        channelRef.current.send({
            type: 'broadcast',
            event: 'state_sync',
            payload: {
                phase,
                round,
                timer,
                totalRounds: config.totalRounds,
                players: participants.length,
                hintLevel,
                word: revealed ? (entry?.ar || '') : '',
                category: revealed ? (drawCategoryById(entry?.categoryId)?.label || '') : '',
                tier: entry?.tier || 1,
                winners,
                scores,
            },
        });
    }, [isOBS, syncConnected, phase, round, timer, hintLevel, entry, winners, scores, participants.length, config.totalRounds]);

    useEffect(() => {
        const channel = supabase.channel('drawing_sync', { config: { broadcast: { self: true } } });
        channel
            .on('broadcast', { event: 'state_sync' }, ({ payload }: any) => {
                // OBS يستقبل فقط — لا يغيّر طوراً ولا يعرض شاشات التحضير
                if (isOBS && payload) setObsState(prev => ({ ...prev, ...payload }));
            })
            .on('broadcast', { event: 'canvas_data' }, ({ payload }: any) => {
                if (!isOBS || !payload?.data) return;
                const img = new window.Image();
                img.onload = () => {
                    const cv = obsCanvasRef.current;
                    const ctx = cv?.getContext('2d');
                    if (!cv || !ctx) return;
                    ctx.clearRect(0, 0, 1920, 1080);
                    ctx.drawImage(img, 0, 0, 1920, 1080);
                };
                img.src = payload.data;
            })
            .subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    channelRef.current = channel;
                    setSyncConnected(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    if (channelRef.current === channel) channelRef.current = null;
                    setSyncConnected(false);
                }
            });
        return () => { channel.unsubscribe(); channelRef.current = null; setSyncConnected(false); };
    }, [isOBS]);

    // بث اللوحة للبث كل فترة
    useEffect(() => {
        if (isOBS || phase !== 'DRAWING') return;
        const iv = setInterval(() => {
            const ch = channelRef.current;
            const cv = canvasRef.current;
            if (!ch || !cv) return;
            ch.send({ type: 'broadcast', event: 'canvas_data', payload: { data: cv.toDataURL('image/webp', 0.7) } });
        }, Math.max(300, config.syncMs));
        return () => clearInterval(iv);
    }, [isOBS, phase, config.syncMs]);

    /* ---------------------------- المحرك ---------------------------- */
    useEffect(() => {
        if (isOBS || phase !== 'DRAWING' || !canvasRef.current) return;
        const engine = new DrawingEngine(canvasRef.current, 1920, 1080);
        engine.mirrorMode = mirrorMode;
        engineRef.current = engine;
        setLayers([...engine.layers]);
        setActiveLayerId(engine.activeLayerId);
        const id = window.setTimeout(fitToScreen, 80);
        return () => window.clearTimeout(id);
    }, [isOBS, phase]);

    useEffect(() => {
        if (engineRef.current) engineRef.current.mirrorMode = mirrorMode;
    }, [mirrorMode]);

    const syncLayers = useCallback(() => {
        const e = engineRef.current;
        if (!e) return;
        setLayers([...e.layers]);
        setActiveLayerId(e.activeLayerId);
    }, []);

    const fitToScreen = useCallback(() => {
        const box = containerRef.current;
        if (!box) return;
        const z = Math.floor(Math.min(box.clientWidth / 1920, box.clientHeight / 1080) * 100);
        const fittedZoom = Math.max(20, Math.min(150, z || 50));
        const fittedScale = fittedZoom / 100;
        setZoom(fittedZoom);
        setPanOffset({
            x: Math.max(0, Math.round((box.clientWidth - 1920 * fittedScale) / 2)),
            y: Math.max(0, Math.round((box.clientHeight - 1080 * fittedScale) / 2)),
        });
    }, []);

    useEffect(() => {
        const box = containerRef.current;
        if (!box || isOBS || phase !== 'DRAWING') return;
        const observer = new ResizeObserver(fitToScreen);
        observer.observe(box);
        return () => observer.disconnect();
    }, [fitToScreen, isOBS, phase]);

    /* ------------------------- تدفق الجولة ------------------------- */
    const clearArt = useCallback(() => {
        const e = engineRef.current;
        if (!e) return;
        e.layers.slice(1).forEach(l => l.ctx.clearRect(0, 0, 1920, 1080));
        e.composite();
        syncLayers();
    }, [syncLayers]);

    const prepareWords = useCallback(() => {
        winnersRef.current = [];
        guessedRef.current = new Set();
        setWinners([]);
        setFeed([]);
        setHintLevel(0);
        setEntry(null);
        setOptions([]);
        setPhase('SELECT_WORD');
        clearArt();
        const id = window.setTimeout(() => {
            setOptions(pickDrawWords({
                categories: cfgRef.current.categories,
                tiers: cfgRef.current.tiers,
                count: 3,
                used: usedRef.current,
            }));
            setIsShuffling(false);
        }, 560);
        return () => window.clearTimeout(id);
    }, [clearArt]);

    const goNextRound = useCallback(() => {
        if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
        if (roundRef.current >= cfgRef.current.totalRounds) {
            setPhase('FINALE');
            return;
        }
        roundRef.current += 1;
        setRound(roundRef.current);
        prepareWords();
    }, [prepareWords]);

    const endRoundRef = useRef<() => void>(() => {});
    const endRound = useCallback(() => {
        if (phaseRef.current !== 'DRAWING') return;
        setPhase('RESULTS');
        tone(520, 0.2, 'triangle');
        setTimeout(() => tone(700, 0.22, 'triangle'), 170);
        if (winnersRef.current.length) burst(LIVE);
        if (winnersRef.current.length > 0 || cfgRef.current.autoProgress) {
            const delay = winnersRef.current.length > 0 ? WINNER_RESULTS_MS : RESULTS_MS;
            advanceTimer.current = window.setTimeout(() => goNextRound(), delay);
        }
    }, [goNextRound, tone, burst]);
    endRoundRef.current = endRound;

    const applyScore = (user: ChatUser, earned: number) => {
        setScores(prev => {
            const cur = prev[user.username] || { user, score: 0, wins: 0 };
            return { ...prev, [user.username]: { ...cur, score: cur.score + earned, wins: cur.wins + 1 } };
        });
    };

    const registerWinner = useCallback((user: ChatUser) => {
        const cfg = cfgRef.current;
        const e = entryRef.current;
        const place = winnersRef.current.length + 1;
        if (place > cfg.firstWins) return;
        const mult = PLACE_MULT[Math.min(place, PLACE_MULT.length) - 1];
        const tierPoints = DRAW_TIERS[e?.tier || 1].points;
        const base = cfg.pointsForWinner + Math.max(0, tierPoints - 100);
        const speed = Math.round(base * 0.5 * Math.max(0, Math.min(1, timer / Math.max(1, cfg.roundDuration))));
        const penalty = hintRef.current * HINT_PENALTY;
        const earned = Math.max(25, Math.round((base + speed - penalty) * mult));

        const w: RoundWinner = { user, place, earned };
        winnersRef.current = [...winnersRef.current, w];
        setWinners(winnersRef.current);
        applyScore(user, earned);
        setFeed(prev => [{ id: `${Date.now()}_${user.username}`, text: e?.ar || '', ok: true, user: user.username, player: user }, ...prev].slice(0, 14));
        tone(660 + place * 120, 0.16, 'square', 0.04);
        burst(place === 1 ? GOLD : '#f9e0a4');

        if (place === 1) {
            chatService.fetchKickAvatar(user.username).then(
                avatar => awardPoints('DRAWING_CHALLENGE', user.username, avatar || user.avatar || '', 'match'),
                () => awardPoints('DRAWING_CHALLENGE', user.username, user.avatar || '', 'match')
            );
        } else if (place === 2 || place === 3) {
            awardPoints('DRAWING_CHALLENGE', user.username, user.avatar || '', 'round', place === 2 ? 0.5 : 0.25);
        }
        if (winnersRef.current.length >= cfg.firstWins) endRoundRef.current();
    }, [timer, tone, burst]);

    /* ------------------------------ الشات ------------------------------ */
    useEffect(() => {
        const unsub = chatService.onMessage(msg => {
            if (isOBS) return;
            const content = String(msg.content || '').trim();
            const username = msg.user.username;
            if (!content) return;
            const cfg = cfgRef.current;

            if (phaseRef.current === 'LOBBY' && canon(content) === canon(cfg.joinKeyword)) {
                setParticipants(prev => {
                    if (prev.length >= cfg.maxPlayers || prev.some(p => p.username === username)) return prev;
                    chatService.fetchKickAvatar(username).then(avatar => {
                        if (avatar) setParticipants(c => c.map(p => p.username === username ? { ...p, avatar } : p));
                    });
                    return [...prev, msg.user];
                });
                return;
            }

            if (phaseRef.current !== 'DRAWING') return;
            const e = entryRef.current;
            if (!e) return;
            if (!cfg.openGuessing && !participantsRef.current.some(p => p.username === username)) return;
            if (guessedRef.current.has(username)) return;

            if (matchDrawGuess(content, e)) {
                guessedRef.current.add(username);
                registerWinner(msg.user);
            } else {
                setFeed(prev => [{ id: `${Date.now()}_${username}`, text: content.slice(0, 24), ok: false, user: username }, ...prev].slice(0, 14));
            }
        });
        return () => unsub();
    }, [isOBS, registerWinner]);

    /* ------------------------------ المؤقّت ------------------------------ */
    useEffect(() => {
        if (isOBS || phase !== 'DRAWING') return;
        if (timer <= 0) { if (timer === 0) endRoundRef.current(); return; }
        if (timer <= 3) tone(880, 0.1, 'sine', 0.04);
        const id = window.setTimeout(() => setTimer(t => t - 1), 1000);
        return () => window.clearTimeout(id);
    }, [isOBS, phase, timer, tone]);

    useEffect(() => () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); }, []);

    /* ------------------------------ الختام ------------------------------ */
    useEffect(() => {
        if (isOBS || phase !== 'FINALE' || finaleDone.current) return;
        finaleDone.current = true;
        tone(523, 0.2, 'triangle'); setTimeout(() => tone(659, 0.2, 'triangle'), 160); setTimeout(() => tone(784, 0.32, 'triangle'), 320);
        let n = 0;
        const iv = setInterval(() => { confetti({ particleCount: 70, spread: 100, origin: { x: Math.random(), y: 0.35 } }); if (++n > 5) clearInterval(iv); }, 500);
        return () => clearInterval(iv);
    }, [isOBS, phase, tone]);

    /* ---------------------------- الإجراءات ---------------------------- */
    const startGame = () => { setPhase('LOBBY'); tone(600, 0.14); };

    const beginRounds = () => {
        finaleDone.current = false;
        usedRef.current = new Set();
        roundRef.current = 1;
        setRound(1);
        setScores({});
        prepareWords();
    };

    const selectWord = (e: DrawEntry) => {
        setEntry(e);
        entryRef.current = e;
        usedRef.current = new Set(usedRef.current).add(e.ar);
        setTimer(cfgRef.current.roundDuration);
        setPhase('DRAWING');
        tone(720, 0.16, 'triangle');
    };

    const reroll = () => {
        setIsShuffling(true);
        const exclude = options.map(o => o.ar);
        window.setTimeout(() => {
            setOptions(pickDrawWords({ categories: cfgRef.current.categories, tiers: cfgRef.current.tiers, count: 3, used: usedRef.current, exclude }));
            setIsShuffling(false);
            tone(420, 0.12, 'sawtooth', 0.03);
        }, 420);
    };

    const resetGame = () => {
        if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
        finaleDone.current = false;
        usedRef.current = new Set();
        winnersRef.current = [];
        guessedRef.current = new Set();
        setPhase('SETUP');
        setParticipants([]);
        setScores({});
        setWinners([]);
        setFeed([]);
        setEntry(null);
        setRound(1);
        setTimer(0);
        setHintLevel(0);
    };

    const revealHint = () => {
        const next = Math.min(3, hintLevel + 1);
        if (next === hintLevel) return;
        setHintLevel(next);
        tone(340, 0.18, 'sawtooth', 0.04);
        if (next >= 3) burst(EMBER);
    };

    const toggleCategory = (id: DrawCategoryId) => {
        setConfig(c => ({
            ...c,
            categories: c.categories.includes(id) ? c.categories.filter(x => x !== id) : [...c.categories, id],
        }));
    };

    const toggleTier = (t: DrawTier) => {
        setConfig(c => {
            const has = c.tiers.includes(t);
            const tiers = has ? c.tiers.filter(x => x !== t) : [...c.tiers, t];
            return { ...c, tiers: tiers.length ? tiers : c.tiers };
        });
    };

    const copyObs = async () => {
        if (await copySilently(buildObsLink())) {
            setCopied(true);
            tone(760, 0.14);
            window.setTimeout(() => setCopied(false), 2600);
        }
    };

    /* -------------------------- أدوات المرسم -------------------------- */
    const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
        }
        const m = e as React.MouseEvent;
        return { x: (m.clientX - rect.left) * scaleX, y: (m.clientY - rect.top) * scaleY };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (isOBS) return;
        const { x, y } = getCanvasCoords(e);
        const engine = engineRef.current;
        if (!engine) return;
        const layer = engine.getActiveLayer();
        if (!layer || layer.locked) return;

        if (activeTool === 'hand') {
            setIsPanning(true);
            const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            setPanStart({ x: cx - panOffset.x, y: cy - panOffset.y });
            return;
        }
        if (activeTool === 'eyedropper') {
            const px = layer.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
            const hex = '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            setBrush(prev => ({ ...prev, color: hex }));
            setActiveTool('pencil');
            return;
        }
        if (activeTool === 'fill') {
            engine.saveToHistory();
            engine.fillBucket(x, y, brush.color);
            syncLayers();
            return;
        }
        setIsDrawing(true);
        setStartPoint({ x, y });
        if (!SHAPES.includes(activeTool)) {
            engine.saveToHistory();
            engine.beginStroke(x, y, brush, activeTool);
        }
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (isOBS) return;
        const { x, y } = getCanvasCoords(e);
        setCursorPos({ x: Math.round(x), y: Math.round(y) });

        if (isPanning && activeTool === 'hand') {
            const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            setPanOffset({ x: cx - panStart.x, y: cy - panStart.y });
            return;
        }
        const engine = engineRef.current;
        if (!engine || !isDrawing) return;
        if (SHAPES.includes(activeTool)) {
            if (previewCanvasRef.current) engine.previewShape(previewCanvasRef.current, activeTool, startPoint.x, startPoint.y, x, y, brush);
        } else {
            engine.continueStroke(x, y, brush, activeTool);
        }
    };

    const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
        if (isPanning) { setIsPanning(false); return; }
        if (!isDrawing || isOBS) return;
        setIsDrawing(false);
        const engine = engineRef.current;
        if (!engine) return;
        const { x, y } = getCanvasCoords(e);
        if (SHAPES.includes(activeTool)) {
            engine.saveToHistory();
            engine.drawShape(activeTool, startPoint.x, startPoint.y, x, y, brush);
            previewCanvasRef.current?.getContext('2d')?.clearRect(0, 0, 1920, 1080);
        } else {
            engine.endStroke();
        }
        syncLayers();
    };

    const handleUndo = () => { engineRef.current?.undo(); syncLayers(); };
    const handleRedo = () => { engineRef.current?.redo(); syncLayers(); };
    const handleAddLayer = () => { engineRef.current?.addLayer(); syncLayers(); };
    const handleDeleteLayer = (id: string) => { engineRef.current?.deleteLayer(id); syncLayers(); };
    const handleToggleVis = (id: string) => {
        const l = engineRef.current?.layers.find(x => x.id === id);
        if (l) { l.visible = !l.visible; engineRef.current?.composite(); syncLayers(); }
    };
    const handleToggleLock = (id: string) => {
        const l = engineRef.current?.layers.find(x => x.id === id);
        if (l) { l.locked = !l.locked; syncLayers(); }
    };
    const handleSelectLayer = (id: string) => { if (engineRef.current) engineRef.current.activeLayerId = id; setActiveLayerId(id); };
    const handleReorder = (from: number, to: number) => { engineRef.current?.reorderLayers(from, to); syncLayers(); };
    const handleOpacity = (id: string, val: number) => {
        const l = engineRef.current?.layers.find(x => x.id === id);
        if (l) { l.opacity = val; engineRef.current?.composite(); syncLayers(); }
    };
    const handleDuplicate = (id: string) => { engineRef.current?.duplicateLayer(id); syncLayers(); };
    const handleMerge = (id: string) => { engineRef.current?.mergeDown(id); syncLayers(); };
    const handleClear = (id: string) => { engineRef.current?.clearLayer(id); syncLayers(); };
    const handleBlend = (id: string, mode: GlobalCompositeOperation) => {
        const l = engineRef.current?.layers.find(x => x.id === id);
        if (l) { l.blendMode = mode; engineRef.current?.composite(); syncLayers(); }
    };
    const handleFilter = (f: string) => {
        const e = engineRef.current;
        if (!e) return;
        if (f === 'blur') e.applyBlur();
        else if (f === 'sharpen') e.applySharpen();
        else e.applyFilter(f);
        syncLayers();
    };
    const handleFlip = (dir: 'h' | 'v') => { engineRef.current?.flipLayer(dir); syncLayers(); };
    const setBackground = (color: string) => { engineRef.current?.setBackgroundColor(color); syncLayers(); };
    const handleHardReset = () => {
        if (window.confirm('امسح اللوحة بالكامل وابدأ من جديد؟')) {
            engineRef.current?.hardReset();
            syncLayers();
        }
    };
    const handleExport = (format: 'png' | 'jpeg' | 'svg') => {
        const e = engineRef.current;
        if (!e) return;
        const name = `icg-drawing-${(entry?.ar || 'art').replace(/\s+/g, '-')}`;
        let data: string;
        if (format === 'png') { data = e.exportPNG(); }
        else if (format === 'jpeg') { data = e.exportJPEG(); }
        else { data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(e.exportSVG()); }
        const ext = format === 'jpeg' ? 'jpg' : format;
        const a = document.createElement('a');
        a.href = data;
        a.download = `${name}.${ext}`;
        a.click();
        setShowExport(false);
    };

    useEffect(() => {
        if (isOBS || phase !== 'DRAWING') return;
        const handler = (ev: KeyboardEvent) => {
            if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
            const k = ev.key.toLowerCase();
            if (ev.ctrlKey && k === 'z') { ev.preventDefault(); handleUndo(); return; }
            if (ev.ctrlKey && k === 'y') { ev.preventDefault(); handleRedo(); return; }
            if (k === 'tab') { ev.preventDefault(); setShowUI(p => !p); return; }
            if (k === 'h') { ev.preventDefault(); revealHint(); return; }
            if (phaseRef.current === 'SELECT_WORD' && ['1', '2', '3'].includes(k)) {
                const pick = options[Number(k) - 1];
                if (pick) selectWord(pick);
                return;
            }
            const map: Record<string, ToolType> = { b: 'brush', p: 'pencil', e: 'eraser', g: 'fill', v: 'move', i: 'eyedropper', l: 'line', r: 'rect', c: 'circle' };
            if (map[k]) setActiveTool(map[k]);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOBS, phase, options]);

    /* ------------------------------ مشتقات ------------------------------ */
    const bankByCategory = useMemo(() => {
        const m: Record<string, number> = {};
        DRAW_CATEGORIES.forEach(c => { m[c.id] = c.entries.length; });
        return m;
    }, []);

    const poolCount = useMemo(() => {
        const tiers = new Set(config.tiers);
        return DRAW_CATEGORIES
            .filter(c => config.categories.includes(c.id))
            .reduce((sum, c) => sum + c.entries.filter(e => tiers.has(e.tier)).length, 0);
    }, [config.categories, config.tiers]);

    const catLabel = entry ? (drawCategoryById(entry.categoryId)?.label || '') : '';
    const tierMeta = entry ? DRAW_TIERS[entry.tier] : DRAW_TIERS[1];
    const ranked = useMemo(() =>
        Object.values(scores).sort((a, b) => b.score - a.score || b.wins - a.wins),
        [scores]
    );
    const leader = ranked[0] || null;
    const timeColor = timer <= 10 ? EMBER : timer <= 30 ? GOLD : LIVE;

    /* =========================== شاشة البث =========================== */
    if (isOBS) {
        const obsRanked = Object.values(obsState.scores || {}).sort((a, b) => b.score - a.score || b.wins - a.wins);
        const obsLeader = obsRanked[0] || null;
        const showWord = (obsState.phase === 'RESULTS' || obsState.phase === 'FINALE' || obsState.winners.length > 0) && obsState.word;
        return (
            <div className="dr-obs" dir="rtl">
                <div className="dr-obs-canvas">
                    <canvas ref={obsCanvasRef} width={1920} height={1080} />
                </div>
                {obsState.phase === 'DRAWING' && (
                    <div className="dr-obs-hud">
                        <div className="dr-obs-hud-row">
                            <TimerIcon size={13} style={{ color: obsState.timer <= 10 ? EMBER : GOLD }} />
                            <span className="tabular-nums" style={{ color: obsState.timer <= 10 ? EMBER : CREAM }}>{fmtMmr(obsState.timer)}</span>
                        </div>
                        <div className="dr-obs-hud-sep" />
                        <div className="dr-obs-hud-row"><Users size={13} style={{ color: CREAM }} /><span>{obsState.players}</span></div>
                        <div className="dr-obs-hud-sep" />
                        <div className="dr-obs-hud-row"><Crown size={13} style={{ color: GOLD }} /><span>{obsState.round}/{obsState.totalRounds}</span></div>
                    </div>
                )}
                {showWord && (
                    <div className="dr-obs-reveal">
                        <span className="dr-obs-reveal-label">الإجابة الصحيحة هي</span>
                        <span className="dr-obs-reveal-word">{obsState.word}</span>
                        {obsState.winners.length > 0 && (
                            <div className="dr-obs-winners">
                                {obsState.winners.map(w => (
                                    <span key={w.user.username} className="dr-obs-winner">
                                        <ProAvatar url={w.user.avatar} username={w.user.username} size="w-10 h-10" className="dr-obs-winner-avatar" />
                                        <Medal size={12} style={{ color: w.place === 1 ? GOLD : w.place === 2 ? '#d8d8d8' : '#c98a4b' }} />
                                        {w.user.username}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {obsState.phase === 'FINALE' && obsLeader && (
                    <div className="dr-obs-champ">
                        <Trophy size={16} style={{ color: GOLD }} />
                        <ProAvatar url={obsLeader.user.avatar} username={obsLeader.user.username} size="w-10 h-10" className="dr-obs-champ-avatar" />
                        <span>بطل الليلة: {obsLeader.user.username}</span>
                    </div>
                )}
                {obsState.phase === 'LOBBY' && (
                    <div className="dr-obs-lobby">
                        <Palette size={26} style={{ color: GOLD }} />
                        <span>تحدي الرسم — يبدأ قريباً</span>
                    </div>
                )}
                <style>{DR_STYLES}</style>
            </div>
        );
    }

    /* =========================== شاشة التحضير =========================== */
    if (phase === 'SETUP') {
        return (
            <div className="dr-root" dir="rtl">
                <div className="dr-bg" />
                <div className="dr-scroll">
                    <div className="dr-inner">
                        <header className="dr-hero">
                            <div className="dr-hero-icon"><Palette size={30} /></div>
                            <div className="dr-hero-text">
                                <h1 className="dr-title">تحدي الرسم</h1>
                                <p className="dr-subtitle">ارسم، والجمهور يخمّن — الكلمة تبقى سرية حتى تنتهي الجولة</p>
                            </div>
                            <div className="dr-hero-stats">
                                <div className="dr-stat"><b>{poolCount.toLocaleString('en')}</b><span>كلمة في المخزن</span></div>
                                <div className="dr-stat"><b>{DRAW_CATEGORIES.length}</b><span>فئات</span></div>
                                <div className="dr-stat"><b>3</b><span>مستويات صعوبة</span></div>
                            </div>
                        </header>

                        <div className="dr-grid">
                            {/* الإعدادات */}
                            <div className="dr-card">
                                <div className="dr-card-head"><Settings size={14} style={{ color: GOLD }} /> <span>إعدادات التحدي</span></div>

                                <div className="dr-field">
                                    <label>كلمة الانضمام</label>
                                    <input
                                        value={config.joinKeyword}
                                        onChange={ev => setConfig({ ...config, joinKeyword: ev.target.value })}
                                        className="dr-input"
                                        placeholder="اكتب في الشات…"
                                    />
                                    <p className="dr-help">يكتبها المشاهد في الشات ليظهر في قائمة المشاركين</p>
                                </div>

                                <div className="dr-field">
                                    <label>وقت الجولة</label>
                                    <div className="dr-choices">
                                        {DUR_CHOICES.map(d => (
                                            <OptBtn key={d} active={config.roundDuration === d} color={GOLD} onClick={() => setConfig({ ...config, roundDuration: d })}>
                                                {d < 60 ? `${d}ث` : `${d / 60}د`}
                                            </OptBtn>
                                        ))}
                                    </div>
                                </div>

                                <div className="dr-field">
                                    <label>عدد الجولات</label>
                                    <div className="dr-choices">
                                        {ROUND_CHOICES.map(r => (
                                            <OptBtn key={r} active={config.totalRounds === r} color={GOLD} onClick={() => setConfig({ ...config, totalRounds: r })}>
                                                {r}
                                            </OptBtn>
                                        ))}
                                    </div>
                                </div>

                                <div className="dr-field">
                                    <label>حد المشاركين</label>
                                    <div className="dr-choices">
                                        {PLAYER_CHOICES.map(p => (
                                            <OptBtn key={p} active={config.maxPlayers === p} color={GOLD} onClick={() => setConfig({ ...config, maxPlayers: p })}>{p}</OptBtn>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* المخزن */}
                            <div className="dr-card">
                                <div className="dr-card-head">
                                    <Sparkles size={14} style={{ color: GOLD }} />
                                    <span>مخزن الكلمات</span>
                                    <em>{DRAW_TOTAL.toLocaleString('en')} كلمة</em>
                                </div>

                                <div className="dr-field">
                                    <label>المستوى</label>
                                    <div className="dr-choices">
                                        {([1, 2, 3] as DrawTier[]).map(t => (
                                            <OptBtn
                                                key={t}
                                                active={config.tiers.includes(t)}
                                                color={DRAW_TIERS[t].hex}
                                                onClick={() => toggleTier(t)}
                                                sub={`+${DRAW_TIERS[t].points} نقطة`}
                                            >
                                                {DRAW_TIERS[t].label}
                                            </OptBtn>
                                        ))}
                                    </div>
                                </div>

                                <div className="dr-field">
                                    <div className="dr-label-row">
                                        <label>الفئات</label>
                                        <span className="dr-mini-actions">
                                            <button onClick={() => setConfig({ ...config, categories: DRAW_CATEGORIES.map(c => c.id) })}>الكل</button>
                                            <button onClick={() => setConfig({ ...config, categories: ['general'] })}>المكتبة فقط</button>
                                        </span>
                                    </div>
                                    <div className="dr-cats">
                                        {DRAW_CATEGORIES.map(c => {
                                            const on = config.categories.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleCategory(c.id)}
                                                    className="dr-cat"
                                                    style={{
                                                        borderColor: on ? `${c.hex}66` : 'rgba(255,255,255,0.06)',
                                                        background: on ? `${c.hex}18` : 'rgba(255,255,255,0.02)',
                                                        color: on ? c.hex : '#8c7f68',
                                                    }}
                                                >
                                                    <span className="dr-cat-dot" style={{ background: on ? c.hex : 'rgba(255,255,255,0.16)' }} />
                                                    <span className="dr-cat-name">{c.label}</span>
                                                    <span className="dr-cat-count">{bankByCategory[c.id]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="dr-help">تنخلط الكلمات من الفئات المفعّلة فقط</p>
                                </div>

                                <div className="dr-field">
                                    <label>سلوك اللعبة</label>
                                    <div className="dr-switches">
                                        <SwitchRow label="تقدّم تلقائي" hint="ينتقل للجولة التالية بنفسه" value={config.autoProgress} onChange={() => setConfig({ ...config, autoProgress: !config.autoProgress })} icon={RefreshCw} />
                                        <SwitchRow label="الكل يخمّن" hint="غير مسجّلين أيضاً" value={config.openGuessing} onChange={() => setConfig({ ...config, openGuessing: !config.openGuessing })} icon={Users} />
                                        <SwitchRow label="أصوات" hint="تنبيهات النجاح والوقت" value={config.sound} onChange={() => setConfig({ ...config, sound: !config.sound })} icon={Volume2} />
                                    </div>
                                </div>

                                <div className="dr-field">
                                    <label>معدل بث اللوحة</label>
                                    <div className="dr-choices">
                                        {SYNC_CHOICES.map(s => (
                                            <OptBtn key={s.ms} active={config.syncMs === s.ms} color={GOLD} onClick={() => setConfig({ ...config, syncMs: s.ms })} sub={`${s.ms}ملي`}>
                                                {s.label}
                                            </OptBtn>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button onClick={startGame} className="dr-cta">
                            <Play size={22} fill="currentColor" /> افتح باب المرسم
                        </button>

                        <button onClick={onHome} className="dr-back"><ChevronLeft size={15} /> العودة للرئيسية</button>
                    </div>
                </div>

                <SidebarPortal>
                    <SidebarPanel
                        phaseLabel="التحضير"
                        poolCount={poolCount}
                        players={participants.length}
                        round={round}
                        totalRounds={config.totalRounds}
                        copied={copied}
                        onCopyObs={copyObs}
                        config={config}
                        setConfig={setConfig}
                    />
                </SidebarPortal>
                <style>{DR_STYLES}</style>
            </div>
        );
    }

    /* =========================== Lobby =========================== */
    if (phase === 'LOBBY') {
        return (
            <div className="dr-root" dir="rtl">
                <div className="dr-bg" />
                <div className="dr-scroll">
                    <div className="dr-inner">
                        <header className="dr-stage-head">
                            <div>
                                <h2 className="dr-h2">بانتظار المبدعين</h2>
                                <p className="dr-p">أرسل كلمة الانضمام في الشات للدخول للقائمة</p>
                            </div>
                            <div className="dr-pill-gold"><Users size={14} /> {participants.length}/{config.maxPlayers}</div>
                        </header>

                        <div className="dr-keyword">
                            <span className="dr-keyword-label">اكتب في الشات</span>
                            <span className="dr-keyword-word">{config.joinKeyword}</span>
                        </div>

                        <div className="dr-people">
                            {participants.map(p => (
                                <div key={p.username} className="dr-person">
                                    <ProAvatar url={p.avatar} username={p.username} size="w-11 h-11" className="overflow-visible" />
                                    <span>{p.username}</span>
                                </div>
                            ))}
                            {!participants.length && (
                                <div className="dr-empty-people">
                                    <Loader2 size={22} className="animate-spin" style={{ color: GOLD }} />
                                    <span>لا أحد بعد… أول من يصل يستحق التاج</span>
                                </div>
                            )}
                        </div>

                        <div className="dr-btn-row">
                            <button onClick={resetGame} className="dr-btn-ghost"><Trash2 size={16} /> رجوع</button>
                            <button onClick={beginRounds} disabled={!participants.length} className="dr-btn-solid">
                                <Play size={18} fill="currentColor" /> ابدأ التحدي ({participants.length})
                            </button>
                        </div>
                    </div>
                </div>

                <SidebarPortal>
                    <SidebarPanel
                        phaseLabel="اللوبي"
                        poolCount={poolCount}
                        players={participants.length}
                        round={round}
                        totalRounds={config.totalRounds}
                        copied={copied}
                        onCopyObs={copyObs}
                        config={config}
                        setConfig={setConfig}
                    />
                </SidebarPortal>
                <style>{DR_STYLES}</style>
            </div>
        );
    }

    /* =========================== اختيار الكلمة =========================== */
    if (phase === 'SELECT_WORD') {
        return (
            <div className="dr-root" dir="rtl">
                <div className="dr-bg" />
                <div className="dr-scroll">
                    <div className="dr-inner">
                        <header className="dr-stage-head">
                            <div>
                                <h2 className="dr-h2">الجولة {round} من {config.totalRounds}</h2>
                                <p className="dr-p">اختر كلمة — الجمهور لا يراها، فقط يراها المذيع</p>
                            </div>
                            <div className="dr-pill-gold"><Palette size={14} /> {poolCount.toLocaleString('en')} كلمة</div>
                        </header>

                        {isShuffling ? (
                            <div className="dr-loading">
                                <Loader2 size={44} className="animate-spin" style={{ color: GOLD }} />
                                <span>يخلط المخزن…</span>
                            </div>
                        ) : (
                            <div className="dr-words">
                                {options.map((e, i) => {
                                    const t = DRAW_TIERS[e.tier];
                                    const c = drawCategoryById(e.categoryId);
                                    return (
                                        <button key={e.id} onClick={() => selectWord(e)} className="dr-word-card" style={{ borderColor: `${t.hex}44`, ['--wc' as any]: t.hex }}>
                                            <div className="dr-word-top">
                                                <span className="dr-word-kbd">{i + 1}</span>
                                                <span className="dr-word-tier" style={{ color: t.hex, background: `${t.hex}1f`, borderColor: `${t.hex}55` }}>{t.label}</span>
                                            </div>
                                            <div className="dr-word-body">
                                                <span className="dr-word-text">{e.ar}</span>
                                                {e.hint ? <span className="dr-word-hint">{e.hint}</span> : <span className="dr-word-hint">{c?.blurb || 'ارسمها بذكاء'}</span>}
                                            </div>
                                            <div className="dr-word-foot">
                                                <span style={{ color: c?.hex }}>{c?.label}</span>
                                                <span>+{t.points}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="dr-btn-row center">
                            <button onClick={reroll} className="dr-btn-ghost"><Shuffle size={16} /> اخلط أخرى</button>
                            <button onClick={resetGame} className="dr-btn-ghost danger"><Ban size={16} /> إنهاء</button>
                        </div>
                        <p className="dr-tip">اختصار: أضغط <b>1</b> أو <b>2</b> أو <b>3</b> لاختيار سريع</p>
                    </div>
                </div>

                <SidebarPortal>
                    <SidebarPanel
                        phaseLabel="اختيار الكلمة"
                        poolCount={poolCount}
                        players={participants.length}
                        round={round}
                        totalRounds={config.totalRounds}
                        copied={copied}
                        onCopyObs={copyObs}
                        config={config}
                        setConfig={setConfig}
                    />
                </SidebarPortal>
                <style>{DR_STYLES}</style>
            </div>
        );
    }

    /* =========================== النتائج =========================== */
    if (phase === 'RESULTS') {
        return (
            <div className="dr-root" dir="rtl">
                <div className="dr-bg" />
                <div className="dr-scroll">
                    <div className="dr-inner">
                        <div className="dr-result">
                            <div className="dr-result-word">
                                <span className="dr-result-label">الكلمة كانت</span>
                                <h3 className="dr-result-text">{entry?.ar || '—'}</h3>
                                <div className="dr-result-meta">
                                    <span style={{ color: tierMeta.hex }}>{tierMeta.label}</span>
                                    <span className="dr-dot">•</span>
                                    <span style={{ color: '#c9a06a' }}>{catLabel}</span>
                                    {entry?.hint && <><span className="dr-dot">•</span><span className="opacity-60">{entry.hint}</span></>}
                                </div>
                            </div>

                            {winners.length ? (
                                <div className="dr-podium">
                                    {winners.map(w => (
                                        <div key={w.user.username} className="dr-pod-row" style={{ borderColor: w.place === 1 ? `${GOLD}66` : 'rgba(255,255,255,0.07)' }}>
                                            <div className="dr-pod-place" style={{ background: w.place === 1 ? GOLD : w.place === 2 ? '#cfd8e3' : '#c98a4b', color: '#1a1006' }}>{w.place}</div>
                                            <ProAvatar url={w.user.avatar} username={w.user.username} size="w-11 h-11" className="overflow-visible" />
                                            <div className="dr-pod-info">
                                                <span className="dr-pod-name">{w.user.username}</span>
                                                <span className="dr-pod-sub">{w.place === 1 ? 'الأسرع' : w.place === 2 ? 'الثاني' : 'الثالث'}</span>
                                            </div>
                                            <div className="dr-pod-pts">+{w.earned}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="dr-noone">
                                    <TimerIcon size={20} style={{ color: EMBER }} />
                                    <span>انتهى الوقت — ولا أحد عرف الكلمة</span>
                                </div>
                            )}

                            <div className="dr-score-strip">
                                {ranked.slice(0, 6).map((p, i) => (
                                    <div key={p.user.username} className="dr-score-chip">
                                        <span className="dr-score-rank">{i + 1}</span>
                                        <span className="dr-score-name">{p.user.username}</span>
                                        <span className="dr-score-val">{p.score}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="dr-btn-row center">
                                <button
                                    onClick={() => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); goNextRound(); }}
                                    className="dr-btn-solid"
                                >
                                    <Play size={17} fill="currentColor" /> {round >= config.totalRounds ? 'الختام' : `الجولة ${round + 1}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <SidebarPortal>
                    <SidebarPanel
                        phaseLabel="النتائج"
                        poolCount={poolCount}
                        players={participants.length}
                        round={round}
                        totalRounds={config.totalRounds}
                        copied={copied}
                        onCopyObs={copyObs}
                        config={config}
                        setConfig={setConfig}
                    />
                </SidebarPortal>
                <style>{DR_STYLES}</style>
            </div>
        );
    }

    /* =========================== الختام =========================== */
    if (phase === 'FINALE') {
        return (
            <div className="dr-root" dir="rtl">
                <div className="dr-bg" />
                <div className="dr-scroll">
                    <div className="dr-inner">
                        <header className="dr-finale-head">
                            <Trophy size={34} style={{ color: GOLD, filter: 'drop-shadow(0 0 18px rgba(232,190,110,.5))' }} />
                            <h2 className="dr-h2">انتهى التحدي</h2>
                        </header>

                        {leader ? (
                            <div className="dr-champ">
                                <div className="dr-champ-glow" />
                                <ProAvatar url={leader.user.avatar} username={leader.user.username} size="w-20 h-20" className="overflow-visible" />
                                <div className="dr-champ-name">{leader.user.username}</div>
                                <div className="dr-champ-sub">{leader.wins} تخمين صحيح • {leader.score} نقطة</div>
                            </div>
                        ) : (
                            <div className="dr-noone"><span>لا نقاط هذه الليلة</span></div>
                        )}

                        <div className="dr-rank-list">
                            {ranked.slice(0, 10).map((p, i) => (
                                <div key={p.user.username} className="dr-rank-row">
                                    <span className="dr-rank-i">{i + 1}</span>
                                    <ProAvatar url={p.user.avatar} username={p.user.username} size="w-8 h-8" className="overflow-visible" />
                                    <span className="dr-rank-n">{p.user.username}</span>
                                    <span className="dr-rank-w">{p.wins}×</span>
                                    <span className="dr-rank-s">{p.score}</span>
                                </div>
                            ))}
                        </div>

                        <div className="dr-btn-row center">
                            <button onClick={beginRounds} className="dr-btn-solid"><RefreshCw size={16} /> تحدٍ جديد</button>
                            <button onClick={resetGame} className="dr-btn-ghost"><Home size={15} /> إعدادات جديدة</button>
                            <button onClick={onHome} className="dr-btn-ghost"><ChevronLeft size={15} /> الرئيسية</button>
                        </div>
                    </div>
                </div>

                <SidebarPortal>
                    <SidebarPanel
                        phaseLabel="الختام"
                        poolCount={poolCount}
                        players={participants.length}
                        round={round}
                        totalRounds={config.totalRounds}
                        copied={copied}
                        onCopyObs={copyObs}
                        config={config}
                        setConfig={setConfig}
                    />
                </SidebarPortal>
                <style>{DR_STYLES}</style>
            </div>
        );
    }

    /* =========================== المرسم (DRAWING) =========================== */
    return (
        <div className={`dr-root dr-studio-root ${showUI ? '' : 'dr-minimal'}`} dir="rtl">
            <div className="dr-topbar">
                <div className="dr-topbar-grp">
                    <div className="dr-round-pill">
                        <Crown size={12} style={{ color: GOLD }} />
                        <span>جولة {round}/{config.totalRounds}</span>
                    </div>
                    <div className="dr-topbar-sep" />
                    <button onClick={handleUndo} className="dr-tool" title="تراجع (Ctrl+Z)"><Undo2 size={15} /></button>
                    <button onClick={handleRedo} className="dr-tool" title="إعادة (Ctrl+Y)"><Redo2 size={15} /></button>
                    <div className="dr-topbar-sep" />
                    <button onClick={() => handleFlip('h')} className="dr-tool" title="قلب أفقي"><FlipHorizontal size={15} /></button>
                    <button onClick={() => handleFlip('v')} className="dr-tool" title="قلب رأسي"><FlipVertical size={15} /></button>
                    <button onClick={() => setMirrorMode(!mirrorMode)} className={`dr-tool ${mirrorMode ? 'on' : ''}`} title="مرآة"><RotateCcw size={15} /></button>
                    <button onClick={() => setShowGrid(!showGrid)} className={`dr-tool ${showGrid ? 'on' : ''}`} title="شبكة"><Grid3X3 size={15} /></button>
                </div>

                <div className="dr-wordbar">
                    <div className="dr-wordbar-info">
                        <span className="dr-wordbar-label">المطلوب رسمه</span>
                        <span className="dr-wordbar-cat" style={{ color: drawCategoryById(entry?.categoryId)?.hex }}>{catLabel}</span>
                    </div>
                    {entry && <PatternBoxes word={entry.ar} revealed={hintLevel >= 3 ? entry.ar.length : hintLevel} size={28} />}
                    <div className="dr-hint-box">
                        <button onClick={revealHint} disabled={hintLevel >= 3} className="dr-hint-btn" title="كشف تلميح (H)">
                            <Lightbulb size={14} />
                            <span>{hintLevel >= 3 ? 'الكلمة مكشوفة' : `كشف تلميح (${hintLevel}/3)`}</span>
                        </button>
                        {hintLevel >= 1 && entry?.hint && <span className="dr-hint-text">{hintLevel >= 2 ? entry.hint : drawCategoryById(entry.categoryId)?.blurb}</span>}
                    </div>
                </div>

                <div className="dr-topbar-grp">
                    <button onClick={() => setShowUI(false)} className="dr-tool" title="إخفاء الأدوات (Tab)"><EyeOff size={15} /></button>
                    <button onClick={() => setShowExport(true)} className="dr-tool accent"><Sparkles size={15} /> <span>تصدير</span></button>
                    <button onClick={handleHardReset} className="dr-tool danger"><Trash2 size={15} /> <span>مسح</span></button>
                    <button onClick={() => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); endRound(); }} className="dr-tool finish" title="إنهاء الجولة"><Swords size={15} /></button>
                </div>
            </div>

            <div className="dr-body">
                {showUI && <DrawingToolbar activeTool={activeTool} onToolSelect={setActiveTool} />}

                <div className="canvas-container" ref={containerRef}>
                    <div
                        className="canvas-wrapper"
                        style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)`, width: 1920 * zoom / 100, height: 1080 * zoom / 100 }}
                    >
                        <canvas
                            ref={canvasRef}
                            className="drawing-canvas"
                            style={{ width: '100%', height: '100%', maxWidth: 'none', cursor: activeTool === 'hand' ? 'grab' : activeTool === 'move' ? 'move' : 'crosshair' }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                        />
                        <canvas ref={previewCanvasRef} className="preview-canvas" width={1920} height={1080} />
                        {showGrid && <div className="grid-overlay" style={{
                            pointerEvents: 'none',
                            backgroundSize: `${192 * zoom / 100}px ${108 * zoom / 100}px, ${192 * zoom / 100}px ${108 * zoom / 100}px, ${32 * zoom / 100}px ${32 * zoom / 100}px, ${32 * zoom / 100}px ${32 * zoom / 100}px`,
                        }} />}
                    </div>

                    <div className="dr-timer-float">
                        <TimerRing left={timer} total={config.roundDuration} size={78} color={timeColor} label="الوقت" pulse={timer <= 5} />
                        <div className="dr-timer-meta">
                            <div><Users size={11} style={{ color: CREAM }} /> {participants.length}</div>
                            <div><Trophy size={11} style={{ color: GOLD }} /> {winners.length}/{config.firstWins}</div>
                        </div>
                    </div>

                    {feed.length > 0 && (
                        <div className="dr-feed">
                            {feed.map(f => (
                                <div key={f.id} className={`dr-feed-row ${f.ok ? 'ok' : ''}`}>
                                    {f.ok && f.player && <ProAvatar url={f.player.avatar} username={f.player.username} size="w-8 h-8" className="dr-feed-avatar" />}
                                    <span className="dr-feed-user">{f.user}</span>
                                    <span className="dr-feed-text">{f.ok ? 'أصاب ✓' : f.text}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {winners.length > 0 && entry && (
                        <div className="dr-correct-card" role="status" aria-live="polite">
                            <span className="dr-correct-label">الإجابة الصحيحة هي</span>
                            <strong className="dr-correct-word">{entry.ar}</strong>
                            <div className="dr-correct-winners">
                                {winners.map(w => (
                                    <div key={w.user.username} className="dr-correct-winner">
                                        <ProAvatar url={w.user.avatar} username={w.user.username} size="w-10 h-10" className="dr-correct-avatar" />
                                        <span>{w.user.username}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {showUI && (
                        <div className="property-bar">
                            <div className="prop-group">
                                <div className="prop-label">اللون</div>
                                <input type="color" value={brush.color} onChange={ev => setBrush({ ...brush, color: ev.target.value })} className="hidden" id="dr-main-color" />
                                <label htmlFor="dr-main-color" className="color-swatch" style={{ backgroundColor: brush.color }} />
                                <div className="dr-mini-div" />
                                {COLORS.slice(0, 8).map(c => (
                                    <div key={c} className={`color-swatch ${brush.color === c ? 'active' : ''}`} style={{ backgroundColor: c, width: 17, height: 17 }} onClick={() => setBrush({ ...brush, color: c })} />
                                ))}
                            </div>

                            <div className="dr-mini-div" />

                            <div className="prop-group">
                                <div className="prop-label">حجم</div>
                                <input type="range" min="1" max="150" value={brush.size} onChange={ev => setBrush({ ...brush, size: +ev.target.value })} className="brush-slider" style={{ width: 64 }} />
                                <span className="dr-prop-val">{brush.size}</span>
                            </div>

                            <div className="prop-group">
                                <div className="prop-label">نعومة</div>
                                <input type="range" min="0" max="10" value={brush.stabilizer} onChange={ev => setBrush({ ...brush, stabilizer: +ev.target.value })} className="brush-slider" style={{ width: 56 }} />
                                <span className="dr-prop-val">{brush.stabilizer}</span>
                            </div>

                            <div className="dr-mini-div" />

                            <div className="prop-group">
                                <button onClick={() => setBrush({ ...brush, glow: !brush.glow })} className={`toggle-pro glow ${brush.glow ? 'active' : ''}`}>
                                    <Sparkles size={13} /> {brush.glow ? 'توهج' : 'بلا توهج'}
                                </button>
                                <button onClick={() => setBrush({ ...brush, fillShape: !brush.fillShape })} className={`toggle-pro ${brush.fillShape ? 'active' : ''}`}>
                                    <PaintBucket size={13} /> {brush.fillShape ? 'تعبئة' : 'تحديد'}
                                </button>
                                <button onClick={() => setBackground(brush.color)} className="toggle-pro" title="لون الخلفية"><Monitor size={13} /> خلفية</button>
                            </div>
                        </div>
                    )}

                    <div className="zoom-indicator" style={{ bottom: 18, right: 24 }}>
                        <button className="zoom-btn" onClick={() => setZoom(z => Math.max(25, z - 25))}><ChevronDown size={14} /></button>
                        <span className="zoom-val">{zoom}%</span>
                        <button className="zoom-btn" onClick={() => setZoom(z => Math.min(600, z + 25))}><ChevronUp size={14} /></button>
                        <button className="zoom-btn" onClick={fitToScreen} title="ملاءمة الشاشة"><RotateCcw size={14} /></button>
                    </div>

                    {!showUI && (
                        <button onClick={() => setShowUI(true)} className="dr-reveal-ui"><Eye size={20} /></button>
                    )}
                </div>

                {showUI && (
                    <div className="layers-panel">
                        <LayersPanel
                            layers={layers}
                            activeLayerId={activeLayerId}
                            onSelectLayer={handleSelectLayer}
                            onAddLayer={handleAddLayer}
                            onDeleteLayer={handleDeleteLayer}
                            onToggleVisibility={handleToggleVis}
                            onToggleLock={handleToggleLock}
                            onReorder={handleReorder}
                            onOpacityChange={handleOpacity}
                            onDuplicate={handleDuplicate}
                            onMergeDown={handleMerge}
                            onClearLayer={handleClear}
                            onBlendModeChange={handleBlend}
                        />
                        <div className="filters-panel" style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
                            <div className="filters-header" onClick={() => setShowFilters(!showFilters)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="text-[11px] font-black" style={{ color: CREAM }}><Wand2 size={12} style={{ marginLeft: 6, color: GOLD }} /> مؤثرات</span>
                                {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </div>
                            {showFilters && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 }}>
                                    {[
                                        { id: 'grayscale', label: 'أبيض وأسود' }, { id: 'invert', label: 'سلبي' },
                                        { id: 'sepia', label: 'عتيق' }, { id: 'warm', label: 'دافئ' },
                                        { id: 'cool', label: 'بارد' }, { id: 'saturate', label: 'مشبع' },
                                        { id: 'blur', label: 'ضبابي' }, { id: 'sharpen', label: 'حاد' },
                                    ].map(f => (
                                        <button key={f.id} className="dr-filter" onClick={() => handleFilter(f.id)}>{f.label}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="dr-statusbar">
                <span>X {cursorPos.x} · Y {cursorPos.y}</span>
                <span className="dr-sb-sep">|</span>
                <span>1920 × 1080</span>
                <span className="dr-sb-sep">|</span>
                <span>{layers.length} طبقات</span>
                <span className="dr-sb-grow" />
                <span className="dr-sb-tool">{activeTool}</span>
                <span className="dr-sb-live"><i /> البث متزامن</span>
            </div>

            {showExport && (
                <div className="modal-overlay" onClick={() => setShowExport(false)}>
                    <div className="modal-content dr-export" onClick={ev => ev.stopPropagation()}>
                        <div className="dr-export-title">حفظ اللوحة</div>
                        <p className="dr-export-sub">اختر الصيغة المناسب</p>
                        <button className="dr-exp-row" onClick={() => handleExport('png')}>
                            <FileImage size={20} style={{ color: '#7fb3ff' }} />
                            <span><b>PNG</b><em>خلفية شفافة · أعلى جودة</em></span>
                        </button>
                        <button className="dr-exp-row" onClick={() => handleExport('jpeg')}>
                            <ImageIcon size={20} style={{ color: LIVE }} />
                            <span><b>JPEG</b><em>حجم أصغر · جودة ممتازة</em></span>
                        </button>
                        <button className="dr-exp-row" onClick={() => handleExport('svg')}>
                            <FileText size={20} style={{ color: '#ff9a3c' }} />
                            <span><b>SVG</b><em>متجهات · قابلة للتكبير</em></span>
                        </button>
                        <button className="dr-exp-cancel" onClick={() => setShowExport(false)}>إلغاء</button>
                    </div>
                </div>
            )}

            <SidebarPortal>
                <SidebarPanel
                    phaseLabel="المرسم"
                    poolCount={poolCount}
                    players={participants.length}
                    round={round}
                    totalRounds={config.totalRounds}
                    copied={copied}
                    onCopyObs={copyObs}
                    config={config}
                    setConfig={setConfig}
                    timer={timer}
                    word={entry?.ar || ''}
                    wins={winners.length}
                />
            </SidebarPortal>
            <style>{DR_STYLES}</style>
        </div>
    );
};

/* ======================= لوحة تحكم المذيع (الجانبية) ======================= */

const SidebarPanel: React.FC<{
    phaseLabel: string;
    poolCount: number;
    players: number;
    round: number;
    totalRounds: number;
    copied: boolean;
    onCopyObs: () => void;
    config: GameConfig;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    timer?: number;
    word?: string;
    wins?: number;
}> = ({ phaseLabel, poolCount, players, round, totalRounds, copied, onCopyObs, config, setConfig, timer, word, wins = 0 }) => (
    <>
        <Section title="حالة التحدي" icon={Gauge}>
            <div className="flex items-center justify-between text-[9px] font-black text-icg-cream/80">
                <span>{phaseLabel}</span>
                <span className="text-icg-gold">جولة {round}/{totalRounds}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded-lg bg-icg-gold/5 border border-icg-gold/10 py-1">
                    <b className="block text-[13px] font-black text-icg-gold tabular-nums">{typeof timer === 'number' ? fmtMmr(timer) : '—'}</b>
                    <span className="text-[7px] font-black text-icg-muted tracking-widest">الوقت</span>
                </div>
                <div className="rounded-lg bg-icg-gold/5 border border-icg-gold/10 py-1">
                    <b className="block text-[13px] font-black text-icg-cream tabular-nums">{players}</b>
                    <span className="text-[7px] font-black text-icg-muted tracking-widest">حاضرين</span>
                </div>
                <div className="rounded-lg bg-icg-gold/5 border border-icg-gold/10 py-1">
                    <b className="block text-[13px] font-black text-[#4be07a] tabular-nums">{wins}</b>
                    <span className="text-[7px] font-black text-icg-muted tracking-widest">إصابات</span>
                </div>
            </div>
            {word && (
                <div className="rounded-xl bg-icg-gold/10 border border-icg-gold/20 px-2 py-1.5 text-center">
                    <span className="block text-[7px] font-black text-icg-muted tracking-[0.2em]">الكلمة (للمذيع فقط)</span>
                    <span className="block text-[13px] font-black text-icg-gold">{word}</span>
                </div>
            )}
        </Section>

        <Section title="رابط البث" icon={Monitor} color="#4be07a">
            <button
                onClick={onCopyObs}
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
                الرابط مشفّر وغير معروض على الشاشة — يُضاف في OBS كمصدر متصفح، وستظهر اللوحة فقط بدون أدوات.
            </p>
            <div className="flex items-start gap-1.5 rounded-xl px-2 py-1.5" style={{ background: 'rgba(232,85,47,0.12)', border: '1px solid rgba(232,85,47,0.35)' }}>
                <ShieldAlert size={12} style={{ color: EMBER, marginTop: 1, flexShrink: 0 }} />
                <span className="text-[8.5px] font-black leading-relaxed" style={{ color: '#ffb59a' }}>
                    ممنوع ينتشر! هذا الرابط للمذيع فقط — مشاركته تُفسد التحدي وتكشف الكلمات.
                </span>
            </div>
        </Section>

        <Section title="إعدادات سريعة" icon={Settings}>
            <div className="space-y-1">
                <SwitchRow label="تقدّم تلقائي" value={config.autoProgress} onChange={() => setConfig(c => ({ ...c, autoProgress: !c.autoProgress }))} icon={RefreshCw} />
                <SwitchRow label="الكل يخمّن" value={config.openGuessing} onChange={() => setConfig(c => ({ ...c, openGuessing: !c.openGuessing }))} icon={Users} />
                <SwitchRow label="أصوات" value={config.sound} onChange={() => setConfig(c => ({ ...c, sound: !c.sound }))} icon={Volume2} />
            </div>
            <div className="grid grid-cols-4 gap-1">
                {[60, 90, 120, 180].map(d => (
                    <OptBtn key={d} active={config.roundDuration === d} color={GOLD} onClick={() => setConfig(c => ({ ...c, roundDuration: d }))}>
                        {d < 60 ? `${d}ث` : `${d / 60}د`}
                    </OptBtn>
                ))}
            </div>
            <div className="flex items-center justify-between text-[8px] font-black text-icg-muted">
                <span>المخزون الفعال</span>
                <span className="text-icg-gold">{poolCount.toLocaleString('en')} كلمة</span>
            </div>
        </Section>
    </>
);

/* =============================== التنسيقات =============================== */

const DR_STYLES = `
.dr-root, .dr-obs {
  --g:#e8be6e; --gl:#f9e0a4; --gd:#a97a30; --bz:#5a3a14; --bw:#2a1a08;
  --es:#1a1006; --ink:#0a0805; --cr:#fbeccb; --mu:#b2a283; --em:#e8552f; --lv:#4be07a;
}
.dr-root { position:relative; flex:1 1 auto; width:100%; min-height:0; display:flex; flex-direction:column;
  background: radial-gradient(120% 90% at 12% 0%, #2a1a08 0%, #150d05 45%, #0a0805 100%); color:var(--cr); overflow:hidden; }
.dr-bg { position:absolute; inset:0; pointer-events:none; opacity:.55;
  background: radial-gradient(60% 45% at 85% 8%, rgba(232,190,110,.16), transparent 70%),
              radial-gradient(50% 40% at 8% 92%, rgba(232,85,47,.12), transparent 70%); }
.dr-scroll { position:relative; flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; }
.dr-scroll::-webkit-scrollbar{width:8px} .dr-scroll::-webkit-scrollbar-thumb{background:rgba(232,190,110,.22);border-radius:99px}
.dr-inner { width:min(1180px, 100%); margin:0 auto; padding:22px 22px 40px; }

/* hero */
.dr-hero { display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:16px 18px; border-radius:22px;
  background:linear-gradient(135deg, rgba(232,190,110,.10), rgba(26,16,6,.55)); border:1px solid rgba(232,190,110,.18);
  box-shadow:0 20px 50px rgba(0,0,0,.45); }
.dr-hero-icon { width:56px; height:56px; border-radius:18px; display:grid; place-items:center; color:#1a1006;
  background:linear-gradient(135deg,var(--gl),var(--gd)); box-shadow:0 0 34px rgba(232,190,110,.42); }
.dr-hero-text { flex:1 1 240px; }
.dr-title { font-size:30px; font-weight:900; font-style:italic; letter-spacing:-.02em; color:#fff; margin:0;
  text-shadow:0 0 26px rgba(232,190,110,.32); }
.dr-subtitle { font-size:12px; font-weight:700; color:rgba(251,236,203,.62); margin:3px 0 0; }
.dr-hero-stats { display:flex; gap:10px; }
.dr-stat { min-width:78px; padding:8px 12px; border-radius:14px; text-align:center;
  background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.14); }
.dr-stat b { display:block; font-size:19px; font-weight:900; color:var(--g); line-height:1.1; }
.dr-stat span { font-size:8px; font-weight:900; color:var(--mu); letter-spacing:.16em; }

/* grid + cards */
.dr-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:16px; margin-top:18px; }
.dr-card { padding:16px; border-radius:22px; background:linear-gradient(180deg, rgba(42,26,8,.5), rgba(10,8,5,.72));
  border:1px solid rgba(232,190,110,.13); box-shadow:inset 0 1px 0 rgba(249,224,164,.06), 0 18px 40px rgba(0,0,0,.4); }
.dr-card-head { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:900; color:var(--cr);
  padding-bottom:10px; margin-bottom:12px; border-bottom:1px solid rgba(232,190,110,.12); }
.dr-card-head em { margin-inline-start:auto; font-style:normal; font-size:9px; font-weight:900; color:var(--g);
  background:rgba(232,190,110,.12); border:1px solid rgba(232,190,110,.28); padding:3px 8px; border-radius:99px; }
.dr-field { margin-bottom:14px; }
.dr-field label { display:block; font-size:9px; font-weight:900; color:rgba(178,162,131,.85); letter-spacing:.18em; margin-bottom:6px; }
.dr-help { font-size:9px; font-weight:700; color:rgba(178,162,131,.55); margin:5px 0 0; }
.dr-label-row { display:flex; align-items:center; justify-content:space-between; }
.dr-mini-actions { display:flex; gap:4px; }
.dr-mini-actions button { font-size:8px; font-weight:900; color:var(--g); background:rgba(232,190,110,.1);
  border:1px solid rgba(232,190,110,.25); padding:2px 7px; border-radius:99px; cursor:pointer; }
.dr-input { width:100%; background:rgba(10,8,5,.7); border:1px solid rgba(232,190,110,.22); border-radius:14px;
  padding:11px 14px; font-size:15px; font-weight:900; color:var(--cr); outline:none; }
.dr-input:focus { border-color:var(--g); box-shadow:0 0 0 3px rgba(232,190,110,.14); }
.dr-choices { display:grid; grid-template-columns:repeat(auto-fit,minmax(52px,1fr)); gap:6px; }
.dr-switches { display:flex; flex-direction:column; gap:6px; }
.dr-cats { display:grid; grid-template-columns:repeat(auto-fit,minmax(168px,1fr)); gap:6px; max-height:220px; overflow-y:auto; padding-inline-end:4px; }
.dr-cats::-webkit-scrollbar{width:6px} .dr-cats::-webkit-scrollbar-thumb{background:rgba(232,190,110,.2);border-radius:99px}
.dr-cat { display:flex; align-items:center; gap:7px; padding:7px 9px; border-radius:13px; cursor:pointer;
  border:1px solid rgba(255,255,255,.06); font-size:10px; font-weight:900; transition:.18s; }
.dr-cat:hover { transform:translateY(-1px); }
.dr-cat-dot { width:7px; height:7px; border-radius:99px; flex-shrink:0; }
.dr-cat-name { flex:1; text-align:start; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dr-cat-count { font-size:9px; opacity:.7; }

/* cta */
.dr-cta { width:100%; margin-top:20px; padding:20px; border:none; border-radius:22px; cursor:pointer;
  font-size:19px; font-weight:900; font-style:italic; color:#1a1006; display:flex; align-items:center; justify-content:center; gap:12px;
  background:linear-gradient(135deg,var(--gl),var(--g) 45%,var(--gd)); box-shadow:0 22px 52px rgba(232,190,110,.3); transition:.22s; }
.dr-cta:hover { transform:translateY(-2px) scale(1.008); filter:brightness(1.07); }
.dr-cta:active { transform:scale(.98); }
.dr-back { display:flex; align-items:center; gap:5px; margin:16px auto 0; background:none; border:none; cursor:pointer;
  font-size:10px; font-weight:900; letter-spacing:.18em; color:rgba(178,162,131,.5); transition:.2s; }
.dr-back:hover { color:var(--cr); }

/* stage head */
.dr-stage-head { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:18px; flex-wrap:wrap; }
.dr-h2 { font-size:24px; font-weight:900; font-style:italic; color:#fff; margin:0; letter-spacing:-.02em; }
.dr-p { font-size:11px; font-weight:700; color:rgba(251,236,203,.55); margin:4px 0 0; }
.dr-pill-gold { display:flex; align-items:center; gap:7px; padding:8px 14px; border-radius:99px; font-size:11px; font-weight:900;
  color:var(--g); background:rgba(232,190,110,.1); border:1px solid rgba(232,190,110,.26); }

/* lobby */
.dr-keyword { display:flex; align-items:center; justify-content:center; gap:14px; padding:18px; border-radius:22px;
  background:linear-gradient(135deg, rgba(232,190,110,.12), rgba(10,8,5,.6)); border:1px solid rgba(232,190,110,.2); margin-bottom:18px; }
.dr-keyword-label { font-size:11px; font-weight:900; color:var(--mu); letter-spacing:.14em; }
.dr-keyword-word { font-size:30px; font-weight:900; font-style:italic; color:var(--g); padding:6px 26px; border-radius:16px;
  background:rgba(232,190,110,.12); border:2px solid rgba(232,190,110,.4); box-shadow:0 0 40px rgba(232,190,110,.2); }
.dr-people { display:grid; grid-template-columns:repeat(auto-fill,minmax(108px,1fr)); gap:10px; }
.dr-person { display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 6px; border-radius:16px;
  background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.12); animation:drPop .35s ease-out; }
.dr-person span { font-size:10px; font-weight:900; color:var(--cr); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dr-empty-people { grid-column:1/-1; display:flex; flex-direction:column; align-items:center; gap:10px; padding:44px 0;
  font-size:11px; font-weight:900; color:rgba(178,162,131,.5); }
@keyframes drPop { from{opacity:0; transform:scale(.86)} to{opacity:1; transform:scale(1)} }

.dr-btn-row { display:flex; gap:12px; margin-top:22px; flex-wrap:wrap; }
.dr-btn-row.center { justify-content:center; }
.dr-btn-solid { display:flex; align-items:center; gap:10px; padding:16px 34px; border:none; border-radius:18px; cursor:pointer;
  font-size:15px; font-weight:900; color:#1a1006; background:linear-gradient(135deg,var(--gl),var(--gd));
  box-shadow:0 18px 40px rgba(232,190,110,.28); transition:.2s; }
.dr-btn-solid:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.06); }
.dr-btn-solid:disabled { opacity:.35; cursor:not-allowed; }
.dr-btn-ghost { display:flex; align-items:center; gap:8px; padding:15px 24px; border-radius:18px; cursor:pointer;
  font-size:12px; font-weight:900; color:var(--mu); background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.14); transition:.2s; }
.dr-btn-ghost:hover { color:var(--cr); border-color:rgba(232,190,110,.34); }
.dr-btn-ghost.danger:hover { color:#ff9a7a; border-color:rgba(232,85,47,.5); }

/* word pick */
.dr-loading { display:flex; flex-direction:column; align-items:center; gap:14px; padding:70px 0; font-size:12px; font-weight:900; color:var(--mu); }
.dr-words { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; }
.dr-word-card { position:relative; display:flex; flex-direction:column; gap:12px; padding:18px; border-radius:22px; cursor:pointer;
  background:linear-gradient(180deg, rgba(42,26,8,.55), rgba(10,8,5,.8)); border:1px solid rgba(255,255,255,.07); transition:.22s; text-align:start; }
.dr-word-card:hover { transform:translateY(-4px); border-color:var(--wc); box-shadow:0 24px 48px rgba(0,0,0,.5), 0 0 32px color-mix(in srgb, var(--wc) 24%, transparent); }
.dr-word-top { display:flex; align-items:center; justify-content:space-between; }
.dr-word-kbd { width:26px; height:26px; display:grid; place-items:center; border-radius:9px; font-size:12px; font-weight:900;
  color:rgba(251,236,203,.5); background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); }
.dr-word-tier { font-size:9px; font-weight:900; padding:4px 10px; border-radius:99px; border:1px solid; letter-spacing:.06em; }
.dr-word-body { display:flex; flex-direction:column; gap:5px; }
.dr-word-text { font-size:25px; font-weight:900; font-style:italic; color:#fff; letter-spacing:-.01em; }
.dr-word-hint { font-size:10px; font-weight:700; color:rgba(251,236,203,.5); }
.dr-word-foot { display:flex; align-items:center; justify-content:space-between; font-size:9px; font-weight:900;
  padding-top:10px; border-top:1px solid rgba(255,255,255,.06); }
.dr-word-foot span:last-child { color:var(--g); }
.dr-tip { text-align:center; font-size:10px; font-weight:700; color:rgba(178,162,131,.45); margin-top:16px; }
.dr-tip b { color:var(--g); }

/* results */
.dr-result { display:flex; flex-direction:column; gap:18px; align-items:center; }
.dr-result-word { text-align:center; padding:22px 34px; border-radius:26px;
  background:linear-gradient(135deg, rgba(232,190,110,.14), rgba(10,8,5,.7)); border:1px solid rgba(232,190,110,.24);
  box-shadow:0 0 60px rgba(232,190,110,.14); animation:drPop .5s ease-out; }
.dr-result-label { display:block; font-size:9px; font-weight:900; letter-spacing:.3em; color:var(--mu); }
.dr-result-text { font-size:44px; font-weight:900; font-style:italic; color:#fff; margin:6px 0 8px; text-shadow:0 0 32px rgba(232,190,110,.4); }
.dr-result-meta { display:flex; align-items:center; justify-content:center; gap:8px; font-size:10px; font-weight:900; }
.dr-dot { opacity:.35; }
.dr-podium { width:min(560px,100%); display:flex; flex-direction:column; gap:8px; }
.dr-pod-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:18px;
  background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); animation:drSlide .4s ease-out; }
@keyframes drSlide { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none} }
.dr-pod-place { width:26px; height:26px; border-radius:9px; display:grid; place-items:center; font-size:13px; font-weight:900; flex-shrink:0; }
.dr-pod-info { display:flex; flex-direction:column; min-width:0; }
.dr-pod-name { font-size:13px; font-weight:900; color:var(--cr); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dr-pod-sub { font-size:8px; font-weight:900; letter-spacing:.14em; color:var(--mu); }
.dr-pod-pts { margin-inline-start:auto; font-size:16px; font-weight:900; font-style:italic; color:var(--g); }
.dr-noone { display:flex; align-items:center; gap:10px; padding:18px 26px; border-radius:18px; font-size:12px; font-weight:900;
  color:#ff9a7a; background:rgba(232,85,47,.1); border:1px solid rgba(232,85,47,.3); }
.dr-score-strip { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.dr-score-chip { display:flex; align-items:center; gap:8px; padding:7px 12px; border-radius:99px;
  background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.12); font-size:10px; font-weight:900; }
.dr-score-rank { color:var(--mu); } .dr-score-name { color:var(--cr); } .dr-score-val { color:var(--g); }

/* finale */
.dr-finale-head { display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:18px; }
.dr-champ { position:relative; display:flex; flex-direction:column; align-items:center; gap:10px; padding:28px 34px; margin:0 auto 20px;
  border-radius:26px; background:linear-gradient(180deg, rgba(232,190,110,.16), rgba(10,8,5,.75)); border:1px solid rgba(232,190,110,.32); overflow:hidden; }
.dr-champ-glow { position:absolute; inset:auto 0 -60% 0; height:120%; background:radial-gradient(50% 60% at 50% 100%, rgba(232,190,110,.4), transparent 70%); }
.dr-champ-name { position:relative; font-size:26px; font-weight:900; font-style:italic; color:#fff; }
.dr-champ-sub { position:relative; font-size:10px; font-weight:900; letter-spacing:.14em; color:var(--g); }
.dr-rank-list { width:min(620px,100%); margin:0 auto; display:flex; flex-direction:column; gap:6px; }
.dr-rank-row { display:flex; align-items:center; gap:11px; padding:9px 13px; border-radius:14px;
  background:rgba(255,255,255,.025); border:1px solid rgba(232,190,110,.1); }
.dr-rank-i { width:22px; font-size:12px; font-weight:900; color:var(--mu); }
.dr-rank-n { flex:1; font-size:12px; font-weight:900; color:var(--cr); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dr-rank-w { font-size:10px; font-weight:900; color:rgba(75,224,122,.8); }
.dr-rank-s { min-width:54px; text-align:end; font-size:13px; font-weight:900; color:var(--g); }

/* studio */
.dr-studio-root { padding:0; }
.dr-topbar { display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(20,13,6,.9);
  border-bottom:1px solid rgba(232,190,110,.16); backdrop-filter:blur(14px); z-index:60; flex-shrink:0; }
.dr-topbar-grp { display:flex; align-items:center; gap:5px; }
.dr-topbar-sep { width:1px; height:18px; background:rgba(232,190,110,.16); margin:0 3px; }
.dr-round-pill { display:flex; align-items:center; gap:6px; padding:5px 11px; border-radius:99px; font-size:10px; font-weight:900;
  color:var(--g); background:rgba(232,190,110,.1); border:1px solid rgba(232,190,110,.24); }
.dr-tool { display:flex; align-items:center; gap:5px; padding:7px 9px; border-radius:11px; cursor:pointer; font-size:10px; font-weight:900;
  color:rgba(251,236,203,.55); background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); transition:.18s; }
.dr-tool:hover { color:var(--cr); background:rgba(232,190,110,.12); border-color:rgba(232,190,110,.28); }
.dr-tool.on { color:var(--g); border-color:rgba(232,190,110,.5); background:rgba(232,190,110,.14); }
.dr-tool.accent { color:#1a1006; background:linear-gradient(135deg,var(--gl),var(--gd)); border-color:rgba(232,190,110,.5); }
.dr-tool.danger:hover { color:#ff9a7a; background:rgba(232,85,47,.16); border-color:rgba(232,85,47,.4); }
.dr-tool.finish { color:var(--em); border-color:rgba(232,85,47,.34); background:rgba(232,85,47,.1); }

.dr-wordbar { flex:1 1 auto; display:flex; align-items:center; justify-content:center; gap:14px; min-width:0; }
.dr-wordbar-info { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
.dr-wordbar-label { font-size:8px; font-weight:900; letter-spacing:.22em; color:var(--mu); }
.dr-wordbar-cat { font-size:10px; font-weight:900; color:var(--g); }
.dr-hint-box { display:flex; flex-direction:column; gap:3px; align-items:center; }
.dr-hint-btn { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:99px; cursor:pointer; font-size:9.5px; font-weight:900;
  color:var(--g); background:rgba(232,190,110,.1); border:1px dashed rgba(232,190,110,.4); transition:.2s; }
.dr-hint-btn:hover:not(:disabled) { background:rgba(232,190,110,.2); }
.dr-hint-btn:disabled { opacity:.45; cursor:default; }
.dr-hint-text { font-size:9px; font-weight:700; color:rgba(251,236,203,.5); }

.dr-body { flex:1 1 auto; min-height:0; display:flex; position:relative; overflow:hidden; }
.dr-timer-float { position:absolute; top:14px; inset-inline-end:16px; z-index:520; display:flex; flex-direction:column; align-items:center; gap:6px;
  padding:8px; border-radius:18px; background:rgba(20,13,6,.72); border:1px solid rgba(232,190,110,.18); backdrop-filter:blur(10px); }
.dr-timer-meta { display:flex; gap:10px; font-size:10px; font-weight:900; color:var(--cr); }
.dr-timer-meta div { display:flex; align-items:center; gap:4px; }
.dr-feed { position:absolute; bottom:96px; inset-inline-start:16px; z-index:510; display:flex; flex-direction:column; gap:5px;
  width:230px; pointer-events:none; }
.dr-feed-row { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:12px; font-size:10px; font-weight:900;
  background:rgba(20,13,6,.7); border:1px solid rgba(255,255,255,.06); animation:drSlide .3s ease-out; overflow:hidden; }
.dr-feed-avatar { transform:scale(.78); transform-origin:center; margin:-3px; }
.dr-feed-row.ok { border-color:rgba(75,224,122,.4); background:rgba(75,224,122,.1); }
.dr-feed-user { color:var(--g); max-width:96px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dr-feed-text { color:rgba(251,236,203,.6); margin-inline-start:auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dr-feed-row.ok .dr-feed-text { color:#8ef0ad; }
.dr-correct-card { position:absolute; z-index:530; top:18px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:6px;
  min-width:min(320px,calc(100% - 32px)); max-width:calc(100% - 32px); padding:12px 18px; border-radius:18px; text-align:center;
  color:var(--cr); background:rgba(10,8,5,.86); border:1px solid rgba(75,224,122,.42); box-shadow:0 12px 40px rgba(0,0,0,.42); backdrop-filter:blur(12px); animation:drPop .35s ease-out; }
.dr-correct-label { color:var(--g); font-size:10px; font-weight:900; }
.dr-correct-word { color:#fff; font-size:clamp(18px,2.2vw,28px); font-weight:900; }
.dr-correct-winners { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; }
.dr-correct-winner { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:900; color:var(--cr); }
.dr-correct-avatar { transform:scale(.82); margin:-3px; }
.dr-reveal-ui { position:absolute; bottom:20px; inset-inline-start:20px; width:44px; height:44px; border-radius:15px; z-index:600; cursor:pointer;
  display:grid; place-items:center; color:var(--cr); background:rgba(232,190,110,.18); border:1px solid rgba(232,190,110,.4); backdrop-filter:blur(10px); }
.dr-mini-div { width:1px; height:20px; background:rgba(232,190,110,.16); margin:0 4px; }
.dr-prop-val { font-size:9px; font-weight:900; color:var(--cr); min-width:18px; }
.dr-filter { padding:8px 4px; font-size:9px; font-weight:900; color:var(--cr); background:rgba(255,255,255,.03);
  border:1px solid rgba(232,190,110,.12); border-radius:10px; cursor:pointer; transition:.18s; }
.dr-filter:hover { background:rgba(232,190,110,.14); border-color:rgba(232,190,110,.4); color:var(--gl); }
.dr-statusbar { display:flex; align-items:center; gap:9px; padding:6px 14px; font-size:9px; font-weight:900; letter-spacing:.08em;
  color:rgba(178,162,131,.6); background:rgba(10,8,5,.9); border-top:1px solid rgba(232,190,110,.12); flex-shrink:0; }
.dr-sb-sep { opacity:.25; } .dr-sb-grow { flex:1; }
.dr-sb-tool { color:var(--g); }
.dr-sb-live { display:flex; align-items:center; gap:5px; color:rgba(75,224,122,.75); }
.dr-sb-live i { width:6px; height:6px; border-radius:99px; background:#4be07a; box-shadow:0 0 8px #4be07a; animation:pulse 1.6s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
.dr-minimal .dr-topbar, .dr-minimal .dr-statusbar { opacity:.25; }

/* export modal */
.dr-export { width:min(400px,92vw); padding:22px; border-radius:26px; display:flex; flex-direction:column; gap:10px;
  background:linear-gradient(180deg, rgba(42,26,8,.96), rgba(10,8,5,.98)); border:1px solid rgba(232,190,110,.26); }
.dr-export-title { font-size:18px; font-weight:900; font-style:italic; color:#fff; text-align:center; }
.dr-export-sub { font-size:10px; font-weight:700; color:var(--mu); text-align:center; margin:-4px 0 6px; }
.dr-exp-row { display:flex; align-items:center; gap:12px; padding:13px 15px; border-radius:16px; cursor:pointer; text-align:start;
  background:rgba(255,255,255,.03); border:1px solid rgba(232,190,110,.14); color:var(--cr); transition:.2s; }
.dr-exp-row:hover { background:rgba(232,190,110,.12); border-color:rgba(232,190,110,.4); transform:translateY(-2px); }
.dr-exp-row span { display:flex; flex-direction:column; }
.dr-exp-row b { font-size:13px; font-weight:900; }
.dr-exp-row em { font-size:9px; font-weight:700; font-style:normal; color:var(--mu); }
.dr-exp-cancel { margin-top:4px; padding:10px; background:none; border:none; cursor:pointer; font-size:11px; font-weight:900; color:rgba(178,162,131,.55); }
.dr-exp-cancel:hover { color:var(--cr); }

/* OBS */
.dr-obs { position:fixed; inset:0; width:100vw; height:100dvh; min-height:100vh; display:flex; align-items:center; justify-content:center; background:transparent !important; overflow:hidden; }
.dr-obs-canvas { width:min(100%, calc(100vh * 16 / 9)); aspect-ratio:16/9; position:relative; border-radius:14px; overflow:hidden;
  box-shadow:0 0 80px rgba(0,0,0,.55); }
.dr-obs-canvas canvas { position:absolute; inset:0; width:100%; height:100%; }
.dr-obs-hud { position:absolute; top:22px; inset-inline-end:22px; display:flex; align-items:center; gap:12px; padding:10px 16px; border-radius:16px;
  background:rgba(10,8,5,.72); border:1px solid rgba(232,190,110,.28); backdrop-filter:blur(10px); color:var(--cr);
  font-size:14px; font-weight:900; box-shadow:0 14px 36px rgba(0,0,0,.5); }
.dr-obs-hud-row { display:flex; align-items:center; gap:6px; }
.dr-obs-hud-sep { width:1px; height:16px; background:rgba(232,190,110,.24); }
.dr-obs-reveal { position:absolute; bottom:34px; left:50%; transform:translateX(-50%); text-align:center; padding:16px 40px; border-radius:24px;
  background:rgba(10,8,5,.78); border:1px solid rgba(232,190,110,.36); backdrop-filter:blur(12px); animation:drPop .5s ease-out; }
.dr-obs-reveal-label { display:block; font-size:10px; font-weight:900; letter-spacing:.3em; color:var(--mu); }
.dr-obs-reveal-word { display:block; font-size:44px; font-weight:900; font-style:italic; color:#fff; text-shadow:0 0 30px rgba(232,190,110,.5); }
.dr-obs-winners { display:flex; gap:10px; justify-content:center; margin-top:8px; flex-wrap:wrap; }
.dr-obs-winner { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:900; color:var(--cr);
  background:rgba(232,190,110,.12); border:1px solid rgba(232,190,110,.28); padding:4px 10px; border-radius:99px; }
.dr-obs-winner-avatar { transform:scale(.8); margin:-3px; }
.dr-obs-champ { position:absolute; top:22px; inset-inline-start:22px; display:flex; align-items:center; gap:8px; padding:10px 16px; border-radius:16px;
  font-size:14px; font-weight:900; color:var(--g); background:rgba(10,8,5,.72); border:1px solid rgba(232,190,110,.3); }
.dr-obs-champ-avatar { transform:scale(.8); margin:-3px; }
.dr-obs-lobby { display:flex; flex-direction:column; align-items:center; gap:12px; font-size:20px; font-weight:900; font-style:italic; color:var(--cr); }
`;

export default DrawingChallenge;
