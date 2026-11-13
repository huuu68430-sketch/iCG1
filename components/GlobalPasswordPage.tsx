import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { chatService } from '../services/chatService';

const sha256hex = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours
const MAX_ATTEMPTS = 5;
const LOCK_MS = 90 * 1000;

/* بادئة كود التحقق في شات كيك — مصدر واحد: التوليد والعرض والنسخ والمطابقة */
const CODE_PREFIX = 'iCG1-';

/** مهلة الكود بالثواني — تُحسب من لحظة مطلقة، مش عدّاد يتجمّد مع التبيش */
const VERIFY_WINDOW = 180;
const PENDING_VERIFY_KEY = 'iabs_pending_verify';
/** كم رسالة من الشات تُعرض للعضو وهو يرسل الكود — أربع يكفيها تشوف رسالتك */
const FEED_SIZE = 4;

/** زمن نسبي مختصر بالعربية لآخر رسائل الشات */
const agoText = (ts: number): string => {
  if (!ts) return 'الآن';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'الآن';
  if (s < 60) return `قبل ${s} ثانية`;
  const m = Math.round(s / 60);
  if (m < 60) return `قبل ${m} دقيقة`;
  return `قبل ${Math.round(m / 60)} ساعة`;
};

/** اسم مستخدم كيك موحد: بدون @ وبدون مسافات وبأحرف صغيرة */
const normKick = (x: any) => String(x ?? '').trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');

/** الكود كما يُطبع في الشات وكما يُقارَن — بدون تشكيلات ولا مسافات zero-width */
const normCode = (x: any) => String(x ?? '').toUpperCase().replace(/[\s\u200B-\u200D\uFEFF]/g, '');

const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${CODE_PREFIX}${out}`;
};

/**
 * طلب التحقق المعلّق — يُخزَّن لكى يرجع الشخص من تبويب كيك (أو يعيد فتح
 * الصفحة) على نفس الكود ونفس العد، بدل ما يلاقي نفسه في أول الصفحة.
 * sessionStorage حصراً: كلمة السر تبقى حيّة حتى يكتمل التحقّق أو تخلص
 * المهلة، وتُمحى فور إنشاء الحساب.
 */
interface PendingVerify {
  name: string;
  kick: string;
  disc: string;
  /** كلمة سر الحساب الجديدة — تُرسل للسيرفر عند إتمام التحقّق */
  pin: string;
  avatar: string;
  code: string;
  issuedAt: number;
  deadline: number;
}

const readPendingVerify = (): PendingVerify | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_VERIFY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.kick || !p?.code || !p?.pin || !p?.deadline) return null;
    if (Date.now() > Number(p.deadline)) { clearPendingVerify(); return null; }
    return p as PendingVerify;
  } catch { return null; }
};

const writePendingVerify = (p: PendingVerify) => {
  try {
    sessionStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify(p));
  } catch { /* التخزين مقفل — يبقى التدفق في نفس الصفحة */ }
};

const clearPendingVerify = () => {
  try {
    sessionStorage.removeItem(PENDING_VERIFY_KEY);
  } catch { }
};

const getDeviceSalt = (): string => {
  try {
    let salt = sessionStorage.getItem('iabs_device_salt');
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16)).reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
      sessionStorage.setItem('iabs_device_salt', salt);
    }
    return salt;
  } catch (e) {
    return 'no-salt';
  }
};

/**
 * جلسة الموقع في التخزين المحلي: علامة «مصرّح» + الدور + نهايتها.
 * سرّها من سرّ الجهاز (عشوائي) — لا كلمة سر الإدارة ولا كلمة سر العضو:
 * الصلاحيات الحقيقية كلها في كوكي HttpOnly يمنحه السيرفر.
 */
const deviceSecret = (): string => {
  try {
    let s = sessionStorage.getItem('iabs_device_secret');
    if (!s) {
      s = crypto.getRandomValues(new Uint8Array(24)).reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
      sessionStorage.setItem('iabs_device_secret', s);
    }
    return s;
  } catch {
    return 'device';
  }
};

const buildSession = async (role: 'admin' | 'user') => {
  const issuedAt = Date.now();
  const pinHash = await sha256hex(deviceSecret() + '|iABS_pin|');
  const token = await sha256hex(pinHash + '|' + issuedAt + '|' + getDeviceSalt());
  return { token, pinHash, issuedAt, expiresAt: issuedAt + SESSION_TTL, valid: true, role };
};

const validateSession = async (raw: string | null): Promise<boolean> => {
  try {
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.valid || !parsed.token || !parsed.pinHash || !parsed.issuedAt) return false;
    if (Date.now() > (parsed.expiresAt || 0)) return false;
    const expected = await sha256hex(parsed.pinHash + '|' + parsed.issuedAt + '|' + getDeviceSalt());
    return expected === parsed.token;
  } catch (e) {
    return false;
  }
};

export interface GlobalPasswordPageProps {
  onSuccess: (role: 'admin' | 'user') => void;
  storageKey?: string;
  title?: string;
  subtitle?: string;
  newTitle?: string;
  returningTitle?: string;
  configKey?: string;
  fallbackConfigKey?: string;
  adminOnly?: boolean;
}

type ViewName = 'login' | 'register' | 'verify' | 'admin' | 'scan' | 'ok';

export const GlobalPasswordPage: React.FC<GlobalPasswordPageProps> = ({
  onSuccess,
  storageKey = 'site_access_granted',
  title,
  subtitle,
  configKey = 'admin_password',
  fallbackConfigKey,
  adminOnly = false
}) => {
  const [curView, setCurView] = useState<ViewName>(adminOnly ? 'admin' : 'login');
  const [animClass, setAnimClass] = useState<'on' | 'out'>('on');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  // Rate Limiting
  const [lockedUntil, setLockedUntil] = useState(0);
  const [fails, setFails] = useState(0);

  // Login Form
  const [loginUser, setLoginUser] = useState('');
  const [loginPin, setLoginPin] = useState<string[]>(['', '', '', '', '', '']);
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginPinBad, setLoginPinBad] = useState(false);

  // Register Form
  const [regName, setRegName] = useState('');
  const [regKick, setRegKick] = useState('');
  const [regDisc, setRegDisc] = useState('');
  const [regPin, setRegPin] = useState<string[]>(['', '', '', '', '', '']);
  const [regPin2, setRegPin2] = useState<string[]>(['', '', '', '', '', '']);
  const [showRegPin, setShowRegPin] = useState(false);
  const [showRegPin2, setShowRegPin2] = useState(false);
  const [isRegLoading, setIsRegLoading] = useState(false);
  const [regPinBad, setRegPinBad] = useState(false);
  const [regPin2Bad, setRegPin2Bad] = useState(false);

  // Verify State
  const [pendingUser, setPendingUser] = useState<{
    name: string;
    kick: string;
    disc: string;
    pin: string;
    avatar: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState(`${CODE_PREFIX}000000`);
  const [verifyLeft, setVerifyLeft] = useState(VERIFY_WINDOW);
  const [verifyCopied, setVerifyCopied] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [verifyExpired, setVerifyExpired] = useState(false);
  // حالة اتصال الشات + آخر الرسائل الظاهرة للعضو وهو يرسل الكود
  const [chatState, setChatState] = useState<'connected' | 'connecting' | 'down'>('connecting');
  const chatLive = chatState === 'connected';
  const [chatFeed, setChatFeed] = useState<{ id: string; user: string; text: string; avatar: string; at: number; mine: boolean }[]>([]);
  const verifyRef = useRef<{ code: string; kick: string; deadline: number; done: boolean }>({ code: '', kick: '', deadline: 0, done: false });

  // Admin Form
  const [adminPin, setAdminPin] = useState<string[]>(['', '', '', '', '', '']);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminPinBad, setAdminPinBad] = useState(false);
  // Biometric Scan
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanHint, setScanHint] = useState('اضغط على البصمة للمسح');
  const scanRaf = useRef<number | null>(null);
  const scanStartRef = useRef<number>(0);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastGood, setToastGood] = useState(false);
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  // Audio & Canvas Refs
  const scanSound = useRef<HTMLAudioElement | null>(null);
  const successSound = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Input Refs
  const loginInputs = useRef<(HTMLInputElement | null)[]>([]);
  const regInputs = useRef<(HTMLInputElement | null)[]>([]);
  const regInputs2 = useRef<(HTMLInputElement | null)[]>([]);
  const adminInputs = useRef<(HTMLInputElement | null)[]>([]);

  const showToast = useCallback((msg: string, good = false) => {
    setToastMsg(msg);
    setToastGood(good);
    setToastShow(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastShow(false);
    }, 3200);
  }, []);

  // Initialize sounds
  useEffect(() => {
    scanSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/228/228-preview.mp3');
    successSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3');
  }, []);

  // قفل المحاولات + قراءة حالة القفل — بلا أي سرّ في المتصفح:
  // كلمات السر تُفحص في السيرفر وحده (لأنها تُقرأ من app_config بسرّ الخدمة).
  useEffect(() => {
    try {
      const lockRaw = localStorage.getItem(`auth_lock_${storageKey}`);
      if (lockRaw) {
        const lock = JSON.parse(lockRaw);
        if (lock.until > Date.now()) setLockedUntil(lock.until);
        if (typeof lock.fails === 'number') setFails(lock.fails);
      }
    } catch (e) {}
  }, [storageKey]);

  // Golden floating embers animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const particles: { x: number; y: number; r: number; v: number; d: number; a: number }[] = [];
    const makeP = (bottom = false) => ({
      x: Math.random() * w,
      y: bottom ? h + 10 : Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      v: Math.random() * 0.4 + 0.15,
      d: Math.random() * Math.PI * 2,
      a: Math.random() * 0.6 + 0.2
    });

    for (let i = 0; i < 70; i++) particles.push(makeP());

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.y -= p.v;
        p.d += 0.012;
        p.x += Math.sin(p.d) * 0.35;
        if (p.y < -10) Object.assign(p, makeP(true));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, ${(170 + p.r * 30) | 0}, 90, ${p.a * (0.6 + 0.4 * Math.sin(p.d * 3))})`;
        ctx.shadowColor = '#ff9a4d';
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // View transition helper
  const navigateTo = useCallback((target: ViewName) => {
    setAnimClass('out');
    setTimeout(() => {
      setCurView(target);
      setAnimClass('on');
    }, 330);
  }, []);

  const registerFail = () => {
    const next = fails + 1;
    setFails(next);
    if (next >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCK_MS;
      setLockedUntil(until);
      try {
        localStorage.setItem(`auth_lock_${storageKey}`, JSON.stringify({ until, fails: 0 }));
      } catch (e) {}
      setFails(0);
    } else {
      try {
        localStorage.setItem(`auth_lock_${storageKey}`, JSON.stringify({ until: 0, fails: next }));
      } catch (e) {}
    }
  };

  const clearFails = () => {
    setFails(0);
    setLockedUntil(0);
    try {
      localStorage.removeItem(`auth_lock_${storageKey}`);
    } catch (e) {}
  };

  // Generic 6-box PIN input change handler
  const handlePinChange = (
    val: string,
    idx: number,
    arr: string[],
    setArr: (a: string[]) => void,
    inputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>,
    onComplete?: (code: string) => void
  ) => {
    const char = val.slice(-1).replace(/[^A-Za-z0-9]/g, '');
    const updated = [...arr];
    updated[idx] = char;
    setArr(updated);

    if (char && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
    const full = updated.join('');
    if (full.length === 6 && onComplete) {
      // إرسال تلقائياً عند اكتمال 6 خانات
      setTimeout(() => onComplete(full), 50);
    }
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    arr: string[],
    inputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !arr[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePinPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    setArr: (a: string[]) => void,
    inputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>,
    onComplete?: (code: string) => void
  ) => {
    e.preventDefault();
    const paste = (e.clipboardData.getData('text') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
    const updated = ['', '', '', '', '', ''];
    for (let i = 0; i < paste.length; i++) {
      updated[i] = paste[i];
    }
    setArr(updated);
    const nextIdx = Math.min(paste.length, 5);
    inputsRef.current[nextIdx]?.focus();
    if (paste.length === 6 && onComplete) {
      onComplete(paste);
    }
  };

  // --- 1. USER LOGIN ---
  /* التحقق كله في السيرفر: المتصفح لا يقرأ تجزئات كلمة السر من القاعدة ولا
     يقارنها بنفسه — يستدعي /api/auth/login فيقبل أو يرفض. */
  const handleLoginSubmit = async (pinOverride?: string) => {
    const user = loginUser.trim().toLowerCase();
    const p = (pinOverride !== undefined ? pinOverride : loginPin.join('')).trim();

    if (!user) {
      showToast('اكتب اسم المستخدم في Kick');
      document.getElementById('l-user')?.focus();
      return;
    }
    if (p.length === 0) {
      setLoginPinBad(true);
      setTimeout(() => setLoginPinBad(false), 600);
      showToast('أدخل كلمة السر');
      return;
    }

    setIsLoginLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: p }),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.user) {
        setLoginPinBad(true);
        setTimeout(() => setLoginPinBad(false), 600);
        showToast(j?.error || 'اسم المستخدم أو كلمة السر غير صحيحة');
        setIsLoginLoading(false);
        return;
      }

      const data = j.user;

      // مفتاح اللعبة: تجزئة كلمة سر هذا الحساب وحده — من السيرفر، لصاحبه فقط
      if (j.game_key) {
        localStorage.setItem('iabs_game_key', String(j.game_key));
        localStorage.setItem('iabs_game_key_for', user);
      }

      localStorage.setItem(
        'iabs_user',
        JSON.stringify({
          id: data.id,
          display_name: data.display_name || user,
          kick_username: data.kick_username,
          avatar: data.avatar || undefined,
          points: data.points || 0
        })
      );

      clearFails();
      setRole('user');
      navigateTo('scan');
    } catch (err: any) {
      setLoginPinBad(true);
      setTimeout(() => setLoginPinBad(false), 600);
      showToast(err.message || 'حدث خطأ في تسجيل الدخول');
    } finally {
      setIsLoginLoading(false);
    }
  };

  // --- 2. REGISTRATION ---
  const handleRegisterSubmit = async () => {
    const name = regName.trim();
    const kick = normKick(regKick);
    const disc = regDisc.trim();
    const p = regPin.join('');
    const p2 = regPin2.join('');

    if (!kick) {
      showToast('حساب Kick مطلوب');
      document.getElementById('r-kick')?.focus();
      return;
    }
    if (p.length < 6) {
      setRegPinBad(true);
      setTimeout(() => setRegPinBad(false), 600);
      showToast('كلمة السر لازم تكون 6 أحرف أو أرقام');
      return;
    }
    if (p !== p2) {
      setRegPin2Bad(true);
      setTimeout(() => setRegPin2Bad(false), 600);
      showToast('كلمتا السر غير متطابقتين');
      return;
    }

    setIsRegLoading(true);
    try {
      // Check if user already exists
      const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('kick_username', kick)
        .maybeSingle();

      if (exists) {
        showToast('هذا الحساب مسجّل مسبقاً');
        setIsRegLoading(false);
        return;
      }

      // Try fetching kick avatar
      let kickAvatar = '';
      try {
        const fetchedAvatar = await chatService.fetchKickAvatar(kick);
        if (fetchedAvatar) kickAvatar = fetchedAvatar;
      } catch (e) {}

      await beginVerification(
        { name: name || kick, kick, disc, avatar: kickAvatar },
        p
      );
      navigateTo('verify');
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsRegLoading(false);
    }
  };

  // --- 3. VERIFICATION ---
  /**
   * جلسة تحقق واحدة: كود + مهلة مطلقة + نسخة محفوظة.
   * الحفظ ضروري لأن العضو يطلع من الصفحة يمسح الكود في شات كيك — يرجع
   * فيجدها معادة فتح على أول الصفحة والكود اللي في يده ما عاد له وجود.
   */
  const beginVerification = async (
    acct: { name: string; kick: string; disc: string; avatar: string },
    pin: string
  ) => {
    const code = genCode();
    const issuedAt = Date.now();
    const deadline = issuedAt + VERIFY_WINDOW * 1000;
    setPendingUser({ name: acct.name, kick: acct.kick, disc: acct.disc, pin, avatar: acct.avatar });
    setVerifyCode(code);
    setVerifyLeft(VERIFY_WINDOW);
    setVerifySuccess(false);
    setVerifyExpired(false);
    setChatFeed([]);
    verifyRef.current = { code, kick: acct.kick, deadline, done: false };
    writePendingVerify({ ...acct, pin, code, issuedAt, deadline });
    // الشات يُفتح الآن، لا بعد ما يوصل العضو شاشة التحقق: الرسالة قد تصل وهو
    // بعدُ في تبويب كيك، والاتصال الباكر يضمن إنها تُلتقط وتُخزَّن.
    void chatService.connect('icg1');
  };

  const startNewCode = () => {
    if (!pendingUser) return;
    void beginVerification(
      { name: pendingUser.name, kick: pendingUser.kick, disc: pendingUser.disc, avatar: pendingUser.avatar },
      pendingUser.pin
    );
    showToast('كود جديد — أرسله في الشات', true);
  };

  const completeVerification = async (extraAvatar?: string) => {
    if (!pendingUser || verifySuccess) return;
    setVerifySuccess(true);
    verifyRef.current.done = true;
    clearPendingVerify();
    showToast('تم التحقق من حسابك بنجاح', true);

    try {
      const finalAvatar = pendingUser.avatar || extraAvatar || '';

      /* إنشاء الحساب في السيرفر: التجزئة (scrypt) تُحسب فيه، والصف يُنشأ
         ذرّياً، والمتصفح لا يكتب في جدول المستخدمين ولا يقرأ تجزئات غيره. */
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pendingUser.name,
          username: pendingUser.kick,
          password: pendingUser.pin,
          discord: pendingUser.disc || '',
        }),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.user) {
        setVerifySuccess(false);
        showToast(j?.error || 'خطأ في استكمال التسجيل');
        return;
      }

      // الصورة تُحفظ بعد الإنشاء (السيرفر ينشئ الحساب بلا صورة)
      if (finalAvatar) {
        try {
          await supabase.from('users').update({ avatar: finalAvatar }).eq('kick_username', pendingUser.kick);
        } catch (e) {}
      }

      try {
        // الصف أنشأه السيرفر مع الحساب — هنا الصورة فقط
        await supabase.from('profiles').update({ avatar_url: finalAvatar }).eq('username', pendingUser.kick);
      } catch (e) {}

      // مفتاح اللعبة (تجزئة كلمة سر الحساب) — لصاحبه وحده
      if (j.game_key) {
        localStorage.setItem('iabs_game_key', String(j.game_key));
        localStorage.setItem('iabs_game_key_for', pendingUser.kick);
      }

      localStorage.setItem(
        'iabs_user',
        JSON.stringify({
          id: j.user.id || pendingUser.kick,
          display_name: j.user.display_name || pendingUser.name,
          kick_username: j.user.kick_username || pendingUser.kick,
          discord: pendingUser.disc || undefined,
          avatar: finalAvatar || undefined,
          points: j.user.points || 0
        })
      );
      localStorage.setItem('iabs_device_registered', 'true');

      setRole('user');
      setTimeout(() => {
        navigateTo('scan');
      }, 1500);
    } catch (e: any) {
      setVerifySuccess(false);
      showToast('خطأ في استكمال التسجيل');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(verifyCode);
      setVerifyCopied(true);
      setTimeout(() => setVerifyCopied(false), 2000);
    } catch (e) {}
  };

  /**
   * المستمع مربوط من لحظة إصدار الكود وما يُلغى بتغيير الشاشة: العضو يطلع
   * يمسح الكود في تبويب كيك ويرجع، فالرسالة تصل والصفحة مخفية أو وهو في
   * شاشة أخرى. كل القراءة من verifyRef — ما في كود قديم محبوس في الإغلاق.
   */
  const completeRef = useRef<((avatar?: string) => Promise<void>) | null>(null);
  useEffect(() => {
    completeRef.current = completeVerification;
  });

  useEffect(() => {
    const matchOne = (msg: any, fromBuffer: boolean): boolean => {
      const v = verifyRef.current;
      if (!v.code || v.done || Date.now() > v.deadline) return false;
      const want = normCode(v.code);
      const got = normCode(msg?.content);
      if (!want || !got || !(got === want || got.includes(want))) return false;
      if (normKick(msg?.user?.username) === normKick(v.kick)) {
        void completeRef.current?.(msg?.user?.avatar);
        return true;
      }
      if (!fromBuffer) showToast(`الكود أرسله (${msg?.user?.username}) وليس (${v.kick})`);
      return false;
    };

    const syncFeed = () => {
      const v = verifyRef.current;
      if (!v.code || v.done) return;
      const tail = chatService.getRecentMessages().slice(-FEED_SIZE);
      setChatFeed(tail.map((m) => ({
        id: String(m.id ?? m.timestamp ?? ''),
        user: m.user?.username || 'عضو',
        text: String(m.content || '').slice(0, 120),
        avatar: m.user?.avatar || '',
        at: m.timestamp || 0,
        mine: normKick(m.user?.username) === normKick(v.kick),
      })));
    };

    const scanBuffer = () => {
      const list = chatService.getRecentMessages();
      for (let i = list.length - 1; i >= 0; i--) {
        if (matchOne(list[i], true)) return true;
      }
      return false;
    };

    /** رسالة حيّة تصل: حدّث الواجهة ثم افحص المخزن كله — المخزن أضمن من رسالة */
    const offMessage = chatService.onMessage(() => {
      if (!verifyRef.current.code || verifyRef.current.done) return;
      syncFeed();
      scanBuffer();
    });

    const offStatus = chatService.onStatusChange((ok) => {
      setChatState(ok ? 'connected' : 'connecting');
    });

    /** الحالة من الاتصال نفسه، مش من عدّاد متوهّم — والتبيش ما يجمّد الوقت */
    const tick = setInterval(() => {
      const v = verifyRef.current;
      if (!v.code || v.done) return;
      const left = Math.max(0, Math.ceil((v.deadline - Date.now()) / 1000));
      setVerifyLeft(left);
      if (left === 0) {
        setVerifyExpired(true);
        clearPendingVerify();
        return;
      }
      const st = chatService.connectionState();
      setChatState(st);
      if (st === 'down') void chatService.connect('icg1');
      if (scanBuffer()) return;
      syncFeed();
    }, 1000);

    /** رجوع للتبويب = إعادة اتصال لو انقطع + فحص كل ما وصل في الغياب */
    const onBack = () => {
      if (document.visibilityState === 'hidden') return;
      const v = verifyRef.current;
      if (!v.code || v.done) return;
      if (chatService.connectionState() === 'down') void chatService.connect('icg1');
      syncFeed();
      scanBuffer();
    };

    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    onBack();

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      offMessage();
      offStatus();
    };
  }, []);

  const retryChatNow = () => {
    setChatState('connecting');
    if (chatService.connectionState() === 'down') void chatService.connect('icg1');
    else chatService.reconnect();
  };

  // المقسم يتابع أحدث رسالة: العضو لازم يشوف رسالته وصلت، مو أول ست قديمة
  const feedBox = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = feedBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatFeed]);

  // الطلب المعلّق من جولة سابقة؟ الرجوع من تبويب كيك أو إعادة فتح الصفحة ما
  // لازم ترمي العضو في أول الشاشة والكود اللي في يده صار بلا معنى.
  useEffect(() => {
    const p = readPendingVerify();
    if (!p || adminOnly) return;
    const left = Math.max(0, Math.ceil((p.deadline - Date.now()) / 1000));
    if (left <= 0) {
      clearPendingVerify();
      return;
    }
    setPendingUser({ name: p.name, kick: p.kick, disc: p.disc, pin: p.pin, avatar: p.avatar });
    setVerifyCode(p.code);
    setVerifyLeft(left);
    setVerifySuccess(false);
    setVerifyExpired(false);
    verifyRef.current = { code: p.code, kick: p.kick, deadline: p.deadline, done: false };
    setCurView('verify');
    void chatService.connect('icg1');
  }, [adminOnly]);

  // --- 4. ADMIN LOGIN ---
  /* البوابة تتكلم مع السيرفر وحده:
     - بوابة الإدارة (/api/admin/login): كلمة السر تُفحص هناك، والجواب-session
       (كوكي HttpOnly) هو ما يفتح لوحة التحكم.
     - بوابة المستضيف (/api/auth/config-check): نعم/لا فقط.
     كلمة السر لا تُقرأ من app_config في المتصفح أبداً. */
  const handleAdminSubmit = async (pinOverride?: string) => {
    if (Date.now() < lockedUntil) {
      showToast(`تم القفل مؤقتاً — انتظر ${Math.ceil((lockedUntil - Date.now()) / 1000)} ثانية`);
      return;
    }

    const c = (pinOverride !== undefined ? pinOverride : adminPin.join('')).trim();
    if (c.length === 0) {
      setAdminPinBad(true);
      setTimeout(() => setAdminPinBad(false), 600);
      showToast('أدخل كلمة المرور');
      return;
    }

    setIsAdminLoading(true);
    try {
      const url = adminOnly ? '/api/auth/config-check' : '/api/admin/login';
      const payload = adminOnly
        ? { key: configKey, fallback_key: fallbackConfigKey || undefined, password: c }
        : { password: c };

      const r = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      const valid = adminOnly ? (r.ok && j?.ok === true) : (r.ok && !!j?.staff);

      if (valid) {
        clearFails();
        setRole('admin');
        navigateTo('scan');
      } else {
        registerFail();
        setAdminPinBad(true);
        setTimeout(() => {
          setAdminPinBad(false);
          setAdminPin(['', '', '', '', '', '']);
          adminInputs.current[0]?.focus();
        }, 600);
        showToast(j?.error || 'رمز القيادة غير صحيح');
      }
    } catch (e: any) {
      showToast(e.message || 'خطأ في التحقق من كلمة السر');
    } finally {
      setIsAdminLoading(false);
    }
  };

  // --- 5. BIOMETRIC SCAN ---
  const startScan = (e?: React.PointerEvent<HTMLDivElement> | React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      try { (e.currentTarget as any)?.setPointerCapture?.((e as any).pointerId); } catch {}
    }
    if (scanRaf.current) return;
    setIsScanning(true);
    setScanHint('جارٍ المسح…');
    scanStartRef.current = performance.now();

    if (scanSound.current) {
      scanSound.current.currentTime = 0;
      scanSound.current.play().catch(() => {});
    }

    const step = () => {
      const p = Math.min((performance.now() - scanStartRef.current) / 1100, 1);
      setScanProgress(p);
      if (p >= 1) {
        stopScan(true);
        return;
      }
      scanRaf.current = requestAnimationFrame(step);
    };
    scanRaf.current = requestAnimationFrame(step);
  };

  const stopScan = (done: boolean) => {
    if (scanRaf.current) {
      cancelAnimationFrame(scanRaf.current);
      scanRaf.current = null;
    }
    setIsScanning(false);

    if (done) {
      setScanHint('تم التعرف ✓');
      if (successSound.current) {
        successSound.current.currentTime = 0;
        successSound.current.play().catch(() => {});
      }
      if (navigator.vibrate) navigator.vibrate(60);
      setTimeout(() => {
        navigateTo('ok');
      }, 450);
    } else {
      setScanProgress(0);
      setScanHint('اضغط على البصمة للمسح');
    }
  };

  // --- 6. SUCCESS (OK) ---
  useEffect(() => {
    if (curView === 'ok') {
      window.dispatchEvent(new CustomEvent('icg1:authorized', { detail: { role } }));
      (async () => {
        // الجلسة المحلية علامة تنفيس فقط — الصلاحيات الحقيقية في كوكي السيرفر
        const session = await buildSession(role);
        localStorage.setItem(storageKey, JSON.stringify(session));
      })();

      const timer = setTimeout(() => {
        onSuccess(role);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [curView, role, storageKey, onSuccess]);

  const bodyMoodClass = curView === 'verify' ? 'red' : curView === 'ok' ? 'green' : '';

  return (
    <div className={`auth-root ${bodyMoodClass}`} dir="rtl">
      {/* SVG Icon Defs matching icg1-auth.html */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <symbol id="lock" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2.5" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16.5" r="1.2" />
          </symbol>
          <symbol id="unlock" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2.5" />
            <g className="shk">
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </g>
            <circle cx="12" cy="16.5" r="1.2" />
          </symbol>
          <symbol id="user" viewBox="0 0 24 24">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </symbol>
          <symbol id="userplus" viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </symbol>
          <symbol id="eye" viewBox="0 0 24 24">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </symbol>
          <symbol id="eyeoff" viewBox="0 0 24 24">
            <path d="M9.9 9.9a3 3 0 1 0 4.2 4.2M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20" />
          </symbol>
          <symbol id="shield" viewBox="0 0 24 24">
            <path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </symbol>
          <symbol id="copy" viewBox="0 0 24 24">
            <rect x="8" y="8" width="14" height="14" rx="2.5" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </symbol>
          <symbol id="check" viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
          </symbol>
          <symbol id="arrow" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </symbol>
          <symbol id="arrowr" viewBox="0 0 24 24">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </symbol>
          <symbol id="crown" viewBox="0 0 24 24">
            <path d="m2 5 4 6 6-8 6 8 4-6-2 13H4z" />
            <path d="M5 21h14" />
          </symbol>
          <symbol id="clock" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 7v5l3 2" />
          </symbol>
          <symbol id="refresh" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
          </symbol>
          <symbol id="alert" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 8v4.5M12 16h.01" />
          </symbol>
          <symbol id="chat" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </symbol>
          <symbol id="disc" viewBox="0 0 24 24">
            <path d="M20 5a16 16 0 0 0-4-1.2l-.5 1a14 14 0 0 0-7 0l-.5-1A16 16 0 0 0 4 5C1.8 8.5 1.2 12 1.5 15.5A16 16 0 0 0 6.3 18l1-1.6a10 10 0 0 1-1.5-.8l.4-.3a11 11 0 0 0 11.6 0l.4.3a10 10 0 0 1-1.5.8l1 1.6a16 16 0 0 0 4.8-2.5C23 12 22.3 8.5 20 5Z" />
            <circle cx="9" cy="12" r="1.3" />
            <circle cx="15" cy="12" r="1.3" />
          </symbol>
          <symbol id="fp" viewBox="0 0 24 24">
            <path d="M12 10a2 2 0 0 0-2 2c0 1-.1 2.5-.3 4M14 13.1c0 2.4 0 6.4-1 8.9M17.3 21c.1-.6.4-2.3.5-3M2 12a10 10 0 0 1 18-6M2 16h.01M21.8 16c.2-2 .1-5.4 0-6M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .3-2M8.7 22c.2-.7.4-1.3.6-2M9 6.8a6 6 0 0 1 9 5.2v2" />
          </symbol>
          <symbol id="spark" viewBox="0 0 24 24">
            <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
          </symbol>
        </defs>
      </svg>

      {/* Atmospheric Backgrounds & Canvas */}
      <div className="bg"></div>
      <div className="glow"></div>
      <canvas id="fx" ref={canvasRef}></canvas>
      <div className="vig"></div>

      {/* Toast Alert - Luxury gold theme with zero red boxes */}
      {toastShow && (
        <div id="toast" role="status" className={`show ${toastGood ? 'good' : 'warn'}`}>
          <svg className="i" style={{ fontSize: '20px', color: toastGood ? 'var(--ok)' : 'var(--gold)' }}>
            <use href={`#${toastGood ? 'check' : 'alert'}`} />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}

      <main className="auth-main">
        {/* ================= 1. LOGIN VIEW ================= */}
        {curView === 'login' && (
          <section className={`view ${animClass}`} id="v-login">
            <div className="emb">
              <svg className="i"><use href="#lock" /></svg>
            </div>
            <h1 className="ttl">{title || 'بروتوكول الأمان'}</h1>
            <div className="sub">{subtitle || 'RESTRICTED ACCESS AREA'}</div>
            <div className="panel">
              <label className="f">
                <span><i className="k">K</i> حساب Kick</span>
                <div className="in">
                  <svg className="i ic"><use href="#user" /></svg>
                  <input
                    id="l-user"
                    placeholder="اسم المستخدم"
                    autoComplete="username"
                    autoCapitalize="off"
                    spellCheck="false"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loginInputs.current[0]?.focus()}
                  />
                </div>
              </label>

              <div className="f">
                <span>
                  <svg className="i"><use href="#lock" /></svg> كلمة السر <em>6 أحرف أو أرقام</em>
                </span>
                <div className="pinw">
                  <div className={`pin ${loginPinBad ? 'bad' : ''}`} id="l-pin">
                    {loginPin.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { loginInputs.current[idx] = el; }}
                        type={showLoginPin ? 'text' : 'password'}
                        maxLength={1}
                        autoComplete="off"
                        aria-label={`الخانة ${idx + 1}`}
                        value={val}
                        className={val ? 'fill' : ''}
                        onChange={(e) =>
                          handlePinChange(e.target.value, idx, loginPin, setLoginPin, loginInputs, handleLoginSubmit)
                        }
                        onKeyDown={(e) => {
                          handlePinKeyDown(e, idx, loginPin, loginInputs);
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleLoginSubmit();
                          }
                        }}
                        onPaste={(e) => handlePinPaste(e, setLoginPin, loginInputs, handleLoginSubmit)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setShowLoginPin(!showLoginPin)}
                    aria-label="إظهار كلمة السر"
                  >
                    <svg className="i">
                      <use href={showLoginPin ? '#eyeoff' : '#eye'} />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                type="button"
                className={`btn gold ${isLoginLoading ? 'load' : ''}`}
                id="l-go"
                style={{ marginTop: '22px' }}
                onClick={() => void handleLoginSubmit()}
                disabled={isLoginLoading}
              >
                <span className="sp"></span>
                <span className="t">دخول</span>
                <svg className="i"><use href="#arrow" /></svg>
              </button>
            </div>

            <div className="row">
              <button type="button" className="ghost" onClick={() => navigateTo('register')}>
                <svg className="i"><use href="#userplus" /></svg> ليس لديك حساب؟ <b>سجّل الآن</b>
              </button>
              {!adminOnly && (
                <button type="button" className="admin" onClick={() => navigateTo('admin')}>
                  <svg className="i"><use href="#crown" /></svg> انت منصور ؟؟؟
                </button>
              )}
            </div>
          </section>
        )}

        {/* ================= 2. REGISTER VIEW ================= */}
        {curView === 'register' && (
          <section className={`view ${animClass}`} id="v-register">
            <button type="button" className="ghost back" onClick={() => navigateTo('login')}>
              <svg className="i"><use href="#arrowr" /></svg> العودة
            </button>
            <div className="emb gold">
              <svg className="i"><use href="#userplus" /></svg>
            </div>
            <h1 className="ttl">إنشاء حساب</h1>
            <div className="sub">CREATE YOUR ACCOUNT</div>
            <div className="panel">
              <label className="f">
                <span><svg className="i"><use href="#user" /></svg> الاسم</span>
                <div className="in">
                  <input
                    id="r-name"
                    placeholder="اسمك المعروض"
                    maxLength={24}
                    autoComplete="nickname"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                </div>
              </label>

              <label className="f">
                <span><i className="k">K</i> حساب Kick <em>* مطلوب</em></span>
                <div className="in">
                  <input
                    id="r-kick"
                    placeholder="اسم المستخدم في Kick"
                    autoCapitalize="off"
                    spellCheck="false"
                    autoComplete="off"
                    value={regKick}
                    onChange={(e) => setRegKick(e.target.value)}
                  />
                </div>
              </label>

              <label className="f">
                <span><svg className="i"><use href="#disc" /></svg> ديسكورد <em>(اختياري)</em></span>
                <div className="in">
                  <input
                    id="r-disc"
                    dir="ltr"
                    placeholder="username#0000"
                    autoCapitalize="off"
                    autoComplete="off"
                    value={regDisc}
                    onChange={(e) => setRegDisc(e.target.value)}
                  />
                </div>
              </label>

              <div className="f">
                <span>
                  <svg className="i"><use href="#lock" /></svg> كلمة السر <em>6 أحرف أو أرقام</em>
                </span>
                <div className="pinw">
                  <div className={`pin ${regPinBad ? 'bad' : ''}`} id="r-pin">
                    {regPin.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { regInputs.current[idx] = el; }}
                        type={showRegPin ? 'text' : 'password'}
                        maxLength={1}
                        autoComplete="off"
                        aria-label={`الخانة ${idx + 1}`}
                        value={val}
                        className={val ? 'fill' : ''}
                        onChange={(e) => handlePinChange(e.target.value, idx, regPin, setRegPin, regInputs)}
                        onKeyDown={(e) => handlePinKeyDown(e, idx, regPin, regInputs)}
                        onPaste={(e) => handlePinPaste(e, setRegPin, regInputs)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setShowRegPin(!showRegPin)}
                    aria-label="إظهار"
                  >
                    <svg className="i">
                      <use href={showRegPin ? '#eyeoff' : '#eye'} />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="f">
                <span>
                  <svg className="i"><use href="#shield" /></svg> تأكيد كلمة السر
                </span>
                <div className="pinw">
                  <div className={`pin ${regPin2Bad ? 'bad' : ''}`} id="r-pin2">
                    {regPin2.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { regInputs2.current[idx] = el; }}
                        type={showRegPin2 ? 'text' : 'password'}
                        maxLength={1}
                        autoComplete="off"
                        aria-label={`الخانة ${idx + 1}`}
                        value={val}
                        className={val ? 'fill' : ''}
                        onChange={(e) => handlePinChange(e.target.value, idx, regPin2, setRegPin2, regInputs2)}
                        onKeyDown={(e) => handlePinKeyDown(e, idx, regPin2, regInputs2)}
                        onPaste={(e) => handlePinPaste(e, setRegPin2, regInputs2)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setShowRegPin2(!showRegPin2)}
                    aria-label="إظهار"
                  >
                    <svg className="i">
                      <use href={showRegPin2 ? '#eyeoff' : '#eye'} />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                type="button"
                className={`btn gold ${isRegLoading ? 'load' : ''}`}
                id="r-go"
                style={{ marginTop: '8px' }}
                onClick={handleRegisterSubmit}
                disabled={isRegLoading}
              >
                <span className="sp"></span>
                <span className="t">متابعة</span>
                <svg className="i"><use href="#arrow" /></svg>
              </button>
            </div>
          </section>
        )}

        {/* ================= 3. VERIFY VIEW ================= */}
        {curView === 'verify' && pendingUser && (
          <section className={`view ${animClass}`} id="v-verify">
            <button type="button" className="ghost back" onClick={() => { clearPendingVerify(); navigateTo('register'); }}>
              <svg className="i"><use href="#arrowr" /></svg> العودة
            </button>
            <div className="emb gold">
              <svg className="i"><use href="#chat" /></svg>
            </div>
            <h1 className="ttl">مصادقة Kick</h1>
            <div className="sub">KICK CHAT VERIFICATION</div>
            <div className="panel">
              <div className="usr">
                <div className="av">
                  {pendingUser.avatar ? (
                    <img src={pendingUser.avatar} alt={pendingUser.kick} />
                  ) : (
                    <svg className="i"><use href="#user" /></svg>
                  )}
                </div>
                <div>
                  <b id="vu-name">{pendingUser.name || pendingUser.kick}</b>
                  <span>Kick.com/@{pendingUser.kick}</span>
                </div>
                <span className="k">K</span>
              </div>

              <div className="steps">
                <div className="step">
                  <i>1</i> افتح شات القناة في Kick
                </div>
                <div className="step">
                  <i>2</i> أرسل الكود التالي بالضبط:
                </div>
              </div>

              <div className="code">
                <small>كود التحقق</small>
                <div className="cv" id="v-code">
                  <b>{verifyCode.slice(0, CODE_PREFIX.length)}</b>
                  {verifyCode.slice(CODE_PREFIX.length)}
                </div>
                <button
                  type="button"
                  className={`cp ${verifyCopied ? 'done' : ''}`}
                  id="v-copy"
                  onClick={handleCopyCode}
                >
                  <svg className="i">
                    <use href={verifyCopied ? '#check' : '#copy'} />
                  </svg>
                  <span>{verifyCopied ? 'تم النسخ' : 'نسخ الكود'}</span>
                </button>
                <div className="bar">
                  <i
                    id="v-bar"
                    style={{
                      transform: `scaleX(${Math.max(verifyLeft, 0) / VERIFY_WINDOW})`,
                      transition: 'transform 1s linear'
                    }}
                  ></i>
                </div>
                <div className="tm">
                  <svg className="i"><use href="#clock" /></svg>
                  <span id="v-time">
                    {Math.floor(verifyLeft / 60)}:{String(verifyLeft % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div
                className={`wait ${verifySuccess ? 'ok' : ''} ${chatLive ? 'live-on' : 'live-off'}`}
                id="v-wait"
              >
                {!verifySuccess && <span className="sp2"></span>}
                <span className="ldot" aria-hidden="true"></span>
                <span id="v-msg">
                  {verifySuccess ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <svg className="i" style={{ fontSize: '20px' }}><use href="#check" /></svg> تم التحقق من حسابك
                    </span>
                  ) : verifyExpired ? (
                    'انتهى الكود – اطلب كود جديد'
                  ) : chatLive ? (
                    'الشات متصل – بانتظار رسالتك…'
                  ) : chatState === 'connecting' ? (
                    'جاري الاتصال بالشات…'
                  ) : (
                    'الشات منقطع – الكود ما يضيع'
                  )}
                </span>
                {!chatLive && !verifySuccess && !verifyExpired && (
                  <button type="button" className="mini" id="v-retry" onClick={retryChatNow}>
                    <svg className="i"><use href="#refresh" /></svg> إعادة
                  </button>
                )}
              </div>

              <div className="feed" id="v-feed">
                <div className="fh">
                  <b>
                    <svg className="i"><use href="#chat" /></svg> آخر الشات
                  </b>
                  <span>رسالتك تظهر هنا لحظة وصولها</span>
                </div>
                {chatFeed.length === 0 ? (
                  <div className="fempty" id="v-feed-empty">
                    {chatLive
                      ? 'الشات ساكن لحظة… ارسل الكود وبنلقطه من هنا'
                      : 'ماوصلت رسائل بعد — أول ما الاتصال يخلص تظهر آخر الشات'}
                  </div>
                ) : (
                  <div className="flist" ref={feedBox}>
                    {chatFeed.map((m) => (
                      <div key={m.id} className={`fe ${m.mine ? 'mine' : ''}`}>
                        <span className="fava">
                          {m.avatar ? (
                            <img src={m.avatar} alt="" loading="lazy" />
                          ) : (
                            <svg className="i"><use href="#user" /></svg>
                          )}
                        </span>
                        <div className="fb">
                          <b>{m.user}</b>
                          <p>{m.text}</p>
                        </div>
                        <span className="ft">{agoText(m.at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="row" style={{ marginTop: '12px' }}>
                <button type="button" className="ghost" id="v-new" onClick={startNewCode}>
                  <svg className="i"><use href="#refresh" /></svg> {verifyExpired ? 'كود جديد' : 'كود غير هذا'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================= 4. ADMIN VIEW ================= */}
        {curView === 'admin' && (
          <section className={`view ${animClass}`} id="v-admin">
            {!adminOnly && (
              <button type="button" className="ghost back" onClick={() => navigateTo('login')}>
                <svg className="i"><use href="#arrowr" /></svg> العودة لتسجيل المستخدم
              </button>
            )}
            <div className="emb">
              <svg className="i"><use href="#crown" /></svg>
            </div>
            <h1 className="ttl">{title || 'بروتوكول القائد'}</h1>
            <div className="sub">{subtitle || 'RESTRICTED COMMAND INTERFACE'}</div>
            <div className="panel" style={{ textAlign: 'center' }}>
              <p className="mut" style={{ marginBottom: '18px' }}>
                أدخل رمز القيادة المكوّن من 6 خانات
              </p>
              <div className="pinw">
                <div className={`pin ${adminPinBad ? 'bad' : ''}`} id="a-pin">
                  {adminPin.map((val, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { adminInputs.current[idx] = el; }}
                      type={showAdminPin ? 'text' : 'password'}
                      maxLength={1}
                      autoComplete="off"
                      aria-label={`الخانة ${idx + 1}`}
                      value={val}
                      className={val ? 'fill' : ''}
                      onChange={(e) =>
                        handlePinChange(e.target.value, idx, adminPin, setAdminPin, adminInputs, handleAdminSubmit)
                      }
                      onKeyDown={(e) => {
                        handlePinKeyDown(e, idx, adminPin, adminInputs);
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdminSubmit();
                        }
                      }}
                      onPaste={(e) => handlePinPaste(e, setAdminPin, adminInputs, handleAdminSubmit)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowAdminPin(!showAdminPin)}
                  aria-label="إظهار"
                >
                  <svg className="i">
                    <use href={showAdminPin ? '#eyeoff' : '#eye'} />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                className={`btn gold ${isAdminLoading ? 'load' : ''}`}
                id="a-go"
                style={{ marginTop: '24px' }}
                onClick={() => void handleAdminSubmit()}
                disabled={isAdminLoading}
              >
                <span className="sp"></span>
                <span className="t">فتح الواجهة</span>
                <svg className="i"><use href="#arrow" /></svg>
              </button>
            </div>
          </section>
        )}

        {/* ================= 5. BIOMETRIC SCAN VIEW ================= */}
        {curView === 'scan' && (
          <section className={`view ${animClass}`} id="v-scan">
            <button type="button" className="ghost back" onClick={() => navigateTo(adminOnly ? 'admin' : 'login')}>
              <svg className="i"><use href="#arrowr" /></svg> العودة
            </button>
            <h1 className="ttl">تسجيل الدخول</h1>
            <div className="sub" style={{ color: '#b98d4c' }}>
              BIOMETRIC VERIFICATION
            </div>
            <div className="fpw">
              <div
                className="ring"
                id="ring"
                style={{
                  background: `conic-gradient(var(--gold) ${scanProgress * 360}deg, rgba(236,194,116,.14) 0deg)`
                }}
              ></div>
              <div
                className={`pad ${isScanning ? 'hold' : ''}`}
                id="pad"
                role="button"
                tabIndex={0}
                aria-label="اضغط على البصمة للمسح"
                onClick={startScan}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startScan(e);
                }}
              >
                <svg className="i"><use href="#fp" /></svg>
              </div>
            </div>
            <span className="hint" id="hint">
              {scanHint}
            </span>
          </section>
        )}

        {/* ================= 6. ACCESS GRANTED VIEW ================= */}
        {curView === 'ok' && (
          <section className={`view ${animClass}`} id="v-ok">
            <div className="lk">
              <svg className="i"><use href="#unlock" /></svg>
            </div>
            <h1 className="ttl">أهلاً بك</h1>
            <div className="sub">ACCESS AUTHORIZED</div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="auth-footer">
        <b>
          <svg className="i" style={{ fontSize: '18px', color: 'var(--gold)' }}>
            <use href="#spark" />
          </svg>
          iCG1 – دخول آمن
        </b>
        <small>BUILD_REF: {new Date().toLocaleDateString()} | v2.0.5</small>
      </footer>

      {/* Embedded CSS matching icg1-auth.html exactly */}
      <style>{`
        .auth-root {
          --gold: #ecc274;
          --gold2: #b9873c;
          --bronze: #6e4a24;
          --ink: #0b0705;
          --panel: rgba(28,18,10,.66);
          --line: rgba(236,194,116,.28);
          --txt: #f6ead3;
          --mut: #a8977c;
          --ok: #22c55e;
          --bad: #ef4444;
          --ember: #ff7a45;
          --ease: cubic-bezier(.22,1,.36,1);
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: var(--ink);
          color: var(--txt);
          font-family: Tajawal, system-ui, sans-serif;
          overflow: hidden;
          direction: rtl;
        }
        .auth-root * {
          box-sizing: border-box;
          margin: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .auth-root svg.i {
          width: 1em;
          height: 1em;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
          flex: none;
        }
        .auth-root button, .auth-root input {
          font: inherit;
          color: inherit;
        }
        .auth-root button {
          cursor: pointer;
          border: 0;
          background: none;
        }
        .auth-root :focus-visible {
          outline: 2px solid var(--gold);
          outline-offset: 3px;
        }

        /* background */
        .auth-root .bg {
          position: fixed;
          inset: 0;
          background: url(/icg1-arena-bg-v2.png) center/cover, #120b06;
          animation: kb 40s ease-in-out infinite alternate;
          filter: brightness(.8);
        }
        @keyframes kb {
          to { transform: scale(1.12) translateX(-1.5%); }
        }
        .auth-root .vig {
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at 50% 45%, transparent 25%, rgba(5,3,1,.82) 100%);
          pointer-events: none;
        }
        .auth-root .glow {
          position: fixed;
          left: 50%;
          top: 46%;
          width: 70vmin;
          height: 70vmin;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(236,150,60,.2), transparent 65%);
          filter: blur(20px);
          animation: br 6s ease-in-out infinite;
          pointer-events: none;
          transition: background 1s;
        }
        .auth-root.red .glow {
          background: radial-gradient(circle, rgba(236,150,60,.22), transparent 65%);
        }
        .auth-root.green .glow {
          background: radial-gradient(circle, rgba(34,197,94,.22), transparent 65%);
        }
        @keyframes br {
          50% { opacity: .55; transform: translate(-50%, -50%) scale(1.12); }
        }
        .auth-root #fx {
          position: fixed;
          inset: 0;
          pointer-events: none;
        }

        /* stage & views */
        .auth-root main.auth-main {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 12px 16px 50px;
          overflow: auto;
        }
        .auth-root .view {
          display: none;
          width: min(100%, 460px);
          margin: auto;
          text-align: center;
          position: relative;
        }
        .auth-root .view.on {
          display: block;
          animation: auth-in .8s var(--ease) both;
        }
        .auth-root .view.out {
          display: block;
          animation: auth-out .35s ease forwards;
          pointer-events: none;
        }
        @keyframes auth-in {
          from { opacity: 0; transform: translateY(26px) scale(.97); filter: blur(10px); }
        }
        @keyframes auth-out {
          to { opacity: 0; transform: translateY(-14px) scale(1.02); filter: blur(8px); }
        }

        /* typography */
        .auth-root .ttl {
          font-family: Lalezar, Tajawal, sans-serif;
          font-size: clamp(28px, 6vw, 42px);
          line-height: 1.15;
          display: inline-block;
          transform: skewX(-7deg);
          background: linear-gradient(100deg, #8e8a85 0%, #fff 35%, #c9c3ba 50%, #fff 65%, #8e8a85 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: auth-sh 6s linear infinite;
        }
        @keyframes auth-sh {
          to { background-position: -250% 0; }
        }
        .auth-root .sub {
          font-size: 10px;
          letter-spacing: .28em;
          color: var(--gold);
          font-weight: 700;
          margin-top: 2px;
          direction: ltr;
        }
        .auth-root .mut {
          color: var(--mut);
          font-size: 13px;
        }

        /* emblem */
        .auth-root .emb {
          width: 64px;
          height: 64px;
          margin: 0 auto 12px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: var(--gold);
          position: relative;
          background: radial-gradient(circle at 50% 35%, #3b2713, #130b05);
          box-shadow: 0 0 0 1px var(--line), 0 0 30px rgba(236,150,60,.25) inset, 0 8px 30px rgba(0,0,0,.6);
          overflow: visible;
          z-index: 1;
        }
        .auth-root .emb::before {
          content: "";
          position: absolute;
          top: -6px;
          left: -6px;
          width: calc(100% + 12px);
          height: calc(100% + 12px);
          border-radius: 50%;
          border: 1.5px dashed var(--line);
          transform-origin: center center;
          animation: auth-spin-cw 24s linear infinite;
          pointer-events: none;
          box-sizing: border-box;
        }
        .auth-root .emb::after {
          content: "";
          position: absolute;
          top: -12px;
          left: -12px;
          width: calc(100% + 24px);
          height: calc(100% + 24px);
          border-radius: 50%;
          border: 1.5px solid transparent;
          border-top-color: var(--gold);
          border-bottom-color: var(--gold2);
          transform-origin: center center;
          animation: auth-spin-ccw 4s linear infinite;
          opacity: .8;
          pointer-events: none;
          box-sizing: border-box;
        }
        .auth-root .emb.gold {
          background: linear-gradient(145deg, #f0c97f, #b4813a);
          color: #1b1006;
          box-shadow: 0 0 0 1px var(--line), 0 0 40px rgba(236,150,60,.3) inset, 0 10px 40px rgba(0,0,0,.6);
        }
        @keyframes auth-spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes auth-spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        /* panel */
        .auth-root .panel {
          margin-top: 16px;
          padding: 18px 20px;
          border-radius: 26px;
          text-align: right;
          position: relative;
          background: var(--panel);
          backdrop-filter: blur(18px) saturate(1.2);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07);
        }
        .auth-root .panel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: conic-gradient(from var(--a, 0deg), rgba(236,194,116,.08), rgba(236,194,116,.8), rgba(236,194,116,.08) 35%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: auth-ang 7s linear infinite;
          pointer-events: none;
        }
        @property --a {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes auth-ang {
          to { --a: 360deg; }
        }

        /* fields */
        .auth-root .f {
          display: block;
          margin-bottom: 10px;
        }
        .auth-root .f > span {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
          color: var(--mut);
          margin-bottom: 5px;
        }
        .auth-root .f > span em {
          font-style: normal;
          margin-inline-start: auto;
          font-size: 11px;
          color: var(--gold);
        }
        .auth-root .in {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 44px;
          padding: 0 12px;
          border-radius: 13px;
          background: rgba(10,6,3,.7);
          border: 1px solid var(--line);
          transition: .3s var(--ease);
        }
        .auth-root .in:focus-within {
          border-color: var(--gold);
          box-shadow: 0 0 0 4px rgba(236,194,116,.13), 0 0 26px rgba(236,150,60,.18);
          transform: translateY(-1px);
        }
        .auth-root .in input {
          flex: 1;
          min-width: 0;
          height: 100%;
          background: none;
          border: 0;
          outline: 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--txt);
        }
        .auth-root .in input::placeholder {
          color: #7d6f59;
        }
        .auth-root .in .ic {
          color: var(--gold);
          font-size: 19px;
        }
        .auth-root .k {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: #53fc18;
          color: #031a00;
          font-weight: 800;
          display: grid;
          place-items: center;
          font-size: 15px;
          font-family: Tajawal, sans-serif;
          flex: none;
          box-shadow: 0 0 14px rgba(83,252,24,.35);
        }
        .auth-root .kb {
          background: #53fc18;
          color: #021500;
        }

        /* pin */
        .auth-root .pinw {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          direction: ltr;
        }
        .auth-root .pin {
          display: flex;
          gap: 9px;
          direction: ltr;
        }
        .auth-root .pin input {
          width: clamp(34px, 10vw, 44px);
          height: clamp(40px, 12vw, 52px);
          text-align: center;
          font-size: 20px;
          font-weight: 700;
          border-radius: 14px;
          background: rgba(10,6,3,.75);
          border: 1px solid var(--line);
          outline: 0;
          caret-color: var(--gold);
          color: var(--txt);
          transition: .25s var(--ease);
        }
        .auth-root .pin input:focus {
          border-color: var(--gold);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(236,150,60,.25), 0 0 0 3px rgba(236,194,116,.12);
        }
        .auth-root .pin input.fill {
          border-color: var(--gold2);
          background: linear-gradient(180deg, rgba(236,194,116,.16), rgba(10,6,3,.75));
          animation: auth-pop .35s var(--ease);
        }
        @keyframes auth-pop {
          50% { transform: scale(1.12); }
        }
        .auth-root .pin.bad {
          animation: auth-shk .5s;
        }
        .auth-root .pin.bad input {
          border-color: var(--bad);
          box-shadow: 0 0 16px rgba(239,68,68,.35);
        }
        @keyframes auth-shk {
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .auth-root .eye {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          color: var(--mut);
          display: grid;
          place-items: center;
          font-size: 19px;
          transition: .25s;
        }
        .auth-root .eye:hover {
          color: var(--gold);
          background: rgba(236,194,116,.08);
        }

        /* buttons */
        .auth-root .btn {
          position: relative;
          overflow: hidden;
          width: 100%;
          height: 48px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: .3s var(--ease);
          border: 0;
          cursor: pointer;
        }
        .auth-root .gold {
          background: linear-gradient(135deg, #f3cf8a, #c0903f 55%, #9a6b2a);
          color: #1d1106;
          box-shadow: 0 10px 30px rgba(185,135,60,.35);
        }
        .auth-root .gold:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(185,135,60,.5);
        }
        .auth-root .gold:active {
          transform: scale(.98);
        }
        .auth-root .gold::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%);
          transform: translateX(-120%);
          transition: transform .7s;
        }
        .auth-root .gold:hover::after {
          transform: translateX(120%);
        }
        .auth-root .btn[disabled] {
          opacity: .7;
          pointer-events: none;
        }
        .auth-root .btn .sp {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid rgba(0,0,0,.25);
          border-top-color: #1d1106;
          animation: auth-spin .7s linear infinite;
          display: none;
        }
        .auth-root .btn.load .sp {
          display: block;
        }
        .auth-root .btn.load .t, .auth-root .btn.load > .i {
          display: none;
        }
        .auth-root .ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: var(--mut);
          background: rgba(28,18,10,.55);
          border: 1px solid var(--line);
          backdrop-filter: blur(8px);
          transition: .3s var(--ease);
          cursor: pointer;
        }
        .auth-root .ghost b {
          color: var(--gold);
        }
        .auth-root .ghost:hover {
          color: var(--txt);
          border-color: var(--gold);
          transform: translateY(-2px);
        }
        .auth-root .row {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
        }
        .auth-root .back {
          position: fixed;
          top: max(4px, env(safe-area-inset-top));
          inset-inline-start: 12px;
          z-index: 1000;
        }
        @media (max-width: 640px) {
          .auth-root .back {
            top: max(2px, env(safe-area-inset-top));
            inset-inline-start: 8px;
          }
        }
        .auth-root .admin {
          font-size: 12px;
          color: var(--gold);
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          opacity: .85;
          transition: .3s;
          cursor: pointer;
        }
        .auth-root .admin:hover {
          opacity: 1;
          text-shadow: 0 0 14px rgba(236,194,116,.7);
          letter-spacing: .04em;
        }

        /* verify */
        /* الشاشة أطول من البقية: هامش تحت يخلي آخر زر فوق الفوتر الثابت */
        .auth-root #v-verify {
          padding-bottom: 44px;
        }
        .auth-root .steps {
          display: grid;
          gap: 10px;
          margin-bottom: 16px;
        }
        .auth-root .step {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          font-size: 13px;
          color: var(--txt);
        }
        .auth-root .step i {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-style: normal;
          background: rgba(236,194,116,.14);
          color: var(--gold);
          border: 1px solid var(--line);
          font-size: 14px;
        }
        .auth-root .code {
          border-radius: 22px;
          padding: 22px 14px 16px;
          text-align: center;
          background: linear-gradient(160deg, rgba(236,194,116,.2), rgba(10,6,3,.8));
          border: 1px solid var(--gold2);
          position: relative;
          overflow: hidden;
        }
        .auth-root .code::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
          top: 0;
          animation: auth-scan 3s ease-in-out infinite;
        }
        @keyframes auth-scan {
          50% { top: 100%; }
        }
        .auth-root .code small {
          font-size: 12px;
          color: var(--gold);
          font-weight: 800;
        }
        .auth-root .cv {
          direction: ltr;
          font-family: "Courier New", monospace;
          font-size: clamp(22px, 6vw, 32px);
          font-weight: 700;
          letter-spacing: .14em;
          margin: 8px 0 12px;
          color: #fff;
          text-shadow: 0 0 24px rgba(236,194,116,.55);
        }
        .auth-root .cv b {
          color: var(--gold);
        }
        .auth-root .cp {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 9px 18px;
          border-radius: 12px;
          background: rgba(255,255,255,.07);
          border: 1px solid var(--line);
          font-weight: 700;
          font-size: 14px;
          transition: .3s;
          color: var(--txt);
          cursor: pointer;
        }
        .auth-root .cp:hover {
          background: rgba(236,194,116,.16);
        }
        .auth-root .cp.done {
          color: var(--ok);
          border-color: var(--ok);
        }
        .auth-root .bar {
          height: 4px;
          border-radius: 4px;
          background: rgba(255,255,255,.08);
          margin: 16px 6px 0;
          overflow: hidden;
        }
        .auth-root .bar i {
          display: block;
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, var(--gold2), var(--gold));
          transform-origin: right;
          transition: transform 1s linear;
        }
        .auth-root .tm {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          font-size: 13px;
          color: var(--mut);
          direction: ltr;
        }
        .auth-root .wait {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          font-weight: 700;
          font-size: 14px;
          color: #cbbd9f;
        }
        .auth-root .wait .sp2 {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(236,194,116,.25);
          border-top-color: var(--gold);
          animation: auth-spin .9s linear infinite;
        }
        .auth-root .wait.ok {
          color: var(--ok);
        }
        .auth-root .wait.ok .sp2 {
          display: none;
        }
        .auth-root .usr {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(10,6,3,.6);
          border: 1px solid var(--line);
          margin-bottom: 16px;
        }
        .auth-root .usr .av {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          font-size: 22px;
          color: var(--gold);
          background: linear-gradient(145deg, #3a2812, #150c05);
          border: 1px solid var(--line);
          overflow: hidden;
        }
        .auth-root .usr .av img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .auth-root .usr div {
          flex: 1;
          text-align: right;
        }
        .auth-root .usr b {
          display: block;
          font-size: 17px;
          color: var(--txt);
        }
        .auth-root .usr span {
          font-size: 12px;
          color: var(--mut);
        }

        /* سطر الحالة: النقطة من الاتصال الحقيقي، لا من نص متوهّم */
        .auth-root .wait .ldot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--gold2);
          flex: none;
        }
        .auth-root .wait.live-on .ldot {
          background: var(--ok);
          box-shadow: 0 0 10px rgba(34,197,94,.65);
          animation: auth-pulse 1.8s ease-in-out infinite;
        }
        .auth-root .wait.live-off .ldot {
          background: var(--bad);
          box-shadow: 0 0 10px rgba(239,68,68,.6);
        }
        .auth-root .wait.ok .ldot {
          display: none;
        }
        @keyframes auth-pulse {
          50% { opacity: .35; }
        }
        .auth-root .wait .mini {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 9px;
          background: rgba(236,194,116,.14);
          border: 1px solid var(--line);
          color: var(--gold);
          font-weight: 700;
          font-size: 11.5px;
          cursor: pointer;
        }
        .auth-root .wait .mini:hover {
          background: rgba(236,194,116,.26);
        }

        /* آخر الشات — العضو يشوف رسالته وصلت، وما ينصدم إذا طلع ورجع */
        .auth-root .feed {
          margin-top: 12px;          border-radius: 16px;
          border: 1px solid var(--line);
          background: rgba(10,6,3,.55);
          overflow: hidden;
        }
        .auth-root .feed .fh {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(236,194,116,.1), transparent);
        }
        .auth-root .feed .fh b {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: var(--gold);
        }
        .auth-root .feed .fh span {
          font-size: 11px;
          color: var(--mut);
        }
        .auth-root .feed .fempty {
          padding: 13px 12px;
          text-align: center;
          font-size: 12.5px;
          color: var(--mut);
        }
        .auth-root .feed .flist {
          display: grid;
          gap: 2px;
          max-height: 150px;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 6px 4px 8px 8px;
          scrollbar-width: thin;
          scrollbar-color: rgba(236,194,116,.35) transparent;
        }
        .auth-root .feed .fe {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 5px 8px;
          border-radius: 11px;
          animation: auth-fe-in .35s var(--ease) both;
        }
        @keyframes auth-fe-in {
          from { opacity: 0; transform: translateY(6px); }
        }
        .auth-root .feed .fe.mine {
          background: rgba(34,197,94,.1);
          border: 1px solid rgba(34,197,94,.26);
        }
        .auth-root .feed .fava {
          flex: 0 0 auto;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          overflow: hidden;
          color: var(--gold);
          background: linear-gradient(145deg, #3a2812, #150c05);
        }
        .auth-root .feed .fava img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .auth-root .feed .fb {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 8px;
          text-align: right;
        }
        .auth-root .feed .fb b {
          flex: none;
          max-width: 42%;
          font-size: 11.5px;
          color: var(--gold);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .auth-root .feed .fb p {
          flex: 1;
          min-width: 0;
          margin: 0;
          font-size: 12.5px;
          color: var(--txt);
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          unicode-bidi: plaintext;
        }
        .auth-root .feed .ft {
          flex: 0 0 auto;
          font-size: 10.5px;
          color: var(--mut);
        }

        /* scan */
        .auth-root .fpw {
          position: relative;
          width: 200px;
          height: 200px;
          margin: 20px auto 14px;
          display: grid;
          place-items: center;
        }
        .auth-root .fpw::before, .auth-root .fpw::after {
          content: "";
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          border: 1px solid var(--line);
          animation: auth-rip 3s ease-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        .auth-root .fpw::after {
          animation-delay: 1.5s;
        }
        @keyframes auth-rip {
          from { transform: scale(.8); opacity: .9; }
          to { transform: scale(1.4); opacity: 0; }
        }
        .auth-root .ring {
          position: absolute;
          inset: 15px;
          width: calc(100% - 30px);
          height: calc(100% - 30px);
          border-radius: 50%;
          -webkit-mask: radial-gradient(circle, transparent 62%, #000 63%);
          mask: radial-gradient(circle, transparent 62%, #000 63%);
          pointer-events: none;
          margin: auto;
          z-index: 2;
        }
        .auth-root .pad {
          position: relative;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 75px;
          color: var(--gold);
          overflow: hidden;
          cursor: pointer;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          background: radial-gradient(circle, #46301a, #20130a);
          box-shadow: 0 0 50px rgba(236,150,60,.35), inset 0 0 30px rgba(0,0,0,.5);
          transition: .3s var(--ease);
          z-index: 1;
        }
        .auth-root .pad .i {
          stroke-width: 1.4;
        }
        .auth-root .pad.hold {
          transform: scale(.94);
          box-shadow: 0 0 80px rgba(236,150,60,.7), inset 0 0 30px rgba(0,0,0,.4);
        }
        .auth-root .pad::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, #fff, transparent);
          box-shadow: 0 0 16px 4px rgba(255,220,150,.7);
          top: 0;
          opacity: 0;
        }
        .auth-root .pad.hold::after {
          opacity: 1;
          animation: auth-scan 1.1s linear infinite;
        }
        .auth-root .hint {
          display: inline-block;
          padding: 10px 22px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 14px;
          color: var(--gold);
          border: 1px solid var(--gold2);
          background: rgba(185,135,60,.12);
        }

        /* granted */
        .auth-root .lk {
          width: 100px;
          height: 100px;
          margin: 0 auto 16px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 50px;
          color: var(--ok);
          background: radial-gradient(circle, rgba(34,197,94,.16), rgba(34,197,94,.03));
          border: 1px solid rgba(34,197,94,.4);
          box-shadow: 0 0 60px rgba(34,197,94,.35);
        }
        .auth-root .lk .shk {
          transform-origin: 17px 11px;
          transition: transform .7s var(--ease) .3s;
        }
        .auth-root #v-ok.on .shk {
          transform: translateY(-3px) rotate(-18deg);
        }
        .auth-root #v-ok.on .lk {
          animation: auth-pulse 1.6s ease-out .4s 2;
        }
        @keyframes auth-pulse {
          from { box-shadow: 0 0 0 0 rgba(34,197,94,.5), 0 0 60px rgba(34,197,94,.35); }
          to { box-shadow: 0 0 0 46px rgba(34,197,94,0), 0 0 60px rgba(34,197,94,.35); }
        }
        .auth-root #v-ok .sub {
          color: var(--ok);
        }

        /* footer & toast */
        .auth-root footer.auth-footer {
          position: fixed;
          bottom: max(14px, env(safe-area-inset-bottom));
          left: 0;
          right: 0;
          text-align: center;
          font-size: 12px;
          color: var(--mut);
          pointer-events: none;
        }
        .auth-root footer.auth-footer b {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: var(--txt);
          letter-spacing: .3em;
          direction: ltr;
        }
        .auth-root footer.auth-footer small {
          display: block;
          margin-top: 3px;
          font-size: 10px;
          opacity: .6;
          direction: ltr;
          letter-spacing: .08em;
        }
        .auth-root #toast {
          position: fixed;
          top: 22px;
          left: 50%;
          transform: translate(-50%, -160%);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          z-index: 100000;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 22px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          background: rgba(24, 14, 8, 0.95);
          border: 1px solid var(--gold);
          color: var(--txt);
          backdrop-filter: blur(12px);
          transition: transform .4s var(--ease), opacity .3s ease;
          box-shadow: 0 14px 40px rgba(0,0,0,.6), 0 0 20px rgba(236,194,116,.2);
        }
        .auth-root #toast.show {
          transform: translate(-50%, 0);
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }
        .auth-root #toast.good {
          border-color: var(--ok);
          color: #c9f7d9;
        }
        .auth-root #toast.warn {
          border-color: var(--gold);
          color: #ffeedb;
        }
        @media (max-width: 480px) {
          .auth-root .panel { padding: 22px 16px; }
          .auth-root .pin { gap: 6px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-root *, .auth-root *::before, .auth-root *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>
    </div>
  );
};
