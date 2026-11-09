/**
 * iCG1 — المافيا v4
 * الشاشة الكبيرة (Stage) + جوال اللاعب + لوحة الإدارة (للمشرفين فقط).
 * كل شيء مربوط بالنظام: تسجيل الدخول، صورة العضو، إطاره، وقاعدة البيانات.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, Shield, Maximize, Copy, Check, X, Shuffle, Play, Pause,
  SkipForward, RefreshCw, Users, Moon, Sun, Vote, Skull, Cross, Flame,
  Eye, Loader2, Send, Crown, Lock, Search, Smile, Notebook,
} from 'lucide-react';
import { ProAvatar } from '../../components/ProAvatar';
import { RoleArt } from './mafiaArt';
import {
  GameState, Role, ROLE_INFO, PHASE_LABEL, STEP_LABEL, MIN_PLAYERS, MAX_PLAYERS,
  JOKER_MIN, DETECTIVE_MIN, WIN_TEXT, WIN_TITLE, DET_RESULT_LABEL,
  dealRoles, nextPhase, plan, resetToLobby, playerAct, voteCounts,
  everyoneActed, timeUp, seatPos, detCanAct, detResultOf, detNotesFor, winningSeats,
} from './mafiaEngine';
import * as svc from './mafiaService';
import { awardPointsToMany } from '../../services/points';
import { buildShortJoinLink, isShortRoomRoute, readShortRoomCode } from '../../utils/gameLink';
import './mafia.css';

/* ===== جلسة الموقع ===== */
const readUser = () => {
  try {
    const raw = localStorage.getItem('iabs_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const isAdminSession = () => {
  try {
    const raw = localStorage.getItem('site_access_granted');
    const s = raw ? JSON.parse(raw) : null;
    return !!(s && s.valid && s.role === 'admin');
  } catch { return false; }
};

const handleOf = (u: any) => String(u?.kick_username || u?.id || '').toLowerCase().trim();

export interface MafiaGameProps {
  onHome?: () => void;
}

/* ===== عناصر مساعدة ===== */
const Avatar: React.FC<{ handle: string; url?: string | null; size?: number; ring?: string }> = ({ handle, url, size = 44 }) => (
  <div className="mf-av" style={{ ['--s' as any]: `${size}px` }}>
    <ProAvatar username={handle} url={url || undefined} size="w-full h-full" />
  </div>
);

const RoleCard: React.FC<{ role: Role; player?: string; className?: string }> = ({ role, player, className = '' }) => (
  <div className={`mf-rc is-${role} ${className}`}>
    <span className="mf-rc-art"><RoleArt role={role} /></span>
    <span className="mf-rc-name">{ROLE_INFO[role].n}</span>
    {player ? <span className="mf-rc-player">{player}</span> : null}
  </div>
);

const TimerRing: React.FC<{ left: number; total: number }> = ({ left, total }) => {
  const C = 125.66;
  const off = total > 0 ? C * (1 - Math.max(0, Math.min(1, left / total))) : C;
  return (
    <div className="mf-tmr">
      <svg viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r="20" fill="none"
          stroke={left < 10 ? '#ff6b5a' : '#e8be6e'} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .3s linear' }}
        />
      </svg>
      <b>{Math.max(0, Math.ceil(left))}</b>
    </div>
  );
};

/* ============================================================
   المكوّن الرئيسي
   ============================================================ */
export const MafiaGame: React.FC<MafiaGameProps> = ({ onHome }) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // روابط التصميم الأصلي: m=p للاعب، m=h للوحة الإدارة، وأي شيء آخر = الشاشة الكبيرة
  // المسار المختصر /m=CODE يعني لاعب دائماً
  const shortRoute = isShortRoomRoute();
  const rawMode = (shortRoute ? 'p' : params.get('m') || 's').toLowerCase();
  const mode: 'stage' | 'player' | 'admin' =
    rawMode === 'p' || rawMode === 'player' ? 'player'
      : rawMode === 'h' || rawMode === 'admin' ? 'admin'
        : 'stage';
  const initialCode = (readShortRoomCode() || params.get('r') || sessionStorage.getItem('icg1_mafia_code') || '').toUpperCase();

  const user = useMemo(readUser, []);
  const me = useMemo<svc.PlayerIdentity | null>(() => {
    if (!user) return null;
    const handle = handleOf(user);
    if (!handle) return null;
    return { id: handle, handle, name: user.display_name || user.kick_username || handle, avatar: user.avatar };
  }, [user]);

  const [code, setCode] = useState(initialCode);
  const [room, setRoom] = useState<GameState | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [messages, setMessages] = useState<svc.ChatRow[]>([]);
  const [denied, setDenied] = useState<string | null>(null);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now());

  const roomRef = useRef<GameState | null>(null);
  const rolesRef = useRef<Record<string, Role>>({});
  const codeRef = useRef(code);
  const saveTimer = useRef<any>(null);
  const lastMsgId = useRef(0);
  const joinedRef = useRef(false);
  const advanceTimer = useRef<any>(null);
  const endedRef = useRef(false);
  const lastChat = useRef<Record<string, number>>({});

  codeRef.current = code;
  rolesRef.current = roles;

  const commit = useCallback((next: GameState, persist = true) => {
    roomRef.current = next;
    setRoom(next);
    if (persist && codeRef.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (codeRef.current && roomRef.current) {
          svc.saveRoom(codeRef.current, roomRef.current).then(ok => setDbOk(ok));
        }
      }, 260);
    }
  }, []);

  /* عدّاد عرض كل 300ms */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(id);
  }, []);

  /* ===== حفظ كود الغرفة ===== */
  const rememberCode = useCallback((c: string) => {
    sessionStorage.setItem('icg1_mafia_code', c);
    setCode(c);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('r', c);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  /* ===== تحميل الغرفة (اللاعب واللوحة) ===== */
  useEffect(() => {
    if (mode === 'stage' || !code) return;
    let stop = false;
    let misses = 0;
    const load = async () => {
      const s = await svc.loadRoom(code);
      if (stop) return;
      if (!s) {
        // ننتظر عدة محاولات قبل إظهار الخطأ (الغرفة قد تكون تُنشأ الآن)
        misses += 1;
        if (misses >= 3) {
          setDenied('لم يتم العثور على هذه الغرفة. تأكد من الرابط، أو اطلب من المدير نسخ رابط الدخول من جديد بعد فتح اللعبة على الشاشة الكبيرة.');
        }
        return;
      }
      misses = 0;
      setDenied(null);
      roomRef.current = s;
      setRoom(s);
    };
    load();
    const id = setInterval(load, 1100);
    return () => { stop = true; clearInterval(id); };
  }, [mode, code]);

  /* ===== إنشاء الغرفة (الشاشة الكبيرة) ===== */
  useEffect(() => {
    if (mode !== 'stage') return;
    let stop = false;
    (async () => {
      if (code) {
        const existing = await svc.loadRoom(code);
        if (stop) return;
        if (existing) {
          roomRef.current = existing;
          setRoom(existing);
          const rl = await svc.loadRoles(code);
          if (!stop) { rolesRef.current = rl; setRoles(rl); }
          // نتأكد أن الغرفة موجودة فعلاً في قاعدة البيانات (وليس محلياً فقط)
          svc.saveRoom(code, existing).then(ok => { if (!stop) setDbOk(ok); });
          return;
        }
      }
      const created = await svc.createRoom('stage');
      if (stop) return;
      if (!created) { setDenied('تعذّر الاتصال بقاعدة البيانات. تحقّق من الاتصال وحاول مجدداً.'); return; }
      roomRef.current = created.state;
      setRoom(created.state);
      setDbOk(created.synced);
      rememberCode(created.code);
    })();
    return () => { stop = true; };
  }, [mode, code, rememberCode]);

  /* ===== محرّك الشاشة الكبيرة ===== */
  useEffect(() => {
    if (mode !== 'stage' || !code) return;

    /* دورة المؤقت */
    const tick = setInterval(() => {
      const s = roomRef.current;
      if (!s || !codeRef.current) return;
      if (s.pause) return;
      if (timeUp(s)) {
        const nx = nextPhase(s, rolesRef.current);
        commit(nx);
      }
    }, 400);

    /* نبضة حفظ كل 2.5 ثانية */
    const beat = setInterval(() => {
      if (codeRef.current && roomRef.current) {
        svc.saveRoom(codeRef.current, roomRef.current).then(ok => setDbOk(ok));
      }
    }, 2500);

    return () => { clearInterval(tick); clearInterval(beat); };
  }, [mode, code, commit]);

  /* ===== استقبال أوامر اللاعبين (الشاشة الكبيرة) ===== */
  const maybeAdvance = useCallback((s: GameState) => {
    if (!everyoneActed(s, rolesRef.current)) return;
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      const cur = roomRef.current;
      if (!cur) return;
      if (everyoneActed(cur, rolesRef.current)) commit(nextPhase(cur, rolesRef.current));
    }, 1500);
  }, [commit]);

  const finishMatch = useCallback((s: GameState) => {
    if (endedRef.current || !codeRef.current) return;
    endedRef.current = true;
    const payload = s.P.map(p => ({
      id: p.id, name: p.name, alive: p.alive, role: rolesRef.current[p.id] || null,
    }));
    svc.saveMatch(codeRef.current, s.win || '', s.rd, payload);
    // Credit every player on the winning side a 'match'. Guarded upstream by the
    // endedRef flag in finishMatch, so it runs once when the phase hits 'end'.
    const winners = winningSeats(s, rolesRef.current)
      .map(p => ({ username: p.handle, avatar: p.avatar || undefined }));
    awardPointsToMany('MAHMAH_GAME', winners, 'match');
    svc.logEvent(codeRef.current, 'end', { win: s.win, rounds: s.rd, players: payload });
    if (codeRef.current && s.win) svc.sendMessage(codeRef.current, 'system', null,
      `انتهت اللعبة: ${WIN_TEXT[s.win]}`, s.rd, 'end');
  }, []);

  const applyAction = useCallback((a: svc.RoomAction) => {
    const s = roomRef.current;
    const c = codeRef.current;
    if (!s || !c || !a.user_id) return;
    if (a.kind === 'cmd' && !a.payload?.admin) return;

    const next: GameState = JSON.parse(JSON.stringify(s));
    const p = next.P.find(x => x.id === a.user_id);
    const pl = a.payload || {};
    const stamp = Date.now();

    switch (a.kind) {
      case 'join': {
        if (next.ph !== 'join') return;
        if (p) {
          p.name = String(pl.name || p.name).slice(0, 18);
          p.avatar = pl.avatar || p.avatar;
        } else {
          if (next.P.length >= MAX_PLAYERS) return;
          next.P.push({
            id: a.user_id,
            name: String(pl.name || 'لاعب').slice(0, 18),
            handle: String(pl.handle || a.user_id).toLowerCase(),
            avatar: pl.avatar || null,
            alive: true, ready: false, muted: false, joinedAt: stamp,
          });
          svc.logEvent(c, 'join', { id: a.user_id, name: pl.name });
        }
        commit(next);
        return;
      }
      case 'ready': {
        if (next.ph !== 'reveal' || !p) return;
        p.ready = true;
        commit(next);
        if (next.P.every(x => x.ready)) {
          clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => {
            const cur = roomRef.current;
            if (cur && cur.ph === 'reveal') commit(nextPhase(cur, rolesRef.current));
          }, 1200);
        }
        return;
      }
      case 'kill': {
        const target = next.P.find(x => x.id === pl.target);
        if (next.ph !== 'night' || next.st !== 'mafia') return;
        if (rolesRef.current[p?.id || ''] !== 'mafia') return;
        if (!target || !target.alive || rolesRef.current[target.id] === 'mafia') return;
        next.nt.mv[a.user_id] = target.id;
        svc.logEvent(c, 'mafia_pick', { by: p?.name, target: target.name });
        commit(next);
        maybeAdvance(next);
        return;
      }
      case 'protect': {
        const target = next.P.find(x => x.id === pl.target);
        if (next.ph !== 'night' || next.st !== 'doctor') return;
        if (rolesRef.current[p?.id || ''] !== 'doctor') return;
        if (!target || !target.alive) return;
        next.nt.protect = target.id;
        svc.logEvent(c, 'protect', { by: p?.name, target: target.name });
        commit(next);
        return;
      }
      case 'silence': {
        const target = next.P.find(x => x.id === pl.target);
        if (next.ph !== 'night' || next.st !== 'elder') return;
        if (rolesRef.current[p?.id || ''] !== 'elder') return;
        if (!target || !target.alive || target.id === p?.id) return;
        next.nt.silence = target.id;
        next.nt.invest = null;
        next.nt.investRes = null;
        svc.logEvent(c, 'silence', { by: p?.name, target: target.name });
        commit(next);
        return;
      }
      case 'invest': {
        const target = next.P.find(x => x.id === pl.target);
        if (next.ph !== 'night' || next.st !== 'elder') return;
        if (rolesRef.current[p?.id || ''] !== 'elder') return;
        if (!next.cfg.invest || next.usedInv) return;
        if (!target || !target.alive || target.id === p?.id) return;
        next.usedInv = true;
        next.nt.silence = null;
        next.nt.invest = target.id;
        // الشايب أقل دقة من المحقق: يعرف «مافيا / ليس من المافيا» فقط — والجوكر ينجو من يده
        const ires = rolesRef.current[target.id] === 'mafia' ? 'mafia' : 'clean';
        next.nt.investRes = ires;
        next.log.push(`الشايب حقّق في ${target.name}`);
        svc.logEvent(c, 'invest', { by: p?.name, target: target.name, result: ires });
        commit(next);
        return;
      }
      case 'det_invest': {
        const target = next.P.find(x => x.id === pl.target);
        if (next.ph !== 'night' || next.st !== 'detective' || !p) return;
        if (rolesRef.current[p.id] !== 'detective') return;
        if (!detCanAct(next)) return;
        if (!target || !target.alive || target.id === p.id) return;
        if (detNotesFor(next, p.id).some(n => n.id === target.id)) return;
        const res = detResultOf(rolesRef.current[target.id]);
        // تغيير الاختيار في نفس الليلة يستبدل الملاحظة، والسجل يحتفظ بليلة واحدة لكل اسم
        next.detLog = [
          ...detNotesFor(next, p.id).filter(n => n.rd !== next.rd),
          { by: p.id, rd: next.rd, id: target.id, name: target.name, res },
        ];
        next.nt.det = target.id;
        next.log.push(`المحقق حقّق في ${target.name}`);
        svc.logEvent(c, 'det_invest', { by: p.name, target: target.name, result: res });
        commit(next);
        return;
      }
      case 'vote': {
        if (next.ph !== 'day' || next.st !== 'vote' || !p || !p.alive) return;
        if (pl.target === 'skip') next.votes[p.id] = 'skip';
        else {
          const target = next.P.find(x => x.id === pl.target);
          if (!target || !target.alive || target.id === p.id) return;
          next.votes[p.id] = target.id;
        }
        const target = next.P.find(x => x.id === next.votes[p.id]);
        svc.logEvent(c, 'vote', { by: p.name, target: target ? target.name : 'تجاوز' });
        commit(next);
        maybeAdvance(next);
        return;
      }
      case 'chat': {
        if (!p || !p.alive) return;
        const last = lastChat.current[p.id] || 0;
        if (stamp - last < 700) return;
        lastChat.current[p.id] = stamp;
        const channel = pl.ch === 'mafia' ? 'mafia' : 'village';
        if (channel === 'mafia') {
          if (!(next.ph === 'night' && next.st === 'mafia')) return;
          if (rolesRef.current[p.id] !== 'mafia') return;
        } else {
          if (!(next.ph === 'day' && next.st !== 'res')) return;
          if (p.muted) return;
        }
        svc.sendMessage(c, channel, { id: p.id, name: p.name }, String(pl.x || ''), next.rd, next.ph);
        return;
      }
      case 'cmd': {
        const cmd = pl.c;
        if (cmd === 'deal' && next.ph === 'join') {
          const res = dealRoles(next);
          if (res.err) {
            svc.pushAction(c, null, 'notice', { x: res.err });
            return;
          }
          rolesRef.current = res.roles;
          setRoles(res.roles);
          const names: Record<string, string> = {};
          next.P.forEach(x => { names[x.id] = x.name; });
          svc.clearRoles(c).then(() => svc.saveRoles(c, res.roles, names));
          Object.entries(res.roles).forEach(([id, role]) => {
            const seat = next.P.find(x => x.id === id);
            svc.logEvent(c, 'role', { id, name: seat?.name, role });
          });
          commit(res.state);
          return;
        }
        if (cmd === 'next' && !['join', 'end'].includes(next.ph)) {
          commit(nextPhase(next, rolesRef.current));
          return;
        }
        if (cmd === 'pause' && !['join', 'end'].includes(next.ph)) {
          next.pause = !next.pause;
          next.updatedAt = Date.now();
          commit(next);
          return;
        }
        if (cmd === 'reset') {
          const fresh = resetToLobby(next);
          rolesRef.current = {};
          setRoles({});
          svc.clearRoles(c);
          endedRef.current = false;
          commit(fresh);
          return;
        }
        if (cmd === 'cfg' && pl.v) {
          const v = pl.v;
          (['auto', 'doctor', 'elder', 'detective', 'joker', 'invest', 'reveal', 'jokerSafeDay1', 'detEveryOther'] as const).forEach(k => {
            if (k in v) (next.cfg as any)[k] = !!v[k];
          });
          if ('mafia' in v) next.cfg.mafia = Math.max(1, Math.min(8, Number(v.mafia) || 1));
          (['tMafia', 'tDoc', 'tElder', 'tDet', 'tDay', 'tVote'] as const).forEach(k => {
            if (k in v) (next.cfg as any)[k] = Math.max(10, Math.min(300, Number(v[k]) || 10));
          });
          commit(next);
          return;
        }
        if (cmd === 'kick' && pl.id && next.ph === 'join') {
          next.P = next.P.filter(x => x.id !== pl.id);
          svc.clearRoles(c);
          commit(next);
          return;
        }
        return;
      }
      default:
        return;
    }
  }, [commit, maybeAdvance]);

  useEffect(() => {
    if (mode !== 'stage' || !code) return;
    let alive = true;
    let after = -1; // -1 = لم نُهيّئ المؤشر بعد (حتى لا نعيد تنفيذ أوامر قديمة)
    const pull = async () => {
      if (after < 0) return;
      const acts = await svc.pullActions(code, after);
      if (!alive || !acts.length) return;
      after = acts[acts.length - 1].id;
      for (const a of acts) applyAction(a);
      await svc.deleteActions(acts.map(a => a.id));
    };
    // نتجاهل أي أوامر قديمة من جلسات سابقة: نبدأ من آخر أمر موجود
    svc.latestActionId(code).then(last => { if (alive) after = last; });
    const id = setInterval(pull, 700);
    return () => { alive = false; clearInterval(id); };
  }, [mode, code, applyAction]);

  /* ===== الرسائل ===== */
  useEffect(() => {
    if (!code || mode === 'admin') return;
    let alive = true;
    const channels: svc.ChatChannel[] = mode === 'player' && myRole === 'mafia'
      ? ['village', 'system', 'mafia']
      : ['village', 'system'];
    const load = async () => {
      const rows = await svc.pullMessages(code, channels, lastMsgId.current);
      if (!alive) return;
      if (rows.length) {
        lastMsgId.current = rows[rows.length - 1].id;
        setMessages(prev => [...prev, ...rows].slice(-80));
      }
    };
    load();
    const id = setInterval(load, 1200);
    return () => { alive = false; clearInterval(id); };
  }, [code, mode, myRole]);

  /* ===== دور اللاعب ===== */
  useEffect(() => {
    if (mode !== 'player' || !code || !me) return;
    let alive = true;
    const load = async () => {
      const r = await svc.loadRole(code, me.id);
      if (alive) setMyRole(r);
    };
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [code, mode, me]);

  /* ===== انضمام تلقائي للاعب ===== */
  useEffect(() => {
    if (mode !== 'player' || !code || !me || !room) return;
    if (room.ph !== 'join') return;
    if (room.P.some(p => p.id === me.id)) return;
    if (joinedRef.current) return;
    joinedRef.current = true;
    svc.pushAction(code, me.id, 'join', { name: me.name, handle: me.handle, avatar: me.avatar });
  }, [mode, code, me, room]);

  /* ===== نهاية اللعبة (تسجيل النتيجة) ===== */
  useEffect(() => {
    if (mode !== 'stage' || !room) return;
    if (room.ph === 'end' && room.win) finishMatch(room);
  }, [mode, room, finishMatch]);

  /* ===== بوابة الإدارة ===== */
  const isAdmin = useMemo(isAdminSession, []);

  if (denied) {
    return (
      <div className="mf-root">
        <div className="mf-denied">
          <Skull size={54} className="mf-ic" style={{ width: 54, height: 54, color: '#ff6b7b' }} />
          <h1>تعذّر فتح الغرفة</h1>
          <p>{denied}</p>
          {onHome ? (
            <button className="mf-btn p" onClick={onHome}><Home size={18} /> العودة</button>
          ) : null}
        </div>
      </div>
    );
  }

  if (mode === 'admin') {
    if (!isAdmin) {
      return (
        <div className="mf-root">
          <div className="mf-denied">
            <Lock size={54} className="mf-ic" style={{ width: 54, height: 54, color: '#ff8a98' }} />
            <h1>هذه الصفحة للإدارة فقط</h1>
            <p>لوحة تحكم المافيا متاحة للمشرفين المسجّلين من داخل الموقع فقط. حساب المستخدم العادي لا يستطيع الوصول إليها.</p>
            {onHome ? <button className="mf-btn p" onClick={onHome}><Home size={18} /> العودة للرئيسية</button> : null}
          </div>
        </div>
      );
    }
    return <MafiaAdminPanel code={code} room={room} roles={roles} onHome={onHome} />;
  }

  if (mode === 'player') {
    if (!me) {
      return (
        <div className="mf-root">
          <div className="mf-denied">
            <Lock size={54} className="mf-ic" style={{ width: 54, height: 54, color: '#ff8a98' }} />
            <h1>سجّل دخولك أولاً</h1>
            <p>للدخول إلى اللعبة يجب تسجيل الدخول بحسابك في الموقع. بعد الدخول ستنتقل إلى الغرفة تلقائياً.</p>
            {onHome ? <button className="mf-btn p" onClick={onHome}><Home size={18} /> تسجيل الدخول</button> : null}
          </div>
        </div>
      );
    }
    return (
      <MafiaPlayer
        code={code}
        room={room}
        me={me}
        role={myRole}
        messages={messages}
        now={now}
        onHome={onHome}
      />
    );
  }

  return (
    <MafiaStage
      code={code}
      room={room}
      roles={roles}
      messages={messages}
      now={now}
      onHome={onHome}
      isAdmin={isAdmin}
      dbOk={dbOk}
    />
  );
};

/* ============================================================
   الشاشة الكبيرة
   ============================================================ */
const MafiaStage: React.FC<{
  code: string;
  room: GameState | null;
  roles: Record<string, Role>;
  messages: svc.ChatRow[];
  now: number;
  onHome?: () => void;
  isAdmin: boolean;
  dbOk: boolean | null;
}> = ({ code, room, roles, messages, now, onHome, isAdmin, dbOk }) => {
  const [copied, setCopied] = useState(false);
  const s = room;
  const left = s && s.tEnd ? Math.max(0, (s.tEnd - now) / 1000) : 0;
  const night = !!s && s.ph === 'night' && s.st !== 'op3';
  const glow = s ? ({ mafia: 'mafia', detective: 'det', op1: 'op', op2: 'op' } as Record<string, string>)[s.st] || '' : '';

  const inviteLink = useMemo(() => buildShortJoinLink(code), [code]);

  const adminLink = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'MAHMAH_GAME');
      url.searchParams.set('r', code);
      url.searchParams.set('m', 'admin');
      return url.toString();
    } catch { return ''; }
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (!s) {
    return (
      <div className="mf-root">
        <div className="mf-denied">
          <Loader2 className="mf-spin" style={{ width: 40, height: 40 }} />
          <p>جارٍ تجهيز غرفة المافيا…</p>
        </div>
      </div>
    );
  }

  const pn = plan(s);
  const n = s.P.length;
  const counts = voteCounts(s);

  return (
    <div
      className={`mf-root mf-stage ${night ? 'is-night' : ''}`}
      data-phase={s.ph}
      data-glow={glow}
    >
      <div className="mf-sky">
        <div className="mf-stars" />
        <div className="mf-moon" />
        <div className="mf-fog" />
        <div className="mf-fog" style={{ bottom: '12%', opacity: 0.7, animationDirection: 'alternate-reverse' }} />
      </div>
      <div className="mf-glow" />

      <header className="mf-hd">
        <div className="mf-brand">
          <Crown size={26} style={{ color: '#e8be6e' }} />
          <b>المافيا</b>
          <small>iCG1</small>
        </div>
        {s.rd ? <span className="mf-chip"><Moon size={14} /> الجولة {s.rd}</span> : null}
        <span className="mf-chip">
          {PHASE_LABEL[s.ph]}
          {s.ph === 'day' ? (s.st === 'vote' ? ' · التصويت' : s.st === 'res' ? ' · النتيجة' : ' · النقاش') : ''}
          {s.ph === 'night' && s.st ? ` · ${STEP_LABEL[s.st] || ''}` : ''}
        </span>
        {s.tEnd ? <TimerRing left={left} total={s.tTot} /> : null}
        {isAdmin ? (
          <a className="mf-tl" href={adminLink} target="_blank" rel="noopener" title="لوحة الإدارة">
            <Shield size={18} />
          </a>
        ) : null}
        <button className="mf-tl" onClick={copy} title="نسخ رابط اللاعبين">
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
        <button
          className="mf-tl"
          title="ملء الشاشة"
          onClick={() => {
            try {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            } catch {}
          }}
        >
          <Maximize size={18} />
        </button>
        {onHome ? <button className="mf-tl" onClick={onHome} title="خروج"><Home size={18} /></button> : null}
      </header>

      <main className="mf-main">
        <div className="mf-table">
          {s.ph !== 'end' && s.P.map((p, i) => {
            const pos = seatPos(i, n);
            const sz = Math.max(42, Math.min(84, 128 - n * 4));
            const badge = counts[p.id];
            return (
              <div
                key={p.id}
                className={`mf-seat ${p.alive ? '' : 'is-dead'}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, ['--sz' as any]: `${sz}px` }}
              >
                <Avatar handle={p.handle} url={p.avatar} size={sz} />
                {s.ph === 'reveal' && p.ready ? <i className="mf-ok"><Check size={13} /></i> : null}
                {badge ? <i className="mf-badge">{badge}</i> : null}
                <span className="mf-nm">{p.name}</span>
              </div>
            );
          })}

          <div className="mf-core">
            <StageCore state={s} roles={roles} />
          </div>
        </div>

        <aside className="mf-side">
          <h4>نقاش القرية</h4>
          <div className="mf-lines">
            {messages.filter(m => m.channel !== 'mafia').slice(-16).map(m => (
              <div key={m.id} className={`mf-line ${m.channel === 'system' ? 'sys' : ''}`}>
                {m.channel === 'system'
                  ? <span>{m.body}</span>
                  : <><b>{m.username}</b><span>{m.body}</span></>}
              </div>
            ))}
            {!messages.length ? <div className="mf-line sys">في انتظار النقاش…</div> : null}
          </div>
        </aside>
      </main>

      {s.ph === 'join' ? (
        <LobbyOverlay code={code} state={s} plan={pn} count={n} inviteLink={inviteLink} onCopy={copy} copied={copied} />
      ) : null}

      {dbOk === false ? (
        <div className="mf-dbwarn">
          <b>تنبيه:</b> الغرفة لم تُحفظ في قاعدة البيانات، لذلك لن يستطيع اللاعبون الدخول من أجهزتهم.
          شغّل ملف <code>supabase/mafia_setup.sql</code> في Supabase — وستُحفظ الغرفة تلقائياً بدون إعادة تشغيل.
        </div>
      ) : null}
    </div>
  );
};

const LobbyOverlay: React.FC<{
  code: string; state: GameState; plan: ReturnType<typeof plan>; count: number;
  inviteLink: string; onCopy: () => void; copied: boolean;
}> = ({ code, plan: pn, count, inviteLink, onCopy, copied }) => (
  <div
    style={{
      position: 'absolute', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center',
      background: 'radial-gradient(58% 58% at 50% 48%, rgba(6,4,10,.97) 0%, rgba(6,4,10,.88) 58%, rgba(6,4,10,.45) 100%)',
    }}
  >
    <div className="mf-lobby">
      <div className="mf-neon">المافيا</div>
      <div className="mf-neon-sub">من القاتل بينكم؟</div>
      <div className="mf-roles-row">
        {(['mafia', 'doctor', 'elder', 'citizen'] as Role[])
          .concat(pn.t ? ['detective'] : [], pn.j ? ['joker'] : [])
          .map(r => (
            <div className="mf-role-chip" key={r}>
              <span><RoleArt role={r} /></span>
              <b>{ROLE_INFO[r].n}</b>
            </div>
          ))}
      </div>
      <div className="mf-ticket">
        <div className="mf-qr">
          <img
            alt="QR"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(inviteLink)}`}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <small style={{ color: '#b9a98c' }}>كود الغرفة</small>
          <div className="mf-code">{code}</div>
          <small style={{ color: '#b9a98c' }}>امسح الرمز بهاتفك</small>
          <div className="mf-lnk">{inviteLink.replace(/^https?:\/\//, '')}</div>
        </div>
      </div>
      <div className="mf-bar"><i style={{ width: `${Math.min(100, (count / MIN_PLAYERS) * 100)}%` }} /></div>
      <p style={{ fontWeight: 800, color: count < MIN_PLAYERS ? '#e8be6e' : '#7dffb0' }}>
        {count < MIN_PLAYERS ? `نحتاج ${MIN_PLAYERS - count} لاعبين على الأقل` : 'جاهزون! بانتظار المدير ليبدأ'}
        {' · '}{count}/{MAX_PLAYERS}
      </p>
      {pn.err && count > 0 ? <div className="mf-note">{pn.err}</div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="mf-btn" onClick={onCopy}>{copied ? <Check size={16} /> : <Copy size={16} />} نسخ رابط اللاعبين</button>
      </div>
    </div>
  </div>
);

/* ===== محتوى منتصف الطاولة ===== */
const StageCore: React.FC<{ state: GameState; roles: Record<string, Role> }> = ({ state: s, roles }) => {
  if (s.ph === 'deal') {
    return (<>
      <div className="mf-big" style={{ color: '#e8be6e' }}><Shuffle className="mf-ic" /></div>
      <h2>خلط البطاقات…</h2>
      <p>يُوزَّع الدور على كل لاعب عشوائياً</p>
    </>);
  }

  if (s.ph === 'reveal') {
    const ready = s.P.filter(p => p.ready).length;
    return (<>
      <div className="mf-big" style={{ color: '#e8be6e' }}><Eye className="mf-ic" /></div>
      <h2>اكتشفوا أدواركم</h2>
      <p>افتحوا هواتفكم وانظروا إلى بطاقتكم سراً</p>
      <p>{ready}/{s.P.length} جاهزون</p>
    </>);
  }

  if (s.ph === 'night') {
    const map: Record<string, [string, string, React.ReactNode, string]> = {
      nightfall: ['حلّ الليل', 'الجميع ينام… أغمضوا أعينكم', <Moon className="mf-ic" />, '#cfd6ff'],
      mafia: ['المافيا تستيقظ', 'يتشاورون في الظلام على ضحيتهم', <Flame className="mf-ic" />, '#ff4a5e'],
      m_sleep: ['المافيا تنام', 'عادوا إلى الظلام…', <Moon className="mf-ic" />, '#cfd6ff'],
      doctor: ['الدكتور يستيقظ', 'يختار من يحميه الليلة', <Cross className="mf-ic" />, '#2fe0bb'],
      d_sleep: ['الدكتور ينام', '', <Moon className="mf-ic" />, '#cfd6ff'],
      elder: ['الشايب يستيقظ', 'يتأمل… ثم يقرر', <Flame className="mf-ic" />, '#f0c25a'],
      e_sleep: ['الشايب ينام', '', <Moon className="mf-ic" />, '#cfd6ff'],
      detective: ['المحقق يستيقظ', 'يضع واحداً تحت المجهر', <Search className="mf-ic" />, '#ff9248'],
      det_sleep: ['المحقق ينام', '', <Moon className="mf-ic" />, '#cfd6ff'],
      op1: ['جرت عملية في الظلام…', 'شيء ما حدث الليلة', <Skull className="mf-ic" />, '#ff4a5e'],
      op2: ['جارٍ كشف نتيجة العملية', 'ترقّبوا…', <Eye className="mf-ic" />, '#ffffff'],
    };
    const m = map[s.st];
    if (m) {
      return (<>
        <div className="mf-big" style={{ color: m[3] }}>{m[2]}</div>
        <h2>{m[0]}</h2>
        <p>{m[1]}</p>
      </>);
    }
    return s.res?.ok ? (
      <>
        <div className="mf-big" style={{ color: '#ff4a5e' }}><Skull className="mf-ic" /></div>
        <h2 style={{ backgroundImage: 'linear-gradient(180deg,#fff,#ff6b7b)' }}>نجحت العملية</h2>
        <p style={{ fontSize: 'clamp(18px, 2.2vw, 30px)', color: '#fff' }}>{s.res.name} خرج من اللعبة</p>
      </>
    ) : (
      <>
        <div className="mf-big" style={{ color: '#2fe0bb' }}><Cross className="mf-ic" /></div>
        <h2 style={{ backgroundImage: 'linear-gradient(180deg,#fff,#2fe0bb)' }}>فشلت العملية!</h2>
        <p>تدخّل الطبيب في اللحظة الأخيرة… نجا الجميع</p>
      </>
    );
  }

  if (s.ph === 'day') {
    const crit = s.crit
      ? <div className="mf-critical"><Flame size={14} /> المواجهة الأخيرة: خطأ واحد وتفوز المافيا</div>
      : null;
    if (s.st === 'talk') {
      return (<>
        <div className="mf-big" style={{ color: '#e8be6e' }}><Sun className="mf-ic" /></div>
        <h2>النقاش مفتوح</h2>
        <p>تحققوا مع بعض… من المافيا بينكم؟</p>
        {crit}
      </>);
    }
    if (s.st === 'vote') {
      return (<>
        <div className="mf-big" style={{ color: '#e8be6e' }}><Vote className="mf-ic" /></div>
        <h2>صوّتوا الآن</h2>
        <p>اختاروا من تظنون أنه مافيا</p>
        {crit}
      </>);
    }
    return s.res?.ej ? (
      <>
        <div className="mf-big" style={{ color: s.res.joker ? '#c77dff' : '#ff6b7b' }}>
          {s.res.joker ? <Smile className="mf-ic" /> : <Skull className="mf-ic" />}
        </div>
        <h2>تم إقصاء {s.res.name}</h2>
        {s.res.joker ? (
          <p style={{ color: '#c77dff', fontWeight: 800 }}>كان الجوكر… القرية سلّمته الفوز بيدها</p>
        ) : null}
      </>
    ) : (
      <>
        <h2>{s.res?.tie ? 'تعادل في الأصوات' : 'لم يُقصَ أحد'}</h2>
        <p>لا أحد يغادر هذه المرة</p>
      </>
    );
  }

  if (s.ph === 'end') {
    const win = s.win || 'town';
    const joker = win === 'joker';
    const town = win === 'town';
    const accent = joker ? '#c77dff' : town ? '#e8be6e' : '#ff4a5e';
    const winners = new Set(winningSeats(s, roles).map(p => p.id));
    return (<>
      <div className="mf-big" style={{ color: accent }}>
        {joker ? <Smile className="mf-ic" /> : town ? <Crown className="mf-ic" /> : <Flame className="mf-ic" />}
      </div>
      <h2 style={{ backgroundImage: `linear-gradient(180deg,#fff,${accent})` }}>{WIN_TITLE[win]}</h2>
      {joker ? <p style={{ color: '#d9c6ff', fontWeight: 800 }}>طردته القرية بالتصويت — وهذا كل ما كان يحتاجه</p> : null}
      <div className="mf-end-cards">
        {s.P.map(p => (
          <div key={p.id} className={winners.has(p.id) ? 'is-win' : ''} style={{ opacity: winners.has(p.id) ? 1 : 0.42, width: 118 }}>
            <RoleCard role={roles[p.id] || 'citizen'} player={p.name} />
          </div>
        ))}
      </div>
    </>);
  }

  return null;
};

/* ============================================================
   جوال اللاعب
   ============================================================ */
const MafiaPlayer: React.FC<{
  code: string;
  room: GameState | null;
  me: svc.PlayerIdentity;
  role: Role | null;
  messages: svc.ChatRow[];
  now: number;
  onHome?: () => void;
}> = ({ code, room, me, role, messages, now, onHome }) => {
  const [flipped, setFlipped] = useState(false);
  const [draft, setDraft] = useState('');
  const [elderTab, setElderTab] = useState<'silence' | 'invest'>('silence');
  const [, setPicked] = useState<string | null>(null);

  const s = room;
  const seat = s?.P.find(p => p.id === me.id) || null;
  const left = s && s.tEnd ? Math.max(0, (s.tEnd - now) / 1000) : 0;

  useEffect(() => { setPicked(null); }, [s?.st, s?.ph]);

  if (!s) {
    return (
      <div className="mf-root">
        <div className="mf-phone">
          <Loader2 className="mf-spin" style={{ width: 40, height: 40 }} />
          <p>جارٍ الاتصال بالشاشة…</p>
        </div>
      </div>
    );
  }

  const act = seat && role ? playerAct(s, role, seat) : null;

  /* ملاحظات المحقق — خاصة به، تبقى ظاهرة له في الليل والنهار */
  const myNotes = role === 'detective' && seat ? detNotesFor(s, seat.id) : [];
  const notes = !myNotes.length ? null : (
    <div className="mf-notes">
      <h4><Notebook size={14} /> ملاحظات التحقيق</h4>
      {myNotes.map(n => (
        <div key={`${n.rd}-${n.id}`} className={`mf-nrow is-${n.res}`}>
          <b>{n.name}</b>
          <span>{DET_RESULT_LABEL[n.res]}</span>
          <small>ليلة {n.rd}</small>
        </div>
      ))}
    </div>
  );

  const send = (kind: string, payload: any) => svc.pushAction(code, me.id, kind, payload);

  /* نتيجة تحقيق الشايب — تصله وحده، وتبقى معه حتى نهاية النهار */
  const invId = role === 'elder' && seat && s.nt.invest && s.nt.invest !== seat.id ? s.nt.invest : null;
  const invSeat = invId ? s.P.find(x => x.id === invId) : null;
  const elderRes = !invSeat || !s.nt.investRes ? null : (
    <div className={`mf-note ${s.nt.investRes === 'mafia' ? 'dg' : ''}`}>
      تحقيقك: {invSeat.name} — {s.nt.investRes === 'mafia' ? 'من المافيا' : 'ليس من المافيا'}
    </div>
  );

  const chat = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    send('chat', { ch: 'village', x: text });
  };

  const chatMafia = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    send('chat', { ch: 'mafia', x: text });
  };

  const topbar = (
    <div className="mf-topbar">
      <Avatar handle={me.handle} url={me.avatar} size={32} />
      <b>{seat?.name || me.name}</b>
      {s.tEnd && !s.pause ? <span className="mf-chip" style={{ padding: '2px 10px', fontSize: 13 }}>{Math.ceil(left)}ث</span> : null}
      {!seat?.alive && seat ? <span className="mf-chip" style={{ padding: '2px 10px', fontSize: 12, color: '#ff8a98' }}>خارج اللعب</span> : null}
    </div>
  );

  let body: React.ReactNode = null;
  let theme = '';

  if (!seat) {
    body = s.ph === 'join' ? (
      <>
        <div className="mf-wait"><i /><i /><i /></div>
        <h1>جارٍ دخولك للغرفة…</h1>
        <p>انتظر لحظة حتى يظهر اسمك في قائمة اللاعبين</p>
      </>
    ) : (
      <>
        <Skull className="mf-ic" style={{ width: 46, height: 46, color: '#ff8a98' }} />
        <h1>اللعبة بدأت بالفعل</h1>
        <p>انتظر الجولة القادمة ثم اطلب من المدير فتح لوبي جديد.</p>
      </>
    );
  } else if (s.ph === 'join') {
    body = (
      <>
        <div className="mf-wait"><i /><i /><i /></div>
        <h1>أنت داخل اللعبة!</h1>
        <p>بانتظار المدير ليبدأ توزيع الأدوار</p>
        <div className="mf-tgs">
          {s.P.map(p => <Avatar key={p.id} handle={p.handle} url={p.avatar} size={38} />)}
        </div>
        <p>{s.P.length} لاعبين</p>
      </>
    );
  } else if (s.ph === 'deal') {
    body = (
      <>
        <Shuffle className="mf-ic" style={{ width: 46, height: 46, color: '#e8be6e' }} />
        <h1>تُخلط البطاقات…</h1>
        <p>استعد لدورك</p>
      </>
    );
  } else if (s.ph === 'reveal') {
    body = !role ? (
      <><Loader2 className="mf-spin" /><p>جارٍ استلام دورك…</p></>
    ) : (
      <>
        <p>دورك سرّي… لا تُرهِ لأحد!</p>
        <div className={`mf-flip ${flipped ? 'on' : ''}`}>
          <div className="mf-flip-in">
            <div className="mf-flip-face mf-flip-bk">؟</div>
            <div className="mf-flip-face mf-flip-ft"><RoleCard role={role} /></div>
          </div>
        </div>
        {flipped ? (
          <>
            <p>{ROLE_INFO[role].d}</p>
            <button className="mf-btn p wide" onClick={() => send('ready', {})}>
              {seat.ready ? 'جاهز ✓' : 'فهمت'} <Check size={16} />
            </button>
          </>
        ) : (
          <button className="mf-btn r" onClick={() => setFlipped(true)}>اكشف بطاقتك</button>
        )}
      </>
    );
  } else if (!seat.alive) {
    body = (
      <>
        <Skull className="mf-ic" style={{ width: 46, height: 46 }} />
        <h1>خرجت من اللعبة</h1>
        <p>
          {role === 'detective' && myNotes.length
            ? 'ملاحظاتك محفوظة — لكنك لن تستفيد منها بعد الآن'
            : 'تابع الشاشة… دورك انتهى لكن اللعبة مستمرة'}
        </p>
        {notes}
      </>
    );
  } else if (s.ph === 'night') {
    theme = role === 'mafia' ? 'is-mafia'
      : role === 'doctor' ? 'is-doctor'
        : role === 'elder' ? 'is-elder'
          : role === 'detective' ? 'is-detective'
            : role === 'joker' ? 'is-joker' : 'is-night';
    if (act?.k === 'mafia') {
      const mafiaChat = messages.filter(m => m.channel === 'mafia');
      body = (
        <>
          <h1><Flame size={24} /> غرفة المافيا</h1>
          <p>اتفقوا على الضحية — إذا اتفق الجميع ينتهي الوقت مبكراً</p>
          <div className="mf-chatbox">
            {mafiaChat.map(m => <div key={m.id} className="mf-line"><b>{m.username}</b><span>{m.body}</span></div>)}
            {!mafiaChat.length ? <div className="mf-line sys">لا رسائل بعد…</div> : null}
          </div>
          <div className="mf-row">
            <input className="mf-inp" value={draft} maxLength={100} placeholder="اتفقوا على الضحية"
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') chatMafia(); }} />
            <button className="mf-btn r" onClick={chatMafia}><Send size={16} /></button>
          </div>
          <div className="mf-tgs">
            {act.targets.map(t => (
              <button key={t.id} className={`mf-tg ${act.my === t.id ? 'sel' : ''}`}
                onClick={() => send('kill', { target: t.id })}>
                <Avatar handle={t.handle} url={t.avatar} size={26} /><span>{t.name}</span>
              </button>
            ))}
          </div>
        </>
      );
    } else if (act?.k === 'doctor') {
      body = (
        <>
          <h1><Cross size={24} /> من تحمي الليلة؟</h1>
          <p>يمكنك حماية نفسك</p>
          <div className="mf-tgs">
            {act.targets.map(t => (
              <button key={t.id} className={`mf-tg ${act.my === t.id ? 'sel' : ''}`}
                onClick={() => send('protect', { target: t.id })}>
                <Avatar handle={t.handle} url={t.avatar} size={26} /><span>{t.name}</span>
              </button>
            ))}
          </div>
        </>
      );
    } else if (act?.k === 'elder') {
      const invest = act.investLeft;
      const tab = invest ? elderTab : 'silence';
      body = (
        <>
          <h1><Flame size={24} /> حكمة الشايب</h1>
          {invest ? (
            <div className="mf-row" style={{ maxWidth: 380 }}>
              <button className={`mf-btn ${tab === 'silence' ? 'p' : ''}`} style={{ flex: 1 }}
                onClick={() => setElderTab('silence')}>إسكات لاعب</button>
              <button className={`mf-btn ${tab === 'invest' ? 'p' : ''}`} style={{ flex: 1 }}
                onClick={() => setElderTab('invest')}>تحقيق (مرة)</button>
            </div>
          ) : null}
          <p>{tab === 'invest' ? 'من تريد التحقق من هويته؟ (مرة واحدة فقط)' : 'من تُسكِته في نقاش الغد؟'}</p>
          <div className="mf-tgs">
            {act.targets.map(t => (
              <button key={t.id} className={`mf-tg ${act.my === t.id ? 'sel' : ''}`}
                onClick={() => send(tab === 'invest' ? 'invest' : 'silence', { target: t.id })}>
                <Avatar handle={t.handle} url={t.avatar} size={26} /><span>{t.name}</span>
              </button>
            ))}
          </div>
          {elderRes}
        </>
      );
    } else if (act?.k === 'detective') {
      body = (
        <>
          <h1><Search size={24} /> من تضع تحت المجهر؟</h1>
          <p>
            {act.my ? 'اخترت هذه الليلة — يمكنك تغيير اختيارك' : 'اختيار واحد لكل ليلة، ولا تعيد اسماً سبقته'}
            {act.everyOther ? ' · التحقيق كل ليلتين' : ''}
          </p>
          <div className="mf-tgs">
            {act.targets.map(t => (
              <button key={t.id} className={`mf-tg ${act.my === t.id ? 'sel' : ''}`}
                onClick={() => send('det_invest', { target: t.id })}>
                <Avatar handle={t.handle} url={t.avatar} size={26} /><span>{t.name}</span>
              </button>
            ))}
            {!act.targets.length ? <div className="mf-line sys">لا أسماء متبقية — حقّقت مع كل الأحياء</div> : null}
          </div>
          {notes}
        </>
      );
    } else if (role === 'detective' && s.st === 'detective') {
      body = (
        <>
          <div className="mf-zz"><Moon className="mf-ic" /></div>
          <h1>ليلتك هادئة</h1>
          <p>التحقيق عندك كل ليلتين — ارتاح وتذكر ما تعرفه</p>
          {notes}
        </>
      );
    } else {
      body = (
        <>
          <div className="mf-zz"><Moon className="mf-ic" /></div>
          <h1>الليل…</h1>
          <p>
            {role === 'joker'
              ? 'نمتَ مثل أي مواطن. النهار القادم هو مسرحك: اجعلهم يطردونك.'
              : 'أغمض عينيك ولا تفتحهما حتى يطلع الصباح'}
          </p>
        </>
      );
    }
  } else if (s.ph === 'day') {
    if (s.st === 'vote' && act?.k === 'vote') {
      body = (
        <>
          <h1><Vote size={24} /> صوّت</h1>
          <p>من تظنه من المافيا؟</p>
          <div className="mf-tgs">
            {act.targets.map(t => (
              <button key={t.id} className={`mf-tg ${act.my === t.id ? 'sel' : ''}`}
                onClick={() => send('vote', { target: t.id })}>
                <Avatar handle={t.handle} url={t.avatar} size={26} /><span>{t.name}</span>
              </button>
            ))}
            <button className={`mf-tg ${act.my === 'skip' ? 'sel' : ''}`} style={{ ['--ac' as any]: '#888' }}
              onClick={() => send('vote', { target: 'skip' })}>
              <span>تجاوز (لا أحد)</span>
            </button>
          </div>
          {role === 'joker' ? <div className="mf-note">زوّدهم بالشك: دافع عن نفسك بتوتر، واتهم الآخرين بلا دليل.</div> : null}
          {notes}
        </>
      );
    } else if (s.st === 'res') {
      body = (
        <>
          <h1>{s.res?.ej ? `أُقصي ${s.res.name}` : 'لم يُقصَ أحد'}</h1>
          <p>{s.res?.joker ? 'كان الجوكر — اللعبة انتهت' : 'انظر إلى الشاشة'}</p>
        </>
      );
    } else {
      const village = messages.filter(m => m.channel === 'village' || m.channel === 'system');
      body = (
        <>
          <h1><Sun size={24} /> النقاش</h1>
          {s.crit ? <div className="mf-note">المواجهة الأخيرة: خطأ واحد وتفوز المافيا</div> : null}
          {role === 'joker' ? <div className="mf-note">مهمتك: أن تقتنع القرية أنك المافيا وتطردك.</div> : null}
          {elderRes}
          <div className="mf-chatbox">
            {village.map(m => (
              <div key={m.id} className={`mf-line ${m.channel === 'system' ? 'sys' : ''}`}>
                {m.channel === 'system' ? <span>{m.body}</span> : <><b>{m.username}</b><span>{m.body}</span></>}
              </div>
            ))}
          </div>
          {seat.muted ? (
            <div className="mf-note">أُسكِتّ في هذه الجولة. لا يمكنك الكلام.</div>
          ) : (
            <div className="mf-row">
              <input className="mf-inp" value={draft} maxLength={140} placeholder="تكلّم مع القرية"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') chat(); }} />
              <button className="mf-btn p" onClick={chat}><Send size={16} /></button>
            </div>
          )}
          {notes}
        </>
      );
    }
  } else if (s.ph === 'end') {
    const win = s.win || 'town';
    const iWon = role
      ? (win === 'mafia' ? role === 'mafia'
        : win === 'joker' ? role === 'joker'
          : role !== 'mafia' && role !== 'joker')
      : false;
    body = (
      <>
        <h1 style={{ backgroundImage: `linear-gradient(180deg,#fff,${win === 'joker' ? '#c77dff' : win === 'town' ? '#e8be6e' : '#ff4a5e'})` }}>
          {WIN_TITLE[win]}
        </h1>
        <p style={{ fontWeight: 800, color: iWon ? '#7dffb0' : '#c9b9b9' }}>
          {iWon ? 'فزت في هذه الجولة ✓' : 'خسرت هذه الجولة'}
        </p>
        <div className="mf-tgs">
          {s.P.map(p => (
            <div key={p.id} className="mf-tg" style={{ opacity: p.alive ? 1 : 0.5 }}>
              <Avatar handle={p.handle} url={p.avatar} size={26} />
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="mf-root">
      <div className={`mf-phone ${theme}`}>
        {topbar}
        {body}
        {onHome ? (
          <button className="mf-btn" style={{ marginTop: 14 }} onClick={onHome}>
            <Home size={16} /> خروج
          </button>
        ) : null}
      </div>
    </div>
  );
};

/* ============================================================
   لوحة الإدارة (للمشرفين فقط)
   ============================================================ */
const MafiaAdminPanel: React.FC<{
  code: string;
  room: GameState | null;
  roles: Record<string, Role>;
  onHome?: () => void;
}> = ({ code, room, roles, onHome }) => {
  const s = room;
  const [notice, setNotice] = useState<string | null>(null);

  const cmd = (c: string, extra: any = {}) => {
    svc.pushAction(code, 'admin', 'cmd', { c, admin: true, ...extra });
  };

  const invite = useMemo(() => buildShortJoinLink(code), [code]);

  if (!s) {
    return (
      <div className="mf-root">
        <div className="mf-denied">
          <Loader2 className="mf-spin" style={{ width: 36, height: 36 }} />
          <p>جارٍ الاتصال بغرفة {code || '—'}… تأكد أن صفحة العرض مفتوحة.</p>
        </div>
      </div>
    );
  }

  const join = s.ph === 'join';
  const pn = plan(s);
  const names = (id?: string | null) => s.P.find(x => x.id === id)?.name || '—';
  const phases: Phase_[] = ['join', 'deal', 'reveal', 'night', 'day', 'end'];
  const pi = phases.indexOf(s.ph);
  const n = s.P.length;

  const sw = (k: 'auto' | 'doctor' | 'elder' | 'detective' | 'joker' | 'invest' | 'reveal' | 'jokerSafeDay1' | 'detEveryOther') => (
    <button className={`mf-sw ${(s.cfg as any)[k] ? 'on' : ''}`} disabled={!join && k !== 'reveal' && k !== 'invest'}
      onClick={() => cmd('cfg', { v: { [k]: !(s.cfg as any)[k] } })} aria-label={k} />
  );

  const step = (k: string, label: string, value: number, unit = '') => (
    <div className="mf-tm" key={k}>
      <span>{label}</span>
      <span className="mf-stp">
        <button onClick={() => cmd('cfg', { v: { [k]: Math.max(k.startsWith('t') ? 10 : 1, value - (k.startsWith('t') ? 10 : 1)) } })}>−</button>
        <b>{value}{unit}</b>
        <button onClick={() => cmd('cfg', { v: { [k]: value + (k.startsWith('t') ? 10 : 1) } })}>+</button>
      </span>
    </div>
  );

  const seg: Array<[string, number, string]> = [
    ['#d11f33', pn.m, 'مافيا'],
    ['#20c9a6', pn.d, 'دكتور'],
    ['#f0c25a', pn.e, 'شايب'],
    ['#ff9248', pn.t, 'محقق'],
    ['#c77dff', pn.j, 'جوكر'],
    ['#4fa3ff', Math.max(0, pn.ct), 'مواطنون'],
  ];

  return (
    <div className="mf-root">
      <div className="mf-admin">
        <div className="mf-wrap">
          <div className="mf-hh">
            <h1>لوحة تحكم المافيا</h1>
            <div className="mf-sub">أنت المدير: وزّع الأدوار وتحكّم بسير اللعبة — الغرفة {code}</div>
            <div className="mf-trk">
              {phases.map((k, i) => (
                <span key={k} className={i < pi ? 'dn' : i === pi ? 'on' : ''}>{PHASE_LABEL[k]}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="mf-chip">{PHASE_LABEL[s.ph]}{s.st ? ` · ${STEP_LABEL[s.st] || s.st}` : ''}</span>
              {s.rd ? <span className="mf-chip">الجولة {s.rd}</span> : null}
              {s.pause ? <span className="mf-chip">متوقفة مؤقتاً</span> : null}
            </div>
            <div className="mf-acts">
              {join ? (
                <button className="mf-hb go" onClick={() => { cmd('deal'); setNotice(null); }} disabled={!!pn.err}>
                  <Shuffle size={16} /> وزّع الأدوار وابدأ
                </button>
              ) : null}
              {!['join', 'end'].includes(s.ph) ? (
                <>
                  <button className="mf-hb" onClick={() => cmd('next')}><SkipForward size={16} /> تخطي المرحلة</button>
                  <button className="mf-hb" onClick={() => cmd('pause')}>
                    {s.pause ? <Play size={16} /> : <Pause size={16} />} {s.pause ? 'استئناف' : 'إيقاف مؤقت'}
                  </button>
                </>
              ) : null}
              <button className="mf-hb dg" onClick={() => { cmd('reset'); setNotice('تم فتح لوبي جديد'); }}>
                <RefreshCw size={16} /> لوبي جديد
              </button>
              {join ? (
                <button className="mf-hb" onClick={() => { navigator.clipboard?.writeText(invite); setNotice('تم نسخ رابط الدخول'); }}>
                  <Copy size={16} /> نسخ رابط الدخول
                </button>
              ) : null}
              {onHome ? <button className="mf-hb" onClick={onHome}><Home size={16} /> خروج</button> : null}
            </div>
          </div>

          <div className="mf-pn">
            <h3><Shuffle size={16} /> الأدوار {join ? '' : '(مقفلة بعد البدء)'}</h3>
            <div className="mf-rg">
              <div className="mf-tile is-mafia">
                <div className="mf-av2"><RoleArt role="mafia" /></div>
                <div className="mf-tx">
                  <b>مافيا</b>
                  <small>القتلة. يقتلون كل ليلة ويتخفّون نهاراً.</small>
                </div>
                <div className="mf-ctl">
                  <span>تلقائي</span>
                  {sw('auto')}
                  <span>{pn.m}</span>
                </div>
              </div>
              <div className={`mf-tile is-doctor ${s.cfg.doctor ? '' : 'off'}`}>
                <div className="mf-av2"><RoleArt role="doctor" /></div>
                <div className="mf-tx"><b>الدكتور</b><small>يحمي لاعباً واحداً كل ليلة من القتل.</small></div>
                <div className="mf-ctl"><span>{s.cfg.doctor ? 'مفعّل' : 'معطّل'}</span>{sw('doctor')}</div>
              </div>
              <div className={`mf-tile is-elder ${s.cfg.elder ? '' : 'off'}`}>
                <div className="mf-av2"><RoleArt role="elder" /></div>
                <div className="mf-tx"><b>الشايب</b><small>يُسكِت لاعباً عن الكلام، أو يحقق مرة واحدة.</small></div>
                <div className="mf-ctl"><span>{s.cfg.elder ? 'مفعّل' : 'معطّل'}</span>{sw('elder')}</div>
              </div>
              <div className={`mf-tile is-detective ${s.cfg.detective ? '' : 'off'}`}>
                <div className="mf-av2"><RoleArt role="detective" /></div>
                <div className="mf-tx"><b>المحقق</b><small>يحقق كل ليلة في لاعب: مافيا / بريء / مشبوه. يدخل من {DETECTIVE_MIN} لاعبين.</small></div>
                <div className="mf-ctl"><span>{s.cfg.detective ? 'مفعّل' : 'معطّل'}</span>{sw('detective')}<span>{pn.t}</span></div>
              </div>
              <div className={`mf-tile is-joker ${s.cfg.joker ? '' : 'off'}`}>
                <div className="mf-av2"><RoleArt role="joker" /></div>
                <div className="mf-tx"><b>الجوكر</b><small>يفوز وحده إذا طردته القرية بالتصويت. يدخل من {JOKER_MIN} لاعبين.</small></div>
                <div className="mf-ctl"><span>{s.cfg.joker ? 'مفعّل' : 'معطّل'}</span>{sw('joker')}<span>{pn.j}</span></div>
              </div>
              <div className="mf-tile is-citizen">
                <div className="mf-av2"><RoleArt role="citizen" /></div>
                <div className="mf-tx"><b>مواطنون</b><small>الباقون. يبحثون عن المافيا بالنقاش والتصويت.</small></div>
                <div className="mf-ctl"><b style={{ fontSize: 26 }}>{Math.max(0, pn.ct)}</b><span>لاعب</span></div>
              </div>
            </div>
            <div className="mf-dst">
              {seg.map(t => (
                <i key={t[2]} style={{ width: `${n ? (t[1] / n) * 100 : 0}%`, background: t[0] }} />
              ))}
            </div>
            <div className="mf-lgd">
              {seg.map(t => <span key={t[2]} style={{ ['--c' as any]: t[0] }}>{t[2]} {t[1]}</span>)}
              <span style={{ ['--c' as any]: '#fff' }}>الحد الأدنى {MIN_PLAYERS} لاعبين</span>
            </div>
            {join ? (
              pn.err
                ? <div className="mf-msg er">{pn.err}</div>
                : <div className="mf-msg ok">التوزيع جاهز: {n} لاعبين</div>
            ) : null}
          </div>

          <div className="mf-pn">
            <h3><RefreshCw size={16} /> الأوقات والقواعد</h3>
            <div className="mf-g3">
              {step('tMafia', 'وقت المافيا', s.cfg.tMafia, 'ث')}
              {step('tDoc', 'وقت الدكتور', s.cfg.tDoc, 'ث')}
              {step('tElder', 'وقت الشايب', s.cfg.tElder, 'ث')}
              {step('tDet', 'وقت المحقق', s.cfg.tDet, 'ث')}
              {step('tDay', 'وقت النقاش', s.cfg.tDay, 'ث')}
              {step('tVote', 'وقت التصويت', s.cfg.tVote, 'ث')}
              <div className="mf-tm"><span>الشايب يملك تحقيقاً</span>{sw('invest')}</div>
              <div className="mf-tm"><span>كشف دور المُقصى</span>{sw('reveal')}</div>
              <div className="mf-tm"><span>الجوكر لا يفوز في اليوم الأول</span>{sw('jokerSafeDay1')}</div>
              <div className="mf-tm"><span>المحقق يحقق كل ليلتين</span>{sw('detEveryOther')}</div>
            </div>
          </div>

          <div className="mf-pn">
            <h3><Users size={16} /> اللاعبون ({n})</h3>
            <div className="mf-pls">
              {s.P.map(p => (
                <div key={p.id} className={`mf-pc ${p.alive ? '' : 'is-dead'}`}>
                  <Avatar handle={p.handle} url={p.avatar} size={30} />
                  <span className="nn">{p.name}</span>
                  {s.ph === 'reveal' && p.ready ? <Check size={14} style={{ color: '#2fd47a' }} /> : null}
                  {join ? (
                    <button className="kk" onClick={() => cmd('kick', { id: p.id })} aria-label="طرد"><X size={13} /></button>
                  ) : null}
                </div>
              ))}
              {!n ? <div className="mf-empty">لا يوجد لاعبون بعد — شارك رابط الدخول.</div> : null}
            </div>
          </div>

          {s.ph === 'night' || s.ph === 'day' ? (
            <div className="mf-pn">
              <h3><Eye size={16} /> كواليس الليلة (للمدير فقط)</h3>
              <p style={{ fontSize: 13, color: '#cdbfc0', fontWeight: 700 }}>
                الضحية: <b>{names(s.nt.kill)}</b> · يحميه الدكتور: <b>{names(s.nt.protect)}</b> ·
                إسكات الشايب: <b>{names(s.nt.silence)}</b> · تحقيق الشايب: <b>{names(s.nt.invest)}</b>
              </p>
              <p style={{ fontSize: 13, color: '#ffcda3', fontWeight: 700 }}>
                المجهر: <b>{names(s.nt.det)}</b>
                {s.nt.det ? ` — ${DET_RESULT_LABEL[detResultOf(roles[s.nt.det])]}` : ''}
                {s.cfg.detEveryOther && !detCanAct(s) ? ' · المحقق ينتظر ليلته' : ''}
              </p>
            </div>
          ) : null}

          <div className="mf-pn">
            <h3><RefreshCw size={16} /> السجل</h3>
            <div className="mf-log">
              {s.log.slice().reverse().map((l, i) => <span key={i}>{l}</span>)}
              {!s.log.length ? <span>—</span> : null}
            </div>
          </div>

          {notice ? <div className="mf-msg ok">{notice}</div> : null}
        </div>
      </div>
    </div>
  );
};

type Phase_ = 'join' | 'deal' | 'reveal' | 'night' | 'day' | 'end';

export default MafiaGame;
