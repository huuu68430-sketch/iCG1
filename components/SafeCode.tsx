import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatService } from '../services/chatService';
import { awardPoints } from '../services/points';
import { ProAvatar } from './ProAvatar';
import {
  Settings, Play, Plus, Minus, Users, LogOut, Trophy, Send, Lock, Key,
  Clock, Shield, Target, Siren, Home
} from 'lucide-react';
import './SafeCode.css';

interface SafeCodeProps {
  onHome: () => void;
  isOBS?: boolean;
}

interface Player {
  name: string;
  avatar?: string;
  pts: number;
  att: number;
  last: number;
}

interface LogRow {
  id: string;
  name: string;
  avatar?: string;
  guess: string;
  hit: boolean[];
  nw: number;
}

interface Result {
  kind: 'win' | 'lose';
  name?: string;
  avatar?: string;
  sec?: number;
  tries?: number;
}

type Screen = 'SETUP' | 'LOBBY' | 'PLAY';

const K_SIZE = [0, 0, 0, 9, 8.4, 7, 5.8];
const BOUNDS: Record<'len' | 'time' | 'cd', [number, number, number]> = {
  len: [3, 6, 1],
  time: [30, 300, 15],
  cd: [0, 10, 1],
};

const arDigits = (s: string) =>
  String(s)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

/* ------------------------------------------------------------------ */
/*  الخزنة (SVG) — نفس تصميم icg1-bank                                 */
/* ------------------------------------------------------------------ */
const Vault: React.FC<{
  digits: number;
  open?: boolean;
  revealed: boolean[];
  revealAll?: boolean;
  code: string[];
  dial: number;
  vaultRef?: React.RefObject<HTMLDivElement | null>;
}> = ({ digits, open, revealed, revealAll, code, dial, vaultRef }) => {
  const uid = React.useId().replace(/[:]/g, '');
  const ticks = Array.from({ length: 48 });
  const rivets = Array.from({ length: 12 });

  return (
    <div className={`vw${open ? ' open' : ''}`} style={{ '--k': K_SIZE[digits] ?? 8 } as React.CSSProperties} ref={vaultRef}>
      <div className="glow"><Trophy className="ic f" /></div>
      <div className="door">
        <svg className="vs" viewBox="0 0 400 400" aria-hidden="true">
          <defs>
            <linearGradient id={`sg${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f6ebd9" />
              <stop offset=".35" stopColor="#b99a72" />
              <stop offset=".7" stopColor="#6b5238" />
              <stop offset="1" stopColor="#2a1c10" />
            </linearGradient>
            <radialGradient id={`dg${uid}`} cx=".4" cy=".3" r=".9">
              <stop offset="0" stopColor="#34241a" />
              <stop offset="1" stopColor="#0d0805" />
            </radialGradient>
            <radialGradient id={`rv${uid}`} cx=".35" cy=".3">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#7a6350" />
            </radialGradient>
          </defs>

          <g fill={`url(#sg${uid})`} stroke="#150e08" strokeWidth="2.5">
            <rect x="-8" y="92" width="24" height="52" rx="7" />
            <rect x="-8" y="256" width="24" height="52" rx="7" />
            <rect className="bt b1" x="184" y="0" width="32" height="34" rx="8" />
            <rect className="bt b2" x="184" y="366" width="32" height="34" rx="8" />
            <rect className="bt b3" x="0" y="184" width="34" height="32" rx="8" />
            <rect className="bt b4" x="366" y="184" width="34" height="32" rx="8" />
          </g>

          <circle cx="200" cy="200" r="176" fill={`url(#sg${uid})`} stroke="#150e08" strokeWidth="3" />
          <circle cx="200" cy="200" r="167" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="152" fill="none" stroke="#150e08" strokeOpacity=".5" strokeWidth="2" strokeDasharray="2 7" />
          <circle cx="200" cy="200" r="140" fill={`url(#dg${uid})`} stroke="#cdb391" strokeOpacity=".4" strokeWidth="2" />

          {rivets.map((_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <circle
                key={i}
                cx={(200 + 154 * Math.cos(a)).toFixed(1)}
                cy={(200 + 154 * Math.sin(a)).toFixed(1)}
                r="5"
                fill={`url(#rv${uid})`}
                stroke="#150e08"
                strokeWidth="1.5"
              />
            );
          })}

          <circle className="lamp" cx="200" cy="47" r="5.5" />
          <circle cx="200" cy="150" r="68" fill="#0a0604" stroke="#cdb391" strokeWidth="3" />
          <g className="dial" style={{ transform: `rotate(${dial}deg)` }}>
            {ticks.map((_, i) => (
              <path
                key={i}
                d={`M200 88v${i % 6 ? 5 : 11}`}
                transform={`rotate(${i * 7.5} 200 150)`}
                stroke={i % 6 ? '#a8937a' : '#e0b77e'}
                strokeWidth={i % 6 ? 1.5 : 2.5}
                strokeLinecap="round"
              />
            ))}
          </g>
          <circle cx="200" cy="150" r="42" fill={`url(#dg${uid})`} stroke="#e0b77e" strokeOpacity=".6" strokeWidth="2" />
          <path d="M194 76h12l-6 12z" fill="#e0b77e" />
          <g transform="translate(182 132) scale(1.5)" fill="none" stroke="#e0b77e" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2.5" />
            <path d="M8 11V7.5a4 4 0 0 1 8 0V11M12 15v2" />
          </g>
        </svg>

        <div className="scan" />

        <div className="drums">
          {Array.from({ length: digits }).map((_, i) => {
            const ok = !!revealed[i];
            const bad = !ok && !!revealAll;
            const landed = ok || bad;
            return (
              <div key={i} className={`dr${ok ? ' ok' : ''}${bad ? ' bad' : ''}`}>
                <div
                  className="st"
                  style={landed ? { transform: `translateY(-${((+(code[i] ?? 0)) / 11) * 100}%)` } : undefined}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, k) => (
                    <b key={k}>{d}</b>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  اللعبة                                                             */
/* ------------------------------------------------------------------ */
export const SafeCode: React.FC<SafeCodeProps> = ({ onHome, isOBS }) => {
  const [screen, setScreen] = useState<Screen>('SETUP');
  const [cfg, setCfg] = useState({ len: 4, time: 120, cd: 3, word: 'دخول' });
  const [players, setPlayers] = useState<Player[]>([]);
  const [code, setCode] = useState<string[]>([]);
  const [rev, setRev] = useState<boolean[]>([]);
  const [revealAll, setRevealAll] = useState(false);
  const [tries, setTries] = useState(0);
  const [remain, setRemain] = useState(0);
  const [log, setLog] = useState<LogRow[]>([]);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useState('');
  const [alarm, setAlarm] = useState(false);
  const [dial, setDial] = useState(0);
  const [newName, setNewName] = useState('');
  const [reduce, setReduce] = useState(false);

  const screenRef = useRef<Screen>('SETUP');
  const cfgRef = useRef(cfg);
  const playersRef = useRef<Player[]>([]);
  const codeRef = useRef<string[]>([]);
  const revRef = useRef<boolean[]>([]);
  const triesRef = useRef(0);
  const lockRef = useRef(true);
  const endRef = useRef(0);
  const startRef = useRef(0);
  const triedRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef<(n: number) => void>(() => {});
  const lastTickRef = useRef(-1);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };
  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  /* ---------- preferred-reduced-motion ---------- */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  /* ---------- audio ---------- */
  const tone = (f: number, d: number, at = 0, v = 0.1, type: OscillatorType = 'sine') => {
    try {
      if (!audioRef.current) {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        audioRef.current = new Ctor();
      }
      const c = audioRef.current;
      const o = c.createOscillator();
      const g = c.createGain();
      const n = c.currentTime + at;
      o.type = type;
      o.frequency.value = f;
      o.connect(g);
      g.connect(c.destination);
      g.gain.setValueAtTime(v, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + d);
      o.start(n);
      o.stop(n + d);
    } catch { /* متصفح بلا صوت */ }
  };
  const sCrack = () => { tone(660, 0.12, 0, 0.1, 'triangle'); tone(990, 0.2, 0.1, 0.1, 'triangle'); };
  const sWrong = () => tone(140, 0.25, 0, 0.12, 'sawtooth');
  const sTick = () => tone(1000, 0.05, 0, 0.05, 'square');
  const sAlarm = () => { for (let i = 0; i < 8; i++) tone(i % 2 ? 620 : 880, 0.3, i * 0.3, 0.1, 'square'); };
  const sOpen = () => {
    tone(80, 0.5, 0, 0.3);
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 0.7 + i * 0.14, 0.11, 'triangle'));
  };

  /* ---------- toast ---------- */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2300);
  }, []);

  /* ---------- مركز المنطقة داخل الصفحة (الشات على اليمين) ---------- */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--sc-shift', `${Math.max(0, window.innerWidth / 2 - (r.left + r.width / 2))}px`);
      el.style.setProperty('--sc-pr', `${Math.max(0, window.innerWidth - r.right)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);

  /* ---------- particles ---------- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || reduce) { burstRef.current = () => {}; return; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    type P = { x: number; y: number; r: number; vx: number; vy: number; a: number; l: number };
    const dots: P[] = [];
    const resize = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 40; i++) {
      dots.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, vx: 0, vy: -(Math.random() * 0.5 + 0.15), a: Math.random() * 0.5 + 0.15, l: 0 });
    }

    burstRef.current = (n: number) => {
      const b = vaultRef.current?.getBoundingClientRect();
      const cx = b ? b.left + b.width / 2 : W / 2;
      const cy = b ? b.top + b.height / 2 : H / 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 7;
        const v = Math.random() * 7 + 2;
        dots.push({ x: cx, y: cy, r: Math.random() * 2.4 + 0.8, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, a: 1, l: 1 });
      }
    };

    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = dots.length - 1; i >= 0; i--) {
        const p = dots[i];
        if (p.l) {
          p.vy += 0.12; p.vx *= 0.985; p.a -= 0.012;
          if (p.a <= 0.02) { dots.splice(i, 1); continue; }
        } else if (p.y < -5) {
          p.y = H + 5; p.x = Math.random() * W;
        }
        p.x += p.vx + (p.l ? 0 : Math.sin(p.y / 60) * 0.3);
        p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fillStyle = `rgba(232,190,120,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduce]);

  /* ---------- helpers ---------- */
  const commitPlayers = (next: Player[]) => {
    playersRef.current = next;
    setPlayers(next);
  };

  const goSetup = useCallback(() => {
    clearTimers();
    lockRef.current = true;
    setAlarm(false);
    setResult(null);
    setOpen(false);
    setRevealAll(false);
    setPlayers([]);
    playersRef.current = [];
    setScreen('SETUP');
  }, []);

  const addPlayer = useCallback((name: string, avatar?: string): boolean => {
    const nm = String(name || '').trim().slice(0, 18);
    if (!nm) return false;
    if (screenRef.current !== 'LOBBY' && screenRef.current !== 'PLAY') return false;
    if (playersRef.current.some((p) => p.name.toLowerCase() === nm.toLowerCase())) return false;
    playersRef.current = [...playersRef.current, { name: nm, avatar, pts: 0, att: 0, last: 0 }];
    setPlayers(playersRef.current);
    tone(740, 0.1, 0, 0.07, 'triangle');
    return true;
  }, []);

  const startLobby = () => {
    clearTimers();
    commitPlayers([]);
    setScreen('LOBBY');
  };

  const startGame = useCallback(() => {
    if (!playersRef.current.length) return;
    clearTimers();
    const fresh = playersRef.current.map((p) => ({ ...p, pts: 0, att: 0, last: 0 }));
    commitPlayers(fresh);

    const len = cfgRef.current.len;
    const bytes = new Uint32Array(len);
    crypto.getRandomValues(bytes);
    const nextCode = [...bytes].map((x) => String(x % 10));

    codeRef.current = nextCode;
    revRef.current = Array(len).fill(false);
    triedRef.current = new Set();
    triesRef.current = 0;
    lockRef.current = false;
    lastTickRef.current = -1;
    startRef.current = Date.now();
    endRef.current = Date.now() + cfgRef.current.time * 1000;

    setCode(nextCode);
    setRev(Array(len).fill(false));
    setRevealAll(false);
    setTries(0);
    setLog([]);
    setOpen(false);
    setResult(null);
    setAlarm(false);
    setRemain(cfgRef.current.time * 1000);
    setDial((d) => d + 720);
    setScreen('PLAY');
  }, []);

  const win = useCallback((p: Player) => {
    lockRef.current = true;
    setOpen(true);
    sOpen();
    burstRef.current(180);
    const sec = Math.round((Date.now() - startRef.current) / 1000);
    awardPoints('SAFE_CODE', p.name, p.avatar || '', 'match');
    later(() => {
      setResult({ kind: 'win', name: p.name, avatar: p.avatar, sec, tries: triesRef.current });
    }, 2200);
  }, []);

  const timeout = useCallback(() => {
    if (lockRef.current) return;
    lockRef.current = true;
    setAlarm(true);
    setRevealAll(true);
    sAlarm();
    later(() => {
      setAlarm(false);
      setResult({ kind: 'lose' });
    }, 2600);
  }, []);

  const guess = useCallback((username: string, avatar: string | undefined, raw: string, fromHost = false): boolean => {
    if (screenRef.current !== 'PLAY' || lockRef.current) return false;
    const text = arDigits(String(raw || '')).replace(/\s/g, '');
    const len = cfgRef.current.len;
    if (!/^\d+$/.test(text) || text.length !== len) return false;

    let idx = playersRef.current.findIndex((p) => p.name.toLowerCase() === String(username).toLowerCase());
    if (idx === -1) {
      const nm = String(username || '').trim().slice(0, 18) || 'مخترق';
      playersRef.current = [...playersRef.current, { name: nm, avatar, pts: 0, att: 0, last: 0 }];
      idx = playersRef.current.length - 1;
    }

    const player = playersRef.current[idx];
    const now = Date.now();
    if (now - player.last < cfgRef.current.cd * 1000) {
      if (fromHost) showToast(`انتظر ${Math.ceil((cfgRef.current.cd * 1000 - (now - player.last)) / 1000)} ثواني للمحاولة التالية`);
      return false;
    }
    if (triedRef.current.has(text)) {
      if (fromHost) showToast('هذا الرمز جُرّب من قبل');
      return false;
    }

    triedRef.current.add(text);
    triesRef.current += 1;
    setTries(triesRef.current);

    const nextRev = [...revRef.current];
    let nw = 0;
    const hit = [...text].map((c, i) => {
      const ok = c === codeRef.current[i];
      if (ok && !nextRev[i]) { nextRev[i] = true; nw++; }
      return ok;
    });
    revRef.current = nextRev;
    setRev(nextRev);

    const nextPlayers = [...playersRef.current];
    nextPlayers[idx] = { ...player, last: now, att: player.att + 1, pts: player.pts + nw };
    commitPlayers(nextPlayers);

    setDial((d) => d + (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 180));

    setLog((prev) => {
      const row: LogRow = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: nextPlayers[idx].name,
        avatar,
        guess: text,
        hit,
        nw,
      };
      return [row, ...prev].slice(0, 40);
    });

    if (nextRev.every(Boolean)) {
      win(nextPlayers[idx]);
    } else if (nw) {
      sCrack();
      burstRef.current(30);
    } else {
      sWrong();
    }
    return true;
  }, [showToast, win]);

  /* ---------- chat wiring ---------- */
  useEffect(() => {
    const unsub = chatService.onMessage((msg) => {
      const text = String(msg.content || '').trim();
      const name = msg.user?.username || '';
      if (!name) return;
      const word = cfgRef.current.word.trim();

      if (screenRef.current === 'LOBBY') {
        if (text === word) addPlayer(name, msg.user?.avatar);
        return;
      }
      if (screenRef.current === 'PLAY') {
        if (text === word) { addPlayer(name, msg.user?.avatar); return; }
        guess(name, msg.user?.avatar, text);
      }
    });
    return () => unsub();
  }, [addPlayer, guess]);

  /* ---------- countdown ---------- */
  useEffect(() => {
    if (screen !== 'PLAY') return;
    const id = window.setInterval(() => {
      if (lockRef.current) return;
      const rest = Math.max(0, endRef.current - Date.now());
      setRemain(rest);
      const sec = Math.ceil(rest / 1000);
      if (rest <= 5000 && rest > 0 && sec !== lastTickRef.current) {
        lastTickRef.current = sec;
        sTick();
      }
      if (rest <= 0) timeout();
    }, 100);
    return () => window.clearInterval(id);
  }, [screen, timeout]);

  useEffect(() => () => {
    clearTimers();
    window.clearTimeout(toastTimer.current);
  }, []);

  /* ---------- derived ---------- */
  const step = (k: 'len' | 'time' | 'cd', dir: number) => {
    const [min, max, s] = BOUNDS[k];
    setCfg((prev) => ({ ...prev, [k]: Math.max(min, Math.min(max, prev[k] + dir * s)) }));
  };
  const fmt = (k: 'len' | 'time' | 'cd') => (k === 'len' ? cfg.len : `${cfg[k]}s`);

  const foundCount = rev.filter(Boolean).length;
  const secs = Math.ceil(remain / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const low = remain < 15000;
  const top = [...players].sort((a, b) => b.pts - a.pts || a.att - b.att).slice(0, 5);
  const topThree = [...players].filter((p) => p.pts).sort((a, b) => b.pts - a.pts).slice(0, 3);
  const winner = result?.kind === 'win' ? players.find((p) => p.name === result.name) : undefined;

  const stepper = (k: 'len' | 'time' | 'cd') => (
    <div className="stp">
      <button type="button" onClick={() => step(k, 1)} aria-label="زيادة"><Plus className="ic" /></button>
      <b>{fmt(k)}</b>
      <button type="button" onClick={() => step(k, -1)} aria-label="إنقاص"><Minus className="ic" /></button>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`safecode-root${alarm ? ' alarm' : ''}${reduce ? ' reduce-motion' : ''}`}
      data-s={screen.toLowerCase()}
    >
      <canvas ref={canvasRef} className="fx" aria-hidden="true" />
      <div className="cam" aria-hidden="true"><i /><i /><i /><i /></div>

      <div className="top">
        <img src="/logo-435242.png" alt="" />
        <span className="topname">iCG1</span>
      </div>

      {!isOBS && (
        <button className="homebtn" onClick={onHome} title="الرئيسية" aria-label="الرئيسية">
          <Home className="ic" />
        </button>
      )}
      <button className="exit" onClick={goSetup} aria-label="خروج إلى الإعدادات"><LogOut className="ic" /></button>

      <main>
        <header className="ttl">
          <h1>البنك الآمن</h1>
          <div className="sub">Safe Bank</div>
        </header>

        {/* ================= SETUP ================= */}
        {screen === 'SETUP' && (
          <div className="two">
            <div className="card">
              <div className="ch"><h2>إعدادات اللعبة</h2><Settings className="ic" /></div>
              <div className="box c"><label>عدد أرقام الرمز السري</label>{stepper('len')}</div>
              <div className="row2">
                <div className="box c"><label>وقت الاختراق</label>{stepper('time')}</div>
                <div className="box c"><label>انتظار بين المحاولات</label>{stepper('cd')}</div>
              </div>
              <div className="box">
                <label htmlFor="sc-jw">كلمة الانضمام</label>
                <input
                  className="txt"
                  id="sc-jw"
                  value={cfg.word}
                  maxLength={12}
                  onChange={(e) => setCfg((p) => ({ ...p, word: e.target.value }))}
                />
              </div>
            </div>

            <div className="card hw">
              <div className="vm">
                <Vault digits={4} revealed={[]} code={[]} dial={0} />
              </div>
              <h2>كيف تلعب؟</h2>
              <ol>
                <li><span className="sn">1</span><span>الخزنة مقفلة برمز سري، والوقت يعدّ تنازلياً</span></li>
                <li><span className="sn">2</span><span>اكتب الرمز في الشات، مثل <span className="nb">4821</span></span></li>
                <li><span className="sn">3</span><span>الرقم الصحيح في مكانه ينكشف للجميع، ومن يكشف آخر رقم يفتح الخزنة</span></li>
              </ol>
              <button className="go" onClick={startLobby}><Play className="ic f" />بدء الهجوم</button>
            </div>
          </div>
        )}

        {/* ================= LOBBY ================= */}
        {screen === 'LOBBY' && (
          <>
            <div className="lob">
              <div className="vm">
                <Vault digits={cfg.len} revealed={[]} code={[]} dial={0} />
              </div>
              <h2 className="h2">الخزنة جاهزة للاختراق</h2>
              <div className="pill"><span>أرسل</span><b className="word">{cfg.word}</b><span>للمشاركة</span></div>



              <div className="plist">
                {players.length ? players.map((p) => (
                  <div className="pcard" key={p.name}>
                    <span className="pav">
                      <ProAvatar url={p.avatar} username={p.name} size="w-9 h-9" />
                      <span className="ring" />
                    </span>
                    <span className="t">{p.name}</span>
                  </div>
                )) : (
                  <div className="emp"><Users className="ic" /><span>لا يوجد مخترقون بعد</span></div>
                )}
              </div>
            </div>

            <div className="dock">
              <div className="cnt"><b>{players.length}</b><small>لاعب</small></div>
              <span className="sp" />
              <button className="btn2" onClick={goSetup}>تراجع</button>
              <button className="btn1" onClick={startGame} disabled={!players.length}>
                <Play className="ic f" />ابدأ!
              </button>
            </div>
          </>
        )}

        {/* ================= PLAY ================= */}
        {screen === 'PLAY' && (
          <>
            <div className="hud">
              <span className={`chip${low ? ' low' : ''}`}><Clock className="ic" /><b>{clock}</b></span>
              <span className="chip"><Shield className="ic" /><b>{foundCount}/{cfg.len}</b></span>
              <span className="chip"><Target className="ic" /><b>{tries}</b></span>
            </div>
            <div className="tb"><i className={low ? 'low' : ''} style={{ width: `${Math.max(0, Math.min(100, (remain / (cfg.time * 1000)) * 100))}%` }} /></div>

            <div className="play">
              <div className="vcol">
                <Vault
                  digits={cfg.len}
                  open={open}
                  revealed={rev}
                  revealAll={revealAll}
                  code={code}
                  dial={dial}
                  vaultRef={vaultRef}
                />
                <div className="hint"><Key className="ic" /><span>اكتب {cfg.len} أرقام في الشات لاختراق الخزنة</span></div>


              </div>

              <aside className="card side">
                <div className="ch"><h2>سجل المحاولات</h2><Target className="ic" /></div>
                <div className="lg">
                  {log.length ? log.map((row) => (
                    <div className="lr" key={row.id}>
                      <span className="pav">
                        <ProAvatar url={row.avatar} username={row.name} size="w-9 h-9" />
                        <span className="ring" />
                      </span>
                      <span className="t">{row.name}</span>
                      {row.nw > 0 && <span className="pl">+{row.nw}</span>}
                      <div className="dg">
                        {row.guess.split('').map((c, i) => (
                          <i key={i} className={row.hit[i] ? 'y' : ''}>{c}</i>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div className="emp"><Lock className="ic" /><span>لا توجد محاولات بعد</span></div>
                  )}
                </div>

                <div className="ch" style={{ marginTop: 18 }}><h3>أسرع المخترقين</h3><Trophy className="ic" /></div>
                <ol className="bd">
                  {top.length ? top.map((p, i) => (
                    <li key={p.name}>
                      <span className="r">{i + 1}</span>
                      <span className="pav">
                        <ProAvatar url={p.avatar} username={p.name} size="w-8 h-8" />
                        <span className="ring" />
                      </span>
                      <span>{p.name}</span>
                      <b>{p.pts}</b>
                    </li>
                  )) : <li className="emp" style={{ padding: '12px 0' }}>لا نقاط بعد</li>}
                </ol>
              </aside>
            </div>
          </>
        )}
      </main>

      {/* ================= RESULT ================= */}
      <div className={`ov${result ? ' on' : ''}`}>
        {result?.kind === 'win' && (
          <div className="card res">
            <div className="big"><Trophy className="ic" /></div>
            <h2>فُتحت الخزنة!</h2>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
              <span className="pav lg2">
                <ProAvatar url={winner?.avatar ?? result.avatar} username={result.name || ''} size="w-[110px] h-[110px]" />
                <span className="ring" />
              </span>
            </div>
            <h2>{result.name}</h2>
            <p>كشف آخر رقم بعد {result.tries} محاولة في {result.sec} ثانية</p>

            {topThree.length > 1 && (
              <ol className="bd rboard">
                {topThree.map((p, i) => (
                  <li key={p.name}>
                    <span className="r">{i + 1}</span>
                    <span className="pav">
                      <ProAvatar url={p.avatar} username={p.name} size="w-8 h-8" />
                      <span className="ring" />
                    </span>
                    <span>{p.name}</span>
                    <b>{p.pts}</b>
                  </li>
                ))}
              </ol>
            )}

            <div className="row">
              <button className="btn1" onClick={startGame}><Play className="ic f" />العب مرة ثانية</button>
              <button className="btn2" onClick={goSetup}>الإعدادات</button>
            </div>
          </div>
        )}

        {result?.kind === 'lose' && (
          <div className="card res bd2">
            <div className="big"><Siren className="ic" /></div>
            <h2>انتهى الوقت، الخزنة بقيت مقفلة</h2>
            <p>الرمز السري كان</p>
            <div className="dg">
              {code.map((c, i) => <i key={i} className={rev[i] ? '' : 'y'}>{c}</i>)}
            </div>
            {topThree[0]?.pts ? <p>الأقرب للاختراق: {topThree[0].name} ({topThree[0].pts} أرقام)</p> : null}
            <div className="row">
              <button className="btn1" onClick={startGame}><Play className="ic f" />العب مرة ثانية</button>
              <button className="btn2" onClick={goSetup}>الإعدادات</button>
            </div>
          </div>
        )}
      </div>

      <div className={`toast${toast ? ' on' : ''}`} role="status">{toast}</div>
    </div>
  );
};
