/**
 * iCG1 — حانة الكذابين (LIAR'S DEN)
 * قشرة React على نمط المافيا: الهوية والحجز والنقاط هنا، والمشهد/المحرّك
 * داخل iframe مستقل (public/liars-den/host.html و player.html).
 * التواصل بين اللاعبين Realtime Broadcast فقط — لا حركات لعب في قاعدة البيانات.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalPasswordPage } from '../GlobalPasswordPage';
import { isAdminSession, readMember, syncGameKey, verifyAdminSession, resetAdminSession } from '../../services/memberIdentity';
import { supabaseRestConfig } from '../../services/supabase';
import { ldApi, ldErrorText, toSeatSlots } from '../../services/liarsDen/api';
import type { HostSecrets } from '../../services/liarsDen/api';
import { LiarsNet } from '../../services/liarsDen/net';
import {
  buildJoinLink,
  clampRounds,
  clampRoundWins,
  isValidAct,
  newMatchId,
  sameHex,
  sha256Hex,
  signAct,
  randomHex,
} from '../../services/liarsDen/engine';
import type { SeatSlot } from '../../services/liarsDen/engine';
import { isLdRoomRoute, readLdRoomCode } from '../../utils/gameLink';

export interface LiarsDenGameProps {
  onHome?: () => void;
}

const EMPTY_SEATS: SeatSlot[] = [
  { taken: false }, { taken: false }, { taken: false }, { taken: false },
];

export const LiarsDenGame: React.FC<LiarsDenGameProps> = ({ onHome }) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const obs = params.get('obs') === 'true';
  const playerRoute = !obs && (isLdRoomRoute() || ['p', 'player'].includes((params.get('m') || '').toLowerCase()));
  const routeCode = playerRoute ? (readLdRoomCode() || (params.get('r') || '')).toUpperCase() : '';

  const [tick, setTick] = useState(0);
  const member = useMemo(() => (obs ? null : readMember()), [tick, obs]);
  /* صاحب الموقع يستضيف من جلسة الإدارة بلا حساب عضو — والمسرح لا يرميه لبوابة الأعضاء.
     الجلسة يثبتها السيرفر (/api/admin/me) — لا شيء في التخزين المحلي يمنح الاستضافة. */
  const adminOk = useMemo(() => (obs ? false : isAdminSession()), [tick, obs]);
  const [adminReady, setAdminReady] = useState(false);
  useEffect(() => {
    if (obs) { setAdminReady(true); return; }
    let alive = true;
    verifyAdminSession().then(() => { if (alive) { setAdminReady(true); setTick(t => t + 1); } });
    return () => { alive = false; };
  }, [obs]);

  const [code, setCode] = useState(routeCode);
  const [hostToken, setHostToken] = useState('');
  const [seats, setSeats] = useState<SeatSlot[]>(EMPTY_SEATS);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState('');
  const [booting, setBooting] = useState(!obs);
  const [notice, setNotice] = useState('');
  const [howOpen, setHowOpen] = useState(false);
  const [uiOn, setUiOn] = useState(true);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const netRef = useRef<LiarsNet | null>(null);
  const codeRef = useRef(code);
  const hostTokenRef = useRef(hostToken);
  const seatsRef = useRef<SeatSlot[]>(EMPTY_SEATS);
  const seatTokensRef = useRef<(string | null)[]>([null, null, null, null]);
  const seatTopicsRef = useRef<string[]>([],);
  const allowedTidRef = useRef<number[]>([0, 0, 0, 0]);
  const lastSeqRef = useRef<number[]>([0, 0, 0, 0]);
  const turnTidRef = useRef<number[]>([0, 0, 0, 0]);
  const mySeatRef = useRef(-1);
  const myTokenRef = useRef('');
  const myTopicRef = useRef('');
  const mySeqRef = useRef(0);
  const startedRef = useRef(false);
  const lastStateRef = useRef<{ pub: any; hands: string[][]; alive: boolean[] } | null>(null);
  const lastSigRef = useRef('');
  const lastHandSigRef = useRef<string[]>(['', '', '', '']);
  const matchRef = useRef('');
  const bootRef = useRef(false);
  const startingRef = useRef(false);
  const finishingRef = useRef(false);
  const noticeTimer = useRef<any>(null);
  const onHomeRef = useRef(onHome);
  onHomeRef.current = onHome;
  codeRef.current = code;
  hostTokenRef.current = hostToken;
  seatsRef.current = seats;

  const flash = useCallback((text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  }, []);

  /* ?r=CODE يبقى بعد الخروج فيرسل تحديث الصفحة إلى المافيا بالخطأ — امسحه عند المغادرة */
  const clearRoomParam = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('r')) return;
      url.searchParams.delete('r');
      window.history.replaceState({}, '', url.toString());
    } catch { /* المسار ثابت */ }
  }, []);

  /* يغطي كل طرق الخروج: زر المسرح، زر الرجوع الثابت، خروج الجوال، رجوع المتصفح */
  useEffect(() => () => clearRoomParam(), [clearRoomParam]);

  const postToFrame = useCallback((msg: any) => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'icg-shell', ...msg }, window.location.origin);
  }, []);

  /* ===== إثبات الهوية: مفتاح اللعبة يبقى في هذا المتصفح، والتوقيع يُحسب هنا ===== */
  const proof = useCallback(async (handle: string, room: string) => {
    let gk = await syncGameKey(handle);
    if (!gk) gk = await syncGameKey(handle, true);
    if (!gk) throw new Error('bad_identity');
    const nonce = randomHex(16);
    return { nonce, token: await sha256Hex(`${gk}|${room.toUpperCase()}|${nonce}`) };
  }, []);

  useEffect(() => {
    if (obs || member || adminOk) return;
    const id = setInterval(() => {
      if (readMember()) setTick(t => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [member, adminOk, obs]);

  /* ===== المسرح: إنشاء غرفة في السيرفر (لا كود محلي) ===== */
  useEffect(() => {
    if (obs || playerRoute || bootRef.current) return;
    if (!member && !adminOk) return;
    bootRef.current = true;
    (async () => {
      try {
        const hostRoom = async () => {
          const r = await fetch('/api/liars-den/host-room', { method: 'POST', credentials: 'include' });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j?.code || !j?.host_token) throw new Error(j?.error || 'bad_host');
          return j as { code: string; host_token: string };
        };
        let room: { code: string; host_token: string };
        if (member) {
          try {
            const p = await proof(member.handle, 'LD-CREATE');
            room = await ldApi.createRoom(member.handle, p.nonce, p.token);
          } catch {
            /* مفتاح العضو غير متزامن؟ المسرح يُفتح بلا حساب كالمافيا */
            room = await hostRoom();
          }
        } else {
          room = await hostRoom();
        }
        setCode(room.code);
        setHostToken(room.host_token);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('r', room.code);
          window.history.replaceState({}, '', url.toString());
        } catch { /* المسار ثابت */ }
      } catch (e: any) {
        setFatal(ldErrorText(String(e?.message || '')));
      } finally {
        setBooting(false);
      }
    })();
  }, [member, adminOk, obs, playerRoute, proof]);

  /* ===== اللاعب: تحقّق من الغرفة ثم انتظر الحجز ===== */
  useEffect(() => {
    if (obs || !playerRoute) return;
    if (!routeCode) { setFatal('افتح رابط الغرفة من شاشة اللعبة'); setBooting(false); return; }
    let alive = true;
    (async () => {
      try {
        const room = await ldApi.getRoom(routeCode);
        if (!alive) return;
        setCode(room.code);
        setSeats(toSeatSlots(room.seats));
        startedRef.current = room.status === 'playing';
        setBooting(false);
        if (member) await claimSeat(-1);
      } catch (e: any) {
        if (alive) {
          setFatal(ldErrorText(String(e?.message || '')));
          setBooting(false);
        }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs, playerRoute, routeCode, member]);

  const refreshSeats = useCallback(async (broadcast: boolean) => {
    const c = codeRef.current;
    const ht = hostTokenRef.current;
    if (!c || !ht) return;
    try {
      const secrets: HostSecrets = await ldApi.hostSecrets(c, ht);
      const prev = seatTokensRef.current.slice();
      seatTokensRef.current = [null, null, null, null];
      secrets.seats.forEach(s => {
        if (!s.taken || s.seat < 0 || s.seat > 3) return;
        seatTokensRef.current[s.seat] = s.token || null;
        if (prev[s.seat] !== s.token) {
          lastSeqRef.current[s.seat] = 0;
          allowedTidRef.current[s.seat] = 0;
          lastHandSigRef.current[s.seat] = '';
        }
      });
      const slots = toSeatSlots(secrets.seats);
      setSeats(slots);
      postToFrame({ type: 'icg:ld:seats', seats: slots });
      if (broadcast) await netRef.current?.publishPub({ type: 'seats', seats: slots });

      const net = netRef.current;
      if (net) {
        const nextTopics: string[] = [];
        for (const s of secrets.seats) {
          if (!s.taken || !s.topic || s.seat < 0) continue;
          nextTopics[s.seat] = s.topic;
          if (seatTopicsRef.current[s.seat] === s.topic) continue;
          net.leaveSeat(s.seat);
          const seat = s.seat;
          await net.joinSeat(c, seat, s.topic, msg => onSeatMessage(seat, msg));
        }
        for (let i = 0; i < 4; i++) {
          if (seatTopicsRef.current[i] && !nextTopics[i]) net.leaveSeat(i);
        }
        seatTopicsRef.current = nextTopics;
      }
      if (lastStateRef.current && secrets.status === 'playing') {
        lastSigRef.current = '';
        await publishState(lastStateRef.current, true);
      }
    } catch (e: any) {
      flash(ldErrorText(String(e?.message || '')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, postToFrame]);

  /* ===== استقبال أفعال المقاعد في المسرح والتحقق منها ===== */
  const onSeatMessage = useCallback(async (seat: number, msg: any) => {
    if (!msg || msg.type !== 'act') return;
    const token = seatTokensRef.current[seat];
    if (!token) return;
    if (msg.seat !== seat || !isValidAct(msg.act)) return;
    const tid = Number(msg.tid) | 0;
    const seq = Number(msg.seq) | 0;
    if (!tid || tid !== allowedTidRef.current[seat] || seq <= lastSeqRef.current[seat]) return;
    if (Math.abs(Date.now() - Number(msg.ts || 0)) > 45000) return;
    const expected = await signAct(token, seat, tid, seq, msg.act);
    if (!sameHex(expected, String(msg.sig || ''))) return;
    lastSeqRef.current[seat] = seq;
    allowedTidRef.current[seat] = 0;
    postToFrame({ type: 'icg:ld:act', seat, tid, act: msg.act });
  }, [postToFrame]);

  /* ===== نشر الحالة: عامة للطاولة، واليد قناة خاصة لكل مقعد ===== */
  const publishState = useCallback(async (state: { pub: any; hands: string[][]; alive: boolean[] }, force = false) => {
    lastStateRef.current = state;
    const net = netRef.current;
    if (!net || !state?.pub) return;
    const pub = { ...state.pub, aliveArr: state.alive };
    const sig = JSON.stringify([pub, state.hands]);
    if (!force && sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    await net.publishPub({ type: 'state', pub });
    for (let i = 0; i < 4; i++) {
      if (!seatTokensRef.current[i]) continue;
      const hand = state.hands?.[i] || [];
      const hs = JSON.stringify(hand);
      if (!force && hs === lastHandSigRef.current[i]) continue;
      lastHandSigRef.current[i] = hs;
      await net.publishSeat(i, { type: 'hand', hand });
    }
  }, []);

  const startMatch = useCallback(async () => {
    const c = codeRef.current;
    const ht = hostTokenRef.current;
    if (!c || !ht || startingRef.current) return;
    startingRef.current = true;
    try {
      const id = newMatchId();
      const r = await ldApi.startMatch(c, ht, id);
      matchRef.current = r.match_id || id;
      postToFrame({ type: 'icg:ld:startack', matchId: matchRef.current });
      await netRef.current?.publishPub({ type: 'start', matchId: matchRef.current });
      flash(r.humans < 2 ? 'مباراة تدريبية — لا نقاط' : 'بدأت المباراة 🔫');
    } catch (e: any) {
      postToFrame({ type: 'icg:ld:startfail' });
      flash(ldErrorText(String(e?.message || '')));
    } finally {
      startingRef.current = false;
    }
  }, [flash, postToFrame]);

  const finishMatch = useCallback(async (d: any) => {
    const c = codeRef.current;
    const ht = hostTokenRef.current;
    const mid = String(d?.matchId || matchRef.current || '');
    if (!c || !ht || !mid || finishingRef.current) return;
    finishingRef.current = true;
    try {
      const r = await ldApi.finishMatch(
        c, ht, mid,
        Math.max(0, Math.min(3, Number(d?.seat) | 0)),
        clampRoundWins(d?.calls),
        clampRounds(d?.rounds)
      );
      const gained = (r.awards || []).reduce((sum, a) => sum + (Number(a.points) || 0), 0);
      if (r.duplicate) flash('النتيجة محفوظة مسبقاً');
      else if ((r.human_count || 0) < 2) flash('انتهت المباراة — تدريب بلا نقاط');
      else flash(gained > 0 ? `انتهت المباراة — أُضيفت ${gained} نقطة` : 'انتهت المباراة');
    } catch (e: any) {
      flash(ldErrorText(String(e?.message || '')));
    } finally {
      finishingRef.current = false;
    }
  }, [flash, postToFrame]);

  /* ===== قنوات المسرح ===== */
  useEffect(() => {
    if (obs || playerRoute || !code || !hostToken) return;
    const net = new LiarsNet();
    netRef.current = net;
    let alive = true;
    (async () => {
      await net.joinPub(
        code,
        () => undefined,
        () => { refreshSeats(true); }
      );
      if (!alive) return;
      await refreshSeats(true);
    })();
    return () => {
      alive = false;
      net.close();
      netRef.current = null;
      seatTopicsRef.current = [];
    };
  }, [obs, playerRoute, code, hostToken, refreshSeats]);

  /* ===== قنوات اللاعب ===== */
  useEffect(() => {
    if (obs || !playerRoute || !code) return;
    const net = new LiarsNet();
    netRef.current = net;
    let alive = true;
    (async () => {
      await net.joinPub(code, msg => {
        if (!alive || !msg) return;
        switch (msg.type) {
          case 'seats':
            setSeats(Array.isArray(msg.seats) ? msg.seats : EMPTY_SEATS);
            postToFrame({ type: 'icg:ld:seats', seats: msg.seats || EMPTY_SEATS });
            if (mySeatRef.current >= 0 && Array.isArray(msg.seats) && !msg.seats[mySeatRef.current]?.taken) {
              const lost = mySeatRef.current;
              mySeatRef.current = -1;
              myTokenRef.current = '';
              myTopicRef.current = '';
              startedRef.current = false;
              net.leaveSeat(lost);
              postToFrame({ type: 'icg:ld:denied', seats: msg.seats });
            }
            break;
          case 'state': {
            if (msg.pub) {
              const mine = mySeatRef.current;
              postToFrame({
                type: 'icg:ld:state',
                pub: msg.pub,
                aliveArr: msg.pub.aliveArr,
                alive: mine >= 0 ? !!msg.pub.aliveArr?.[mine] : false,
              });
            }
            break;
          }
          case 'hand':
            postToFrame({ type: 'icg:ld:hand', hand: msg.hand || [] });
            break;
          case 'turn':
            if (msg.seat === mySeatRef.current) turnTidRef.current[msg.seat] = Number(msg.tid) | 0;
            postToFrame({ type: 'icg:ld:pub', m: msg });
            break;
          case 'start':
            startedRef.current = true;
            postToFrame({ type: 'icg:ld:start' });
            break;
          case 'ev':
            postToFrame({ type: 'icg:ld:pub', m: msg.m });
            break;
          case 'closed':
            postToFrame({ type: 'icg:ld:closed' });
            break;
          default:
            break;
        }
      });
      if (alive && mySeatRef.current >= 0 && myTopicRef.current) {
        const seat = mySeatRef.current;
        await net.joinSeat(code, seat, myTopicRef.current, msg => {
          if (msg?.type === 'hand') postToFrame({ type: 'icg:ld:hand', hand: msg.hand || [] });
          else if (msg?.type === 'state') postToFrame({ type: 'icg:ld:state', pub: msg.pub, alive: msg.alive });
        });
        await net.publishPub({ type: 'seats_ping', seat });
      }
    })();
    return () => {
      alive = false;
      net.close();
      netRef.current = null;
    };
  }, [obs, playerRoute, code, postToFrame]);

  /* ===== جسر اللعبة ===== */
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const d: any = ev.data;
      if (!d || typeof d.type !== 'string') return;

      if (d.source === 'icg-ld-host') {
        if (d.type === 'icg:ld:ready') {
          setReady(true);
          if (obs) {
            postToFrame({ type: 'icg:ld:startack', matchId: newMatchId() });
          } else if (codeRef.current) {
            postToFrame({ type: 'icg:ld:cfg', code: codeRef.current, join: buildJoinLink(codeRef.current) });
            postToFrame({ type: 'icg:ld:seats', seats: seatsRef.current });
          }
        } else if (d.type === 'icg:ld:pub') {
          if (!obs) netRef.current?.publishPub({ type: 'ev', m: d.m });
        } else if (d.type === 'icg:ld:state') {
          if (!obs) publishState({ pub: d.pub, hands: d.hands, alive: d.alive });
        } else if (d.type === 'icg:ld:turn') {
          const seat = Number(d.seat) | 0;
          const tid = Number(d.tid) | 0;
          if (seat >= 0 && seat <= 3 && tid) allowedTidRef.current[seat] = tid;
          if (!obs) {
            netRef.current?.publishPub({
              type: 'turn', seat, tid, ms: Number(d.ms) || 30000, canCall: !!d.canCall,
            });
          }
        } else if (d.type === 'icg:ld:startreq') {
          if (obs) postToFrame({ type: 'icg:ld:startack', matchId: newMatchId() });
          else startMatch();
        } else if (d.type === 'icg:ld:winner') {
          if (obs) postToFrame({ type: 'icg:ld:match', matchId: newMatchId() });
          else finishMatch(d);
        }
        return;
      }

      if (d.source === 'icg-ld-player') {
        if (d.type === 'icg:ld:ready') {
          setReady(true);
          postToFrame({
            type: 'icg:ld:init',
            code: codeRef.current,
            name: member?.name || 'لاعب',
            seat: mySeatRef.current,
            started: startedRef.current,
            seats: seatsRef.current,
          });
        } else if (d.type === 'icg:ld:claim') {
          void claimSeat(Number(d.seat) | 0);
        } else if (d.type === 'icg:ld:leave') {
          void leaveSeat();
        } else if (d.type === 'icg:ld:act') {
          void sendAct(d);
        } else if (d.type === 'icg:ld:exit') {
          void leaveSeat().finally(() => onHomeRef.current?.());
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs, publishState, startMatch, finishMatch, postToFrame, member]);

  const claimSeat = useCallback(async (seat: number) => {
    const m = readMember();
    const c = codeRef.current;
    if (!m || !c || seat < -1 || seat > 3) return;
    try {
      const p = await proof(m.handle, c);
      const r = await ldApi.claimSeat(c, m.handle, p.nonce, p.token, seat);
      if (r.seat === null || !r.token || !r.topic) {
        if (seat >= 0 && r.status === 'playing') flash('المباراة بدأت — انتظر المباراة القادمة');
        return;
      }
      mySeatRef.current = r.seat;
      myTokenRef.current = r.token;
      myTopicRef.current = r.topic;
      mySeqRef.current = 0;
      startedRef.current = r.status === 'playing';
      const net = netRef.current;
      if (net) {
        await net.joinPub(c, () => undefined);
        net.leaveSeat(r.seat);
        await net.joinSeat(c, r.seat, r.topic, msg => {
          if (msg?.type === 'hand') postToFrame({ type: 'icg:ld:hand', hand: msg.hand || [] });
          else if (msg?.type === 'state') postToFrame({ type: 'icg:ld:state', pub: msg.pub, alive: msg.alive });
        });
        await net.publishPub({ type: 'seats_ping', seat: r.seat });
      }
      postToFrame({ type: 'icg:ld:claimed', seat: r.seat, name: r.name, started: startedRef.current || r.status === 'playing' });
      if (startedRef.current) postToFrame({ type: 'icg:ld:start' });
    } catch (e: any) {
      mySeatRef.current = -1;
      myTokenRef.current = '';
      myTopicRef.current = '';
      postToFrame({ type: 'icg:ld:denied', seats: seatsRef.current });
      flash(ldErrorText(String(e?.message || '')));
    }
  }, [flash, postToFrame, proof]);

  const leaveSeat = useCallback(async () => {
    const m = readMember();
    const c = codeRef.current;
    const seat = mySeatRef.current;
    mySeatRef.current = -1;
    myTokenRef.current = '';
    netRef.current?.leaveSeat(seat);
    if (!m || !c) return;
    try {
      const p = await proof(m.handle, c);
      await ldApi.leaveSeat(c, m.handle, p.nonce, p.token);
      await netRef.current?.publishPub({ type: 'seats_ping', seat });
    } catch { /* المقعد سيُفرغ عند أول تحديث */ }
  }, [proof]);

  const sendAct = useCallback(async (d: any) => {
    const seat = mySeatRef.current;
    const token = myTokenRef.current;
    if (seat < 0 || !token || !isValidAct(d.act)) return;
    const tid = Number(d.tid) | 0;
    if (!tid || turnTidRef.current[seat] !== tid) return;
    const seq = ++mySeqRef.current;
    try {
      const sig = await signAct(token, seat, tid, seq, d.act);
      await netRef.current?.publishSeat(seat, {
        type: 'act', seat, tid, seq, act: d.act, sig, ts: Date.now(),
      });
      turnTidRef.current[seat] = 0;
    } catch { /* القناة مقطوعة */ }
  }, []);

  /* ===== الإغلاق: مغادرة الصفحة تُغلق الغرفة (بلا نقاط) ===== */
  useEffect(() => {
    if (obs || playerRoute) return;
    const bye = () => {
      const c = codeRef.current;
      const ht = hostTokenRef.current;
      if (!c || !ht) return;
      const rest = supabaseRestConfig();
      if (!rest) return;
      try {
        fetch(`${rest.url}/rest/v1/rpc/ld_close_room`, {
          method: 'POST',
          keepalive: true,
          headers: {
            apikey: rest.key,
            Authorization: `Bearer ${rest.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_code: c, p_host_token: ht }),
        }).catch(() => undefined);
      } catch { /* تجاهل */ }
    };
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [obs, playerRoute]);

  const goHome = useCallback(async () => {
    const c = codeRef.current;
    const ht = hostTokenRef.current;
    if (c && ht) { try { await ldApi.closeRoom(c, ht); } catch { /* تجاهل */ } }
    onHomeRef.current?.();
  }, []);

  /* ===== شريط تحكم المسرح يختفي من البث ===== */
  const hideTimer = useRef<any>(null);
  const wake = useCallback(() => {
    setUiOn(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiOn(false), 3200);
  }, []);
  useEffect(() => {
    if (playerRoute || obs) return;
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, [playerRoute, obs, wake]);

  const fullscreen = useCallback(() => {
    const el = frameRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  }, []);

  const copyJoin = useCallback(async () => {
    if (!code) return;
    const link = buildJoinLink(code);
    try { await navigator.clipboard.writeText(link); flash('تم نسخ رابط الانضمام'); }
    catch { flash(link); }
  }, [code, flash]);

  const src = useMemo(() => {
    if (obs) return '/liars-den/host.html?obs=1';
    if (!code) return '';
    return playerRoute
      ? `/liars-den/player.html?room=${encodeURIComponent(code)}`
      : `/liars-den/host.html?room=${encodeURIComponent(code)}`;
  }, [code, obs, playerRoute]);

  /* إعادة إرسال الإعدادات حتى لا يضيع إطار بطيء (المسرح فقط) */
  useEffect(() => {
    if (obs || playerRoute || !src || !ready) return;
    const send = () => {
      postToFrame({ type: 'icg:ld:cfg', code: codeRef.current, join: buildJoinLink(codeRef.current) });
      postToFrame({ type: 'icg:ld:seats', seats: seatsRef.current });
    };
    send();
    const id = setInterval(send, 5000);
    return () => clearInterval(id);
  }, [obs, src, ready, playerRoute, postToFrame]);

  /* المسرح يكفي فيه حساب عضو أو جلسة إدارة مثبتة من السيرفر (كالمافيا). أما الهاتف/اللاعب
     فيلزمه حساب عضو دائماً ليحجز مقعداً — البوابة له فقط، لا للمستضيف. */
  const needLogin = !obs && (playerRoute ? !member : !member && !adminOk && adminReady);

  if (!obs && !playerRoute && !member && !adminReady) {
    return (
      <div className="fixed inset-0 z-[9999] grid place-items-center bg-[#07060b]" style={{ direction: 'rtl' }}>
        <div className="flex flex-col items-center gap-3 text-[#e8c07a]">
          <span className="animate-pulse text-4xl">♠</span>
          <b className="text-lg tracking-widest">جارٍ التحقق من صلاحية الدخول…</b>
        </div>
      </div>
    );
  }

  if (needLogin) {
    return (
      <div className="fixed inset-0 z-[9999] overflow-auto bg-[#07060b]" style={{ direction: 'rtl' }}>
        <GlobalPasswordPage
          onSuccess={() => {
            resetAdminSession();
            verifyAdminSession().then(() => setTick(t => t + 1));
          }}
          title="دخول الأعضاء"
          subtitle="KICK ACCOUNT REQUIRED"
        />
      </div>
    );
  }

  const chrome = !playerRoute && !obs && !howOpen;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" style={{ direction: 'rtl' }}>
      {src && (
        <iframe
          key={src}
          ref={frameRef}
          src={src}
          title="حانة الكذابين"
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="fullscreen; autoplay"
        />
      )}

      {!ready && !fatal && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/90">
          <div className="flex flex-col items-center gap-3 text-[#e8c07a]">
            <span className="animate-pulse text-4xl">♠</span>
            <b className="text-lg tracking-widest">جارِ تجهيز الطاولة…</b>
          </div>
        </div>
      )}

      {fatal && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/92 px-6 text-center">
          <div className="max-w-sm space-y-4">
            <div className="text-4xl">🚪</div>
            <b className="block text-xl text-[#f3d79d]">{fatal}</b>
            <div className="flex justify-center gap-3">
              <button onClick={() => window.location.reload()} className="rounded-full bg-[#e8c07a] px-5 py-2 text-sm font-black text-[#1a1006]">إعادة المحاولة</button>
              <button onClick={() => onHomeRef.current?.()} className="rounded-full border border-[#e8c07a55] px-5 py-2 text-sm font-bold text-[#f3d79d]">الرئيسية</button>
            </div>
          </div>
        </div>
      )}

      {chrome && (
        <div
          className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-full px-2 py-1.5 transition-all duration-500"
          style={{
            opacity: uiOn ? 1 : 0,
            transform: uiOn ? 'translateY(0)' : 'translateY(-16px)',
            pointerEvents: uiOn ? 'auto' : 'none',
            background: 'linear-gradient(180deg,#15100ae6,#0b0706cc)',
            border: '1px solid #e8be6e33',
            boxShadow: '0 8px 30px #000a',
          }}
        >
          <button onClick={goHome} className="rounded-full px-3 py-1.5 text-xs font-bold text-[#ffe9b8] hover:bg-[#e8be6e] hover:text-[#1a1006]" title="العودة للرئيسية">الرئيسية</button>
          {code && (
            <button onClick={copyJoin} className="rounded-full px-3 py-1.5 text-xs font-black tracking-widest text-[#1a1006]" style={{ background: 'linear-gradient(180deg,#f9e0a4,#c08b3a)' }} title="نسخ رابط الانضمام">{code}</button>
          )}
          <button onClick={() => setHowOpen(true)} className="rounded-full px-3 py-1.5 text-xs font-bold text-[#ffe9b8] hover:bg-[#e8be6e] hover:text-[#1a1006]" title="طريقة اللعب">؟</button>
          <button onClick={fullscreen} className="rounded-full px-3 py-1.5 text-xs font-bold text-[#ffe9b8] hover:bg-[#e8be6e] hover:text-[#1a1006]" title="ملء الشاشة">⛶</button>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ready ? '#7dffb0' : '#8a7a5e', boxShadow: ready ? '0 0 10px #7dffb0' : 'none' }} />
        </div>
      )}

      {chrome && notice && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold text-[#1a1006]" style={{ background: 'linear-gradient(180deg,#f9e0a4,#c08b3a)', boxShadow: '0 0 30px #e8be6e66' }}>
          {notice}
        </div>
      )}

      {howOpen && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 px-4" onClick={() => setHowOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-[#e8be6e40] bg-[#120b05] p-6 text-[#f0dfb8]" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <div className="mb-3 flex items-center justify-between">
              <b className="text-xl text-[#e8c07a]">حانة الكذابين</b>
              <button onClick={() => setHowOpen(false)} className="text-2xl leading-none text-[#e8c07a]">×</button>
            </div>
            <p className="mb-2 text-sm leading-7 text-[#c9b48a]">أربعة على الطاولة… ورصاصة واحدة تنتظر الكذّاب. العب ورقة أو ورقتين أو ثلاثاً مقلوبة، ويمكنك اتهام الخصم بكلمة «كذّاب!». من يخسر يجرّب حظه بالرصاصة.</p>
            <ul className="mb-4 space-y-1 text-sm text-[#c9b48a]">
              <li>• آخر ناجٍ وحده يفوز بالمباراة (+200).</li>
              <li>• كل اتهام صحيح +35.</li>
              <li>• وقتك 30 ثانية ثم يلعب البوت مكانك.</li>
            </ul>
            <div className="rounded-2xl bg-black/40 p-3 text-center">
              <div className="mb-1 text-xs text-[#8f7a55]">رابط الهواتف</div>
              <div className="break-all font-bold text-[#e8c07a]">{code ? buildJoinLink(code) : '—'}</div>
            </div>
            <button onClick={copyJoin} className="mt-4 w-full rounded-2xl bg-[#e8c07a] py-3 font-black text-[#1a1006]">نسخ الرابط</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiarsDenGame;
