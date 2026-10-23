import React, { useEffect, useState, useRef } from 'react';
import { Language, LeaderboardData, Clip, Video, ChannelInfo, LeaderboardEntry } from '../types';
import { KickIcon } from './Icons';
import { ChatLegends } from './ChatLegends';
import { TopSupportersArena } from './TopSupportersArena';
import { ArchiveSection } from './ArchiveSection';
import { kickFetch } from '../utils/kickApi';
import { BRAND_LINKS, KICK_CHANNEL_SLUG } from '../brand';

interface StatsSectionProps {
  lang: Language;
}

const FALLBACK_IMAGE = "/brand/icg1-logo.png";

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num || 0);
};

const fmtDur = (ms: number) => {
  const s = Math.floor((ms > 1000000 ? ms / 1000 : ms) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Skeleton Primitive
const Skeleton: React.FC<{ className: string }> = ({ className }) => (
  <div className={`bg-white/5 animate-pulse rounded-xl ${className}`}></div>
);

// Animated followers counter (rAF, reduced-motion safe)
const KickCount: React.FC<{ value: number }> = ({ value }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span dir="ltr">{n.toLocaleString('en-US')}</span>;
};

// --- CHAMPION ICONS ---

const CrownIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="crownGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="55%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
    </defs>
    <path fill="url(#crownGold)" d="M2.5 8.5 6.5 12l5.5-7 5.5 7 4-3.5L20 18H4L2.5 8.5z" />
    <rect x="4" y="18.6" width="16" height="2.2" rx="1.1" fill="url(#crownGold)" />
    <circle cx="12" cy="12.6" r="1.4" fill="#FFF7D6" />
  </svg>
);

const BoltIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="boltRose" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDA4AF" />
        <stop offset="55%" stopColor="#F43F5E" />
        <stop offset="100%" stopColor="#9F1239" />
      </linearGradient>
    </defs>
    <path fill="url(#boltRose)" d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" />
  </svg>
);

const MedalIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="medalCyan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#67E8F9" />
        <stop offset="55%" stopColor="#0891B2" />
        <stop offset="100%" stopColor="#155E75" />
      </linearGradient>
    </defs>
    <path stroke="url(#medalCyan)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M8.5 9.5 6 2h4.5L12 6.8 13.5 2H18l-2.5 7.5" />
    <circle cx="12" cy="15" r="5.2" stroke="url(#medalCyan)" strokeWidth="2.2" />
    <circle cx="12" cy="15" r="1.6" fill="url(#medalCyan)" />
  </svg>
);

interface LeaderboardCardProps {
  title: string;
  subtitle: string;
  data: LeaderboardEntry[];
  icon: React.ReactNode;
  accentColor: 'yellow' | 'rose' | 'cyan';
  isMain?: boolean;
  lang: Language;
  t: any;
  delay: number;
  emptyLabel?: string;
  className?: string;
}

const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ title, subtitle, data, icon, accentColor, isMain, lang, t, delay, emptyLabel, className }) => {

  // Config based on accent color
  const config = {
    yellow: {
      border: 'border-yellow-500/20',
      glow: 'shadow-[0_0_40px_-10px_rgba(234,179,8,0.15)]',
      text: 'text-yellow-400',
      bgIcon: 'bg-yellow-500/10',
      gradient: 'from-yellow-400 to-amber-600',
      subText: 'text-yellow-200/50',
      frame: 'from-yellow-400/70 via-yellow-400/10 to-transparent',
      glowColor: '234,179,8',
      barBright: '#FDE68A',
      barDeep: '#B45309',
      medalBg: 'linear-gradient(160deg,#FDE68A,#B45309)'
    },
    rose: {
      border: 'border-[#FF2D2D]/20',
      glow: 'shadow-[0_0_40px_-10px_rgba(255,45,45,0.15)]',
      text: 'text-[#FF2D2D]',
      bgIcon: 'bg-[#FF2D2D]/10',
      gradient: 'from-[#FF2D2D] to-red-800',
      subText: 'text-red-200/50',
      frame: 'from-[#FF2D2D]/70 via-[#FF2D2D]/10 to-transparent',
      glowColor: '255,45,45',
      barBright: '#FDA4AF',
      barDeep: '#9F1239',
      medalBg: 'linear-gradient(160deg,#FB7185,#9F1239)'
    },
    cyan: {
      border: 'border-cyan-500/20',
      glow: 'shadow-[0_0_40px_-10px_rgba(6,182,212,0.15)]',
      text: 'text-cyan-400',
      bgIcon: 'bg-cyan-500/10',
      gradient: 'from-cyan-400 to-blue-600',
      subText: 'text-cyan-200/50',
      frame: 'from-cyan-400/70 via-cyan-400/10 to-transparent',
      glowColor: '6,182,212',
      barBright: '#67E8F9',
      barDeep: '#0E7490',
      medalBg: 'linear-gradient(160deg,#67E8F9,#0E7490)'
    }
  }[accentColor];

  // Helper for Rank Badges
  const renderRankBadge = (rank: number) => {
    if (rank === 1) return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#FFD700] to-[#FDB931] shadow-[0_0_15px_rgba(255,215,0,0.5)] border border-[#FFFACD]/50 text-black font-black text-sm shrink-0">
        1
      </div>
    );
    if (rank === 2) return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] shadow-[0_0_10px_rgba(192,192,192,0.3)] border border-white/50 text-black font-black text-xs shrink-0">
        2
      </div>
    );
    if (rank === 3) return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E6A373] to-[#8B4513] shadow-[0_0_10px_rgba(205,127,50,0.3)] border border-[#FFDAB9]/30 text-white font-black text-[10px] shrink-0">
        3
      </div>
    );
    return (
      <span className="w-6 text-center text-xs font-bold text-white/30 font-mono shrink-0">
        {rank < 10 ? `0${rank}` : rank}
      </span>
    );
  };

  // Render Empty State
  if (!data || data.length === 0) {
    return (
      <div className={`
                 relative flex flex-col items-center justify-center p-6 text-center rounded-[26px] overflow-hidden
                 bg-[#080808]/90 border border-dashed border-white/10
                 transition-all duration-500 hover:border-white/20 group
                 ${isMain ? 'lg:-mt-4 z-10 min-h-[300px] md:min-h-[440px]' : 'min-h-[250px] md:min-h-[380px]'}
                 ${className}
             `}
        style={{ animationDelay: `${delay}ms` }}>
        <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-l from-transparent via-white/20 to-transparent opacity-60`} />
        <div className={`p-4 md:p-5 rounded-2xl ${config.bgIcon} mb-4 md:mb-5 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 border border-white/10`}>
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-6 h-6 md:w-8 md:h-8 ${config.text} drop-shadow-lg` })}
        </div>
        <h3 className={`text-sm md:text-base font-bold text-white/60 mb-1 uppercase tracking-[0.2em]`}>{title}</h3>
        <p className={`text-[10px] md:text-xs ${config.subText} font-medium`}>{emptyLabel || t.noData}</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  const maxQ = Math.max(1, ...sorted.map(e => e.quantity || 0));
  const totalQ = sorted.reduce((s, e) => s + (e.quantity || 0), 0);
  const champ = sorted[0];

  return (
    <div
      className={`group relative rounded-[26px] p-[1.5px] bg-gradient-to-b ${config.frame} ${isMain ? 'md:-mt-8 z-20 md:scale-[1.03]' : ''} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute -inset-1.5 rounded-[28px] blur-2xl opacity-30 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" style={{ background: `linear-gradient(180deg, rgba(${config.glowColor},0.35), transparent 60%)` }} />
      <div className="card-sheen relative rounded-[24.5px] bg-[#080808]/95 overflow-hidden perspective-1000 [transform-style:preserve-3d]">
        <div className="absolute top-0 inset-x-8 h-[2px] rounded-full opacity-80" style={{ background: `linear-gradient(90deg, transparent, rgba(${config.glowColor},0.9), transparent)` }} />

        {/* Header with 3D medallion — stacks vertically in narrow half-cards */}
        <div className={`relative p-3 sm:p-4 md:p-6 pb-3 md:pb-4 flex ${isMain ? 'flex-row' : 'flex-col'} sm:flex-row items-center gap-2.5 sm:gap-3.5 md:gap-4 border-b border-white/5 z-10`}>
          <div className={`${isMain ? 'w-12 h-12 md:w-16 md:h-16' : 'w-10 h-10 md:w-16 md:h-16'} rounded-2xl flex items-center justify-center border border-white/15 shrink-0 [transform:translateZ(28px)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6`}
            style={{ background: config.medalBg, boxShadow: `0 12px 30px -8px rgba(${config.glowColor},0.55), inset 0 1px 0 rgba(255,255,255,0.45)` }}>
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `${isMain ? 'w-6 h-6 md:w-8 md:h-8' : 'w-5 h-5 md:w-8 md:h-8'} drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]` }) : icon}
          </div>
          <div className={`min-w-0 flex-1 ${isMain ? '' : 'text-center sm:text-start'}`}>
            <h3 className={`text-base sm:text-lg md:text-2xl font-black text-white tracking-tight leading-none mb-1 ${lang === 'ar' ? 'font-arabic' : ''}`}>{title}</h3>
            <span className={`text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.22em] md:tracking-[0.3em] bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}>{subtitle}</span>
          </div>
          <div className={`${isMain ? 'text-end' : 'text-center sm:text-end'} shrink-0`}>
            <p className="text-base sm:text-lg md:text-xl font-black text-white leading-none" dir="ltr">{formatNumber(totalQ)}</p>
            <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] mt-1 ${config.subText}`}>{t.gift} • {sorted.length}</p>
          </div>
        </div>

        {/* Champion banner */}
        {champ && (
          <div className="mx-3 md:mx-4 mt-3 rounded-2xl p-[1px]" style={{ background: 'linear-gradient(120deg,#FDE68A,#B45309,#FDE68A)' }}>
            <div className="rounded-[15px] bg-black/85 px-2.5 sm:px-3 py-2 sm:py-2.5 flex items-center gap-2 overflow-hidden">
              <CrownIcon className="w-5 h-5 md:w-7 md:h-7 shrink-0 drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]" />
              <p className="flex-1 min-w-0 text-xs sm:text-sm md:text-base font-black text-white truncate" dir="auto">{champ.username}</p>
              <p className="text-xs sm:text-sm md:text-base font-black text-[#FFD700] shrink-0" dir="ltr">{formatNumber(champ.quantity)}</p>
            </div>
          </div>
        )}

        {/* List with progress bars */}
        <div className="flex-1 p-2.5 md:p-4 space-y-1.5 md:space-y-2.5 relative overflow-y-auto max-h-[300px] md:max-h-[400px] scrollbar-hide">
          {sorted.slice(1).map((entry, idx) => {
            const rank = idx + 2;
            const pct = Math.max(4, Math.round(((entry.quantity || 0) / maxQ) * 100));
            return (
              <div key={idx} className="relative rounded-xl md:rounded-2xl p-1.5 sm:p-2 md:p-3 transition-all duration-300 group/row hover:bg-white/[0.04] hover:-translate-y-0.5 border border-transparent hover:border-white/10">
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
                  <div className="shrink-0 flex justify-center w-8">
                    {renderRankBadge(rank)}
                  </div>
                  <span className="flex-1 min-w-0 text-xs sm:text-[13px] md:text-[15px] font-bold text-white/90 truncate group-hover/row:text-white transition-colors" dir="auto">
                    {entry.username}
                  </span>
                  <span className={`text-xs sm:text-[13px] md:text-[15px] font-black tracking-wide ${config.text} shrink-0`} dir="ltr">
                    {formatNumber(entry.quantity)}
                  </span>
                </div>
                <div className="mt-1.5 md:mt-2 ms-10 md:ms-11 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="bar-grow h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(to left, ${config.barBright}, ${config.barDeep})`, boxShadow: `0 0 8px rgba(${config.glowColor},0.5)`, animationDelay: `${idx * 80}ms`, transformOrigin: lang === 'ar' ? 'right' : 'left' }} />
                </div>
              </div>
            );
          })}
          <div className="h-3"></div>
        </div>

        {/* Bottom Fade Mask */}
        <div className="absolute bottom-0 left-0 right-0 h-12 md:h-16 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-20"></div>
      </div>
    </div>
  );
};


export const StatsSection: React.FC<StatsSectionProps> = ({ lang }) => {
  // Initialize as null to indicate "loading"
  const [leaderboards, setLeaderboards] = useState<LeaderboardData | null>(null);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);


  const t = {
    followers: lang === 'en' ? 'Followers' : 'متابع',
    topGifters: lang === 'en' ? 'Top Gifters' : 'كبار الداعمين',
    allTime: lang === 'en' ? 'All Time' : 'الأفضل',
    monthly: lang === 'en' ? 'Monthly' : 'شهرياً',
    weekly: lang === 'en' ? 'Weekly' : 'أسبوعياً',
    recentClips: lang === 'en' ? 'Recent Clips' : 'آخر اللقطات',
    recentVods: lang === 'en' ? 'Past Streams' : 'البثوث السابقة',
    views: lang === 'en' ? 'Views' : 'مشاهدة',
    gift: lang === 'en' ? 'Gifts' : 'هدية',
    subBadges: lang === 'en' ? 'Sub Badges' : 'شارات المشتركين',
    noData: lang === 'en' ? 'No Data' : 'لا يوجد بيانات',
    watching: lang === 'en' ? 'Now Playing' : 'جاري المشاهدة',

    // Custom Empty States
    noDataWeekly: lang === 'en' ? 'No active gifters this week' : 'لا يوجد داعمين هذا الأسبوع',
    noDataMonthly: lang === 'en' ? 'No active gifters this month' : 'لا يوجد داعمين لهذا الشهر',
    noDataAllTime: lang === 'en' ? 'No records found' : 'لا يوجد سجلات بعد',
  };

  useEffect(() => {
    const channelSlug = KICK_CHANNEL_SLUG;
    
    const endpoints = {
      leaderboard: `https://kick.com/api/v2/channels/${channelSlug}/leaderboards`,
      clips: `https://kick.com/api/v2/channels/${channelSlug}/clips`,
      videos: `https://kick.com/api/v2/channels/${channelSlug}/videos`,
      channel: `https://kick.com/api/v2/channels/${channelSlug}`
    };

    // جلب معلومات القناة (المتابعين)
    kickFetch(endpoints.channel).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف إن وجد
        if (data) {
            const rawFollowers = data.followers_count ?? data.followersCount;
            const parsed = typeof rawFollowers === 'number' ? rawFollowers : parseInt(String(rawFollowers || '0'), 10);
            setChannelInfo({
                followers_count: (!isNaN(parsed) && parsed > 0) ? parsed : 1114,
                subscriber_badges: data.subscriber_badges || []
            });
        }
    }).catch(() => setChannelInfo(null));

    // جلب الداعمين
    kickFetch(endpoints.leaderboard).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف
        if (data) {
            setLeaderboards({
                gifts: data.gifts || [],
                gifts_week: data.gifts_week || [],
                gifts_month: data.gifts_month || [] 
            });
        }
    }).catch(() => setLeaderboards({ gifts: [], gifts_week: [], gifts_month: [] }));

    // جلب اللقطات (آخر اللقطات مع منطق استخراج قوي لضمان ظهور البيانات)
    kickFetch(endpoints.clips).then(rawData => {
        // فك التغليف لجميع الهياكل المحتملة من Kick API
        const data = rawData?.data || rawData; 
        const clipsArray = data?.clips || (Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []));
        
        // ترتيب تنازلي حسب التاريخ (الأحدث أولاً)
        const sortedClips = [...clipsArray].sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setClips(sortedClips.slice(0, 4));
    }).catch(() => setClips([]));

    // جلب الفيديوهات
    kickFetch(endpoints.videos).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف
        const videosArray = data?.videos || (Array.isArray(data) ? data : []);
        setVideos(videosArray.slice(0, 3));
    }).catch(() => setVideos([]));

  }, []);

  return (
    <>
      <div className="w-full space-y-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

        {/* --- KICK SUB BADGES & TOP SUPPORTERS (iCG1 – كبار الداعمين (9).html) --- */}
        <TopSupportersArena
          lang={lang}
          channelInfo={channelInfo}
          leaderboards={leaderboards}
        />

        {/* --- CHAT LEGENDS (أساطير الشات — نفس تصميم 98765890.html) --- */}
        <div className="pt-8 border-t border-white/5">
          <ChatLegends />
        </div>

        {/* --- ARCHIVE: PAST STREAMS & LATEST CLIPS (iCG1 – الأرشيف (1).html) --- */}
        <div className="pt-8 border-t border-white/5">
          <ArchiveSection lang={lang} />
        </div>
      </div>
    </>
  );
};