import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Fingerprint, Sparkles, UserPlus, ArrowRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserAuthPage } from './UserAuthPage';

const sha256hex = async (input: string): Promise<string> => {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hashPassword = (pin: string) => sha256hex(pin + 'iABS_salt_2024');

const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 ساعة
const MAX_ATTEMPTS = 5;
const LOCK_MS = 90 * 1000;

/* طبقة أمان الجلسة:
   - كلمة السر نفسها لا تُخزَّن أبداً (نخزّن hash فقط)
   - التوكن مربوط بالجهاز + وقت الإصدار + صلاحية محدودة */
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

const buildSession = async (pin: string, role: 'admin' | 'user') => {
    const issuedAt = Date.now();
    const pinHash = await sha256hex(pin + '|iABS_pin|');
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

interface GlobalPasswordPageProps {
    onSuccess: (role: 'admin' | 'user') => void;
    storageKey?: string;
    title?: string;
    subtitle?: string;
    newTitle?: string;
    returningTitle?: string;
    configKey?: string;
    fallbackConfigKey?: string;
    /** وضع أدمن فقط: لا اسم مستخدم ولا تسجيل ولا دخول مستخدمين — كلمة السر فقط */
    adminOnly?: boolean;
}

type AuthStep = 'LOADING' | 'PASSWORD' | 'FINGERPRINT' | 'SCANNING' | 'SUCCESS' | 'WELCOME' | 'USER_AUTH';

export const GlobalPasswordPage: React.FC<GlobalPasswordPageProps> = ({
    onSuccess,
    storageKey = 'site_access_granted',
    title,
    subtitle = 'RESTRICTED ACCESS AREA',
    newTitle = 'بروتوكول الأمان',
    returningTitle = 'تسجيل الدخول',
    configKey = 'admin_password',
    fallbackConfigKey,
    adminOnly = false
}) => {
    const [step, setStep] = useState<AuthStep>('LOADING');
    const [pin, setPin] = useState<string[]>([]);
    const [targetPin, setTargetPin] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);
    const [role, setRole] = useState<'admin' | 'user'>('admin');
    const [isAdminMode, setIsAdminMode] = useState(adminOnly);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [lockedUntil, setLockedUntil] = useState(0);
    const [fails, setFails] = useState(0);
    const [pinLen, setPinLen] = useState(6);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const [userType, setUserType] = useState<'NEW' | 'RETURNING'>('NEW');

    // Sound Refs
    const scanSound = useRef<HTMLAudioElement | null>(null);
    const successSound = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Initialize Audio
        scanSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/228/228-preview.mp3');
        successSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3');
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            // ---- 1) قفل المحاولات (محاولات فاشلة متتالية) ----
            try {
                const lockRaw = localStorage.getItem(`auth_lock_${storageKey}`);
                if (lockRaw) {
                    const lock = JSON.parse(lockRaw);
                    if (lock.until > Date.now()) setLockedUntil(lock.until);
                    if (typeof lock.fails === 'number') setFails(lock.fails);
                }
            } catch (e) { }

            // ---- 2) جلسة سابقة؟ (متوكن موقّع + صلاحية + مربوط بالجهاز) ----
            const storedSession = localStorage.getItem(storageKey);
            const sessionValid = await validateSession(storedSession);
            if (storedSession && !sessionValid) localStorage.removeItem(storageKey);

            let storedRole: 'admin' | 'user' | null = null;
            try {
                if (sessionValid && storedSession) storedRole = JSON.parse(storedSession).role || null;
            } catch (e) { }

            const failSafe = setTimeout(() => {
                setStep(current => (current === 'LOADING' ? 'PASSWORD' : current));
            }, 3500);

            const pickLength = (value: string) => {
                const len = Math.min(12, Math.max(4, value.length));
                setPinLen(len);
                setPin(new Array(len).fill(''));
                inputs.current = inputs.current.slice(0, len);
            };

            const fetchConfig = async (key: string) => {
                const { data, error } = await Promise.race([
                    supabase.from('app_config').select('value').eq('key', key).maybeSingle(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
                ]) as any;
                if (error || !data?.value) throw new Error('no-config');
                return data.value as string;
            };

            try {
                let remotePin: string | null = null;
                try {
                    remotePin = await fetchConfig(configKey);
                } catch (e) {
                    if (fallbackConfigKey) {
                        try { remotePin = await fetchConfig(fallbackConfigKey); } catch (e2) { remotePin = null; }
                    }
                }

                clearTimeout(failSafe);

                if (remotePin) {
                    console.log("[iABS] 🟢 Cloud Security Protocol Loaded");
                    setTargetPin(remotePin);
                    pickLength(remotePin);

                    if (sessionValid && storedRole) {
                        setRole(storedRole);
                        setUserType('RETURNING');
                        setStep('FINGERPRINT');
                    } else {
                        setUserType('NEW');
                        setStep('PASSWORD');
                    }
                } else {
                    // ⚠️ Fail-closed: بدون مصدر موثوق = لا دخول إطلاقاً
                    clearTimeout(failSafe);
                    console.warn("[iABS] 🔒 No server config available — access denied");
                    setTargetPin(null);
                    setUserType('NEW');
                    setStep('PASSWORD');
                }
            } catch (e) {
                clearTimeout(failSafe);
                console.warn("[iABS] 🔒 Cloud unreachable — access denied (fail closed)");
                setTargetPin(null);
                setUserType('NEW');
                setStep('PASSWORD');
            }
        };

        initAuth();
    }, []);

    // Focus effect for inputs
    useEffect(() => {
        if (step === 'PASSWORD') {
            if (!adminOnly && !isAdminMode && !loginUsername) {
                document.getElementById('login-username')?.focus();
            } else if (inputs.current[0]) {
                setTimeout(() => inputs.current[0]?.focus(), 100);
            }
        }
    }, [step, isAdminMode, adminOnly]);

    const handleInput = (index: number, value: string) => {
        const char = value.slice(-1);
        const newPin = [...pin];
        newPin[index] = char;
        setPin(newPin);

        if (char && index < pin.length - 1) {
            inputs.current[index + 1]?.focus();
        }

        if (newPin.every(d => d !== '') && index === pin.length - 1 && char && targetPin) {
            verifyPin(newPin.join(''));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const registerFail = () => {
        const next = fails + 1;
        setFails(next);
        if (next >= MAX_ATTEMPTS) {
            const until = Date.now() + LOCK_MS;
            setLockedUntil(until);
            try { localStorage.setItem(`auth_lock_${storageKey}`, JSON.stringify({ until, fails: 0 })); } catch (e) { }
            setFails(0);
        } else {
            try { localStorage.setItem(`auth_lock_${storageKey}`, JSON.stringify({ until: 0, fails: next })); } catch (e) { }
        }
    };

    const clearFails = () => {
        setFails(0);
        setLockedUntil(0);
        try { localStorage.removeItem(`auth_lock_${storageKey}`); } catch (e) { }
    };

    const verifyPin = async (enteredPin: string) => {
        if (Date.now() < lockedUntil) return;

        // 1) كلمة سر الأدمن (المصدر: Supabase فقط — لا توجد نسخة داخل الحزمة)
        if (targetPin && enteredPin === targetPin) {
            clearFails();
            setError(false);
            setRole('admin');
            setStep('FINGERPRINT');
            return;
        }

        // 2) دخول مستخدمين (غير مفعّل في وضع الأدمن فقط)
        if (!adminOnly && !isAdminMode && loginUsername.trim()) {
            try {
                const hashedPin = await hashPassword(enteredPin);
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('kick_username', loginUsername.trim().toLowerCase())
                    .eq('password_hash', hashedPin)
                    .maybeSingle();

                if (data) {
                    const { data: lbData } = await supabase
                        .from('leaderboard')
                        .select('score')
                        .eq('username', data.kick_username)
                        .maybeSingle();

                    const points = lbData?.score || 0;

                    localStorage.setItem('iabs_user', JSON.stringify({
                        id: data.id,
                        display_name: data.display_name,
                        kick_username: data.kick_username,
                        discord: data.discord || undefined,
                        avatar: data.avatar || undefined,
                        points: points
                    }));
                    clearFails();
                    setError(false);
                    setRole('user');
                    setUserType('RETURNING');
                    setStep('FINGERPRINT');
                    return;
                }
            } catch (e) {
                console.error('[Auth] User check error:', e);
            }
        }

        // 3) رفض + تسجيل المحاولة الفاشلة
        registerFail();
        setError(true);
        setShake(true);
        setTimeout(() => {
            setShake(false);
            setPin(new Array(pin.length).fill(''));
            inputs.current[0]?.focus();
            setError(false);
        }, 600);
    };

    const startScan = () => {
        if (step !== 'FINGERPRINT') return;

        setStep('SCANNING');
        if (scanSound.current) {
            scanSound.current.currentTime = 0;
            scanSound.current.play().catch(() => { });
        }

        // Simulate 5s scan
        setTimeout(() => {
            finishScan();
        }, 5000);
    };

    const finishScan = (roleOverride?: 'admin' | 'user') => {
        const finalRole = roleOverride || role;
        if (successSound.current) {
            successSound.current.play().catch(() => { });
        }
        setStep('SUCCESS');

        // نحفظ توكن موقّع (hash) فقط — كلمة السر لا تُلمس القرص أبداً
        (async () => {
            if (targetPin) {
                const session = await buildSession(targetPin, finalRole);
                localStorage.setItem(storageKey, JSON.stringify(session));
            }
        })();

        setTimeout(() => {
            onSuccess(finalRole);
        }, 2000);
    };

    if (step === 'LOADING') {
        return <div className="fixed inset-0 bg-black z-[9999]" />;
    }

    return (
        <div className="icg1-auth fixed inset-0 z-[9999] bg-black text-white font-sans overflow-hidden flex flex-col items-center justify-center p-0 m-0" dir="rtl">
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black animate-pulse"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-red-600/5 rounded-full blur-[150px] animate-pulse-slow"></div>
                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(30,0,0,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(30,0,0,0.2)_1px,transparent_1px)] bg-[size:60px_60px] opacity-10"></div>
            </div>

            {/* Content Container - Perfectly Centered */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center min-h-full">

                {/* --- PASSWORD STEP --- */}
                {step === 'PASSWORD' && (
                    <div className={`flex flex-col items-center w-full max-w-lg px-4 animate-in fade-in zoom-in duration-700 ${shake ? 'animate-shake' : ''}`}>

                        {lockedUntil > Date.now() && (
                            <div className="mb-4 px-4 py-2 rounded-xl bg-red-900/30 border border-red-600/40 text-red-300 text-xs font-black tracking-widest animate-pulse">
                                تم القفل مؤقتاً — انتظر {Math.ceil((lockedUntil - Date.now()) / 1000)} ثانية
                            </div>
                        )}

                        {lockedUntil === 0 && !targetPin && (
                            <div className="mb-4 px-4 py-2 rounded-xl bg-red-900/30 border border-red-600/40 text-red-300 text-[11px] font-black text-center leading-relaxed">
                                تعذّر الاتصال بخادم التحقق — الدخول مغلق حالياً (Fail-Closed)
                            </div>
                        )}

                        <div className="mb-4 relative group">
                            <div className="absolute inset-0 bg-red-600/40 blur-[40px] rounded-full group-hover:bg-red-600/60 transition-all duration-500 animate-pulse"></div>
                            <Lock size={50} strokeWidth={1.5} className={`relative z-10 transition-all duration-300 ${error ? 'text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,1)]' : 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]'}`} />
                        </div>

                        <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter mb-2 text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 drop-shadow-2xl">
                            {adminOnly ? (title || 'دخول المستضيف') : isAdminMode ? 'بروتوكول القائد' : (userType === 'NEW' ? (title || newTitle) : (title || returningTitle))}
                        </h2>

                        <p className="text-red-500 font-bold tracking-[0.3em] text-[9px] md:text-xs uppercase mb-6 text-center drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">
                            {adminOnly ? (subtitle || 'HOST ACCESS — RESTRICTED') : isAdminMode ? 'RESTRICTED COMMAND INTERFACE' : subtitle}
                        </p>

                        {!isAdminMode && !adminOnly && (
                            <div className="w-full max-w-xs mb-6 animate-in slide-in-from-top-4 duration-500">
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block text-center flex items-center justify-center gap-1.5">
                                    <span className="text-green-500">K</span> حساب Kick
                                </label>
                                <div className="relative group">
                                    <input id="login-username" type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="اسم المستخدم" className="w-full bg-white/[0.03] border border-white/10 focus:border-red-500/40 rounded-xl px-4 py-3 text-white font-black text-center text-base outline-none transition-all placeholder:text-gray-700 shadow-xl backdrop-blur-xl" dir="ltr" />
                                </div>
                            </div>
                        )}

                        <div style={{ direction: 'ltr' }} className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-8">
                            {pin.map((digit, i) => (
                                <div key={i} className="relative group">
                                    <div className={`pointer-events-none absolute inset-0 bg-red-600/20 blur-xl rounded-full transition-all duration-300 ${digit ? 'opacity-100 scale-150' : 'opacity-0'}`}></div>
                                    <input
                                        ref={el => inputs.current[i] = el}
                                        type="text" inputMode="text" autoComplete="off" maxLength={1}
                                        value={digit} onChange={(e) => handleInput(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                                        className={`relative z-20 w-10 h-14 md:w-14 md:h-20 bg-transparent border-b-4 text-center text-2xl md:text-4xl font-black text-white focus:outline-none focus:border-red-500 focus:scale-110 transition-all duration-300 placeholder-transparent ${error ? 'border-red-600 text-red-500' : 'border-white/20'} ${digit ? 'border-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'hover:border-white/50'}`}
                                    />
                                </div>
                            ))}
                        </div>

                        {error && <div className="text-red-500 font-black tracking-[0.4em] animate-bounce text-xs drop-shadow-[0_0_8px_red]">ACCESS DENIED</div>}

                        <div className="mt-4 flex flex-col items-center gap-4">
                            {!isAdminMode && !adminOnly && (
                                <button onClick={() => setStep('USER_AUTH')} className="text-gray-500 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 bg-white/5 px-5 py-2 rounded-xl border border-white/10">
                                    ليس لديك حساب؟ <span className="text-red-500">سجّل الآن</span>
                                </button>
                            )}
                            {!adminOnly && (
                                <button type="button" onClick={() => { setIsAdminMode(!isAdminMode); setPin(new Array(pin.length).fill('')); setError(false); }} className="text-red-900/40 hover:text-red-600 font-black text-[9px] uppercase tracking-[0.3em] transition-all hover:scale-110">
                                    {isAdminMode ? 'العودة لتسجيل المستخدم' : 'انت محمااااا ؟؟؟'}
                                </button>
                            )}
                            {adminOnly && fails > 0 && (
                                <span className="text-red-500/60 font-black text-[9px] uppercase tracking-[0.3em]">محاولات متبقية: {MAX_ATTEMPTS - fails}</span>
                            )}
                        </div>
                    </div>
                )}


                {(step === 'FINGERPRINT' || step === 'SCANNING') && (
                    <div className="flex flex-col items-center justify-center w-full min-h-full bg-black relative overflow-hidden">

                        {step === 'FINGERPRINT' && (
                            <button onClick={() => { setStep('PASSWORD'); setPin(new Array(6).fill('')); setTimeout(() => inputs.current[0]?.focus(), 100); }}
                                className="absolute top-6 right-6 z-[100] flex items-center gap-1.5 text-gray-500 hover:text-white transition-all bg-white/5 border border-white/10 px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] group">
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /> العودة
                            </button>
                        )}

                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black"></div>
                            <div className="w-full h-full opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(220,38,38,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                        </div>

                        <div className="relative z-20 text-center mb-8 animate-in slide-in-from-top-10 duration-700 fade-in">
                            <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(220,38,38,0.5)] mb-2">
                                {userType === 'NEW' ? (title || newTitle) : (title || returningTitle)}
                            </h2>
                            <p className="text-red-500 font-mono tracking-[0.2em] text-xs uppercase animate-pulse font-bold">{step === 'SCANNING' ? 'SYSTEM ANALYSIS IN PROGRESS' : 'BIOMETRIC VERIFICATION'}</p>
                        </div>

                        <div className="relative z-30 perspective-1000">
                            <div className={`absolute bottom-[-60px] left-1/2 -translate-x-1/2 w-[280px] h-[60px] bg-red-600/20 blur-[40px] rounded-[100%] transition-opacity duration-500 ${step === 'SCANNING' ? 'opacity-100' : 'opacity-30'}`}></div>

                            <button onMouseDown={startScan} onTouchStart={startScan} className="relative group cursor-pointer outline-none tap-highlight-transparent p-6" style={{ WebkitTapHighlightColor: 'transparent', transformStyle: 'preserve-3d' }}>
                                <div className={`absolute inset-[-40px] border border-red-500/20 rounded-full transition-all duration-1000 ${step === 'SCANNING' ? 'animate-spin-slow opacity-80 border-dashed border-red-400/30' : 'opacity-20 scale-90'}`}></div>
                                <div className={`absolute inset-[-20px] border border-red-500/10 rounded-full transition-all duration-1000 ${step === 'SCANNING' ? 'animate-reverse-spin opacity-80 border-dotted border-red-500/50' : 'opacity-20 scale-95'}`}></div>
                                <div className="absolute inset-[-6px] border border-red-600/30 rounded-full"></div>
                                <div className={`absolute inset-0 bg-red-600/10 blur-xl rounded-full transition-all duration-200 ${step === 'SCANNING' ? 'bg-red-500/30 scale-125' : 'group-hover:bg-red-900/40'}`}></div>

                                <div className={`relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center rounded-full border-2 border-red-500/20 bg-black/60 backdrop-blur-xl shadow-[0_0_30px_rgba(220,38,38,0.1)] overflow-hidden transition-all duration-300 ${step === 'SCANNING' ? 'border-red-500 shadow-[0_0_60px_rgba(220,38,38,0.5)] scale-105' : 'group-hover:border-red-500/60 group-hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]'}`}>
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.1)_1px,transparent_1px)] bg-[size:16px_16px] opacity-20"></div>
                                    <Fingerprint size={160} className={`relative z-10 transition-all duration-200 ${step === 'SCANNING' ? 'text-red-500 drop-shadow-[0_0_20px_rgba(255,50,50,1)] opacity-100' : 'text-red-900/50 group-hover:text-red-500/80'}`} strokeWidth={1.2} />
                                    {step === 'SCANNING' && (
                                        <>
                                            <div className="absolute top-[-10%] w-[120%] h-[3px] bg-white shadow-[0_0_15px_#ff0000,0_0_30px_#ff0000] z-50 animate-scan-line"></div>
                                            <div className="absolute inset-0 z-40 opacity-20 pointer-events-none mix-blend-screen overflow-hidden">
                                                <div className="w-full h-[200%] animate-matrix bg-[repeating-linear-gradient(0deg,transparent,transparent_16px,#ff0000_16px,#ff0000_18px)]"></div>
                                            </div>
                                            <div className="absolute inset-0 bg-red-500/20 animate-pulse-fast z-30"></div>
                                        </>
                                    )}
                                    {step !== 'SCANNING' && <div className="absolute inset-4 rounded-full border border-red-500/20 animate-ping opacity-30"></div>}
                                </div>
                            </button>
                        </div>

                        <div className="relative z-20 mt-8 h-10 flex items-center justify-center">
                            <div className={`bg-red-900/20 border border-red-500/20 px-6 py-2 rounded-full transition-all duration-300 flex items-center gap-2 ${step === 'SCANNING' ? 'scale-95 opacity-50' : 'animate-bounce'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full bg-red-500 ${step === 'SCANNING' ? 'animate-ping' : ''}`}></div>
                                <span className="text-red-400 font-bold tracking-[0.15em] text-[10px] uppercase">{step === 'SCANNING' ? 'SCANNING...' : 'اضغط مطولاً للمسح'}</span>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'SUCCESS' && (
                    <div className="flex flex-col items-center animate-in zoom-in duration-700 text-center relative z-20">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-green-500/30 blur-[60px] rounded-full animate-pulse"></div>
                            <div className="relative z-10 p-6 bg-green-500/10 rounded-full border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                <Unlock size={70} className="text-green-500 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-bounce" />
                            </div>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black italic text-white mb-3 tracking-tighter drop-shadow-2xl">{userType === 'NEW' ? 'تمت المصادقة' : 'أهلاً بك'}</h2>
                        <p className="text-green-500 font-bold tracking-[0.4em] text-lg uppercase drop-shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse">ACCESS AUTHORIZED</p>
                    </div>
                )}

                {/* --- USER AUTH / REGISTRATION STEP --- */}
                {step === 'USER_AUTH' && (
                    <UserAuthPage
                        onSuccess={(userData) => {
                            setRole('user');
                            finishScan('user');
                        }}
                        onBack={() => setStep('PASSWORD')}
                    />
                )}

            </div>

            <div className="absolute bottom-10 opacity-30 flex flex-col items-center gap-1 animate-pulse pointer-events-none">
                <div className="flex items-center gap-3">
                    <Sparkles size={20} className="text-white" />
                    <span className="text-sm text-white uppercase tracking-[0.6em] font-bold">iCG1 — دخول آمن</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">BUILD_REF: {new Date().toLocaleDateString()} | v2.0.5</span>
            </div>

            <style>{`
        @keyframes scan-line {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; box-shadow: 0 0 30px #ef4444; }
          90% { opacity: 1; box-shadow: 0 0 30px #ef4444; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes scan-fill {
            0% { clip-path: inset(100% 0 0 0); filter: drop-shadow(0 0 2px red); }
            100% { clip-path: inset(0 0 0 0); filter: drop-shadow(0 0 15px red); }
        }
        .animate-scan-line {
          animation: scan-line 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; 
        }
        .animate-scan-fill {
            animation: scan-fill 4s linear forwards;
        }
        .glass-scan-effect {
            background: radial-gradient(circle, rgba(220,38,38,0.1) 0%, rgba(0,0,0,0) 70%);
            box-shadow: inset 0 0 40px rgba(220,38,38,0.2), 0 0 20px rgba(220,38,38,0.1);
            border: 1px solid rgba(220,38,38,0.3);
            backdrop-filter: blur(2px);
        }
        .animate-pulse-fast {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes hologram-flicker {
            0% { opacity: 0.8; transform: scaleY(1); }
            5% { opacity: 0.9; transform: scaleY(1.02); }
            10% { opacity: 0.8; transform: scaleY(0.98); }
            100% { opacity: 0.8; transform: scaleY(1); }
        }
        .animate-hologram {
            animation: hologram-flicker 0.1s infinite alternate;
        }
        @keyframes matrix-fall {
            0% { transform: translateY(-100%); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(100%); opacity: 0; }
        }
        .animate-matrix {
            animation: matrix-fall 2s linear infinite;
        }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        .animate-reverse-spin { animation: spin 12s linear infinite reverse; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .glitch-effect {
            animation: glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite;
        }
        @keyframes glitch {
            0% { transform: translate(0); }
            20% { transform: translate(-2px, 2px); }
            40% { transform: translate(-2px, -2px); }
            60% { transform: translate(2px, 2px); }
            80% { transform: translate(2px, -2px); }
            100% { transform: translate(0); }
        }
      `}</style>
        </div>
    );
};
