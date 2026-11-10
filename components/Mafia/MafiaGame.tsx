/**
 * iCG1 — المافيا v5 (قشرة iframe)
 * اللعبة نفسها ملف مستقل: public/mafia.html — يولّده scripts/mafia-port.mjs من النموذج.
 * هذا المكوّن: بوابة الأدمن، دخول اللاعب بحساب Kick، وتمرير الهوية والإطار للشاشة.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseRestConfig } from '../../services/supabase';
import { chatService } from '../../services/chatService';
import { awardPointsToMany } from '../../services/points';
import { buildShortJoinLink, isShortRoomRoute, readShortRoomCode } from '../../utils/gameLink';
import { isExpiredSignedUrl } from '../../utils/assets';
import { isAdminSession, readMember, resolveMemberFrame, syncGameKey } from '../../services/memberIdentity';
import { GlobalPasswordPage } from '../GlobalPasswordPage';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rndCode = (n: number) =>
  Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

interface EndPlayer {
  id: string;
  name: string;
  alive?: boolean;
  role?: string;
  av?: string;
  ap?: number;
}

/** الفريق الفائز: الجوكر لوحده، المافيا لها، والمدن لغير المافيا والجوكر */
const winnersOf = (winner: string, players: EndPlayer[]) =>
  players
    .filter(p =>
      winner === 'joker' ? p.role === 'joker'
        : winner === 'mafia' ? p.role === 'mafia'
          : winner === 'town' ? !!p.role && p.role !== 'mafia' && p.role !== 'joker'
            : false)
    .filter(p => p.ap === 1 && !!p.id)
    .map(p => ({ username: p.id, avatar: p.av || '' }));

export interface MafiaGameProps {
  onHome?: () => void;
}

export const MafiaGame: React.FC<MafiaGameProps> = ({ onHome }) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const shortRoute = isShortRoomRoute();
  const rawMode = (shortRoute ? 'p' : params.get('m') || 's').toLowerCase();
  const mode: 'stage' | 'player' | 'admin' =
    rawMode === 'p' || rawMode === 'player' ? 'player'
      : rawMode === 'h' || rawMode === 'admin' ? 'admin'
        : 'stage';

  const [code, setCode] = useState(() =>
    (readShortRoomCode() || params.get('r') ||
      sessionStorage.getItem('icg1_mafia_code') ||
      (mode === 'stage' ? rndCode(6) : '')).toUpperCase());

  const [hostKey] = useState(() => {
    if (mode !== 'stage') return params.get('k') || '';
    const stored = sessionStorage.getItem('icg1_mafia_hk');
    if (stored) return stored;
    const fresh = rndCode(10);
    sessionStorage.setItem('icg1_mafia_hk', fresh);
    return fresh;
  });

  useEffect(() => {
    if (!code) return;
    sessionStorage.setItem('icg1_mafia_code', code);
    if (mode !== 'stage') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('r') !== code) {
        url.searchParams.set('r', code);
        window.history.replaceState({}, '', url.toString());
      }
    } catch { /* المسار غير قابل للتعديل */ }
  }, [code, mode]);

  const [tick, setTick] = useState(0);
  /* رقم إعادة المحاولة: يتغيّر عند طلب اللعبة إعادة مزامنة المفتاح فيعيد الانضمام فوراً */
  const [keyNonce, setKeyNonce] = useState(0);
  const member = useMemo(() => readMember(), [tick]);
  const adminOk = useMemo(() => isAdminSession(), [tick]);
  const [frame, setFrame] = useState({ frameId: '', frameUrl: '' });
  const [liveAvatar, setLiveAvatar] = useState('');

  /* ===== هوية اللاعب: من جلسة الموقع المتحققة + إطاره المجهّز + صورته من كيك ===== */
  useEffect(() => {
    if (mode === 'stage') return;
    let alive = true;
    const m = readMember();
    if (m) {
      // مفتاح الإثبات يجب أن يكون مفتاح هذا الحساب تحديداً — يزامن مع المخزّن في قاعدة البيانات
      syncGameKey(m.handle).then(gk => { if (alive && gk !== m.gameKey) setTick(t => t + 1); });
      resolveMemberFrame(m.handle).then(f => { if (alive) setFrame(f); });
      // صورة كيك: رابط موقّع ينتهي بعد دقائق — يُعرض من الكاش ثم يُجدَّد باستمرار
      const seed = localStorage.getItem(`av_${m.handle}`) || localStorage.getItem(`kick_av_${m.handle}`) || '';
      if (seed && !isExpiredSignedUrl(seed)) setLiveAvatar(seed);
      const pull = () => chatService.fetchKickAvatar(m.handle)
        .then(u => { if (alive && u) setLiveAvatar(u); })
        .catch(() => {});
      pull();
      const avId = setInterval(pull, 60000);
      return () => { clearInterval(avId); alive = false; };
    } else {
      // تسجيل الدخول يتم في هذه النافذة (بوابة التطبيق أو النموذج أدناه) — نتابع حتى يظهر الحساب
      const id = setInterval(() => { if (readMember()) setTick(t => t + 1); }, 2000);
      return () => { clearInterval(id); alive = false; };
    }
  }, [mode, tick]);

  /* ===== شبكة أمان: مفتاح الإثبات قد يكون قديماً بعد تغيير كلمة السر أو ترقية التشفير ===== */
  useEffect(() => {
    if (mode !== 'player') return;
    let alive = true;
    const id = setInterval(() => {
      const m = readMember();
      if (!m) return;
      const before = m.gameKey;
      syncGameKey(m.handle, true).then(gk => {
        if (alive && gk && gk !== before) setTick(t => t + 1);
      });
    }, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [mode]);

  const me = useMemo(() => {
    if (!member) return null;
    return {
      id: member.handle,
      handle: member.handle,
      name: member.name,
      avatar: liveAvatar || member.avatar,
      gk: member.gameKey,
      ks: member.keyState,
      rk: keyNonce,
      fr: frame.frameId,
      fu: frame.frameUrl,
    };
  }, [member, frame, liveAvatar, keyNonce]);

  const src = useMemo(() => {
    const q = new URLSearchParams();
    q.set('m', mode === 'stage' ? 's' : mode === 'admin' ? 'h' : 'p');
    if (code) q.set('r', code);
    if (hostKey) q.set('k', hostKey);
    return `/mafia.html?${q.toString()}`;
  }, [mode, code, hostKey]);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [notice, setNotice] = useState('');
  const [howOpen, setHowOpen] = useState(false);
  const [uiOn, setUiOn] = useState(true);
  const endedRef = useRef(false);
  const noticeTimer = useRef<any>(null);
  const codeRef = useRef(code);
  codeRef.current = code;
  /* المرجع يبقى محدّثاً حتى لا يستخدم المستمع القديم قيمة قديمة */
  const onHomeRef = useRef(onHome);
  onHomeRef.current = onHome;

  const flash = useCallback((text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4600);
  }, []);

  /* ===== الهوية + إعدادات القاعدة: تُرسل بالتكرار حتى تصل (قد يتأخر iframe) ===== */
  useEffect(() => {
    const send = () => {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      const rest = supabaseRestConfig();
      win.postMessage(
        {
          source: 'icg-shell',
          type: 'icg:mafia:cfg',
          url: rest?.url || '',
          key: rest?.key || '',
          app: window.location.origin + '/',
          me,
        },
        window.location.origin
      );
    };
    send();
    const id = setInterval(send, 2600);
    return () => clearInterval(id);
  }, [me, src]);

  /* ===== رسائل اللعبة: الجاهزية، الكود، النهاية ===== */
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const d = ev.data as any;
      if (!d || d.source !== 'icg-mafia') return;
      if (d.type === 'icg:mafia:ready') {
        setReady(true);
        setDbOk(d.db === 1);
        if (d.db === 1) setNotice('');
        else flash('اللعبة الآن على هذا الجهاز فقط — نفّذ ملف SQL لتربط الهواتف باللعبة');
      } else if (d.type === 'icg:mafia:db') {
        setDbOk(d.ok === 1);
        flash(d.ok === 1
          ? 'تم الاتصال بقاعدة البيانات — اللعب أونلاين بين الأجهزة 🟢'
          : 'تعذّر الوصول لقاعدة البيانات — اللعبة على هذا الجهاز فقط، نفّذ ملف SQL');
      } else if (d.type === 'icg:mafia:how') {
        setHowOpen(d.open === 1);
      } else if (d.type === 'icg:mafia:home') {
        /* زر الرجوع داخل الجوال: خروج بدون لمس حالة المباراة — المقعد والدور محفوظان ويُستعادان عند العودة */
        onHomeRef.current?.();
      } else if (d.type === 'icg:mafia:needkey') {
        /* اللعبة رفضت الإثبات: أعِد قراءة مفتاح الحساب من قاعدة البيانات ثم أعد الانضمام */
        const m = readMember();
        if (m) syncGameKey(m.handle, true).then(() => { setTick(t => t + 1); setKeyNonce(n => n + 1); });
      } else if (d.type === 'icg:mafia:room') {
        if (d.room && !codeRef.current) setCode(String(d.room).toUpperCase());
      } else if (d.type === 'icg:mafia:end') {
        if (endedRef.current) return;
        endedRef.current = true;
        const players: EndPlayer[] = Array.isArray(d.players) ? d.players : [];
        const winners = winnersOf(String(d.winner), players);
        if (!winners.length) { flash('انتهت المباراة — لا فائزين بحسابات مسجّلة'); return; }
        awardPointsToMany('MAHMAH_GAME', winners, 'match');
        flash(`أُضيفت النقاط إلى ${winners.length} من الفائزين 🏆`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [flash]);

  useEffect(() => { endedRef.current = false; setHowOpen(false); }, [code]);

  /* ===== شريط التحكم يختفي تلقائياً حتى لا يظهر في البث ===== */
  const hideTimer = useRef<any>(null);
  const wake = useCallback(() => {
    setUiOn(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiOn(false), 3200);
  }, []);
  useEffect(() => {
    if (mode === 'player') return;
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [mode, wake]);

  const joinLink = code ? buildShortJoinLink(code) : '';

  const copyJoin = useCallback(async () => {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      flash('تم نسخ رابط الانضمام');
    } catch { flash(joinLink); }
  }, [joinLink, flash]);

  const fullscreen = useCallback(() => {
    const el = frameRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  }, []);

  const chrome = mode !== 'player' && !howOpen;
  /* بوابة الدخول تظهر حين لا جلسة عضو إطلاقاً. أما لو الجلسة موجودة ومفتاح الإثبات
     لم يُمحَّب أو الحساب غير مسجّل فتتكفّل شاشة اللعبة برسالة دقيقة — لأن إعادته
     لبوابة الدخول كل ثانيتين كانت تبدو له كـ«مشكلة دخول» ولا تنتهي. */
  const needLogin = mode === 'player' && !me;

  /* ===== لوحة الإدارة: لأدمن الموقع فقط — أي مستخدم عادي ممنوع ===== */
  if (mode === 'admin' && !adminOk) {
    return (
      <div className="fixed inset-0 z-[9999] overflow-auto bg-[#07060b]" style={{ direction: 'rtl' }}>
        <GlobalPasswordPage
          adminOnly
          onSuccess={() => setTick(t => t + 1)}
          title="لوحة إدارة المافيا"
          subtitle="ADMIN ACCESS ONLY"
          newTitle="كلمة سر الإدارة"
          returningTitle="دخول الإدارة"
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" style={{ direction: 'rtl' }}>
      <iframe
        key={src}
        ref={frameRef}
        src={src}
        title="لعبة المافيا"
        className="absolute inset-0 h-full w-full border-0 bg-black"
        allow="fullscreen; clipboard-write; autoplay"
      />

      {!ready && !needLogin && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/85">
          <div className="flex flex-col items-center gap-3 text-[#e8be6e]">
            <span className="animate-pulse text-4xl">🎭</span>
            <b className="text-lg tracking-widest">جارِ تحميل اللعبة…</b>
          </div>
        </div>
      )}

      {/* ===== اللاعب يدخل بحسابه في كيك فقط — بلا كتابة اسم ===== */}
      {needLogin && (
        <div className="absolute inset-0 z-30 overflow-auto bg-[#07060b]">
          <GlobalPasswordPage
            onSuccess={() => setTick(t => t + 1)}
            title="دخول الأعضاء"
            subtitle="KICK ACCOUNT REQUIRED"
          />
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
          <button
            onClick={onHome}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-[#ffe9b8] transition-colors hover:bg-[#e8be6e] hover:text-[#1a1006]"
            title="العودة للرئيسية"
          >
            الرئيسية
          </button>

          {mode === 'stage' && code && (
            <button
              onClick={copyJoin}
              className="rounded-full px-3 py-1.5 text-xs font-black tracking-widest text-[#1a1006] transition-transform hover:scale-105"
              style={{ background: 'linear-gradient(180deg,#f9e0a4,#c08b3a)' }}
              title="نسخ رابط الانضمام"
            >
              {code}
            </button>
          )}

          <button
            onClick={fullscreen}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-[#ffe9b8] transition-colors hover:bg-[#e8be6e] hover:text-[#1a1006]"
            title="ملء الشاشة"
          >
            ⛶
          </button>

          <span
            className="h-2.5 w-2.5 rounded-full"
            title={dbOk === null ? 'جارٍ فحص الاتصال' : dbOk ? 'متصل بقاعدة البيانات' : 'بدون قاعدة بيانات'}
            style={{
              background: dbOk === null ? '#8a7a5e' : dbOk ? '#7dffb0' : '#ff6b5a',
              boxShadow: dbOk === null ? 'none' : `0 0 10px ${dbOk ? '#7dffb0' : '#ff6b5a'}`,
            }}
          />
        </div>
      )}

      {chrome && notice && (
        <div
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold text-[#1a1006]"
          style={{ background: 'linear-gradient(180deg,#f9e0a4,#c08b3a)', boxShadow: '0 0 30px #e8be6e66' }}
        >
          {notice}
        </div>
      )}
    </div>
  );
};

export default MafiaGame;
