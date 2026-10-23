import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { KickIcon, XIcon, SnapchatIcon, DiscordIcon, TikTokIcon, InstagramIcon, YoutubeIcon, TwitchIcon } from './components/Icons';
import { SocialLink, Language } from './types';
import { supabase } from './supabaseClient';
import { SponsorsSection, ClipsSection, ScheduleSection, FAQSection } from './components/PublicWidgets';
import { LiveTheater } from './components/LiveTheater';
import { DiscordWidget, XWidget } from './components/CommunityWidgets';
import { BRAND_LINKS, BRAND_NAME, KICK_CHANNEL_SLUG } from './brand';

// Heavy below-fold / on-demand chunks — split out of the first paint
const StatsSection = lazy(() => import('./components/StatsSection').then(m => ({ default: m.StatsSection })));
// تقرير الجلسة معزول بحزمة منفصلة لتسريع أول إطار في الصفحة
const LastSessionReport = lazy(() => import('./components/SessionReport').then(m => ({ default: m.SessionReport })));

// --- Constants (preserved) ---
const DEFAULT_PROFILE_IMAGE = "/brand/512.gif";
import { kickFetch } from './utils/kickApi';
import { getAllSocialMediaStats, formatFollowerCount, readSocialCache, SOCIAL_TTL_MS, SocialMediaStats } from './utils/socialMediaApi';

const PC_BACKGROUND = "/brand/4543.png";
const MOBILE_BACKGROUND = "/brand/4543.png";
const CHANNEL_SLUG = KICK_CHANNEL_SLUG;

const createSocialLink = (key: string, value: string, followerCount?: string, specialDetail?: string): SocialLink | null => {
    if (!value) return null;
    const handle = value.replace(/^https?:\/\/(www\.)?(twitter|x|instagram|youtube|discord|tiktok|twitch|snapchat)\.(com|tv|gg)\//i, '')
        .replace(/^https?:\/\/discord\.com\/invite\//i, '')
        .replace(/\/channel\//i, '')
        .replace(/^@/, '')
        .replace(/\/$/, '');
    switch (key) {
        case 'twitter': return { name: 'X', url: value.startsWith('http') ? value : `https://x.com/${handle}`, icon: <XIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FFFFFF', followerCount, specialDetail };
        case 'instagram': return { name: 'Instagram', url: value.startsWith('http') ? value : `https://instagram.com/${handle}`, icon: <InstagramIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#E1306C', followerCount, specialDetail };
        case 'youtube': return { name: 'YouTube', url: value.startsWith('http') ? value : `https://youtube.com/@${handle}`, icon: <YoutubeIcon className="w-7 h-7" />, color: '', username: '@iiCG1', hex: '#FF0000', followerCount, specialDetail };
        case 'discord': return { name: 'Discord', url: value.startsWith('http') ? value : `https://discord.gg/${handle}`, icon: <DiscordIcon className="w-7 h-7" />, color: '', username: 'iCG1 Community', hex: '#5865F2', followerCount, specialDetail };
        case 'tiktok': return { name: 'TikTok', url: value.startsWith('http') ? value : `https://tiktok.com/@${handle}`, icon: <TikTokIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FE2C55', followerCount, specialDetail };
        case 'twitch': return { name: 'Twitch', url: value.startsWith('http') ? value : `https://twitch.tv/${handle}`, icon: <TwitchIcon className="w-7 h-7" />, color: '', username: 'iiCG1', hex: '#A970FF', followerCount, specialDetail };
        case 'snapchat': return { name: 'Snapchat', url: value.startsWith('http') ? value : `https://snapchat.com/add/${handle}`, icon: <SnapchatIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FFFC00', followerCount, specialDetail };
        default: return null;
    }
};

const KICK_SOCIAL: SocialLink = {
    name: 'KICK',
    url: BRAND_LINKS.kick,
    icon: <KickIcon className="w-8 h-8" />,
    color: '',
    username: '@iCG1',
    hex: '#53FC18',
    followerCount: '—',
    specialDetail: 'البث الأساسي والتفاعل المباشر'
};

const TRANSLATIONS = {
    en: {
        status: 'LIVE NOW', statusOffline: 'OFFLINE',
        headerTitle: 'iCG1 STREAM HUB',
        eyebrow: 'THE OFFICIAL iCG1 STREAM HUB',
        nameAr: 'iCG1 • Official Creator',
        bio: 'Follow iCG1 for live gaming, community events, and new moments across every platform.',
        tags: ['Gaming', 'Live on Kick', 'Community'],
        defaultStreamTitle: 'CHECK OUT THE VODS | FOLLOW NOW',
        defaultCategory: 'Offline',
        footer: '© 2026 iCG1. All Rights Reserved.',
        watchLive: 'Watch Live', joinDiscord: 'Join Discord',
        subOnly: 'SUB ONLY', dropsEnabled: 'DROPS ENABLED', noTags: 'No tags',
        shareTitle: 'iCG1 Stream Hub', shareText: 'Check out iCG1 live on Kick!', copied: 'Link copied!',
        lastSessionReport: 'Last session report', ago: 'Ago', duration: 'Duration',
        categoriesSpent: 'Categories in this stream', highlights: 'Stream highlights',
        socialsTitle: 'Social Arena', socialsSub: 'One hub — every platform. Pick your battlefield.',
        communityTitle: 'Community HQ', supportTitle: 'Support iCG1', supportSub: 'Support the stream through the official creator page.',
        tiersTitle: 'Special alert tiers', pollLive: 'LIVE POLL',
        theaterTitle: 'Live Theater', viewers: 'watching',
        statsFollowers: 'Total Followers', statsKick: 'Total Followers', statsViews: 'Site visits', statsPlatforms: 'Platforms', statsStatus: 'Status',
        follow: 'Follow', open: 'Open', followers: 'followers',
    },
    ar: {
        status: 'بث مباشر الآن', statusOffline: 'غير متصل حالياً',
        headerTitle: 'المركز الرسمي لـ iCG1',
        eyebrow: 'المركز الرسمي لبثوث iCG1',
        nameAr: 'iCG1 • الحساب الرسمي',
        bio: 'تابع بثوث iCG1 المباشرة وفعاليات المجتمع وأحدث المقاطع عبر جميع المنصات.',
        tags: ['ألعاب', 'بث مباشر على كيك', 'مجتمع iCG1'],
        defaultStreamTitle: 'تابع البثوث السابقة | تابعني الآن',
        defaultCategory: 'غير متصل',
        footer: '© 2026 iCG1. جميع الحقوق محفوظة.',
        watchLive: 'شاهد البث', joinDiscord: 'انضم للديسكورد',
        subOnly: 'للمشتركين فقط', dropsEnabled: 'الجوائز مفعلة', noTags: 'لا يوجد وسوم',
        shareTitle: 'مركز بث iCG1', shareText: 'تابع بث iCG1 المباشر على كيك!', copied: 'تم نسخ الرابط!',
        lastSessionReport: 'تقرير الجلسة الأخيرة', ago: 'منذ', duration: 'المدة',
        categoriesSpent: 'الفئات التي تم بثها', highlights: 'لقطات ممتعة من البث',
        socialsTitle: 'ساحة التواصل', socialsSub: 'كل المنصات في مكان واحد — اختر ساحتك.',
        communityTitle: 'مقر المجتمع', supportTitle: 'ادعم iCG1', supportSub: 'ادعم البث من خلال صفحة الدعم الرسمية.',
        tiersTitle: 'مستويات التنبيه الخاصة', pollLive: 'تصويت مباشر',
        theaterTitle: 'مسرح البث المباشر', viewers: 'مشاهد',
        statsFollowers: 'إجمالي المتابعين', statsKick: 'إجمالي المتابعين', statsViews: 'زيارة للموقع', statsPlatforms: 'منصة', statsStatus: 'الحالة',
        follow: 'تابع', open: 'افتح', followers: 'متابع',
    }
};

// ================= DESIGN SYSTEM =================

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; as?: 'div' | 'section' }> = ({ children, delay = 0, className = '' }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            el.classList.add('is-visible');
            return;
        }
        if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return; }
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('is-visible'); obs.disconnect(); } });
        }, { threshold: 0.01, rootMargin: '0px 0px 200px 0px' });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
};

const ArenaBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const MIN_DT = isMobile ? 66 : 33;
        const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);

        let raf = 0;
        let running = true;
        let scrolling = false;
        let scrollTimer = 0;
        let last = 0;
        let w = 0;
        let h = 0;

        type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; warm: boolean };
        let parts: P[] = [];

        const makeSprite = (core: string, glow: string) => {
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d')!;
            const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grd.addColorStop(0, core);
            grd.addColorStop(0.18, core);
            grd.addColorStop(0.42, glow);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grd;
            g.fillRect(0, 0, size, size);
            return c;
        };
        const spriteWarm = makeSprite('rgba(196,154,112,0.9)', 'rgba(196,154,112,0.25)');
        const spriteCool = makeSprite('rgba(255,255,255,0.7)', 'rgba(255,255,255,0.08)');

        const resize = () => {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.round(w * DPR);
            canvas.height = Math.round(h * DPR);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            const n = Math.min(isMobile ? 12 : 45, Math.floor(w / 32));
            parts = Array.from({ length: n }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                r: 0.6 + Math.random() * 1.8,
                vy: -(0.1 + Math.random() * 0.4), vx: (Math.random() - 0.5) * 0.15,
                a: 0.12 + Math.random() * 0.35, warm: Math.random() > 0.75,
            }));
        };

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            if (!running || scrolling) { last = now; return; }
            if (now - last < MIN_DT) return;
            last = now;

            ctx.clearRect(0, 0, w, h);
            for (const p of parts) {
                p.y += p.vy;
                p.x += p.vx;
                if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
                if (p.x < -8) p.x = w + 8;
                if (p.x > w + 8) p.x = -8;

                const s = p.r * 10;
                ctx.globalAlpha = p.a;
                ctx.drawImage(p.warm ? spriteWarm : spriteCool, p.x - s / 2, p.y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
        };

        const onVisibility = () => {
            running = document.visibilityState === 'visible';
            last = 0;
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        const onScroll = () => {
            scrolling = true;
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(() => { scrolling = false; last = 0; }, 220);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(scrollTimer);
            window.removeEventListener('resize', resize);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);
    return (
        <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true" style={{
          backgroundImage: `
            linear-gradient(180deg, 
              rgba(11, 9, 7, 0.05) 0%, 
              rgba(11, 9, 7, 0.15) 30%, 
              rgba(11, 9, 7, 0.35) 60%, 
              rgba(11, 9, 7, 0.6) 85%, 
              #0b0907 100%
            ),
            url('/brand/4543.png')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'scroll',
        }}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0b0907]/15" />
            <div className="absolute bottom-0 inset-x-0 h-64 md:h-[25vh] bg-gradient-to-t from-[#0b0907] via-[#0b0907]/60 to-transparent" />
            <div className="absolute inset-0 grid-lines opacity-20" />
            <div className="absolute -top-32 right-[-8%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full opacity-40 animate-aurora"
                style={{ background: 'radial-gradient(circle, rgba(196,154,112,0.35) 0%, rgba(196,154,112,0.08) 45%, transparent 75%)' }} />
            <div className="absolute top-[25%] left-[-10%] w-[38vw] h-[38vw] max-w-[500px] max-h-[500px] rounded-full opacity-35 animate-aurora"
                style={{ animationDelay: '-5s', background: 'radial-gradient(circle, rgba(83,252,24,0.25) 0%, rgba(83,252,24,0.05) 45%, transparent 75%)' }} />
            <div className="absolute bottom-[-15%] right-[15%] w-[32vw] h-[32vw] max-w-[420px] max-h-[420px] rounded-full opacity-30 animate-aurora"
                style={{ animationDelay: '-2s', background: 'radial-gradient(circle, rgba(255,45,45,0.2) 0%, rgba(255,45,45,0.04) 45%, transparent 75%)' }} />
            <canvas ref={canvasRef} className="absolute inset-0 opacity-50" />
        </div>
    );
};
const SectionHeading: React.FC<{ no: string; title: string; sub?: string; en?: string }> = ({ no, title, sub, en }) => (
    <div className="flex items-end gap-3 md:gap-4 mb-6 md:mb-9">
        <span className="font-gaming text-3xl sm:text-4xl md:text-6xl leading-none text-stroke-red select-none shrink-0" dir="ltr">{no}</span>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
                {en && <span className="hidden sm:inline text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase" dir="ltr">{en}</span>}
            </div>
            {sub && <p className="text-[13px] md:text-sm text-white/50 mt-1 font-medium">{sub}</p>}
            <div className="mt-2.5 md:mt-3 h-px w-full bg-gradient-to-l from-[#FF2D2D]/60 via-white/10 to-transparent" />
        </div>
    </div>
);

// --- تحميل مؤجل: ما ينزّل كود القسم إلا لما الزائر يقرب منه ---
const DeferredMount: React.FC<{ children: React.ReactNode; rootMargin?: string; minHeight?: number }> = ({ children, rootMargin = '1000px', minHeight = 220 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    useEffect(() => {
        const el = ref.current;
        // Fallback timer: after 1.5s, always mount so mobile users NEVER see a blank section
        const timer = setTimeout(() => setShow(true), 1500);
        if (!el || typeof IntersectionObserver === 'undefined') {
            setShow(true);
            clearTimeout(timer);
            return;
        }
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries.some(e => e.isIntersecting)) {
                    setShow(true);
                    clearTimeout(timer);
                    obs.disconnect();
                }
            },
            { rootMargin, threshold: 0 }
        );
        obs.observe(el);
        return () => {
            clearTimeout(timer);
            obs.disconnect();
        };
    }, [rootMargin]);
    return <div ref={ref} className="h-full" style={show ? undefined : { minHeight }}>{show ? children : null}</div>;
};

const Marquee: React.FC<{ lang: Language }> = ({ lang }) => {    const items = lang === 'ar'
        ? ['بث يومي مباشر', 'ملك القبول', 'مجتمع الأساطير', 'تفاعل لا يتوقف', 'جوائز ودروبس', 'ألعاب وتحديات', 'سوالف وفعاليات']
        : ['DAILY LIVE', 'KING OF ACCEPTANCE', 'LEGENDS COMMUNITY', 'NONSTOP HYPE', 'DROPS & REWARDS', 'GAMES & CHALLENGES', 'CHATTING & EVENTS'];
    const row = [...items, ...items];
    return (
        <div className="relative -mx-3 sm:-mx-4 md:-mx-8 overflow-hidden border-y border-white/10 bg-black/75 marquee-mask" dir="ltr" aria-hidden="true">
            <div className="flex w-max animate-marquee gap-0 py-2.5 md:py-3">
                {row.map((t, i) => (
                    <span key={i} className="flex items-center gap-6 px-6 whitespace-nowrap text-[12px] md:text-sm font-black tracking-[0.25em] text-white/60">
                        <span className={i % 2 ? 'text-white/60' : 'text-[#FF2D2D]'}>{t}</span>
                        <span className="w-1.5 h-1.5 rotate-45 bg-[#FF2D2D]/70 inline-block" />
                    </span>
                ))}
            </div>
        </div>
    );
};

// --- Count-up number (rAF, reduced-motion safe) ---
const CountUp: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1300 }) => {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
        let raf = 0;
        const t0 = performance.now();
        const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);
    return <span dir="ltr">{n.toLocaleString('en-US')}</span>;
};

// --- Platform identity gradients (same palette, richer expression) ---
const BRAND_GRADIENTS: Record<string, string> = {
    KICK: 'linear-gradient(135deg, rgba(83,252,24,0.28), rgba(83,252,24,0.05) 55%, transparent)',
    Snapchat: 'linear-gradient(135deg, rgba(255,252,0,0.20), rgba(255,140,0,0.07) 55%, transparent)',
    Instagram: 'linear-gradient(135deg, rgba(225,48,108,0.28), rgba(129,52,175,0.14) 50%, rgba(255,170,60,0.08))',
    TikTok: 'linear-gradient(135deg, rgba(254,44,85,0.24), rgba(37,244,238,0.12) 60%, transparent)',
    Twitch: 'linear-gradient(135deg, rgba(169,112,255,0.28), rgba(169,112,255,0.06) 55%, transparent)',
    X: 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 60%, transparent)',
    Discord: 'linear-gradient(135deg, rgba(88,101,242,0.30), rgba(88,101,242,0.07) 55%, transparent)',
    YouTube: 'linear-gradient(135deg, rgba(255,0,0,0.26), rgba(255,0,0,0.05) 55%, transparent)',
};

// --- Social Card — premium edition (same data + behavior) ---
const SocialCard: React.FC<{ social: SocialLink; index: number; featured?: boolean; lang: Language }> = ({ social, index, featured = false, lang }) => {
    const [hover, setHover] = useState(false);
    const brand = social.hex || '#ffffff';
    const bright = social.name === 'Snapchat' || social.name === 'KICK';
    const active = hover;
    const card = (
        <div className="card-sheen relative h-full rounded-[22px] border bg-[#0b0b0b]/92 overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-[0.985]"
            style={{ borderColor: active ? `${brand}99` : 'rgba(255,255,255,0.09)', boxShadow: active ? `0 18px 44px -16px ${brand}66, inset 0 1px 0 rgba(255,255,255,0.08)` : '0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            {/* brand wash */}
            <div className="absolute inset-0 pointer-events-none transition-opacity duration-500" style={{ background: BRAND_GRADIENTS[social.name] || `linear-gradient(135deg, ${brand}22, transparent 60%)`, opacity: active ? 1 : 0.75 }} />
            {/* giant watermark icon */}
            <div className="absolute -end-3 -bottom-5 opacity-[0.07] group-hover:opacity-[0.13] transition-opacity duration-500 pointer-events-none scale-[2.6] origin-bottom" style={{ color: brand }}>
                {social.icon}
            </div>
            {/* top energy line */}
            <span className="absolute top-0 start-6 end-6 h-[2.5px] rounded-full transition-all duration-500" style={{ background: `linear-gradient(90deg, transparent, ${brand}, transparent)`, opacity: active ? 1 : 0.3, boxShadow: active ? `0 0 18px ${brand}` : 'none' }} />
            <div className={`relative p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 ${featured ? 'min-h-[128px]' : 'min-h-[104px]'}`}>
                {/* icon medallion */}
                <div className={`${featured ? 'w-[68px] h-[68px]' : 'w-[60px] h-[60px]'} rounded-[18px] flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-[1.06] group-hover:-rotate-3`}
                    style={{
                        color: active && bright ? '#000' : brand,
                        background: active && bright ? brand : `linear-gradient(160deg, ${brand}2e, rgba(255,255,255,0.04))`,
                        border: `1.5px solid ${active ? brand : 'rgba(255,255,255,0.13)'}`,
                        boxShadow: active ? `0 0 26px ${brand}55, inset 0 1px 0 rgba(255,255,255,0.25)` : `inset 0 1px 0 rgba(255,255,255,0.08)`
                    }}>
                        {social.icon}
                </div>
                {/* texts */}
                <div className="min-w-0 flex-1 text-right">
                    <div className="flex items-center gap-1.5 flex-wrap justify-start">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: active ? brand : 'rgba(255,255,255,0.48)' }}>
                            {social.name}
                        </span>
                        {featured && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-[3px] rounded-full bg-[#53FC18]/15 border border-[#53FC18]/45 text-[#53FC18] tracking-[0.14em]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#53FC18] animate-pulse" />MAIN STAGE
                            </span>
                        )}
                    </div>
                    <p className={`font-black text-white truncate leading-tight mt-0.5 text-right ${featured ? 'text-[22px] sm:text-2xl' : 'text-[17px]'}`}>
                        <span dir="ltr" className="inline-block">{social.username}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 justify-start">
                        {social.followerCount && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-white/85" dir="ltr">
                                <svg className="w-3 h-3 text-white/40" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
                                {social.name === 'Snapchat' ? (
                                    <span className="blur-[1.5px] select-none opacity-85 tracking-wide">{social.followerCount}</span>
                                ) : (
                                    social.followerCount
                                )}
                            </span>
                        )}
                        {social.specialDetail && <span className="text-[11px] text-white/40 font-medium truncate">{social.specialDetail}</span>}
                    </div>
                </div>
                {/* CTA */}
                <span className={`shrink-0 flex items-center justify-center rounded-full font-black transition-all duration-300 ${featured ? 'w-12 h-12' : 'w-11 h-11'}`}
                    style={{
                        background: active ? brand : 'rgba(255,255,255,0.07)',
                        color: active ? (bright ? '#000' : '#fff') : '#fff',
                        border: `1.5px solid ${active ? brand : 'rgba(255,255,255,0.14)'}`,
                        boxShadow: active ? `0 0 20px ${brand}66` : 'none'
                    }}>
                    <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </span>
            </div>
            {/* bottom fill line */}
            <span className="absolute bottom-0 start-0 h-[2px] transition-all duration-500" style={{ width: active ? '100%' : '0%', background: brand, boxShadow: `0 0 10px ${brand}` }} />
        </div>
    );
    return (
        <a href={social.url} target="_blank" rel="noopener noreferrer" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
            className="group relative block animate-fade-in-up select-none rounded-[22px]"
            title={`${social.name} - ${BRAND_NAME} Official`} aria-label={lang === 'ar' ? `تابع ${BRAND_NAME} على ${social.name}` : `Visit ${BRAND_NAME} on ${social.name}`}>
            {featured ? (
                <div className="rounded-[24px] p-[1.5px] bg-gradient-to-l from-[#53FC18] via-[#53FC18]/25 to-[#FF2D2D]/70 shadow-[0_0_35px_rgba(83,252,24,0.15)]">
                    <div className="rounded-[22.5px] bg-[#0b0b0b]">{card}</div>
                </div>
            ) : (
                <>
                    <div className="absolute -inset-0.5 rounded-[24px] opacity-0 group-hover:opacity-100 group-active:opacity-60 transition-opacity duration-500 blur-xl pointer-events-none" style={{ background: `linear-gradient(135deg, ${brand}44, transparent 65%)` }} />
                    {card}
                </>
            )}
        </a>
    );
};

// ============ SUPPORTERS — official Creators.sa support link ============
type Supporter = { id: number; name: string; amount: number; currency: string; message?: string; source: string; created_at: string };

const rankRing = (rank: number): string => {
    if (rank === 1) return 'conic-gradient(from 200deg, #f1d9b5, #986a3e, #fff1d7, #986a3e, #f1d9b5)';
    if (rank === 2) return 'conic-gradient(from 200deg, #d6d0c7, #66615a, #f5f0e9, #66615a, #d6d0c7)';
    if (rank === 3) return 'conic-gradient(from 200deg, #d7a27c, #784b30, #f0c5a2, #784b30, #d7a27c)';
    return 'conic-gradient(from 200deg, #c6a474, #3b2b1c, #ead2ad, #3b2b1c, #c6a474)';
};

const RankAvatar: React.FC<{ name: string; rank: number; size: string }> = ({ name, rank, size }) => {
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    return (
        <span className={`relative ${size} rounded-full p-[2.5px] shrink-0 block`} style={{ background: rankRing(rank) }}>
            <span className="w-full h-full rounded-full bg-[#070b16] flex items-center justify-center font-black text-white">{initial}</span>
        </span>
    );
};

// Rank square: engraved bronze and champagne
const RankBadge: React.FC<{ rank: number; big?: boolean }> = ({ rank, big = false }) => (
    <span
        className={`${big ? 'w-12 h-12 text-xl' : 'w-9 h-9 text-base sm:w-11 sm:h-11 sm:text-lg'} rounded-xl font-gaming shrink-0 flex items-center justify-center text-white`}
        dir="ltr"
        style={{
            background: 'linear-gradient(to left, #ead2ad 0%, #c6a474 52%, #8b6342 100%)',
            textShadow: '0 2px 4px rgba(0,0,0,0.7)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.45), 0 6px 16px -6px rgba(177,129,83,0.45)',
        }}
    >
        {rank}
    </span>
);

// Special alert tiers — 3D metal bars ladder
const TIERS = [
    { amount: '25$', c: '#9f7048', name: 'BRONZE', h: '28%' },
    { amount: '99$', c: '#b7b3ad', name: 'SILVER', h: '42%' },
    { amount: '300$', c: '#d5b16f', name: 'GOLD', h: '60%' },
    { amount: '505$', c: '#d9c8ad', name: 'PLATINUM', h: '80%' },
    { amount: '999$', c: '#ead2ad', name: 'CHAMPAGNE', h: '100%' },
];

const AlertTiers: React.FC<{ title: string; note: string }> = ({ title, note }) => (
    <div className="card-sheen mt-6 rounded-[26px] border border-white/10 bg-black/70 p-5 md:p-6 overflow-hidden">
        <p className="text-center text-[10px] md:text-[11px] font-black text-white/50 tracking-[0.3em] uppercase mb-5">{title}</p>
        <div className="flex items-end justify-center gap-2 sm:gap-4 h-44 sm:h-52" dir="ltr">
            {TIERS.map((tr, i) => (
                <div key={tr.amount} className="flex flex-col items-center justify-end h-full w-[17%] max-w-[110px] min-w-0">
                    <p className="text-sm sm:text-lg font-black tracking-wider mb-1.5" style={{ color: tr.c, textShadow: '0 2px 0 #000' }} dir="ltr">{tr.amount}</p>
                    <div className="tier-bar relative w-full rounded-t-xl border-x border-t overflow-hidden"
                        style={{ height: tr.h, background: `linear-gradient(to bottom, ${tr.c}, ${tr.c}66 55%, rgba(0,0,0,0.55))`, borderColor: `${tr.c}77`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 16px rgba(0,0,0,0.5), 0 0 24px -6px ${tr.c}88`, animationDelay: `${i * 110}ms` }}>
                        <div className="absolute top-0 inset-x-2 h-1.5 rounded-full bg-white/50 blur-[1px]" />
                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.12] to-transparent" />
                    </div>
                    <div className="w-full h-2 rounded-b-md bg-black/70 border-x border-b border-white/10" />
                    <p className="text-[8px] sm:text-[9px] font-black tracking-[0.22em] text-white/40 mt-1.5">{tr.name}</p>
                </div>
            ))}
        </div>
        <p className="text-center text-[10px] text-white/30 mt-4 font-medium">{note}</p>
    </div>
);

// Static-3D donate gate with true brand identities + ambient effects (3D stays fixed)
const DonateGate: React.FC<{
    lang: Language; title: string; url: string;
    color: string; color2?: string; label: string;
    markImg?: string; glyph?: string;
    secure: string; cta: string;
}> = ({ lang, title, url, color, color2, label, markImg, glyph = '$', secure, cta }) => {
    const [hover, setHover] = useState(false);
    const [busy, setBusy] = useState(false);
    const go = (e: React.MouseEvent) => {
        e.preventDefault(); if (busy) return; setBusy(true);
        window.setTimeout(() => { window.open(url, '_blank'); window.setTimeout(() => setBusy(false), 600); }, 350);
    };
    const frame = color2
        ? `linear-gradient(165deg, ${color}, ${color2} 55%, ${color})`
        : `linear-gradient(165deg, ${color}99, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.04) 60%, ${color}55)`;
    const glowBg = color2
        ? `linear-gradient(150deg, ${color}55, ${color2}44 60%, transparent)`
        : `linear-gradient(150deg, ${color}44, transparent 60%)`;
    const wash = color2
        ? `linear-gradient(140deg, ${color}26, ${color2}1a 55%, transparent)`
        : `linear-gradient(140deg, ${color}1f, transparent 55%)`;
    const topLine = color2
        ? `linear-gradient(90deg, transparent, ${color}, ${color2}, transparent)`
        : `linear-gradient(90deg, transparent, ${color}, transparent)`;
    const ctaBg = color2 ? `linear-gradient(135deg, ${color}, ${color2})` : `linear-gradient(180deg, #fff 0%, ${color} 65%, ${color})`;
    const ctaColor = color2 ? '#fff' : '#000';
    return (
        <a href={url} onClick={go} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            className="group relative block rounded-[26px] [perspective:900px]" aria-label={`${title} donation`}>
            <div className="absolute -inset-1 rounded-[28px] pointer-events-none transition-opacity duration-300 animate-pulse-slow" style={{ background: glowBg, opacity: hover ? 0.9 : 0.45 }} />
            <div className="rounded-[26px] p-[2px] transition-transform duration-300 group-hover:scale-[1.01]" style={{ background: frame }}>
                <div className="card-sheen relative rounded-[24px] bg-[#0b0b0b] overflow-hidden [transform-style:preserve-3d]">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: wash }} />
                    <div className="absolute top-0 inset-x-10 h-[2px] rounded-full" style={{ background: topLine }} />
                    <div className="relative p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color }}>{busy ? (lang === 'en' ? 'OPENING…' : 'جاري الفتح…') : label}</span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-[0.2em] text-white/45 uppercase">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                {secure}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-4 [transform:translateZ(34px)]">
                            <span className="relative w-16 h-16 sm:w-[76px] sm:h-[76px] rounded-[20px] flex items-center justify-center shrink-0 overflow-hidden transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
                                style={markImg
                                    ? { border: `1.5px solid ${color}77`, boxShadow: `0 14px 30px -10px ${color}77, inset 0 1px 0 rgba(255,255,255,0.25)` }
                                    : { background: `linear-gradient(160deg, ${color}, ${color}88)`, border: `1.5px solid ${color}`, boxShadow: `0 14px 30px -10px ${color}88, inset 0 1px 0 rgba(255,255,255,0.4)` }}>
                                {markImg
                                    ? <img src={markImg} alt={`${title} logo`} className="w-full h-full object-cover" loading="lazy" />
                                    : <span className="text-3xl sm:text-4xl font-black text-black" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}>{glyph}</span>}
                            </span>
                            <h3 className="font-black text-white tracking-tight leading-none text-[34px] sm:text-[40px] [transform:translateZ(18px)]"
                                style={{ textShadow: '0 1px 0 #000, 0 2px 0 #000, 0 3px 0 rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.8)' }} dir="ltr">{title}</h3>
                        </div>
                        <span className="mt-5 w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl font-black text-sm transition-all duration-300 group-hover:brightness-110 group-active:scale-[0.98]"
                            style={{ background: ctaBg, color: ctaColor, boxShadow: hover ? `0 0 28px ${color}88` : `0 10px 24px -10px ${color}88`, textShadow: color2 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none' }}>
                            {cta}
                            <svg className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </span>
                    </div>
                </div>
            </div>
        </a>
    );
};

const SupportArena: React.FC<{ lang: Language; supporters: Supporter[] }> = ({ lang }) => {
    const t = TRANSLATIONS[lang];
    return (
        <div className="w-full">
            {/* Official support destination */}
            <div className="relative">
                <div className="absolute -top-10 right-0 w-64 h-64 rounded-full animate-aurora pointer-events-none" aria-hidden="true"
                    style={{ background: 'radial-gradient(circle, rgba(198,164,116,0.2) 0%, rgba(198,164,116,0.07) 40%, transparent 68%)' }} />
                <div className="relative max-w-2xl mx-auto grid grid-cols-1 gap-3 md:gap-5" dir="rtl">
                    <DonateGate lang={lang} title="CREATORS" url={BRAND_LINKS.support} color="#C6A474" markImg="/creators-mark.png"
                        label={lang === 'en' ? 'OFFICIAL SUPPORT' : 'صفحة الدعم الرسمية'}
                        secure={lang === 'en' ? 'SECURE' : 'آمن'}
                        cta={lang === 'en' ? 'Support on Creators.sa' : 'ادعم عبر كريترز'} />
                </div>
            </div>

            <div className="mt-6 md:mt-8">
                <AlertTiers title={t.tiersTitle} note={lang === 'en' ? 'Donations are non-refundable' : 'التبرعات غير قابلة للاسترداد'} />
            </div>
        </div>
    );
};

export default function App() {
    const [isHoveringProfile, setIsHoveringProfile] = useState(false);
    const [lang, setLang] = useState<Language>('ar');
    const [branding] = useState({ profileImage: DEFAULT_PROFILE_IMAGE, bannerImage: PC_BACKGROUND });

    const [socialStats, setSocialStats] = useState<Record<string, string>>({
        'KICK': '1.1K', 'Snapchat': '1.0K+', 'Instagram': '5.0K', 'TikTok': '6.1K',
        'Twitch': '14.3K', 'X': '111', 'XFollowing': '206', 'Discord': '380', 'YouTube': '1.0K'
    });
    const [isRefreshingStats, setIsRefreshingStats] = useState(false);
    const [rawSocialCounts, setRawSocialCounts] = useState<Record<string, number>>({
        kick: 1114,
        youtube: 1041,
        tiktok: 6055,
        twitch: 14310,
        instagram: 4972,
        twitter: 111,
        discord: 380,
        snapchat: 1000, // Explicitly 1,000 followers as requested
    });

    const totalFollowersCount = useMemo(() => {
        return Object.values(rawSocialCounts).reduce((sum: number, n: number) => sum + (n || 0), 0);
    }, [rawSocialCounts]);

    const formattedTotalFollowers = useMemo(() => {
        if (totalFollowersCount >= 1000000) return `${(totalFollowersCount / 1000000).toFixed(1)}M`;
        if (totalFollowersCount >= 1000) return `${(totalFollowersCount / 1000).toFixed(1)}K`;
        return totalFollowersCount.toLocaleString();
    }, [totalFollowersCount]);

    const [socials, setSocials] = useState<SocialLink[]>([]);
    const [lastSession, setLastSession] = useState<any>(null);
    const [pastSessions, setPastSessions] = useState<any[]>([]);
    const [clips, setClips] = useState<any[]>([]);
    const [supporters, setSupporters] = useState<any[]>([]);

    const [visitorCount, setVisitorCount] = useState(0);
    const [activePoll, setActivePoll] = useState<any>(null);

    const [sponsors, setSponsors] = useState<any[]>([]);
    const [clipsList, setClipsList] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [isScheduleActive, setIsScheduleActive] = useState(true);
    const [faqs, setFaqs] = useState<any[]>([]);
    const [isFaqActive, setIsFaqActive] = useState(true);

    const fetchPublicData = async () => {
        try {
            // Parallel: one round-trip instead of 8 sequential ones
            const [sponRes, clpRes, schRes, fqRes, schToggleRes, faqToggleRes, seoRes] = await Promise.all([
                supabase.from('sponsors').select('*').order('id', { ascending: false }),
                supabase.from('highlight_clips').select('*').order('id', { ascending: false }),
                supabase.from('schedule').select('*').order('id', { ascending: true }),
                supabase.from('faqs').select('*').order('id', { ascending: false }),
                supabase.from('announcements').select('*').eq('id', 2).single(),
                supabase.from('announcements').select('*').eq('id', 3).single(),
                supabase.from('seo_settings').select('*').eq('id', 1).single(),
            ]);

            setSponsors(sponRes.data || []);
            setClipsList(clpRes.data || []);
            setSchedule(schRes.data || []);
            setFaqs(fqRes.data || []);

            const schToggle = schToggleRes.data;
            if (schToggle) setIsScheduleActive(schToggle.is_active === true || schToggle.is_active === 'true');
            else setIsScheduleActive(true);
            const faqToggle = faqToggleRes.data;
            if (faqToggle) setIsFaqActive(faqToggle.is_active === true || faqToggle.is_active === 'true');
            else setIsFaqActive(true);

            const seo = seoRes.data;
            if (seo) {
                document.title = seo.title || "iCG1 Stream Hub";
                const setMeta = (name: string, content: string, isProperty = false) => {
                    if (!content) return;
                    const attr = isProperty ? 'property' : 'name';
                    let meta = document.querySelector(`meta[${attr}="${name}"]`);
                    if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attr, name); document.head.appendChild(meta); }
                    meta.setAttribute('content', content);
                };
                setMeta('description', seo.description);
                setMeta('keywords', seo.keywords || 'iCG1, Kick, Creator');
                setMeta('og:title', seo.title, true);
                setMeta('og:description', seo.description, true);
            }
        } catch (e) { console.error("Public Data Fetch Exception:", e); }
    };

    useEffect(() => {
        let isTracked = false;
        const initData = async () => {
            if (!sessionStorage.getItem('site_visited') && !isTracked) {
                isTracked = true;
                sessionStorage.setItem('site_visited', 'true');
                try {
                    const { data: rpcCount, error: rpcErr } = await supabase.rpc('increment_site_visitors');
                    if (!rpcErr && typeof rpcCount === 'number') {
                        setVisitorCount(rpcCount);
                    } else {
                        const { data: overall } = await supabase.from('site_stats').select('visits').eq('id', 1).single();
                        if (overall) {
                            const newVisits = (Number(overall.visits) || 0) + 1;
                            await supabase.from('site_stats').update({ visits: newVisits }).eq('id', 1);
                            setVisitorCount(newVisits);
                        }
                    }
                } catch {
                    /* offline or db initializing */
                }
            } else {
                try {
                    const { data: overall } = await supabase.from('site_stats').select('visits').eq('id', 1).single();
                    if (overall) setVisitorCount(Number(overall.visits) || 0);
                } catch {}
            }
            fetchPublicData();
        };
        initData();


        const fetchLive = async () => {
            const [statRes, pollRes] = await Promise.all([
                supabase.from('site_stats').select('visits').eq('id', 1).single(),
                supabase.from('polls').select('*').eq('is_active', true).order('id', { ascending: false }).limit(1).single(),
            ]);
            if (statRes.data) setVisitorCount(statRes.data.visits);
            setActivePoll(pollRes.data || null);
        };
        fetchLive();
        // يتوقف التحديث التلقائي والتبويب مخفي
        let interval: ReturnType<typeof setInterval> | null = null;
        const startLive = () => { if (!interval) interval = setInterval(fetchLive, 30000); };
        const stopLive = () => { if (interval) { clearInterval(interval); interval = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { fetchLive(); startLive(); } else stopLive(); };
        startLive();
        document.addEventListener('visibilitychange', onVis);
        return () => { stopLive(); document.removeEventListener('visibilitychange', onVis); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Supporters wall — reads public `donations` table (graceful when missing/empty)
    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await supabase.from('donations').select('*').eq('is_visible', true).order('amount', { ascending: false }).limit(24);
                if (!error && data) setSupporters(data);
            } catch { /* table may not exist yet */ }
        })();
    }, []);
    // Live social counters — dedicated automatic loop + instant cache paint
    const applySocialStats = useCallback((stats: SocialMediaStats) => {
        setRawSocialCounts(prev => ({
            ...prev,
            instagram: typeof stats.instagram === 'number' && stats.instagram > 0 ? stats.instagram : prev.instagram,
            tiktok: typeof stats.tiktok === 'number' && stats.tiktok > 0 ? stats.tiktok : prev.tiktok,
            twitter: typeof stats.twitter === 'number' && stats.twitter > 0 ? stats.twitter : prev.twitter,
            youtube: typeof stats.youtube === 'number' && stats.youtube > 0 ? stats.youtube : prev.youtube,
            twitch: typeof stats.twitch === 'number' && stats.twitch > 0 ? stats.twitch : prev.twitch,
            discord: typeof stats.discord === 'number' && stats.discord > 0 ? stats.discord : prev.discord,
            snapchat: 1000,
        }));
        setSocialStats(prev => {
            const next = { ...prev };
            if (stats.instagram && stats.instagram > 0) next.Instagram = formatFollowerCount(stats.instagram);
            if (stats.tiktok && stats.tiktok > 0) next.TikTok = formatFollowerCount(stats.tiktok);
            if (stats.twitter && stats.twitter > 0) next.X = formatFollowerCount(stats.twitter);
            if (typeof stats.twitterFollowing === 'number' && stats.twitterFollowing >= 0) next.XFollowing = formatFollowerCount(stats.twitterFollowing);
            if (stats.youtube && stats.youtube > 0) next.YouTube = formatFollowerCount(stats.youtube);
            if (stats.twitch && stats.twitch > 0) next.Twitch = formatFollowerCount(stats.twitch);
            if (stats.discord && stats.discord > 0) next.Discord = formatFollowerCount(stats.discord);
            return next;
        });
    }, []);

    const refreshAllSocialStats = useCallback(async () => {
        try {
            const stats = await getAllSocialMediaStats();
            applySocialStats(stats);
        } catch { /* silent */ }
    }, [applySocialStats]);

    useEffect(() => {
        const cached = readSocialCache();
        if (cached) applySocialStats(cached);
        refreshAllSocialStats();
        let socialInterval: ReturnType<typeof setInterval> | null = null;
        const startSocials = () => { if (!socialInterval) socialInterval = setInterval(refreshAllSocialStats, SOCIAL_TTL_MS); };
        const stopSocials = () => { if (socialInterval) { clearInterval(socialInterval); socialInterval = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') startSocials(); else stopSocials(); };
        startSocials();
        document.addEventListener('visibilitychange', onVis);
        return () => { stopSocials(); document.removeEventListener('visibilitychange', onVis); };
    }, [applySocialStats, refreshAllSocialStats]);

    const handleVote = async (optionId: number) => {
        if (!activePoll || localStorage.getItem(`voted_${activePoll.id}`)) return;
        const newOptions = activePoll.options.map((opt: any) => opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt);
        await supabase.from('polls').update({ options: newOptions }).eq('id', activePoll.id);
        setActivePoll({ ...activePoll, options: newOptions });
        localStorage.setItem(`voted_${activePoll.id}`, 'true');
    };

    useEffect(() => {
        const updated = [
            { ...KICK_SOCIAL, followerCount: socialStats['KICK'] },
            createSocialLink('youtube', BRAND_LINKS.youtube, socialStats['YouTube'], lang === 'ar' ? 'المقاطع والمحتوى' : 'Videos and creator content'),
            createSocialLink('tiktok', BRAND_LINKS.tiktok, socialStats['TikTok'], lang === 'ar' ? 'مقاطع وتحديات' : 'Shorts and highlights'),
            createSocialLink('twitch', BRAND_LINKS.twitch, socialStats['Twitch'], lang === 'ar' ? 'تابع البث على تويتش' : 'Watch on Twitch'),
            createSocialLink('instagram', BRAND_LINKS.instagram, socialStats['Instagram'], lang === 'ar' ? 'صور وكواليس' : 'Photos and behind the scenes'),
            createSocialLink('snapchat', BRAND_LINKS.snapchat, socialStats['Snapchat'] || '1.0K+', lang === 'ar' ? 'يوميات وتغطيات' : 'Stories and updates'),
            createSocialLink('twitter', BRAND_LINKS.x, socialStats['X'], lang === 'ar' ? 'آخر الأخبار والتحديثات' : 'News and updates'),
            createSocialLink('discord', BRAND_LINKS.discord, socialStats['Discord'], lang === 'ar' ? 'مجتمع iCG1 الرسمي' : 'Official iCG1 community'),
        ].filter(Boolean) as SocialLink[];
        setSocials(updated);
    }, [socialStats, lang]);

    const [streamInfo, setStreamInfo] = useState({ isLive: false, viewers: 0, title: '', category: '', tags: [] as string[] });
    const t = TRANSLATIONS[lang];

    const fetchKickStatus = useCallback(async () => {
        try {
            // الثلاث طلبات مع بعض بدل ما تكون متتابعة
            const [channelData, videosRawData, clipsRawData] = await Promise.all([
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}`, true),
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/videos`, true),
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/clips?limit=30`, true),
            ]);

            const data = channelData;
            if (data) {
                const livestreamData = data.livestream || data.live_stream;
                const isLive = livestreamData && (livestreamData.is_live === true || livestreamData.is_live === 1);
                if (isLive) {
                    setStreamInfo({
                        isLive: true,
                        viewers: livestreamData.viewer_count || 0,
                        title: livestreamData.session_title || livestreamData.title || 'Live Stream',
                        category: livestreamData.categories?.[0]?.name || 'Just Chatting',
                        tags: livestreamData.tags ? livestreamData.tags.map((tg: any) => tg.name || tg) : []
                    });
                } else setStreamInfo(prev => ({ ...prev, isLive: false }));
                if (data.followers_count !== undefined || data.followersCount !== undefined) {
                    const rawVal = data.followers_count ?? data.followersCount;
                    const count = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal), 10) || 1114;
                    setRawSocialCounts(prev => ({ ...prev, kick: count }));
                    setSocialStats(prev => ({ ...prev, 'KICK': count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString() }));
                }
            }

            const videosArray = videosRawData?.videos || (Array.isArray(videosRawData) ? videosRawData : []);
            if (videosArray?.length > 0) { setLastSession(videosArray[0]); setPastSessions(videosArray.slice(1, 4)); }
            else {
                const streams = data?.previous_livestreams || data?.recent_streams || [];
                if (streams?.length > 0) { setLastSession(streams[0]); setPastSessions(streams.slice(1, 4)); }
            }

            const clipsData = clipsRawData?.data || clipsRawData;
            const clipsArray = clipsData?.clips || (Array.isArray(clipsData) ? clipsData : (clipsData?.data && Array.isArray(clipsData.data) ? clipsData.data : []));
            setClips(Array.isArray(clipsArray) ? clipsArray : []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchKickStatus();
        // ما نسأل السيرفر والتبويب مخفي — يوفّر باقة الداتا والبطارية
        let timer: ReturnType<typeof setInterval> | null = null;
        const start = () => { if (!timer) timer = setInterval(fetchKickStatus, 60000); };
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { fetchKickStatus(); start(); } else stop(); };
        start();
        document.addEventListener('visibilitychange', onVis);
        return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
    }, [fetchKickStatus]);

    const handleManualRefresh = useCallback(async () => {
        setIsRefreshingStats(true);
        try {
            await Promise.allSettled([
                fetchKickStatus(),
                refreshAllSocialStats(),
            ]);
        } finally {
            setTimeout(() => setIsRefreshingStats(false), 600);
        }
    }, [fetchKickStatus, refreshAllSocialStats]);

    const handleShare = async () => {
        const shareUrl = BRAND_LINKS.kick;
        if (navigator.share) { try { await navigator.share({ title: t.shareTitle, text: t.shareText, url: shareUrl }); } catch { /* dismissed */ } }
        else { try { await navigator.clipboard.writeText(shareUrl); } catch { /* clipboard blocked */ } alert(t.copied); }
    };

    const displayTitle = streamInfo.isLive ? streamInfo.title : t.defaultStreamTitle;
    const displayCategory = streamInfo.isLive ? streamInfo.category : t.defaultCategory;
    const kickCard = socials.find(s => s.name === 'KICK');
    const snapCard = socials.find(s => s.name === 'Snapchat');
    const restSocials = socials.filter(s => s.name !== 'KICK' && s.name !== 'Snapchat');

    useEffect(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }, [lang]);

    return (
        <div className={`icg1-theme grain relative min-h-screen w-full overflow-x-hidden ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`}>
            <ArenaBackground />

                    {/* ===== NAV — Mech Esports Arena Header ===== */}
                    <header className="fixed top-2 md:top-3 left-0 right-0 z-[60] w-full max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8" style={{ isolation: 'isolate' }}>
                        <div className="mech-header-wrap">
                            {/* Top flare */}
                            <div className="mech-flare" style={{ left: '42%' }} />

                            {/* Outer chamfered chassis with metallic bevel border */}
                            <div className="mech-chassis-outer">
                                <div className="mech-chassis-inner flex items-center justify-between px-3 sm:px-4 md:px-6 py-1.5 md:py-2 gap-2" dir="ltr">

                                    {/* ◀ LEFT: Status Pill + Refresh + Language (reaches end of logo on the left) */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                        {/* Live Status Pill */}
                                        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#16120e]/95 border border-[#c49a70]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                            <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full shrink-0 ${streamInfo.isLive ? 'bg-[#53FC18] animate-pulse shadow-[0_0_6px_#53FC18]' : 'bg-[#53FC18]'}`} />
                                            <span className="text-[10px] sm:text-[11px] font-bold text-[#eed6b6] whitespace-nowrap select-none" dir="rtl">
                                                {streamInfo.isLive ? (lang === 'en' ? 'LIVE NOW' : 'البث مباشر') : (lang === 'en' ? 'LIVE NOW' : 'البث مباشر')}
                                            </span>
                                        </div>

                                        {/* Refresh */}
                                        <button onClick={handleManualRefresh} aria-label="Refresh"
                                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#16120e]/95 border border-[#c49a70]/35 hover:border-[#f5d8a8]/70 text-[#eed6b6] hover:text-white flex items-center justify-center transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                            <svg className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${isRefreshingStats ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>

                                        {/* Language */}
                                        <button onClick={() => setLang(p => p === 'en' ? 'ar' : 'en')} aria-label="Toggle language"
                                            className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-[#16120e]/95 border border-[#c49a70]/35 hover:border-[#f5d8a8]/70 text-[#eed6b6] hover:text-white text-[10px] sm:text-[11px] font-bold flex items-center justify-center transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                            {lang === 'en' ? 'عربي' : 'EN'}
                                        </button>

                                        <span className="text-[#c49a70]/30 text-xs select-none ms-1">|</span>
                                    </div>

                                    {/* ◆ CENTER: Nav Links from left to right matching reference image */}
                                    <nav className="hidden lg:flex items-center justify-center flex-1 gap-1.5 xl:gap-2.5 px-2" aria-label="Main">
                                        {(lang === 'en'
                                            ? [
                                                { label: 'Socials', href: '#socials' },
                                                { label: 'Support', href: '#support' },
                                                { label: 'Ranks', href: '#schedule' },
                                                { label: 'Events', href: '#schedule' },
                                                { label: 'Community', href: '#community' },
                                                { label: 'Schedule', href: '#schedule' },
                                                { label: 'Live', href: '#live' },
                                                { label: 'Home', href: '#top', active: true },
                                              ]
                                            : [
                                                { label: 'التواصل', href: '#socials' },
                                                { label: 'الدعم', href: '#support' },
                                                { label: 'الرتب', href: '#schedule' },
                                                { label: 'الفعاليات', href: '#schedule' },
                                                { label: 'المجتمع', href: '#community' },
                                                { label: 'الجدول', href: '#schedule' },
                                                { label: 'البث', href: '#live' },
                                                { label: 'الرئيسية', href: '#top', active: true },
                                              ]
                                        ).map((item, i) => (
                                            <React.Fragment key={i}>
                                                <a href={item.href}
                                                    className={`relative py-1 px-2.5 text-[12px] xl:text-[13px] font-bold transition-all select-none whitespace-nowrap ${
                                                        item.active ? 'text-white font-black' : 'text-[#eed6b6]/85 hover:text-white'
                                                    }`}>
                                                    {item.label}
                                                    {item.active && (
                                                        <span className="mech-active-bar" />
                                                    )}
                                                </a>
                                                {i < 7 && <span className="text-[#c49a70]/30 text-xs select-none">|</span>}
                                            </React.Fragment>
                                        ))}
                                    </nav>

                                    {/* ▶ RIGHT: ICG1 Brand + Crest with separator */}
                                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                        <span className="text-[#c49a70]/30 text-xs select-none me-1 hidden sm:inline">|</span>
                                        <a href="#top" className="flex items-center gap-2 sm:gap-2.5 group" aria-label="iCG1 Home">
                                            <span className="font-gaming text-base sm:text-lg md:text-xl text-[#eed6b6] tracking-wider group-hover:text-white transition-colors leading-none select-none" dir="ltr">ICG1</span>
                                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-[1.5px] bg-gradient-to-b from-[#f5d8a8] via-[#c49a70] to-[#7e5535] shadow-[0_0_12px_rgba(214,174,114,0.35)] shrink-0">
                                                <div className="w-full h-full rounded-full bg-[#120c08] overflow-hidden flex items-center justify-center p-0.5">
                                                    <img src="/brand/96.gif" alt="iCG1" className="w-full h-full object-contain" />
                                                </div>
                                            </div>
                                        </a>
                                    </div>

                                </div>
                            </div>

                            {/* Mobile quick links */}
                            <div className="lg:hidden mt-1.5 mech-chassis-outer">
                                <div className="mech-chassis-inner flex items-center justify-center gap-2 py-1 px-2.5 text-[10px] font-bold text-[#eed6b6] flex-wrap">
                                    <a href="#top" className="text-white border-b-2 border-[#e6b366] px-1.5 py-0.5">{lang === 'en' ? 'Home' : 'الرئيسية'}</a>
                                    <span className="text-[#c49a70]/30">|</span>
                                    <a href="#live" className="text-[#eed6b6]/80 hover:text-white px-1.5 py-0.5">{lang === 'en' ? 'Live' : 'البث'}</a>
                                    <span className="text-[#c49a70]/30">|</span>
                                    <a href="#schedule" className="text-[#eed6b6]/80 hover:text-white px-1.5 py-0.5">{lang === 'en' ? 'Schedule' : 'الجدول'}</a>
                                    <span className="text-[#c49a70]/30">|</span>
                                    <a href="#socials" className="text-[#eed6b6]/80 hover:text-white px-1.5 py-0.5">{lang === 'en' ? 'Socials' : 'التواصل'}</a>
                                    <span className="text-[#c49a70]/30">|</span>
                                    <a href="#support" className="text-[#eed6b6]/80 hover:text-white px-1.5 py-0.5">{lang === 'en' ? 'Support' : 'الدعم'}</a>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="relative z-10 w-full max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8 pb-10 pt-14 md:pt-16">

                        {/* ===== HERO ===== */}
                        <section id="top" className="pt-6 md:pt-10 pb-6 md:pb-8 overflow-clip">
                            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-10 items-center justify-items-center lg:justify-items-stretch">
                                <div className="animate-fade-in-up w-full max-w-xl text-center lg:text-start order-2 lg:order-1">
                                    <div className="inline-flex items-center gap-2.5 rounded-full border border-[#FF2D2D]/35 bg-[#FF2D2D]/[0.08] px-4 py-1.5 mb-5">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${streamInfo.isLive ? 'bg-[#53FC18] animate-pulse shadow-[0_0_10px_#53FC18]' : 'bg-[#FF2D2D] animate-pulse shadow-[0_0_10px_#FF2D2D]'}`} />
                                        <span className="text-[10px] md:text-xs font-black tracking-[0.18em] text-white/80 uppercase">{t.eyebrow}</span>
                                    </div>
                                    <p className="text-white/45 font-bold text-xs sm:text-sm md:text-base mb-2">{t.nameAr} • <span dir="ltr" className="text-white/30">MANSOUR Al-ROUQI</span></p>
                                    <h1 className="wm-mark relative font-gaming leading-none tracking-wide select-none text-[clamp(96px,24vw,180px)] lg:text-[180px]" dir="ltr" aria-label="iCG1">
                                        <span aria-hidden="true" className="wm-depth wm-depth-1 font-gaming leading-none tracking-wide">iCG1</span>
                                        <span aria-hidden="true" className="wm-depth wm-depth-2 font-gaming leading-none tracking-wide">iCG1</span>
                                        <span aria-hidden="true" className="relative z-10">
                                            <span className="wm-letter wm-stroke">i</span><span className="wm-letter wm-stroke">C</span><span className="wm-letter wm-stroke">G</span><span className="wm-letter wm-stroke">1</span>
                                        </span>
                                        <span aria-hidden="true" className="wm-sheen font-gaming leading-none tracking-wide z-20">iCG1</span>
                                    </h1>
                                    <p className="font-gaming text-xl sm:text-2xl md:text-4xl text-stroke mt-1 tracking-wide" dir="ltr" aria-hidden="true">KING OF ACCEPTANCE</p>
                                    <p className="text-white/65 text-[15px] md:text-lg leading-relaxed max-w-xl mt-4 md:mt-5 font-medium mx-auto lg:mx-0">{t.bio}</p>
                                    <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-2.5 mt-4 md:mt-5">
                                        {t.tags.map((tag, i) => (
                                            <span key={i} className="px-3.5 sm:px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[11px] sm:text-xs font-bold text-white/75">#{tag}</span>
                                        ))}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mt-6 md:mt-7">
                                        <a href={BRAND_LINKS.kick} target="_blank" rel="noopener noreferrer"
                                            className="btn-arena inline-flex items-center justify-center gap-2.5 px-7 py-4 sm:py-3.5 rounded-2xl bg-gradient-to-b from-[#ff4d4d] to-[#FF2D2D] text-black font-black text-[15px] md:text-base shadow-[0_0_35px_rgba(255,45,45,0.45)] active:scale-[0.98]">
                                            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            {t.watchLive}
                                        </a>
                                        <a href={BRAND_LINKS.discord} target="_blank" rel="noopener noreferrer"
                                            className="btn-arena inline-flex items-center justify-center gap-2.5 px-7 py-4 sm:py-3.5 rounded-2xl bg-white/[0.06] border border-white/15 text-white font-black text-[15px] md:text-base active:scale-[0.98]">
                                            <DiscordIcon className="w-5 h-5 shrink-0" />
                                            {t.joinDiscord}
                                        </a>
                                    </div>
                                    <div className="grid grid-cols-3 w-full gap-2 sm:gap-3 mt-6 md:mt-8">
                                        {[
                                            { v: formattedTotalFollowers, l: t.statsFollowers, raw: totalFollowersCount.toLocaleString() },
                                            { v: visitorCount > 0 ? visitorCount.toLocaleString() : '—', l: t.statsViews },
                                            { v: '8', l: t.statsPlatforms },
                                        ].map((s, i) => (
                                            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur px-2 sm:px-4 py-3 sm:py-3.5 text-center min-w-0" title={s.raw ? `${s.raw} ${lang === 'ar' ? 'متابع كلي' : 'total followers'}` : undefined}>
                                                <p className="text-lg sm:text-xl md:text-2xl font-black text-white truncate" dir="ltr">{s.v}</p>
                                                <p className="text-[9px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1 truncate">{s.l}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Profile visual — first on mobile only */}
                                <div className="flex justify-center lg:justify-start animate-fade-in w-full order-1 lg:order-2" style={{ animationDelay: '150ms' }}>
                                    <div className="relative mx-6 sm:mx-8" onMouseEnter={() => setIsHoveringProfile(true)} onMouseLeave={() => setIsHoveringProfile(false)}>
                                        <div className="profile-3d-ring" />
                                        <div className="profile-3d-ring-inner" />
                                        <div className="tech-corner tech-corner-tl" /><div className="tech-corner tech-corner-tr" />
                                        <div className="tech-corner tech-corner-bl" /><div className="tech-corner tech-corner-br" />
                                        <div className="profile-visual-disc relative w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full overflow-hidden">
                                            <div className="profile-scanner" />
                                            <img src={branding.profileImage} alt={`${BRAND_NAME} official profile`} className={`w-full h-full object-cover transition-transform duration-700 ${isHoveringProfile ? 'scale-110 rotate-1' : ''}`} loading="eager" />
                                            <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(14,9,6,0.55)] pointer-events-none" />
                                        </div>
                                        <div className="absolute -bottom-2 -end-1 z-20">
                                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
                                                <div className="absolute inset-0 bg-[#53FC18] rounded-2xl blur-lg opacity-40 animate-pulse" />
                                                <div className="relative w-full h-full bg-black rounded-2xl border border-[#53FC18]/60 flex items-center justify-center rotate-6">
                                                    <KickIcon className="w-6 h-6 sm:w-7 sm:h-7 text-[#53FC18] -rotate-6" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`absolute -top-2 -start-2 sm:-start-4 glass border rounded-2xl px-3 py-2 shadow-xl animate-float-soft max-w-[150px] ${streamInfo.isLive ? 'border-[#53FC18]/40' : 'border-white/10'}`}>
                                            <p className="text-[8px] sm:text-[9px] font-black tracking-widest text-white/40 uppercase">{streamInfo.isLive ? (lang === 'en' ? 'WATCHING' : 'مشاهد') : (lang === 'en' ? 'STATUS' : 'الحالة')}</p>
                                            <p className={`text-xs sm:text-sm font-black truncate ${streamInfo.isLive ? 'text-[#53FC18]' : 'text-white/70'}`} dir="ltr">
                                                {streamInfo.isLive ? `${streamInfo.viewers.toLocaleString()} ${t.viewers}` : t.statusOffline}
                                            </p>
                                        </div>
                                        <div className="absolute top-1/3 -end-2 md:-end-10 glass border border-[#FF2D2D]/30 rounded-2xl px-3 py-2 shadow-xl animate-float hidden min-[420px]:block" style={{ animationDelay: '-2s' }}>
                                            <p className="text-[8px] sm:text-[9px] font-black tracking-widest text-[#FF2D2D] uppercase" dir="ltr">KICK</p>
                                            <p className="text-xs sm:text-sm font-black text-white" dir="ltr">{socialStats['KICK']}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <Marquee lang={lang} />

                        {/* ===== SOCIALS BENTO ===== */}
                        <section id="socials" className="pt-12 md:pt-16 scroll-mt-28">
                            <Reveal><SectionHeading no="01" title={t.socialsTitle} sub={t.socialsSub} en="SOCIAL ARENA" /></Reveal>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                {kickCard && (
                                    <Reveal delay={0} className="sm:col-span-2">
                                        <SocialCard social={kickCard} index={0} featured lang={lang} />
                                    </Reveal>
                                )}
                                {snapCard && (
                                    <Reveal delay={80}>
                                        <SocialCard social={snapCard} index={1} lang={lang} />
                                    </Reveal>
                                )}
                                {restSocials.map((s, i) => (
                                    <Reveal key={s.name} delay={Math.min(i * 60, 300)}>
                                        <SocialCard social={s} index={i + 2} lang={lang} />
                                    </Reveal>
                                ))}
                            </div>
                        </section>

                        {/* ===== LIVE THEATER — live-theater.html REPLICA ===== */}
                        <section id="live" className="relative pt-12 md:pt-16 scroll-mt-28">
                            <LiveTheater
                                lang={lang}
                                isLive={streamInfo.isLive}
                                viewers={streamInfo.viewers}
                                title={streamInfo.title || t.defaultStreamTitle}
                                category={streamInfo.category || t.defaultCategory}
                                startedAt={streamInfo.startedAt}
                                tags={streamInfo.tags}
                                channelSlug={CHANNEL_SLUG}
                                displayName={BRAND_NAME}
                                giveaways={true}
                            />
                        </section>

                        {/* ===== COMMUNITY ===== */}
                        <section id="community" className="pt-12 md:pt-16 scroll-mt-28">
                            <Reveal><SectionHeading no="03" title={t.communityTitle} en="COMMUNITY HQ" /></Reveal>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 items-stretch">
                                <Reveal delay={0} className="h-full"><DeferredMount minHeight={260}><DiscordWidget lang={lang} /></DeferredMount></Reveal>
                                <Reveal delay={100} className="h-full"><DeferredMount minHeight={260}><XWidget lang={lang} xFollowers={socialStats['X']} xFollowing={socialStats['XFollowing']} /></DeferredMount></Reveal>
                            </div>
                        </section>

                        {/* ===== SUPPORT ===== */}
                        <section id="support" className="pt-12 md:pt-16 scroll-mt-28">
                            <Reveal><SectionHeading no={streamInfo.isLive ? '04' : '03'} title={t.supportTitle} sub={t.supportSub} en="SUPPORT" /></Reveal>
                            <Reveal delay={80}><SupportArena lang={lang} supporters={supporters} /></Reveal>
                        </section>

                        {/* ===== POLL ===== */}
                        {activePoll && (
                            <section className="pt-12 md:pt-16">
                                <Reveal>
                                    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0a]/92 p-6 md:p-9 shadow-2xl">
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-transparent via-[#FF2D2D] to-transparent" />
                                        <div className="flex items-center justify-center gap-3 mb-7">
                                            <span className="w-2 h-2 rounded-full bg-[#FF2D2D] shadow-[0_0_10px_#FF2D2D] animate-pulse" />
                                            <h3 className="text-lg md:text-2xl font-black text-white text-center">{activePoll.question}</h3>
                                            <span className="w-2 h-2 rounded-full bg-[#FF2D2D] shadow-[0_0_10px_#FF2D2D] animate-pulse" />
                                        </div>
                                        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
                                            {activePoll.options.map((opt: any) => {
                                                const total = activePoll.options.reduce((s: number, o: any) => s + o.votes, 0);
                                                const pct = total === 0 ? 0 : Math.round((opt.votes / total) * 100);
                                                const voted = !!localStorage.getItem(`voted_${activePoll.id}`);
                                                return (
                                                    <button key={opt.id} onClick={() => handleVote(opt.id)} disabled={voted}
                                                        className={`relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 text-start ${voted ? 'border-white/[0.07] bg-white/[0.03] cursor-default' : 'border-white/10 bg-black/40 hover:border-[#FF2D2D]/50 hover:-translate-y-0.5'}`}>
                                                        {voted && <span className="absolute top-0 bottom-0 end-0 bg-gradient-to-l from-[#FF2D2D]/25 to-transparent transition-all duration-1000" style={{ width: `${pct}%` }} />}
                                                        <span className="relative z-10 flex justify-between items-center gap-3">
                                                            <span className="font-black text-white">{opt.text}</span>
                                                            {voted && <span className="text-sm font-black text-white/60" dir="ltr">{pct}% ({opt.votes})</span>}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-center text-[10px] text-white/30 mt-6 font-black tracking-[0.3em] uppercase">{t.pollLive}</p>
                                    </div>
                                </Reveal>
                            </section>
                        )}

                        {/* ===== LAST SESSION ===== */}
                        {!streamInfo.isLive && (
                            <section className="pt-12 md:pt-16">
                                <Suspense fallback={<div className="w-full h-48 rounded-[24px] border border-white/10 bg-white/[0.02] animate-pulse" />}>
                                    <DeferredMount minHeight={200}>
                                        <LastSessionReport lang={lang} data={lastSession} clips={clips} past={pastSessions} />
                                    </DeferredMount>
                                </Suspense>
                            </section>
                        )}

                        {/* ===== DYNAMIC: SPONSORS + CLIPS ===== */}
                        {(sponsors.length > 0 || clipsList.length > 0) && (
                            <section className="pt-12 md:pt-16 grid lg:grid-cols-2 gap-8 items-start">
                                {sponsors.length > 0 && <Reveal><SponsorsSection sponsors={sponsors} /></Reveal>}
                                {clipsList.length > 0 && <Reveal delay={100}><ClipsSection clips={clipsList} /></Reveal>}
                            </section>
                        )}

                        {(isScheduleActive || isFaqActive) && (
                            <div id="schedule" className="pt-4 scroll-mt-28">
                                {isScheduleActive && <Reveal><ScheduleSection schedule={schedule} /></Reveal>}
                                {isFaqActive && <Reveal><FAQSection faqs={faqs} /></Reveal>}
                            </div>
                        )}

                        {/* ===== STATS SECTION (كبار الداعمين، أساطير الشات، الأرشيف) ===== */}
                        <section className="pt-12 md:pt-16">
                            <Suspense fallback={<div className="w-full h-40 rounded-[26px] border border-white/10 bg-white/[0.02] animate-pulse" />}>
                                <DeferredMount minHeight={200}>
                                    <StatsSection lang={lang} />
                                </DeferredMount>
                            </Suspense>
                        </section>

                        {/* ===== FOOTER ===== */}
                        <footer className="mt-16 md:mt-24 rounded-[28px] border border-white/10 bg-black/85 overflow-hidden relative">
                            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[#FF2D2D]/70 to-transparent" />
                            <div className="p-8 md:p-12 text-center relative">
                                <p className="font-gaming text-[18vw] md:text-[120px] leading-none text-stroke opacity-40 select-none" dir="ltr" aria-hidden="true">iCG1</p>
                                <div className="flex flex-wrap justify-center gap-2.5 -mt-4 md:-mt-8 relative">
                                    {socials.map(s => (
                                        <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.name}
                                            className="btn-arena w-11 h-11 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-[#FF2D2D]/50">
                                            <span className="scale-[0.8] block">{s.icon}</span>
                                        </a>
                                    ))}
                                </div>
                                <p className="text-[11px] text-white/35 mt-1">{t.footer}</p>
                            </div>
                        </footer>
                    </div>
        </div>
    );
}
