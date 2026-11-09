
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChatUser } from '../types';
import { chatService } from '../services/chatService';
import { awardPoints, awardPointsToMany } from '../services/points';
import {
   Crown, Skull, HeartPulse, Users, Play, RotateCcw, Lock, Unlock,
   Trash2, Home, Settings, Zap, Clock, Timer, Sparkles, Volume2, VolumeX,
   History, Palette, ChevronRight, UserPlus, RefreshCcw, Loader2,
   Image as ImageIcon, Swords, Ghost, AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProAvatar } from './ProAvatar';

interface RouletteProps {
   channelConnected: boolean;
   onHome: () => void;
   isOBS?: boolean;
}

type Phase = 'SETUP' | 'LOBBY' | 'SPINNING' | 'VERDICT' | 'OVER';
type VerdictKind = 'kill' | 'revive';

interface Player {
   user: ChatUser;
   alive: boolean;
   /** رقم اللاعب الثابت — هو وحده ما يُكتب في الشات */
   number: number;
}

interface VerdictLog {
   id: string;
   round: number;
   kind: VerdictKind;
   by: string;
   target: string;
}

interface RouletteConfig {
   joinKeyword: string;
   killKeyword: string;
   reviveKeyword: string;
   spinDuration: number;
   verdictTime: number;
   minParticipants: number;
   reviveEnabled: boolean;
   soundEnabled: boolean;
   neonGlow: boolean;
   showAvatars: boolean;
}

const DEFAULT_CONFIG: RouletteConfig = {
   joinKeyword: '!دخول',
   killKeyword: '!قصاص',
   reviveKeyword: '!إحياء',
   spinDuration: 8,
   verdictTime: 30,
   minParticipants: 2,
   reviveEnabled: true,
   soundEnabled: true,
   neonGlow: true,
   showAvatars: true
};

// Sticker mapping replicated from MusicalChairsGame for consistency
const STICKERS_IABS_MAPPING: Record<string, string | null> = {
   'iabs324244': '3544675', 'iabsdance': '4428507', 'iabsddddddd': '3109207', 'iabshhhh': '3689146',
   'iabsKSA1': '2942650', 'iabst79eer': '4338825', 'iabst7yyhhh': '3989626', 'iabsw6nn': '4428504',
   'iabs235235': '3329508', 'iabs3': '1014969', 'iabs3oooo': '3989709', 'iabs4': '1014975',
   'iabs505': '3823817', 'iabs66': '1056550', 'iabs7': '1015210', 'iabs7son': '2893352',
   'iabs8': '1015225', 'iabs8rd': '2893346', 'iabsa': '1078051', 'iabsa4lfi': '3329257',
   'iabsashhhhhhhi': '3989578', 'iabsb6666666h': '4937186', 'iabsbatman': '3989610', 'iabsboo': '3330599',
   'iabsdaaaaaaaaaaaanc': '4937181', 'iabsdaaance': '3823818', 'iabsdaaanceee': '3989569',
   'iabsdaaannnccee3434': '4937184', 'iabsdanceee': '3500550', 'iabsddddd': '3109209',
   'iabseat': '3109204', 'iabsewwwwwwwwwww': '3989594', 'iabsfloss': '3989597', 'iabsgoooo': '3330629',
   'iabsgraa7': '3989577', 'iabshaaaaaaaaaahhaa': '3329484', 'iabshhh44': '3689147', 'iabshmmmmmi': '2893345',
   'iabshootee': '3329485', 'iabshuu': '3109190', 'iabsjhj': '3330238', 'iabsknslh': '4953422',
   'iabskoksal': '3989580', 'iabslm': '3329260', 'iabsloooove': '4937189', 'iabsm39bbb': '3329530',
   'iabsm9dom': '3989615', 'iabsmusaeed': '3989609', 'iabsnashb': '2893344', 'iabsqqq': '3330234',
   'iabsqwqw': '3330235', 'iabsr3333333b': '4937191', 'iabsrbbee3': '3989591', 'iabsshhhhhhhhhhh': '3330619',
   'iabssmallcup': '2607940', 'iabsswalllffff': '4937179', 'iabst777yh': '3989623', 'iabsw3lykmm': '3544674'
};
const STICKERS_IABS = Object.keys(STICKERS_IABS_MAPPING).map(s => ({ name: s, id: STICKERS_IABS_MAPPING[s] }));

const SEG_BROWN = '#41290f';
const SEG_ESPRESSO = '#0d0905';
const GOLD = '#e8be6e';
const EMBER = '#e8552f';
const LIVE = '#4be07a';

const normalizeName = (s: string) => s.trim().replace(/^@+/, '').trim().toLowerCase();
const stripEmotes = (s: string) => s.replace(/\[emote:[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
// الرقم وحده يحدد الهدف — الكلمات المفتاحية تُتجاهل ويُدعم الأرقام العربية والفارسية
const parseTargetNumber = (raw: string, killKeyword: string, reviveKeyword: string): number | null => {
   let t = stripEmotes(raw).toLowerCase();
   t = t.split(killKeyword.toLowerCase()).join(' ').split(reviveKeyword.toLowerCase()).join(' ');
   t = t.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
   t = t.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
   const m = t.match(/\d{1,3}/);
   return m ? Number(m[0]) : null;
};

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
   const el = document.getElementById('game-sidebar-portal');
   if (!mounted || !el) return null;
   return createPortal(children, el);
};

export const Roulette: React.FC<RouletteProps> = ({ channelConnected, onHome }) => {
   const [phase, setPhase] = useState<Phase>('SETUP');
   const [config, setConfig] = useState<RouletteConfig>(DEFAULT_CONFIG);

   const [players, setPlayers] = useState<Player[]>([]);
   const [isOpen, setIsOpen] = useState(false);
   const [isSpinning, setIsSpinning] = useState(false);
   const [current, setCurrent] = useState<Player | null>(null);
   const [reveal, setReveal] = useState<{ kind: VerdictKind; player: Player } | null>(null);
   const [winner, setWinner] = useState<Player | null>(null);
   const [log, setLog] = useState<VerdictLog[]>([]);
   const [round, setRound] = useState(0);
   // نوع الحكم تختاره اللعبة كل جولة — أول 3 جولات إقصاء مضمون ثم عشوائي
   const [verdictType, setVerdictType] = useState<VerdictKind | null>(null);
   const verdictTypeRef = useRef<VerdictKind | null>(null);
   useEffect(() => { verdictTypeRef.current = verdictType; }, [verdictType]);
   const [verdictLeft, setVerdictLeft] = useState(0);
   const [notice, setNotice] = useState<string | null>(null);

   const alive = useMemo(() => players.filter(p => p.alive), [players]);
   const dead = useMemo(() => players.filter(p => !p.alive), [players]);

   const killTargets = useMemo(
      () => (current ? alive.filter(p => p.user.username !== current.user.username) : []),
      [alive, current]
   );
   const reviveTargets = useMemo(
      () => (config.reviveEnabled ? dead : []),
      [dead, config.reviveEnabled]
   );

   const canvasRef = useRef<HTMLCanvasElement>(null);
   const needleRef = useRef<HTMLDivElement>(null);
   const isOpenRef = useRef(isOpen);
   const phaseRef = useRef(phase);
   const configRef = useRef(config);
   const wheelRef = useRef<Player[]>([]);
   const playersRef = useRef(players);
   const currentRef = useRef<Player | null>(null);
   const revealRef = useRef(false);
   const roundRef = useRef(0);
   const creditedRef = useRef<Set<string>>(new Set());
   const rafRef = useRef(0);
   const currentAngleRef = useRef(0);
   const audioRef = useRef<AudioContext | null>(null);

   useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
   useEffect(() => { phaseRef.current = phase; }, [phase]);
   useEffect(() => { configRef.current = config; }, [config]);
   useEffect(() => { wheelRef.current = alive; }, [alive]);
   useEffect(() => { playersRef.current = players; }, [players]);
   useEffect(() => { currentRef.current = current; }, [current]);
   useEffect(() => { currentAngleRef.current = 0; }, []);

   const flash = useCallback((text: string) => {
      setNotice(text);
      window.setTimeout(() => setNotice(null), 3200);
   }, []);

   /* ---------------- sound ---------------- */
   const tone = useCallback((freq: number, dur: number, type: OscillatorType, gain: number) => {
      if (!configRef.current.soundEnabled) return;
      try {
         if (!audioRef.current) {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return;
            audioRef.current = new Ctx();
         }
         const ctx = audioRef.current;
         if (ctx.state === 'suspended') void ctx.resume();
         const osc = ctx.createOscillator();
         const vol = ctx.createGain();
         osc.type = type;
         osc.frequency.value = freq;
         vol.gain.setValueAtTime(gain, ctx.currentTime);
         vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
         osc.connect(vol).connect(ctx.destination);
         osc.start();
         osc.stop(ctx.currentTime + dur);
      } catch { /* audio is decorative */ }
   }, []);

   const playTick = useCallback(() => tone(760 + Math.random() * 180, 0.04, 'square', 0.035), [tone]);
   const playBoom = useCallback((kind: VerdictKind) => {
      if (kind === 'kill') {
         tone(140, 0.45, 'sawtooth', 0.11);
         tone(58, 0.9, 'sine', 0.14);
      } else {
         tone(520, 0.3, 'sine', 0.09);
         tone(780, 0.55, 'triangle', 0.08);
      }
   }, [tone]);

   /* ---------------- wheel drawing ---------------- */
   const drawFrame = useCallback((highlightIdx: number, spinning: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = canvas.width;
      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 20;

      ctx.clearRect(0, 0, size, size);

      const list = wheelRef.current;
      const count = list.length;

      if (count === 0) {
         const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
         grad.addColorStop(0, '#2a1a08');
         grad.addColorStop(1, '#0a0805');
         ctx.beginPath();
         ctx.arc(cx, cy, radius, 0, Math.PI * 2);
         ctx.fillStyle = grad;
         ctx.fill();
         ctx.strokeStyle = 'rgba(232,190,110,0.25)';
         ctx.lineWidth = 10;
         ctx.stroke();
         ctx.fillStyle = 'rgba(232,190,110,0.55)';
         ctx.font = 'black 54px "Outfit", sans-serif';
         ctx.textAlign = 'center';
         ctx.fillText('الساحة فارغة', cx, cy);
         return;
      }

      const angleStep = (Math.PI * 2) / count;
      const segAngleDeg = 360 / count;
      const isNarrow = segAngleDeg < 20;

      list.forEach((p, i) => {
         const startAngle = i * angleStep;
         const endAngle = (i + 1) * angleStep;
         const isHl = highlightIdx === i && spinning;

         ctx.beginPath();
         ctx.moveTo(cx, cy);
         ctx.arc(cx, cy, radius, startAngle, endAngle);

         if (isHl) {
            const hl = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            hl.addColorStop(0, '#fff3cf');
            hl.addColorStop(0.55, GOLD);
            hl.addColorStop(1, '#a97a30');
            ctx.fillStyle = hl;
            ctx.shadowColor = 'rgba(232,190,110,0.95)';
            ctx.shadowBlur = 55;
         } else {
            const base = i % 2 === 0 ? SEG_BROWN : SEG_ESPRESSO;
            const seg = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
            seg.addColorStop(0, base);
            seg.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = seg;
            ctx.shadowBlur = 0;
         }
         ctx.fill();
         ctx.shadowColor = 'transparent';

         ctx.strokeStyle = isHl ? '#ffffff' : 'rgba(232,190,110,0.35)';
         ctx.lineWidth = isHl ? 5 : 1.5;
         ctx.stroke();

         ctx.save();
         ctx.translate(cx, cy);
         ctx.rotate(startAngle + angleStep / 2);

         let fontSize: number;
         if (count <= 8) fontSize = 32;
         else if (count <= 15) fontSize = 26;
         else if (count <= 25) fontSize = 20;
         else if (count <= 40) fontSize = 16;
         else if (count <= 60) fontSize = 13;
         else if (count <= 90) fontSize = 11;
         else fontSize = 9;
         fontSize = Math.max(6, Math.min(fontSize, radius * 0.13));

         const label = p.user.username.length > 15 ? p.user.username.substring(0, 12) + '..' : p.user.username;
         const num = `#${p.number}`;

         ctx.font = `900 ${fontSize}px "Outfit", sans-serif`;
         ctx.fillStyle = isHl ? '#2b1a05' : '#fbeccb';
         ctx.shadowColor = 'rgba(0,0,0,1)';
         ctx.shadowBlur = 8;

         if (isNarrow) {
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${num} ${label}`, 0, -(radius - fontSize * 1.6));
         } else {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.lineWidth = 4;
            ctx.strokeText(label, radius - 26, -fontSize * 0.5);
            ctx.fillText(label, radius - 26, -fontSize * 0.5);

            // الرقم تحت الاسم مباشرة — نفس ترتيب لوحة الأهداف
            ctx.font = `900 ${Math.max(6, fontSize * 0.72)}px "Outfit", sans-serif`;
            ctx.fillStyle = isHl ? '#2b1a05' : '#e8be6e';
            ctx.lineWidth = 3;
            ctx.strokeText(num, radius - 26, fontSize * 0.8);
            ctx.fillText(num, radius - 26, fontSize * 0.8);
         }
         ctx.restore();
      });

      ctx.beginPath();
      ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#1a1006';
      ctx.lineWidth = 20;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232,190,110,0.18)';
      ctx.lineWidth = 4;
      ctx.stroke();
   }, []);

   useEffect(() => { if (!isSpinning) drawFrame(-1, false); }, [drawFrame, players, isSpinning]);

   const cubicBezier = (t: number): number => {
      let u = t;
      for (let i = 0; i < 8; i++) {
         const xCur = 0.15 * u + 0.3 * u * u + 0.55 * u * u * u;
         const dx = 0.15 + 0.6 * u + 1.65 * u * u;
         if (Math.abs(xCur - t) < 1e-6) break;
         u -= (xCur - t) / dx;
      }
      u = Math.max(0, Math.min(1, u));
      return 2.4 * u - 1.8 * u * u + 0.4 * u * u * u;
   };

   /* ---------------- verdict resolution ---------------- */
   const finishRound = useCallback((nextPlayers: Player[]) => {
      setReveal(null);
      revealRef.current = false;
      setCurrent(null);
      const survivors = nextPlayers.filter(p => p.alive);
      if (survivors.length <= 1) {
         const champ = survivors[0] || null;
         setWinner(champ);
         setPhase('OVER');
         if (champ) {
            awardPoints('SPIN_WHEEL', champ.user.username, champ.user.avatar || '', 'match');
            confetti({
               particleCount: 260,
               spread: 100,
               origin: { y: 0.55 },
               colors: [GOLD, '#ffffff', EMBER, '#fbeccb']
            });
         }
      } else {
         survivors.forEach(p => {
            const key = `${roundRef.current}:${p.user.username.toLowerCase()}`;
            if (creditedRef.current.has(key)) return;
            creditedRef.current.add(key);
            awardPoints('SPIN_WHEEL', p.user.username, p.user.avatar || '', 'round');
         });
         setPhase('LOBBY');
      }
   }, []);

   const applyVerdict = useCallback((kind: VerdictKind, target: Player) => {
      const judge = currentRef.current;
      if (!judge || revealRef.current) return;
      revealRef.current = true;

      const nextPlayers = players.map(p =>
         p.user.id === target.user.id ? { ...p, alive: kind !== 'kill' } : p
      );
      setPlayers(nextPlayers);
      setRound(r => r + 1);
      roundRef.current += 1;
      setLog(prev => [{
         id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
         round: round + 1,
         kind,
         by: judge.user.username,
         target: target.user.username
      }, ...prev].slice(0, 30));

      setReveal({ kind, player: target });
      playBoom(kind);
      if (kind === 'revive') {
         confetti({ particleCount: 90, spread: 60, origin: { y: 0.5 }, colors: [GOLD, LIVE, '#ffffff'] });
      }

      window.setTimeout(() => finishRound(nextPlayers), 2800);
   }, [players, round, playBoom, finishRound]);

   const resolveTarget = useCallback((raw: string, pool: Player[]): Player | null => {
      // الأرقام وحدها تحدد الهدف — الكلمات المفتاحية اختيارية ولا أسماء
      const n = parseTargetNumber(raw, configRef.current.killKeyword, configRef.current.reviveKeyword);
      if (n === null) return null;
      return pool.find(p => p.number === n) || null;
   }, []);

   /* ---------------- chat integration ---------------- */
   useEffect(() => {
      if (!channelConnected) return;
      const cleanup = chatService.onMessage((msg) => {
         const raw = msg.content || '';
         const lower = raw.toLowerCase();
         const cfg = configRef.current;

         // 1) The judged player answering in chat — الرقم فقط، ونوع الحكم محدد من اللعبة
         if (phaseRef.current === 'VERDICT' && !revealRef.current) {
            const judge = currentRef.current;
            if (judge && normalizeName(msg.user.username) === normalizeName(judge.user.username)) {
               const forced = verdictTypeRef.current;
               if (!forced) return;
               const pool = forced === 'kill' ? killTargets : reviveTargets;
               const n = parseTargetNumber(raw, cfg.killKeyword, cfg.reviveKeyword);
               if (n === null) {
                  flash(forced === 'kill' ? 'اكتب رقم اللاعب الذي تريد إقصاءه فقط' : 'اكتب رقم الميت الذي تريد إحياءه فقط');
                  return;
               }
               const target = resolveTarget(raw, pool);
               if (!target) {
                  flash(n === judge.number
                     ? 'هذا رقمك أنت! اكتب رقم الهدف فقط'
                     : (forced === 'kill' ? 'ما في لاعب حي بهذا الرقم — اكتب رقماً من القائمة' : 'ما في ميت بهذا الرقم — اكتب رقماً من القائمة'));
                  return;
               }
               applyVerdict(forced, target);
               return;
            }
            return;
         }

         // 2) Joining the arena
         if (phaseRef.current !== 'LOBBY' || !isOpenRef.current) return;
         const keyword = cfg.joinKeyword.toLowerCase();
         if (!keyword) return;

         const targetStickerId = STICKERS_IABS_MAPPING[keyword];
         const matched = lower.includes(keyword)
            || (!!targetStickerId && (raw.includes(targetStickerId) || lower.includes(`emote:${targetStickerId}:`)));
         if (!matched) return;

         setPlayers(prev => {
            if (prev.length >= 400) return prev;
            const mine = normalizeName(msg.user.username);
            if (prev.some(p => normalizeName(p.user.username) === mine)) return prev;

            chatService.fetchKickAvatar(msg.user.username).then(avatar => {
               if (!avatar) return;
               setPlayers(cur => cur.map(p =>
                  normalizeName(p.user.username) === mine ? { ...p, user: { ...p.user, avatar } } : p
               ));
            });

            return [...prev, { user: msg.user, alive: true, number: prev.length + 1 }];
         });
      });
      return cleanup;
   }, [channelConnected, applyVerdict, resolveTarget, killTargets, reviveTargets, flash]);

   /* ---------------- verdict countdown ---------------- */
   useEffect(() => {
      if (phase !== 'VERDICT' || !current || reveal) return;
      setVerdictLeft(config.verdictTime);
      const startedAt = Date.now();
      const total = config.verdictTime * 1000;

      const iv = window.setInterval(() => {
         const left = Math.max(0, Math.ceil((total - (Date.now() - startedAt)) / 1000));
         setVerdictLeft(left);
         if (left <= 0) {
            window.clearInterval(iv);
            if (!revealRef.current) {
               const forced = verdictTypeRef.current;
               const pool = forced === 'kill' ? killTargets : forced === 'revive' ? reviveTargets : [];
               if (forced && pool.length) {
                  const random = pool[Math.floor(Math.random() * pool.length)];
                  flash('انتهى الوقت — الروليت حسمت القرار');
                  applyVerdict(forced, random);
               } else {
                  finishRound(wheelRef.current);
               }
            }
         }
      }, 250);

      return () => window.clearInterval(iv);
   }, [phase, current, reveal, config.verdictTime, killTargets, reviveTargets, applyVerdict, finishRound, flash]);

   /* ---------------- spin ---------------- */
   const canSpin = phase === 'LOBBY' && !isSpinning && alive.length >= config.minParticipants;

   const spinTheWheel = useCallback(() => {
      if (phaseRef.current !== 'LOBBY' || isSpinning) return;
      const list = wheelRef.current;
      if (list.length < configRef.current.minParticipants) return;

      setIsSpinning(true);
      setPhase('SPINNING');
      setIsOpen(false);
      setWinner(null);

      const winIndex = Math.floor(Math.random() * list.length);
      const angleStep = 360 / list.length;
      const extraSpins = 360 * (16 + Math.floor(Math.random() * 10));
      const winnerNeedleAngle = ((winIndex * angleStep + angleStep / 2 - 270) % 360 + 360) % 360;
      const startAngle = currentAngleRef.current;
      const finalAngle = startAngle - (startAngle % 360) + winnerNeedleAngle + extraSpins;

      const duration = configRef.current.spinDuration * 1000;
      const startTime = Date.now();
      let lastIdx = -1;

      const animate = () => {
         const progress = Math.min(1, (Date.now() - startTime) / duration);
         const eased = cubicBezier(progress);
         const angle = startAngle + (finalAngle - startAngle) * eased;
         currentAngleRef.current = angle;
         if (needleRef.current) needleRef.current.style.transform = `rotate(${angle}deg)`;

         const canvasAngle = ((angle % 360) + 270 + 360) % 360;
         const idx = Math.floor(canvasAngle / (360 / list.length)) % list.length;
         if (idx !== lastIdx) {
            lastIdx = idx;
            playTick();
         }
         drawFrame(idx, true);

         if (progress < 1) {
            rafRef.current = requestAnimationFrame(animate);
            return;
         }

         drawFrame(-1, false);
         setIsSpinning(false);
         const chosen = list[winIndex];
         setCurrent(chosen);

         const hasKill = list.some(p => p.user.id !== chosen.user.id);
         const hasRevive = configRef.current.reviveEnabled
            && playersRef.current.some(p => !p.alive);

         // الروليت تحدد نوع الحكم: أول 3 جولات إقصاء مضمون، بعدها عشوائي بين المتاح
         let nextType: VerdictKind | null = null;
         if (hasKill && (roundRef.current < 3 || !hasRevive || Math.random() < 0.5)) nextType = 'kill';
         else if (hasRevive) nextType = 'revive';

         if (!nextType) {
            flash('لا يوجد أهداف ممكنة لهذه الجولة');
            setPhase('LOBBY');
            setCurrent(null);
            return;
         }
         verdictTypeRef.current = nextType;
         setVerdictType(nextType);
         setPhase('VERDICT');
      };

      rafRef.current = requestAnimationFrame(animate);
   }, [isSpinning, drawFrame, playTick, flash]);

   useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

   const resetGame = () => {
      setPlayers([]);
      setCurrent(null);
      setReveal(null);
      revealRef.current = false;
      setWinner(null);
      setLog([]);
      setRound(0);
      roundRef.current = 0;
      setVerdictType(null);
      verdictTypeRef.current = null;
      creditedRef.current.clear();
      setIsOpen(false);
      currentAngleRef.current = 0;
      if (needleRef.current) needleRef.current.style.transform = 'rotate(0deg)';
   };

   const selectedSticker = useMemo(() => {
      const s = STICKERS_IABS.find(x => x.name.toLowerCase() === config.joinKeyword.toLowerCase());
      return s ? `https://files.kick.com/emotes/${s.id}/full` : null;
   }, [config.joinKeyword]);

   const verdictRatio = current ? Math.max(0, Math.min(1, verdictLeft / config.verdictTime)) : 0;

   /* ================= RENDER ================= */
   return (
      <>
         <SidebarPortal>
            {phase !== 'SETUP' && (
               <div className="space-y-3 animate-in slide-in-from-right duration-500">
                  {/* Control panel */}
                  <div className="glass-card p-3 rounded-[1.5rem] border border-icg-gold/10 space-y-3 shadow-xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#e8be6e] to-transparent"></div>
                     <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-icg-cream uppercase tracking-widest flex items-center gap-2">
                           <Settings size={14} className="text-[#e8be6e]" /> روليت — التحكم
                        </h4>
                        <button onClick={() => setPhase('SETUP')} className="text-icg-muted hover:text-icg-cream transition-colors">
                           <RotateCcw size={16} />
                        </button>
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                        {!isOpen ? (
                           <button onClick={() => setIsOpen(true)} className="bg-icg-gold/8 text-green-500 border border-green-500/20 font-black py-3 rounded-xl text-[10px] hover:bg-green-500/10 transition-all flex flex-col items-center justify-center gap-2 uppercase italic">
                              <Unlock size={18} /> فتح الانضمام
                           </button>
                        ) : (
                           <button onClick={() => setIsOpen(false)} className="bg-icg-ember text-icg-cream font-black py-3 rounded-xl text-[10px] shadow-lg shadow-icg-ember/20 flex flex-col items-center justify-center gap-2 uppercase italic animate-pulse">
                              <Lock size={18} /> إغلاق الانضمام
                           </button>
                        )}
                        <button onClick={resetGame} className="bg-icg-gold/8 text-icg-muted font-black py-3 rounded-xl text-[10px] border border-icg-gold/10 hover:text-icg-cream transition-all italic uppercase flex flex-col items-center justify-center gap-2">
                           <Trash2 size={18} /> تصفير
                        </button>
                     </div>

                     {/* quick revive toggle */}
                     <button
                        onClick={() => setConfig(c => ({ ...c, reviveEnabled: !c.reviveEnabled }))}
                        className={`w-full rounded-xl border-2 px-3 py-2 flex items-center justify-between transition-all ${config.reviveEnabled ? 'bg-icg-live/12 border-icg-live/35 text-icg-live/85' : 'bg-icg-gold/8 border-icg-gold/10 text-icg-muted'}`}
                     >
                        <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                           <HeartPulse size={13} /> خيار الإحياء
                        </span>
                        <span className="text-[9px] font-black italic">{config.reviveEnabled ? 'مُفعّل' : 'معطّل'}</span>
                     </button>

                     <button
                        onClick={spinTheWheel}
                        disabled={!canSpin}
                        className="w-full bg-gradient-to-r from-[#e8be6e] to-[#a97a30] text-[#1a1006] font-black py-3 rounded-2xl text-xs shadow-[0_6px_20px_rgba(232,190,110,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 italic border-t-2 border-white/30 disabled:opacity-30 disabled:hover:scale-100"
                     >
                        {isSpinning ? <Loader2 className="animate-spin" size={20} /> : <Play fill="currentColor" size={20} />} أَدِر الروليت
                     </button>

                     {isOpen && (
                        <div className="flex items-center gap-2 bg-icg-live/10 border border-icg-live/22 rounded-xl px-3 py-1.5">
                           <span className="w-1.5 h-1.5 bg-icg-live rounded-full animate-pulse"></span>
                           <span className="text-[8px] font-black text-icg-live italic uppercase tracking-wider">
                              {alive.length >= config.minParticipants ? 'جاهز للتدوير' : `يحتاج ${config.minParticipants - alive.length} أحياء`}
                           </span>
                        </div>
                     )}
                  </div>

                  {/* Alive */}
                  <div className="glass-card rounded-xl border border-icg-gold/10 flex flex-col overflow-hidden h-[150px] shadow-xl">
                     <div className="p-3 border-b border-icg-gold/10 bg-icg-gold/8 flex justify-between items-center">
                        <span className="text-[10px] font-black text-icg-cream uppercase tracking-widest flex items-center gap-2">
                           <Users size={14} className="text-[#e8be6e]" /> الأحياء
                        </span>
                        <span className="bg-[#e8be6e] text-[#1a1006] px-2 py-0.5 rounded-lg text-[10px] font-black italic shadow-lg">{alive.length}</span>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {alive.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                              <UserPlus size={22} className="mb-1 text-icg-muted" />
                              <p className="text-[10px] font-black text-icg-muted">في انتظار الأبطال...</p>
                           </div>
                        ) : [...alive].reverse().map((p, i) => (
                           <div key={`${p.user.id}-${i}`} className="flex items-center gap-2 p-2 rounded-xl border border-icg-gold/10 bg-icg-brown/30 hover:bg-icg-gold/8 transition-all">
                              <ProAvatar url={p.user.avatar || ''} username={p.user.username} size="w-7 h-7" className="overflow-visible" />
                              <span className="text-[11px] font-black text-icg-cream truncate">{p.user.username}</span>
                              <span className="text-[10px] font-black text-icg-gold tabular-nums shrink-0">#{p.number}</span>
                              {current?.user.id === p.user.id && (
                                 <span className="mr-auto text-[7px] font-black text-[#1a1006] bg-[#e8be6e] px-1.5 py-0.5 rounded uppercase">تحت الحكم</span>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Graveyard */}
                  <div className="glass-card rounded-xl border border-icg-gold/10 flex flex-col overflow-hidden h-[120px] shadow-xl">
                     <div className="p-3 border-b border-icg-gold/10 bg-icg-ember/10 flex justify-between items-center">
                        <span className="text-[10px] font-black text-icg-cream uppercase tracking-widest flex items-center gap-2">
                           <Skull size={14} className="text-icg-ember" /> المقبرة
                        </span>
                        <span className="bg-icg-ember text-icg-cream px-2 py-0.5 rounded-lg text-[10px] font-black italic">{dead.length}</span>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-wrap gap-1.5 content-start">
                        {dead.length === 0 ? (
                           <p className="text-[10px] font-black text-icg-muted/60 italic w-full text-center self-center">لا أحد ميت بعد</p>
                        ) : dead.map((p, i) => (
                           <div key={`${p.user.id}-${i}`} title={`${p.user.username} · #${p.number}`} className="relative w-8 h-8 rounded-lg border border-icg-ember/30 bg-icg-espresso/60 flex items-center justify-center overflow-visible grayscale">
                              <ProAvatar url={p.user.avatar || ''} username={p.user.username} size="w-8 h-8" className="overflow-visible opacity-60" />
                              <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-icg-gold text-[8px] font-black text-icg-espresso grid place-items-center border border-black/60 tabular-nums">#{p.number}</span>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Log */}
                  {log.length > 0 && (
                     <div className="glass-card p-3 rounded-xl border border-icg-gold/10 shadow-xl max-h-[150px] overflow-y-auto custom-scrollbar">
                        <h4 className="text-[9px] font-black text-icg-muted uppercase tracking-widest flex items-center gap-1 mb-2">
                           <History size={12} className="text-amber-500" /> سجل الأحكام
                        </h4>
                        <div className="space-y-1">
                           {log.map(l => (
                              <div key={l.id} className="flex items-center gap-1.5 text-[9px] font-black">
                                 <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.kind === 'kill' ? 'bg-icg-ember' : 'bg-icg-live'}`}></span>
                                 <span className="text-icg-muted">#{l.round}</span>
                                 <span className="text-icg-cream truncate">{l.by}</span>
                                 <span className={l.kind === 'kill' ? 'text-icg-ember' : 'text-icg-live'}>{l.kind === 'kill' ? 'أقصى' : 'أحيا'}</span>
                                 <span className="text-icg-cream/75 truncate">{l.target}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            )}
         </SidebarPortal>

         <div className="roulette-root w-full h-full flex flex-col items-center justify-center relative font-display select-none overflow-hidden" dir="rtl">

            {/* site brown/gold ambience */}
            <div className="absolute inset-0 pointer-events-none -z-10">
               <div className="absolute inset-0 roulette-wash"></div>
               <div className="absolute inset-0 roulette-grid"></div>
            </div>

            {phase === 'SETUP' ? (
               <div className="w-full max-w-4xl animate-in fade-in zoom-in duration-700 p-5 overflow-y-auto max-h-full">
                  <div className="flex flex-col items-center text-center mb-8">
                     <div className="relative group p-4">
                        <div className="absolute inset-0 bg-[#e8be6e] blur-[36px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <div className="w-16 h-16 bg-gradient-to-br from-[#e8be6e] to-[#3a1d0c] rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(232,190,110,0.45)] mb-6 transform group-hover:scale-110 transition-transform duration-500 border-2 border-white/20">
                           <Skull size={28} className="text-icg-cream drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                        </div>
                     </div>
                     <h1 className="roulette-title text-7xl font-black italic tracking-tighter uppercase mb-2">روليت</h1>
                     <div className="flex items-center gap-3">
                        <span className="h-px w-12 bg-[#e8be6e]/40"></span>
                        <p className="text-[#e8be6e] font-black tracking-[0.5em] text-xs uppercase italic">موت أم حياة</p>
                        <span className="h-px w-12 bg-[#e8be6e]/40"></span>
                     </div>
                     <p className="text-icg-muted text-sm font-bold mt-4 max-w-xl leading-relaxed">
                        الروليت تختار شخصاً، وهذا الشخص يقرر: يقصي خصم من الساحة، أو يرجّع ميت للحياة.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 max-w-2xl mx-auto gap-4">
                     {/* Rules & visuals */}
                     <div className="glass-card p-6 rounded-[2rem] border border-icg-gold/20 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-1 h-full bg-[#e8be6e] group-hover:w-2 transition-all"></div>
                        <h3 className="text-lg font-black text-icg-cream flex items-center gap-3 mb-6"><Palette className="text-[#e8be6e]" /> الإعدادات</h3>

                        {/* REVIVE SWITCH — headline setting */}
                        <button
                           onClick={() => setConfig({ ...config, reviveEnabled: !config.reviveEnabled })}
                           className={`w-full mb-4 p-4 rounded-[1.5rem] border-2 transition-all text-right flex items-center gap-4 ${config.reviveEnabled ? 'bg-icg-live/12 border-icg-live/45 shadow-[0_0_30px_rgba(75,224,122,0.14)]' : 'bg-icg-gold/8 border-white/10 grayscale'}`}
                        >
                           <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${config.reviveEnabled ? 'bg-gradient-to-br from-[#7cf2a8] to-[#1c8a4a] border-icg-live/35' : 'bg-icg-espresso/60 border-white/10'}`}>
                              <HeartPulse size={20} className={config.reviveEnabled ? 'text-icg-cream' : 'text-icg-muted'} />
                           </div>
                           <div className="flex-1">
                              <div className="text-sm font-black text-icg-cream uppercase tracking-wide">تفعيل خيار الأحياء</div>
                              <div className="text-[10px] font-bold text-icg-muted">
                                 {config.reviveEnabled
                                    ? 'المحكوم يقدر يرجّع شخص ميت للساحة'
                                    : 'خيار الإحياء مخفي — الإقصاء فقط'}
                              </div>
                           </div>
                           <div className={`w-12 h-6 rounded-full p-1 transition-colors ${config.reviveEnabled ? 'bg-icg-live' : 'bg-icg-brown'}`}>
                              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${config.reviveEnabled ? '-translate-x-6' : 'translate-x-0'}`}></div>
                           </div>
                        </button>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                           <div className="bg-icg-brown/40 p-3 rounded-xl border border-icg-gold/10 space-y-2">
                              <label className="text-[10px] font-black text-icg-muted uppercase flex items-center gap-2"><Timer size={12} /> وقت الحكم</label>
                              <div className="flex items-center justify-between">
                                 <button onClick={() => setConfig({ ...config, verdictTime: Math.max(10, config.verdictTime - 5) })} className="w-7 h-7 rounded-full bg-icg-gold/8 hover:bg-icg-gold/15 text-icg-cream font-black transition-all">-</button>
                                 <span className="text-base font-black text-icg-cream font-mono">{config.verdictTime}ث</span>
                                 <button onClick={() => setConfig({ ...config, verdictTime: Math.min(90, config.verdictTime + 5) })} className="w-7 h-7 rounded-full bg-icg-gold/8 hover:bg-icg-gold/15 text-icg-cream font-black transition-all">+</button>
                              </div>
                           </div>
                           <div className="bg-icg-brown/40 p-3 rounded-xl border border-icg-gold/10 space-y-2">
                              <label className="text-[10px] font-black text-icg-muted uppercase flex items-center gap-2"><Clock size={12} /> مدة الدوران</label>
                              <div className="flex items-center justify-between">
                                 <button onClick={() => setConfig({ ...config, spinDuration: Math.max(3, config.spinDuration - 1) })} className="w-7 h-7 rounded-full bg-icg-gold/8 hover:bg-icg-gold/15 text-icg-cream font-black transition-all">-</button>
                                 <span className="text-base font-black text-icg-cream font-mono">{config.spinDuration}ث</span>
                                 <button onClick={() => setConfig({ ...config, spinDuration: Math.min(20, config.spinDuration + 1) })} className="w-7 h-7 rounded-full bg-icg-gold/8 hover:bg-icg-gold/15 text-icg-cream font-black transition-all">+</button>
                              </div>
                           </div>
                        </div>

                        <div className="bg-icg-brown/40 p-3 rounded-xl border border-icg-gold/10 space-y-2 mb-3">
                           <label className="text-[10px] font-black text-icg-muted uppercase flex items-center gap-2"><Users size={12} /> الحد الأدنى للأحياء</label>
                           <div className="flex items-center justify-between">
                              <button onClick={() => setConfig({ ...config, minParticipants: Math.max(1, config.minParticipants - 1) })} className="w-7 h-7 rounded-full bg-icg-gold/8 hover:bg-icg-gold/15 text-icg-cream font-black transition-all">-</button>
                              <span className="text-base font-black text-icg-cream font-mono">{config.minParticipants}</span>
                              <button onClick={() => setConfig({ ...config, minParticipants: Math.min(50, config.minParticipants + 1) })} className="w-7 h-7 rounded-full bg-icg-gold/8 hover:bg-icg-gold/15 text-icg-cream font-black transition-all">+</button>
                           </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                           <button onClick={() => setConfig({ ...config, soundEnabled: !config.soundEnabled })} className={`p-2.5 rounded-xl border-2 transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase ${config.soundEnabled ? 'bg-[#e8be6e]/15 border-[#e8be6e]/50 text-icg-cream' : 'bg-icg-gold/8 border-transparent text-icg-muted grayscale'}`}>
                              {config.soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />} أصوات
                           </button>
                           <button onClick={() => setConfig({ ...config, neonGlow: !config.neonGlow })} className={`p-2.5 rounded-xl border-2 transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase ${config.neonGlow ? 'bg-[#e8be6e]/15 border-[#e8be6e]/50 text-icg-cream' : 'bg-icg-gold/8 border-transparent text-icg-muted grayscale'}`}>
                              <Sparkles size={15} /> توهج
                           </button>
                           <button onClick={() => setConfig({ ...config, showAvatars: !config.showAvatars })} className={`p-2.5 rounded-xl border-2 transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase ${config.showAvatars ? 'bg-[#e8be6e]/15 border-[#e8be6e]/50 text-icg-cream' : 'bg-icg-gold/8 border-transparent text-icg-muted grayscale'}`}>
                              <ImageIcon size={15} /> الصور
                           </button>
                        </div>

                        <button
                           onClick={() => { setPhase('LOBBY'); setIsOpen(true); }}
                           className="w-full mt-5 bg-gradient-to-r from-[#f9e0a4] to-[#b8863b] text-[#1a1006] font-black py-4 rounded-[1.5rem] text-xl hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_12px_36px_rgba(232,190,110,0.25)] italic border-t-2 border-white/40"
                        >
                           دخول الساحة <ChevronRight size={22} className="rotate-180" />
                        </button>
                     </div>
                  </div>

                  <div className="flex justify-center mt-8 gap-4">
                     <button onClick={onHome} className="p-4 bg-icg-gold/8 hover:bg-icg-gold/15 rounded-full text-icg-muted hover:text-icg-cream transition-all border border-icg-gold/10 shadow-lg">
                        <Home size={22} />
                     </button>
                  </div>
               </div>
            ) : (
               <div className="w-full h-full flex flex-col items-center justify-center relative p-5">

                  {/* top status strip */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">
                     <div className="px-4 py-1.5 rounded-full bg-icg-ink/75 border border-[#e8be6e]/25 backdrop-blur-xl flex items-center gap-2">
                        <Swords size={13} className="text-[#e8be6e]" />
                        <span className="text-[11px] font-black text-icg-cream uppercase tracking-widest italic">روليت</span>
                     </div>
                     <div className="px-3 py-1.5 rounded-full bg-icg-ink/75 border border-icg-gold/20 backdrop-blur-xl flex items-center gap-2">
                        <span className="text-[9px] font-black text-icg-muted uppercase">الجولة</span>
                        <span className="text-[13px] font-black text-[#e8be6e] font-mono">{round}</span>
                     </div>
                     <div className="px-3 py-1.5 rounded-full bg-icg-ink/75 border border-icg-live/25 backdrop-blur-xl flex items-center gap-1.5">
                        <Users size={11} className="text-icg-live" />
                        <span className="text-[12px] font-black text-icg-live/85 font-mono">{alive.length}</span>
                     </div>
                     <div className="px-3 py-1.5 rounded-full bg-icg-ink/75 border border-icg-ember/30 backdrop-blur-xl flex items-center gap-1.5">
                        <Skull size={11} className="text-icg-ember" />
                        <span className="text-[12px] font-black text-icg-ember/85 font-mono">{dead.length}</span>
                     </div>
                  </div>

                  {/* wheel */}
                  <div className="relative" style={{ perspective: '800px' }}>
                     <div className="relative w-[420px] h-[420px] md:w-[520px] md:h-[520px] flex items-center justify-center mx-auto scale-[0.82] md:scale-100">

                        {isSpinning && (
                           <div className="absolute inset-[-30px] rounded-full bg-gradient-to-r from-[#e8be6e]/25 via-[#a97a30]/20 to-[#e8be6e]/25 blur-[45px] pointer-events-none animate-spin-slow" style={{ animationDuration: '2s' }}></div>
                        )}

                        <div className={`w-[360px] h-[360px] md:w-[410px] md:h-[410px] rounded-full p-3 bg-icg-espresso border-[12px] border-[#241606] shadow-[0_0_80px_rgba(0,0,0,1)] overflow-hidden relative ${config.neonGlow ? 'roulette-neon' : ''}`}>
                            <canvas ref={canvasRef} width={1200} height={1200} className="w-full h-full" />
                           <div ref={needleRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 z-[55]" style={{ transformOrigin: 'center center' }}>
                              <div className="relative" style={{ transform: 'translateY(-112px)' }}>
                                 <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 bg-[#e8be6e]/40 blur-[12px] rounded-full ${isSpinning ? 'animate-ping' : 'opacity-0'}`} style={{ animationDuration: '1s' }}></div>
                                 <svg width="20" height="112" viewBox="0 0 20 112" className="drop-shadow-[0_0_30px_rgba(232,190,110,0.9)]">
                                    <defs>
                                       <linearGradient id="rouNeedle" x1="0%" y1="100%" x2="0%" y2="0%">
                                          <stop offset="0%" stopColor="#6b4a12" />
                                          <stop offset="45%" stopColor="#e8be6e" />
                                          <stop offset="100%" stopColor="#fff6dd" />
                                       </linearGradient>
                                       <filter id="rouGlow">
                                          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#e8be6e" floodOpacity="0.9" />
                                       </filter>
                                    </defs>
                                    <path d="M10 0 L3 102 Q10 112 17 102 Z" fill="url(#rouNeedle)" filter="url(#rouGlow)" />
                                    <path d="M10 2 L5 100 Q7 103 9 100 Z" fill="rgba(255,255,255,0.35)" />
                                    <circle cx="10" cy="5" r="3.5" fill="#ffffff" opacity="0.95" />
                                 </svg>
                              </div>
                           </div>
                        </div>

                        {/* hub */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 md:w-32 md:h-32 bg-icg-espresso rounded-full z-[70] border-[6px] border-[#241606] flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,1)]">
                           <div className="absolute -inset-4 bg-[#e8be6e]/15 blur-[30px] rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
                           <button
                              onClick={() => canSpin && spinTheWheel()}
                              disabled={!canSpin}
                              className={`group w-[72px] h-[72px] md:w-[84px] md:h-[84px] bg-gradient-to-br from-[#f9e0a4] to-[#8b5f1d] rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(232,190,110,0.55)] relative overflow-hidden transform rotate-45 border-2 border-white/40 transition-all duration-500 ${canSpin ? 'cursor-pointer hover:scale-110 hover:shadow-[0_0_60px_rgba(232,190,110,0.9)] active:scale-95' : 'cursor-not-allowed opacity-35'}`}
                           >
                              <div className="absolute inset-0 bg-gradient-to-t from-white/25 to-transparent pointer-events-none"></div>
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg] pointer-events-none"></div>
                              <div className="text-[#1a1006] font-black text-xl md:text-2xl -rotate-45 italic tracking-tighter">R</div>
                           </button>
                        </div>

                        <div className="absolute inset-[-20px] border-[1px] border-[#e8be6e]/15 rounded-full pointer-events-none"></div>
                        <div className="absolute inset-[-46px] border-[1px] border-icg-gold/10 rounded-full pointer-events-none animate-spin-slow" style={{ animationDuration: '70s' }}></div>

                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full flex items-center gap-2 border text-[11px] font-black italic uppercase tracking-wider ${isOpen ? 'bg-icg-live/15 border-icg-live/28 text-icg-live' : 'bg-icg-ember/15 border-icg-ember/30 text-icg-ember'}`}>
                           <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-icg-live animate-pulse' : 'bg-icg-ember'}`}></span>
                           {isOpen ? 'الانضمام مفتوح' : 'الانضمام مغلق'}
                        </div>
                     </div>
                  </div>

                  {/* graveyard strip */}
                  {dead.length > 0 && (
                     <div className="mt-8 flex items-center gap-3 bg-icg-espresso/70 backdrop-blur-xl border border-icg-ember/20 rounded-2xl px-4 py-2 max-w-[92vw] overflow-x-auto custom-scrollbar">
                        <span className="text-[9px] font-black text-icg-ember/75 uppercase tracking-widest flex items-center gap-1 shrink-0">
                           <Ghost size={12} /> المقبرة
                        </span>
                        <div className="flex gap-2 shrink-0">
                           {dead.map(p => (
                              <div key={p.user.id} title={`${p.user.username} · #${p.number}`} className="w-9 h-9 rounded-lg border border-icg-ember/30 bg-icg-espresso/70 relative grayscale opacity-55 overflow-visible">
                                 <ProAvatar url={p.user.avatar || ''} username={p.user.username} size="w-9 h-9" className="overflow-visible" />
                                 <Skull size={11} className="absolute -bottom-1 -left-1 text-icg-ember drop-shadow-[0_0_4px_rgba(0,0,0,1)]" />
                                 <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-icg-gold text-[9px] font-black text-icg-espresso grid place-items-center border border-black/60 tabular-nums">#{p.number}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {/* bottom info bar */}
                  <div className="mt-4 bg-icg-espresso/70 backdrop-blur-3xl border border-icg-gold/10 px-5 py-3 rounded-[1.5rem] flex items-center gap-4 shadow-[0_10px_36px_rgba(0,0,0,0.8)]">
                     <div className="flex flex-col items-center px-4 border-l border-white/10">
                        <span className="text-[10px] font-black text-icg-muted uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={12} /> الأحياء</span>
                        <span className="text-lg font-black text-icg-cream italic font-mono leading-none">{alive.length}</span>
                     </div>
                     <div className="flex flex-col items-center px-4 border-l border-white/10">
                        <span className="text-[10px] font-black text-icg-muted uppercase tracking-widest mb-1 flex items-center gap-1"><Zap size={12} /> كلمة الدخول</span>
                        <div className="flex items-center gap-2">
                           <span className="text-lg font-black text-[#e8be6e] italic uppercase leading-none">{config.joinKeyword}</span>
                           {selectedSticker && <img src={selectedSticker} className="w-7 h-7 object-contain" alt="s" />}
                        </div>
                     </div>
                     <div className="flex flex-col items-center px-4">
                        <span className="text-[10px] font-black text-icg-muted uppercase tracking-widest mb-1">الحكم</span>
                        <span className="text-[11px] font-black text-icg-cream">الرقم فقط — بدون كلمة</span>
                     </div>
                  </div>
               </div>
            )}

            {/* ============ VERDICT OVERLAY ============ */}
            {phase === 'VERDICT' && current && (
               <div className="fixed inset-0 z-[200] flex items-center justify-center bg-icg-ink/95 backdrop-blur-2xl animate-in fade-in duration-300 overflow-y-auto py-6" dir="rtl">
                  {/* light beams */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                     <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[70vw] h-[70vh] opacity-[0.13]"
                        style={{ background: 'repeating-conic-gradient(from 0deg at 50% 0%, #e8be6e 0deg 6deg, transparent 6deg 18deg)', maskImage: 'radial-gradient(ellipse at 50% 0%, black, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black, transparent 70%)', animation: 'roulette-beams 26s linear infinite' }}></div>
                     <div className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[#3a1d0c]/25 blur-[130px] rounded-full animate-pulse" style={{ animationDuration: '5s' }}></div>
                     <div className="absolute bottom-[-20%] right-[-10%] w-[45vw] h-[45vw] bg-[#e8be6e]/12 blur-[130px] rounded-full animate-pulse" style={{ animationDuration: '7s' }}></div>
                  </div>

                  <div className="relative w-full max-w-5xl px-5">
                     {/* countdown */}
                     <div className="flex flex-col items-center mb-5">
                        <div className="relative w-20 h-20">
                           <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                              <circle cx="50" cy="50" r="44" fill="none"
                                 stroke={verdictLeft <= 5 ? '#e8552f' : GOLD}
                                 strokeWidth="7" strokeLinecap="round"
                                 strokeDasharray={`${verdictRatio * 276.5} 276.5`}
                                 style={{ transition: 'stroke-dasharray 0.25s linear, stroke 0.3s' }} />
                           </svg>
                           <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-2xl font-black font-mono ${verdictLeft <= 5 ? 'text-icg-ember' : 'text-icg-cream'}`}>{verdictLeft}</span>
                           </div>
                        </div>
                        <span className="text-[9px] font-black text-icg-muted uppercase tracking-[0.4em] mt-2">انتهى الوقت = الروليت تختار عشوائياً</span>
                     </div>

                     {/* judged player */}
                     <div className="flex flex-col items-center mb-6">
                        <div className="relative w-24 h-24 mb-3">
                           <div className="absolute -inset-2 bg-gradient-to-br from-[#e8be6e] via-[#3a1d0c] to-[#e8be6e] rounded-full animate-spin-slow blur-[2px] opacity-80" style={{ animationDuration: '4s' }}></div>
                           <div className="relative w-full h-full rounded-full overflow-hidden ring-2 ring-[#e8be6e]/60 bg-icg-brown shadow-[0_0_50px_rgba(232,190,110,0.35)]">
                              {config.showAvatars && current.user.avatar ? (
                                 <img src={current.user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                 <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-4xl font-black text-[#e8be6e] uppercase">{current.user.username.charAt(0)}</span>
                                 </div>
                              )}
                           </div>
                        </div>
                        <span className="text-[10px] font-black text-[#e8be6e] uppercase tracking-[0.5em] mb-1 italic">أنت تحت الحكم · رقمك <span className="tabular-nums">#{current.number}</span></span>
                        <h2 className="text-4xl md:text-5xl font-black text-icg-cream italic tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(0,0,0,1)]">{current.user.username}</h2>
                        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                           <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${verdictType === 'kill' ? 'bg-icg-ember/15 border-icg-ember/40 text-icg-ember' : 'bg-icg-live/15 border-icg-live/40 text-icg-live'}`}>
                              {verdictType === 'kill' ? 'الروليت قررت: إقصاء' : 'الروليت قررت: إحياء'}
                           </span>
                           <span className="text-icg-muted text-sm font-black">اكتب رقم الهدف في الشات فقط — بدون كلمة</span>
                        </div>
                     </div>

                     {/* الهدف بالرقم فقط — نوع الحكم محدد من الروليت */}
                     {verdictType && (() => {
                        const isKill = verdictType === 'kill';
                        const pool = isKill ? killTargets : reviveTargets;
                        return (
                           <div className={`relative overflow-hidden rounded-[2rem] border-2 p-5 bg-icg-espresso/70 max-w-2xl mx-auto w-full ${isKill ? 'border-icg-ember/35 shadow-[0_0_45px_rgba(232,85,47,0.14)]' : 'border-icg-live/30 shadow-[0_0_45px_rgba(75,224,122,0.12)]'}`}>
                              <div className={`absolute -top-12 -left-12 w-36 h-36 rounded-full blur-2xl pointer-events-none ${isKill ? 'bg-icg-ember/10' : 'bg-icg-live/10'}`} />
                              <div className="relative flex items-center gap-3 mb-3">
                                 <div className={`w-12 h-12 rounded-xl border border-white/20 flex items-center justify-center shrink-0 ${isKill ? 'bg-gradient-to-br from-icg-ember to-[#5a1c0e] shadow-[0_0_25px_rgba(232,85,47,0.45)]' : 'bg-gradient-to-br from-[#7cf2a8] to-[#1c8a4a] shadow-[0_0_25px_rgba(75,224,122,0.42)]'}`}>
                                    {isKill ? <Skull size={22} className="text-icg-cream" /> : <HeartPulse size={22} className="text-icg-cream" />}
                                 </div>
                                 <div className="flex-1">
                                    <div className="text-xl font-black text-icg-cream uppercase italic leading-tight">{isKill ? 'إقصاء' : 'إحياء'}</div>
                                    <div className={`text-[10px] font-bold ${isKill ? 'text-icg-ember/80' : 'text-icg-live/80'}`}>{isKill ? 'اكتب رقم اللاعب في الشات' : 'اكتب رقم الميت في الشات'}</div>
                                 </div>
                              </div>

                              <div className={`relative flex items-center justify-center gap-2 mb-3 rounded-xl bg-black/40 border px-3 py-2 ${isKill ? 'border-icg-ember/25' : 'border-icg-live/25'}`}>
                                 <span className="text-[9px] font-black text-icg-muted uppercase shrink-0">اكتب في الشات</span>
                                 <code className={`text-[15px] font-black ${isKill ? 'text-icg-ember' : 'text-icg-live'}`} dir="ltr">2</code>
                                 <span className="text-[9px] font-bold text-icg-muted/70 shrink-0">فقط · مثال</span>
                              </div>

                              <div className="relative grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[210px] overflow-y-auto custom-scrollbar pr-1">
                                 {pool.map(t => (
                                    <div key={t.user.id} className={`rounded-xl bg-black/30 p-1.5 flex flex-col items-center gap-1 border ${isKill ? 'border-icg-ember/25' : 'border-icg-live/22'}`}>
                                       <div className={`w-full aspect-square rounded-lg overflow-hidden bg-icg-brown ${isKill ? '' : 'grayscale'}`}>
                                          {t.user.avatar ? <img src={t.user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                             : <div className={`w-full h-full flex items-center justify-center text-lg font-black ${isKill ? 'text-icg-ember/60' : 'text-icg-live/60'}`}>{t.user.username.charAt(0).toUpperCase()}</div>}
                                       </div>
                                       <span className="text-[8px] font-black text-icg-cream/80 truncate w-full text-center">{t.user.username}</span>
                                       <span className="text-[15px] leading-none font-black text-icg-gold tabular-nums">#{t.number}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        );
                     })()}

                     {notice && (
                        <div className="mt-5 flex items-center justify-center gap-2 text-amber-400 text-xs font-black animate-in fade-in slide-in-from-bottom-3">
                           <AlertTriangle size={14} /> {notice}
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* ============ REVEAL ============ */}
            {reveal && (
               <div className="fixed inset-0 z-[300] flex items-center justify-center bg-icg-ink/[0.97] backdrop-blur-3xl animate-in fade-in duration-200" dir="rtl">
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                     <div className={`absolute inset-0 ${reveal.kind === 'kill' ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(232,85,47,0.26),transparent_65%)]' : 'bg-[radial-gradient(circle_at_50%_50%,rgba(75,224,122,0.22),transparent_65%)]'}`}></div>
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[2px]"
                        style={{ background: reveal.kind === 'kill' ? 'linear-gradient(90deg,transparent,#e8552f,transparent)' : 'linear-gradient(90deg,transparent,#4be07a,transparent)', animation: 'roulette-slash 0.7s ease-out' }}></div>
                  </div>

                  <div className="relative text-center animate-in zoom-in duration-500">
                     <div className="relative w-36 h-36 mx-auto mb-6">
                        <div className={`absolute -inset-3 rounded-full blur-[18px] animate-pulse ${reveal.kind === 'kill' ? 'bg-icg-ember/40' : 'bg-icg-live/40'}`}></div>
                        <div className={`relative w-full h-full rounded-full overflow-hidden ring-4 ${reveal.kind === 'kill' ? 'ring-icg-ember/70 grayscale' : 'ring-icg-live/70'} bg-icg-brown`}>
                           {reveal.player.user.avatar ? <img src={reveal.player.user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              : <div className="w-full h-full flex items-center justify-center text-6xl font-black text-icg-cream/70">{reveal.player.user.username.charAt(0).toUpperCase()}</div>}
                        </div>
                        <div className={`absolute -bottom-2 -right-2 w-14 h-14 rounded-full flex items-center justify-center border-2 border-black ${reveal.kind === 'kill' ? 'bg-icg-ember' : 'bg-icg-live'}`}>
                           {reveal.kind === 'kill' ? <Skull size={26} className="text-icg-cream" /> : <HeartPulse size={26} className="text-icg-cream" />}
                        </div>
                     </div>

                     <div className={`text-[11px] font-black uppercase tracking-[0.5em] mb-3 ${reveal.kind === 'kill' ? 'text-icg-ember' : 'text-icg-live'}`}>
                        {reveal.kind === 'kill' ? 'نزل للمقبرة' : 'رجع للحياة'}
                     </div>
                     <h2 className="text-5xl md:text-6xl font-black text-icg-cream italic tracking-tighter uppercase drop-shadow-[0_0_35px_rgba(0,0,0,1)]">
                        {reveal.player.user.username}
                     </h2>
                     {current && (
                        <p className="text-icg-muted text-xs font-black mt-3">بقرار من <span className="text-[#e8be6e]">{current.user.username}</span></p>
                     )}
                  </div>
               </div>
            )}

            {/* ============ WINNER ============ */}
            {phase === 'OVER' && winner && (
               <div className="fixed inset-0 z-[300] flex items-center justify-center bg-icg-ink/95 backdrop-blur-3xl animate-in zoom-in duration-500" dir="rtl">
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                     <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#e8be6e]/20 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '3s' }}></div>
                     <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-icg-ember/12 blur-[110px] rounded-full animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
                  </div>

                  <div className="relative max-w-lg w-full mx-4 text-center">
                     <div className="flex justify-center mb-3">
                        <Crown size={70} className="text-[#e8be6e] animate-bounce drop-shadow-[0_0_40px_rgba(232,190,110,0.85)]" strokeWidth={1.6} />
                     </div>
                     <div className="bg-gradient-to-b from-icg-espresso to-icg-ink p-8 rounded-[2.5rem] border border-[#e8be6e]/30 shadow-[0_0_80px_rgba(232,190,110,0.2)] relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#e8be6e] to-transparent"></div>
                        <div className="relative mx-auto mb-5 w-28 h-28">
                           <div className="absolute -inset-3 bg-gradient-to-br from-[#e8be6e] via-icg-deep to-[#e8be6e] rounded-[1.5rem] animate-spin-slow opacity-60 blur-[2px]" style={{ animationDuration: '4s' }}></div>
                           <div className="relative w-full h-full rounded-[1.25rem] overflow-hidden ring-2 ring-[#e8be6e]/50 bg-icg-brown">
                              {winner.user.avatar ? <img src={winner.user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                 : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-[#e8be6e]/80">{winner.user.username.charAt(0).toUpperCase()}</div>}
                           </div>
                        </div>
                        <div className="text-[#e8be6e] font-black uppercase tracking-[0.5em] text-[10px] mb-3 italic">آخر نافع في الساحة</div>
                        <div className="text-4xl font-black text-icg-cream italic tracking-tighter uppercase mb-6">{winner.user.username}</div>
                        <div className="flex gap-3 justify-center">
                           <button onClick={() => { setWinner(null); resetGame(); setPhase('LOBBY'); }} className="px-6 py-3 bg-icg-gold/8 border border-icg-gold/20 text-icg-cream font-black text-sm rounded-xl hover:bg-icg-gold/15 transition-all italic flex items-center gap-2">
                              <RefreshCcw size={15} /> جولة جديدة
                           </button>
                           <button onClick={onHome} className="px-6 py-3 bg-gradient-to-r from-[#e8be6e] to-[#a97a30] text-[#1a1006] font-black text-sm rounded-xl hover:scale-105 transition-all italic flex items-center gap-2 border-t-2 border-white/30">
                              <Home size={15} /> الرئيسية
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {notice && phase !== 'VERDICT' && (
               <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 bg-icg-ink/90 border border-[#e8be6e]/30 text-amber-300 text-xs font-black px-4 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5" dir="rtl">
                  <AlertTriangle size={14} /> {notice}
               </div>
            )}
         </div>

         <style>{`
            .roulette-wash {
               background:
                  radial-gradient(60% 50% at 72% 26%, rgba(160,100,40,.28), transparent 70%),
                  radial-gradient(50% 40% at 12% 92%, rgba(232,190,110,.10), transparent 70%),
                  rgba(10,8,5,.92);
            }
            .roulette-grid {
               background:
                  linear-gradient(rgba(232,190,110,.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(232,190,110,.05) 1px, transparent 1px);
               background-size: 48px 48px;
               -webkit-mask: radial-gradient(70% 70% at 50% 45%, #000, transparent);
               mask: radial-gradient(70% 70% at 50% 45%, #000, transparent);
            }
            .roulette-title {
               background: linear-gradient(180deg, #fff7de 0%, #e8be6e 52%, #a97a30 100%);
               -webkit-background-clip: text;
               background-clip: text;
               color: transparent;
               -webkit-text-fill-color: transparent;
            }
            .roulette-neon {
               box-shadow: 0 0 60px rgba(232, 190, 110, 0.28), inset 0 0 60px rgba(232, 190, 110, 0.12);
               border-color: rgba(232, 190, 110, 0.45) !important;
            }
            @keyframes roulette-beams {
               from { transform: rotate(0deg); }
               to { transform: rotate(360deg); }
            }
            @keyframes roulette-slash {
               0% { transform: translateX(-100vw) rotate(-8deg); opacity: 0; }
               35% { opacity: 1; }
               100% { transform: translateX(100vw) rotate(-8deg); opacity: 0; }
            }
            @keyframes spin-slow {
               from { transform: rotate(0deg); }
               to { transform: rotate(360deg); }
            }
            .animate-spin-slow { animation: spin-slow 80s linear infinite; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(232, 190, 110, 0.25); border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(232, 190, 110, 0.5); }
         `}</style>
      </>
   );
};
